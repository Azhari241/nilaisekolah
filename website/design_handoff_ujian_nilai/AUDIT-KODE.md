# Audit Kode — Sistem Manajemen Ujian & Nilai

## Penilaian umum
**Struktur dan desainnya baik, tetapi belum siap produksi.** Logika keamanan (RLS, kepemilikan data, portal, konflik respons) dirancang dengan benar dan lolos semua uji di Mode Demo. Ada dua hal yang mencegahnya siap produksi:
1. **Belum ada satu pun bagian yang diuji di Supabase atau Google yang nyata.** Migrasi SQL, Edge Function, dan Apps Script baru diverifikasi lewat pembacaan kode dan simulasi demo.
2. **Arsitektur prototipe.** Aplikasi memakai React UMD dan Babel yang dikompilasi di browser, sehingga lambat dimuat dan tidak cocok untuk produksi. Rekomendasinya adalah memindahkannya ke Next.js/Vite sesuai brief awal. Logika dan kontrak backend bisa dipakai apa adanya.

## Yang diperiksa
- Sintaks dan komponen di 13 file JSX. Hasil: semua komponen terdefinisi atau terekspor, dan 90 nama ikon valid.
- Uji asap semua halaman admin dan publik. Hasil: tidak ada error runtime.
- Regresi keamanan dengan dua akun guru. Hasil: membaca, mengubah, memberi nilai, mengubah keputusan respons, memakai sakelar portal, membuka daftar akun, dan menaikkan role sendiri **semuanya ditolak**.
- Sinkronisasi konflik, Portal Siswa, dan rekap. Hasil: sesuai harapan.
- Review manual migrasi 0001–0005, Edge Function, Apps Script, dan backend.

## Bug yang ditemukan dan diperbaiki
| # | Tingkat | Masalah | Perbaikan |
|---|---|---|---|
| 1 | **Tinggi** | `portal_settings` kehilangan PRIMARY KEY di migrasi 0003 (`drop constraint portal_settings_pkey` tanpa diganti). | `0006_audit_fixes.sql` menambahkan PK kembali dengan aman. |
| 2 | **Tinggi** | `claim_legacy_data()` gagal total jika guru penerima sudah punya baris pengaturan (bentrok unique), sehingga data lama tidak bisa diklaim. | Baris pengaturan lama digabung, lalu dihapus. Data guru tidak terhapus. |
| 3 | **Tinggi** | Jika konfigurasi Supabase ada tetapi library gagal dimuat, aplikasi **diam-diam pindah ke Mode Demo**. Guru bisa mengira datanya tersimpan. | Sekarang muncul layar error yang memblokir dengan tombol "Muat ulang". |
| 4 | Sedang | `list()` Supabase memakai `limit(5000)`, padahal Supabase membatasi 1000 baris per request. Nilai di atas 1000 baris **hilang diam-diam** dari rekap dan grafik. | Diambil per halaman (1000 baris per request) sampai habis. |
| 5 | Sedang | Trigger `protect_profile_columns` hanya membaca format klaim JWT lama. Di versi Supabase baru, Edge Function admin bisa gagal mengubah role/active. | Kedua format klaim (`request.jwt.claim.role` dan `request.jwt.claims`) dibaca. |
| 6 | Sedang | Sesi yang tersimpan milik akun yang **sudah dinonaktifkan** tetap membuka panel, hanya saja kosong (data tetap terblokir RLS). | Pengguna otomatis dikeluarkan dengan pesan "Akun Anda dinonaktifkan…". |
| 7 | Sedang | Export Excel rentan *formula injection*: nama hasil import yang diawali `=`, `+`, `-`, atau `@` akan dijalankan sebagai rumus oleh Excel. | Teks seperti itu diberi awalan `'` agar diperlakukan sebagai teks. |
| 8 | Rendah | Edge Function memanggil `auth.admin.signOut(userId)`, padahal fungsi itu butuh JWT, bukan user id, sehingga tidak berfungsi. | Panggilan dihapus. Pemblokiran tetap terjamin oleh `is_teacher()` di RLS. |
| 9 | Rendah | `printNode` membuat React root baru setiap kali mencetak dan memakai jeda tetap. Print beruntun bisa bentrok dan grafik bisa belum selesai dirender. | Satu root dipakai ulang. Print dijalankan setelah font siap, dan pembersihan memakai `afterprint`. |
| 10 | Rendah | Portal: nilai dari beberapa guru digabung tanpa diurutkan ulang. | Hasil diurutkan menurut tahun, semester, mapel, lalu tanggal. |
| 11 | Rendah | Peringatan React tentang prop pada `Fragment` (dipicu atribut pratinjau). | Diganti `span`. |
| 12 | Rendah | `App` berpotensi melanggar aturan hooks saat dibuat early return. | Komponen dipisah (`App` → `AppMain`). |

## Masalah yang belum diperbaiki (keputusan desain atau di luar lingkup)
- **Portal Siswa tanpa verifikasi (kelas + nama).** Ini sesuai permintaan Anda, tetapi siapa pun bisa melihat nilai terpublikasi milik siswa lain, dan tidak ada pembatasan jumlah percobaan (rate limit). Pertimbangkan menambahkan rate limit di sisi server bila disalahgunakan.
- **Token Apps Script disimpan di `profiles`.** Aman dari guru lain karena RLS hanya mengizinkan pemiliknya, tetapi tersimpan sebagai teks biasa. Untuk keamanan lebih tinggi, simpan di Supabase Vault atau Edge Function.
- **URL Apps Script dipanggil langsung dari browser** dengan token di body request. Token terlihat di DevTools milik guru itu sendiri. Risikonya rendah, tetapi idealnya dilewatkan ke Edge Function.
- **Seluruh tabel diambil ke browser lalu difilter di klien.** Ini benar secara keamanan karena RLS hanya mengirim data milik guru, tetapi akan lambat untuk sekolah dengan puluhan ribu nilai. Di produksi, pindahkan agregasi ke view atau RPC SQL.
- **Mode Demo** memakai localStorage. Ini hanya untuk pratinjau, dan sudah diberi label jelas.

## Langkah wajib sebelum dipakai sekolah
1. Jalankan migrasi berurutan: **0001 → 0002 → 0003 → 0004 → 0005 → 0006**.
2. Deploy Edge Function `admin-teachers` dan Apps Script v1.3.0.
3. Jalankan daftar uji manual di `CHANGELOG-v5-google-form-security.md` dan `CHANGELOG-v4.md` dengan **dua akun guru nyata**.
4. Pindahkan frontend ke build produksi (Next.js atau Vite) agar tidak lagi memakai Babel di browser.
