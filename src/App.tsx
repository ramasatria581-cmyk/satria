import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import type { UserRole } from './types';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import AppShell from './components/AppShell';
import DashboardPage from './pages/app/DashboardPage';
import EmployeeAttendancePage from './pages/app/EmployeeAttendancePage';
import StudentAttendancePage from './pages/app/StudentAttendancePage';
import RecapEmployeePage from './pages/app/RecapEmployeePage';
import RecapStudentPage from './pages/app/RecapStudentPage';
import StudentsPage from './pages/app/StudentsPage';
import UsersPage from './pages/app/UsersPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] text-sm text-slate-600">
        Memuat sesi pengguna...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RoleGuard({
  allowed,
  children,
}: {
  allowed: UserRole[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!user || !allowed.includes(user.role)) {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="absensi-karyawan" element={<EmployeeAttendancePage />} />
            <Route
              path="absensi-siswa"
              element={
                <RoleGuard allowed={['admin', 'guru']}>
                  <StudentAttendancePage />
                </RoleGuard>
              }
            />
            <Route
              path="rekap/karyawan"
              element={
                <RoleGuard allowed={['admin']}>
                  <RecapEmployeePage />
                </RoleGuard>
              }
            />
            <Route
              path="rekap/siswa"
              element={
                <RoleGuard allowed={['admin', 'guru']}>
                  <RecapStudentPage />
                </RoleGuard>
              }
            />
            <Route
              path="data-siswa"
              element={
                <RoleGuard allowed={['admin']}>
                  <StudentsPage />
                </RoleGuard>
              }
            />
            <Route
              path="users"
              element={
                <RoleGuard allowed={['admin']}>
                  <UsersPage />
                </RoleGuard>
              }
            />
            <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
