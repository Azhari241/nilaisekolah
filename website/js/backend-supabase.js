/* =========================================================================
 * SUPABASE BACKEND — produksi. Menggunakan supabase-js v2 (anon/publishable key).
 * Seluruh akses dilindungi RLS (lihat supabase/migrations/0001_init.sql).
 * Portal siswa memanggil fungsi SECURITY DEFINER `portal_lookup` sehingga
 * browser tidak pernah membaca tabel students/grades secara langsung.
 * ========================================================================= */
(function () {
  function makeSupabaseBackend(url, key) {
    if (!window.supabase || !window.supabase.createClient) throw new Error('Library supabase-js gagal dimuat.');
    const sb = window.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
    const fail = (error) => {
      if (!error) return;
      let msg = error.message || 'Terjadi kesalahan database';
      if (error.code === '23505') {
        if (/nisn/i.test(msg)) msg = 'NISN sudah digunakan siswa lain';
        else if (/student_code/i.test(msg)) msg = 'Kode siswa sudah digunakan';
        else if (/nis/i.test(msg)) msg = 'NIS sudah digunakan siswa lain';
        else if (/classes/i.test(msg)) msg = 'Kelas dengan nama dan tahun pelajaran yang sama sudah ada';
        else msg = 'Data duplikat: ' + msg;
      }
      if (error.code === '23503') msg = 'Data masih direferensikan oleh data lain (misal: siswa, ujian, atau nilai). ' + (error.details || '');
      if (error.code === '42501') msg = 'Akses ditolak oleh Row Level Security. Pastikan akun Anda terdaftar sebagai guru.';
      const e = new Error(msg); e.code = error.code; throw e;
    };

    return {
      mode: 'supabase',
      label: 'Supabase',
      client: sb,
      async ping() {
        const t = performance.now();
        const { error } = await sb.from('profiles').select('id').limit(1);
        if (error) fail(error);
        return Math.round(performance.now() - t);
      },
      async getSession() { const { data, error } = await sb.auth.getSession(); if (error) fail(error); return data.session; },
      async signIn(email, password) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) {
          const m = /invalid login/i.test(error.message) ? 'Email atau password salah.' : /email not confirmed/i.test(error.message) ? 'Email belum dikonfirmasi. Periksa kotak masuk Anda.' : error.message;
          throw new Error(m);
        }
        // pastikan akun ini guru (ada baris di profiles dengan role teacher)
        const { data: prof } = await sb.from('profiles').select('id, role, active').eq('id', data.user.id).maybeSingle();
        if (!prof) { await sb.auth.signOut(); throw new Error('Profil guru untuk akun ini belum ada di database. Hubungi administrator.'); }
        if (prof.active === false) { await sb.auth.signOut(); throw new Error('Akun ini dinonaktifkan oleh administrator.'); }
        if (!['teacher', 'admin'].includes(prof.role)) { await sb.auth.signOut(); throw new Error('Akun ini belum disetujui sebagai guru. Hubungi administrator.'); }
        return data.session;
      },
      async signOut() { await sb.auth.signOut(); },
      async resetPassword(email) {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + '#/login' });
        if (error) fail(error); return true;
      },
      onAuthChange(cb) { const { data } = sb.auth.onAuthStateChange((_e, s) => cb(s)); return () => data.subscription.unsubscribe(); },

      // Supabase/PostgREST membatasi baris per request (default max_rows = 1000). Ambil per halaman
      // agar data besar (mis. ribuan nilai) tidak terpotong diam-diam.
      async list(table, { order } = {}) {
        const PAGE = 1000; const out = [];
        for (let from = 0; from < 200000; from += PAGE) {
          let q = sb.from(table).select('*');
          q = order ? q.order(order[0], { ascending: order[1] !== 'desc' }) : q.order('id', { ascending: true });
          const { data, error } = await q.range(from, from + PAGE - 1);
          if (error) fail(error);
          out.push(...data);
          if (data.length < PAGE) break;
        }
        return out;
      },
      async get(table, id) { const { data, error } = await sb.from(table).select('*').eq('id', id).single(); if (error) fail(error); return data; },
      async insert(table, row) { const { data, error } = await sb.from(table).insert(row).select().single(); if (error) fail(error); return data; },
      async insertMany(table, rows) {
        const ok = []; const fails = [];
        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200);
          const { data, error } = await sb.from(table).insert(chunk).select();
          if (!error) { ok.push(...data); continue; }
          // fallback baris per baris agar tahu baris mana yang gagal
          for (let j = 0; j < chunk.length; j++) {
            const r = await sb.from(table).insert(chunk[j]).select().single();
            if (r.error) { try { fail(r.error); } catch (e) { fails.push({ index: i + j, message: e.message }); } }
            else ok.push(r.data);
          }
        }
        return { ok, fail: fails };
      },
      async update(table, id, patch) { const { data, error } = await sb.from(table).update(patch).eq('id', id).select().single(); if (error) fail(error); return data; },
      async updateMany(table, ids, patch) { const { error } = await sb.from(table).update(patch).in('id', ids); if (error) fail(error); return true; },
      async remove(table, id) { const { error } = await sb.from(table).delete().eq('id', id); if (error) fail(error); return true; },
      async replaceQuestions(examId, questions) {
        const { error } = await sb.rpc('replace_exam_questions', { p_exam_id: examId, p_questions: questions });
        if (error) fail(error); return true;
      },
      async upsertGrade({ exam_id, student_id, score, source, raw_score, note, mc_score, essay_score }) {
        const row = { exam_id, student_id, score, source };
        if (raw_score !== undefined) row.raw_score = raw_score; if (note !== undefined) row.note = note;
        if (mc_score !== undefined) row.mc_score = mc_score; if (essay_score !== undefined) row.essay_score = essay_score;
        const { data, error } = await sb.from('grades').upsert(row, { onConflict: 'exam_id,student_id' }).select().single();
        if (error) fail(error); return data;
      },
      async setGradeNote(exam_id, student_id, note) {
        const { data, error } = await sb.from('grades').update({ note }).eq('exam_id', exam_id).eq('student_id', student_id).select().maybeSingle();
        if (error) fail(error); if (!data) throw new Error('Isi nilai terlebih dahulu sebelum menambahkan keterangan.'); return data;
      },
      async deleteGrade(exam_id, student_id) { const { error } = await sb.from('grades').delete().eq('exam_id', exam_id).eq('student_id', student_id); if (error) fail(error); return true; },
      async saveResponses(examId, responses) {
        if (!responses.length) return true;
        const { error } = await sb.from('exam_responses').upsert(responses.map((r) => Object.assign({ exam_id: examId }, r)), { onConflict: 'exam_id,response_id' });
        if (error) fail(error); return true; // keputusan guru dilindungi trigger keep_review_decision (0005)
      },
      async setResponseReview(examId, responseIds, status) {
        if (!['dipilih', 'ditolak'].includes(status)) throw new Error('Status keputusan tidak valid');
        if (!responseIds.length) return true;
        const { error } = await sb.from('exam_responses').update({ review_status: status, reviewed_at: new Date().toISOString() }).eq('exam_id', examId).in('response_id', responseIds);
        if (error) fail(error); return true;
      },
      async setPublication(examId, isPublished) {
        const { data, error } = await sb.from('publication_settings').upsert({ exam_id: examId, is_published: isPublished, published_at: isPublished ? new Date().toISOString() : null }, { onConflict: 'exam_id' }).select().single();
        if (error) fail(error); return data;
      },
      async getSettings() {
        const { data: s } = await sb.auth.getSession();
        const [p, ps] = await Promise.all([
          sb.from('profiles').select('*').eq('id', s.session.user.id).single(),
          sb.from('portal_settings').select('*').eq('teacher_id', s.session.user.id).maybeSingle(),
        ]);
        if (p.error) fail(p.error); if (ps.error) fail(ps.error);
        if (!ps.data) throw new Error('Pengaturan guru belum dibuat. Minta administrator menjalankan migrasi 0003.');
        const st = await sb.rpc('get_portal_status');
        const app = { portal_master: st.data ? st.data.master !== false : true, public_open: !!(st.data && st.data.enabled), open_teachers: st.data ? st.data.open_teachers || 0 : 0 };
        return { profile: Object.assign({ email: s.session.user.email }, p.data), portal: ps.data, app };
      },
      async saveProfile(patch) {
        const { data: s } = await sb.auth.getSession();
        const { data, error } = await sb.from('profiles').update(patch).eq('id', s.session.user.id).select().single(); if (error) fail(error); return data;
      },
      async savePortalSettings(patch) {
        const { data: s } = await sb.auth.getSession();
        const { data, error } = await sb.from('portal_settings').update(patch).eq('teacher_id', s.session.user.id).select().single(); if (error) fail(error); return data;
      },
      async setPortalMaster(on) {
        const { data, error } = await sb.from('app_settings').update({ portal_master: !!on }).eq('id', 1).select().single();
        if (error) fail(error); if (!data) throw new Error('Hanya administrator yang dapat membuka/menutup Portal Siswa sekolah.'); return data;
      },
      // ---- Manajemen akun guru: lewat Edge Function "admin-teachers" (service role HANYA di server) ----
      async _admin(action, payload) {
        const { data, error } = await sb.functions.invoke('admin-teachers', { body: Object.assign({ action }, payload || {}) });
        if (error) { let m = error.message; try { const j = await error.context.json(); m = j.error || m; } catch (e) {} throw new Error(/not found|404/i.test(m) ? 'Edge Function "admin-teachers" belum di-deploy. Lihat panduan di README.' : m); }
        if (data && data.error) throw new Error(data.error); return data;
      },
      async listTeachers() { return (await this._admin('list')).teachers; },
      async createTeacher(p) { return (await this._admin('create', p)).teacher; },
      async updateTeacher(id, patch) { return (await this._admin('update', { id, patch })).teacher; },
      async deleteTeacher(id) { return (await this._admin('delete', { id })).ok; },
      async audit(action, entity, entity_id, detail) { await sb.from('audit_logs').insert({ action, entity, entity_id: entity_id ? String(entity_id) : null, detail }); },

      async getPortalStatus() { const { data, error } = await sb.rpc('get_portal_status'); if (error) fail(error); return data; },
      async portalLookup(className, name) {
        const { data, error } = await sb.rpc('portal_lookup', { p_class_name: className, p_name: name });
        if (error) fail(error); return data;
      },
    };
  }
  window.makeSupabaseBackend = makeSupabaseBackend;
})();
