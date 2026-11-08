-- =====================================================================
-- 0006 — PERBAIKAN HASIL AUDIT KODE
-- Jalankan SETELAH 0001–0005. Idempotent. Tidak menghapus data guru.
--
-- 1) portal_settings kehilangan PRIMARY KEY di 0003 (constraint pkey ikut di-drop).
--    Tabel tanpa PK berisiko baris ganda dan tidak bisa di-upsert dengan aman.
-- 2) claim_legacy_data() GAGAL bila guru penerima sudah punya baris portal_settings
--    (dibuat otomatis di 0003) → bentrok unique uq_portal_settings_teacher dan seluruh
--    klaim dibatalkan. Sekarang baris lama tanpa pemilik dilebur dengan aman.
-- 3) protect_profile_columns membaca 'request.jwt.claim.role' (format PostgREST lama).
--    Sekarang juga membaca 'request.jwt.claims' (format baru) agar service role
--    (Edge Function admin-teachers) tetap bisa mengubah role/active.
-- =====================================================================

-- 1) PK portal_settings
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.portal_settings'::regclass and contype = 'p') then
    -- pastikan tidak ada id kosong/ganda sebelum menambah PK
    update public.portal_settings set id = nextval('public.portal_settings_id_seq') where id is null;
    with d as (select ctid, row_number() over (partition by id order by updated_at) rn from public.portal_settings)
      update public.portal_settings p set id = nextval('public.portal_settings_id_seq') from d where p.ctid = d.ctid and d.rn > 1;
    alter table public.portal_settings add primary key (id);
  end if;
end $$;

-- 2) claim_legacy_data yang aman terhadap baris pengaturan
create or replace function public.claim_legacy_data(p_email text) returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid; n int := 0; c int; t text;
begin
  select id into v_id from public.profiles where lower(email) = lower(p_email) and role in ('teacher','admin');
  if v_id is null then raise exception 'Profil guru % tidak ditemukan / belum disetujui', p_email; end if;
  -- urutan penting: induk dulu (kelas, mapel) baru anak, agar trigger enforce_owner lolos
  foreach t in array array['classes','subjects','students','exams','exam_questions','grades','exam_responses','publication_settings'] loop
    execute format('update public.%I set teacher_id = $1 where teacher_id is null', t) using v_id;
    get diagnostics c = row_count; n := n + c;
  end loop;
  -- pengaturan portal lama (tanpa pemilik): salin pesan/akademik bila guru belum mengisinya, lalu hapus baris lama
  if exists (select 1 from public.portal_settings where teacher_id = v_id) then
    update public.portal_settings s set
      message = case when s.message = '' then coalesce(l.message, '') else s.message end,
      academic_year = coalesce(l.academic_year, s.academic_year),
      semester = coalesce(l.semester, s.semester),
      default_kktp = coalesce(l.default_kktp, s.default_kktp)
    from (select * from public.portal_settings where teacher_id is null limit 1) l
    where s.teacher_id = v_id;
    delete from public.portal_settings where teacher_id is null;
  else
    update public.portal_settings set teacher_id = v_id where teacher_id is null;
  end if;
  return 'OK: ' || n || ' baris data lama ditetapkan ke ' || p_email;
end $$;
revoke execute on function public.claim_legacy_data(text) from public, anon, authenticated;

-- 3) proteksi kolom profil: kenali service role di kedua format klaim JWT
create or replace function public.protect_profile_columns() returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  v_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    '');
  if auth.uid() is not null and v_role <> 'service_role' then
    new.role := old.role;
    new.active := old.active;
    new.email := old.email;
  end if;
  return new;
end $$;
