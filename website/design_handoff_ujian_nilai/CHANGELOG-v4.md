# v4 — Multi-guru, Ujian & Tugas, Nilai Manual, Rekap & Grafik, Word/PDF/Print

## Ringkasan audit (sebelum perubahan)
| Area | Temuan | Risiko |
|---|---|---|
| Konfigurasi Supabase | Bisa diisi per browser (localStorage `sm_supabase_cfg`) | Tiap guru harus konfigurasi sendiri |
| RLS | Policy `*_teacher_all` = `is_teacher()` → **semua guru melihat semua data** | Kebocoran data antar guru |
| Kepemilikan | Tidak ada `teacher_id`; UNIQUE global (NISN, kode, nama kelas) | Guru B tidak bisa memakai nama kelas yang sama |
| Role | `profiles_update_self` membatasi role, tapi `active` tidak ada | Akun tidak bisa dinonaktifkan |
| Pengaturan | `portal_settings` satu baris global; token Google di profil (aman, RLS self) | Portal/pengaturan tercampur |
| Tugas / nilai manual | Belum ada | — |
| Soal essay | Tidak didukung (constraint wajib PG) | — |

## Perubahan database — `supabase/migrations/0003_multi_guru_tugas.sql`
Aman dijalankan ulang, tidak menghapus data, tidak membuat tabel duplikat (memakai tabel `exams` yang ada + kolom `kind`).
- `teacher_id` (default `auth.uid()`) pada classes, subjects, students, exams, exam_questions, grades, exam_responses, publication_settings.
- Trigger `enforce_owner`: INSERT selalu memakai `auth.uid()`, pemilik tidak bisa diganti, dan relasi wajib milik guru yang sama (kelas↔siswa, ujian↔kelas/mapel, nilai↔ujian/siswa).
- RLS diganti menjadi SELECT/INSERT/UPDATE/DELETE `teacher_id = auth.uid() and is_teacher()`.
- `profiles.active`, `is_admin()`, trigger `protect_profile_columns` (guru tidak bisa mengubah role/active/email sendiri). Akun baru = `pending`.
- UNIQUE per guru. `portal_settings` satu baris per guru.
- `exams.kind` (ujian/tugas/manual), `delivery`, `task_type`, `category`, `description`, `instructions`, `start_date`, `due_date`, `max_score`, status `ditutup`.
- `exam_questions.qtype` (mc/essay), `grades.raw_score/note/mc_score/essay_score`, `exam_responses.answers/mc_score/mc_max/essay_max`.
- `portal_lookup(p_class_name, p_name)`: hanya guru yang portalnya aktif, hanya nilai yang dipublikasikan oleh pemiliknya.
- `claim_legacy_data(email)`: admin menetapkan pemilik data lama (data tanpa pemilik tidak terlihat siapa pun sampai diklaim).

## Edge Function — `supabase/functions/admin-teachers`
Buat / ubah role / nonaktifkan / hapus akun guru. Service role key hanya di server; pemanggil diverifikasi `role='admin'`. Hapus akun ditolak jika guru masih memiliki data.

## File frontend yang diubah
- `js/app.jsx`: Supabase hanya dari `config.js` (sekali, oleh admin); localStorage config dihapus; route `/admin/akun`.
- `js/backend-supabase.js`: cek profil/active saat login, pengaturan per guru, `setGradeNote`, field nilai baru, aksi admin via Edge Function, portal per nama kelas.
- `js/backend-demo.js`: ditulis ulang meniru RLS + trigger (dua guru + admin).
- `js/admin-exams.jsx`: Manajemen Ujian & Tugas, tugas manual/Google Form, soal PG+essay, progres pengumpulan, Penilaian Essay.
- `js/admin-grades.jsx`: tab Nilai Ujian/Tugas/Manual, Penilaian Manual baru, nilai maks + konversi, keterangan, import Excel.
- `js/admin-recap2.jsx`, `js/recap-data.js`, `js/charts.js`, `js/recap-export.js`: rekap + grafik individu/kelas, Word/PDF, print fleksibel + tanda tangan.
- `js/admin-accounts.jsx`: halaman Akun Guru (admin).
- `js/admin-publication.jsx` (dipindah dari admin-recap.jsx), `js/admin-shell.jsx`, `js/admin-settings.jsx`, `js/public.jsx`, `js/utils.js`, `styles.css`, `index.html`.
- `google-apps-script/Code.gs` v1.2.0: soal essay (paragraf, tanpa kunci), skor PG terpisah, jawaban essay dikirim ke website.

## Pengujian (Mode Demo, dua akun guru)
Lolos: Guru B tidak bisa membaca/mengubah/menghapus siswa atau ujian Guru A; tidak bisa memberi nilai pada ujian A; tidak bisa memasukkan siswa ke kelas A; tidak bisa menjadikan dirinya admin; tidak bisa membuka daftar akun. Portal: "viii.1 / AHMAD fauzi" menampilkan nilai terpublikasi dari kedua guru; nilai yang belum dipublikasi tidak muncul. Export PDF (3 halaman landscape, grafik, tanda tangan) dan Word berhasil dibuat. Print preview A4 tampil.

## Belum diuji (perlu lingkungan nyata)
- Migrasi 0003 pada database Supabase yang sebenarnya, plus uji RLS dengan dua akun nyata.
- Deploy Edge Function `admin-teachers`.
- Apps Script v1.2.0: membuat form essay dan sinkronisasi jawaban essay.
- Hasil cetak pada printer fisik.
