# v5: Google Form terkunci + deteksi konflik respons

## Temuan sebelum perubahan
- **Apps Script v1.2.0**
  - `createForm_` memanggil `setCollectEmail(false)`. Tidak ada wajib login dan tidak ada batas kiriman.
  - `dueDate` sebenarnya terbuang di `js/google.js` karena tidak ikut dikirim. Sekarang sudah ikut dikirim.
- **`getResponses`** mengembalikan `[{response_id, submitted_at, identifier ("Nama (KODE)"), name:'', score, mc_score, mc_max, essay_max, max_score, answers}]`. Belum ada email responden.
- **Pencocokan ke siswa** (`syncExam`): `identifier` → kode di dalam kurung → `student_id`. Cadangannya NISN/kode yang diketik, lalu nama persis yang unik di kelas. Bagian ini **tidak diubah**.
- **Konversi ke nilai (perilaku lama)**
  - Respons **paling akhir** per siswa diambil otomatis.
  - Nilai = PG ÷ max × 100. Untuk tugas ber-essay: (PG + essay) ÷ max × 100 setelah guru menilai essay.
  - Nilai manual dilewati, tetapi nilai Google Forms bisa ditimpa oleh kiriman siapa pun yang memilih nama itu.
- **`exam_responses`**: `unique (exam_id, response_id)` (0001). RLS hanya untuk data milik sendiri dan trigger `enforce_owner` (0003). Tabel ini tidak dibaca oleh `portal_lookup` maupun `get_portal_status` (diverifikasi untuk 0002–0004).
- **`grades`**: `unique (exam_id, student_id)`. Penyimpanan lewat `upsertGrade`.

## Perubahan per file
| File | Perubahan |
|---|---|
| `google-apps-script/Code.gs` → **1.3.0** | `applySecurity_()`: `setRequireLogin` (hanya jika diminta), `setLimitOneResponsePerUser(true)`, lalu email `VERIFIED` dengan cadangan `setCollectEmail(true)`. Masing-masing dibungkus try/catch. Setelah itu status **dibaca ulang** dari form (`requiresLogin()`, `hasLimitOneResponsePerUser()`, `getEmailCollectionType()`/`collectsEmail()`) dan dikembalikan sebagai `security`. `getResponses_` menambahkan `email`. Field lama dipertahankan. Dropdown roster dan SECRET_TOKEN tidak diubah. |
| `js/google.js` | `createForm` meneruskan `dueDate` dan `restrictDomain` (default `false`). |
| `supabase/migrations/0005_response_conflicts.sql` | Kolom `respondent_email`, `review_status` (check: ok/nama_ganda/akun_multi_nama/konflik_nilai_lama/dipilih/ditolak), dan `reviewed_at`. Kolom `exams.google_form_security jsonb`. Indeks. Trigger `keep_review_decision` (sinkronisasi ulang tidak bisa mengubah 'dipilih'/'ditolak'). RLS dan constraint lama tidak disentuh. |
| `js/backend-supabase.js` | `setResponseReview(examId, responseIds, 'dipilih'\|'ditolak')`. `saveResponses` tetap memakai upsert `exam_id,response_id`. |
| `js/backend-demo.js` | Meniru trigger keputusan, `setResponseReview`, simulasi kotak masuk form v1.3.0 (tujuh kiriman berisi semua jenis konflik), dan laporan `security`. |
| `js/admin-exams.jsx` | `classifyResponses()` (fungsi murni), `syncExam` versi baru, `SyncResult` ("X diimpor, Y perlu diperiksa" plus email ganda), `FormSecurityNotice`, panel **Perlu diperiksa**, **Respons tersimpan** (dengan email), penanda "⚠ n perlu diperiksa" di daftar. Penilaian Essay hanya memakai respons 'ok'/'dipilih'/lama. |

## Keputusan desain
1. **Login Google tanpa membatasi domain.** `setRequireLogin(true)` di Apps Script adalah fitur Workspace yang berarti *hanya akun di domain yang sama*. Jika dipakai, siswa dengan Gmail pribadi akan ditolak, padahal permintaannya: Gmail biasa **dan** akun sekolah. Karena itu default-nya `restrictDomain=false`. Login tetap dipaksa oleh `setLimitOneResponsePerUser(true)`, sebab Google mewajibkan responden login untuk membatasi satu kiriman. `requireLogin` hanya diterapkan bila dipanggil dengan `restrictDomain:true`. Laporan `security` membedakan keduanya (`loginEnforced`).
2. **Status keamanan dibaca ulang dari form, bukan diasumsikan.** Panggilan yang tidak melempar error belum tentu berlaku, jadi setiap nilai `true` berasal dari getter.
3. **Tidak ada pemilihan otomatis untuk kasus konflik.** Kiriman paling awal maupun paling akhir tidak dipilih otomatis, dan nilai yang sudah ada tidak pernah ditimpa. Sumber nilai yang sudah ada (respons 'ok' sebelumnya) juga ikut ditandai bila muncul kiriman tandingan, karena kiriman pertama bisa jadi milik peniru. Nilainya tetap tidak berubah.
4. **Kompatibilitas v1.2.0.** Respons lama tanpa status yang dulu diimpor dianggap sumber nilai. Sinkronisasi ulang form lama tanpa kiriman baru menghasilkan 'ok', tanpa konflik palsu. Respons tanpa email tidak ikut pemeriksaan 'akun_multi_nama'.
5. **Ganti nilai untuk tugas ber-essay.** Nilai lama dihapus, lalu essay dari respons terpilih dinilai ulang di panel Penilaian Essay. Nilai tidak dihitung dengan skor essay milik respons lain.
6. **Keputusan guru dijaga dua lapis**: klien (status 'dipilih'/'ditolak' tidak diklasifikasi ulang) dan trigger database.

## Hasil uji (Mode Demo)
| Skenario | Hasil |
|---|---|
| Sinkronisasi pertama | 2 diimpor (Ahmad, Khadijah). 4 siswa perlu diperiksa: nama_ganda ×2 (Balqis, dua akun), akun_multi_nama ×2 (satu akun memilih Bilal dan Fatimah), konflik_nilai_lama ×1 (Hasan). Email ganda terdeteksi: `bilal.r@gmail.com` (2×). |
| Nilai lama Hasan (60, manual) | Tidak berubah. |
| Keputusan guru, lalu sinkronisasi ulang | 0 diimpor. Hanya kasus yang belum diputuskan yang muncul lagi. Status dipilih/ditolak tetap. |
| `classifyResponses` untuk data lama v1.2.0 | Sinkronisasi ulang tanpa kiriman baru → 'ok'. Ada kiriman baru → keduanya ditandai. Dua respons tanpa email untuk nama yang sama → nama_ganda. |
| Guru B | Melihat 0 respons milik Guru A. Mengubah keputusan respons Guru A ditolak. |

## PERLU UJI di Google dan Supabase nyata
Belum ada yang diuji di lingkungan sungguhan.
1. **Form dibuat dari akun Gmail biasa.** Catat isi `security`: `limitOne` diharapkan true, `emailCollected`/`emailType` diharapkan VERIFIED atau COLLECT. Jika `requireLogin` diminta, kemungkinan gagal atau false, dan errornya harus tampil di UI.
2. **Form dibuat dari akun Workspace sekolah.** Sama seperti di atas. Pastikan Gmail pribadi siswa **tetap bisa** mengisi saat `restrictDomain=false`.
3. **Membuka link tanpa login.** Harus diminta login Google.
4. **Akun yang sama mengirim dua kali.** Kiriman kedua harus ditolak Google ("Anda sudah merespons").
5. **Dua akun berbeda memilih nama yang sama.** Keduanya berstatus `nama_ganda`, dan tidak ada nilai yang diimpor sampai guru memilih.
6. **Siswa sudah punya nilai, lalu ada kiriman baru.** Statusnya `konflik_nilai_lama` dan nilai lama tidak berubah.
7. **Setelah "Pakai yang ini"/"Abaikan semua", sinkronisasi ulang.** Kasus tidak muncul lagi. Periksa juga di database bahwa `review_status` dan `reviewed_at` tetap.
8. **Form lama v1.2.0 disinkronkan dengan Apps Script v1.3.0.** Tidak error, email kosong, dan tidak ada konflik palsu.
9. **RLS dengan dua akun guru nyata.** `select * from exam_responses` sebagai Guru B tidak mengembalikan baris milik Guru A. Update `review_status` milik Guru A gagal.
10. **Audit portal.** Jalankan query pemeriksaan di akhir `0005`. Hasilnya harus 0 baris, artinya email tidak pernah dibaca oleh fungsi publik.
11. **`getRespondentEmail()` pada mode VERIFIED.** Pastikan email benar-benar terisi.

## Batasan yang diketahui
- Batas satu kiriman berlaku **per akun Google**. Siswa yang punya beberapa akun tetap bisa mengirim lebih dari sekali. Kasus ini tertangkap sebagai `nama_ganda` dan ditangani guru.
- Pemilik form (guru) di Google Forms masih bisa mengubah pengaturan secara manual. Laporan `security` hanya mencerminkan kondisi saat form dibuat.
- Email adalah data pribadi. Email hanya tersimpan di `exam_responses` (RLS khusus pemilik) dan tidak keluar ke portal.
