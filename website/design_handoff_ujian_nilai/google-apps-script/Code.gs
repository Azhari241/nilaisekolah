/**
 * SISTEM MANAJEMEN UJIAN & NILAI — Integrasi Google Forms
 * Deploy sebagai Web App: Execute as = Me, Who has access = Anyone.
 * Wajib: Script Properties → SECRET_TOKEN (sama dengan token di Pengaturan → Google Forms).
 *
 * Aksi:
 *   ping          → { ok, version, owner, time }
 *   createForm    → { ok, formId, responderUrl, editUrl, security:{requireLogin, limitOne, emailCollected, errors[]} }
 *   getResponses  → { ok, responses: [{response_id, submitted_at, identifier, name, email, score, mc_score, mc_max, essay_max, max_score, answers}] }
 *
 * v1.3.0: form mewajibkan login Google + satu kiriman per akun + mengumpulkan email responden.
 * Email HANYA untuk audit/deteksi konflik. Pencocokan siswa tetap memakai dropdown "Nama (KODE)".
 */
var VERSION = '1.3.0';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    var secret = PropertiesService.getScriptProperties().getProperty('SECRET_TOKEN');
    if (!secret) return json_({ ok: false, error: 'SECRET_TOKEN belum diatur di Script Properties.' });
    if (body.token !== secret) return json_({ ok: false, error: 'Token tidak valid.' });
    switch (body.action) {
      case 'ping': return json_({ ok: true, version: VERSION, owner: Session.getEffectiveUser().getEmail(), time: new Date().toISOString() });
      case 'createForm': return json_(createForm_(body));
      case 'getResponses': return json_(getResponses_(body.formId));
      default: return json_({ ok: false, error: 'Aksi tidak dikenal: ' + body.action });
    }
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}
function doGet() { return json_({ ok: false, error: 'Gunakan POST.' }); }

function createForm_(b) {
  if (!b.questions || !b.questions.length) throw new Error('Tidak ada soal.');
  if (b.questions.length > 200) throw new Error('Maksimal 200 soal per form.');
  var form = FormApp.create(b.title || 'Ujian');
  form.setIsQuiz(true)
      .setDescription(b.description || '')
      .setShuffleQuestions(false)
      .setShowLinkToRespondAgain(false)
      .setPublishingSummary(false);
  var security = applySecurity_(form, b.restrictDomain === true); // default: semua akun Google boleh (Gmail & sekolah)

  var id = b.identity || {};
  var idTitle = id.idLabel || 'Nama Siswa';
  var nameTitle = '';
  if (id.roster && id.roster.length) {
    // Dropdown nama siswa kelas ini, label "Nama (KODE)" → dicocokkan ke student_id saat sinkronisasi
    form.addListItem().setTitle(idTitle).setRequired(true)
      .setChoiceValues(id.roster.map(function (r) { return r.label; }));
  } else {
    form.addTextItem().setTitle(idTitle).setRequired(true);
  }

  var map = {}; // itemId → nomor soal (untuk membaca jawaban essay)
  b.questions.sort(function (x, y) { return x.number - y.number; }).forEach(function (q) {
    var title = q.number + '. ' + q.question;
    if (q.qtype === 'essay') {
      // Essay: tanpa kunci → tidak dinilai otomatis; guru menilai di website
      var it = form.addParagraphTextItem().setTitle(title).setRequired(q.required !== false).setPoints(Number(q.points) || 1);
      map[it.getId()] = { n: q.number, t: 'essay', p: Number(q.points) || 1 };
      return;
    }
    var item = form.addMultipleChoiceItem();
    item.setTitle(title).setRequired(q.required !== false).setPoints(Number(q.points) || 1);
    var choices = ['A', 'B', 'C', 'D', 'E'].filter(function (k) { return q.options && q.options[k]; }).map(function (k) {
      return item.createChoice(k + '. ' + q.options[k], k === q.answer_key);
    });
    item.setChoices(choices);
    map[item.getId()] = { n: q.number, t: 'mc', p: Number(q.points) || 1 };
  });

  PropertiesService.getScriptProperties().setProperty('form_' + form.getId(), JSON.stringify({ idTitle: idTitle, nameTitle: nameTitle, map: map, due: b.dueDate || null }));
  return { ok: true, formId: form.getId(), responderUrl: form.getPublishedUrl(), editUrl: form.getEditUrl(), security: security };
}

/**
 * Terapkan pengamanan satu per satu (masing-masing try/catch) lalu BACA KEMBALI nilainya
 * dari form, sehingga laporan jujur: true hanya jika benar-benar aktif.
 *  - setRequireLogin(true): fitur Google Workspace = hanya akun DOMAIN yang sama. Pada akun Gmail
 *    biasa biasanya gagal/tidak berlaku. Pada Workspace, akun Gmail pribadi siswa akan DITOLAK.
 *  - setLimitOneResponsePerUser(true): memaksa responden login akun Google (Gmail/sekolah) dan
 *    membatasi satu kiriman per akun.
 *  - Email responden: VERIFIED (email akun yang login) bila tersedia, jika tidak setCollectEmail(true).
 */
function applySecurity_(form, restrictDomain) {
  var s = { requireLogin: false, limitOne: false, emailCollected: false, emailType: '', restrictDomainRequested: !!restrictDomain, errors: [] };
  if (restrictDomain) {
    try { form.setRequireLogin(true); } catch (e) { s.errors.push('setRequireLogin: ' + (e && e.message || e)); }
  }
  try { form.setLimitOneResponsePerUser(true); } catch (e) { s.errors.push('setLimitOneResponsePerUser: ' + (e && e.message || e)); }
  var emailSet = false;
  try {
    if (FormApp.EmailCollectionType && form.setEmailCollectionType) { form.setEmailCollectionType(FormApp.EmailCollectionType.VERIFIED); emailSet = true; s.emailType = 'VERIFIED'; }
  } catch (e) { s.errors.push('setEmailCollectionType(VERIFIED): ' + (e && e.message || e)); }
  if (!emailSet) {
    try { form.setCollectEmail(true); s.emailType = 'COLLECT'; } catch (e) { s.errors.push('setCollectEmail: ' + (e && e.message || e)); }
  }
  // baca kembali status sebenarnya
  try { s.requireLogin = !!form.requiresLogin(); } catch (e) { s.requireLogin = false; if (restrictDomain) s.errors.push('requiresLogin(): ' + (e && e.message || e)); }
  try { s.limitOne = !!form.hasLimitOneResponsePerUser(); } catch (e) { s.limitOne = false; s.errors.push('hasLimitOneResponsePerUser(): ' + (e && e.message || e)); }
  try {
    if (form.getEmailCollectionType && FormApp.EmailCollectionType) s.emailCollected = form.getEmailCollectionType() !== FormApp.EmailCollectionType.DO_NOT_COLLECT;
    else s.emailCollected = !!form.collectsEmail();
  } catch (e) { try { s.emailCollected = !!form.collectsEmail(); } catch (e2) { s.emailCollected = false; s.errors.push('collectsEmail(): ' + (e2 && e2.message || e2)); } }
  // login Google dipaksa jika salah satu aktif
  s.loginEnforced = s.limitOne || s.requireLogin;
  return s;
}

function getResponses_(formId) {
  if (!formId) throw new Error('formId kosong.');
  var form = FormApp.openById(formId);
  var meta = JSON.parse(PropertiesService.getScriptProperties().getProperty('form_' + formId) || '{}');
  var idTitle = meta.idTitle || 'Nama Siswa', nameTitle = meta.nameTitle || '';
  var map = meta.map || {};
  var mcMax = 0, essayMax = 0;
  form.getItems(FormApp.ItemType.MULTIPLE_CHOICE).forEach(function (it) { mcMax += it.asMultipleChoiceItem().getPoints(); });
  form.getItems(FormApp.ItemType.PARAGRAPH_TEXT).forEach(function (it) { essayMax += it.asParagraphTextItem().getPoints(); });
  var out = form.getResponses().map(function (r) {
    var idv = '', name = '', mc = 0, answers = {}, email = '';
    try { email = String(r.getRespondentEmail() || '').trim().toLowerCase(); } catch (e) { email = ''; } // kosong bila form lama / tidak dikumpulkan
    r.getGradableItemResponses().forEach(function (ir) {
      if (ir.getItem().getType() === FormApp.ItemType.MULTIPLE_CHOICE) mc += ir.getScore() || 0; // hanya PG otomatis
    });
    r.getItemResponses().forEach(function (ir) {
      var item = ir.getItem(); var t = item.getTitle();
      if (t === idTitle) idv = String(ir.getResponse()).trim();
      if (nameTitle && t === nameTitle) name = String(ir.getResponse()).trim();
      var m = map[item.getId()];
      if (m && m.t === 'essay') answers[m.n] = String(ir.getResponse() || '');
    });
    return { response_id: r.getId(), submitted_at: r.getTimestamp().toISOString(), identifier: idv, name: name, email: email,
             score: mc, mc_score: mc, mc_max: mcMax, essay_max: essayMax, max_score: mcMax + essayMax, answers: answers };
  });
  return { ok: true, responses: out };
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
