/* =========================================================================
 * DEMO BACKEND — hanya untuk pratinjau ketika Supabase BELUM dikonfigurasi
 * oleh administrator (config.js kosong). Meniru aturan database 0003:
 *   • setiap baris punya teacher_id; guru hanya melihat/mengubah miliknya
 *   • relasi lintas guru ditolak (kelas/ujian/siswa harus milik guru yang sama)
 *   • akun guru hanya dibuat admin; guru tidak bisa mengubah role sendiri
 * Data DEMO tersimpan di browser ini saja dan bukan data sekolah.
 * ========================================================================= */
(function () {
  const KEY = 'sm_demo_db_v2';
  const SKEY = 'sm_demo_session_v2';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now());
  const now = () => new Date().toISOString();
  const OWNED = ['classes', 'subjects', 'students', 'exams', 'exam_questions', 'grades', 'exam_responses', 'publication_settings'];

  const defSettings = (tid, school) => ({ id: uid(), teacher_id: tid, enabled: false, message: '', academic_year: '2026/2027', semester: 'Ganjil', default_kktp: 75, school_name: school || '' });
  const empty = () => ({
    classes: [], subjects: [], students: [], exams: [], exam_questions: [], grades: [], exam_responses: [], publication_settings: [], audit_logs: [],
    profiles: [
      { id: 'demo-admin', role: 'admin', active: true, full_name: 'Admin Sekolah', school_name: 'SMP Contoh (DEMO)', subject: '', email: 'admin.demo@contoh.sch.id', sign_enabled: true, sign_title: 'Guru Mata Pelajaran', sign_place: 'Bandung', sign_nip: '' },
      { id: 'demo-guru-a', role: 'teacher', active: true, full_name: 'Ustadz Fulan (Guru A)', school_name: 'SMP Contoh (DEMO)', subject: 'Bahasa Arab', email: 'guru.a@contoh.sch.id', sign_enabled: true, sign_title: 'Guru Mata Pelajaran', sign_place: 'Bandung', sign_nip: '' },
      { id: 'demo-guru-b', role: 'teacher', active: true, full_name: 'Ibu Siti (Guru B)', school_name: 'SMP Contoh (DEMO)', subject: 'Matematika', email: 'guru.b@contoh.sch.id', sign_enabled: false, sign_title: 'Guru Mata Pelajaran', sign_place: '', sign_nip: '' },
    ],
    portal_settings: [],
    app_settings: { portal_master: true }, // sakelar utama Portal Siswa sekolah (hanya admin)
  });

  function load() {
    try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.profiles) return Object.assign(empty(), d); } catch (e) {}
    const d = empty(); d.profiles.forEach((p) => d.portal_settings.push(defSettings(p.id, p.school_name))); return d;
  }
  function save(db) { localStorage.setItem(KEY, JSON.stringify(db)); }
  function session() { try { return JSON.parse(localStorage.getItem(SKEY)); } catch (e) { return null; } }
  function me(db) {
    const s = session(); if (!s) throw new DbError('Sesi berakhir. Silakan login kembali.', '401');
    const p = db.profiles.find((x) => x.id === s.user.id);
    if (!p || !p.active || !['teacher', 'admin'].includes(p.role)) throw new DbError('Akun tidak aktif atau belum disetujui sebagai guru.', '42501');
    return p;
  }

  const normName = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  const SEM = { Ganjil: 1, Genap: 2 };
  const sortResults = (a, b) => (b.academic_year || '').localeCompare(a.academic_year || '') || (SEM[a.semester] - SEM[b.semester]) || a.subject.localeCompare(b.subject) || (a.date || '').localeCompare(b.date || '');

  class DbError extends Error { constructor(msg, code) { super(msg); this.code = code; } }

  // UNIQUE per guru (sesuai 0003)
  const UNIQUE = {
    students: [['nisn', 'NISN sudah digunakan siswa lain'], ['student_code', 'Kode siswa sudah digunakan'], ['nis', 'NIS sudah digunakan siswa lain']],
    classes: [[['name', 'academic_year'], 'Kelas dengan nama dan tahun pelajaran yang sama sudah ada']],
    subjects: [['name', 'Mata pelajaran sudah ada']],
    grades: [[['exam_id', 'student_id'], 'Nilai untuk siswa ini sudah ada pada penilaian tersebut']],
  };
  function checkUnique(db, table, row, ignoreId) {
    for (const [cols, msg] of (UNIQUE[table] || [])) {
      const c = Array.isArray(cols) ? cols : [cols];
      if (c.some((k) => row[k] === undefined || row[k] === null || row[k] === '')) continue;
      const hit = db[table].find((r) => r.id !== ignoreId && r.teacher_id === row.teacher_id && c.every((k) => String(r[k]).toLowerCase() === String(row[k]).toLowerCase()));
      if (hit) throw new DbError(msg, '23505');
    }
  }
  // relasi harus milik guru yang sama (meniru trigger enforce_owner)
  const FK = {
    students: [['class_id', 'classes', 'Kelas']],
    exams: [['class_id', 'classes', 'Kelas'], ['subject_id', 'subjects', 'Mata pelajaran']],
    exam_questions: [['exam_id', 'exams', 'Ujian/tugas']],
    exam_responses: [['exam_id', 'exams', 'Ujian/tugas']],
    publication_settings: [['exam_id', 'exams', 'Ujian/tugas']],
    grades: [['exam_id', 'exams', 'Penilaian'], ['student_id', 'students', 'Siswa']],
  };
  function checkFK(db, table, row) {
    for (const [col, parent, label] of (FK[table] || [])) {
      if (!row[col]) continue;
      const p = db[parent].find((x) => x.id === row[col]);
      if (!p) throw new DbError(`${label} tidak ditemukan`, '23503');
      if (p.teacher_id !== row.teacher_id) throw new DbError(`${label} bukan milik Anda`, '42501');
    }
  }
  const masterOn = (db) => !db.app_settings || db.app_settings.portal_master !== false;
  const openTeachers = (db) => (masterOn(db) ? db.portal_settings.filter((ps) => ps.enabled && db.profiles.some((p) => p.id === ps.teacher_id && p.active && ['teacher', 'admin'].includes(p.role))).map((ps) => ps.teacher_id) : []);
  const mine = (db, table, id) => { const t = me(db); const r = db[table].find((x) => x.id === id && x.teacher_id === t.id); if (!r) throw new DbError('Data tidak ditemukan', 'PGRST116'); return r; };

  const DemoBackend = {
    mode: 'demo',
    label: 'DEMO',
    async getSession() { await wait(50); return session(); },
    async signIn() { throw new DbError('Supabase belum dikonfigurasi oleh administrator. Gunakan akun DEMO di bawah untuk mencoba.'); },
    demoAccounts() { return load().profiles.map((p) => ({ id: p.id, full_name: p.full_name, email: p.email, role: p.role, active: p.active })); },
    async signInDemo(userId) {
      await wait(350);
      const db = load(); const p = db.profiles.find((x) => x.id === userId);
      if (!p) throw new DbError('Akun tidak ditemukan');
      if (!p.active) throw new DbError('Akun ini dinonaktifkan oleh administrator.');
      if (!['teacher', 'admin'].includes(p.role)) throw new DbError('Akun ini belum disetujui sebagai guru. Hubungi administrator.');
      const s = { user: { id: p.id, email: p.email }, demo: true, at: now() };
      localStorage.setItem(SKEY, JSON.stringify(s)); return s;
    },
    async signOut() { await wait(120); localStorage.removeItem(SKEY); },
    async resetPassword() { throw new DbError('Reset password memerlukan Supabase Auth. Supabase belum dikonfigurasi.'); },
    onAuthChange() { return () => {}; },

    /* ---------- data milik guru yang login (RLS) ---------- */
    async list(table, { order } = {}) {
      await wait(150);
      const db = load(); const t = me(db);
      let rows = (db[table] || []).filter((r) => (OWNED.includes(table) ? r.teacher_id === t.id : table === 'audit_logs' ? r.actor === t.id : true));
      if (order) { const [k, dir] = order; rows.sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (dir === 'desc' ? -1 : 1)); }
      return rows;
    },
    async get(table, id) { await wait(100); return mine(load(), table, id); },
    async insert(table, row) {
      await wait(220);
      const db = load(); const t = me(db);
      const rec = Object.assign({ id: uid(), created_at: now(), updated_at: now() }, row, { teacher_id: t.id });
      checkUnique(db, table, rec); checkFK(db, table, rec);
      db[table].push(rec); save(db); return rec;
    },
    async insertMany(table, rows) {
      await wait(350);
      const db = load(); const t = me(db); const ok = []; const fail = [];
      rows.forEach((row, i) => {
        try { const rec = Object.assign({ id: uid(), created_at: now(), updated_at: now() }, row, { teacher_id: t.id }); checkUnique(db, table, rec); checkFK(db, table, rec); db[table].push(rec); ok.push(rec); }
        catch (e) { fail.push({ index: i, message: e.message }); }
      });
      save(db); return { ok, fail };
    },
    async update(table, id, patch) {
      await wait(200);
      const db = load(); const cur = mine(db, table, id);
      const rec = Object.assign({}, cur, patch, { teacher_id: cur.teacher_id, updated_at: now() });
      checkUnique(db, table, rec, id); checkFK(db, table, rec);
      db[table] = db[table].map((r) => (r.id === id ? rec : r)); save(db); return rec;
    },
    async updateMany(table, ids, patch) {
      await wait(250);
      const db = load(); const t = me(db);
      ids.forEach((id) => { const r = db[table].find((x) => x.id === id && x.teacher_id === t.id); if (r) { const rec = Object.assign({}, r, patch); checkFK(db, table, rec); Object.assign(r, patch, { updated_at: now() }); } });
      save(db); return true;
    },
    async remove(table, id) {
      await wait(200);
      const db = load(); mine(db, table, id);
      if (table === 'classes') {
        if (db.students.some((s) => s.class_id === id)) throw new DbError('Kelas masih memiliki siswa. Pindahkan siswa terlebih dahulu.', '23503');
        if (db.exams.some((s) => s.class_id === id)) throw new DbError('Kelas masih dipakai oleh ujian/tugas/penilaian.', '23503');
      }
      if (table === 'subjects' && db.exams.some((e) => e.subject_id === id)) throw new DbError('Mata pelajaran masih dipakai.', '23503');
      if (table === 'students' && db.grades.some((g) => g.student_id === id)) throw new DbError('Siswa sudah memiliki nilai. Ubah status menjadi nonaktif, atau hapus nilainya terlebih dahulu.', '23503');
      if (table === 'exams') ['exam_questions', 'grades', 'exam_responses', 'publication_settings'].forEach((t) => { db[t] = db[t].filter((q) => q.exam_id !== id); });
      db[table] = db[table].filter((r) => r.id !== id); save(db); return true;
    },
    async replaceQuestions(examId, questions) {
      await wait(300);
      const db = load(); const ex = mine(db, 'exams', examId);
      db.exam_questions = db.exam_questions.filter((q) => q.exam_id !== examId).concat(questions.map((q) => Object.assign({ id: uid(), exam_id: examId, teacher_id: ex.teacher_id, created_at: now(), qtype: 'mc', required: true }, q)));
      ex.question_count = questions.length; ex.updated_at = now();
      save(db); return true;
    },
    async upsertGrade({ exam_id, student_id, score, source, raw_score, note, mc_score, essay_score }) {
      await wait(230);
      const db = load(); const t = me(db);
      checkFK(db, 'grades', { exam_id, student_id, teacher_id: t.id });
      if (score === null || score === undefined || isNaN(score) || score < 0 || score > 100) throw new DbError('Nilai harus 0–100', '23514');
      let g = db.grades.find((x) => x.exam_id === exam_id && x.student_id === student_id && x.teacher_id === t.id);
      const patch = { score, source, updated_at: now() };
      if (raw_score !== undefined) patch.raw_score = raw_score; if (note !== undefined) patch.note = note;
      if (mc_score !== undefined) patch.mc_score = mc_score; if (essay_score !== undefined) patch.essay_score = essay_score;
      if (g) Object.assign(g, patch);
      else { g = Object.assign({ id: uid(), exam_id, student_id, teacher_id: t.id, created_at: now() }, patch); db.grades.push(g); }
      save(db); return g;
    },
    async setGradeNote(exam_id, student_id, note) {
      await wait(200);
      const db = load(); const t = me(db);
      const g = db.grades.find((x) => x.exam_id === exam_id && x.student_id === student_id && x.teacher_id === t.id);
      if (!g) throw new DbError('Isi nilai terlebih dahulu sebelum menambahkan keterangan.');
      g.note = note; g.updated_at = now(); save(db); return g;
    },
    async deleteGrade(exam_id, student_id) {
      await wait(200);
      const db = load(); const t = me(db); db.grades = db.grades.filter((x) => !(x.exam_id === exam_id && x.student_id === student_id && x.teacher_id === t.id)); save(db); return true;
    },
    async saveResponses(examId, responses) {
      await wait(250);
      const db = load(); const ex = mine(db, 'exams', examId);
      responses.forEach((r) => {
        const old = db.exam_responses.find((x) => x.exam_id === examId && x.response_id === r.response_id);
        // meniru trigger keep_review_decision (0005): keputusan guru tidak ditimpa sinkronisasi ulang
        if (old && ['dipilih', 'ditolak'].includes(old.review_status) && !['dipilih', 'ditolak'].includes(r.review_status)) { r = Object.assign({}, r, { review_status: old.review_status, reviewed_at: old.reviewed_at }); }
        if (old) Object.assign(old, r); else db.exam_responses.push(Object.assign({ id: uid(), exam_id: examId, teacher_id: ex.teacher_id, created_at: now() }, r));
      });
      save(db); return true;
    },
    async setResponseReview(examId, responseIds, status) {
      await wait(200);
      if (!['dipilih', 'ditolak'].includes(status)) throw new DbError('Status keputusan tidak valid');
      const db = load(); mine(db, 'exams', examId);
      db.exam_responses.forEach((r) => { if (r.exam_id === examId && responseIds.includes(r.response_id)) { r.review_status = status; r.reviewed_at = now(); } });
      save(db); return true;
    },
    /** DEMO saja: meniru respons yang akan dikembalikan Apps Script v1.3.0 (tidak ada di produksi) */
    async demoFormResponses(examId) {
      await wait(150); const db = load(); const ex = mine(db, 'exams', examId);
      return { ok: true, responses: (db.demo_form_inbox || {})[examId] || [] };
    },
    async setPublication(examId, isPublished) {
      await wait(250);
      const db = load(); const ex = mine(db, 'exams', examId);
      let p = db.publication_settings.find((x) => x.exam_id === examId);
      if (!p) { p = { id: uid(), exam_id: examId, teacher_id: ex.teacher_id }; db.publication_settings.push(p); }
      Object.assign(p, { is_published: isPublished, published_at: isPublished ? now() : null, updated_at: now() });
      save(db); return p;
    },
    async getSettings() {
      await wait(120); const db = load(); const t = me(db);
      let ps = db.portal_settings.find((x) => x.teacher_id === t.id);
      if (!ps) { ps = defSettings(t.id, t.school_name); db.portal_settings.push(ps); save(db); }
      const open = openTeachers(db);
      return { profile: Object.assign({}, t), portal: ps, app: { portal_master: masterOn(db), public_open: open.length > 0, open_teachers: open.length } };
    },
    async setPortalMaster(on) {
      await wait(250); const db = load(); const t = me(db);
      if (t.role !== 'admin') throw new DbError('Hanya administrator yang dapat membuka/menutup Portal Siswa sekolah.', '42501');
      db.app_settings = Object.assign({}, db.app_settings, { portal_master: !!on, updated_at: now() }); save(db); return db.app_settings;
    },
    async saveProfile(patch) {
      await wait(220); const db = load(); const t = me(db);
      const safe = Object.assign({}, patch); delete safe.role; delete safe.active; delete safe.email; delete safe.id; // trigger protect_profile_columns
      Object.assign(t, safe, { updated_at: now() }); save(db); return t;
    },
    async savePortalSettings(patch) {
      await wait(220); const db = load(); const t = me(db);
      const ps = db.portal_settings.find((x) => x.teacher_id === t.id); Object.assign(ps, patch, { teacher_id: t.id, updated_at: now() }); save(db); return ps;
    },
    async audit(action, entity, entity_id, detail) { try { const db = load(); const t = me(db); db.audit_logs.unshift({ id: uid(), action, entity, entity_id, detail, created_at: now(), actor: t.id }); db.audit_logs = db.audit_logs.slice(0, 500); save(db); } catch (e) {} },

    /* ---------- MANAJEMEN AKUN GURU (hanya admin) ---------- */
    async listTeachers() {
      await wait(200); const db = load(); const t = me(db);
      if (t.role !== 'admin') throw new DbError('Hanya administrator yang dapat mengelola akun guru.', '42501');
      return db.profiles.map((p) => ({ id: p.id, email: p.email, full_name: p.full_name, role: p.role, active: p.active, created_at: p.created_at,
        counts: { classes: db.classes.filter((x) => x.teacher_id === p.id).length, students: db.students.filter((x) => x.teacher_id === p.id).length, exams: db.exams.filter((x) => x.teacher_id === p.id).length } }));
    },
    async createTeacher({ email, full_name, role, password }) {
      await wait(400); const db = load(); const t = me(db);
      if (t.role !== 'admin') throw new DbError('Hanya administrator.', '42501');
      if (db.profiles.some((p) => p.email.toLowerCase() === email.toLowerCase())) throw new DbError('Email sudah terdaftar.', '23505');
      const p = { id: uid(), email, full_name, role: role === 'admin' ? 'admin' : 'teacher', active: true, school_name: t.school_name, subject: '', created_at: now(), sign_enabled: false, sign_title: 'Guru Mata Pelajaran', sign_place: '', sign_nip: '' };
      db.profiles.push(p); db.portal_settings.push(defSettings(p.id, p.school_name)); save(db); return p;
    },
    async updateTeacher(id, patch) {
      await wait(300); const db = load(); const t = me(db);
      if (t.role !== 'admin') throw new DbError('Hanya administrator.', '42501');
      if (id === t.id && (patch.role === 'teacher' || patch.active === false)) throw new DbError('Anda tidak dapat menurunkan role atau menonaktifkan akun Anda sendiri.');
      const p = db.profiles.find((x) => x.id === id); if (!p) throw new DbError('Akun tidak ditemukan');
      ['full_name', 'role', 'active'].forEach((k) => { if (patch[k] !== undefined) p[k] = patch[k]; });
      save(db); return p;
    },
    async deleteTeacher(id) {
      await wait(300); const db = load(); const t = me(db);
      if (t.role !== 'admin') throw new DbError('Hanya administrator.', '42501');
      if (id === t.id) throw new DbError('Anda tidak dapat menghapus akun Anda sendiri.');
      const n = OWNED.reduce((a, k) => a + db[k].filter((x) => x.teacher_id === id).length, 0);
      if (n > 0) throw new DbError(`Akun ini masih memiliki ${n} data (kelas, siswa, nilai, dll). Nonaktifkan akun saja agar data tetap aman.`);
      db.profiles = db.profiles.filter((x) => x.id !== id); db.portal_settings = db.portal_settings.filter((x) => x.teacher_id !== id); save(db); return true;
    },

    /* ---------- PUBLIC (tanpa login) — meniru get_portal_status & portal_lookup 0003 ---------- */
    async getPortalStatus() {
      await wait(180); const db = load();
      const open = openTeachers(db);
      const classes = [...new Set(db.classes.filter((c) => open.includes(c.teacher_id)).map((c) => c.name))].sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
      const school = (db.portal_settings.find((ps) => open.includes(ps.teacher_id) && ps.school_name) || {}).school_name || '';
      const message = [...new Set(db.portal_settings.filter((ps) => open.includes(ps.teacher_id) && ps.message).map((ps) => ps.message))].join(' • ');
      const ref = db.portal_settings.find((ps) => open.includes(ps.teacher_id)) || {};
      return { enabled: open.length > 0, master: masterOn(db), message: masterOn(db) ? message : '', school_name: school, classes, academic_year: ref.academic_year || '', semester: ref.semester || '' };
    },
    async portalLookup(className, name) {
      await wait(400);
      const db = load();
      const open = openTeachers(db);
      if (!open.length) return { ok: false, reason: 'closed' };
      const nn = normName(name); const nc = normName(className);
      if (!nc || nn.length < 2) return { ok: false, reason: 'not_found' };
      const matches = db.students.filter((s) => s.status === 'aktif' && open.includes(s.teacher_id) && normName(s.full_name) === nn && (() => { const c = db.classes.find((x) => x.id === s.class_id); return c && c.teacher_id === s.teacher_id && normName(c.name) === nc; })());
      if (!matches.length) return { ok: false, reason: 'not_found' };
      const dupBy = {}; matches.forEach((s) => { dupBy[s.teacher_id] = (dupBy[s.teacher_id] || 0) + 1; });
      const students = matches.map((s) => {
        const cls = db.classes.find((c) => c.id === s.class_id); const tch = db.profiles.find((p) => p.id === s.teacher_id);
        const pub = new Set(db.publication_settings.filter((x) => x.is_published && x.teacher_id === s.teacher_id).map((x) => x.exam_id));
        const results = db.grades.filter((g) => g.student_id === s.id && g.teacher_id === s.teacher_id && pub.has(g.exam_id)).map((g) => {
          const e = db.exams.find((x) => x.id === g.exam_id); const sub = db.subjects.find((x) => x.id === e.subject_id);
          return { exam_name: e.name, kind: e.kind || 'ujian', exam_type: e.category || e.task_type || e.exam_type, subject: sub ? sub.name : '-', teacher: tch ? tch.full_name : '', score: g.score, kktp: e.kktp, passed: g.score >= e.kktp, academic_year: e.academic_year, semester: e.semester, date: e.date };
        }).sort(sortResults);
        return { full_name: s.full_name, class_name: cls.name, hint: dupBy[s.teacher_id] > 1 ? (s.nis ? 'NIS •••' + String(s.nis).slice(-2) : 'Kode •••' + String(s.student_code).slice(-2)) : '', results };
      });
      return { ok: true, students };
    },

    /* ---------- DEMO helpers ---------- */
    async resetDemo() { await wait(200); localStorage.removeItem(KEY); },
    async seedDemo() {
      await wait(400);
      const db = load();
      OWNED.concat(['audit_logs']).forEach((k) => { db[k] = []; });
      const mk = (tid, o) => Object.assign({ id: uid(), teacher_id: tid, created_at: now(), updated_at: now() }, o);
      const A = 'demo-guru-a', B = 'demo-guru-b';
      db.portal_settings.forEach((ps) => { if (ps.teacher_id === A || ps.teacher_id === B) Object.assign(ps, { enabled: true, school_name: 'SMP Contoh (DEMO)' }); });
      // ===== Guru A: Bahasa Arab =====
      const c81 = mk(A, { name: 'VIII.1', grade: '8', academic_year: '2026/2027' });
      const c7a = mk(A, { name: 'VII-A', grade: '7', academic_year: '2026/2027' });
      db.classes.push(c81, c7a);
      const sAr = mk(A, { name: 'Bahasa Arab', code: 'BAR' }); db.subjects.push(sAr);
      const namesA = ['Ahmad Fauzi', 'Balqis Zahra', 'Bilal Ramadhan', 'Fatimah Azzahra', 'Hasan Hidayat', 'Khadijah Putri', 'Umar Firmansyah', 'Zainab Lestari', 'Yusuf Saputra', 'Maryam Wulandari'];
      const stA = namesA.map((n, i) => mk(A, { nisn: null, nis: String(2601 + i), full_name: n, class_id: c81.id, student_code: 'A' + String(i + 1).padStart(3, '0'), status: 'aktif' }));
      const st7 = ['Ali Pratama', 'Salma Nurhaliza', 'Hamzah Ramadhan', 'Nadia Azzahra', 'Ilyas Hidayat', 'Rania Putri'].map((n, i) => mk(A, { nis: String(2701 + i), full_name: n, class_id: c7a.id, student_code: 'A7' + String(i + 1).padStart(2, '0'), status: 'aktif' }));
      db.students.push(...stA, ...st7);
      const base = { subject_id: sAr.id, class_id: c81.id, semester: 'Ganjil', academic_year: '2026/2027', kktp: 75, max_score: 100, question_count: 0 };
      const acts = [
        mk(A, Object.assign({}, base, { kind: 'tugas', delivery: 'manual', name: 'Tugas 1 — Menulis Mufradat', task_type: 'Tugas menulis', exam_type: 'Tugas', date: '2026-08-05', start_date: '2026-08-05', due_date: '2026-08-12', status: 'selesai', description: 'Menulis 20 mufradat bab 1 beserta artinya.', instructions: 'Tulis di buku tulis, foto, dan kumpulkan ke guru.' })),
        mk(A, Object.assign({}, base, { kind: 'manual', delivery: 'manual', name: 'Hafalan Surah Al-Mulk 1–10', category: 'Hafalan', exam_type: 'Hafalan', date: '2026-08-20', status: 'selesai' })),
        mk(A, Object.assign({}, base, { kind: 'tugas', delivery: 'manual', name: 'Tugas 2 — Membaca Teks', task_type: 'Tugas membaca', exam_type: 'Tugas', date: '2026-09-02', start_date: '2026-09-02', due_date: '2026-09-09', status: 'selesai' })),
        mk(A, Object.assign({}, base, { kind: 'ujian', delivery: 'google_form', name: 'Ujian Harian Bab 1', exam_type: 'Penilaian Harian', date: '2026-09-10', status: 'selesai' })),
        mk(A, Object.assign({}, base, { kind: 'manual', delivery: 'manual', name: 'Praktik Muhadatsah', category: 'Praktik', exam_type: 'Praktik', date: '2026-09-25', status: 'selesai' })),
        mk(A, Object.assign({}, base, { kind: 'ujian', delivery: 'google_form', name: 'Sumatif Bahasa Arab', exam_type: 'Asesmen Sumatif', date: '2026-10-20', status: 'selesai' })),
        mk(A, Object.assign({}, base, { kind: 'tugas', delivery: 'google_form', name: 'Tugas 3 — Kuis Qawaid (PG + Essay)', task_type: 'Tugas individu', exam_type: 'Tugas', date: '2026-11-03', start_date: '2026-11-03', due_date: '2026-11-14', status: 'aktif', description: 'Kuis daring: 3 soal pilihan ganda dan 1 essay.' })),
      ];
      db.exams.push(...acts);
      // nilai deterministik: tren naik untuk Ahmad Fauzi (70, 78, 80, 75, 88, 85)
      const trend = { 'Ahmad Fauzi': [70, 78, 80, 75, 88, 85], 'Balqis Zahra': [65, 72, 68, 70, 74, 70] };
      let seed = 11; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      acts.slice(0, 6).forEach((e, ei) => stA.forEach((s, si) => {
        if (ei === 2 && si === 9) return; // belum mengumpulkan
        const sc = trend[s.full_name] ? trend[s.full_name][ei] : Math.round(60 + rnd() * 38 + ei * 1.5);
        db.grades.push(mk(A, { exam_id: e.id, student_id: s.id, score: Math.min(100, sc), raw_score: Math.min(100, sc), source: e.delivery === 'google_form' ? 'google_forms' : 'manual', note: si === 3 && ei === 1 ? 'Lancar, tajwid baik' : null }));
      }));
      // soal tugas 3 (PG + essay)
      const t3 = acts[6];
      [['ما معنى «مَدْرَسَةٌ»؟', { A: 'Sekolah', B: 'Rumah', C: 'Masjid', D: 'Pasar' }, 'A', 20], ['Jamak dari «كِتَابٌ» adalah…', { A: 'كُتُبٌ', B: 'كَاتِبٌ', C: 'مَكْتَبٌ', D: 'كِتَابَةٌ' }, 'A', 20], ['«أَنَا طَالِبٌ» artinya…', { A: 'Saya guru', B: 'Saya siswa', C: 'Dia siswa', D: 'Kamu siswa' }, 'B', 20]]
        .forEach((q, i) => db.exam_questions.push(mk(A, { exam_id: t3.id, number: i + 1, question: q[0], qtype: 'mc', options: q[1], answer_key: q[2], points: q[3], required: true })));
      db.exam_questions.push(mk(A, { exam_id: t3.id, number: 4, question: 'Tuliskan perkenalan diri dalam bahasa Arab minimal 3 kalimat.', qtype: 'essay', options: null, answer_key: null, points: 40, required: true }));
      t3.question_count = 4; t3.google_form_id = null;
      // respons contoh tugas 3 (seolah dari sinkronisasi) — essay belum dinilai
      stA.slice(0, 4).forEach((s, i) => db.exam_responses.push(mk(A, { exam_id: t3.id, response_id: 'demo-resp-' + i, student_id: s.id, identifier: s.full_name + ' (' + s.student_code + ')', submitted_at: '2026-11-0' + (4 + i) + 'T08:00:00Z', mc_score: [60, 40, 60, 20][i], mc_max: 60, essay_max: 40, raw_score: [60, 40, 60, 20][i], max_score: 100, answers: { 4: ['اِسْمِي أَحْمَدُ. أَنَا طَالِبٌ. أَسْكُنُ فِي بَانْدُونْج.', 'اِسْمِي بَلْقِيس. أَنَا طَالِبَةٌ.', 'اِسْمِي بِلَال...', 'أَنَا...'][i] } })));
      // satu essay sudah dinilai → nilai akhir tersimpan
      db.grades.push(mk(A, { exam_id: t3.id, student_id: stA[0].id, score: 92, raw_score: 92, mc_score: 60, essay_score: 32, source: 'google_forms', note: 'Kalimat sudah tepat, perbaiki harakat.' }));
      // ===== Simulasi Google Form v1.3.0 (DEMO) untuk menguji deteksi konflik =====
      // Ujian Harian Bab 1 (acts[3]) sudah punya nilai → kirimannya disimpan sebagai respons lama (v1.2.0, tanpa email)
      // Kuis Tajwid baru (PG saja) dengan form terkunci + kiriman bermasalah di "inbox" form
      const kz = mk(A, Object.assign({}, base, { kind: 'ujian', delivery: 'google_form', name: 'Kuis Tajwid (Form v1.3.0)', exam_type: 'Penilaian Harian', date: '2026-11-06', status: 'aktif', question_count: 2,
        google_form_id: 'demo-form-kuis', google_form_url: 'https://docs.google.com/forms/d/e/DEMO-tidak-nyata/viewform', google_form_created_at: now(),
        google_form_security: { requireLogin: false, limitOne: true, emailCollected: true, emailType: 'VERIFIED', loginEnforced: true, restrictDomainRequested: false, errors: [] } }));
      db.exams.push(kz);
      [['Hukum nun mati bertemu ب adalah…', { A: 'Iqlab', B: 'Idgham', C: 'Izhar', D: 'Ikhfa' }, 'A'], ['Mad thabi\'i panjangnya…', { A: '1 harakat', B: '2 harakat', C: '4 harakat', D: '6 harakat' }, 'B']]
        .forEach((q, i) => db.exam_questions.push(mk(A, { exam_id: kz.id, number: i + 1, question: q[0], qtype: 'mc', options: q[1], answer_key: q[2], points: 50, required: true })));
      const lbl = (s) => s.full_name + ' (' + s.student_code + ')';
      const R = (id, s, email, t, sc) => ({ response_id: id, submitted_at: '2026-11-06T0' + t + ':00:00.000Z', identifier: lbl(s), name: '', email, score: sc, mc_score: sc, mc_max: 100, essay_max: 0, max_score: 100, answers: {} });
      // Hasan sudah dinilai manual sebelumnya → kiriman baru = konflik_nilai_lama
      db.grades.push(mk(A, { exam_id: kz.id, student_id: stA[4].id, score: 60, raw_score: 60, source: 'manual', note: 'Susulan lisan' }));
      db.demo_form_inbox = { [kz.id]: [
        R('dr-1', stA[0], 'ahmad.fauzi@gmail.com', 1, 100),           // ok
        R('dr-2', stA[1], 'balqis.z@smpcontoh.sch.id', 1, 50),       // nama_ganda (Balqis dipilih dua akun)
        R('dr-3', stA[1], 'temanjail123@gmail.com', 2, 100),         // nama_ganda — dikirim BELAKANGAN tapi skor lebih tinggi
        R('dr-4', stA[2], 'bilal.r@gmail.com', 2, 50),               // akun_multi_nama (akun sama memilih Bilal & Fatimah)
        R('dr-5', stA[3], 'bilal.r@gmail.com', 3, 100),              // akun_multi_nama
        R('dr-6', stA[4], 'hasan.h@gmail.com', 3, 100),              // konflik_nilai_lama
        R('dr-7', stA[5], 'khadijah.p@gmail.com', 4, 50),            // ok
      ] };
      // publikasi
      [acts[5], acts[3], acts[1]].forEach((e) => db.publication_settings.push(mk(A, { exam_id: e.id, is_published: true, published_at: now() })));
      acts.forEach((e) => { if (!db.publication_settings.some((p) => p.exam_id === e.id)) db.publication_settings.push(mk(A, { exam_id: e.id, is_published: false })); });
      // ===== Guru B: Matematika — punya kelas bernama SAMA "VIII.1" dan siswa bernama sama =====
      const b81 = mk(B, { name: 'VIII.1', grade: '8', academic_year: '2026/2027' }); db.classes.push(b81);
      const sMt = mk(B, { name: 'Matematika', code: 'MTK' }); db.subjects.push(sMt);
      const bAhmad = mk(B, { nis: '9001', full_name: 'Ahmad Fauzi', class_id: b81.id, student_code: 'B001', status: 'aktif' });
      const bDewi = mk(B, { nis: '9002', full_name: 'Dewi Kartika', class_id: b81.id, student_code: 'B002', status: 'aktif' });
      db.students.push(bAhmad, bDewi);
      const bEx = mk(B, { kind: 'ujian', delivery: 'manual', name: 'PTS Matematika', subject_id: sMt.id, class_id: b81.id, semester: 'Ganjil', academic_year: '2026/2027', exam_type: 'PTS', date: '2026-10-08', kktp: 70, max_score: 100, status: 'selesai', question_count: 0 });
      const bEx2 = mk(B, { kind: 'manual', delivery: 'manual', name: 'Keaktifan Kelas', category: 'Keaktifan', subject_id: sMt.id, class_id: b81.id, semester: 'Ganjil', academic_year: '2026/2027', exam_type: 'Keaktifan', date: '2026-10-15', kktp: 70, max_score: 100, status: 'selesai', question_count: 0 });
      db.exams.push(bEx, bEx2);
      db.grades.push(mk(B, { exam_id: bEx.id, student_id: bAhmad.id, score: 78, raw_score: 78, source: 'manual' }), mk(B, { exam_id: bEx.id, student_id: bDewi.id, score: 66, raw_score: 66, source: 'manual' }), mk(B, { exam_id: bEx2.id, student_id: bAhmad.id, score: 90, raw_score: 90, source: 'manual' }));
      db.publication_settings.push(mk(B, { exam_id: bEx.id, is_published: true, published_at: now() }), mk(B, { exam_id: bEx2.id, is_published: false }));
      save(db);
    },
  };

  window.DemoBackend = DemoBackend;
  window.DbError = DbError;
})();
