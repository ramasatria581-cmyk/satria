-- ============================================================================
-- SMK Prima Unggul - Supabase PostgreSQL Schema, RLS, Grants & Backfill
-- Jalankan seluruh script ini pada SQL Editor di proyek Supabase Anda.
-- Script ini idempotent (aman dijalankan berulang kali).
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. Tabel Profil Karyawan / User (tersinkronisasi dengan auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  nip text default '',
  role text not null check (role in ('admin', 'guru', 'tenaga_kependidikan')),
  department text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Trigger Otomatis: User pertama yang dibuat di Supabase Auth menjadi 'admin'
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_count integer;
  assigned_role text;
begin
  select count(*) into existing_count from public.profiles;

  if existing_count = 0 then
    assigned_role := 'admin';
  else
    assigned_role := coalesce(new.raw_user_meta_data->>'role', 'tenaga_kependidikan');
    if assigned_role not in ('admin', 'guru', 'tenaga_kependidikan') then
      assigned_role := 'tenaga_kependidikan';
    end if;
  end if;

  insert into public.profiles (id, email, full_name, nip, role, department)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(coalesce(new.email, 'user'), '@', 1)),
    coalesce(new.raw_user_meta_data->>'nip', ''),
    assigned_role,
    coalesce(new.raw_user_meta_data->>'department', '')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    nip = excluded.nip,
    role = excluded.role,
    department = excluded.department,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Tabel Data Siswa (NIS, Nama, Kelas, Kompetensi Keahlian)
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  nis text unique not null,
  name text not null,
  class_name text not null,
  major text not null check (major in ('TKJ', 'DKV', 'AK', 'BC', 'MPLB', 'BD')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Tabel Absensi Karyawan (Admin, Guru, Tenaga Kependidikan)
create table if not exists public.employee_attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  attendance_date date not null default current_date,
  check_in timestamptz,
  check_out timestamptz,
  status text not null check (status in ('Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa')),
  notes text default '',
  created_at timestamptz not null default now(),
  unique(user_id, attendance_date)
);

-- 5. Tabel Absensi Siswa
create table if not exists public.student_attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  attendance_date date not null default current_date,
  status text not null check (status in ('Hadir', 'Sakit', 'Izin', 'Alpa')),
  notes text default '',
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(student_id, attendance_date)
);

-- 6. Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.employee_attendance enable row level security;
alter table public.student_attendance enable row level security;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() limit 1;
$$;

-- Profiles policies
drop policy if exists "Users can view own profile or admin views all" on public.profiles;
create policy "Users can view own profile or admin views all"
  on public.profiles for select
  using (auth.uid() = id or public.current_user_role() = 'admin');

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Only admin can manage profiles directly" on public.profiles;
create policy "Only admin can manage profiles directly"
  on public.profiles for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Students policies
drop policy if exists "Admin and guru can read students" on public.students;
create policy "Admin and guru can read students"
  on public.students for select
  using (public.current_user_role() in ('admin', 'guru'));

drop policy if exists "Only admin can modify students" on public.students;
create policy "Only admin can modify students"
  on public.students for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Employee attendance policies
drop policy if exists "Employees view own attendance or admin views all" on public.employee_attendance;
create policy "Employees view own attendance or admin views all"
  on public.employee_attendance for select
  using (auth.uid() = user_id or public.current_user_role() = 'admin');

drop policy if exists "Employees insert own attendance" on public.employee_attendance;
create policy "Employees insert own attendance"
  on public.employee_attendance for insert
  with check (auth.uid() = user_id);

drop policy if exists "Employees update own attendance" on public.employee_attendance;
create policy "Employees update own attendance"
  on public.employee_attendance for update
  using (auth.uid() = user_id or public.current_user_role() = 'admin');

-- Student attendance policies
drop policy if exists "Admin and guru manage student attendance" on public.student_attendance;
create policy "Admin and guru manage student attendance"
  on public.student_attendance for all
  using (public.current_user_role() in ('admin', 'guru'))
  with check (public.current_user_role() in ('admin', 'guru'));

-- 7. Explicit Schema, Table & Function Grants for Supabase roles
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all privileges on all tables in schema public to postgres, service_role;
grant all privileges on all sequences in schema public to postgres, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.current_user_role() to anon, authenticated, service_role;

-- 8. Sinkronkan akun auth.users yang sudah dibuat sebelumnya ke public.profiles
-- User paling awal otomatis menjadi 'admin'.
insert into public.profiles (id, email, full_name, nip, role, department)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), split_part(coalesce(u.email, 'user'), '@', 1)),
  coalesce(u.raw_user_meta_data->>'nip', ''),
  case
    when row_number() over (order by u.created_at asc) = 1
      and not exists (select 1 from public.profiles where role = 'admin')
    then 'admin'
    when (u.raw_user_meta_data->>'role') in ('admin', 'guru', 'tenaga_kependidikan')
    then u.raw_user_meta_data->>'role'
    else 'tenaga_kependidikan'
  end,
  coalesce(u.raw_user_meta_data->>'department', '')
from auth.users u
where u.email is not null
on conflict (id) do nothing;
