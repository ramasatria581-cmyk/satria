import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, UserCheck, Users, GraduationCap } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  ROLE_LABELS,
  type EmployeeAttendanceRecord,
  type StudentAttendanceRecord,
} from '../../types';
import { AttendanceStatusText, formatDateID, formatTimeWIB } from '../../components/StatusBadge';

interface DashboardData {
  today: string;
  myToday: EmployeeAttendanceRecord | null;
  myMonthCount: number;
  totalEmployees: number;
  employeesPresentToday: number;
  totalStudents: number;
  studentsPresentToday: number;
  recentEmployeeLogs: EmployeeAttendanceRecord[];
  recentStudentLogs: StudentAttendanceRecord[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nowText, setNowText] = useState('');

  useEffect(() => {
    const updateClock = () => {
      setNowText(
        new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Jakarta',
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch<DashboardData>('/api/dashboard')
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Gagal memuat dashboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold text-red-600">
            {ROLE_LABELS[user.role]}
            {user.department ? ` · ${user.department}` : ''}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Selamat Datang, {user.full_name}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {data ? formatDateID(data.today) : 'Memuat tanggal...'}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="rounded-lg border border-slate-200 bg-[#FAFAFA] px-4 py-2.5 text-right">
            <p className="text-[11px] font-medium text-slate-500">Waktu Server WIB</p>
            <p className="font-mono text-lg font-bold text-slate-900 tabular-nums">{nowText}</p>
          </div>
          <Link
            to="/app/absensi-karyawan"
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 whitespace-nowrap shrink-0"
          >
            <span>Absen Sekarang</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* KPI Strip */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white p-5" />
          ))}
        </div>
      ) : (
        data && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Personal Today Status */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Status Absen Anda Hari Ini</span>
                <Clock className="h-4 w-4 text-red-600" />
              </div>
              <div className="mt-3">
                {data.myToday ? (
                  <>
                    <AttendanceStatusText status={data.myToday.status} />
                    <p className="mt-1.5 font-mono text-xs text-slate-600 tabular-nums">
                      Masuk: {formatTimeWIB(data.myToday.check_in)} · Pulang:{' '}
                      {formatTimeWIB(data.myToday.check_out)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-base font-bold text-slate-900">Belum Absen</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Silakan catat kehadiran di menu Absensi Karyawan.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Personal Monthly Count */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Kehadiran Anda Bulan Ini</span>
                <UserCheck className="h-4 w-4 text-red-600" />
              </div>
              <p className="mt-3 font-mono text-3xl font-bold text-slate-900 tabular-nums">
                {data.myMonthCount}
              </p>
              <p className="mt-1 text-xs text-slate-500">Hari tercatat di sistem</p>
            </div>

            {/* Admin-only Employee Overview */}
            {user.role === 'admin' && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Karyawan Hadir Hari Ini</span>
                  <Users className="h-4 w-4 text-red-600" />
                </div>
                <p className="mt-3 font-mono text-3xl font-bold text-slate-900 tabular-nums">
                  {data.employeesPresentToday}
                  <span className="text-base font-normal text-slate-400">
                    /{data.totalEmployees}
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">Admin, Guru &amp; Tendik</p>
              </div>
            )}

            {/* Admin & Guru Student Overview */}
            {(user.role === 'admin' || user.role === 'guru') && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Siswa Hadir Hari Ini</span>
                  <GraduationCap className="h-4 w-4 text-red-600" />
                </div>
                <p className="mt-3 font-mono text-3xl font-bold text-slate-900 tabular-nums">
                  {data.studentsPresentToday}
                  <span className="text-base font-normal text-slate-400">
                    /{data.totalStudents}
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">Total siswa terdaftar</p>
              </div>
            )}
          </div>
        )
      )}

      {/* Recent Activity Sections */}
      {!loading && data && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {user.role === 'admin' && (
            <section className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h3 className="text-sm font-bold text-slate-900">Log Absensi Karyawan Terbaru</h3>
                <Link
                  to="/app/rekap/karyawan"
                  className="text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  Lihat Rekap
                </Link>
              </div>
              {data.recentEmployeeLogs.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  Belum ada catatan absensi karyawan.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-[#FAFAFA] text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Nama</th>
                        <th className="px-4 py-2.5 font-semibold">Tanggal</th>
                        <th className="px-4 py-2.5 font-semibold">Masuk</th>
                        <th className="px-4 py-2.5 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.recentEmployeeLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {log.user?.full_name || '-'}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600 tabular-nums">
                            {log.attendance_date}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600 tabular-nums">
                            {formatTimeWIB(log.check_in)}
                          </td>
                          <td className="px-4 py-3">
                            <AttendanceStatusText status={log.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {(user.role === 'admin' || user.role === 'guru') && (
            <section className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h3 className="text-sm font-bold text-slate-900">Log Absensi Siswa Terbaru</h3>
                <Link
                  to="/app/rekap/siswa"
                  className="text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  Lihat Rekap
                </Link>
              </div>
              {data.recentStudentLogs.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  Belum ada catatan absensi siswa.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-[#FAFAFA] text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Siswa</th>
                        <th className="px-4 py-2.5 font-semibold">Kelas</th>
                        <th className="px-4 py-2.5 font-semibold">Tanggal</th>
                        <th className="px-4 py-2.5 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.recentStudentLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {log.student?.name || '-'}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {log.student?.class_name || '-'}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600 tabular-nums">
                            {log.attendance_date}
                          </td>
                          <td className="px-4 py-3">
                            <AttendanceStatusText status={log.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
