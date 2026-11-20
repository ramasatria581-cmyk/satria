import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { ROLE_LABELS, type EmployeeAttendanceRecord } from '../../types';
import { AttendanceStatusText, formatDateID, formatTimeWIB } from '../../components/StatusBadge';

export default function RecapEmployeePage() {
  const [records, setRecords] = useState<EmployeeAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const loadRecap = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start', startDate);
      if (endDate) params.set('end', endDate);
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('q', search.trim());

      const res = await apiFetch<{ records: EmployeeAttendanceRecord[] }>(
        `/api/recap/employees?${params.toString()}`
      );
      setRecords(res.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat rekap absensi karyawan.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, roleFilter, statusFilter, search]);

  useEffect(() => {
    loadRecap();
  }, [loadRecap]);

  const summary = useMemo(() => {
    let hadir = 0;
    let terlambat = 0;
    let izinSakit = 0;
    for (const r of records) {
      if (r.status === 'Hadir') hadir += 1;
      else if (r.status === 'Terlambat') terlambat += 1;
      else if (r.status === 'Izin' || r.status === 'Sakit') izinSakit += 1;
    }
    return { total: records.length, hadir, terlambat, izinSakit };
  }, [records]);

  function exportCsv() {
    const header = ['Tanggal', 'Nama Karyawan', 'NIP', 'Role', 'Jam Masuk', 'Jam Pulang', 'Status', 'Catatan'];
    const rows = records.map((r) => [
      r.attendance_date,
      r.user?.full_name || '',
      r.user?.nip || '',
      r.user?.role ? ROLE_LABELS[r.user.role] : '',
      formatTimeWIB(r.check_in),
      formatTimeWIB(r.check_out),
      r.status,
      (r.notes || '').replace(/"/g, '""'),
    ]);
    const csv = [header, ...rows].map((row) => row.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap-absensi-karyawan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Rekap Absensi Karyawan</h2>
            <p className="text-xs text-slate-500">
              Laporan kehadiran Admin, Guru, dan Tenaga Kependidikan
            </p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={records.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" />
            <span>Download CSV</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-red-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-red-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-red-600 focus:outline-none"
            >
              <option value="">Semua Role</option>
              <option value="admin">Admin</option>
              <option value="guru">Guru</option>
              <option value="tenaga_kependidikan">Tenaga Kependidikan</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-red-600 focus:outline-none"
            >
              <option value="">Semua Status</option>
              <option value="Hadir">Hadir</option>
              <option value="Terlambat">Terlambat</option>
              <option value="Izin">Izin</option>
              <option value="Sakit">Sakit</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Cari Karyawan</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nama atau NIP..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-xs text-slate-900 focus:border-red-600 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total Log</p>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {summary.total}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Hadir</p>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {summary.hadir}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Terlambat</p>
          <p className="mt-1 font-mono text-2xl font-bold text-amber-700 tabular-nums">
            {summary.terlambat}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Izin / Sakit</p>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-700 tabular-nums">
            {summary.izinSakit}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Recap Table */}
      <section className="rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Memuat rekap absensi...</div>
        ) : records.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Tidak ada catatan absensi karyawan yang cocok dengan filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-[#FAFAFA] text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Tanggal</th>
                  <th className="px-5 py-3 font-semibold">Nama Karyawan</th>
                  <th className="px-5 py-3 font-semibold">NIP</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Masuk</th>
                  <th className="px-5 py-3 font-semibold">Pulang</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-slate-700 tabular-nums whitespace-nowrap">
                      {formatDateID(r.attendance_date)}
                    </td>
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      {r.user?.full_name || '-'}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-600 tabular-nums">
                      {r.user?.nip || '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                      {r.user?.role ? ROLE_LABELS[r.user.role] : '-'}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-700 tabular-nums">
                      {formatTimeWIB(r.check_in)}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-700 tabular-nums">
                      {formatTimeWIB(r.check_out)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <AttendanceStatusText status={r.status} />
                    </td>
                    <td className="px-5 py-3 text-slate-600">{r.notes || '—'}</td>
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
