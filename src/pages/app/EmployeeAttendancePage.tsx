import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, LogIn, LogOut as LogOutIcon } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS, type EmployeeAttendanceRecord } from '../../types';
import { AttendanceStatusText, formatDateID, formatTimeWIB } from '../../components/StatusBadge';

type SelfCheckInStatus = 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit';

export default function EmployeeAttendancePage() {
  const { user } = useAuth();
  const [today, setToday] = useState('');
  const [todayRecord, setTodayRecord] = useState<EmployeeAttendanceRecord | null>(null);
  const [history, setHistory] = useState<EmployeeAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<SelfCheckInStatus>('Hadir');
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      setClock(
        new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Jakarta',
        })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{
        today: string;
        todayRecord: EmployeeAttendanceRecord | null;
        history: EmployeeAttendanceRecord[];
      }>('/api/attendance/employees/me');
      setToday(res.today);
      setTodayRecord(res.todayRecord);
      setHistory(res.history);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat data absensi.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCheckIn(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    try {
      await apiFetch('/api/attendance/employees/check-in', {
        method: 'POST',
        body: JSON.stringify({ status, notes }),
      });
      setNotes('');
      setFeedback({ type: 'success', text: 'Absensi masuk berhasil dicatat.' });
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mencatat absen masuk.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckOut() {
    setFeedback(null);
    setSubmitting(true);
    try {
      await apiFetch('/api/attendance/employees/check-out', { method: 'POST' });
      setFeedback({ type: 'success', text: 'Absensi pulang berhasil dicatat.' });
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mencatat absen pulang.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  const canCheckOut =
    todayRecord &&
    (todayRecord.status === 'Hadir' || todayRecord.status === 'Terlambat') &&
    !todayRecord.check_out;

  return (
    <div className="space-y-6">
      {/* Self-Service Attendance Panel */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold text-red-600">Presensi Mandiri Karyawan</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">{user.full_name}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {ROLE_LABELS[user.role]}
              {user.nip ? ` · NIP ${user.nip}` : ''}
              {today ? ` · ${formatDateID(today)}` : ''}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-[#FAFAFA] px-4 py-2.5 text-left sm:text-right">
            <p className="text-[11px] font-medium text-slate-500">Jam Sekarang (WIB)</p>
            <p className="font-mono text-2xl font-bold text-red-600 tabular-nums">{clock}</p>
          </div>
        </div>

        {feedback && (
          <div
            className={`mt-5 rounded-lg border p-3.5 text-sm ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {loading ? (
          <div className="mt-6 h-32 animate-pulse rounded-lg bg-slate-100" />
        ) : !todayRecord ? (
          <form onSubmit={handleCheckIn} className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-700">
                Pilih Status Kehadiran Hari Ini
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['Hadir', 'Terlambat', 'Izin', 'Sakit'] as SelfCheckInStatus[]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setStatus(opt)}
                    className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                      status === opt
                        ? 'border-red-600 bg-red-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Catatan / Keterangan (Opsional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Hadir tepat waktu / izin keperluan keluarga"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/20"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" />
              <span>{submitting ? 'Menyimpan...' : 'Catat Absen Masuk'}</span>
            </button>
          </form>
        ) : (
          <div className="mt-6 flex flex-col justify-between gap-5 rounded-xl border border-slate-200 bg-[#FAFAFA] p-5 sm:flex-row sm:items-center">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Status Hari Ini</span>
                <span>·</span>
                <AttendanceStatusText status={todayRecord.status} />
              </div>
              <div className="flex flex-wrap items-center gap-6 pt-1 font-mono text-sm tabular-nums">
                <div className="flex items-center gap-2 text-slate-800">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span>Masuk: {formatTimeWIB(todayRecord.check_in)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-800">
                  <CheckCircle2 className="h-4 w-4 text-slate-400" />
                  <span>Pulang: {formatTimeWIB(todayRecord.check_out)}</span>
                </div>
              </div>
              {todayRecord.notes && (
                <p className="text-xs text-slate-600">Catatan: {todayRecord.notes}</p>
              )}
            </div>

            {canCheckOut ? (
              <button
                type="button"
                onClick={handleCheckOut}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <LogOutIcon className="h-4 w-4" />
                <span>{submitting ? 'Menyimpan...' : 'Catat Absen Pulang'}</span>
              </button>
            ) : (
              <span className="text-xs font-semibold text-emerald-700">
                Presensi hari ini selesai tercatat
              </span>
            )}
          </div>
        )}
      </section>

      {/* Personal Attendance History */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-base font-bold text-slate-900">Riwayat Absensi Pribadi</h3>
          <p className="mt-0.5 text-xs text-slate-500">31 catatan kehadiran terakhir Anda</p>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-500">Memuat riwayat absensi...</div>
        ) : history.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Belum ada riwayat absensi karyawan untuk akun Anda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-[#FAFAFA] text-xs text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">Tanggal</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Jam Masuk</th>
                  <th className="px-6 py-3 font-semibold">Jam Pulang</th>
                  <th className="px-6 py-3 font-semibold">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {history.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3.5 font-mono text-slate-800 tabular-nums">
                      {formatDateID(row.attendance_date)}
                    </td>
                    <td className="px-6 py-3.5">
                      <AttendanceStatusText status={row.status} />
                    </td>
                    <td className="px-6 py-3.5 font-mono text-slate-700 tabular-nums">
                      {formatTimeWIB(row.check_in)}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-slate-700 tabular-nums">
                      {formatTimeWIB(row.check_out)}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">{row.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
