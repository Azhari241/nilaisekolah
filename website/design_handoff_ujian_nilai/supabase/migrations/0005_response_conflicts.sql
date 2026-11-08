-- =====================================================================
-- 0005 — DETEKSI KONFLIK RESPONS GOOGLE FORMS
-- Jalankan SETELAH 0001–0004. Idempotent. Tidak menghapus / melonggarkan apa pun.
--
-- Hasil pemeriksaan struktur yang ada (sebelum menulis file ini):
--  • exam_responses: unique (exam_id, response_id) dari 0001 → upsert
--    onConflict 'exam_id,response_id' di backend-supabase.js tetap valid.
--  • RLS (0003): exam_responses_owner_select/insert/update/delete =
--    teacher_id = auth.uid() and is_teacher(). Policy berlaku per BARIS, jadi
--    kolom baru otomatis ikut terlindungi; tidak ada policy yang diubah di sini.
--  • Trigger enforce_owner (0003) tetap aktif untuk INSERT/UPDATE.
--  • portal_lookup / get_portal_status (0004) hanya membaca students, classes,
--    exams, subjects, grades, publication_settings, portal_settings, profiles —
--    TIDAK membaca exam_responses, sehingga email responden tidak pernah keluar ke publik.
-- =====================================================================

alter table public.exam_responses add column if not exists respondent_email text;
alter table public.exam_responses add column if not exists review_status text;
alter table public.exam_responses add column if not exists reviewed_at timestamptz;

alter table public.exam_responses drop constraint if exists exam_responses_review_status_check;
alter table public.exam_responses add constraint exam_responses_review_status_check
  check (review_status is null or review_status in ('ok','nama_ganda','akun_multi_nama','konflik_nilai_lama','dipilih','ditolak'));
alter table public.exam_responses drop constraint if exists exam_responses_email_len_check;
alter table public.exam_responses add constraint exam_responses_email_len_check
  check (respondent_email is null or length(respondent_email) <= 320);

-- Laporan pengamanan form dari Apps Script v1.3.0 (requireLogin, limitOne, emailCollected, errors).
-- NULL = form dibuat dengan versi lama (v1.2.0) → UI menandai "belum terkunci".
alter table public.exams add column if not exists google_form_security jsonb;

create index if not exists idx_responses_exam_student on public.exam_responses(exam_id, student_id);
create index if not exists idx_responses_exam_email   on public.exam_responses(exam_id, lower(respondent_email)) where respondent_email is not null;
create index if not exists idx_responses_review       on public.exam_responses(exam_id, review_status);

-- Keputusan guru ('dipilih'/'ditolak') tidak boleh ditimpa oleh sinkronisasi ulang.
-- Perlindungan di database (selain di klien): jika status lama sudah final dan status baru
-- bukan keputusan baru dari guru, pertahankan status lama.
create or replace function public.keep_review_decision() returns trigger language plpgsql as $$
begin
  if old.review_status in ('dipilih','ditolak')
     and (new.review_status is null or new.review_status not in ('dipilih','ditolak')) then
    new.review_status := old.review_status;
    new.reviewed_at   := old.reviewed_at;
  end if;
  return new;
end $$;
drop trigger if exists trg_responses_keep_review on public.exam_responses;
create trigger trg_responses_keep_review before update on public.exam_responses
  for each row execute function public.keep_review_decision();

-- ---------- Pemeriksaan manual (audit) ----------
-- 1) Policy exam_responses masih hanya milik sendiri:
--    select policyname, cmd, qual, with_check from pg_policies where tablename = 'exam_responses';
-- 2) Fungsi publik tidak menyebut exam_responses / respondent_email:
--    select proname from pg_proc where proname in ('portal_lookup','get_portal_status')
--      and (prosrc ilike '%exam_responses%' or prosrc ilike '%respondent_email%');   -- harus 0 baris
