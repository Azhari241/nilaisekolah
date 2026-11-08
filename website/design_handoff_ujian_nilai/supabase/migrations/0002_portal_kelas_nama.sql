-- =====================================================================
-- UPGRADE untuk database yang sudah menjalankan versi lama 0001_init.sql
-- Portal Siswa: PILIH KELAS + KETIK NAMA (tanpa NISN / NIS / tanggal lahir).
-- Aman dijalankan berulang. Tidak menghapus data siswa / nilai.
-- =====================================================================

alter table public.portal_settings drop column if exists verification_mode;
alter table public.portal_settings drop column if exists require_class;
drop table if exists public.portal_attempts;

create or replace function public.norm_name(t text) returns text language sql immutable as $$
  select lower(regexp_replace(trim(coalesce(t,'')), '\s+', ' ', 'g'));
$$;
create index if not exists idx_students_class_normname on public.students(class_id, public.norm_name(full_name));

drop function if exists public.get_portal_status();
create or replace function public.get_portal_status() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'enabled', ps.enabled, 'message', ps.message, 'school_name', ps.school_name,
    'academic_year', ps.academic_year, 'semester', ps.semester,
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
  select count(*) into v_n from public.students s where s.class_id = p_class_id and s.status = 'aktif' and public.norm_name(s.full_name) = v_name;
  if v_n = 0 then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
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
