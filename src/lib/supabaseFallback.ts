import { supabaseClient } from './supabase';
import type { MajorCode, UserProfile, UserRole } from '../types';

const VALID_ROLES: UserRole[] = ['admin', 'guru', 'tenaga_kependidikan'];

function getTodayWIB(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10);
}

async function getCurrentClientUser(): Promise<UserProfile> {
  if (!supabaseClient) {
    throw new Error('Konfigurasi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY belum diisi.');
  }

  let { data: userData, error: userErr } = await supabaseClient.auth.getUser();
  if (userErr || !userData.user) {
    const storedToken = localStorage.getItem('smk_pu_token');
    if (storedToken) {
      const retry = await supabaseClient.auth.getUser(storedToken);
      userData = retry.data;
      userErr = retry.error;
    }
  }
  if (userErr || !userData.user) {
    throw new Error('Sesi tidak valid atau telah berakhir. Silakan login kembali.');
  }

  const authUser = userData.user;
  const meta = (authUser.user_metadata || {}) as Record<string, string>;
  const fallbackName = meta.full_name || (authUser.email || '').split('@')[0] || 'Pengguna';
  const fallbackRole: UserRole = VALID_ROLES.includes(meta.role as UserRole)
    ? (meta.role as UserRole)
    : 'admin';

  const { data: profile, error: profErr } = await supabaseClient
    .from('profiles')
    .select('id, email, full_name, nip, role, department, created_at')
    .eq('id', authUser.id)
    .maybeSingle();

  if (!profErr && profile) {
    return {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      nip: profile.nip || '',
      role: (VALID_ROLES.includes(profile.role as UserRole) ? profile.role : fallbackRole) as UserRole,
      department: profile.department || '',
      created_at: profile.created_at,
    };
  }

  // Try syncing profile row if missing
  const { data: synced } = await supabaseClient
    .from('profiles')
    .upsert({
      id: authUser.id,
      email: authUser.email || '',
      full_name: fallbackName,
      nip: meta.nip || '',
      role: fallbackRole,
      department: meta.department || '',
    })
    .select('id, email, full_name, nip, role, department, created_at')
    .maybeSingle();

  if (synced) {
    return {
      id: synced.id,
      email: synced.email,
      full_name: synced.full_name,
      nip: synced.nip || '',
      role: (VALID_ROLES.includes(synced.role as UserRole) ? synced.role : fallbackRole) as UserRole,
      department: synced.department || '',
      created_at: synced.created_at,
    };
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

export async function handleSupabaseClientFallback<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  if (!supabaseClient) {
    throw new Error(
      'Server API tidak tersedia dan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum dikonfigurasi.'
    );
  }

  const parsedUrl = new URL(url, window.location.origin);
  const path = parsedUrl.pathname;
  const method = (options.method || 'GET').toUpperCase();
  const body =
    typeof options.body === 'string' && options.body ? JSON.parse(options.body) : {};

  // 1. Bootstrap status
  if (path === '/api/auth/bootstrap-status' && method === 'GET') {
    const { count, error } = await supabaseClient
      .from('profiles')
      .select('id', { count: 'exact' })
      .limit(1);

    if (error) {
      return {
        hasUsers: true,
        provider: 'supabase',
        schemaReady: true,
      } as T;
    }

    return {
      hasUsers: (count ?? 0) > 0,
      provider: 'supabase',
      schemaReady: true,
    } as T;
  }

  // 2. Login
  if (path === '/api/auth/login' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error || !data.session || !data.user) {
      const msg = (error?.message || '').toLowerCase();
      if (msg.includes('email not confirmed')) {
        throw new Error(
          'Email akun belum dikonfirmasi di Supabase Authentication. Silakan konfirmasi email user di Supabase Dashboard.'
        );
      }
      throw new Error(error?.message || 'Email atau password salah.');
    }

    const user = await getCurrentClientUser();
    return { token: data.session.access_token, user } as T;
  }

  // 3. Register First Admin (client fallback via signUp)
  if (path === '/api/auth/register-first' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const fullName = String(body.full_name || '').trim();
    const nip = String(body.nip || '').trim();
    const department = String(body.department || 'Tata Usaha & Manajemen').trim();

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          nip,
          role: 'admin',
          department,
        },
      },
    });

    if (error || !data.user) {
      throw new Error(error?.message || 'Gagal mendaftarkan admin pertama.');
    }
    if (!data.session) {
      throw new Error(
        'Akun berhasil dibuat. Periksa kotak masuk email untuk konfirmasi lalu login.'
      );
    }

    const user = await getCurrentClientUser();
    return { token: data.session.access_token, user } as T;
  }

  // 4. Me & Logout
  if (path === '/api/auth/me' && method === 'GET') {
    const user = await getCurrentClientUser();
    return { user, provider: 'supabase' } as T;
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    await supabaseClient.auth.signOut();
    return { ok: true } as T;
  }

  // Ensure authenticated session exists for protected routes
  const currentUser = await getCurrentClientUser();
  const today = getTodayWIB();

  // 5. Dashboard
  if (path === '/api/dashboard' && method === 'GET') {
    const { data: myToday } = await supabaseClient
      .from('employee_attendance')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('attendance_date', today)
      .maybeSingle();

    const { count: myMonthCount } = await supabaseClient
      .from('employee_attendance')
      .select('id', { count: 'exact' })
      .eq('user_id', currentUser.id)
      .gte('attendance_date', today.slice(0, 7) + '-01')
      .limit(1);

    let totalEmployees = 0;
    let employeesPresentToday = 0;
    let totalStudents = 0;
    let studentsPresentToday = 0;
    let recentEmployeeLogs: unknown[] = [];
    let recentStudentLogs: unknown[] = [];

    if (currentUser.role === 'admin') {
      const { count: empCount } = await supabaseClient
        .from('profiles')
        .select('id', { count: 'exact' })
        .limit(1);
      const { count: empTodayCount } = await supabaseClient
        .from('employee_attendance')
        .select('id', { count: 'exact' })
        .eq('attendance_date', today)
        .in('status', ['Hadir', 'Terlambat'])
        .limit(1);
      const { data: empLogs } = await supabaseClient
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

    if (currentUser.role === 'admin' || currentUser.role === 'guru') {
      const { count: studCount } = await supabaseClient
        .from('students')
        .select('id', { count: 'exact' })
        .limit(1);
      const { count: studTodayCount } = await supabaseClient
        .from('student_attendance')
        .select('id', { count: 'exact' })
        .eq('attendance_date', today)
        .eq('status', 'Hadir')
        .limit(1);
      const { data: studLogs } = await supabaseClient
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

    return {
      today,
      myToday: myToday || null,
      myMonthCount: myMonthCount ?? 0,
      totalEmployees,
      employeesPresentToday,
      totalStudents,
      studentsPresentToday,
      recentEmployeeLogs,
      recentStudentLogs,
    } as T;
  }

  // 6. Employee Self-Attendance
  if (path === '/api/attendance/employees/me' && method === 'GET') {
    const { data: todayRecord } = await supabaseClient
      .from('employee_attendance')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('attendance_date', today)
      .maybeSingle();

    const { data: history, error } = await supabaseClient
      .from('employee_attendance')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('attendance_date', { ascending: false })
      .limit(31);

    if (error) throw new Error(error.message);
    return { today, todayRecord: todayRecord || null, history: history || [] } as T;
  }

  if (path === '/api/attendance/employees/check-in' && method === 'POST') {
    const status = ['Hadir', 'Terlambat', 'Izin', 'Sakit'].includes(body.status)
      ? body.status
      : 'Hadir';
    const notes = String(body.notes || '').trim();
    const nowIso = new Date().toISOString();

    const { data: inserted, error } = await supabaseClient
      .from('employee_attendance')
      .insert({
        user_id: currentUser.id,
        attendance_date: today,
        check_in: status === 'Hadir' || status === 'Terlambat' ? nowIso : null,
        status,
        notes,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { record: inserted } as T;
  }

  if (path === '/api/attendance/employees/check-out' && method === 'POST') {
    const nowIso = new Date().toISOString();
    const { data: existing } = await supabaseClient
      .from('employee_attendance')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('attendance_date', today)
      .maybeSingle();

    if (!existing) throw new Error('Anda belum melakukan absen masuk hari ini.');
    if (existing.check_out) throw new Error('Absen pulang hari ini sudah tercatat.');

    const { data: updated, error } = await supabaseClient
      .from('employee_attendance')
      .update({ check_out: nowIso })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { record: updated } as T;
  }

  // 7. Students CRUD
  if (path === '/api/students' && method === 'GET') {
    const classFilter = (parsedUrl.searchParams.get('class_name') || '').trim();
    const majorFilter = (parsedUrl.searchParams.get('major') || '').trim();
    const q = (parsedUrl.searchParams.get('q') || '').trim().toLowerCase();

    let query = supabaseClient
      .from('students')
      .select('*')
      .order('class_name', { ascending: true })
      .order('name', { ascending: true });

    if (classFilter) query = query.eq('class_name', classFilter);
    if (majorFilter) query = query.eq('major', majorFilter);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let list = data || [];
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.nis.toLowerCase().includes(q) ||
          s.class_name.toLowerCase().includes(q)
      );
    }
    return { students: list } as T;
  }

  if (path === '/api/students' && method === 'POST') {
    const { data, error } = await supabaseClient
      .from('students')
      .insert({
        nis: String(body.nis || '').trim(),
        name: String(body.name || '').trim(),
        class_name: String(body.class_name || '').trim(),
        major: String(body.major || '').trim().toUpperCase() as MajorCode,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { student: data } as T;
  }

  if (path.startsWith('/api/students/') && method === 'PUT') {
    const id = path.replace('/api/students/', '');
    const { data, error } = await supabaseClient
      .from('students')
      .update({
        nis: String(body.nis || '').trim(),
        name: String(body.name || '').trim(),
        class_name: String(body.class_name || '').trim(),
        major: String(body.major || '').trim().toUpperCase() as MajorCode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { student: data } as T;
  }

  if (path.startsWith('/api/students/') && method === 'DELETE') {
    const id = path.replace('/api/students/', '');
    const { error } = await supabaseClient.from('students').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { ok: true } as T;
  }

  // 8. Student Attendance
  if (path === '/api/attendance/students' && method === 'GET') {
    const date = (parsedUrl.searchParams.get('date') || today).trim();
    const className = (parsedUrl.searchParams.get('class_name') || '').trim();

    let sq = supabaseClient
      .from('students')
      .select('*')
      .order('class_name', { ascending: true })
      .order('name', { ascending: true });
    if (className) sq = sq.eq('class_name', className);

    const { data: students, error: sErr } = await sq;
    if (sErr) throw new Error(sErr.message);

    const { data: attRows, error: aErr } = await supabaseClient
      .from('student_attendance')
      .select('*')
      .eq('attendance_date', date);
    if (aErr) throw new Error(aErr.message);

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

    return { date, entries } as T;
  }

  if (path === '/api/attendance/students/batch' && method === 'POST') {
    const targetDate = String(body.date || today).trim();
    const records = Array.isArray(body.records) ? body.records : [];
    const payload = records.map((r: { student_id: string; status: string; notes?: string }) => ({
      student_id: r.student_id,
      attendance_date: targetDate,
      status: ['Hadir', 'Sakit', 'Izin', 'Alpa'].includes(r.status) ? r.status : 'Hadir',
      notes: String(r.notes || '').trim(),
      recorded_by: currentUser.id,
    }));

    const { error } = await supabaseClient
      .from('student_attendance')
      .upsert(payload, { onConflict: 'student_id,attendance_date' });
    if (error) throw new Error(error.message);
    return { ok: true, count: payload.length } as T;
  }

  // 9. Recap
  if (path === '/api/recap/employees' && method === 'GET') {
    const start = (parsedUrl.searchParams.get('start') || '').trim();
    const end = (parsedUrl.searchParams.get('end') || '').trim();
    const roleFilter = (parsedUrl.searchParams.get('role') || '').trim();
    const statusFilter = (parsedUrl.searchParams.get('status') || '').trim();
    const q = (parsedUrl.searchParams.get('q') || '').trim().toLowerCase();

    let query = supabaseClient
      .from('employee_attendance')
      .select('*, profiles(full_name, email, nip, role, department)')
      .order('attendance_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (start) query = query.gte('attendance_date', start);
    if (end) query = query.lte('attendance_date', end);
    if (statusFilter) query = query.eq('status', statusFilter);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const mapped = (data || [])
      .map((row: Record<string, unknown>) => ({ ...row, user: row.profiles }))
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

    return { records: mapped } as T;
  }

  if (path === '/api/recap/students' && method === 'GET') {
    const start = (parsedUrl.searchParams.get('start') || '').trim();
    const end = (parsedUrl.searchParams.get('end') || '').trim();
    const classFilter = (parsedUrl.searchParams.get('class_name') || '').trim();
    const majorFilter = (parsedUrl.searchParams.get('major') || '').trim();
    const statusFilter = (parsedUrl.searchParams.get('status') || '').trim();
    const q = (parsedUrl.searchParams.get('q') || '').trim().toLowerCase();

    let query = supabaseClient
      .from('student_attendance')
      .select('*, students(id, nis, name, class_name, major), profiles(full_name)')
      .order('attendance_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (start) query = query.gte('attendance_date', start);
    if (end) query = query.lte('attendance_date', end);
    if (statusFilter) query = query.eq('status', statusFilter);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

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

    return { records: mapped } as T;
  }

  // 10. Users Management
  if (path === '/api/users' && method === 'GET') {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('id, email, full_name, nip, role, department, created_at')
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return { users: data || [] } as T;
  }

  if (path.startsWith('/api/users')) {
    throw new Error(
      'Penambahan, edit, dan hard-delete akun user membutuhkan server backend Express aktif dengan SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  throw new Error(`Endpoint tidak tersedia: ${method} ${path}`);
}
