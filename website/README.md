# Sistem Manajemen Ujian & Nilai Sekolah

Aplikasi web satu alamat untuk **guru** (login) dan **siswa** (Portal Cek Nilai tanpa login).

## Struktur proyek
```
index.html                    Entry point (hash routing: #/, #/login, #/cek-nilai, #/admin/...)
config.js                     SUPABASE_URL & SUPABASE_ANON_KEY (publik)
styles.css                    Desain + CSS print A4
js/utils.js                   Format, statistik, Excel (SheetJS)
js/backend-supabase.js        Backend produksi (supabase-js + RLS + RPC)
js/backend-demo.js            Backend DEMO (aktif hanya bila Supabase belum dikonfigurasi)
js/google.js                  Klien Google Apps Script
js/core.jsx                   Router, toast, modal, konfirmasi, komponen dasar
js/public.jsx                 Beranda, Panduan, Login, Lupa Password, Cek Nilai
js/admin-*.jsx                Dashboard, Siswa, Kelas, Ujian, Nilai, Rekap, Publikasi, Portal, Pengaturan
js/reports.jsx                Laporan cetak (Daftar, Rekap, Individu, Analisis)
supabase/migrations/0001_init.sql
google-apps-script/Code.gs
```

## 1. Supabase
1. Daftar di supabase.com → New project (region Singapore).
2. SQL Editor → jalankan `supabase/migrations/0001_init.sql`.
3. Project Settings → API → salin **Project URL** & **publishable/anon key** → isi `config.js`.
4. Authentication → Users → Add user (centang Auto confirm).
5. SQL Editor: `select public.approve_teacher('guru@sekolah.sch.id','Nama Guru');`
6. Authentication → Providers → Email → matikan "Allow new users to sign up".
7. Login di aplikasi → Pengaturan → Supabase → **Uji koneksi**.

## 2. Google Forms (Apps Script)
1. script.google.com → New project → tempel `google-apps-script/Code.gs`.
2. Project Settings → Script Properties → `SECRET_TOKEN` = token dari Pengaturan → Google Forms → "Buat token".
3. Deploy → New deployment → Web app → Execute as **Me**, Access **Anyone** → izinkan OAuth.
4. Salin URL `/exec` ke Pengaturan → Google Forms → Simpan → **Uji koneksi**.
5. Buka ujian yang memiliki soal → **Buat Google Form** → isi sebagai siswa → **Sinkronisasi**.

## 3. Vercel
1. Push folder ini ke GitHub.
2. vercel.com → Add New Project → Import repository (Framework: Other, tanpa build command).
3. Pastikan `config.js` berisi URL & anon key (atau generate saat build dari env var).
4. Deploy → gunakan URL yang diberikan Vercel. Tambahkan URL tersebut di Supabase → Authentication → URL Configuration (Site URL) agar link reset password benar.

## Keamanan
- RLS aktif di semua tabel; hanya profil dengan role `teacher/admin` yang dapat membaca/menulis.
- Kunci jawaban (`exam_questions`) & respons mentah hanya untuk guru.
- Portal siswa (sesuai permintaan: tanpa akun/password/NISN/OTP) memanggil `portal_lookup(p_class_id, p_name)` (SECURITY DEFINER): nama dinormalisasi (huruf kecil, spasi dirapikan) dan dicocokkan **di kelas terpilih saja**; hanya nilai dari ujian terpublikasi yang dikembalikan; daftar siswa tidak pernah dikirim ke browser. Nama kembar dalam satu kelas ditampilkan terpisah.
- Database lama: jalankan `supabase/migrations/0002_portal_kelas_nama.sql` untuk upgrade.
- service_role key tidak pernah dipakai di browser.

## Panduan pengujian
Navigasi tiap menu · Siswa (tambah/edit/hapus/cari/filter/import/export) · Kelas (CRUD, detail, pindah siswa) · Ujian (buat, upload soal, Buat Google Form, salin link, sinkronisasi) · Nilai (autosave, edit massal, hapus, print 4 jenis laporan, export Excel) · Rekap (filter, klik siswa/ujian, print) · Publikasi (publikasikan/sembunyikan/preview) · Portal (aktif/nonaktif, cek nilai dengan verifikasi benar & salah, rate limit) · Pengaturan (semua tab tersimpan).

## Status implementasi
| Fitur | Status |
|---|---|
| Login, sesi, lupa password, logout | Berfungsi (Supabase Auth) |
| CRUD Siswa/Kelas/Ujian, import/export Excel | Berfungsi |
| Template & upload soal (validasi, preview, Arab) | Berfungsi |
| Google Form & sinkronisasi | Berfungsi setelah Apps Script di-deploy guru |
| Input nilai autosave, massal, print, rekap, publikasi | Berfungsi |
| Portal siswa: pilih kelas + ketik nama | Berfungsi (diuji di Mode Demo) |
| Google Form: identitas = dropdown nama siswa kelas → dicocokkan ke student_id | Berfungsi setelah Apps Script v1.1.0 di-deploy |
| Mode DEMO | Hanya aktif bila Supabase belum dikonfigurasi, diberi label jelas |

> Catatan: versi ini dibangun sebagai aplikasi statis (React + supabase-js) agar dapat langsung dipratinjau. Struktur modul dan backend (RLS + RPC) siap dipindahkan ke Next.js App Router bila diperlukan.


## v5 — Google Form terkunci & panel "Perlu diperiksa"
### Migrasi
Jalankan berurutan di SQL Editor: `0001` → `0002` → `0003` → `0004` → **`0005_response_conflicts.sql`**. File 0005 idempotent, hanya menambah kolom/indeks/trigger, dan tidak mengubah RLS. Setelah itu deploy ulang **Apps Script v1.3.0** (Deploy → Manage deployments → Edit → *New version*, agar URL tetap sama).

### Perilaku Google Form (v1.3.0)
- Siswa **wajib login akun Google** (Gmail biasa maupun akun sekolah) dan hanya bisa mengirim **satu kali per akun**. Ini diterapkan lewat `setLimitOneResponsePerUser(true)`.
- Email responden dikumpulkan (mode *Verified* bila tersedia). Email hanya untuk audit dan deteksi konflik. Siswa tetap dicocokkan lewat dropdown **"Nama (KODE)"**.
- `setRequireLogin(true)` (hanya akun domain sekolah) **tidak** dipakai secara default, karena akan menolak Gmail pribadi.
- Setelah form dibuat, website menampilkan laporan pengamanan yang **dibaca ulang dari form**. Jika ada yang gagal, muncul peringatan "Form BELUM terkunci" beserta saran memeriksa Google Forms → Settings → Responses.
- **Batasan:**
  - Siswa yang punya beberapa akun Google tetap bisa mengirim beberapa kali. Kasus ini tertangkap sebagai *nama ganda*.
  - Hasil pada akun Gmail biasa vs Workspace **perlu diuji**.
  - Form yang dibuat sebelum v1.3.0 tidak terkunci sampai dibuat ulang.

### Panel "Perlu diperiksa"
Saat sinkronisasi, setiap respons diberi status:
- **ok**: diimpor otomatis seperti biasa.
- **nama_ganda**: lebih dari satu kiriman memilih nama yang sama.
- **akun_multi_nama**: satu email memilih lebih dari satu nama.
- **konflik_nilai_lama**: siswa sudah punya nilai.

Respons selain *ok* **tidak diimpor**, tidak dipilih otomatis, dan tidak menimpa nilai. Panel menampilkan semua respons untuk siswa yang sama secara berdampingan (email, waktu kirim, skor PG/essay), dengan tombol:
- **Pakai yang ini**: nilai diimpor lewat `upsertGrade`, respons lain ditandai *ditolak*.
- **Abaikan semua**: semua respons ditandai *ditolak*.
- **Pertahankan nilai lama** / **Ganti dengan respons ini**: untuk kasus konflik nilai lama.

Keputusan disimpan di `review_status` dan `reviewed_at`, dan dilindungi trigger agar sinkronisasi ulang tidak memunculkannya lagi. Detail lengkap ada di `CHANGELOG-v5-google-form-security.md`.
