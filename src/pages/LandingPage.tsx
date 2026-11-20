import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Building2, BookOpen, ShieldCheck } from 'lucide-react';
import { MAJOR_PROGRAMS } from '../types';

type ClusterFilter =
  | 'Semua'
  | 'Teknologi Informasi & Media Kreatif'
  | 'Keuangan & Akuntansi'
  | 'Bisnis & Manajemen Perkantoran';

const CLUSTERS: Array<{ label: string; value: ClusterFilter }> = [
  { label: 'Semua Jurusan', value: 'Semua' },
  { label: 'Teknologi & Media', value: 'Teknologi Informasi & Media Kreatif' },
  { label: 'Keuangan & Akuntansi', value: 'Keuangan & Akuntansi' },
  { label: 'Bisnis & Perkantoran', value: 'Bisnis & Manajemen Perkantoran' },
];

export default function LandingPage() {
  const [selectedCluster, setSelectedCluster] = useState<ClusterFilter>('Semua');

  const filteredMajors =
    selectedCluster === 'Semua'
      ? MAJOR_PROGRAMS
      : MAJOR_PROGRAMS.filter((m) => m.cluster === selectedCluster);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
          <Link
            to="/"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            SMK Prima Unggul
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#profil"
              className="hover:text-red-600 transition-colors whitespace-nowrap shrink-0"
            >
              Profil
            </a>
            <a
              href="#jurusan"
              className="hover:text-red-600 transition-colors whitespace-nowrap shrink-0"
            >
              Jurusan
            </a>
            <a
              href="#sistem"
              className="hover:text-red-600 transition-colors whitespace-nowrap shrink-0"
            >
              Sistem Absensi
            </a>
            <a
              href="#kontak"
              className="hover:text-red-600 transition-colors whitespace-nowrap shrink-0"
            >
              Kontak
            </a>
          </nav>

          <div className="shrink-0">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 whitespace-nowrap shrink-0"
            >
              <span>Masuk Portal</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14 lg:py-20">
          <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
            {/* Hero Text Column */}
            <div className="flex flex-col justify-between lg:col-span-7">
              <div>
                <p className="text-xs font-semibold tracking-wide text-red-600">
                  Pendidikan Vokasi Terpadu · Tangerang Selatan
                </p>
                <h1 className="mt-4 text-balance text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:leading-[1.12]">
                  Mencetak Lulusan Vokasi Kompeten, Berkarakter, dan Siap Kerja.
                </h1>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600">
                  SMK Prima Unggul menyelenggarakan pendidikan kejuruan berbasis industri melalui
                  tiga rumpun bidang utama dan enam kompetensi keahlian unggulan: TKJ, DKV, AK,
                  BC, MPLB, serta BD, didukung sistem absensi siswa dan karyawan terintegrasi.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 whitespace-nowrap shrink-0"
                >
                  <span>Buka Portal Absensi</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#jurusan"
                  className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  Jelajahi Kompetensi Keahlian
                </a>
              </div>
            </div>

            {/* Hero Architectural Visual Composition */}
            <div className="lg:col-span-5">
              <div className="relative flex h-full min-h-[320px] flex-col justify-between overflow-hidden rounded-xl border border-red-800/20 bg-gradient-to-br from-red-700 via-red-800 to-slate-900 p-7 text-white">
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 h-full w-full opacity-15"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <pattern id="campus-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.75" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#campus-grid)" />
                </svg>

                <div className="relative z-10 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-red-100">Identitas Sekolah</p>
                    <p className="mt-1 text-xl font-bold tracking-tight">SMK Prima Unggul</p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/25 bg-white/10">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                </div>

                <div className="relative z-10 my-8 border-y border-white/20 py-5">
                  <p className="text-xs font-medium text-red-100">Enam Kompetensi Keahlian</p>
                  <div className="mt-3 grid grid-cols-3 gap-3 font-mono text-sm font-semibold tabular-nums">
                    <div className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-center">
                      TKJ
                    </div>
                    <div className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-center">
                      DKV
                    </div>
                    <div className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-center">
                      BC
                    </div>
                    <div className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-center">
                      AK
                    </div>
                    <div className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-center">
                      MPLB
                    </div>
                    <div className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-center">
                      BD
                    </div>
                  </div>
                </div>

                <div className="relative z-10 flex items-center justify-between text-xs text-red-100">
                  <span>Portal Kehadiran Siswa &amp; Karyawan</span>
                  <span className="font-mono tabular-nums">Tahun Ajaran Aktif</span>
                </div>
              </div>
            </div>
          </div>

          {/* Full-width 3-Column Overview Strip below Hero Split */}
          <div className="mt-12 grid grid-cols-1 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-[#FAFAFA] md:grid-cols-3 md:divide-x md:divide-y-0">
            <div className="p-6">
              <p className="font-mono text-2xl font-bold text-red-600 tabular-nums">3 Bidang</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Rumpun Jurusan Utama</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Teknologi &amp; Media Kreatif, Keuangan &amp; Akuntansi, serta Bisnis &amp; Manajemen.
              </p>
            </div>
            <div className="p-6">
              <p className="font-mono text-2xl font-bold text-red-600 tabular-nums">6 Program</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Kompetensi Keahlian</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                TKJ, DKV, BC, AK, MPLB, dan BD dengan kurikulum praktik industri.
              </p>
            </div>
            <div className="p-6">
              <p className="font-mono text-2xl font-bold text-red-600 tabular-nums">1 Portal</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Absensi Terpadu</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Presensi harian mandiri karyawan dan presensi kelas siswa berbasis peran.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Profil SMK Prima Unggul */}
      <section id="profil" className="border-b border-slate-200 bg-[#FAFAFA]">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="text-xs font-semibold text-red-600">Profil Sekolah</p>
              <h2 className="mt-2 text-balance text-3xl font-bold tracking-tight text-slate-900">
                Pendidikan Kejuruan dengan Standar Disiplin Tinggi.
              </h2>
            </div>
            <div className="space-y-4 text-base leading-relaxed text-slate-600 lg:col-span-7">
              <p>
                SMK Prima Unggul adalah Sekolah Menengah Kejuruan yang berfokus pada penguasaan
                kompetensi praktis, etos kerja profesional, dan kesiapan menghadapi transformasi
                industri digital maupun korporasi modern.
              </p>
              <p>
                Melalui kolaborasi erat antara guru kejuruan, tenaga kependidikan, dan manajemen
                sekolah, setiap siswa dilatih tidak hanya menguasai keterampilan teknis di
                laboratorium, tetapi juga membiasakan kedisiplinan waktu melalui pencatatan
                kehadiran harian yang transparan dan akurat.
              </p>
              <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <BookOpen className="h-5 w-5 text-red-600" />
                  <h3 className="mt-3 text-sm font-semibold text-slate-900">
                    Kurikulum Praktik Industri
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Pembelajaran proyek nyata di bengkel jaringan, studio kreatif, dan lab bisnis.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-5">
                  <ShieldCheck className="h-5 w-5 text-red-600" />
                  <h3 className="mt-3 text-sm font-semibold text-slate-900">
                    Tata Kelola Data Terintegrasi
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Rekapitulasi kehadiran siswa dan staf tersimpan aman dan siap diaudit kapan saja.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Program Keahlian (3 Rumpun, 6 Kompetensi: TKJ, DKV, BC, AK, MPLB, BD) */}
      <section id="jurusan" className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-semibold text-red-600">3 Rumpun Bidang Keahlian</p>
              <h2 className="mt-2 text-balance text-3xl font-bold tracking-tight text-slate-900">
                Kompetensi Keahlian SMK Prima Unggul
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                Enam program keahlian terstruktur dalam tiga rumpun jurusan: Teknologi &amp; Media,
                Keuangan &amp; Akuntansi, serta Bisnis &amp; Manajemen Perkantoran.
              </p>
            </div>

            {/* Interactive Segmented Filter */}
            <div
              role="tablist"
              aria-label="Filter Rumpun Jurusan"
              className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1"
            >
              {CLUSTERS.map((cluster) => {
                const active = selectedCluster === cluster.value;
                return (
                  <button
                    key={cluster.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedCluster(cluster.value)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-red-600 text-white'
                        : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                    }`}
                  >
                    {cluster.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredMajors.map((major, idx) => (
              <article
                key={major.code}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-[#FAFAFA] p-6 transition-colors hover:border-red-300"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-red-600">
                      {String(idx + 1).padStart(2, '0')}. {major.code}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{major.cluster}</span>
                  </div>

                  <h3 className="mt-3 text-lg font-bold tracking-tight text-slate-900">
                    {major.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{major.description}</p>
                </div>

                <ul className="mt-5 space-y-2 border-t border-slate-200 pt-4">
                  {major.competencies.map((comp) => (
                    <li key={comp} className="flex items-start gap-2 text-xs text-slate-700">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                      <span>{comp}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Sistem Absensi Role Overview */}
      <section id="sistem" className="border-b border-slate-200 bg-[#FAFAFA]">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-red-600">Sistem Informasi Kehadiran</p>
            <h2 className="mt-2 text-balance text-3xl font-bold tracking-tight text-slate-900">
              Alur Kerja Terstruktur untuk Seluruh Civitas Sekolah
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Hak akses dan menu disesuaikan secara otomatis berdasarkan peran masing-masing
              pengguna di lingkungan SMK Prima Unggul.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <p className="font-mono text-xs font-semibold text-red-600">01. Administrator</p>
              <h3 className="mt-2 text-lg font-bold text-slate-900">Kendali Penuh &amp; Rekapitulasi</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Mengelola akun guru dan tenaga kependidikan yang tersinkronisasi ke autentikasi,
                mengelola data induk siswa, melakukan absensi karyawan mandiri, serta mengunduh
                rekap absensi siswa dan karyawan.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <p className="font-mono text-xs font-semibold text-red-600">02. Guru</p>
              <h3 className="mt-2 text-lg font-bold text-slate-900">Presensi Kelas &amp; Kehadiran</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Melakukan absen masuk dan pulang harian di menu Absensi Karyawan, mencatat kehadiran
                siswa per kelas di menu Absensi Siswa, serta meninjau laporan rekap absensi siswa.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <p className="font-mono text-xs font-semibold text-red-600">03. Tenaga Kependidikan</p>
              <h3 className="mt-2 text-lg font-bold text-slate-900">Presensi Karyawan Mandiri</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Akses ringkas ke Dashboard ringkasan pribadi dan menu Absensi Karyawan untuk
                mencatat jam masuk, jam pulang, atau keterangan izin/sakit secara mandiri setiap
                hari kerja.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50/60 p-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Siap mencatat kehadiran hari ini?
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Masuk ke portal menggunakan akun resmi SMK Prima Unggul Anda.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 whitespace-nowrap shrink-0"
            >
              <span>Masuk ke /login</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer id="kontak" className="bg-white">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center">
          <div>
            <p className="text-base font-bold text-slate-900">SMK Prima Unggul</p>
            <p className="mt-1 text-xs text-slate-500">
              Kompetensi Keahlian: TKJ · DKV · BC · AK · MPLB · BD
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600">
            <a href="#profil" className="hover:text-red-600">
              Profil Sekolah
            </a>
            <a href="#jurusan" className="hover:text-red-600">
              Program Keahlian
            </a>
            <Link to="/login" className="hover:text-red-600">
              Login Portal
            </Link>
            <span className="text-slate-400">
              &copy; {new Date().getFullYear()} SMK Prima Unggul
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
