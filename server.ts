import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

type UserRole = 'admin' | 'guru' | 'tenaga_kependidikan';
type MajorCode = 'TKJ' | 'DKV' | 'AK' | 'BC' | 'MPLB' | 'BD';

interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  nip: string;
  role: UserRole;
  department: string;
  created_at: string;
}

interface AuthedRequest extends Request {
  user?: AuthUser;
  accessToken?: string;
}

const PORT = Number(process.env.PORT) || 3000;
const VALID_ROLES: UserRole[] = ['admin', 'guru', 'tenaga_kependidikan'];
const VALID_MAJORS: MajorCode[] = ['TKJ', 'DKV', 'AK', 'BC', 'MPLB', 'BD'];

function cleanEnv(val?: string): string {
  return (val || '').trim().replace(/^["']|["']$/g, '');
}

const SUPABASE_URL = cleanEnv(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
const SUPABASE_ANON_KEY = cleanEnv(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);
const SUPABASE_SERVICE_ROLE_KEY = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

const isPlaceholder = (v: string) =>
  !v ||
  v.includes('your-project-id') ||
  v.includes('your-supabase') ||
  v.startsWith('MY_');

const isSupabaseMode = Boolean(
  !isPlaceholder(SUPABASE_URL) &&
    !isPlaceholder(SUPABASE_ANON_KEY) &&
    SUPABASE_URL.startsWith('http')
);

const hasServiceRoleKey = Boolean(isSupabaseMode && !isPlaceholder(SUPABASE_SERVICE_ROLE_KEY));

let supabaseAdmin: SupabaseClient | null = null;
let supabaseAnon: SupabaseClient | null = null;
let adminDbWorks: boolean | null = null;

if (isSupabaseMode) {
  supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  if (hasServiceRoleKey) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
}

function createUserSupabase(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

async function getSupabaseDb(req: AuthedRequest): Promise<SupabaseClient> {
  if (supabaseAdmin) {
    if (adminDbWorks === true) return supabaseAdmin;
    if (adminDbWorks === null) {
      const { error } = await supabaseAdmin.from('profiles').select('id').limit(1);
      adminDbWorks = !error;
      if (adminDbWorks) return supabaseAdmin;
    }
  }
  return createUserSupabase(req.accessToken || '');
}

async function resolveSupabaseProfile(
  authUser: { id: string; email?: string; user_metadata?: Record<string, unknown>; created_at?: string },
  accessToken: string
): Promise<AuthUser> {
  const meta = (authUser.user_metadata || {}) as Record<string, string>;
  const fallbackName = meta.full_name || (authUser.email || '').split('@')[0] || 'Pengguna';
  const fallbackRole: UserRole = VALID_ROLES.includes(meta.role as UserRole)
    ? (meta.role as UserRole)
    : 'admin';

  const clientsToTry: SupabaseClient[] = [];
  if (supabaseAdmin && adminDbWorks !== false) clientsToTry.push(supabaseAdmin);
  clientsToTry.push(createUserSupabase(accessToken));

  for (const client of clientsToTry) {
    const { data: profile, error: profErr } = await client
      .from('profiles')
      .select('id, email, full_name, nip, role, department, created_at')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profErr) {
      if (client === supabaseAdmin) adminDbWorks = false;
      continue;
    }

    if (profile) {
      if (client === supabaseAdmin) adminDbWorks = true;
      return sanitizeUser(profile);
    }

    // Row does not exist yet in profiles (e.g. created in Supabase Dashboard before trigger)
    const { count: profCount } = await client
      .from('profiles')
      .select('id', { count: 'exact' })
      .limit(1);

    const assignedRole: UserRole =
      (profCount ?? 0) === 0
        ? 'admin'
        : VALID_ROLES.includes(meta.role as UserRole)
          ? (meta.role as UserRole)
          : 'admin';

    const { data: synced } = await client
      .from('profiles')
      .upsert({
        id: authUser.id,
        email: authUser.email || '',
        full_name: fallbackName,
        nip: meta.nip || '',
        role: assignedRole,
        department: meta.department || '',
      })
      .select('id, email, full_name, nip, role, department, created_at')
      .maybeSingle();

    if (synced) {
      return sanitizeUser(synced);
    }
  }

  return {
    id: authUser.id,
    email: authUser.email || '',
    full_name: fallbackName,
    nip: meta.nip || '',
    role: fallbackRole,
    department: meta.department || '',
    created_at: authUser.created_at || new Date().toISOString(),
  };
}

// Local SQLite fallback database when Supabase env vars are not yet provided
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const db = new Database(path.join(dataDir, 'attendance.db'));
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    nip TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL CHECK (role IN ('admin', 'guru', 'tenaga_kependidikan')),
    department TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    nis TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    major TEXT NOT NULL CHECK (major IN ('TKJ', 'DKV', 'AK', 'BC', 'MPLB', 'BD')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS employee_attendance (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attendance_date TEXT NOT NULL,
    check_in TEXT,
    check_out TEXT,
    status TEXT NOT NULL CHECK (status IN ('Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE(user_id, attendance_date)
  );

  CREATE TABLE IF NOT EXISTS student_attendance (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    attendance_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Hadir', 'Sakit', 'Izin', 'Alpa')),
    notes TEXT NOT NULL DEFAULT '',
    recorded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    UNIQUE(student_id, attendance_date)
  );
`);

const SESSION_SECRET =
  process.env.APP_SESSION_SECRET ||
  crypto.createHash('sha256').update(process.cwd() + '_smk_prima_unggul').digest('hex');

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function signLocalToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyLocalToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: string;
      exp?: number;
    };
    if (!parsed.sub || !parsed.exp || parsed.exp < Date.now()) return null;
    return parsed.sub;
  } catch {
    return null;
  }
}

function getTodayDateString(): string {
  const now = new Date();
  const offsetMs = 7 * 60 * 60 * 1000; // Asia/Jakarta WIB
  const wib = new Date(now.getTime() + offsetMs);
  return wib.toISOString().slice(0, 10);
}

function sanitizeUser(row: {
  id: string;
  email: string;
  full_name: string;
  nip: string;
  role: string;
  department: string;
  created_at: string;
}): AuthUser {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    nip: row.nip || '',
    role: row.role as UserRole,
    department: row.department || '',
    created_at: row.created_at,
  };
}

async function authenticateRequest(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    res.status(401).json({ error: 'Sesi tidak ditemukan. Silakan login kembali.' });
    return;
  }

  try {
    if (isSupabaseMode && supabaseAnon) {
      const { data: authData, error: authErr } = await supabaseAnon.auth.getUser(token);
      if (authErr || !authData.user) {
        res.status(401).json({ error: 'Sesi berakhir atau tidak valid.' });
        return;
      }

      req.accessToken = token;
      req.user = await resolveSupabaseProfile(authData.user, token);
      next();
      return;
    }

    const userId = verifyLocalToken(token);
    if (!userId) {
      res.status(401).json({ error: 'Token sesi tidak valid atau telah kedaluwarsa.' });
      return;
    }

    const row = db
      .prepare('SELECT id, email, full_name, nip, role, department, created_at FROM users WHERE id = ?')
      .get(userId) as
      | {
          id: string;
          email: string;
          full_name: string;
          nip: string;
          role: string;
          department: string;
          created_at: string;
        }
      | undefined;

    if (!row) {
      res.status(401).json({ error: 'Akun tidak ditemukan.' });
      return;
    }

    req.user = sanitizeUser(row);
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Gagal memverifikasi sesi pengguna.' });
  }
}

function requireRole(...roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Tidak terautentikasi.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Anda tidak memiliki izin akses untuk menu ini.' });
      return;
    }
    next();
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // ==========================================================================
  // AUTH ROUTES
  // ==========================================================================

  app.get('/api/auth/bootstrap-status', async (_req: Request, res: Response) => {
    try {
      if (isSupabaseMode) {
        let adminErrorDetail = '';
        let authAdminErrorDetail = '';

        if (supabaseAdmin) {
          const { count, error } = await supabaseAdmin
            .from('profiles')
            .select('id', { count: 'exact' })
            .limit(1);

          if (!error) {
            adminDbWorks = true;
            res.json({ hasUsers: (count ?? 0) > 0, provider: 'supabase', schemaReady: true });
            return;
          }
          adminDbWorks = false;
          adminErrorDetail = error.message || error.code || 'unknown db error';

          const { error: authErr } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 1,
          });
          if (authErr) {
            authAdminErrorDetail = authErr.message || 'unknown auth admin error';
          }
        }

        const keyHint = !SUPABASE_SERVICE_ROLE_KEY
          ? 'kosong'
          : SUPABASE_SERVICE_ROLE_KEY === SUPABASE_ANON_KEY
            ? 'sama dengan ANON_KEY'
            : SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_publishable_')
              ? 'menggunakan sb_publishable_ (bukan service_role / sb_secret_)'
              : SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ')
                ? 'format JWT'
                : 'format kustom';

        let schemaError = 'SUPABASE_SERVICE_ROLE_KEY belum diatur di Secrets.';
        if (supabaseAdmin) {
          if (SUPABASE_SERVICE_ROLE_KEY === SUPABASE_ANON_KEY) {
            schemaError =
              'SUPABASE_SERVICE_ROLE_KEY bernilai sama dengan SUPABASE_ANON_KEY. Ganti dengan service_role secret key dari Supabase Dashboard → Project Settings → API.';
          } else if (SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_publishable_')) {
            schemaError =
              'SUPABASE_SERVICE_ROLE_KEY terisi publishable key (sb_publishable_...). Ganti dengan service_role / secret key dari Supabase Dashboard → Project Settings → API.';
          } else {
            schemaError = `Koneksi admin Supabase gagal (DB: ${adminErrorDetail || '-'}; Auth: ${authAdminErrorDetail || 'OK'}). Key: ${keyHint}.`;
          }
        }

        res.json({
          hasUsers: false,
          provider: 'supabase',
          schemaReady: false,
          schemaError,
        });
        return;
      }

      const row = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
      res.json({ hasUsers: row.cnt > 0, provider: 'local', schemaReady: true });
    } catch (err) {
      res.json({
        hasUsers: true,
        provider: isSupabaseMode ? 'supabase' : 'local',
        schemaReady: false,
        schemaError: err instanceof Error ? err.message : 'Gagal memeriksa status sistem.',
      });
    }
  });

  app.post('/api/auth/register-first', async (req: Request, res: Response) => {
    const { email, password, full_name, nip, department } = req.body as {
      email?: string;
      password?: string;
      full_name?: string;
      nip?: string;
      department?: string;
    };

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (full_name || '').trim();
    if (!cleanEmail || !password || password.length < 6 || !cleanName) {
      res.status(400).json({ error: 'Nama lengkap, email valid, dan password minimal 6 karakter wajib diisi.' });
      return;
    }

    try {
      if (isSupabaseMode && supabaseAdmin && supabaseAnon) {
        const { count, error: countErr } = await supabaseAdmin
          .from('profiles')
          .select('id', { count: 'exact' })
          .limit(1);

        if (countErr) {
          res.status(400).json({
            error: `Database Supabase belum siap (${countErr.message}). Jalankan file supabase/schema.sql pada SQL Editor Supabase terlebih dahulu.`,
          });
          return;
        }

        if ((count ?? 0) > 0) {
          res.status(403).json({ error: 'Akun admin pertama sudah terdaftar. Silakan login.' });
          return;
        }

        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: cleanName,
            nip: (nip || '').trim(),
            role: 'admin',
            department: (department || 'Tata Usaha & Manajemen').trim(),
          },
        });

        if (createErr || !created.user) {
          res.status(400).json({ error: createErr?.message || 'Gagal membuat user pertama di Supabase.' });
          return;
        }

        await supabaseAdmin.from('profiles').upsert({
          id: created.user.id,
          email: cleanEmail,
          full_name: cleanName,
          nip: (nip || '').trim(),
          role: 'admin',
          department: (department || 'Tata Usaha & Manajemen').trim(),
        });

        const { data: signedIn, error: signErr } = await supabaseAnon.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (signErr || !signedIn.session) {
          res.status(500).json({ error: signErr?.message || 'Akun dibuat, namun gagal masuk otomatis.' });
          return;
        }

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id, email, full_name, nip, role, department, created_at')
          .eq('id', created.user.id)
          .single();

        res.status(201).json({
          token: signedIn.session.access_token,
          user: profile ? sanitizeUser(profile) : null,
        });
        return;
      }

      const existing = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
      if (existing.cnt > 0) {
        res.status(403).json({ error: 'Akun admin pertama sudah terdaftar. Silakan login.' });
        return;
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO users (id, email, password_hash, full_name, nip, role, department, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'admin', ?, ?, ?)`
      ).run(
        id,
        cleanEmail,
        hashPassword(password),
        cleanName,
        (nip || '').trim(),
        (department || 'Tata Usaha & Manajemen').trim(),
        now,
        now
      );

      const userRow = db
        .prepare('SELECT id, email, full_name, nip, role, department, created_at FROM users WHERE id = ?')
        .get(id) as AuthUser;

      res.status(201).json({
        token: signLocalToken(id),
        user: sanitizeUser(userRow),
      });
    } catch (err) {
      console.error('register-first error:', err);
      res.status(500).json({ error: 'Terjadi kesalahan saat mendaftarkan admin pertama.' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !password) {
      res.status(400).json({ error: 'Email dan password wajib diisi.' });
      return;
    }

    try {
      if (isSupabaseMode && supabaseAnon) {
        const { data, error } = await supabaseAnon.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error || !data.session || !data.user) {
          const msg = (error?.message || '').toLowerCase();
          if (msg.includes('email not confirmed')) {
            res.status(401).json({
              error:
                'Email akun belum dikonfirmasi di Supabase Authentication. Silakan konfirmasi email user di Supabase Dashboard.',
            });
            return;
          }
          res.status(401).json({ error: error?.message || 'Email atau password salah.' });
          return;
        }

        const profile = await resolveSupabaseProfile(data.user, data.session.access_token);
        res.json({
          token: data.session.access_token,
          user: profile,
        });
        return;
      }

      const userRow = db
        .prepare(
          'SELECT id, email, password_hash, full_name, nip, role, department, created_at FROM users WHERE email = ?'
        )
        .get(cleanEmail) as
        | {
            id: string;
            email: string;
            password_hash: string;
            full_name: string;
            nip: string;
            role: string;
            department: string;
            created_at: string;
          }
        | undefined;

      if (!userRow || !verifyPassword(password, userRow.password_hash)) {
        res.status(401).json({ error: 'Email atau password salah.' });
        return;
      }

      res.json({
        token: signLocalToken(userRow.id),
        user: sanitizeUser(userRow),
      });
    } catch (err) {
      console.error('login error:', err);
      res.status(500).json({ error: 'Gagal memproses login.' });
    }
  });

  app.get('/api/auth/me', authenticateRequest, (req: AuthedRequest, res: Response) => {
    res.json({ user: req.user, provider: isSupabaseMode ? 'supabase' : 'local' });
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // ==========================================================================
  // DASHBOARD SUMMARY
  // ==========================================================================

  app.get('/api/dashboard', authenticateRequest, async (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const today = getTodayDateString();

    try {
      if (isSupabaseMode) {
        const sb = await getSupabaseDb(req);
        const { data: myToday } = await sb
          .from('employee_attendance')
          .select('*')
          .eq('user_id', user.id)
          .eq('attendance_date', today)
          .maybeSingle();

        const { count: myMonthCount } = await sb
          .from('employee_attendance')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .gte('attendance_date', today.slice(0, 7) + '-01')
          .limit(1);

        let totalEmployees = 0;
        let employeesPresentToday = 0;
        let totalStudents = 0;
        let studentsPresentToday = 0;
        let recentEmployeeLogs: unknown[] = [];
        let recentStudentLogs: unknown[] = [];

        if (user.role === 'admin') {
          const { count: empCount } = await sb
            .from('profiles')
            .select('id', { count: 'exact' })
            .limit(1);
          const { count: empTodayCount } = await sb
            .from('employee_attendance')
            .select('id', { count: 'exact' })
            .eq('attendance_date', today)
            .in('status', ['Hadir', 'Terlambat'])
            .limit(1);
          const { data: empLogs } = await sb
            .from('employee_attendance')
            .select('*, profiles(full_name, email, nip, role, department)')
            .order('created_at', { ascending: false })
            .limit(6);

          totalEmployees = empCount ?? 0;
          employeesPresentToday = empTodayCount ?? 0;
          recentEmployeeLogs = (empLogs || []).map((row: Record<string, unknown>) => ({
            ...row,
            user: row.profiles,
          }));
        }

        if (user.role === 'admin' || user.role === 'guru') {
          const { count: studCount } = await sb
            .from('students')
            .select('id', { count: 'exact' })
            .limit(1);
          const { count: studTodayCount } = await sb
            .from('student_attendance')
            .select('id', { count: 'exact' })
            .eq('attendance_date', today)
            .eq('status', 'Hadir')
            .limit(1);
          const { data: studLogs } = await sb
            .from('student_attendance')
            .select('*, students(id, nis, name, class_name, major)')
            .order('created_at', { ascending: false })
            .limit(6);

          totalStudents = studCount ?? 0;
          studentsPresentToday = studTodayCount ?? 0;
          recentStudentLogs = (studLogs || []).map((row: Record<string, unknown>) => ({
            ...row,
            student: row.students,
          }));
        }

        res.json({
          today,
          myToday: myToday || null,
          myMonthCount: myMonthCount ?? 0,
          totalEmployees,
          employeesPresentToday,
          totalStudents,
          studentsPresentToday,
          recentEmployeeLogs,
          recentStudentLogs,
        });
        return;
      }

      // Local SQLite mode
      const myToday = db
        .prepare('SELECT * FROM employee_attendance WHERE user_id = ? AND attendance_date = ?')
        .get(user.id, today);

      const myMonth = db
        .prepare('SELECT COUNT(*) as cnt FROM employee_attendance WHERE user_id = ? AND attendance_date >= ?')
        .get(user.id, today.slice(0, 7) + '-01') as { cnt: number };

      let totalEmployees = 0;
      let employeesPresentToday = 0;
      let totalStudents = 0;
      let studentsPresentToday = 0;
      let recentEmployeeLogs: unknown[] = [];
      let recentStudentLogs: unknown[] = [];

      if (user.role === 'admin') {
        totalEmployees = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
        employeesPresentToday = (
          db
            .prepare(
              `SELECT COUNT(*) as cnt FROM employee_attendance
               WHERE attendance_date = ? AND status IN ('Hadir', 'Terlambat')`
            )
            .get(today) as { cnt: number }
        ).cnt;

        const rows = db
          .prepare(
            `SELECT ea.*, u.full_name, u.email, u.nip, u.role, u.department
             FROM employee_attendance ea
             JOIN users u ON u.id = ea.user_id
             ORDER BY ea.created_at DESC LIMIT 6`
          )
          .all() as Array<Record<string, unknown>>;

        recentEmployeeLogs = rows.map((r) => ({
          id: r.id,
          user_id: r.user_id,
          attendance_date: r.attendance_date,
          check_in: r.check_in,
          check_out: r.check_out,
          status: r.status,
          notes: r.notes,
          created_at: r.created_at,
          user: {
            full_name: r.full_name,
            email: r.email,
            nip: r.nip,
            role: r.role,
            department: r.department,
          },
        }));
      }

      if (user.role === 'admin' || user.role === 'guru') {
        totalStudents = (db.prepare('SELECT COUNT(*) as cnt FROM students').get() as { cnt: number }).cnt;
        studentsPresentToday = (
          db
            .prepare(
              `SELECT COUNT(*) as cnt FROM student_attendance WHERE attendance_date = ? AND status = 'Hadir'`
            )
            .get(today) as { cnt: number }
        ).cnt;

        const rows = db
          .prepare(
            `SELECT sa.*, s.nis, s.name as student_name, s.class_name, s.major
             FROM student_attendance sa
             JOIN students s ON s.id = sa.student_id
             ORDER BY sa.created_at DESC LIMIT 6`
          )
          .all() as Array<Record<string, unknown>>;

        recentStudentLogs = rows.map((r) => ({
          id: r.id,
          student_id: r.student_id,
          attendance_date: r.attendance_date,
          status: r.status,
          notes: r.notes,
          recorded_by: r.recorded_by,
          created_at: r.created_at,
          student: {
            id: r.student_id,
            nis: r.nis,
            name: r.student_name,
            class_name: r.class_name,
            major: r.major,
          },
        }));
      }

      res.json({
        today,
        myToday: myToday || null,
        myMonthCount: myMonth.cnt,
        totalEmployees,
        employeesPresentToday,
        totalStudents,
        studentsPresentToday,
        recentEmployeeLogs,
        recentStudentLogs,
      });
    } catch (err) {
      console.error('dashboard error:', err);
      res.status(500).json({ error: 'Gagal memuat ringkasan dashboard.' });
    }
  });

  // ==========================================================================
  // ABSENSI KARYAWAN (SELF-SERVICE FOR ALL ROLES)
  // ==========================================================================

  app.get('/api/attendance/employees/me', authenticateRequest, async (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const today = getTodayDateString();

    try {
      if (isSupabaseMode) {
        const sb = await getSupabaseDb(req);
        const { data: todayRecord } = await sb
          .from('employee_attendance')
          .select('*')
          .eq('user_id', user.id)
          .eq('attendance_date', today)
          .maybeSingle();

        const { data: history, error } = await sb
          .from('employee_attendance')
          .select('*')
          .eq('user_id', user.id)
          .order('attendance_date', { ascending: false })
          .limit(31);

        if (error) {
          res.status(500).json({ error: error.message });
          return;
        }
        res.json({ today, todayRecord: todayRecord || null, history: history || [] });
        return;
      }

      const todayRecord = db
        .prepare('SELECT * FROM employee_attendance WHERE user_id = ? AND attendance_date = ?')
        .get(user.id, today);
      const history = db
        .prepare('SELECT * FROM employee_attendance WHERE user_id = ? ORDER BY attendance_date DESC LIMIT 31')
        .all(user.id);

      res.json({ today, todayRecord: todayRecord || null, history });
    } catch (err) {
      console.error('employee attendance me error:', err);
      res.status(500).json({ error: 'Gagal mengambil riwayat absensi pribadi.' });
    }
  });

  app.post('/api/attendance/employees/check-in', authenticateRequest, async (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const today = getTodayDateString();
    const { status, notes } = req.body as { status?: string; notes?: string };
    const allowedStatuses = ['Hadir', 'Terlambat', 'Izin', 'Sakit'];
    const cleanStatus = allowedStatuses.includes(status || '') ? status! : 'Hadir';
    const cleanNotes = (notes || '').trim();
    const nowIso = new Date().toISOString();

    try {
      if (isSupabaseMode) {
        const sb = await getSupabaseDb(req);
        const { data: existing } = await sb
          .from('employee_attendance')
          .select('id')
          .eq('user_id', user.id)
          .eq('attendance_date', today)
          .maybeSingle();

        if (existing) {
          res.status(409).json({ error: 'Anda sudah mencatat absen masuk hari ini.' });
          return;
        }

        const { data: inserted, error } = await sb
          .from('employee_attendance')
          .insert({
            user_id: user.id,
            attendance_date: today,
            check_in: cleanStatus === 'Hadir' || cleanStatus === 'Terlambat' ? nowIso : null,
            status: cleanStatus,
            notes: cleanNotes,
          })
          .select()
          .single();

        if (error) {
          res.status(500).json({ error: error.message });
          return;
        }
        res.status(201).json({ record: inserted });
        return;
      }

      const existing = db
        .prepare('SELECT id FROM employee_attendance WHERE user_id = ? AND attendance_date = ?')
        .get(user.id, today);

      if (existing) {
        res.status(409).json({ error: 'Anda sudah mencatat absen masuk hari ini.' });
        return;
      }

      const id = crypto.randomUUID();
      const checkInVal = cleanStatus === 'Hadir' || cleanStatus === 'Terlambat' ? nowIso : null;

      db.prepare(
        `INSERT INTO employee_attendance (id, user_id, attendance_date, check_in, check_out, status, notes, created_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`
      ).run(id, user.id, today, checkInVal, cleanStatus, cleanNotes, nowIso);

      const record = db.prepare('SELECT * FROM employee_attendance WHERE id = ?').get(id);
      res.status(201).json({ record });
    } catch (err) {
      console.error('check-in error:', err);
      res.status(500).json({ error: 'Gagal menyimpan absen masuk.' });
    }
  });

  app.post('/api/attendance/employees/check-out', authenticateRequest, async (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const today = getTodayDateString();
    const nowIso = new Date().toISOString();

    try {
      if (isSupabaseMode) {
        const sb = await getSupabaseDb(req);
        const { data: existing } = await sb
          .from('employee_attendance')
          .select('*')
          .eq('user_id', user.id)
          .eq('attendance_date', today)
          .maybeSingle();

        if (!existing) {
          res.status(400).json({ error: 'Anda belum melakukan absen masuk hari ini.' });
          return;
        }
        if (existing.check_out) {
          res.status(409).json({ error: 'Absen pulang hari ini sudah tercatat.' });
          return;
        }

        const { data: updated, error } = await sb
          .from('employee_attendance')
          .update({ check_out: nowIso })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          res.status(500).json({ error: error.message });
          return;
        }
        res.json({ record: updated });
        return;
      }

      const existing = db
        .prepare('SELECT * FROM employee_attendance WHERE user_id = ? AND attendance_date = ?')
        .get(user.id, today) as { id: string; check_out: string | null } | undefined;

      if (!existing) {
        res.status(400).json({ error: 'Anda belum melakukan absen masuk hari ini.' });
        return;
      }
      if (existing.check_out) {
        res.status(409).json({ error: 'Absen pulang hari ini sudah tercatat.' });
        return;
      }

      db.prepare('UPDATE employee_attendance SET check_out = ? WHERE id = ?').run(nowIso, existing.id);
      const record = db.prepare('SELECT * FROM employee_attendance WHERE id = ?').get(existing.id);
      res.json({ record });
    } catch (err) {
      console.error('check-out error:', err);
      res.status(500).json({ error: 'Gagal mencatat absen pulang.' });
    }
  });

  // ==========================================================================
  // DATA SISWA (ADMIN CRUD, GURU READ)
  // ==========================================================================

  app.get(
    '/api/students',
    authenticateRequest,
    requireRole('admin', 'guru'),
    async (req: AuthedRequest, res: Response) => {
      const classFilter = ((req.query.class_name as string) || '').trim();
      const majorFilter = ((req.query.major as string) || '').trim();
      const q = ((req.query.q as string) || '').trim().toLowerCase();

      try {
        if (isSupabaseMode) {
          const sb = await getSupabaseDb(req);
          let query = sb
            .from('students')
            .select('*')
            .order('class_name', { ascending: true })
            .order('name', { ascending: true });

          if (classFilter) query = query.eq('class_name', classFilter);
          if (majorFilter) query = query.eq('major', majorFilter);

          const { data, error } = await query;
          if (error) {
            res.status(500).json({ error: error.message });
            return;
          }

          let list = data || [];
          if (q) {
            list = list.filter(
              (s) =>
                s.name.toLowerCase().includes(q) ||
                s.nis.toLowerCase().includes(q) ||
                s.class_name.toLowerCase().includes(q)
            );
          }

          res.json({ students: list });
          return;
        }

        const all = db
          .prepare('SELECT * FROM students ORDER BY class_name ASC, name ASC')
          .all() as Array<{
          id: string;
          nis: string;
          name: string;
          class_name: string;
          major: string;
          created_at: string;
        }>;

        const filtered = all.filter((s) => {
          if (classFilter && s.class_name !== classFilter) return false;
          if (majorFilter && s.major !== majorFilter) return false;
          if (
            q &&
            !s.name.toLowerCase().includes(q) &&
            !s.nis.toLowerCase().includes(q) &&
            !s.class_name.toLowerCase().includes(q)
          ) {
            return false;
          }
          return true;
        });

        res.json({ students: filtered });
      } catch (err) {
        console.error('list students error:', err);
        res.status(500).json({ error: 'Gagal memuat data siswa.' });
      }
    }
  );

  app.post('/api/students', authenticateRequest, requireRole('admin'), async (req: AuthedRequest, res: Response) => {
    const { nis, name, class_name, major } = req.body as {
      nis?: string;
      name?: string;
      class_name?: string;
      major?: string;
    };

    const cleanNis = (nis || '').trim();
    const cleanName = (name || '').trim();
    const cleanClass = (class_name || '').trim();
    const cleanMajor = (major || '').trim().toUpperCase() as MajorCode;

    if (!cleanNis || !cleanName || !cleanClass || !VALID_MAJORS.includes(cleanMajor)) {
      res.status(400).json({ error: 'NIS, Nama Siswa, Kelas, dan Jurusan yang valid wajib diisi.' });
      return;
    }

    try {
      if (isSupabaseMode) {
        const sb = await getSupabaseDb(req);
        const { data, error } = await sb
          .from('students')
          .insert({
            nis: cleanNis,
            name: cleanName,
            class_name: cleanClass,
            major: cleanMajor,
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            res.status(409).json({ error: 'NIS sudah terdaftar pada siswa lain.' });
            return;
          }
          res.status(500).json({ error: error.message });
          return;
        }
        res.status(201).json({ student: data });
        return;
      }

      const dup = db.prepare('SELECT id FROM students WHERE nis = ?').get(cleanNis);
      if (dup) {
        res.status(409).json({ error: 'NIS sudah terdaftar pada siswa lain.' });
        return;
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO students (id, nis, name, class_name, major, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(id, cleanNis, cleanName, cleanClass, cleanMajor, now, now);

      const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
      res.status(201).json({ student });
    } catch (err) {
      console.error('create student error:', err);
      res.status(500).json({ error: 'Gagal menambahkan siswa.' });
    }
  });

  app.put('/api/students/:id', authenticateRequest, requireRole('admin'), async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { nis, name, class_name, major } = req.body as {
      nis?: string;
      name?: string;
      class_name?: string;
      major?: string;
    };

    const cleanNis = (nis || '').trim();
    const cleanName = (name || '').trim();
    const cleanClass = (class_name || '').trim();
    const cleanMajor = (major || '').trim().toUpperCase() as MajorCode;

    if (!cleanNis || !cleanName || !cleanClass || !VALID_MAJORS.includes(cleanMajor)) {
      res.status(400).json({ error: 'NIS, Nama Siswa, Kelas, dan Jurusan yang valid wajib diisi.' });
      return;
    }

    try {
      if (isSupabaseMode) {
        const sb = await getSupabaseDb(req);
        const { data, error } = await sb
          .from('students')
          .update({
            nis: cleanNis,
            name: cleanName,
            class_name: cleanClass,
            major: cleanMajor,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            res.status(409).json({ error: 'NIS sudah digunakan siswa lain.' });
            return;
          }
          res.status(500).json({ error: error.message });
          return;
        }
        res.json({ student: data });
        return;
      }

      const dup = db.prepare('SELECT id FROM students WHERE nis = ? AND id != ?').get(cleanNis, id);
      if (dup) {
        res.status(409).json({ error: 'NIS sudah digunakan siswa lain.' });
        return;
      }

      const now = new Date().toISOString();
      const result = db
        .prepare(
          `UPDATE students SET nis = ?, name = ?, class_name = ?, major = ?, updated_at = ? WHERE id = ?`
        )
        .run(cleanNis, cleanName, cleanClass, cleanMajor, now, id);

      if (result.changes === 0) {
        res.status(404).json({ error: 'Siswa tidak ditemukan.' });
        return;
      }

      const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
      res.json({ student });
    } catch (err) {
      console.error('update student error:', err);
      res.status(500).json({ error: 'Gagal memperbarui data siswa.' });
    }
  });

  app.delete('/api/students/:id', authenticateRequest, requireRole('admin'), async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;

    try {
      if (isSupabaseMode) {
        const sb = await getSupabaseDb(req);
        const { error } = await sb.from('students').delete().eq('id', id);
        if (error) {
          res.status(500).json({ error: error.message });
          return;
        }
        res.json({ ok: true });
        return;
      }

      const result = db.prepare('DELETE FROM students WHERE id = ?').run(id);
      if (result.changes === 0) {
        res.status(404).json({ error: 'Siswa tidak ditemukan.' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('delete student error:', err);
      res.status(500).json({ error: 'Gagal menghapus data siswa.' });
    }
  });

  // ==========================================================================
  // ABSENSI SISWA (GURU & ADMIN)
  // ==========================================================================

  app.get(
    '/api/attendance/students',
    authenticateRequest,
    requireRole('admin', 'guru'),
    async (req: AuthedRequest, res: Response) => {
      const date = ((req.query.date as string) || getTodayDateString()).trim();
      const className = ((req.query.class_name as string) || '').trim();

      try {
        if (isSupabaseMode) {
          const sb = await getSupabaseDb(req);
          let studentQuery = sb
            .from('students')
            .select('*')
            .order('class_name', { ascending: true })
            .order('name', { ascending: true });
          if (className) studentQuery = studentQuery.eq('class_name', className);

          const { data: students, error: sErr } = await studentQuery;
          if (sErr) {
            res.status(500).json({ error: sErr.message });
            return;
          }

          const { data: attRows, error: aErr } = await sb
            .from('student_attendance')
            .select('*')
            .eq('attendance_date', date);

          if (aErr) {
            res.status(500).json({ error: aErr.message });
            return;
          }

          const attMap = new Map((attRows || []).map((a) => [a.student_id, a]));
          const entries = (students || []).map((s) => {
            const att = attMap.get(s.id);
            return {
              student: s,
              status: att ? att.status : 'Hadir',
              notes: att ? att.notes || '' : '',
              recorded: Boolean(att),
            };
          });

          res.json({ date, entries });
          return;
        }

        const students = className
          ? (db
              .prepare('SELECT * FROM students WHERE class_name = ? ORDER BY name ASC')
              .all(className) as Array<Record<string, unknown>>)
          : (db
              .prepare('SELECT * FROM students ORDER BY class_name ASC, name ASC')
              .all() as Array<Record<string, unknown>>);

        const attRows = db
          .prepare('SELECT * FROM student_attendance WHERE attendance_date = ?')
          .all(date) as Array<{ student_id: string; status: string; notes: string }>;

        const attMap = new Map(attRows.map((a) => [a.student_id, a]));
        const entries = students.map((s) => {
          const att = attMap.get(s.id as string);
          return {
            student: s,
            status: att ? att.status : 'Hadir',
            notes: att ? att.notes || '' : '',
            recorded: Boolean(att),
          };
        });

        res.json({ date, entries });
      } catch (err) {
        console.error('get student attendance error:', err);
        res.status(500).json({ error: 'Gagal memuat daftar absensi siswa.' });
      }
    }
  );

  app.post(
    '/api/attendance/students/batch',
    authenticateRequest,
    requireRole('admin', 'guru'),
    async (req: AuthedRequest, res: Response) => {
      const user = req.user!;
      const { date, records } = req.body as {
        date?: string;
        records?: Array<{ student_id: string; status: string; notes?: string }>;
      };

      const targetDate = (date || getTodayDateString()).trim();
      if (!Array.isArray(records) || records.length === 0) {
        res.status(400).json({ error: 'Tidak ada data absensi siswa yang dikirim.' });
        return;
      }

      const validStatuses = ['Hadir', 'Sakit', 'Izin', 'Alpa'];

      try {
        if (isSupabaseMode) {
          const sb = await getSupabaseDb(req);
          const payload = records.map((r) => ({
            student_id: r.student_id,
            attendance_date: targetDate,
            status: validStatuses.includes(r.status) ? r.status : 'Hadir',
            notes: (r.notes || '').trim(),
            recorded_by: user.id,
          }));

          const { error } = await sb
            .from('student_attendance')
            .upsert(payload, { onConflict: 'student_id,attendance_date' });

          if (error) {
            res.status(500).json({ error: error.message });
            return;
          }
          res.json({ ok: true, count: payload.length });
          return;
        }

        const nowIso = new Date().toISOString();
        const upsert = db.prepare(`
          INSERT INTO student_attendance (id, student_id, attendance_date, status, notes, recorded_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(student_id, attendance_date) DO UPDATE SET
            status = excluded.status,
            notes = excluded.notes,
            recorded_by = excluded.recorded_by
        `);

        const runBatch = db.transaction((items: Array<{ student_id: string; status: string; notes?: string }>) => {
          for (const item of items) {
            const st = validStatuses.includes(item.status) ? item.status : 'Hadir';
            upsert.run(
              crypto.randomUUID(),
              item.student_id,
              targetDate,
              st,
              (item.notes || '').trim(),
              user.id,
              nowIso
            );
          }
        });

        runBatch(records);
        res.json({ ok: true, count: records.length });
      } catch (err) {
        console.error('batch student attendance error:', err);
        res.status(500).json({ error: 'Gagal menyimpan absensi siswa.' });
      }
    }
  );

  // ==========================================================================
  // REKAP ABSENSI
  // ==========================================================================

  app.get(
    '/api/recap/employees',
    authenticateRequest,
    requireRole('admin'),
    async (req: AuthedRequest, res: Response) => {
      const start = ((req.query.start as string) || '').trim();
      const end = ((req.query.end as string) || '').trim();
      const roleFilter = ((req.query.role as string) || '').trim();
      const statusFilter = ((req.query.status as string) || '').trim();
      const q = ((req.query.q as string) || '').trim().toLowerCase();

      try {
        if (isSupabaseMode) {
          const sb = await getSupabaseDb(req);
          let query = sb
            .from('employee_attendance')
            .select('*, profiles(full_name, email, nip, role, department)')
            .order('attendance_date', { ascending: false })
            .order('created_at', { ascending: false });

          if (start) query = query.gte('attendance_date', start);
          if (end) query = query.lte('attendance_date', end);
          if (statusFilter) query = query.eq('status', statusFilter);

          const { data, error } = await query;
          if (error) {
            res.status(500).json({ error: error.message });
            return;
          }

          const mapped = (data || [])
            .map((row: Record<string, unknown>) => ({
              ...row,
              user: row.profiles,
            }))
            .filter((row: Record<string, unknown>) => {
              const u = row.user as { full_name?: string; email?: string; nip?: string; role?: string } | undefined;
              if (roleFilter && u?.role !== roleFilter) return false;
              if (
                q &&
                !u?.full_name?.toLowerCase().includes(q) &&
                !u?.email?.toLowerCase().includes(q) &&
                !u?.nip?.toLowerCase().includes(q)
              ) {
                return false;
              }
              return true;
            });

          res.json({ records: mapped });
          return;
        }

        const rows = db
          .prepare(
            `SELECT ea.*, u.full_name, u.email, u.nip, u.role, u.department
             FROM employee_attendance ea
             JOIN users u ON u.id = ea.user_id
             ORDER BY ea.attendance_date DESC, ea.created_at DESC`
          )
          .all() as Array<Record<string, unknown>>;

        const filtered = rows
          .filter((r) => {
            if (start && (r.attendance_date as string) < start) return false;
            if (end && (r.attendance_date as string) > end) return false;
            if (roleFilter && r.role !== roleFilter) return false;
            if (statusFilter && r.status !== statusFilter) return false;
            if (
              q &&
              !(r.full_name as string).toLowerCase().includes(q) &&
              !(r.email as string).toLowerCase().includes(q) &&
              !(r.nip as string).toLowerCase().includes(q)
            ) {
              return false;
            }
            return true;
          })
          .map((r) => ({
            id: r.id,
            user_id: r.user_id,
            attendance_date: r.attendance_date,
            check_in: r.check_in,
            check_out: r.check_out,
            status: r.status,
            notes: r.notes,
            created_at: r.created_at,
            user: {
              full_name: r.full_name,
              email: r.email,
              nip: r.nip,
              role: r.role,
              department: r.department,
            },
          }));

        res.json({ records: filtered });
      } catch (err) {
        console.error('recap employees error:', err);
        res.status(500).json({ error: 'Gagal memuat rekap absensi karyawan.' });
      }
    }
  );

  app.get(
    '/api/recap/students',
    authenticateRequest,
    requireRole('admin', 'guru'),
    async (req: AuthedRequest, res: Response) => {
      const start = ((req.query.start as string) || '').trim();
      const end = ((req.query.end as string) || '').trim();
      const classFilter = ((req.query.class_name as string) || '').trim();
      const majorFilter = ((req.query.major as string) || '').trim();
      const statusFilter = ((req.query.status as string) || '').trim();
      const q = ((req.query.q as string) || '').trim().toLowerCase();

      try {
        if (isSupabaseMode) {
          const sb = await getSupabaseDb(req);
          let query = sb
            .from('student_attendance')
            .select('*, students(id, nis, name, class_name, major), profiles(full_name)')
            .order('attendance_date', { ascending: false })
            .order('created_at', { ascending: false });

          if (start) query = query.gte('attendance_date', start);
          if (end) query = query.lte('attendance_date', end);
          if (statusFilter) query = query.eq('status', statusFilter);

          const { data, error } = await query;
          if (error) {
            res.status(500).json({ error: error.message });
            return;
          }

          const mapped = (data || [])
            .map((row: Record<string, unknown>) => ({
              ...row,
              student: row.students,
              recorder_name: (row.profiles as { full_name?: string } | null)?.full_name || '-',
            }))
            .filter((row: Record<string, unknown>) => {
              const s = row.student as { nis?: string; name?: string; class_name?: string; major?: string } | undefined;
              if (classFilter && s?.class_name !== classFilter) return false;
              if (majorFilter && s?.major !== majorFilter) return false;
              if (
                q &&
                !s?.name?.toLowerCase().includes(q) &&
                !s?.nis?.toLowerCase().includes(q) &&
                !s?.class_name?.toLowerCase().includes(q)
              ) {
                return false;
              }
              return true;
            });

          res.json({ records: mapped });
          return;
        }

        const rows = db
          .prepare(
            `SELECT sa.*, s.nis, s.name as student_name, s.class_name, s.major, u.full_name as recorder_name
             FROM student_attendance sa
             JOIN students s ON s.id = sa.student_id
             LEFT JOIN users u ON u.id = sa.recorded_by
             ORDER BY sa.attendance_date DESC, sa.created_at DESC`
          )
          .all() as Array<Record<string, unknown>>;

        const filtered = rows
          .filter((r) => {
            if (start && (r.attendance_date as string) < start) return false;
            if (end && (r.attendance_date as string) > end) return false;
            if (classFilter && r.class_name !== classFilter) return false;
            if (majorFilter && r.major !== majorFilter) return false;
            if (statusFilter && r.status !== statusFilter) return false;
            if (
              q &&
              !(r.student_name as string).toLowerCase().includes(q) &&
              !(r.nis as string).toLowerCase().includes(q) &&
              !(r.class_name as string).toLowerCase().includes(q)
            ) {
              return false;
            }
            return true;
          })
          .map((r) => ({
            id: r.id,
            student_id: r.student_id,
            attendance_date: r.attendance_date,
            status: r.status,
            notes: r.notes,
            recorded_by: r.recorded_by,
            created_at: r.created_at,
            recorder_name: r.recorder_name || '-',
            student: {
              id: r.student_id,
              nis: r.nis,
              name: r.student_name,
              class_name: r.class_name,
              major: r.major,
            },
          }));

        res.json({ records: filtered });
      } catch (err) {
        console.error('recap students error:', err);
        res.status(500).json({ error: 'Gagal memuat rekap absensi siswa.' });
      }
    }
  );

  // ==========================================================================
  // USER MANAGEMENT (ADMIN ONLY — SYNCED WITH SUPABASE AUTH + HARD DELETE)
  // ==========================================================================

  app.get('/api/users', authenticateRequest, requireRole('admin'), async (req: AuthedRequest, res: Response) => {
    try {
      if (isSupabaseMode) {
        const sb = await getSupabaseDb(req);
        const { data, error } = await sb
          .from('profiles')
          .select('id, email, full_name, nip, role, department, created_at')
          .order('created_at', { ascending: true });

        if (error) {
          res.status(500).json({ error: error.message });
          return;
        }
        res.json({ users: (data || []).map(sanitizeUser) });
        return;
      }

      const rows = db
        .prepare('SELECT id, email, full_name, nip, role, department, created_at FROM users ORDER BY created_at ASC')
        .all() as Array<{
        id: string;
        email: string;
        full_name: string;
        nip: string;
        role: string;
        department: string;
        created_at: string;
      }>;

      res.json({ users: rows.map(sanitizeUser) });
    } catch (err) {
      console.error('list users error:', err);
      res.status(500).json({ error: 'Gagal memuat daftar user.' });
    }
  });

  app.post('/api/users', authenticateRequest, requireRole('admin'), async (req: AuthedRequest, res: Response) => {
    const { email, password, full_name, nip, role, department } = req.body as {
      email?: string;
      password?: string;
      full_name?: string;
      nip?: string;
      role?: string;
      department?: string;
    };

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (full_name || '').trim();
    const cleanRole = (role || '') as UserRole;

    if (!cleanEmail || !password || password.length < 6 || !cleanName || !VALID_ROLES.includes(cleanRole)) {
      res.status(400).json({ error: 'Nama, email, role yang valid, dan password minimal 6 karakter wajib diisi.' });
      return;
    }

    try {
      if (isSupabaseMode) {
        if (!supabaseAdmin) {
          res.status(400).json({
            error:
              'SUPABASE_SERVICE_ROLE_KEY belum diatur. Diperlukan Service Role Key untuk menambah user ke Supabase Authentication.',
          });
          return;
        }
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: cleanName,
            nip: (nip || '').trim(),
            role: cleanRole,
            department: (department || '').trim(),
          },
        });

        if (createErr || !created.user) {
          res.status(400).json({ error: createErr?.message || 'Gagal menambah user ke Supabase Authentication.' });
          return;
        }

        const { data: profile, error: profErr } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: created.user.id,
            email: cleanEmail,
            full_name: cleanName,
            nip: (nip || '').trim(),
            role: cleanRole,
            department: (department || '').trim(),
          })
          .select('id, email, full_name, nip, role, department, created_at')
          .single();

        if (profErr) {
          res.status(500).json({ error: profErr.message });
          return;
        }

        res.status(201).json({ user: sanitizeUser(profile) });
        return;
      }

      const dup = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
      if (dup) {
        res.status(409).json({ error: 'Email sudah terdaftar.' });
        return;
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO users (id, email, password_hash, full_name, nip, role, department, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        cleanEmail,
        hashPassword(password),
        cleanName,
        (nip || '').trim(),
        cleanRole,
        (department || '').trim(),
        now,
        now
      );

      const created = db
        .prepare('SELECT id, email, full_name, nip, role, department, created_at FROM users WHERE id = ?')
        .get(id) as AuthUser;

      res.status(201).json({ user: sanitizeUser(created) });
    } catch (err) {
      console.error('create user error:', err);
      res.status(500).json({ error: 'Gagal menambahkan user baru.' });
    }
  });

  app.put('/api/users/:id', authenticateRequest, requireRole('admin'), async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { email, password, full_name, nip, role, department } = req.body as {
      email?: string;
      password?: string;
      full_name?: string;
      nip?: string;
      role?: string;
      department?: string;
    };

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (full_name || '').trim();
    const cleanRole = (role || '') as UserRole;

    if (!cleanEmail || !cleanName || !VALID_ROLES.includes(cleanRole)) {
      res.status(400).json({ error: 'Nama lengkap, email, dan role yang valid wajib diisi.' });
      return;
    }

    if (password && password.length < 6) {
      res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
      return;
    }

    try {
      if (isSupabaseMode) {
        if (!supabaseAdmin) {
          res.status(400).json({
            error:
              'SUPABASE_SERVICE_ROLE_KEY belum diatur. Diperlukan Service Role Key untuk mengubah user di Supabase Authentication.',
          });
          return;
        }
        const updatePayload: {
          email: string;
          password?: string;
          user_metadata: Record<string, string>;
        } = {
          email: cleanEmail,
          user_metadata: {
            full_name: cleanName,
            nip: (nip || '').trim(),
            role: cleanRole,
            department: (department || '').trim(),
          },
        };
        if (password) updatePayload.password = password;

        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(id, updatePayload);
        if (authErr) {
          res.status(400).json({ error: authErr.message });
          return;
        }

        const { data: profile, error: profErr } = await supabaseAdmin
          .from('profiles')
          .update({
            email: cleanEmail,
            full_name: cleanName,
            nip: (nip || '').trim(),
            role: cleanRole,
            department: (department || '').trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('id, email, full_name, nip, role, department, created_at')
          .single();

        if (profErr) {
          res.status(500).json({ error: profErr.message });
          return;
        }

        res.json({ user: sanitizeUser(profile) });
        return;
      }

      const dup = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(cleanEmail, id);
      if (dup) {
        res.status(409).json({ error: 'Email sudah digunakan oleh akun lain.' });
        return;
      }

      const now = new Date().toISOString();
      if (password) {
        db.prepare(
          `UPDATE users SET email = ?, password_hash = ?, full_name = ?, nip = ?, role = ?, department = ?, updated_at = ?
           WHERE id = ?`
        ).run(
          cleanEmail,
          hashPassword(password),
          cleanName,
          (nip || '').trim(),
          cleanRole,
          (department || '').trim(),
          now,
          id
        );
      } else {
        db.prepare(
          `UPDATE users SET email = ?, full_name = ?, nip = ?, role = ?, department = ?, updated_at = ?
           WHERE id = ?`
        ).run(cleanEmail, cleanName, (nip || '').trim(), cleanRole, (department || '').trim(), now, id);
      }

      const updated = db
        .prepare('SELECT id, email, full_name, nip, role, department, created_at FROM users WHERE id = ?')
        .get(id) as AuthUser | undefined;

      if (!updated) {
        res.status(404).json({ error: 'User tidak ditemukan.' });
        return;
      }

      res.json({ user: sanitizeUser(updated) });
    } catch (err) {
      console.error('update user error:', err);
      res.status(500).json({ error: 'Gagal memperbarui data user.' });
    }
  });

  app.delete('/api/users/:id', authenticateRequest, requireRole('admin'), async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    if (req.user?.id === id) {
      res.status(400).json({ error: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.' });
      return;
    }

    try {
      if (isSupabaseMode) {
        if (!supabaseAdmin) {
          res.status(400).json({
            error:
              'SUPABASE_SERVICE_ROLE_KEY belum diatur. Diperlukan Service Role Key untuk hard delete user dari Supabase Authentication.',
          });
          return;
        }
        // Hard delete directly in Supabase Authentication (cascades to public.profiles)
        const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(id, false);
        if (delAuthErr) {
          res.status(400).json({ error: delAuthErr.message });
          return;
        }
        await supabaseAdmin.from('profiles').delete().eq('id', id);
        res.json({ ok: true });
        return;
      }

      const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
      if (result.changes === 0) {
        res.status(404).json({ error: 'User tidak ditemukan.' });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('hard delete user error:', err);
      res.status(500).json({ error: 'Gagal menghapus user secara permanen.' });
    }
  });

  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({ error: `Endpoint tidak ditemukan: ${req.method} ${req.originalUrl}` });
  });

  // ==========================================================================
  // VITE / STATIC SERVING
  // ==========================================================================

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `SMK Prima Unggul Attendance Server listening on http://localhost:${PORT} (mode: ${
        isSupabaseMode ? 'supabase' : 'local-sqlite'
      })`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
