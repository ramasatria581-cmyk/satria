export type UserRole = 'admin' | 'guru' | 'tenaga_kependidikan';

export type MajorCode = 'TKJ' | 'DKV' | 'AK' | 'BC' | 'MPLB' | 'BD';

export type EmployeeAttendanceStatus = 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alpa';

export type StudentAttendanceStatus = 'Hadir' | 'Sakit' | 'Izin' | 'Alpa';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  nip: string;
  role: UserRole;
  department: string;
  created_at: string;
}

export interface Student {
  id: string;
  nis: string;
  name: string;
  class_name: string;
  major: MajorCode;
  created_at: string;
}

export interface EmployeeAttendanceRecord {
  id: string;
  user_id: string;
  attendance_date: string;
  check_in: string | null;
  check_out: string | null;
  status: EmployeeAttendanceStatus;
  notes: string;
  created_at: string;
  user?: {
    full_name: string;
    email: string;
    nip: string;
    role: UserRole;
    department: string;
  };
}

export interface StudentAttendanceRecord {
  id: string;
  student_id: string;
  attendance_date: string;
  status: StudentAttendanceStatus;
  notes: string;
  recorded_by: string | null;
  created_at: string;
  student?: Student;
  recorder_name?: string;
}

export interface MajorProgram {
  code: MajorCode;
  name: string;
  cluster: string;
  description: string;
  competencies: string[];
}

export const MAJOR_PROGRAMS: MajorProgram[] = [
  {
    code: 'TKJ',
    name: 'Teknik Komputer dan Jaringan',
    cluster: 'Teknologi Informasi & Media Kreatif',
    description:
      'Membekali siswa keahlian instalasi jaringan fiber optik, administrasi server Linux/Windows, keamanan siber dasar, serta perawatan infrastruktur TI.',
    competencies: ['Infrastruktur Jaringan & Mikrotik', 'Administrasi Server & Cloud', 'Keamanan Jaringan'],
  },
  {
    code: 'DKV',
    name: 'Desain Komunikasi Visual',
    cluster: 'Teknologi Informasi & Media Kreatif',
    description:
      'Mengembangkan kompetensi ilustrasi digital, perancangan identitas merek, tata letak editorial, fotografi komersial, serta desain antarmuka modern.',
    competencies: ['Desain Grafis & Branding', 'Fotografi & Videografi', 'UI/UX Visual Design'],
  },
  {
    code: 'BC',
    name: 'Broadcasting dan Perfilman',
    cluster: 'Teknologi Informasi & Media Kreatif',
    description:
      'Melatih siswa dalam produksi siaran televisi, sinematografi, penyuntingan audio-video profesional, manajemen studio, dan penulisan naskah media.',
    competencies: ['Sinematografi & Tata Kamera', 'Editing Audio Video', 'Produksi Program Siaran'],
  },
  {
    code: 'AK',
    name: 'Akuntansi dan Keuangan Lembaga',
    cluster: 'Keuangan & Akuntansi',
    description:
      'Mencetak tenaga ahli pembukuan perusahaan jasa/dagang, penyusunan laporan keuangan berbasis perangkat lunak akuntansi, dan administrasi perpajakan.',
    competencies: ['Akuntansi Keuangan & MYOB/Accurate', 'Administrasi Perpajakan', 'Audit Dasar'],
  },
  {
    code: 'MPLB',
    name: 'Manajemen Perkantoran dan Layanan Bisnis',
    cluster: 'Bisnis & Manajemen Perkantoran',
    description:
      'Menyiapkan lulusan terampil dalam tata kelola dokumen digital, korespondensi bisnis, layanan pelanggan prima, dan administrasi operasional perusahaan.',
    competencies: ['Administrasi Perkantoran Modern', 'Kearsipan Digital', 'Layanan Bisnis & Protokoler'],
  },
  {
    code: 'BD',
    name: 'Bisnis Digital',
    cluster: 'Bisnis & Manajemen Perkantoran',
    description:
      'Fokus pada strategi pemasaran digital, pengelolaan toko daring (e-commerce), analisis data pemasaran, dan kewirausahaan berbasis teknologi.',
    competencies: ['Digital Marketing & SEO', 'Pengelolaan E-Commerce', 'Content & Social Strategy'],
  },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  guru: 'Guru',
  tenaga_kependidikan: 'Tenaga Kependidikan',
};
