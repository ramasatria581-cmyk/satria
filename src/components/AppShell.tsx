import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  UserCheck,
  GraduationCap,
  ClipboardList,
  Users,
  UserCog,
  ChevronDown,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../types';

interface NavSubItem {
  label: string;
  to: string;
}

interface NavItem {
  label: string;
  to?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavSubItem[];
}

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/app/absensi-karyawan')) return 'Absensi Karyawan';
  if (pathname.startsWith('/app/absensi-siswa')) return 'Absensi Siswa';
  if (pathname.startsWith('/app/rekap/karyawan')) return 'Rekap Absensi · Karyawan';
  if (pathname.startsWith('/app/rekap/siswa')) return 'Rekap Absensi · Siswa';
  if (pathname.startsWith('/app/data-siswa')) return 'Data Siswa';
  if (pathname.startsWith('/app/users')) return 'User Management';
  return 'Dashboard';
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [recapOpen, setRecapOpen] = useState(true);

  if (!user) return null;

  const navItems: NavItem[] = [
    { label: 'Dashboard', to: '/app/dashboard', icon: LayoutDashboard },
    { label: 'Absensi Karyawan', to: '/app/absensi-karyawan', icon: UserCheck },
  ];

  if (user.role === 'admin' || user.role === 'guru') {
    navItems.push({ label: 'Absensi Siswa', to: '/app/absensi-siswa', icon: GraduationCap });
    const recapChildren: NavSubItem[] = [];
    if (user.role === 'admin') {
      recapChildren.push({ label: 'Absensi Karyawan', to: '/app/rekap/karyawan' });
    }
    recapChildren.push({ label: 'Absensi Siswa', to: '/app/rekap/siswa' });

    navItems.push({
      label: 'Rekap Absensi',
      icon: ClipboardList,
      children: recapChildren,
    });
  }

  if (user.role === 'admin') {
    navItems.push({ label: 'Data Siswa', to: '/app/data-siswa', icon: Users });
    navItems.push({ label: 'User Management', to: '/app/users', icon: UserCog });
  }

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const pageTitle = getPageTitle(location.pathname);

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
        <Link to="/app/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-600 text-xs font-extrabold text-white">
            PU
          </div>
          <span className="truncate text-sm font-bold tracking-tight text-slate-900">
            SMK Prima Unggul
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Tutup menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav aria-label="Menu Utama" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          if (item.children && item.children.length > 0) {
            const isChildActive = item.children.some((c) => location.pathname.startsWith(c.to));
            return (
              <div key={item.label} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setRecapOpen(!recapOpen)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isChildActive
                      ? 'bg-red-50 text-red-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isChildActive ? 'text-red-600' : 'text-slate-500'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                      recapOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {recapOpen && (
                  <div className="ml-6 space-y-1 border-l border-slate-200 pl-3">
                    {item.children.map((sub) => (
                      <NavLink
                        key={sub.to}
                        to={sub.to}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          `block rounded-md px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                            isActive
                              ? 'bg-red-600 text-white font-semibold'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`
                        }
                      >
                        {sub.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to!}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-red-600 text-white font-semibold'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`}
                  />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Signed-in User Summary at Sidebar Bottom */}
      <div className="border-t border-slate-200 p-4">
        <p className="truncate text-sm font-semibold text-slate-900">{user.full_name}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {ROLE_LABELS[user.role]}
          {user.nip ? ` · ${user.nip}` : ''}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] text-slate-900">
      {/* Desktop Left Sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">{sidebarContent}</aside>

      {/* Mobile Drawer Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-64 max-w-[80vw] shrink-0">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar with Breadcrumb & Logout Button on Top Right */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
              aria-label="Buka menu navigasi"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-400">Portal</span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <h1 className="truncate font-semibold text-slate-900">{pageTitle}</h1>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden md:block text-right text-xs">
              <p className="font-semibold text-slate-800">{user.full_name}</p>
              <p className="text-slate-500">{ROLE_LABELS[user.role]}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-600 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
