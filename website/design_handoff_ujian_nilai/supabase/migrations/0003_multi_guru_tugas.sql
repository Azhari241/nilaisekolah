-- =====================================================================
-- 0003 — PEMISAHAN DATA ANTAR GURU + MANAJEMEN TUGAS + NILAI MANUAL
-- Jalankan SETELAH 0001_init.sql dan 0002_portal_kelas_nama.sql.
-- Aman dijalankan ulang (idempotent). TIDAK menghapus data.
--
-- LANGKAH WAJIB SETELAH MENJALANKAN FILE INI (sekali saja):
--   Data lama (sebelum migrasi) belum punya pemilik. Tetapkan pemiliknya:
--     select public.claim_legacy_data('email.guru.pemilik@sekolah.sch.id');
--   Sampai langkah ini dilakukan, data lama TIDAK terlihat oleh siapa pun
--   (aman secara default), tetapi juga tidak hilang.
-- =====================================================================

-- ---------- 1. PROFIL: status aktif + tanda tangan ----------
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists sign_enabled boolean not null default false;
alter table public.profiles add column if not exists sign_title text not null default 'Guru Mata Pelajaran';
alter table public.profiles add column if not exists sign_place text not null default '';
alter table public.profiles add column if not exists sign_nip text not null default '';

-- Guru aktif yang disetujui (role teacher/admin dan active)
create or replace function public.is_teacher() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher','admin') and active);
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active);
$$;
grant execute on function public.is_admin() to authenticated;

-- Guru tidak bisa mengubah role/active/email dirinya sendiri (hanya service role / admin via Edge Function)
create or replace function public.protect_profile_columns() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    new.role := old.role;
    new.active := old.active;
    new.email := old.email;
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_protect on public.profiles;
create trigger trg_profiles_protect before update on public.profiles for each row execute function public.protect_profile_columns();

-- Akun baru TIDAK otomatis jadi guru/admin (tetap 'pending')
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id, email, role) values (new.id, new.email, 'pending') on conflict do nothing; return new; end $$;

-- ---------- 2. KOLOM PEMILIK (teacher_id) di semua tabel data ----------
do $$ declare t text; begin
  foreach t in array array['classes','subjects','students','exams','exam_questions','grades','exam_responses','publication_settings'] loop
    execute format('alter table public.%I add column if not exists teacher_id uuid references public.profiles(id) on delete restrict', t);
    execute format('alter table public.%I alter column teacher_id set default auth.uid()', t);
    execute format('create index if not exists idx_%s_teacher on public.%I(teacher_id)', t, t);
  end loop;
end $$;

-- backfill otomatis yang aman: ujian yang punya created_by
update public.exams set teacher_id = created_by where teacher_id is null and created_by is not null;
-- turunan dari ujian
update public.exam_questions q set teacher_id = e.teacher_id from public.exams e where q.exam_id = e.id and q.teacher_id is null and e.teacher_id is not null;
update public.grades g set teacher_id = e.teacher_id from public.exams e where g.exam_id = e.id and g.teacher_id is null and e.teacher_id is not null;
update public.exam_responses r set teacher_id = e.teacher_id from public.exams e where r.exam_id = e.id and r.teacher_id is null and e.teacher_id is not null;
update public.publication_settings p set teacher_id = e.teacher_id from public.exams e where p.exam_id = e.id and p.teacher_id is null and e.teacher_id is not null;

-- Dipanggil administrator SEKALI untuk menetapkan pemilik data lama yang belum punya pemilik
create or replace function public.claim_legacy_data(p_email text) returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; n int := 0; c int; t text;
begin
  select id into v_id from public.profiles where lower(email) = lower(p_email) and role in ('teacher','admin');
  if v_id is null then raise exception 'Profil guru % tidak ditemukan / belum disetujui', p_email; end if;
  foreach t in array array['classes','subjects','students','exams','exam_questions','grades','exam_responses','publication_settings'] loop
    execute format('update public.%I set teacher_id = $1 where teacher_id is null', t) using v_id;
    get diagnostics c = row_count; n := n + c;
  end loop;
  update public.portal_settings set teacher_id = v_id where teacher_id is null;
  return 'OK: ' || n || ' baris data lama ditetapkan ke ' || p_email;
end $$;
revoke execute on function public.claim_legacy_data(text) from public, anon, authenticated;

-- ---------- 3. UNIQUE per guru (bukan global) ----------
alter table public.students drop constraint if exists students_nisn_key;
alter table public.students drop constraint if exists students_nis_key;
alter table public.students drop constraint if exists students_student_code_key;
alter table public.classes  drop constraint if exists classes_name_academic_year_key;
alter table public.subjects drop constraint if exists subjects_name_key;
create unique index if not exists uq_students_teacher_nisn on public.students(teacher_id, nisn) where nisn is not null;
create unique index if not exists uq_students_teacher_nis  on public.students(teacher_id, nis) where nis is not null;
create unique index if not exists uq_students_teacher_code on public.students(teacher_id, student_code);
create unique index if not exists uq_classes_teacher_name  on public.classes(teacher_id, name, academic_year);
create unique index if not exists uq_subjects_teacher_name on public.subjects(teacher_id, lower(name));

-- ---------- 4. Pemilik dipaksa = auth.uid() & relasi harus milik guru yang sama ----------
create or replace function public.enforce_owner() returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then new.teacher_id := auth.uid();
    elsif new.teacher_id is distinct from old.teacher_id then raise exception 'Pemilik data tidak boleh diubah' using errcode = '42501';
    end if;
  end if;
  -- cek relasi lintas tabel
  if tg_table_name = 'students' then
    select teacher_id into v_owner from public.classes where id = new.class_id;
    if v_owner is distinct from new.teacher_id then raise exception 'Kelas bukan milik Anda' using errcode = '42501'; end if;
  elsif tg_table_name = 'exams' then
    select teacher_id into v_owner from public.classes where id = new.class_id;
    if v_owner is distinct from new.teacher_id then raise exception 'Kelas bukan milik Anda' using errcode = '42501'; end if;
    select teacher_id into v_owner from public.subjects where id = new.subject_id;
    if v_owner is distinct from new.teacher_id then raise exception 'Mata pelajaran bukan milik Anda' using errcode = '42501'; end if;
  elsif tg_table_name in ('exam_questions','exam_responses','publication_settings','grades') then
    select teacher_id into v_owner from public.exams where id = new.exam_id;
    if v_owner is distinct from new.teacher_id then raise exception 'Ujian/tugas bukan milik Anda' using errcode = '42501'; end if;
    if tg_table_name in ('grades','exam_responses') and new.student_id is not null then
      select teacher_id into v_owner from public.students where id = new.student_id;
      if v_owner is distinct from new.teacher_id then raise exception 'Siswa bukan milik Anda' using errcode = '42501'; end if;
    end if;
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['classes','subjects','students','exams','exam_questions','grades','exam_responses','publication_settings'] loop
    execute format('drop trigger if exists trg_%s_owner on public.%I', t, t);
    execute format('create trigger trg_%s_owner before insert or update on public.%I for each row execute function public.enforce_owner()', t, t);
  end loop;
end $$;

-- ---------- 5. RLS: hanya data milik sendiri (ganti policy lama yang terlalu luas) ----------
do $$ declare t text; begin
  foreach t in array array['classes','subjects','students','exams','exam_questions','grades','exam_responses','publication_settings'] loop
    execute format('drop policy if exists %1$s_teacher_all on public.%1$s', t);
    execute format('drop policy if exists %1$s_owner_select on public.%1$s', t);
    execute format('drop policy if exists %1$s_owner_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_owner_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_owner_delete on public.%1$s', t);
    execute format('create policy %1$s_owner_select on public.%1$s for select to authenticated using (teacher_id = auth.uid() and public.is_teacher())', t);
    execute format('create policy %1$s_owner_insert on public.%1$s for insert to authenticated with check (teacher_id = auth.uid() and public.is_teacher())', t);
    execute format('create policy %1$s_owner_update on public.%1$s for update to authenticated using (teacher_id = auth.uid() and public.is_teacher()) with check (teacher_id = auth.uid())', t);
    execute format('create policy %1$s_owner_delete on public.%1$s for delete to authenticated using (teacher_id = auth.uid() and public.is_teacher())', t);
  end loop;
end $$;

drop policy if exists audit_teacher_select on public.audit_logs;
create policy audit_teacher_select on public.audit_logs for select to authenticated using (actor = auth.uid() and public.is_teacher());

-- profil: hanya diri sendiri (tanpa policy admin → token Google guru lain tidak pernah terbaca)
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- 6. PENGATURAN PER GURU (portal_settings: satu baris per guru) ----------
alter table public.portal_settings add column if not exists teacher_id uuid references public.profiles(id) on delete cascade;
alter table public.portal_settings drop constraint if exists portal_settings_id_check;
alter table public.portal_settings drop constraint if exists portal_settings_pkey;
create sequence if not exists public.portal_settings_id_seq;
alter table public.portal_settings alter column id set default nextval('public.portal_settings_id_seq');
select setval('public.portal_settings_id_seq', greatest((select coalesce(max(id),1) from public.portal_settings), 1));
create unique index if not exists uq_portal_settings_teacher on public.portal_settings(teacher_id);
-- Catatan: URL Apps Script & token Google tetap di profiles (RLS: hanya pemilik) → tidak terbaca guru lain.

-- baris pengaturan untuk setiap guru yang belum punya (salin nilai akademik dari baris lama)
insert into public.portal_settings (teacher_id, enabled, message, school_name, academic_year, semester, default_kktp)
select p.id, false, '', p.school_name,
  coalesce((select academic_year from public.portal_settings where teacher_id is null limit 1), '2026/2027'),
  coalesce((select semester from public.portal_settings where teacher_id is null limit 1), 'Ganjil'),
  coalesce((select default_kktp from public.portal_settings where teacher_id is null limit 1), 75)
from public.profiles p
where p.role in ('teacher','admin') and not exists (select 1 from public.portal_settings s where s.teacher_id = p.id);

-- otomatis buat baris pengaturan saat guru disetujui
create or replace function public.ensure_teacher_settings() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role in ('teacher','admin') then
    insert into public.portal_settings (teacher_id, school_name) values (new.id, new.school_name) on conflict (teacher_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_settings on public.profiles;
create trigger trg_profiles_settings after insert or update of role on public.profiles for each row execute function public.ensure_teacher_settings();

drop policy if exists portal_settings_teacher_select on public.portal_settings;
drop policy if exists portal_settings_teacher_update on public.portal_settings;
create policy portal_settings_owner_select on public.portal_settings for select to authenticated using (teacher_id = auth.uid() and public.is_teacher());
create policy portal_settings_owner_update on public.portal_settings for update to authenticated using (teacher_id = auth.uid() and public.is_teacher()) with check (teacher_id = auth.uid());

-- ---------- 7. UJIAN & TUGAS & NILAI MANUAL (memakai tabel exams yang sudah ada) ----------
alter table public.exams add column if not exists kind text not null default 'ujian';
alter table public.exams drop constraint if exists exams_kind_check;
alter table public.exams add constraint exams_kind_check check (kind in ('ujian','tugas','manual'));
alter table public.exams add column if not exists delivery text not null default 'google_form';  -- 'google_form' | 'manual'
alter table public.exams drop constraint if exists exams_delivery_check;
alter table public.exams add constraint exams_delivery_check check (delivery in ('google_form','manual'));
alter table public.exams add column if not exists task_type text;           -- Tugas menulis, menghafal, praktik, ...
alter table public.exams add column if not exists category text;            -- kategori nilai manual: Hafalan, Praktik, ...
alter table public.exams add column if not exists description text;
alter table public.exams add column if not exists instructions text;
alter table public.exams add column if not exists start_date date;
alter table public.exams add column if not exists due_date date;
alter table public.exams add column if not exists max_score numeric(6,2) not null default 100;
alter table public.exams drop constraint if exists exams_max_score_check;
alter table public.exams add constraint exams_max_score_check check (max_score > 0 and max_score <= 1000);
alter table public.exams drop constraint if exists exams_status_check;
alter table public.exams add constraint exams_status_check check (status in ('draft','aktif','ditutup','selesai','arsip'));
create index if not exists idx_exams_kind on public.exams(teacher_id, kind);

-- soal: pilihan ganda + essay
alter table public.exam_questions add column if not exists qtype text not null default 'mc';
alter table public.exam_questions drop constraint if exists exam_questions_qtype_check;
alter table public.exam_questions add constraint exam_questions_qtype_check check (qtype in ('mc','essay'));
alter table public.exam_questions add column if not exists required boolean not null default true;
do $$ declare r record; begin
  for r in select conname from pg_constraint where conrelid = 'public.exam_questions'::regclass and contype = 'c'
    and (pg_get_constraintdef(oid) ilike '%answer_key%' or pg_get_constraintdef(oid) ilike '%options%') loop
    execute format('alter table public.exam_questions drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.exam_questions alter column answer_key drop not null;
alter table public.exam_questions alter column options drop not null;
alter table public.exam_questions add constraint exam_questions_type_valid check (
  (qtype = 'mc' and jsonb_typeof(options) = 'object' and options ? 'A' and options ? 'B'
     and answer_key in ('A','B','C','D','E') and options ? answer_key)
  or (qtype = 'essay' and answer_key is null));

-- nilai: skor mentah, keterangan, komponen PG/essay
alter table public.grades add column if not exists raw_score numeric(7,2);
alter table public.grades add column if not exists note text check (note is null or length(note) <= 500);
alter table public.grades add column if not exists mc_score numeric(7,2);
alter table public.grades add column if not exists essay_score numeric(7,2);
alter table public.grades drop constraint if exists grades_source_check;
alter table public.grades add constraint grades_source_check check (source in ('manual','google_forms'));

-- respons: jawaban essay + skor PG otomatis
alter table public.exam_responses add column if not exists answers jsonb;
alter table public.exam_responses add column if not exists mc_score numeric;
alter table public.exam_responses add column if not exists mc_max numeric;
alter table public.exam_responses add column if not exists essay_max numeric;

-- ganti soal (sekarang mendukung essay); hanya untuk ujian milik sendiri
create or replace function public.replace_exam_questions(p_exam_id uuid, p_questions jsonb) returns void language plpgsql security invoker set search_path = public as $$
begin
  if not exists (select 1 from public.exams where id = p_exam_id and teacher_id = auth.uid()) then
    raise exception 'Ujian/tugas bukan milik Anda' using errcode = '42501';
  end if;
  delete from public.exam_questions where exam_id = p_exam_id;
  insert into public.exam_questions (exam_id, number, question, qtype, options, answer_key, points, required)
  select p_exam_id, (q->>'number')::int, q->>'question', coalesce(q->>'qtype','mc'),
         case when coalesce(q->>'qtype','mc') = 'mc' then q->'options' else null end,
         case when coalesce(q->>'qtype','mc') = 'mc' then q->>'answer_key' else null end,
         (q->>'points')::int, coalesce((q->>'required')::boolean, true)
  from jsonb_array_elements(p_questions) q;
  update public.exams set question_count = jsonb_array_length(p_questions) where id = p_exam_id;
end $$;

-- ---------- 8. PORTAL SISWA (multi guru) ----------
-- Siswa memilih NAMA KELAS (gabungan dari guru yang membuka portal) + mengetik nama.
-- Hanya nilai yang dipublikasikan oleh guru pemiliknya, dari guru yang portalnya aktif.
drop function if exists public.get_portal_status();
create or replace function public.get_portal_status() returns jsonb language sql stable security definer set search_path = public as $$
  with open_t as (
    select ps.teacher_id from public.portal_settings ps
    join public.profiles p on p.id = ps.teacher_id and p.active and p.role in ('teacher','admin')
    where ps.enabled and ps.teacher_id is not null)
  select jsonb_build_object(
    'enabled', exists (select 1 from open_t),
    'school_name', coalesce((select max(school_name) from public.portal_settings where teacher_id in (select teacher_id from open_t)), ''),
    'message', coalesce((select string_agg(distinct nullif(message,''), ' • ') from public.portal_settings where teacher_id in (select teacher_id from open_t)), ''),
    'classes', coalesce((select jsonb_agg(x.name order by x.name) from (
        select distinct c.name from public.classes c where c.teacher_id in (select teacher_id from open_t)) x), '[]'::jsonb));
$$;

drop function if exists public.portal_lookup(uuid, text);
create or replace function public.portal_lookup(p_class_name text, p_name text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_name text := public.norm_name(p_name); v_cls text := public.norm_name(p_class_name); v_out jsonb;
begin
  if not exists (select 1 from public.portal_settings where enabled and teacher_id is not null) then
    return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  if length(v_cls) = 0 or length(v_name) < 2 or length(v_name) > 120 then
    return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  with m as (
    select s.id, s.full_name, s.nis, s.student_code, s.teacher_id, c.name as class_name, p.full_name as teacher_name,
           count(*) over (partition by s.teacher_id) as dup
    from public.students s
    join public.classes c on c.id = s.class_id and c.teacher_id = s.teacher_id
    join public.portal_settings ps on ps.teacher_id = s.teacher_id and ps.enabled
    join public.profiles p on p.id = s.teacher_id and p.active and p.role in ('teacher','admin')
    where s.status = 'aktif' and public.norm_name(c.name) = v_cls and public.norm_name(s.full_name) = v_name)
  select jsonb_agg(jsonb_build_object(
      'full_name', m.full_name, 'class_name', m.class_name,
      -- 'hint' hanya diisi bila ada nama kembar di kelas guru yang sama (klien menggabungkan entri tanpa hint)
      'hint', case when m.dup > 1 then coalesce('NIS •••' || right(m.nis, 2), 'Kode •••' || right(m.student_code, 2)) else '' end,
      'results', coalesce((select jsonb_agg(jsonb_build_object(
            'exam_name', e.name, 'kind', e.kind, 'exam_type', coalesce(e.category, e.task_type, e.exam_type),
            'subject', sub.name, 'teacher', m.teacher_name, 'score', g.score, 'kktp', e.kktp, 'passed', g.score >= e.kktp,
            'academic_year', e.academic_year, 'semester', e.semester, 'date', e.date)
          order by e.academic_year desc, case e.semester when 'Ganjil' then 1 else 2 end, sub.name, e.date)
        from public.grades g
        join public.exams e on e.id = g.exam_id and e.teacher_id = m.teacher_id
        join public.subjects sub on sub.id = e.subject_id
        join public.publication_settings pb on pb.exam_id = e.id and pb.is_published and pb.teacher_id = m.teacher_id
        where g.student_id = m.id and g.teacher_id = m.teacher_id), '[]'::jsonb)))
    into v_out from m;

  if v_out is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'students', v_out);
end $$;

grant execute on function public.get_portal_status() to anon, authenticated;
grant execute on function public.portal_lookup(text, text) to anon, authenticated;
grant execute on function public.replace_exam_questions(uuid, jsonb) to authenticated;

-- ---------- 9. PEMERIKSAAN (jalankan manual untuk audit) ----------
-- Semua policy pada tabel data harus berbentuk teacher_id = auth.uid():
--   select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname='public' order by 1,2;
-- Data tanpa pemilik (harus 0 setelah claim_legacy_data):
--   select 'students', count(*) from students where teacher_id is null union all
--   select 'exams', count(*) from exams where teacher_id is null union all
--   select 'grades', count(*) from grades where teacher_id is null;
