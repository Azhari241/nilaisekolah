/* =========================================================================
 * Klien integrasi Google Forms melalui Google Apps Script Web App milik guru.
 * Script ada di google-apps-script/Code.gs. Komunikasi: POST text/plain JSON
 * (tanpa preflight CORS). Setiap request membawa token rahasia yang dicek script.
 * Tidak ada link/form palsu: semua URL berasal dari respons Google.
 * ========================================================================= */
(function () {
  async function call(cfg, action, payload) {
    if (!cfg || !cfg.google_script_url) throw new Error('Google Forms belum terhubung. Buka Pengaturan → Google Forms.');
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(cfg.google_script_url.trim()))
      throw new Error('URL Web App tidak valid. Format: https://script.google.com/macros/s/…/exec');
    let res;
    try {
      res = await fetch(cfg.google_script_url.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action, token: cfg.google_token || '' }, payload || {})),
        redirect: 'follow',
      });
    } catch (e) {
      throw new Error('Tidak dapat menghubungi Apps Script. Pastikan deployment "Who has access: Anyone" dan URL benar.');
    }
    let data;
    try { data = await res.json(); } catch (e) { throw new Error('Respons Apps Script tidak valid (bukan JSON). Periksa deployment.'); }
    if (!data.ok) throw new Error(data.error || 'Apps Script mengembalikan kesalahan.');
    return data;
  }

  window.GoogleForms = {
    /** Uji koneksi: script membalas versi dan email pemilik. */
    ping: (cfg) => call(cfg, 'ping'),
    /** Buat Google Form kuis lengkap dengan soal, kunci, poin, dan field identitas. */
    /** v1.3.0: mengembalikan juga 'security' (apa yang BENAR-BENAR aktif di form). dueDate kini ikut dikirim (sebelumnya terbuang). */
    createForm: (cfg, { title, description, questions, identity, dueDate, restrictDomain }) => call(cfg, 'createForm', { title, description, questions, identity, dueDate: dueDate || null, restrictDomain: restrictDomain === true }),
    /** Ambil seluruh respons: [{response_id, submitted_at, identifier, name, email (v1.3.0, boleh kosong), score, mc_score, mc_max, essay_max, max_score, answers}] */
    getResponses: (cfg, formId) => call(cfg, 'getResponses', { formId }),
  };
})();
