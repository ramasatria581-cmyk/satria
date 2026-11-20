import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCheck, Save, Users } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { Student, StudentAttendanceStatus } from '../../types';

interface AttendanceEntry {
  student: Student;
  status: StudentAttendanceStatus;
  notes: string;
  recorded: boolean;
}

function getTodayWIB(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10);
}

const STATUS_OPTIONS: StudentAttendanceStatus[] = ['Hadir', 'Sakit', 'Izin', 'Alpa'];

export default function StudentAttendancePage() {
  const { user } = useAuth();
  const [date, setDate] = useState(getTodayWIB);
  const [selectedClass, setSelectedClass] = useState('');
  const [allClasses, setAllClasses] = useState<string[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load distinct class names from students
  useEffect(() => {
    apiFetch<{ students: Student[] }>('/api/students')
      .then((res) => {
        const classes = Array.from(new Set(res.students.map((s) => s.class_name))).sort();
        setAllClasses(classes);
      })
      .catch(() => {
        // handled in main load
      });
  }, []);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const params = new URLSearchParams({ date });
      if (selectedClass) params.set('class_name', selectedClass);
      const res = await apiFetch<{ date: string; entries: AttendanceEntry[] }>(
        `/api/attendance/students?${params.toString()}`
      );
      setEntries(res.entries);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memuat daftar absensi siswa.',
      });
    } finally {
      setLoading(false);
    }
  }, [date, selectedClass]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  function updateEntryStatus(studentId: string, status: StudentAttendanceStatus) {
    setEntries((prev) =>
      prev.map((e) => (e.student.id === studentId ? { ...e, status } : e))
    );
  }

  function updateEntryNotes(studentId: string, notes: string) {
    setEntries((prev) =>
      prev.map((e) => (e.student.id === studentId ? { ...e, notes } : e))
    );
  }

  function markAllPresent() {
    setEntries((prev) => prev.map((e) => ({ ...e, status: 'Hadir' })));
  }

  async function handleSaveBatch() {
    if (entries.length === 0) return;
    setSaving(true);
    setFeedback(null);
    try {
      await apiFetch('/api/attendance/students/batch', {
        method: 'POST',
        body: JSON.stringify({
          date,
          records: entries.map((e) => ({
            student_id: e.student.id,
            status: e.status,
            notes: e.notes,
          })),
        }),
      });
      setFeedback({
        type: 'success',
        text: `Absensi ${entries.length} siswa untuk tanggal ${date} berhasil disimpan.`,
      });
      await loadAttendance();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan absensi siswa.',
      });
    } finally {
      setSaving(false);
    }
  }

  const summary = useMemo(() => {
    const counts = { Hadir: 0, Sakit: 0, Izin: 0, Alpa: 0 };
    for (const e of entries) {
      counts[e.status] += 1;
    }
    return counts;
  }, [entries]);

  return (
    <div className="space-y-6">
      {/* Filter & Actions Bar */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:w-[460px]">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Tanggal Absensi
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Filter Kelas
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/20"
              >
                <option value="">Semua Kelas</option>
                {allClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={markAllPresent}
              disabled={entries.length === 0 || saving}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <CheckCheck className="h-4 w-4 text-emerald-600" />
              <span>Tandai Semua Hadir</span>
            </button>
            <button
              type="button"
              onClick={handleSaveBatch}
              disabled={entries.length === 0 || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Absensi'}</span>
            </button>
          </div>
        </div>

        {entries.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-6 border-t border-slate-200 pt-4 text-xs text-slate-600 font-mono tabular-nums">
            <span>Total: {entries.length}</span>
            <span className="text-emerald-700 font-semibold">Hadir: {summary.Hadir}</span>
            <span className="text-amber-700 font-semibold">Sakit: {summary.Sakit}</span>
            <span className="text-slate-700 font-semibold">Izin: {summary.Izin}</span>
            <span className="text-red-700 font-semibold">Alpa: {summary.Alpa}</span>
          </div>
        )}
      </section>

      {feedback && (
        <div
          className={`rounded-lg border p-3.5 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Attendance Grid */}
      <section className="rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Memuat data siswa...</div>
        ) : entries.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="mx-auto h-8 w-8 text-slate-300" />
            <h3 className="mt-3 text-sm font-semibold text-slate-900">Belum ada data siswa</h3>
            <p className="mt-1 text-xs text-slate-500">
              {user?.role === 'admin'
                ? 'Tambahkan siswa terlebih dahulu pada menu Data Siswa agar dapat diabsen.'
                : 'Hubungi Admin sekolah untuk menambahkan data induk siswa.'}
            </p>
            {user?.role === 'admin' && (
              <Link
                to="/app/data-siswa"
                className="mt-4 inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                Kelola Data Siswa
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-[#FAFAFA] text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">NIS</th>
                  <th className="px-5 py-3 font-semibold">Nama Siswa</th>
                  <th className="px-5 py-3 font-semibold">Kelas</th>
                  <th className="px-5 py-3 font-semibold">Status Kehadiran</th>
                  <th className="px-5 py-3 font-semibold">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {entries.map((entry) => (
                  <tr key={entry.student.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono text-slate-700 tabular-nums">
                      {entry.student.nis}
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      {entry.student.name}
                    </td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                      {entry.student.class_name} · {entry.student.major}
                    </td>
                    <td className="px-5 py-3">
                      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                        {STATUS_OPTIONS.map((st) => {
                          const active = entry.status === st;
                          let activeStyle = 'bg-red-600 text-white';
                          if (st === 'Hadir') activeStyle = 'bg-emerald-600 text-white';
                          else if (st === 'Sakit') activeStyle = 'bg-amber-600 text-white';
                          else if (st === 'Izin') activeStyle = 'bg-slate-800 text-white';

                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => updateEntryStatus(entry.student.id, st)}
                              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                                active ? activeStyle : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {st}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <input
                        type="text"
                        value={entry.notes}
                        onChange={(e) => updateEntryNotes(entry.student.id, e.target.value)}
                        placeholder="Keterangan opsional"
                        className="w-full min-w-[160px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-red-600 focus:outline-none"
                      />
                    </td>
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
