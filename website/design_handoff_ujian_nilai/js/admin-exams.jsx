/* Manajemen Ujian: daftar, form, detail, template & upload soal, Google Form, sinkronisasi */

const Q_COLS = ['Nomor', 'Tipe', 'Pertanyaan', 'Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D', 'Pilihan E', 'Kunci Jawaban', 'Poin'];

function downloadQuestionTemplate() {
  U.downloadXlsx('template-soal-pg-essay.xlsx', [
    { name: 'Soal', header: Q_COLS, widths: [8, 8, 60, 24, 24, 24, 24, 24, 14, 8], rows: [
      { Nomor: 1, Tipe: 'PG', Pertanyaan: 'ما معنى كَلِمَةِ «كِتَابٌ»؟', 'Pilihan A': 'Buku', 'Pilihan B': 'Pena', 'Pilihan C': 'Meja', 'Pilihan D': 'Pintu', 'Pilihan E': 'Tas', 'Kunci Jawaban': 'A', Poin: 10 },
      { Nomor: 2, Tipe: 'PG', Pertanyaan: 'Ibu kota Indonesia adalah…', 'Pilihan A': 'Bandung', 'Pilihan B': 'Jakarta', 'Pilihan C': 'Surabaya', 'Pilihan D': 'Medan', 'Pilihan E': '', 'Kunci Jawaban': 'B', Poin: 10 },
      { Nomor: 3, Tipe: 'Essay', Pertanyaan: 'Tuliskan perkenalan diri dalam bahasa Arab minimal 3 kalimat.', 'Pilihan A': '', 'Pilihan B': '', 'Pilihan C': '', 'Pilihan D': '', 'Pilihan E': '', 'Kunci Jawaban': '', Poin: 20 },
    ] },
    { name: 'Petunjuk', header: ['Kolom', 'Keterangan'], widths: [16, 80], rows: [
      { Kolom: 'Nomor', Keterangan: 'Wajib. Angka urut, tidak boleh duplikat.' },
      { Kolom: 'Tipe', Keterangan: 'PG (pilihan ganda) atau Essay. Kosong = PG. Essay dinilai manual oleh guru.' },
      { Kolom: 'Pertanyaan', Keterangan: 'Wajib. Mendukung teks Arab berharakat (simpan file sebagai .xlsx agar Unicode terjaga).' },
      { Kolom: 'Pilihan A–D', Keterangan: 'Wajib minimal A dan B terisi. Pilihan tidak boleh kembar.' },
      { Kolom: 'Pilihan E', Keterangan: 'Opsional.' },
      { Kolom: 'Kunci Jawaban', Keterangan: 'Wajib. Satu huruf A/B/C/D/E dan pilihan tersebut harus terisi.' },
      { Kolom: 'Poin', Keterangan: 'Wajib. Bilangan bulat 1–100.' },
      { Kolom: 'Essay', Keterangan: 'Kosongkan kolom Pilihan dan Kunci. Jawaban essay diperiksa & dinilai guru di website.' },
    ] },
  ]);
}

function validateQuestions(raw, header) {
  const missing = Q_COLS.filter((h) => !['Pilihan E', 'Tipe', 'Pilihan C', 'Pilihan D'].includes(h) && !header.map(U.norm).includes(U.norm(h)));
  if (missing.length) throw new Error('Kolom tidak ditemukan: ' + missing.join(', ') + '. Gunakan template soal.');
  const get = (r, k) => { const key = Object.keys(r).find((x) => U.norm(x) === U.norm(k)); return key ? String(r[key]).trim() : ''; };
  const seen = {};
  const rows = raw.filter((r) => Object.values(r).some((v) => String(v).trim())).map((r, i) => {
    const tp = U.norm(get(r, 'Tipe'));
    const o = { line: i + 2, number: get(r, 'Nomor'), qtype: /essay|uraian/.test(tp) ? 'essay' : 'mc', question: get(r, 'Pertanyaan'), options: {}, answer_key: get(r, 'Kunci Jawaban').toUpperCase(), points: get(r, 'Poin'), errors: [] };
    ['A', 'B', 'C', 'D', 'E'].forEach((k) => { const v = get(r, 'Pilihan ' + k); if (v) o.options[k] = v; });
    if (tp && !/^(pg|essay|uraian|pilihan ganda)$/.test(tp)) o.errors.push('Tipe harus PG atau Essay');
    if (!/^\d+$/.test(o.number)) o.errors.push('Nomor harus angka'); else { o.number = Number(o.number); if (seen[o.number]) o.errors.push(`Nomor duplikat (baris ${seen[o.number]})`); seen[o.number] = o.line; }
    if (!o.question) o.errors.push('Pertanyaan kosong');
    if (o.qtype === 'essay') {
      if (Object.keys(o.options).length || o.answer_key) o.errors.push('Soal essay tidak boleh memiliki pilihan/kunci');
      o.options = null; o.answer_key = null;
      if (!/^\d+$/.test(o.points) || Number(o.points) < 1 || Number(o.points) > 100) o.errors.push('Poin harus bilangan bulat 1–100'); else o.points = Number(o.points);
      return o;
    }
    if (!o.options.A || !o.options.B) o.errors.push('Pilihan A dan B wajib diisi');
    const letters = ['A', 'B', 'C', 'D', 'E']; const filled = letters.filter((k) => o.options[k]); const lastIdx = Math.max(...filled.map((k) => letters.indexOf(k)));
    if (filled.length && filled.length !== lastIdx + 1) o.errors.push('Pilihan tidak boleh melompat (mis. C kosong tapi D terisi)');
    const vals = Object.values(o.options).map(U.norm); if (new Set(vals).size !== vals.length) o.errors.push('Ada pilihan jawaban yang kembar');
    if (!/^[A-E]$/.test(o.answer_key)) o.errors.push('Kunci harus A–E'); else if (!o.options[o.answer_key]) o.errors.push(`Kunci ${o.answer_key} menunjuk pilihan kosong`);
    if (!/^\d+$/.test(o.points) || Number(o.points) < 1 || Number(o.points) > 100) o.errors.push('Poin harus bilangan bulat 1–100'); else o.points = Number(o.points);
    return o;
  });
  if (!rows.length) throw new Error('Tidak ada soal di file.');
  return rows.sort((a, b) => (a.number || 0) - (b.number || 0));
}

function QuestionView({ q }) {
  const isAr = (t) => U.ARABIC_RE.test(t || '');
  const essay = q.qtype === 'essay';
  return (
    <div className="q-card">
      <div className="row" style={{ alignItems: 'flex-start' }}><span className="badge b-indigo">{q.number}</span><div className={'grow semibold' + (isAr(q.question) ? ' arab' : '')}>{q.question}</div>{essay ? <Badge tone="amber">Essay</Badge> : <Badge>PG</Badge>}<span className="xs muted nowrap">{q.points} poin</span></div>
      {essay ? <div className="small muted mt-8" style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 8 }}>Jawaban uraian — dinilai manual oleh guru.</div> : <div className="q-opts">{Object.entries(q.options).map(([k, v]) => <div key={k} className={'q-opt' + (q.answer_key === k ? ' ok' : '')}><span className="k">{k}.</span><span className={isAr(v) ? 'arab' : ''}>{v}</span>{q.answer_key === k && <Icon name="Check" size={15} style={{ marginLeft: 'auto' }} />}</div>)}</div>}
    </div>
  );
}

function QuestionUpload({ open, onClose, exam, hasExisting, onDone }) {
  const { backend } = useApp(); const toast = useToast();
  const [rows, setRows] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [fname, setFname] = useState(''); const [view, setView] = useState('table'); const [drag, setDrag] = useState(false);
  const ref = useRef();
  useEffect(() => { if (open) { setRows(null); setErr(''); setFname(''); } }, [open]);
  const handle = async (file) => { if (!file) return; setBusy(true); setErr(''); setFname(file.name); try { const { rows: raw, header } = await U.readXlsx(file); setRows(validateQuestions(raw, header)); } catch (x) { setErr(x.message); setRows(null); } finally { setBusy(false); if (ref.current) ref.current.value = ''; } };
  const bad = rows ? rows.filter((r) => r.errors.length) : [];
  const total = rows ? rows.reduce((a, r) => a + (Number(r.points) || 0), 0) : 0;
  const confirmSave = async () => {
    setBusy(true); setErr('');
    try { await backend.replaceQuestions(exam.id, rows.map((r) => ({ number: r.number, qtype: r.qtype, question: r.question, options: r.options, answer_key: r.answer_key, points: r.points }))); backend.audit('upload_questions', 'exams', exam.id, `${rows.length} soal`); toast.success(`${rows.length} soal disimpan`); onDone(); onClose(); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} size="xl" title="Upload Soal dari Excel" subtitle={exam && exam.name}
      footer={rows ? <><button className="btn btn-outline" onClick={() => setRows(null)} disabled={busy}>Batal & pilih file lain</button><button className="btn btn-primary" onClick={confirmSave} disabled={busy || bad.length > 0}>{busy && <Spinner />}Konfirmasi & Simpan {rows.length} soal</button></> : <button className="btn btn-outline" onClick={onClose}>Tutup</button>}>
      <div className="col gap-16">
        {err && <Alert tone="err">{err}</Alert>}
        {!rows ? <>
          <Alert tone="info">Mendukung soal <b>pilihan ganda</b> (dinilai otomatis) dan <b>essay</b> (dinilai guru). Template mendukung teks Arab berharakat. <div className="mt-8"><button className="btn btn-soft btn-sm" onClick={downloadQuestionTemplate}><Icon name="Download" size={15} />Download Template Soal</button></div></Alert>
          {hasExisting && <Alert tone="warn">Ujian ini sudah memiliki soal. Mengunggah file baru akan <b>mengganti seluruh soal</b> setelah Anda konfirmasi.</Alert>}
          <div className={'dropzone' + (drag ? ' drag' : '')} onClick={() => ref.current.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}>
            {busy ? <Spinner lg /> : <Icon name="FileSpreadsheet" size={34} style={{ color: 'var(--primary)' }} />}<div className="semibold">{busy ? 'Membaca ' + fname + '…' : 'Klik atau seret file soal (.xlsx)'}</div><div className="small muted">File divalidasi dan ditampilkan sebagai preview sebelum disimpan</div>
            <input ref={ref} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => handle(e.target.files[0])} />
          </div>
        </> : <>
          <div className="row-wrap between">
            <div className="row-wrap"><Badge tone="indigo">{fname}</Badge><Badge>{rows.length} soal</Badge><Badge>Total {total} poin</Badge>{bad.length ? <Badge tone="red">{bad.length} soal bermasalah</Badge> : <Badge tone="green">Semua valid</Badge>}</div>
            <div className="seg"><button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>Tabel</button><button className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')}>Preview soal</button></div>
          </div>
          {bad.length > 0 && <Alert tone="err" title="Perbaiki file lalu unggah ulang">{bad.slice(0, 8).map((r) => <div key={r.line}>Baris {r.line}: {r.errors.join('; ')}</div>)}{bad.length > 8 && <div>…dan {bad.length - 8} baris lainnya</div>}</Alert>}
          {view === 'table' ? <div className="card table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}><table className="table"><thead><tr><th>Baris</th><th>No</th><th>Pertanyaan</th><th>Tipe/Pilihan</th><th>Kunci</th><th>Poin</th><th>Validasi</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.line} className={r.errors.length ? 'row-err' : ''}><td className="muted">{r.line}</td><td>{String(r.number)}</td><td style={{ maxWidth: 320 }} className={U.ARABIC_RE.test(r.question) ? 'arab' : ''}>{r.question}</td><td className="small">{r.qtype === 'essay' ? <Badge tone="amber">Essay</Badge> : Object.keys(r.options || {}).join(', ')}</td><td className="bold">{r.answer_key || '—'}</td><td>{String(r.points)}</td><td>{r.errors.length ? <span className="error-text">{r.errors.join('; ')}</span> : <Badge tone="green">OK</Badge>}</td></tr>)}</tbody></table></div>
            : <div className="col" style={{ maxHeight: 460, overflowY: 'auto' }}>{rows.filter((r) => !r.errors.length).map((r) => <QuestionView key={r.line} q={r} />)}</div>}
        </>}
      </div>
    </Modal>
  );
}

function ExamForm({ open, onClose, initial, classes, subjects, onSaved, onSubjectsChanged, presetKind }) {
  const { backend, settings } = useApp(); const toast = useToast();
  const p = (settings && settings.portal) || {};
  const today = new Date().toISOString().slice(0, 10);
  const blank = { kind: presetKind || 'ujian', delivery: 'google_form', name: '', subject_id: '', class_id: '', semester: p.semester || 'Ganjil', academic_year: p.academic_year || '', exam_type: 'Penilaian Harian', task_type: 'Tugas individu', date: today, start_date: today, due_date: '', description: '', instructions: '', max_score: 100, kktp: p.default_kktp || 75, status: 'draft' };
  const [v, setV] = useState(blank); const [fe, setFe] = useState({}); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [newSub, setNewSub] = useState(null);
  useEffect(() => { if (open) { setV(initial ? Object.assign({}, blank, initial, { kind: U.kindOf(initial), delivery: initial.delivery || 'google_form', description: initial.description || '', instructions: initial.instructions || '', start_date: initial.start_date || '', due_date: initial.due_date || '', max_score: initial.max_score || 100, task_type: initial.task_type || 'Tugas individu' }) : blank); setFe({}); setErr(''); setNewSub(null); } }, [open]);
  const set = (k) => (e) => { const val = e && e.target ? e.target.value : e; const nv = Object.assign({}, v, { [k]: val }); if (k === 'class_id') { const c = classes.find((x) => x.id === val); if (c) nv.academic_year = c.academic_year; } setV(nv); };
  const isTask = v.kind === 'tugas';
  const addSubject = async () => { if (!newSub || !newSub.trim()) return; setBusy(true); try { const s = await backend.insert('subjects', { name: newSub.trim() }); await onSubjectsChanged(); setV(Object.assign({}, v, { subject_id: s.id })); setNewSub(null); toast.success('Mata pelajaran ditambahkan'); } catch (x) { setFe({ subject_id: x.message }); } finally { setBusy(false); } };
  const submit = async (e) => {
    e && e.preventDefault(); if (busy) return;
    const f = {};
    if (!v.name.trim()) f.name = 'Nama kegiatan wajib diisi'; if (!v.subject_id) f.subject_id = 'Pilih mata pelajaran'; if (!v.class_id) f.class_id = 'Pilih kelas';
    if (!/^\d{4}\/\d{4}$/.test(String(v.academic_year).trim())) f.academic_year = 'Format: 2026/2027'; if (!v.date) f.date = 'Tanggal wajib diisi';
    const k = Number(v.kktp); if (isNaN(k) || k < 0 || k > 100 || v.kktp === '') f.kktp = 'KKTP 0–100';
    const mx = Number(v.max_score); if (isTask && (isNaN(mx) || mx <= 0 || mx > 1000)) f.max_score = 'Nilai maksimal 1–1000';
    if (isTask && v.due_date && v.start_date && v.due_date < v.start_date) f.due_date = 'Batas pengumpulan harus setelah tanggal mulai';
    setFe(f); if (Object.keys(f).length) return;
    setBusy(true); setErr('');
    const row = { kind: v.kind, delivery: v.delivery, name: v.name.trim(), subject_id: v.subject_id, class_id: v.class_id, semester: v.semester, academic_year: String(v.academic_year).trim(),
      exam_type: isTask ? 'Tugas' : v.exam_type, task_type: isTask ? v.task_type : null, date: v.date, start_date: v.start_date || null, due_date: v.due_date || null,
      description: v.description.trim() || null, instructions: v.instructions.trim() || null, max_score: isTask ? mx : 100, kktp: k, status: v.status };
    try { const s = initial ? await backend.update('exams', initial.id, row) : await backend.insert('exams', Object.assign({ question_count: 0 }, row)); backend.audit(initial ? 'update' : 'create', 'exams', s.id, row.name); toast.success((isTask ? 'Tugas' : 'Ujian') + (initial ? ' diperbarui' : ' dibuat')); onSaved(s); onClose(); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const label = isTask ? 'Tugas' : 'Ujian';
  return (
    <Modal open={open} onClose={onClose} busy={busy} size="lg" title={(initial ? 'Edit ' : 'Buat ') + label} footer={<><button className="btn btn-outline" onClick={onClose} disabled={busy}>Batal</button><button className="btn btn-primary" onClick={submit} disabled={busy}>{busy && <Spinner />}Simpan</button></>}>
      <form className="col gap-16" onSubmit={submit} noValidate>
        {err && <Alert tone="err">{err}</Alert>}
        {!classes.length && <Alert tone="warn">Belum ada kelas. <Link to="/admin/kelas">Tambahkan kelas</Link> terlebih dahulu.</Alert>}
        <div className="grid g2">
          <Field label="Jenis kegiatan" required><div className="seg" style={{ width: '100%' }}>{[['ujian', 'Ujian'], ['tugas', 'Tugas']].map(([kk, l]) => <button type="button" key={kk} className={v.kind === kk ? 'on' : ''} style={{ flex: 1 }} onClick={() => set('kind')(kk)} disabled={busy || (initial && initial.kind && initial.kind !== kk && initial.question_count > 0)}>{l}</button>)}</div></Field>
          <Field label="Cara pengerjaan" required hint={v.delivery === 'google_form' ? 'Soal PG/essay → Google Form, nilai PG otomatis' : 'Tanpa soal; guru mengisi nilai langsung'}><div className="seg" style={{ width: '100%' }}>{[['google_form', 'Google Form'], ['manual', 'Manual']].map(([kk, l]) => <button type="button" key={kk} className={v.delivery === kk ? 'on' : ''} style={{ flex: 1 }} onClick={() => set('delivery')(kk)} disabled={busy}>{l}</button>)}</div></Field>
        </div>
        <Field label={'Nama ' + label.toLowerCase()} required error={fe.name}><input className={'input' + (fe.name ? ' err' : '')} value={v.name} onChange={set('name')} disabled={busy} placeholder={isTask ? 'Contoh: Tugas 1 — Menulis Mufradat' : 'Contoh: Penilaian Harian 1 — Mufradat'} /></Field>
        <div className="grid g2">
          <Field label="Mata pelajaran" required error={fe.subject_id}>
            {newSub === null ? <div className="row gap-6"><select className={'select' + (fe.subject_id ? ' err' : '')} value={v.subject_id} onChange={set('subject_id')} disabled={busy}><option value="">Pilih mapel</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><button type="button" className="btn btn-outline btn-icon" title="Tambah mapel baru" onClick={() => setNewSub('')} disabled={busy}><Icon name="Plus" size={16} /></button></div>
              : <div className="row gap-6"><input className="input" autoFocus value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Nama mapel baru" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubject(); } }} /><button type="button" className="btn btn-primary btn-icon" onClick={addSubject} disabled={busy}><Icon name="Check" size={16} /></button><button type="button" className="btn btn-outline btn-icon" onClick={() => setNewSub(null)}><Icon name="X" size={16} /></button></div>}
          </Field>
          <Field label="Kelas" required error={fe.class_id}><select className={'select' + (fe.class_id ? ' err' : '')} value={v.class_id} onChange={set('class_id')} disabled={busy}><option value="">Pilih kelas</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.academic_year}</option>)}</select></Field>
          <Field label="Semester" required><select className="select" value={v.semester} onChange={set('semester')} disabled={busy}>{U.SEMESTERS.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Tahun pelajaran" required error={fe.academic_year}><input className={'input' + (fe.academic_year ? ' err' : '')} value={v.academic_year} onChange={set('academic_year')} placeholder="2026/2027" disabled={busy} /></Field>
          {isTask ? <Field label="Jenis tugas" required><select className="select" value={v.task_type} onChange={set('task_type')} disabled={busy}>{U.TASK_TYPES.map((s) => <option key={s}>{s}</option>)}</select></Field>
            : <Field label="Jenis ujian" required><select className="select" value={v.exam_type} onChange={set('exam_type')} disabled={busy}>{U.EXAM_TYPES.map((s) => <option key={s}>{s}</option>)}</select></Field>}
          <Field label={isTask ? 'Tanggal pemberian' : 'Tanggal ujian'} required error={fe.date}><input className={'input' + (fe.date ? ' err' : '')} type="date" value={v.date || ''} onChange={set('date')} disabled={busy} /></Field>
          <Field label="Tanggal mulai"><input className="input" type="date" value={v.start_date || ''} onChange={set('start_date')} disabled={busy} /></Field>
          <Field label="Batas pengumpulan" error={fe.due_date}><input className={'input' + (fe.due_date ? ' err' : '')} type="date" value={v.due_date || ''} onChange={set('due_date')} disabled={busy} /></Field>
          {isTask && <Field label="Nilai maksimal" required error={fe.max_score} hint="Nilai mentah dikonversi ke skala 0–100"><input className={'input' + (fe.max_score ? ' err' : '')} type="number" min="1" value={v.max_score} onChange={set('max_score')} disabled={busy} /></Field>}
          <Field label="KKTP" required error={fe.kktp} hint="Skala 0–100"><input className={'input' + (fe.kktp ? ' err' : '')} type="number" min="0" max="100" value={v.kktp} onChange={set('kktp')} disabled={busy} /></Field>
          <Field label="Status"><select className="select" value={v.status} onChange={set('status')} disabled={busy}>{Object.entries(U.EXAM_STATUS).map(([kk, [l]]) => <option key={kk} value={kk}>{l}</option>)}</select></Field>
        </div>
        <Field label="Keterangan / deskripsi"><textarea className="textarea" style={{ minHeight: 70 }} value={v.description} onChange={set('description')} disabled={busy} /></Field>
        {isTask && <Field label="Instruksi untuk siswa"><textarea className="textarea" style={{ minHeight: 70 }} value={v.instructions} onChange={set('instructions')} disabled={busy} placeholder="Contoh: Tulis di buku, foto, kumpulkan sebelum batas waktu." /></Field>}
      </form>
    </Modal>
  );
}

/* ---------- Sinkronisasi respons Google Forms (v1.3.0: deteksi konflik) ----------
 * Pencocokan siswa TETAP dari dropdown "Nama (KODE)" → student_id (tidak diubah).
 * Email responden hanya dipakai untuk audit & deteksi konflik.
 * Status per respons:
 *   ok                 → aman, diimpor otomatis (seperti sebelumnya)
 *   nama_ganda         → >1 respons untuk siswa yang sama (mis. dua akun memilih nama yang sama)
 *   akun_multi_nama    → satu email memilih >1 nama (tanda batas satu kiriman gagal)
 *   konflik_nilai_lama → siswa sudah punya nilai yang bukan berasal dari respons ini
 *   dipilih / ditolak  → keputusan guru; TIDAK diubah oleh sinkronisasi ulang
 * Respons selain 'ok' tidak pernah diimpor otomatis, tidak memilih yang paling awal, dan tidak menimpa nilai. */
const REVIEW_LABEL = { ok: 'OK', nama_ganda: 'Nama ganda', akun_multi_nama: 'Satu akun, banyak nama', konflik_nilai_lama: 'Konflik nilai lama', dipilih: 'Dipilih guru', ditolak: 'Ditolak guru' };
const REVIEW_TONE = { ok: 'green', nama_ganda: 'amber', akun_multi_nama: 'red', konflik_nilai_lama: 'amber', dipilih: 'indigo', ditolak: '' };
const FLAGGED = ['nama_ganda', 'akun_multi_nama', 'konflik_nilai_lama'];
const DECIDED = ['dipilih', 'ditolak'];

function makeResolver(students, exam) {
  const classStudents = students.filter((s) => s.class_id === exam.class_id);
  const byId = {}; classStudents.forEach((s) => { if (s.nisn) byId[s.nisn] = s; if (s.student_code) byId[s.student_code.toUpperCase()] = s; });
  // identitas → student_id: (1) kode dalam kurung dari dropdown, (2) NISN/kode diketik, (3) nama persis & unik di kelas
  const nameCount = {}; classStudents.forEach((s) => { const k = U.normName(s.full_name); nameCount[k] = (nameCount[k] || 0) + 1; });
  return (raw) => {
    const t = String(raw || '').trim(); const m = t.match(/\(([A-Za-z0-9_-]{3,20})\)\s*$/);
    if (m && byId[m[1].toUpperCase()]) return byId[m[1].toUpperCase()];
    if (byId[t.toUpperCase()]) return byId[t.toUpperCase()]; if (byId[t]) return byId[t];
    const n = U.normName(t); if (nameCount[n] === 1) return classStudents.find((s) => U.normName(s.full_name) === n);
    return null;
  };
}

/** Klasifikasi murni (tanpa efek samping) — dipakai sinkronisasi dan dapat diuji terpisah.
 * rows: [{response_id, student_id, email, submitted_at, prev_status, saved}]  grades: map student_id → grade */
function classifyResponses(rows, gradesByStudent) {
  const status = {}; const producer = {};
  const live = rows.filter((r) => r.student_id && r.prev_status !== 'ditolak');
  const byStudent = {}; live.forEach((r) => { (byStudent[r.student_id] = byStudent[r.student_id] || []).push(r); });
  Object.entries(byStudent).forEach(([sid, G]) => {
    const g = gradesByStudent[sid];
    const undecided = G.filter((r) => !DECIDED.includes(r.prev_status));
    const chosen = G.find((r) => r.prev_status === 'dipilih');
    // sumber nilai saat ini: respons yang sebelumnya diimpor ('ok'/'dipilih'); kompatibilitas v1.2.0:
    // respons lama tanpa status yang dulu diimpor otomatis (paling akhir) dianggap sumber nilai.
    let prod = null;
    if (g && g.source !== 'manual') {
      prod = chosen || G.find((r) => r.prev_status === 'ok') || null;
      if (!prod) { const legacy = G.filter((r) => r.saved && !r.prev_status).sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || '')); if (legacy.length) prod = legacy[0]; }
    }
    if (prod) producer[sid] = prod.response_id;
    undecided.forEach((r) => {
      if (chosen) status[r.response_id] = g ? 'konflik_nilai_lama' : 'nama_ganda';
      else if (g) status[r.response_id] = prod && prod.response_id === r.response_id ? 'ok' : 'konflik_nilai_lama';
      else status[r.response_id] = undecided.length > 1 ? 'nama_ganda' : 'ok';
    });
    // Jika ada respons baru yang konflik dengan sumber nilai yang belum diputuskan → sumber ikut ditinjau
    // (sumber bisa saja kiriman peniru); nilai TIDAK diubah, hanya status.
    if (prod && !DECIDED.includes(prod.prev_status) && undecided.some((r) => r.response_id !== prod.response_id)) status[prod.response_id] = 'nama_ganda';
  });
  // satu email → lebih dari satu siswa (dilewati bila email kosong / form lama)
  const byEmail = {}; live.forEach((r) => { if (r.email) (byEmail[r.email] = byEmail[r.email] || new Set()).add(r.student_id); });
  live.forEach((r) => { if (r.email && byEmail[r.email].size > 1 && !DECIDED.includes(r.prev_status)) status[r.response_id] = 'akun_multi_nama'; });
  return { status, producer };
}

async function fetchFormResponses(backend, google, exam) {
  if (backend.mode === 'demo' && String(exam.google_form_id).startsWith('demo-')) return backend.demoFormResponses(exam.id); // simulasi DEMO
  return GoogleForms.getResponses(google, exam.google_form_id);
}

async function syncExam({ backend, exam, students, grades, google, questions }) {
  if (!exam.google_form_id) throw new Error('Kegiatan ini belum memiliki Google Form.');
  const res = await fetchFormResponses(backend, google, exam);
  const list = res.responses || [];
  const qs = (questions || []).filter((q) => q.exam_id === exam.id);
  const hasEssay = qs.some((q) => q.qtype === 'essay') || list.some((r) => r.essay_max > 0);
  const resolve = makeResolver(students, exam);
  const saved = Object.fromEntries((await backend.list('exam_responses')).filter((r) => r.exam_id === exam.id).map((r) => [r.response_id, r]));
  const gByS = Object.fromEntries(grades.filter((g) => g.exam_id === exam.id).map((g) => [g.student_id, g]));
  const rows = list.map((r) => { const s = resolve(r.identifier); const p = saved[r.response_id];
    return { r, response_id: r.response_id, student_id: s ? s.id : null, email: String(r.email || '').trim().toLowerCase(), submitted_at: r.submitted_at, prev_status: p ? p.review_status || null : null, saved: !!p }; });
  const { status, producer } = classifyResponses(rows, gByS);
  // simpan semua respons + status (keputusan guru dipertahankan oleh trigger keep_review_decision)
  await backend.saveResponses(exam.id, rows.map((x) => ({ response_id: x.response_id, submitted_at: x.r.submitted_at, identifier: String(x.r.identifier || ''), respondent_name: x.r.name || null,
    respondent_email: x.email || null, raw_score: x.r.mc_score ?? x.r.score, max_score: x.r.max_score, mc_score: x.r.mc_score ?? x.r.score, mc_max: x.r.mc_max ?? x.r.max_score, essay_max: x.r.essay_max || 0,
    answers: x.r.answers || null, student_id: x.student_id, review_status: DECIDED.includes(x.prev_status) ? x.prev_status : (x.student_id ? status[x.response_id] || null : null) })));
  // impor otomatis HANYA status 'ok'
  let imported = 0, needEssay = 0;
  for (const x of rows) {
    if (!x.student_id || DECIDED.includes(x.prev_status) || status[x.response_id] !== 'ok') continue;
    const g = gByS[x.student_id]; const mc = Number(x.r.mc_score ?? x.r.score) || 0; const max = Number(x.r.max_score) || 0;
    if (g && producer[x.student_id] !== x.response_id) continue; // pengaman: jangan menimpa nilai dari sumber lain
    if (hasEssay) {
      if (!g || g.essay_score === null || g.essay_score === undefined) { needEssay++; continue; }
      const score = max > 0 ? Math.round(((mc + Number(g.essay_score)) / max) * 10000) / 100 : 0;
      if (Number(g.score) === score && Number(g.mc_score) === mc) continue;
      await backend.upsertGrade({ exam_id: exam.id, student_id: x.student_id, score, raw_score: mc + Number(g.essay_score), mc_score: mc, source: 'google_forms' }); imported++;
    } else {
      const score = max > 0 ? Math.round((mc / max) * 10000) / 100 : 0;
      if (g && Number(g.score) === score) continue;
      await backend.upsertGrade({ exam_id: exam.id, student_id: x.student_id, score, raw_score: mc, mc_score: mc, source: 'google_forms' }); imported++;
    }
  }
  const flagged = rows.filter((x) => x.student_id && !DECIDED.includes(x.prev_status) && FLAGGED.includes(status[x.response_id]));
  const flaggedStudents = new Set(flagged.map((x) => x.student_id));
  const emailCount = {}; rows.forEach((x) => { if (x.email) emailCount[x.email] = (emailCount[x.email] || 0) + 1; });
  const dupEmails = Object.entries(emailCount).filter(([, n]) => n > 1).map(([e, n]) => ({ email: e, count: n }));
  const byType = {}; flagged.forEach((x) => { byType[status[x.response_id]] = (byType[status[x.response_id]] || 0) + 1; });
  await backend.update('exams', exam.id, { last_synced_at: new Date().toISOString() });
  backend.audit('sync', 'exams', exam.id, `${list.length} respons, ${imported} diimpor, ${flaggedStudents.size} siswa perlu diperiksa`);
  return { total: list.length, matched: rows.filter((x) => x.student_id).length, imported, needEssay, reviewStudents: flaggedStudents.size, reviewResponses: flagged.length, byType, dupEmails,
    noEmail: rows.filter((x) => !x.email).length, unmatched: rows.filter((x) => !x.student_id).map((x) => x.r) };
}

function SyncResult({ r }) {
  if (!r) return null;
  const warn = r.unmatched.length || r.needEssay || r.reviewStudents;
  return <Alert tone={warn ? 'warn' : 'ok'} title={`Sinkronisasi selesai: ${r.imported} diimpor, ${r.reviewStudents} perlu diperiksa`}>
    {r.total} respons · {r.matched} cocok dengan siswa kelas ini.
    {r.reviewStudents > 0 && <div className="mt-4"><b>{r.reviewResponses} respons ({r.reviewStudents} siswa) tidak diimpor</b> — {Object.entries(r.byType).map(([k, n]) => REVIEW_LABEL[k] + ': ' + n).join(' · ')}. Putuskan di panel <b>Perlu diperiksa</b>.</div>}
    {r.dupEmails.length > 0 && <div className="mt-4">Email yang muncul lebih dari sekali: {r.dupEmails.map((d) => <span key={d.email} className="mono small" style={{ marginRight: 8 }}>{d.email} ({d.count}×)</span>)}</div>}
    {r.needEssay > 0 && <div className="mt-4"><b>{r.needEssay} respons menunggu penilaian essay</b> — nilai akhir dibuat setelah Anda menilai essay.</div>}
    {r.noEmail > 0 && <div className="mt-4 small">{r.noEmail} respons tanpa email (form lama v1.2.0 atau email tidak dikumpulkan) — pemeriksaan "satu akun banyak nama" dilewati untuk respons ini.</div>}
    {r.unmatched.length > 0 && <div className="mt-4">{r.unmatched.length} respons tidak cocok dengan siswa kelas ini (identitas: {r.unmatched.slice(0, 5).map((x) => x.identifier || '(kosong)').join(', ')}{r.unmatched.length > 5 ? '…' : ''}).</div>}
  </Alert>;
}

/* Laporan pengamanan form (dari Apps Script v1.3.0, disimpan di exams.google_form_security) */
function FormSecurityNotice({ exam }) {
  if (!exam.google_form_id) return null;
  const s = exam.google_form_security;
  if (!s) return <Alert tone="warn" title="Form ini BELUM terkunci (dibuat dengan versi lama)">Form dibuat sebelum v1.3.0: login Google, batas satu kiriman, dan pengumpulan email tidak diatur. Klik <b>Buat ulang</b> setelah Apps Script v1.3.0 di-deploy, atau atur manual di Google Forms → <b>Settings → Responses</b> ("Limit to 1 response" & "Collect email addresses: Verified").</Alert>;
  const locked = s.limitOne || s.requireLogin; const ok = locked && s.emailCollected;
  if (ok) return <Alert tone="ok" title="Form terkunci">Wajib login akun Google ✓ · Satu kiriman per akun {s.limitOne ? '✓' : '✗'} · Email responden dikumpulkan ✓{s.requireLogin ? ' · Hanya akun domain sekolah' : ''}. <span className="small">Status ini dibaca ulang dari form setelah diterapkan.</span></Alert>;
  return <Alert tone="err" title="Form BELUM terkunci sepenuhnya">
    Wajib login {locked ? '✓' : '✗'} · Satu kiriman per akun {s.limitOne ? '✓' : '✗'} · Email responden {s.emailCollected ? '✓' : '✗'}.
    <div className="mt-4">Kemungkinan penyebab: jenis akun pemilik form (akun Gmail biasa vs Google Workspace), kebijakan admin Workspace, atau versi Apps Script lama. Periksa dan aktifkan manual di Google Forms → <b>Settings → Responses</b>.</div>
    {s.errors && s.errors.length > 0 && <div className="mt-4 mono xs">{s.errors.join(' | ')}</div>}
  </Alert>;
}

/* Panel "Perlu diperiksa" */
function ConflictPanel({ exam, d, questions, onDone }) {
  const { backend } = useApp(); const toast = useToast(); const confirm = useConfirm();
  const [busy, setBusy] = useState('');
  const studs = Object.fromEntries(d.students.map((s) => [s.id, s]));
  const resp = d.exam_responses.filter((r) => r.exam_id === exam.id && r.student_id);
  const gmap = Object.fromEntries(d.grades.filter((g) => g.exam_id === exam.id).map((g) => [g.student_id, g]));
  const hasEssay = questions.some((q) => q.qtype === 'essay');
  const emailStudents = {}; resp.filter((r) => r.review_status !== 'ditolak').forEach((r) => { if (r.respondent_email) (emailStudents[r.respondent_email] = emailStudents[r.respondent_email] || new Set()).add(r.student_id); });
  const sids = [...new Set(resp.filter((r) => FLAGGED.includes(r.review_status)).map((r) => r.student_id))].sort((a, b) => (studs[a] || {}).full_name.localeCompare((studs[b] || {}).full_name));
  if (!sids.length) return null;
  const choose = async (sid, chosen) => {
    const g = gmap[sid]; const group = resp.filter((r) => r.student_id === sid && r.review_status !== 'ditolak');
    const others = group.filter((r) => r.response_id !== chosen.response_id).map((r) => r.response_id);
    if (g) { const ok = await confirm({ title: 'Ganti nilai lama?', confirmText: 'Ganti dengan respons ini', danger: true, message: <>Nilai <b>{studs[sid].full_name}</b> saat ini <b>{U.fmtNum(Number(g.score), 2)}</b> ({g.source === 'manual' ? 'manual' : 'Google Forms'}) akan diganti dengan respons dari <b>{chosen.respondent_email || '(tanpa email)'}</b>.{hasEssay ? ' Karena ada soal essay, nilai lama dihapus dan essay respons ini perlu dinilai ulang.' : ''}</> }); if (!ok) return; }
    setBusy(sid);
    try {
      await backend.setResponseReview(exam.id, [chosen.response_id], 'dipilih');
      if (others.length) await backend.setResponseReview(exam.id, others, 'ditolak');
      const mc = Number(chosen.mc_score) || 0; const max = Number(chosen.max_score) || 0;
      if (hasEssay) { if (g) await backend.deleteGrade(exam.id, sid); }
      else await backend.upsertGrade({ exam_id: exam.id, student_id: sid, score: max > 0 ? Math.round((mc / max) * 10000) / 100 : 0, raw_score: mc, mc_score: mc, source: 'google_forms' });
      backend.audit('review_choose', 'exam_responses', exam.id, studs[sid].full_name + ' ← ' + (chosen.respondent_email || chosen.response_id));
      toast.success(hasEssay ? 'Respons dipilih — silakan nilai essay-nya' : 'Respons dipilih dan nilai diimpor'); onDone();
    } catch (x) { toast.error(x.message); } finally { setBusy(''); }
  };
  const rejectAll = async (sid, keepOld) => {
    const group = resp.filter((r) => r.student_id === sid && r.review_status !== 'ditolak');
    const g = gmap[sid];
    const ok = await confirm({ title: keepOld ? 'Pertahankan nilai lama?' : 'Abaikan semua respons?', confirmText: keepOld ? 'Pertahankan nilai lama' : 'Abaikan semua', message: keepOld ? <>Nilai <b>{studs[sid].full_name}</b> tetap <b>{U.fmtNum(Number(g.score), 2)}</b>. Respons yang bertentangan ditandai <b>ditolak</b>.</> : <>Semua respons untuk <b>{studs[sid].full_name}</b> ditandai <b>ditolak</b>. {g ? 'Nilai yang ada tidak diubah.' : 'Siswa tetap tanpa nilai dari Google Forms.'}</> });
    if (!ok) return;
    setBusy(sid);
    try {
      const prodId = keepOld ? (group.find((r) => r.review_status === 'dipilih') || group.find((r) => r.review_status === 'ok') || {}).response_id : null;
      const rej = group.filter((r) => r.response_id !== prodId).map((r) => r.response_id);
      if (rej.length) await backend.setResponseReview(exam.id, rej, 'ditolak');
      if (prodId) await backend.setResponseReview(exam.id, [prodId], 'dipilih');
      backend.audit(keepOld ? 'review_keep_old' : 'review_reject_all', 'exam_responses', exam.id, studs[sid].full_name);
      toast.success(keepOld ? 'Nilai lama dipertahankan' : 'Semua respons diabaikan'); onDone();
    } catch (x) { toast.error(x.message); } finally { setBusy(''); }
  };
  return (
    <div className="card" style={{ borderColor: 'var(--amber-100)' }}>
      <div className="card-head"><div><div className="card-title row"><Icon name="TriangleAlert" size={18} style={{ color: 'var(--amber)' }} />Perlu diperiksa ({sids.length} siswa)</div><div className="card-sub">Respons ini TIDAK diimpor otomatis. Bandingkan lalu putuskan. Keputusan tersimpan dan tidak muncul lagi saat sinkronisasi ulang.</div></div></div>
      <div className="card-pad col gap-16">
        {sids.map((sid) => {
          const s = studs[sid] || {}; const g = gmap[sid];
          const group = resp.filter((r) => r.student_id === sid && r.review_status !== 'ditolak').sort((a, b) => (a.submitted_at || '').localeCompare(b.submitted_at || ''));
          const hasOld = group.some((r) => r.review_status === 'konflik_nilai_lama') && g;
          return (
            <div key={sid} className="q-card">
              <div className="row between" style={{ flexWrap: 'wrap' }}>
                <div><div className="bold">{s.full_name} <span className="muted mono small">({s.student_code})</span></div>
                  <div className="small muted">{group.length} respons memilih nama ini{g ? <> · nilai saat ini <b>{U.fmtNum(Number(g.score), 2)}</b> ({g.source === 'manual' ? 'manual' : 'Google Forms'})</> : ' · belum ada nilai'}</div></div>
                <div className="row gap-6">{busy === sid && <Spinner />}{hasOld && <button className="btn btn-outline btn-sm" onClick={() => rejectAll(sid, true)} disabled={!!busy}><Icon name="ShieldCheck" size={15} />Pertahankan nilai lama</button>}<button className="btn btn-ghost btn-sm icon-danger" onClick={() => rejectAll(sid, false)} disabled={!!busy}><Icon name="Ban" size={15} />Abaikan semua</button></div>
              </div>
              <div className="grid mt-12" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
                {group.map((r) => { const multi = r.respondent_email && emailStudents[r.respondent_email] && emailStudents[r.respondent_email].size > 1; return (
                  <div key={r.response_id} className="card card-pad col gap-6" style={{ padding: 14, background: '#fff' }}>
                    <div className="row between"><Badge tone={REVIEW_TONE[r.review_status]}>{REVIEW_LABEL[r.review_status] || 'Tanpa status'}</Badge><span className="xs muted">{U.fmtDateTime(r.submitted_at)}</span></div>
                    <div className="mono small" style={{ wordBreak: 'break-all' }}>{r.respondent_email || <span className="faint">(tanpa email — form lama)</span>}</div>
                    {multi && <div className="xs" style={{ color: 'var(--red)' }}>Akun ini juga memilih: {[...emailStudents[r.respondent_email]].filter((x) => x !== sid).map((x) => (studs[x] || {}).full_name).join(', ')}</div>}
                    <div className="small">PG: <b>{U.fmtNum(Number(r.mc_score) || 0)}</b>/{U.fmtNum(Number(r.mc_max) || 0)}{Number(r.essay_max) > 0 && <> · Essay: {g && r.review_status === 'dipilih' && g.essay_score != null ? <b>{U.fmtNum(Number(g.essay_score))}/{U.fmtNum(Number(r.essay_max))}</b> : <span className="muted">belum dinilai (maks {U.fmtNum(Number(r.essay_max))})</span>}</>}</div>
                    <div className="xs muted">Pilihan di form: {r.identifier}</div>
                    {r.review_status === 'dipilih' || (r.review_status === 'ok' && g) ? <div className="xs" style={{ color: 'var(--primary-700)' }}>Sumber nilai saat ini</div> : null}
                    <button className="btn btn-primary btn-sm mt-4" onClick={() => choose(sid, r)} disabled={!!busy || r.review_status === 'dipilih'}><Icon name="Check" size={15} />{g ? 'Ganti dengan respons ini' : 'Pakai yang ini'}</button>
                  </div>); })}
              </div>
            </div>);
        })}
      </div>
    </div>
  );
}

/* Daftar seluruh respons tersimpan (dengan email responden) */
function ResponseList({ exam, d }) {
  const [open, setOpen] = useState(false);
  const studs = Object.fromEntries(d.students.map((s) => [s.id, s]));
  const rows = d.exam_responses.filter((r) => r.exam_id === exam.id).sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''));
  if (!rows.length) return null;
  return (
    <div className="card">
      <div className="card-head"><div><div className="card-title">Respons tersimpan ({rows.length})</div><div className="card-sub">Akun Google yang mengirim untuk setiap nama — hanya terlihat oleh Anda</div></div><button className="btn btn-ghost btn-sm" onClick={() => setOpen(!open)}><Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={15} />{open ? 'Sembunyikan' : 'Tampilkan'}</button></div>
      {open && <div className="table-wrap"><table className="table"><thead><tr><th>Waktu kirim</th><th>Nama dipilih di form</th><th>Siswa (website)</th><th>Email responden</th><th className="right">PG</th><th>Status</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.response_id}><td className="small nowrap">{U.fmtDateTime(r.submitted_at)}</td><td className="small">{r.identifier || '—'}</td><td>{r.student_id ? (studs[r.student_id] || {}).full_name : <Badge tone="red">Tidak cocok</Badge>}</td><td className="mono small">{r.respondent_email || <span className="faint">—</span>}</td><td className="right">{U.fmtNum(Number(r.mc_score) || 0)}/{U.fmtNum(Number(r.mc_max) || 0)}</td><td>{r.review_status ? <Badge tone={REVIEW_TONE[r.review_status]}>{REVIEW_LABEL[r.review_status]}</Badge> : <span className="faint xs">—</span>}</td></tr>)}</tbody></table></div>}
    </div>
  );
}

/* ringkasan progres per kegiatan */
function progressOf(e, d) {
  const studs = d.students.filter((s) => s.class_id === e.class_id && s.status === 'aktif');
  const ids = new Set(studs.map((s) => s.id));
  const graded = d.grades.filter((g) => g.exam_id === e.id && ids.has(g.student_id));
  const respIds = new Set((d.exam_responses || []).filter((r) => r.exam_id === e.id && r.student_id && ids.has(r.student_id) && r.review_status !== 'ditolak').map((r) => r.student_id));
  graded.forEach((g) => respIds.add(g.student_id));
  const done = e.delivery === 'manual' ? graded.length : respIds.size;
  const st = U.stats(graded.map((g) => Number(g.score)), e.kktp);
  return { total: studs.length, done, notDone: studs.length - done, graded: graded.length, ungraded: Math.max(0, done - graded.length), avg: st.avg, pct: studs.length ? (done / studs.length) * 100 : null, pass: st.pass, fail: st.fail };
}

function ExamsPage({ query }) {
  const { backend, google } = useApp(); const toast = useToast(); const confirm = useConfirm();
  const q = useTables(['exams', 'classes', 'subjects', 'grades', 'exam_questions', 'students', 'exam_responses']);
  const [f, setF] = useState({ year: query.year || '', semester: query.semester || '', class: query.class || '', subject: query.subject || '' });
  const [status, setStatus] = useState(query.status || ''); const [search, setSearch] = useState(''); const [kind, setKind] = useState(query.kind || '');
  const [form, setForm] = useState(query.new ? { kind: query.new === 'tugas' ? 'tugas' : 'ujian' } : null); const [syncing, setSyncing] = useState(null);
  useEffect(() => { setQuery({ ...f, status, kind, new: '' }); }, [f, status, kind]);
  const d = q.data || { exams: [], classes: [], subjects: [], grades: [], exam_questions: [], students: [], exam_responses: [] };
  const cMap = Object.fromEntries(d.classes.map((c) => [c.id, c])); const sMap = Object.fromEntries(d.subjects.map((c) => [c.id, c]));
  const acts = d.exams.filter((e) => U.kindOf(e) !== 'manual');
  const rows = filterExams(acts, f).filter((e) => (!kind || U.kindOf(e) === kind) && (!status || e.status === status) && (!search || U.norm(e.name).includes(U.norm(search)))).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const del = (e) => {
    const nG = d.grades.filter((g) => g.exam_id === e.id).length; const nQ = d.exam_questions.filter((x) => x.exam_id === e.id).length; const L = U.KINDS[U.kindOf(e)];
    confirm({ title: 'Hapus ' + L.toLowerCase() + '?', danger: true, confirmText: 'Hapus permanen', message: <div className="col"><div>{L} <b>{e.name}</b> akan dihapus.</div>{(nG || nQ) ? <Alert tone="warn">Kegiatan ini memiliki <b>{nQ} soal</b> dan <b>{nG} nilai</b> yang juga akan terhapus. Google Form di akun Google Anda tidak ikut terhapus.</Alert> : null}</div>, onConfirm: async () => { await backend.remove('exams', e.id); backend.audit('delete', 'exams', e.id, e.name); toast.success(L + ' dihapus'); q.reload(true); } });
  };
  const copy = async (e) => { if (await U.copyText(e.google_form_url)) toast.success('Link Google Form disalin'); else toast.error('Gagal menyalin link'); };
  const sync = async (e) => {
    setSyncing(e.id);
    try { const r = await syncExam({ backend, exam: e, students: d.students, grades: d.grades, google, questions: d.exam_questions }); (r.reviewStudents ? toast.error : toast.success)(`Sinkronisasi: ${r.imported} diimpor, ${r.reviewStudents} perlu diperiksa${r.needEssay ? ', ' + r.needEssay + ' menunggu penilaian essay' : ''}`); q.reload(true); }
    catch (x) { toast.error(x.message); } finally { setSyncing(null); }
  };
  const nU = acts.filter((e) => U.kindOf(e) === 'ujian').length, nT = acts.filter((e) => U.kindOf(e) === 'tugas').length;
  return (
    <>
      <PageHead title="Manajemen Ujian & Tugas" desc="Buat ujian dan tugas (manual atau Google Form), pantau pengumpulan, dan sinkronkan nilai." actions={<><button className="btn btn-outline" onClick={downloadQuestionTemplate}><Icon name="FileDown" size={16} />Template Soal</button><button className="btn btn-outline" onClick={() => setForm({ kind: 'tugas' })} disabled={!q.data}><Icon name="NotebookPen" size={16} />Buat Tugas</button><button className="btn btn-primary" onClick={() => setForm({ kind: 'ujian' })} disabled={!q.data}><Icon name="Plus" size={16} />Buat Ujian</button></>} />
      {!google.google_script_url && <Alert tone="warn" title="Google Forms belum terhubung">Tugas/ujian <b>manual</b> tetap dapat dibuat dan dinilai. Untuk membuat Google Form dan sinkronisasi otomatis, <Link to="/admin/pengaturan?tab=google">hubungkan Google Apps Script</Link>.</Alert>}
      <div className="card">
        <div className="card-pad" style={{ borderBottom: '1px solid var(--border-2)' }}><AcademicFilters value={f} onChange={setF} data={d} /></div>
        <div className="toolbar">
          <div className="seg">{[['', 'Semua (' + acts.length + ')'], ['ujian', 'Ujian (' + nU + ')'], ['tugas', 'Tugas (' + nT + ')']].map(([k, l]) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}</div>
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama kegiatan…" /><select className="select" style={{ width: 160 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">Semua status</option>{Object.entries(U.EXAM_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></div>
        {q.loading && !q.data ? <TableSkeleton cols={7} /> : q.error && !q.data ? <ErrorState error={q.error} onRetry={q.reload} />
          : !acts.length ? <EmptyState icon="ClipboardList" title="Belum ada ujian atau tugas" text="Buat ujian (soal PG/essay via Google Form) atau tugas manual (menulis, hafalan, praktik, dll)." action={<div className="row"><button className="btn btn-outline" onClick={() => setForm({ kind: 'tugas' })}>Buat Tugas</button><button className="btn btn-primary" onClick={() => setForm({ kind: 'ujian' })}><Icon name="Plus" size={16} />Buat Ujian</button></div>} />
          : !rows.length ? <EmptyState icon="SearchX" title="Tidak ada kegiatan yang cocok" action={<button className="btn btn-outline" onClick={() => { setF({ year: '', semester: '', class: '', subject: '' }); setStatus(''); setSearch(''); setKind(''); }}>Reset filter</button>} />
          : <div className="table-wrap"><table className="table"><thead><tr><th>Kegiatan</th><th>Mapel / Kelas</th><th>Tanggal / Batas</th><th>Pengumpulan</th><th className="right">Rata-rata</th><th>Status</th><th>Google Form</th><th className="actions">Aksi</th></tr></thead>
            <tbody>{rows.map((e) => { const pr = progressOf(e, d); const k = U.kindOf(e); return (
              <tr key={e.id}>
                <td style={{ minWidth: 220 }}><div className="row gap-6"><Badge tone={k === 'tugas' ? 'amber' : 'indigo'}>{U.KINDS[k]}</Badge><button className="link-text" onClick={() => navigate('/admin/ujian/' + e.id)}>{e.name}</button></div><div className="xs muted mt-4">{U.typeLabel(e)} · {e.delivery === 'manual' ? 'Manual' : 'Google Form'} · KKTP {e.kktp}</div></td>
                <td className="nowrap">{(sMap[e.subject_id] || {}).name}<div className="xs muted">{(cMap[e.class_id] || {}).name} · {e.semester} {e.academic_year}</div></td>
                <td className="nowrap small">{U.fmtDate(e.date)}{e.due_date && <div className="xs muted">Batas: {U.fmtDate(e.due_date)}</div>}</td>
                <td style={{ minWidth: 140 }}><div className="small"><b>{pr.done}</b>/{pr.total} mengerjakan{pr.ungraded > 0 && <span style={{ color: 'var(--amber)' }}> · {pr.ungraded} belum dinilai</span>}</div>{(() => { const n = new Set((d.exam_responses || []).filter((r) => r.exam_id === e.id && FLAGGED.includes(r.review_status)).map((r) => r.student_id)).size; return n ? <div className="xs" style={{ color: 'var(--red)', fontWeight: 600 }}>⚠ {n} perlu diperiksa</div> : null; })()}<div className="hbar" style={{ gridTemplateColumns: '1fr', padding: '4px 0 0' }}><div className="track" style={{ height: 6 }}><div className="fill" style={{ width: (pr.pct || 0) + '%', background: 'var(--green)' }} /></div></div></td>
                <td className="right bold">{pr.avg === null ? <span className="faint">—</span> : U.fmtNum(pr.avg)}</td>
                <td><Badge tone={(U.EXAM_STATUS[e.status] || [])[1]}>{(U.EXAM_STATUS[e.status] || [e.status])[0]}</Badge></td>
                <td>{e.delivery === 'manual' ? <span className="xs faint">Tidak dipakai</span> : e.google_form_url ? <div className="row gap-4">
                  <a className="btn btn-ghost btn-icon btn-sm" href={e.google_form_url} target="_blank" rel="noopener" title="Buka Google Form"><Icon name="ExternalLink" size={15} /></a>
                  <button className="btn btn-ghost btn-icon btn-sm" title="Salin link" onClick={() => copy(e)}><Icon name="Copy" size={15} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" title="Sinkronisasi respons" onClick={() => sync(e)} disabled={syncing === e.id}>{syncing === e.id ? <Spinner /> : <Icon name="RefreshCw" size={15} />}</button>
                </div> : <span className="xs faint">Belum dibuat</span>}</td>
                <td className="actions">
                  <button className="btn btn-ghost btn-icon btn-sm" title="Detail" onClick={() => navigate('/admin/ujian/' + e.id)}><Icon name="Eye" size={16} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" title="Input nilai" onClick={() => navigate('/admin/nilai?exam=' + e.id)}><Icon name="PencilLine" size={16} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" title="Edit" onClick={() => setForm(e)}><Icon name="Pencil" size={16} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm icon-danger" title="Hapus" onClick={() => del(e)}><Icon name="Trash2" size={16} /></button>
                </td>
              </tr>); })}</tbody></table></div>}
      </div>
      <ExamForm open={!!form} onClose={() => setForm(null)} initial={form && form.id ? form : null} presetKind={form && form.kind} classes={d.classes} subjects={d.subjects} onSaved={(s) => { q.reload(true); if (!form.id) navigate('/admin/ujian/' + s.id); }} onSubjectsChanged={() => q.reload(true)} />
    </>
  );
}

/* ---------- Penilaian essay ---------- */
function EssayGrading({ exam, d, questions, onDone }) {
  const { backend } = useApp(); const toast = useToast();
  const essays = questions.filter((q) => q.qtype === 'essay');
  const essayMax = essays.reduce((a, q) => a + Number(q.points), 0);
  const studs = Object.fromEntries(d.students.map((s) => [s.id, s]));
  // hanya respons yang diterima: 'ok', 'dipilih', atau respons lama tanpa status (v1.2.0). Respons konflik/ditolak tidak dinilai di sini.
  const latest = {}; d.exam_responses.filter((r) => r.exam_id === exam.id && r.student_id && (!r.review_status || r.review_status === 'ok' || r.review_status === 'dipilih')).forEach((r) => { const cur = latest[r.student_id]; if (!cur || (r.review_status === 'dipilih' && cur.review_status !== 'dipilih') || (cur.review_status !== 'dipilih' && r.submitted_at > cur.submitted_at)) latest[r.student_id] = r; });
  const resp = Object.values(latest).sort((a, b) => (studs[a.student_id] || {}).full_name.localeCompare((studs[b.student_id] || {}).full_name));
  const gmap = Object.fromEntries(d.grades.filter((g) => g.exam_id === exam.id).map((g) => [g.student_id, g]));
  const [open, setOpen] = useState(null); const [val, setVal] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const start = (r) => { const g = gmap[r.student_id]; setOpen(r); setVal(g && g.essay_score !== null && g.essay_score !== undefined ? String(g.essay_score) : ''); setNote((g && g.note) || ''); setErr(''); };
  const save = async () => {
    const n = Number(val); if (val === '' || isNaN(n) || n < 0 || n > essayMax) { setErr('Nilai essay 0–' + essayMax); return; }
    setBusy(true); setErr('');
    try {
      const mc = Number(open.mc_score) || 0; const max = Number(open.max_score) || (Number(open.mc_max || 0) + essayMax);
      const score = Math.round(((mc + n) / max) * 10000) / 100;
      await backend.upsertGrade({ exam_id: exam.id, student_id: open.student_id, score, raw_score: mc + n, mc_score: mc, essay_score: n, note: note.trim() || null, source: 'google_forms' });
      backend.audit('grade_essay', 'grades', exam.id, (studs[open.student_id] || {}).full_name);
      toast.success('Nilai essay disimpan · nilai akhir ' + U.fmtNum(score, 2)); setOpen(null); onDone();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  if (!essays.length) return null;
  const pending = resp.filter((r) => !gmap[r.student_id] || gmap[r.student_id].essay_score === null || gmap[r.student_id].essay_score === undefined).length;
  return (
    <div className="card">
      <div className="card-head"><div><div className="card-title row"><Icon name="ScrollText" size={18} style={{ color: 'var(--amber)' }} />Penilaian Essay</div><div className="card-sub">{essays.length} soal essay · maks {essayMax} poin · nilai akhir = (PG + essay) ÷ total poin × 100</div></div>{pending > 0 ? <Badge tone="amber">{pending} belum dinilai</Badge> : resp.length ? <Badge tone="green">Semua sudah dinilai</Badge> : null}</div>
      {!resp.length ? <EmptyState icon="Inbox" title="Belum ada jawaban" text="Jawaban essay muncul setelah siswa mengirim Google Form dan Anda menekan Sinkronisasi." />
        : <div className="table-wrap"><table className="table"><thead><tr><th>Siswa</th><th>Dikirim</th><th className="right">PG</th><th className="right">Essay</th><th className="right">Nilai akhir</th><th>Catatan</th><th className="actions">Aksi</th></tr></thead>
          <tbody>{resp.map((r) => { const g = gmap[r.student_id]; const done = g && g.essay_score !== null && g.essay_score !== undefined; return (
            <tr key={r.id}><td className="semibold">{(studs[r.student_id] || {}).full_name}</td><td className="small nowrap">{U.fmtDateTime(r.submitted_at)}</td><td className="right">{U.fmtNum(Number(r.mc_score) || 0)}/{U.fmtNum(Number(r.mc_max) || 0)}</td>
              <td className="right">{done ? U.fmtNum(Number(g.essay_score)) + '/' + essayMax : <Badge tone="amber">Belum dinilai</Badge>}</td><td className="right">{done ? <ScoreBadge score={Number(g.score)} kktp={exam.kktp} /> : <span className="faint">—</span>}</td>
              <td className="small muted" style={{ maxWidth: 220 }}>{(g && g.note) || ''}</td><td className="actions"><button className={'btn btn-sm ' + (done ? 'btn-ghost' : 'btn-primary')} onClick={() => start(r)}><Icon name="PencilLine" size={15} />{done ? 'Ubah' : 'Nilai'}</button></td></tr>); })}</tbody></table></div>}
      {open && <Modal open onClose={() => !busy && setOpen(null)} busy={busy} size="lg" title={'Nilai essay — ' + (studs[open.student_id] || {}).full_name} subtitle={'PG otomatis: ' + U.fmtNum(Number(open.mc_score) || 0) + '/' + U.fmtNum(Number(open.mc_max) || 0)}
        footer={<><button className="btn btn-outline" onClick={() => setOpen(null)} disabled={busy}>Batal</button><button className="btn btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />}Simpan nilai</button></>}>
        <div className="col gap-16">
          {err && <Alert tone="err">{err}</Alert>}
          {essays.map((q) => { const ans = open.answers && (open.answers[q.number] ?? open.answers[String(q.number)]); return (
            <div key={q.id} className="q-card"><div className="row" style={{ alignItems: 'flex-start' }}><span className="badge b-indigo">{q.number}</span><div className={'grow semibold' + (U.ARABIC_RE.test(q.question) ? ' arab' : '')}>{q.question}</div><span className="xs muted">{q.points} poin</span></div>
              <div className={'mt-8' + (U.ARABIC_RE.test(ans || '') ? ' arab' : '')} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, whiteSpace: 'pre-wrap' }}>{ans || <span className="faint">(tidak dijawab)</span>}</div></div>); })}
          <div className="grid g2"><Field label={'Nilai essay (0–' + essayMax + ')'} required><input className="input" type="number" min="0" max={essayMax} value={val} onChange={(e) => setVal(e.target.value)} autoFocus disabled={busy} /></Field>
            <Field label="Nilai akhir (otomatis)"><input className="input" readOnly value={val === '' || isNaN(Number(val)) ? '—' : U.fmtNum(((Number(open.mc_score) || 0) + Number(val)) / (Number(open.max_score) || 1) * 100, 2)} /></Field></div>
          <Field label="Komentar / catatan untuk siswa" hint="Opsional, maks 500 karakter"><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} disabled={busy} /></Field>
        </div>
      </Modal>}
    </div>
  );
}

function ExamDetailPage({ id }) {
  const { backend, google } = useApp(); const toast = useToast(); const confirm = useConfirm();
  const q = useTables(['exams', 'classes', 'subjects', 'exam_questions', 'grades', 'students', 'publication_settings', 'exam_responses']);
  const [form, setForm] = useState(false); const [up, setUp] = useState(false); const [creating, setCreating] = useState(false); const [syncing, setSyncing] = useState(false); const [syncRes, setSyncRes] = useState(null); const [gErr, setGErr] = useState('');
  if (q.loading && !q.data) return <div className="card"><LoadingState /></div>;
  if (q.error && !q.data) return <div className="card"><ErrorState error={q.error} onRetry={q.reload} /></div>;
  const d = q.data; const e = d.exams.find((x) => x.id === id);
  if (!e) return <div className="card"><EmptyState icon="ClipboardX" title="Kegiatan tidak ditemukan" text="Data mungkin sudah dihapus, atau bukan milik akun Anda." action={<Link className="btn btn-outline" to="/admin/ujian">Kembali</Link>} /></div>;
  const kind = U.kindOf(e); const L = U.KINDS[kind]; const isGF = e.delivery !== 'manual';
  const c = d.classes.find((x) => x.id === e.class_id) || {}; const s = d.subjects.find((x) => x.id === e.subject_id) || {};
  const qs = d.exam_questions.filter((x) => x.exam_id === id).sort((a, b) => a.number - b.number);
  const pr = progressOf(e, d);
  const pub = d.publication_settings.find((p) => p.exam_id === id && p.is_published);
  const responses = d.exam_responses.filter((r) => r.exam_id === id);
  const totalPts = qs.reduce((a, x) => a + Number(x.points), 0); const nEssay = qs.filter((x) => x.qtype === 'essay').length;
  const roster = d.students.filter((st) => st.class_id === e.class_id && st.status === 'aktif').sort((p1, p2) => p1.full_name.localeCompare(p2.full_name));
  const createForm = async () => {
    setGErr('');
    if (!google.google_script_url) { setGErr('Google Forms belum terhubung. Buka Pengaturan → Google Forms untuk menghubungkan Apps Script.'); return; }
    if (!qs.length) { setGErr('Unggah soal terlebih dahulu.'); return; }
    const ok = await confirm({ title: e.google_form_id ? 'Buat ulang Google Form?' : 'Buat Google Form?', confirmText: 'Buat Google Form', message: <div className="col"><div>Sistem akan membuat Google Form <b>mode Kuis</b> di akun Google Anda berisi <b>{qs.length} soal</b> ({qs.length - nEssay} PG{nEssay ? ', ' + nEssay + ' essay' : ''}; {totalPts} poin) dengan daftar pilihan <b>nama siswa kelas {c.name}</b> ({roster.length} siswa) sebagai identitas{e.due_date ? <> dan batas pengumpulan <b>{U.fmtDate(e.due_date)}</b></> : null}.</div><Alert tone="info">Jika ada siswa baru setelah form dibuat, buat ulang form agar namanya masuk daftar.</Alert>{e.google_form_id && <Alert tone="warn">Form lama tidak dihapus, tetapi tautan diganti ke form baru. Respons form lama tidak disinkronkan lagi.</Alert>}</div> });
    if (!ok) return;
    setCreating(true);
    try {
      const payload = { title: `${e.name} — ${s.name} — ${c.name}`, description: [U.typeLabel(e) + ' · Semester ' + e.semester + ' ' + e.academic_year, e.instructions || e.description || '', e.due_date ? 'Batas pengumpulan: ' + U.fmtDate(e.due_date) : '', 'Pilih nama Anda pada daftar agar nilai tercatat.'].filter(Boolean).join('\n'), identity: { idLabel: 'Nama Siswa', roster: roster.map((st) => ({ label: st.full_name + ' (' + st.student_code + ')', code: st.student_code })) }, dueDate: e.due_date || null, questions: qs.map((x) => ({ number: x.number, qtype: x.qtype || 'mc', question: x.question, options: x.options, answer_key: x.answer_key, points: x.points, required: x.required !== false })) };
      const r = await GoogleForms.createForm(google, payload);
      const sec = r.security || null; // null = Apps Script < v1.3.0 → UI menandai belum terkunci
      await backend.update('exams', id, { google_form_id: r.formId, google_form_url: r.responderUrl, google_form_edit_url: r.editUrl || null, google_form_created_at: new Date().toISOString(), google_form_security: sec });
      backend.audit('create_form', 'exams', id, r.formId);
      const locked = sec && (sec.limitOne || sec.requireLogin) && sec.emailCollected;
      if (locked) toast.success('Google Form dibuat dan terkunci (login Google + satu kiriman)'); else toast.error('Google Form dibuat, tetapi BELUM terkunci sepenuhnya — lihat peringatan.');
      q.reload(true);
    } catch (x) { setGErr(x.message); } finally { setCreating(false); }
  };
  const sync = async () => { setSyncing(true); setGErr(''); setSyncRes(null); try { const r = await syncExam({ backend, exam: e, students: d.students, grades: d.grades, google, questions: d.exam_questions }); setSyncRes(r); q.reload(true); } catch (x) { setGErr(x.message); } finally { setSyncing(false); } };
  const copy = async () => { if (await U.copyText(e.google_form_url)) toast.success('Link Google Form disalin'); else toast.error('Gagal menyalin'); };
  const del = () => confirm({ title: 'Hapus ' + L.toLowerCase() + '?', danger: true, confirmText: 'Hapus permanen', message: <>{L} <b>{e.name}</b> beserta {qs.length} soal dan {pr.graded} nilai akan dihapus.</>, onConfirm: async () => { await backend.remove('exams', id); toast.success(L + ' dihapus'); navigate('/admin/ujian'); } });
  const delQuestions = () => confirm({ title: 'Hapus semua soal?', danger: true, confirmText: 'Hapus soal', message: 'Semua soal akan dihapus dari database. Google Form yang sudah dibuat tidak berubah.', onConfirm: async () => { await backend.replaceQuestions(id, []); toast.success('Soal dihapus'); q.reload(true); } });
  const setStatus = async (stt) => { try { await backend.update('exams', id, { status: stt }); toast.success('Status diubah menjadi ' + U.EXAM_STATUS[stt][0]); q.reload(true); } catch (x) { toast.error(x.message); } };
  return (
    <>
      <PageHead crumbs={[{ label: 'Manajemen Ujian & Tugas', to: '/admin/ujian' }, { label: e.name }]} title={e.name} desc={`${L} · ${U.typeLabel(e)} · ${s.name} · Kelas ${c.name} · ${U.fmtDate(e.date)}${e.due_date ? ' · batas ' + U.fmtDate(e.due_date) : ''}`}
        actions={<><select className="select select-sm" style={{ width: 130 }} value={e.status} onChange={(ev) => setStatus(ev.target.value)} aria-label="Status">{Object.entries(U.EXAM_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>{pub ? <Badge tone="green" dot>Dipublikasikan</Badge> : <Badge dot>Belum dipublikasi</Badge>}<button className="btn btn-outline" onClick={() => navigate('/admin/nilai?exam=' + id)}><Icon name="PencilLine" size={16} />Input Nilai</button><button className="btn btn-outline" onClick={() => setForm(true)}><Icon name="Pencil" size={16} />Edit</button><button className="btn btn-outline icon-danger" onClick={del}><Icon name="Trash2" size={16} /></button></>} />
      <div className="grid g4">
        <div className="card stat"><div className="s-top">Sudah mengerjakan<span className="s-ico ico-indigo"><Icon name="Users" size={17} /></span></div><div className="s-val">{pr.done}<span className="muted" style={{ fontSize: 16 }}>/{pr.total}</span></div><div className="s-sub">{pr.notDone} belum · {pr.pct === null ? '—' : U.fmtNum(pr.pct, 0) + '%'} selesai</div></div>
        <button className="card stat" onClick={() => navigate(`/admin/nilai?exam=${id}`)}><div className="s-top">Sudah dinilai<span className="s-ico ico-slate"><Icon name="PencilLine" size={17} /></span></div><div className="s-val">{pr.graded}</div><div className="s-sub">{pr.ungraded ? pr.ungraded + ' menunggu penilaian · ' : ''}Buka Input Nilai →</div></button>
        <div className="card stat"><div className="s-top">Rata-rata<span className="s-ico ico-green"><Icon name="Gauge" size={17} /></span></div><div className="s-val">{pr.avg === null ? '—' : U.fmtNum(pr.avg)}</div><div className="s-sub">KKTP {e.kktp}{kind === 'tugas' && e.max_score !== 100 ? ' · nilai maks ' + e.max_score : ''}</div></div>
        <div className="card stat"><div className="s-top">Ketuntasan<span className="s-ico ico-amber"><Icon name="CircleCheck" size={17} /></span></div><div className="s-val">{pr.graded ? U.fmtNum((pr.pass / pr.graded) * 100, 0) + '%' : '—'}</div><div className="s-sub">{pr.pass} tuntas · {pr.fail} belum</div></div>
      </div>
      {(e.description || e.instructions) && <div className="card card-pad col">{e.description && <div><div className="label">Keterangan</div><p className="mt-4">{e.description}</p></div>}{e.instructions && <div><div className="label">Instruksi untuk siswa</div><p className="mt-4" style={{ whiteSpace: 'pre-wrap' }}>{e.instructions}</p></div>}</div>}
      {!isGF ? <div className="card card-pad row gap-16" style={{ flexWrap: 'wrap' }}><span className="s-ico ico-amber" style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="NotebookPen" size={20} /></span><div className="grow"><div className="semibold">{L} manual</div><div className="small muted">Tidak memakai soal/Google Form. Isi nilai setiap siswa langsung di Input Nilai{kind === 'tugas' ? ' (skala 0–' + (e.max_score || 100) + ', dikonversi ke 0–100)' : ''}.</div></div><button className="btn btn-primary" onClick={() => navigate('/admin/nilai?exam=' + id)}><Icon name="PencilLine" size={16} />Isi nilai</button></div> : <>
      <div className="card">
        <div className="card-head"><div><div className="card-title row"><Icon name="FileText" size={18} style={{ color: '#7c3aed' }} />Google Form</div><div className="card-sub">Kuis otomatis: PG dinilai otomatis, essay dinilai guru</div></div>
          <div className="row-wrap">
            {e.google_form_url && <><a className="btn btn-outline btn-sm" href={e.google_form_url} target="_blank" rel="noopener"><Icon name="ExternalLink" size={15} />Buka Form</a><button className="btn btn-outline btn-sm" onClick={copy}><Icon name="Copy" size={15} />Salin Link</button>{e.google_form_edit_url && <a className="btn btn-ghost btn-sm" href={e.google_form_edit_url} target="_blank" rel="noopener"><Icon name="Settings2" size={15} />Edit di Google</a>}<button className="btn btn-green btn-sm" onClick={sync} disabled={syncing}>{syncing ? <Spinner /> : <Icon name="RefreshCw" size={15} />}Sinkronisasi</button></>}
            <button className={'btn btn-sm ' + (e.google_form_url ? 'btn-ghost' : 'btn-primary')} onClick={createForm} disabled={creating || !qs.length}>{creating ? <Spinner /> : <Icon name="WandSparkles" size={15} />}{e.google_form_url ? 'Buat ulang' : 'Buat Google Form'}</button>
          </div>
        </div>
        <div className="card-pad col">
          {gErr && <Alert tone="err">{gErr}{/belum terhubung/.test(gErr) && <div className="mt-8"><Link className="btn btn-soft btn-sm" to="/admin/pengaturan?tab=google">Buka Pengaturan Google</Link></div>}</Alert>}
          {creating && <Alert tone="info" icon="Loader">Membuat form di Google… proses ini bisa memakan waktu 10–40 detik tergantung jumlah soal.</Alert>}
          <SyncResult r={syncRes} />
          <FormSecurityNotice exam={e} />
          {e.google_form_url ? <dl className="kv"><dt>Form ID</dt><dd className="mono small" style={{ wordBreak: 'break-all' }}>{e.google_form_id}</dd><dt>Link peserta</dt><dd className="small" style={{ wordBreak: 'break-all' }}><a href={e.google_form_url} target="_blank" rel="noopener">{e.google_form_url}</a></dd><dt>Dibuat</dt><dd>{U.fmtDateTime(e.google_form_created_at)}</dd><dt>Sinkron terakhir</dt><dd>{e.last_synced_at ? U.fmtDateTime(e.last_synced_at) : 'Belum pernah'}</dd><dt>Respons tersimpan</dt><dd>{responses.length}</dd></dl>
            : !qs.length ? <div className="muted small">Unggah soal terlebih dahulu, lalu klik <b>Buat Google Form</b>.</div>
            : !google.google_script_url ? <div className="muted small">Soal siap. Hubungkan Google Apps Script di <Link to="/admin/pengaturan?tab=google">Pengaturan</Link> untuk membuat form.</div>
            : <div className="muted small">Soal siap ({qs.length} soal). Klik <b>Buat Google Form</b> untuk membuat kuis di akun Google Anda.</div>}
        </div>
      </div>
      <ConflictPanel exam={e} d={d} questions={qs} onDone={() => q.reload(true)} />
      <EssayGrading exam={e} d={d} questions={qs} onDone={() => q.reload(true)} />
      <ResponseList exam={e} d={d} />
      <div className="card">
        <div className="card-head"><div><div className="card-title">Soal ({qs.length})</div><div className="card-sub">{qs.length - nEssay} pilihan ganda · {nEssay} essay · kunci jawaban hanya terlihat oleh Anda</div></div>
          <div className="row-wrap"><button className="btn btn-ghost btn-sm" onClick={downloadQuestionTemplate}><Icon name="FileDown" size={15} />Template</button>{qs.length > 0 && <button className="btn btn-ghost btn-sm icon-danger" onClick={delQuestions}><Icon name="Trash2" size={15} />Hapus soal</button>}<button className="btn btn-primary btn-sm" onClick={() => setUp(true)}><Icon name="Upload" size={15} />{qs.length ? 'Ganti soal' : 'Upload Soal'}</button></div>
        </div>
        {!qs.length ? <EmptyState icon="FileSpreadsheet" title="Belum ada soal" text="Download template, isi soal PG dan/atau essay (mendukung Arab berharakat), lalu unggah." action={<div className="row"><button className="btn btn-outline" onClick={downloadQuestionTemplate}><Icon name="Download" size={16} />Download Template</button><button className="btn btn-primary" onClick={() => setUp(true)}><Icon name="Upload" size={16} />Upload Soal</button></div>} />
          : <div className="card-pad col">{qs.map((x) => <QuestionView key={x.id} q={x} />)}</div>}
      </div></>}
      <ExamForm open={form} onClose={() => setForm(false)} initial={e} classes={d.classes} subjects={d.subjects} onSaved={() => q.reload(true)} onSubjectsChanged={() => q.reload(true)} />
      <QuestionUpload open={up} onClose={() => setUp(false)} exam={e} hasExisting={qs.length > 0} onDone={() => q.reload(true)} />
    </>
  );
}

Object.assign(window, { ExamsPage, ExamDetailPage, syncExam, SyncResult, downloadQuestionTemplate, progressOf, classifyResponses });
