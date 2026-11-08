# Handoff: Sistem Manajemen Ujian & Nilai Sekolah

## Overview
A web app at one address for two kinds of user:
- **Teacher (Guru)**: logs in with Supabase Auth. Manages classes, students, exams, multiple-choice questions (uploaded from Excel), Google Forms quizzes, grades (manual entry with autosave, or synced from Google Forms), recaps, A4 print reports, grade publication and the student portal.
- **Student (Siswa)**: no account. Opens **Cek Nilai**, **picks a class, types a name, clicks CARI NILAI**, and sees only grades from exams the teacher has published.

This portal concept was chosen deliberately by the product owner: **no login, no password, no NISN, no OTP and no extra verification**. Students can look up a classmate's published grades, and that is accepted. **Do not add student auth.**

## v4 update (read first)
See **`CHANGELOG-v4.md`** for the full audit, list of changed files, and test results. The v4 changes are:
- **One-time Supabase config**: the URL and anon key come only from `config.js` / deploy env. There is no per-teacher setup.
- **Per-teacher data isolation**: every data table has `teacher_id`. RLS allows access only where `teacher_id = auth.uid()`. An `enforce_owner` trigger checks that cross-table relations belong to the same owner. Teachers cannot change their own role. Accounts can be deactivated. Migration: `supabase/migrations/0003_multi_guru_tugas.sql`.
- **Teacher account management (admin only)**: route `/admin/akun`, backed by the Edge Function `supabase/functions/admin-teachers` (service role is used server-side only).
- **Ujian & Tugas**: `exams.kind` is `ujian | tugas | manual` and `delivery` is `google_form | manual`. Questions can be MC or essay. Essays are graded by the teacher; final score = (MC + essay) ÷ total points × 100. The detail page shows submission progress (done / not done / graded / not graded).
- **Input Nilai**: tabs for Exam / Task / Manual grades. A "Penilaian Manual" can be created with no exam (category, date, max score, KKTP). Each grade has a per-student note (keterangan). Raw scores are converted to a 0–100 scale. Grades can be imported from Excel.
- **Rekap Nilai** (`js/admin-recap2.jsx` + `recap-data.js` + `charts.js`):
  - linked filters, including assessment type;
  - an individual line chart over time;
  - a class chart (average / max / min per assessment);
  - a pass/fail bar, and comparisons by assessment type and by semester.
- **Export & print** (`recap-export.js`): Word (.docx via `docx`) and PDF (via `jsPDF` + `autoTable`). Print options are A4 portrait/landscape, table and/or charts, school identity, and an optional teacher signature (name, title, place, date, NIP). The signature defaults are saved on `profiles.sign_*`. Page, print and export all render from the same data.
- **Student portal**: `portal_lookup(p_class_name, p_name)` returns only published grades, only from teachers whose portal is enabled. It can merge results for the same student across teachers.

## Code audit (read first)
See **`AUDIT-KODE.md`**: 12 bugs fixed (including a missing PK on `portal_settings`, a failing `claim_legacy_data`, the silent fallback to Demo mode, and rows truncated at 1000). New migration **`0006_audit_fixes.sql`** must be run after 0005. Open risks and the production checklist are listed there.

## v5 update: locked Google Forms and response conflict review
See `CHANGELOG-v5-google-form-security.md` (decisions, test results, and the manual test list for real Google and Supabase).
- **Apps Script 1.3.0**
  - Calls `setLimitOneResponsePerUser(true)`, which forces Google sign-in with any account and allows one response per account.
  - Collects verified respondent email. `setRequireLogin` (domain-only) is applied only when explicitly requested.
  - Each call is wrapped in try/catch, then **read back** from the form and returned as `security`.
  - `getResponses` adds `email`.
- **Migration 0005**
  - Adds `exam_responses.respondent_email`, `review_status` and `reviewed_at`.
  - Adds `exams.google_form_security`.
  - Adds the trigger `keep_review_decision`.
  - RLS is unchanged. Public portal functions never read `exam_responses`.
- **Sync**
  - `classifyResponses()` assigns one of: ok, nama_ganda, akun_multi_nama, konflik_nilai_lama.
  - Only `ok` responses are auto-imported. Other responses never auto-pick a winner and never overwrite an existing grade.
  - The **"Perlu diperiksa"** panel stores the teacher's decision as `dipilih` or `ditolak`.
- The student dropdown "Nama (KODE)" and the `student_id` matching are **unchanged**.

## About the Design Files
The files in this bundle are **design references created in HTML**. They are a working prototype (React 18 UMD + Babel in-browser, hash routing, supabase-js) that shows the intended look and behavior. They are not production code to ship as-is.

Recreate the design in the target environment. The original brief asks for **Next.js App Router + TypeScript + Tailwind + shadcn/ui + Lucide + Supabase (Auth, Postgres, RLS) + Vercel**. Keep:
- every screen, piece of copy, state (loading / empty / error / success) and validation rule described below;
- the Supabase SQL (`supabase/migrations/*.sql`), which is production-ready as written;
- the Google Apps Script (`google-apps-script/Code.gs`), which is production-ready as written.

Map the prototype's data layer onto Server Actions or Route Handlers. The method names in `js/backend-supabase.js` give a 1:1 contract.

The prototype runs in **DEMO mode** when Supabase is not configured. In that mode data lives in localStorage and every admin page shows a "MODE DEMO" ribbon. Demo mode is a preview aid only. Production must use Supabase exclusively and must never mix demo data with real data.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, states and copy are final. Rebuild the UI pixel-close using shadcn primitives styled with the tokens below.

## Global Layout

### Public pages
- Header: sticky, 68px tall, `rgba(255,255,255,.88)` with backdrop blur, 1px bottom border `#eef0f4`. Inner content max 1160px, padding 0 20px.
  - Left: brand mark (36px square, radius 10, bg `#4f46e5`, white `GraduationCap` icon), "Ujian & Nilai" (800 weight, 15px) and the subline "Sistem Manajemen Sekolah" (12px, `#64748b`).
  - Right nav: Beranda · Panduan · Cek Nilai, as 14px/600 pills with padding 8×12, radius 8, active bg `#f1f3f8`. Last item is a primary button: "Login Guru", or "Dashboard" when a session exists.
- Content: max 1160px, padding 0 20px 60px.

### Admin pages
- Sidebar: 248px wide (72px when collapsed, persisted in localStorage `sm_sb_collapsed`), sticky, full height, bg `#eef0fb`, right border `#dfe3f6`.
  - Head: 64px tall, brand mark, "Ujian & Nilai" plus the school name.
  - Groups use uppercase 11px/700 labels, letter-spacing .06em, color `#8b8fc4`:
    - UTAMA: Dashboard
    - DATA MASTER: Data Siswa, Data Kelas
    - UJIAN & NILAI: Manajemen Ujian, Input Nilai, Rekap Nilai, Publikasi Nilai
    - SISTEM: Portal Siswa, Pengaturan
  - Links: 40px tall, radius 10, gap 12, 14px/600, color `#3f4373`, icon color `#6c70b0`. Hover bg `#e2e5f8`. **Active**: bg `#4f46e5`, white text and icon, shadow `0 6px 16px rgba(79,70,229,.28)`.
  - Footer: "Ciutkan sidebar" (desktop only) and "Halaman publik".
- Under 900px the sidebar becomes a drawer: fixed, 270px wide, slides with `translateX` over 0.22s, opened from a hamburger in the topbar, closed by a backdrop `rgba(15,23,42,.4)` or by navigating.
- Topbar: 64px tall, sticky, white/90 with blur.
  - **Back button** (34px tall, radius 9, 1px border): on list pages it reads "← Dashboard" and goes to `/admin`. On detail pages it returns to the matching list ("← Data Siswa", "← Data Kelas", "← Manajemen Ujian"). Hidden on the Dashboard.
  - Page title (18px/700).
  - Portal status badge: "Portal aktif" (green) or "Portal ditutup".
  - User chip, which opens a menu: Profil, Keamanan, Keluar.
- Content: max 1360px, padding 24 (16 on mobile), vertical gap 20. Each page starts with a page head: optional breadcrumb, H2 at 24px/800 with letter-spacing -.02em, muted description, and an actions row aligned right.

## Screens / Views

| Route | Screen | Key behavior |
|---|---|---|
| `/` | Beranda | Hero "Sistem Manajemen **Ujian & Nilai**" (clamp 34–54px, 800, the second line in `#4f46e5`). Lead text: "Kelola ujian, nilai, dan hasil belajar siswa dalam satu sistem yang mudah digunakan." Portal status card comes from `get_portal_status()`: "Portal Siswa aktif" with a green dot and a "Cek Nilai" button, or "Portal Siswa sedang ditutup" with a grey dot. Below are two entry cards: **Login Guru** (indigo) and **Cek Nilai Siswa** (green, button "Cari Nilai"). |
| `/panduan` | Panduan | Two cards with ordered steps, one for students and one for teachers. |
| `/login` | Login Guru | Email and password fields, show/hide eye toggle, "Lupa password?" (switches to a reset form via `resetPasswordForEmail`), loading spinner, error alert. Errors: "Email atau password salah."; "Akun ini belum disetujui sebagai guru." (when the profile role is not teacher/admin). An existing session redirects to `/admin`. No public signup. |
| `/cek-nilai` | **Portal Siswa** | H1 **"CEK NILAI UJIAN SISWA"**, description "Masukkan kelas dan nama siswa untuk melihat hasil ujian yang telah dipublikasikan oleh guru." Form fields: **Pilih Kelas** (select of `{id,name}` from `get_portal_status().classes`) and **Nama Siswa** (text, placeholder "Contoh: Ahmad Fauzi"). Button **CARI NILAI** (green, 48px). States: portal closed, so show "Portal Siswa sedang ditutup"; no classes, so show "Belum ada kelas yang tersedia."; not found, so show "Nama siswa tidak ditemukan pada kelas yang dipilih. Periksa kembali nama dan kelas."; found, so show a student card (avatar initials, name, "Kelas X") plus one table per *Tahun Pelajaran · Semester* with columns Mata Pelajaran / Ujian (+ type · date) / Nilai (green if ≥ KKTP, else red) / KKTP / Status (Tuntas / Belum tuntas badge). If the student has no published grades, show "Nilai belum tersedia untuk ditampilkan." If names collide within a class, show each student separately with a masked hint ("NIS •••99") and an amber notice. A "← Cari nama lain" button resets the form. |
| `/admin` | Dashboard | Filters: Tahun pelajaran / Semester / Kelas / Mata pelajaran. 8 clickable stat cards: Total siswa → `/admin/siswa`, Total kelas, Total ujian, Ujian aktif, Nilai dipublikasikan → `/admin/publikasi?status=published`, Rata-rata, Siswa tuntas / belum tuntas → `/admin/rekap?status=…`. 4 charts: average per subject (horizontal bars), average per class, distribution in 0–59/60–69/70–79/80–89/90–100 (vertical bars colored red→green), and pass donut (conic gradient). Every chart has an empty state. |
| `/admin/siswa` | Data Siswa | Toolbar: search (name / NISN / NIS / code), class filter, status filter. Table: No, NISN, Nama (link to detail), Kelas (link), Kode, Status badge, Aksi (Detail / Edit / Hapus). 10 rows per page with pager. Header actions: Import, Export, Tambah Siswa. **Form**: Nama lengkap* (hint "Nama ini dipakai siswa untuk mencari nilai di Portal Siswa", and a live warning when the same normalized name exists in the chosen class), NISN (optional, 10 digits, unique), NIS (optional, unique), Kelas*, Kode siswa (optional, auto-generated, unique, `^[A-Z0-9_-]{3,20}$`), Tanggal lahir, Status (aktif / nonaktif / lulus / pindah). **Import** is a 3-step modal: pick file → preview with per-row errors (missing class, bad NISN, duplicate within the file or against the DB) → result counts. Only valid rows are inserted. Includes a template download. Delete is blocked if the student has grades. |
| `/admin/siswa/:id` | Detail siswa | Profile key-value list, average, range, and a per-exam grade table that shows publication state. |
| `/admin/kelas` | Data Kelas | Table: Nama, Tingkat, Tahun pelajaran (format `YYYY/YYYY+1`), Wali kelas, Jumlah siswa, Ujian, Aksi. Delete is blocked if the class still has students or exams. |
| `/admin/kelas/:id` | Detail kelas | Stats plus tabs: Daftar Siswa / Ujian Kelas / Rekap Nilai. Actions: "Pindahkan Siswa" (multi-select → target class) and "Tambah siswa ke kelas ini". |
| `/admin/ujian` | Manajemen Ujian | Filters, search, status filter. Table includes a Google Form column: open / copy link / sync, or "Belum dibuat". Header actions: Template Soal, Buat Ujian. Form fields: Nama*, Mapel* (with inline "add new subject"), Kelas*, Semester, Tahun pelajaran, Jenis, Tanggal*, KKTP* 0–100, Status (draft / aktif / selesai / arsip). |
| `/admin/ujian/:id` | Detail ujian | 4 stats. **Google Form card**: Buat Google Form (with confirm), Buka Form, Salin Link, Edit di Google, Sinkronisasi; shows Form ID, link, created time, last sync, response count. **Soal card**: Upload/Ganti soal (validation preview modal with Tabel / Preview soal toggle; Arabic text rendered RTL in Noto Naskh Arabic), delete all questions. Question card: number badge, text, option grid, correct option in green with a check icon. |
| `/admin/nilai` | Input Nilai | Filters (+ Jenis ujian) and an exam select. Table: No, NISN, Nama, **Nilai input** (78px, autosave 900ms after typing or on blur/Enter, shows "Menyimpan" → "Tersimpan" only after the server replies, or "Gagal" with "Ulangi"; validation 0–100), KKTP, Status (a missing grade shows "Belum dinilai", or "Belum mengikuti" when the exam is finished; **never treat it as 0**), Sumber (Manual / Google Forms badge), delete grade. Actions: Print, Edit Massal (paste a column from Excel, or fill one value for empty rows only), Sinkronisasi. |
| `/admin/rekap` | Rekap Nilai | Filters. 6 stats. Charts: average per exam with a KKTP marker, and distribution. Tables "Per siswa" (with tuntas filter) and "Per ujian" (print per exam). Export Excel (2 sheets). Print summary. |
| `/admin/publikasi` | Publikasi Nilai | Stats (published / hidden / portal state). Filters plus a segmented control (Semua / Terpublikasi / Disembunyikan). Row actions: Preview (modal "Lihat sebagai siswa"), Detail, **Publikasikan** (confirm, warns if some students have no grade, disabled when there are no grades) / **Sembunyikan**. Publication state is written to `publication_settings`, and the UI updates only after the server succeeds. Hiding never deletes grades. |
| `/admin/portal` | Portal Siswa | Big on/off switch (`portal_settings.enabled`), portal link with "Salin Link", message for students (≤300 characters), data readiness (published count, active students, warning for duplicate names within a class). |
| `/admin/pengaturan?tab=` | Pengaturan | Tabs: **profil** (teacher name, school name, subject), **akademik** (active year, semester, default KKTP), **google** (Apps Script URL + secret token, "Buat token", "Uji koneksi", 9-step guide), **supabase** (connection state, ping, guide; never accept a service_role key), **portal** (switch + message), **keamanan** (change password, sign out everywhere, audit log table). |

## Print Reports (A4)
Open from Input Nilai → Print, or from Rekap per exam. The modal has 4 cards: **Daftar Nilai Kelas**, **Rekap Nilai**, **Lembar Nilai Individu** (all students, or one student, page-break per student), **Analisis Ketuntasan** (percentages and remedial list). Flow: choose a report → **Preview Print** (A4 paper preview, 210mm, padding 16×15mm) → **Print**.

`@page{size:A4;margin:12mm}`. The print root renders only the report; the app shell, modals and toasts are hidden.

Report header: title, school name, 2px rule, then meta (Ujian, Mapel, Kelas, Semester/TP, KKTP, **Tanggal cetak**). Tables use 1px black borders at 10pt. The signature block reads "Guru Mata Pelajaran" plus the teacher name. Reports use only the selected exam and class. Export Excel is also available from the modal.

## Interactions & Behavior
- Every destructive action uses a confirm modal that runs the server call inside the dialog: spinner on the button, inline error if it fails, and it closes only on success.
- Toasts appear bottom-right: success 3.5s, error 6s.
- Forms show a label (+ red * when required), inline errors, disabled fields while saving, and Batal/Simpan in the footer. Typed values are kept if a save fails.
- Modals: max widths 420 / 560 / 860 / 1080. Esc and backdrop close them except while busy. On mobile they become bottom sheets.
- Lists use skeleton rows while loading, an error state with "Coba lagi", and an empty state with a primary CTA.
- Filters are mirrored into the URL query (`replaceState`), so dashboard deep links keep their filters.
- Responsive: under 1100px the 4-column grids become 2 columns; under 640px forms become 1 column; tables scroll horizontally.

## Data & Backend Contract
See `supabase/migrations/0001_init.sql` (fresh install) and `0002_portal_kelas_nama.sql` (upgrade from the old portal).
- Tables: `profiles` (role pending/teacher/admin), `classes`, `subjects`, `students`, `exams`, `exam_questions` (answer keys, teacher-only), `grades` (unique `exam_id, student_id`, score 0–100, source manual/google_forms), `exam_responses`, `publication_settings` (unique exam_id), `portal_settings` (single row), `audit_logs`.
- RLS: only `is_teacher()` users can read or write data tables. `anon` has no table access.
- Teachers are approved with `select public.approve_teacher('email','Nama');`
- **Public RPCs**:
  - `get_portal_status()` returns `{enabled, message, school_name, academic_year, semester, classes:[{id,name,academic_year}]}`.
  - `portal_lookup(p_class_id uuid, p_name text)` normalizes the name (`lower`, collapse whitespace, trim) and matches active students **in that class only**. It returns `{ok:true, students:[{full_name, class_name, hint, results:[{exam_name, exam_type, subject, score, kktp, passed, academic_year, semester, date}]}]}`, or `{ok:false, reason:'closed'|'not_found'}`. Results come only from published exams and are ordered by year desc, semester, subject, date.
  - The browser never receives the student list or all grades. Stored names are never modified.
- Internal relations always use `student_id` and `exam_id`. Names are used only for portal search.

## Google Forms Integration
`google-apps-script/Code.gs` v1.1.0 is deployed by the teacher as a Web App: Execute as **Me**, access **Anyone**. Script Property `SECRET_TOKEN` must match the token saved in Pengaturan. The client posts `text/plain` JSON `{action, token, ...}`.
- `createForm` builds a quiz:
  - a required **dropdown "Nama Siswa"** listing that class's active students as `"Full Name (STUDENTCODE)"`;
  - multiple-choice items with points and the correct answer marked.
  It returns `formId`, `responderUrl` and `editUrl`, which are saved on the exam.
- `getResponses` returns `[{response_id, submitted_at, identifier, name, score, max_score}]`.
- Sync (`syncExam` in `js/admin-exams.jsx`):
  - Each response is resolved to a `student_id` in this order: (1) the code in parentheses, (2) a typed NISN or code, (3) an exact normalized name only if it is unique in the class.
  - Responses are stored in `exam_responses`, and only the latest response per student is used.
  - The grade is set to `round(score/max*100, 2)`.
  - **Manual grades are not overwritten.**
  - Unmatched responses are reported back to the teacher.
  - Students without a response get no grade (never 0).

## State Management
- App context: `backend`, `session` (undefined while checking), `settings` (`{profile, portal}`), `google` (`{google_script_url, google_token}`).
- Each page fetches its tables and recomputes derived stats client-side. Production can move the heavy aggregates into SQL views.

## Design Tokens
- Primary `#4f46e5` (600 `#4338ca`, 700 `#3730a3`, 50 `#eef2ff`, 100 `#e0e7ff`)
- Green `#16a34a` (600 `#15803d`, 50 `#f0fdf4`, 100 `#dcfce7`)
- Red `#dc2626` (50 `#fef2f2`, 100 `#fee2e2`)
- Amber `#b45309` (50 `#fffbeb`, 100 `#fef3c7`)
- Background `#f5f6fa`; card `#fff`
- Text `#0f172a`, text-2 `#334155`, muted `#64748b`, faint `#94a3b8`
- Border `#e5e7eb`, border-2 `#eef0f4`
- Sidebar `#eef0fb` / `#dfe3f6` / text `#3f4373` / icon `#6c70b0` / group label `#8b8fc4` / hover `#e2e5f8`
- Demo ribbon `#1e1b4b` on `#e0e7ff`
- Fonts: **Plus Jakarta Sans** 400–800 (UI), **Noto Naskh Arabic** 400/600 (Arabic, RTL, 1.15em, line-height 1.9), **JetBrains Mono** (IDs and codes). Base size 15px, line-height 1.5.
- Type scale: 12 (badges, captions) / 13 (small, labels) / 14 (body, tables) / 16 (card title) / 18 (topbar) / 24 (page H2) / 28 (stat value) / 34–54 (hero)
- Radius: cards 14, inputs/buttons 10, small buttons 9, badges 99, modals 16
- Shadow: card `0 1px 2px rgba(15,23,42,.04), 0 6px 20px rgba(15,23,42,.05)`; modal/menu `0 20px 50px rgba(15,23,42,.18)`; focus ring `0 0 0 3px #e0e7ff`
- Buttons: 40px tall (sm 34, lg 48), padding 0 16, 14px/600. Variants: primary, green, outline, ghost, danger, soft (indigo-50 bg, indigo-700 text).
- Spacing: 4 / 6 / 8 / 10 / 12 / 16 / 20 / 24
- Table header: 12px/700 uppercase, letter-spacing .03em, bg `#fafbfc`; cell padding 11×14.

## Assets
No raster images. Icons: Lucide (names used: GraduationCap, LayoutDashboard, Users, School, ClipboardList, PencilLine, ChartColumn, Megaphone, Globe, Settings, Search, Plus, Pencil, Trash2, Eye, EyeOff, Upload, Download, FileSpreadsheet, Printer, RefreshCw, Copy, ExternalLink, WandSparkles, ArrowLeft, and others). Libraries: SheetJS (xlsx) for import/export, supabase-js v2.

## Test Scenario (verified in demo mode)
Run the steps in order. The results below were confirmed in the prototype's demo mode.

| # | Step | Expected result |
|---|---|---|
| 1 | Search class **VIII.1** for `"  ahmad   FAUZI "` | Ahmad Fauzi · Sumatif Bahasa Arab · **85** · KKTP 75 · **Tuntas**. "Ujian Harian Bab 1" (90) is not shown because it is unpublished. |
| 2 | Search the same name in class VII-A | "Nama siswa tidak ditemukan pada kelas yang dipilih." |
| 3 | Search for `"Ahmad"` only | Not found (exact normalized match). |
| 4 | Hide "Sumatif Bahasa Arab", then search again | No results shown. The grade still exists in the DB. |
| 5 | Publish it again | 85 shows again. |
| 6 | Turn the portal off | "Portal Siswa sedang ditutup". |

Still untested in this prototype:
- real Supabase project (run the migration and test RLS);
- real Apps Script deployment (create form and sync);
- browser print dialog on physical printers.

## Files
- `index.html`: entry point; script load order.
- `styles.css`: all styles plus print CSS.
- `config.js`: public Supabase URL and anon key.
- `js/core.jsx`: router, Modal, Confirm, Toast, useQuery, shared components.
- `js/public.jsx`: Beranda, Panduan, Login, Portal (CEK NILAI).
- `js/admin-shell.jsx`: sidebar/topbar layout, Dashboard, charts, filters.
- `js/admin-students.jsx`, `js/admin-classes.jsx`, `js/admin-exams.jsx` (questions, Google Form, sync), `js/admin-grades.jsx`, `js/admin-recap.jsx` (Rekap + Publikasi), `js/admin-settings.jsx`, `js/reports.jsx`, `js/app.jsx`.
- `js/backend-supabase.js`: production data contract. `js/backend-demo.js`: demo mirror. `js/google.js`: Apps Script client. `js/utils.js`.
- `supabase/migrations/0001_init.sql`, `0002_portal_kelas_nama.sql`; `google-apps-script/Code.gs`; `.env.example`; `PROJECT_README.md` (setup guide for Supabase, Google and Vercel).
