-- =====================================================================
-- 0004 — SAKELAR UTAMA PORTAL SISWA (perbaikan "portal masih terbuka")
-- Masalah: status portal publik = TERBUKA jika ada SATU guru mana pun yang membuka
-- portalnya. Admin/guru yang menutup portalnya sendiri tetap melihat portal terbuka
-- karena guru lain masih membuka. Perbaikan:
--   1) app_settings.portal_master — sakelar sekolah (hanya admin). Jika false, portal
--      ditutup untuk SEMUA siswa & semua guru.
--   2) get_portal_status mengembalikan 'master' & 'open_teachers' agar UI menampilkan
--      alasan status secara jujur.
-- Aman dijalankan ulang. Tidak menghapus data.
-- =====================================================================
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  portal_master boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict do nothing;
alter table public.app_settings enable row level security;
drop policy if exists app_settings_read on public.app_settings;
drop policy if exists app_settings_admin_update on public.app_settings;
create policy app_settings_read on public.app_settings for select to authenticated using (public.is_teacher());
create policy app_settings_admin_update on public.app_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.portal_open_teachers() returns setof uuid language sql stable security definer set search_path = public as $$
  select ps.teacher_id from public.portal_settings ps
  join public.profiles p on p.id = ps.teacher_id and p.active and p.role in ('teacher','admin')
  where ps.enabled and ps.teacher_id is not null
    and coalesce((select portal_master from public.app_settings where id = 1), true);
$$;
revoke execute on function public.portal_open_teachers() from public, anon, authenticated;

drop function if exists public.get_portal_status();
create or replace function public.get_portal_status() returns jsonb language sql stable security definer set search_path = public as $$
  with open_t as (select * from public.portal_open_teachers() as teacher_id)
  select jsonb_build_object(
    'enabled', exists (select 1 from open_t),
    'master', coalesce((select portal_master from public.app_settings where id = 1), true),
    'open_teachers', (select count(*) from open_t),
    'school_name', coalesce((select max(school_name) from public.portal_settings where teacher_id in (select teacher_id from open_t)), ''),
    'message', coalesce((select string_agg(distinct nullif(message,''), ' • ') from public.portal_settings where teacher_id in (select teacher_id from open_t)), ''),
    'academic_year', (select max(academic_year) from public.portal_settings where teacher_id in (select teacher_id from open_t)),
    'semester', (select max(semester) from public.portal_settings where teacher_id in (select teacher_id from open_t)),
    'classes', coalesce((select jsonb_agg(x.name order by x.name) from (
        select distinct c.name from public.classes c where c.teacher_id in (select teacher_id from open_t)) x), '[]'::jsonb));
$$;
grant execute on function public.get_portal_status() to anon, authenticated;

-- portal_lookup: tolak bila sakelar utama ditutup; hanya guru dari portal_open_teachers()
create or replace function public.portal_lookup(p_class_name text, p_name text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_name text := public.norm_name(p_name); v_cls text := public.norm_name(p_class_name); v_out jsonb;
begin
  if not exists (select 1 from public.portal_open_teachers()) then
    return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  if length(v_cls) = 0 or length(v_name) < 2 or length(v_name) > 120 then
    return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  with m as (
    select s.id, s.full_name, s.nis, s.student_code, s.teacher_id, c.name as class_name, p.full_name as teacher_name,
           count(*) over (partition by s.teacher_id) as dup
    from public.students s
    join public.classes c on c.id = s.class_id and c.teacher_id = s.teacher_id
    join public.profiles p on p.id = s.teacher_id
    where s.teacher_id in (select * from public.portal_open_teachers())
      and s.status = 'aktif' and public.norm_name(c.name) = v_cls and public.norm_name(s.full_name) = v_name)
  select jsonb_agg(jsonb_build_object(
      'full_name', m.full_name, 'class_name', m.class_name,
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
grant execute on function public.portal_lookup(text, text) to anon, authenticated;
