-- =====================================================================
-- SISTEM MANAJEMEN UJIAN & NILAI — Migration awal
-- Jalankan di Supabase → SQL Editor (sekali).
-- Membuat: tabel, PK/FK, unique, index, check, trigger updated_at,
--          RLS, fungsi portal (SECURITY DEFINER) dengan rate limit.
-- =====================================================================

create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- profiles (guru) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  school_name text not null default '',
  subject text not null default '',
  role text not null default 'pending' check (role in ('pending','teacher','admin')),
  google_script_url text check (google_script_url is null or google_script_url ~ '^https://script\.google\.com/macros/s/.+/exec$'),
  google_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id, email) values (new.id, new.email) on conflict do nothing; return new; end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_teacher() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher','admin'));
$$;

-- Dipanggil administrator di SQL Editor untuk menyetujui akun guru
create or replace function public.approve_teacher(p_email text, p_name text default '') returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(p_email);
  if v_id is null then raise exception 'User % tidak ditemukan. Buat dulu di Authentication → Users.', p_email; end if;
  insert into public.profiles (id, email, full_name, role) values (v_id, p_email, p_name, 'teacher')
  on conflict (id) do update set role = 'teacher', full_name = coalesce(nullif(p_name,''), public.profiles.full_name);
  return 'OK: ' || p_email || ' disetujui sebagai guru';
end $$;
revoke execute on function public.approve_teacher(text,text) from public, anon, authenticated;

-- ---------- classes ----------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 40),
  grade text not null check (grade ~ '^(1[0-2]|[1-9])$'),
  academic_year text not null check (academic_year ~ '^\d{4}/\d{4}$'),
  homeroom text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, academic_year)
);
create trigger trg_classes_updated before update on public.classes for each row execute function public.set_updated_at();

-- ---------- subjects ----------
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 80),
  code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_subjects_updated before update on public.subjects for each row execute function public.set_updated_at();

-- ---------- students ----------
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  nisn text unique check (nisn is null or nisn ~ '^\d{10}$'),
  nis text unique check (nis is null or length(nis) <= 20),
  full_name text not null check (length(trim(full_name)) >= 2),
  class_id uuid not null references public.classes(id) on delete restrict,
  student_code text not null unique check (student_code ~ '^[A-Z0-9_-]{3,20}$'),
  birth_date date,
  status text not null default 'aktif' check (status in ('aktif','nonaktif','lulus','pindah')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_students_class on public.students(class_id);
create index if not exists idx_students_name on public.students(lower(full_name));
create trigger trg_students_updated before update on public.students for each row execute function public.set_updated_at();

-- ---------- exams ----------
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) >= 2),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  semester text not null check (semester in ('Ganjil','Genap')),
  academic_year text not null check (academic_year ~ '^\d{4}/\d{4}$'),
  exam_type text not null,
  date date not null,
  kktp numeric(5,2) not null default 75 check (kktp between 0 and 100),
  status text not null default 'draft' check (status in ('draft','aktif','selesai','arsip')),
  question_count int not null default 0,
  google_form_id text,
  google_form_url text check (google_form_url is null or google_form_url ~ '^https://docs\.google\.com/forms/'),
  google_form_edit_url text,
  google_form_created_at timestamptz,
  last_synced_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_exams_filter on public.exams(academic_year, semester, class_id, subject_id);
create trigger trg_exams_updated before update on public.exams for each row execute function public.set_updated_at();

-- ---------- exam_questions (berisi KUNCI JAWABAN — hanya guru) ----------
create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  number int not null check (number > 0),
  question text not null,
  options jsonb not null check (jsonb_typeof(options) = 'object' and options ? 'A' and options ? 'B'),
  answer_key char(1) not null check (answer_key in ('A','B','C','D','E')),
  points int not null check (points between 1 and 100),
  created_at timestamptz not null default now(),
  unique (exam_id, number),
  check (options ? answer_key)
);
create index if not exists idx_questions_exam on public.exam_questions(exam_id);

create or replace function public.replace_exam_questions(p_exam_id uuid, p_questions jsonb) returns void language plpgsql security invoker set search_path = public as $$
begin
  if not public.is_teacher() then raise exception 'Akses ditolak' using errcode = '42501'; end if;
  delete from public.exam_questions where exam_id = p_exam_id;
  insert into public.exam_questions (exam_id, number, question, options, answer_key, points)
  select p_exam_id, (q->>'number')::int, q->>'question', q->'options', q->>'answer_key', (q->>'points')::int
  from jsonb_array_elements(p_questions) q;
  update public.exams set question_count = jsonb_array_length(p_questions) where id = p_exam_id;
end $$;

-- ---------- grades ----------
create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  score numeric(5,2) not null check (score between 0 and 100),
  source text not null default 'manual' check (source in ('manual','google_forms')),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, student_id)
);
create index if not exists idx_grades_student on public.grades(student_id);
create trigger trg_grades_updated before update on public.grades for each row execute function public.set_updated_at();

-- ---------- exam_responses (respons mentah Google Forms — hanya guru) ----------
create table if not exists public.exam_responses (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  response_id text not null,
  student_id uuid references public.students(id) on delete set null,
  identifier text,
  respondent_name text,
  raw_score numeric,
  max_score numeric,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (exam_id, response_id)
);
create index if not exists idx_responses_exam on public.exam_responses(exam_id);

-- ---------- publication_settings ----------
create table if not exists public.publication_settings (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null unique references public.exams(id) on delete cascade,
  is_published boolean not null default false,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger trg_pub_updated before update on public.publication_settings for each row execute function public.set_updated_at();

-- ---------- portal_settings (satu baris) ----------
create table if not exists public.portal_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  message text not null default '' check (length(message) <= 300),
  school_name text not null default '',
  academic_year text not null default '2026/2027' check (academic_year ~ '^\d{4}/\d{4}$'),
  semester text not null default 'Ganjil' check (semester in ('Ganjil','Genap')),
  default_kktp numeric(5,2) not null default 75 check (default_kktp between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into public.portal_settings (id) values (1) on conflict do nothing;
create trigger trg_portal_updated before update on public.portal_settings for each row execute function public.set_updated_at();

-- ---------- audit_logs ----------
create table if not exists public.audit_logs (
  id bigserial primary key,
  actor uuid default auth.uid() references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_created on public.audit_logs(created_at desc);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles             enable row level security;
alter table public.classes              enable row level security;
alter table public.subjects             enable row level security;
alter table public.students             enable row level security;
alter table public.exams                enable row level security;
alter table public.exam_questions       enable row level security;
alter table public.grades               enable row level security;
alter table public.exam_responses       enable row level security;
alter table public.publication_settings enable row level security;
alter table public.portal_settings      enable row level security;
alter table public.audit_logs           enable row level security;

create policy profiles_select_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

do $$ declare t text; begin
  foreach t in array array['classes','subjects','students','exams','exam_questions','grades','exam_responses','publication_settings'] loop
    execute format('create policy %1$s_teacher_all on public.%1$s for all to authenticated using (public.is_teacher()) with check (public.is_teacher());', t);
  end loop;
end $$;

create policy portal_settings_teacher_select on public.portal_settings for select to authenticated using (public.is_teacher());
create policy portal_settings_teacher_update on public.portal_settings for update to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy audit_teacher_select on public.audit_logs for select to authenticated using (public.is_teacher());
create policy audit_teacher_insert on public.audit_logs for insert to authenticated with check (public.is_teacher() and actor = auth.uid());

-- =====================================================================
-- FUNGSI PUBLIK (Portal Siswa) — SECURITY DEFINER, data minimum
-- Konsep: siswa memilih KELAS + mengetik NAMA. Tanpa akun / password / NISN / OTP.
-- Browser tidak pernah menerima daftar siswa atau seluruh nilai.
-- =====================================================================

-- normalisasi nama HANYA untuk pencarian (data asli tidak diubah)
create or replace function public.norm_name(t text) returns text language sql immutable as $$
  select lower(regexp_replace(trim(coalesce(t,'')), '\s+', ' ', 'g'));
$$;
create index if not exists idx_students_class_normname on public.students(class_id, public.norm_name(full_name));

create or replace function public.get_portal_status() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'enabled', ps.enabled, 'message', ps.message, 'school_name', ps.school_name,
    'academic_year', ps.academic_year, 'semester', ps.semester,
    -- hanya id + nama kelas untuk dropdown (bukan data siswa)
    'classes', case when ps.enabled then coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'academic_year', c.academic_year) order by c.grade::int, c.name)
        from public.classes c), '[]'::jsonb) else '[]'::jsonb end)
  from public.portal_settings ps where ps.id = 1;
$$;

drop function if exists public.portal_lookup(text, text);
drop function if exists public.portal_lookup(text, text, text);
create or replace function public.portal_lookup(p_class_id uuid, p_name text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_enabled boolean; v_name text; v_class public.classes; v_students jsonb; v_n int;
begin
  select enabled into v_enabled from public.portal_settings where id = 1;
  if not coalesce(v_enabled,false) then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;

  v_name := public.norm_name(p_name);
  if p_class_id is null or length(v_name) < 2 or length(v_name) > 120 then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  select * into v_class from public.classes where id = p_class_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  select count(*) into v_n from public.students s
   where s.class_id = p_class_id and s.status = 'aktif' and public.norm_name(s.full_name) = v_name;
  if v_n = 0 then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  -- Satu entri per siswa yang cocok (nama kembar ditampilkan terpisah, tidak digabung)
  select jsonb_agg(jsonb_build_object(
      'full_name', s.full_name, 'class_name', v_class.name, 'academic_year', v_class.academic_year,
      'hint', case when v_n > 1 then coalesce('NIS •••' || right(s.nis, 2), 'Kode •••' || right(s.student_code, 2)) else '' end,
      'results', coalesce((
        select jsonb_agg(jsonb_build_object(
            'exam_name', e.name, 'exam_type', e.exam_type, 'subject', sub.name, 'score', g.score, 'kktp', e.kktp,
            'passed', g.score >= e.kktp, 'academic_year', e.academic_year, 'semester', e.semester, 'date', e.date)
          order by e.academic_year desc, case e.semester when 'Ganjil' then 1 else 2 end, sub.name, e.date)
        from public.grades g
        join public.exams e on e.id = g.exam_id
        join public.subjects sub on sub.id = e.subject_id
        join public.publication_settings p on p.exam_id = e.id and p.is_published
        where g.student_id = s.id), '[]'::jsonb))
    order by s.created_at)
    into v_students
    from public.students s
   where s.class_id = p_class_id and s.status = 'aktif' and public.norm_name(s.full_name) = v_name;

  return jsonb_build_object('ok', true, 'students', v_students);
end $$;

grant execute on function public.get_portal_status() to anon, authenticated;
grant execute on function public.portal_lookup(uuid, text) to anon, authenticated;
grant execute on function public.replace_exam_questions(uuid, jsonb) to authenticated;
grant execute on function public.is_teacher() to authenticated;
