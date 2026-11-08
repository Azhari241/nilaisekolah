/* Input Nilai: nilai ujian, nilai tugas, dan NILAI MANUAL (tanpa ujian/tugas).
 * Semua nilai disimpan sebagai baris `grades` yang terhubung ke sebuah "penilaian" (tabel exams,
 * kind = ujian | tugas | manual) sehingga tetap terhubung ke siswa, kelas, mapel, semester, TP, dan guru.
 * Nilai mentah (0..nilai maks) dikonversi ke skala 0–100 untuk KKTP, rekap, dan portal. */

function GradeCell({ exam, student, grade, onSaved }) {
  const { backend } = useApp();
  const max = Number(exam.max_score) || 100;
  const shown = (g) => (g ? String(g.raw_score !== null && g.raw_score !== undefined && max !== 100 ? Number(g.raw_score) : Number(g.score)) : '');
  const [val, setVal] = useState(shown(grade));
  const [state, setState] = useState(''); const [msg, setMsg] = useState('');
  const timer = useRef(); const last = useRef(shown(grade));
  useEffect(() => { const v = shown(grade); if (state !== 'saving') { setVal(v); last.current = v; } }, [grade && grade.score, grade && grade.raw_score, grade && grade.id]);
  const commit = async (v) => {
    clearTimeout(timer.current);
    if (v === last.current) return;
    if (v.trim() === '') { setState('invalid'); setMsg('Hapus lewat tombol hapus'); return; }
    const n = Number(v.replace(',', '.'));
    if (isNaN(n) || n < 0 || n > max) { setState('invalid'); setMsg('Nilai 0–' + max); return; }
    setState('saving'); setMsg('');
    try {
      const raw = Math.round(n * 100) / 100;
      const g = await backend.upsertGrade({ exam_id: exam.id, student_id: student.id, score: U.toScore(raw, max), raw_score: raw, source: 'manual' });
      last.current = shown(g); setState('saved'); onSaved(g); setTimeout(() => setState((s) => (s === 'saved' ? '' : s)), 2500);
    } catch (e) { setState('error'); setMsg(e.message); }
  };
  const onChange = (e) => { const v = e.target.value; setVal(v); setState(''); clearTimeout(timer.current); timer.current = setTimeout(() => commit(v), 900); };
  return (
    <div className="row gap-6">
      <input className={'input grade-input' + (state === 'invalid' || state === 'error' ? ' err' : '')} value={val} onChange={onChange} onBlur={() => commit(val)} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} inputMode="decimal" aria-label={'Nilai ' + student.full_name} placeholder="—" />
      {max !== 100 && grade && <span className="xs muted nowrap">= {U.fmtNum(Number(grade.score), 1)}</span>}
      <span className="save-state" title={msg}>
        {state === 'saving' && <><Spinner /><span className="muted">Menyimpan</span></>}
        {state === 'saved' && <><Icon name="Check" size={14} style={{ color: 'var(--green)' }} /><span style={{ color: 'var(--green-600)' }}>Tersimpan</span></>}
        {state === 'error' && <><Icon name="CircleAlert" size={14} style={{ color: 'var(--red)' }} /><span className="error-text">Gagal</span><button className="btn btn-ghost btn-sm" style={{ height: 22, padding: '0 6px' }} onClick={() => { last.current = '__'; commit(val); }}>Ulangi</button></>}
        {state === 'invalid' && <span className="error-text">{msg}</span>}
      </span>
    </div>
  );
}

function NoteCell({ exam, student, grade, onSaved }) {
  const { backend } = useApp();
  const [val, setVal] = useState((grade && grade.note) || ''); const [state, setState] = useState('');
  const last = useRef((grade && grade.note) || '');
  useEffect(() => { if (state !== 'saving') { setVal((grade && grade.note) || ''); last.current = (grade && grade.note) || ''; } }, [grade && grade.note, grade && grade.id]);
  const commit = async () => {
    if (val === last.current) return;
    if (!grade) { setState('need'); return; }
    setState('saving');
    try { const g = await backend.setGradeNote(exam.id, student.id, val.trim() || null); last.current = val; setState('saved'); onSaved(g); setTimeout(() => setState((s) => (s === 'saved' ? '' : s)), 2000); }
    catch (e) { setState('error'); }
  };
  return (
    <div className="row gap-6" style={{ minWidth: 200 }}>
      <input className="input input-sm" value={val} onChange={(e) => { setVal(e.target.value.slice(0, 500)); setState(''); }} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} placeholder={grade ? 'Tambah keterangan…' : 'Isi nilai dahulu'} disabled={!grade} aria-label={'Keterangan ' + student.full_name} />
      {state === 'saving' && <Spinner />}{state === 'saved' && <Icon name="Check" size={14} style={{ color: 'var(--green)' }} />}{state === 'error' && <Icon name="CircleAlert" size={14} style={{ color: 'var(--red)' }} />}
    </div>
  );
}

function BulkEdit({ open, onClose, exam, students, gmap, onDone }) {
  const { backend } = useApp(); const toast = useToast();
  const max = exam ? Number(exam.max_score) || 100 : 100;
  const rawOf = (g) => (g ? (g.raw_score !== null && g.raw_score !== undefined ? Number(g.raw_score) : U.fromScore(g.score, max)) : '');
  const [text, setText] = useState(''); const [mode, setMode] = useState('paste'); const [fill, setFill] = useState(''); const [onlyEmpty, setOnlyEmpty] = useState(true);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [prog, setProg] = useState(0);
  const fileRef = useRef();
  useEffect(() => { if (open) { setText(students.map((s) => rawOf(gmap[s.id])).join('\n')); setErr(''); setProg(0); setFill(''); } }, [open]);
  const lines = text.split('\n');
  const parsed = students.map((s, i) => { const raw = (lines[i] || '').trim(); if (!raw) return { s, v: null }; const n = Number(raw.replace(',', '.')); return { s, v: n, bad: isNaN(n) || n < 0 || n > max }; });
  const importExcel = async (file) => {
    if (!file) return; setErr('');
    try {
      const { rows } = await U.readXlsx(file);
      const key = (r, names) => { const k = Object.keys(r).find((x) => names.includes(U.norm(x))); return k ? String(r[k]).trim() : ''; };
      const byName = {}; rows.forEach((r) => { const n = U.normName(key(r, ['nama', 'nama siswa', 'nama lengkap'])); const v = key(r, ['nilai', 'skor']); if (n) byName[n] = v; });
      if (!Object.keys(byName).length) throw new Error('Kolom "Nama" dan "Nilai" tidak ditemukan.');
      let hit = 0; const out = students.map((s) => { const v = byName[U.normName(s.full_name)]; if (v !== undefined && v !== '') { hit++; return v; } return rawOf(gmap[s.id]); });
      setText(out.join('\n')); setMode('paste'); toast.info(`${hit} dari ${students.length} siswa cocok dengan file. Periksa lalu klik Simpan.`);
    } catch (e) { setErr(e.message); } finally { if (fileRef.current) fileRef.current.value = ''; }
  };
  const template = () => U.downloadXlsx('template-nilai-' + (exam ? exam.name : '') .replace(/[\\/:*?"<>|]+/g, '-') + '.xlsx', [{ name: 'Nilai', header: ['No', 'Nama', 'Nilai'], widths: [5, 32, 10], rows: students.map((s, i) => ({ No: i + 1, Nama: s.full_name, Nilai: rawOf(gmap[s.id]) })) }]);
  const go = async () => {
    let items;
    if (mode === 'paste') { const bad = parsed.filter((p) => p.bad); if (bad.length) { setErr(`Nilai tidak valid (0–${max}) untuk: ${bad.map((b) => b.s.full_name).slice(0, 4).join(', ')}`); return; } items = parsed.filter((p) => p.v !== null && rawOf(gmap[p.s.id]) !== p.v); }
    else { const n = Number(fill); if (fill === '' || isNaN(n) || n < 0 || n > max) { setErr('Nilai 0–' + max); return; } items = students.filter((s) => !onlyEmpty || !gmap[s.id]).map((s) => ({ s, v: n })); }
    if (!items.length) { setErr('Tidak ada perubahan untuk disimpan'); return; }
    setBusy(true); setErr(''); let ok = 0; const fails = [];
    for (let i = 0; i < items.length; i++) { try { await backend.upsertGrade({ exam_id: exam.id, student_id: items[i].s.id, score: U.toScore(items[i].v, max), raw_score: items[i].v, source: 'manual' }); ok++; } catch (e) { fails.push(items[i].s.full_name + ': ' + e.message); } setProg(Math.round(((i + 1) / items.length) * 100)); }
    backend.audit('bulk_grade', 'grades', exam.id, `${ok} nilai`);
    setBusy(false); onDone();
    if (fails.length) setErr(`${ok} tersimpan, ${fails.length} gagal: ${fails.slice(0, 3).join('; ')}`); else { toast.success(`${ok} nilai tersimpan`); onClose(); }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} size="lg" title="Isi / Edit Nilai Massal" subtitle={exam && exam.name + ' · skala 0–' + max} footer={<><button className="btn btn-outline" onClick={onClose} disabled={busy}>Batal</button><button className="btn btn-primary" onClick={go} disabled={busy}>{busy && <Spinner />}{busy ? `Menyimpan ${prog}%` : 'Simpan semua'}</button></>}>
      <div className="col gap-16">
        <div className="row-wrap between"><div className="seg"><button className={mode === 'paste' ? 'on' : ''} onClick={() => setMode('paste')}>Tempel dari Excel</button><button className={mode === 'fill' ? 'on' : ''} onClick={() => setMode('fill')}>Isi nilai sama</button></div>
          <div className="row gap-6"><button className="btn btn-ghost btn-sm" onClick={template}><Icon name="FileDown" size={15} />Template</button><button className="btn btn-outline btn-sm" onClick={() => fileRef.current.click()}><Icon name="Upload" size={15} />Import Excel</button><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => importExcel(e.target.files[0])} /></div></div>
        {err && <Alert tone="err">{err}</Alert>}
        {mode === 'paste' ? <div className="grid g2" style={{ alignItems: 'start' }}>
          <Field label="Nilai (satu baris per siswa, urutan sesuai daftar)" hint="Salin satu kolom nilai dari Excel lalu tempel. Baris kosong = tidak diubah. Import Excel mencocokkan kolom Nama."><textarea className="textarea mono" style={{ minHeight: 320 }} value={text} onChange={(e) => setText(e.target.value)} disabled={busy} /></Field>
          <div className="card" style={{ maxHeight: 360, overflowY: 'auto' }}><table className="table"><thead><tr><th>#</th><th>Siswa</th><th className="right">Nilai</th></tr></thead><tbody>{parsed.map((p, i) => <tr key={p.s.id} className={p.bad ? 'row-err' : ''}><td className="muted">{i + 1}</td><td className="small">{p.s.full_name}</td><td className="right bold">{p.v === null ? <span className="faint">—</span> : p.bad ? <span className="error-text">invalid</span> : p.v}</td></tr>)}</tbody></table></div>
        </div> : <div className="col">
          <Field label={'Nilai (0–' + max + ')'}><input className="input" type="number" min="0" max={max} value={fill} onChange={(e) => setFill(e.target.value)} style={{ maxWidth: 160 }} disabled={busy} /></Field>
          <label className="check"><input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} />Hanya siswa yang belum memiliki nilai ({students.filter((s) => !gmap[s.id]).length} siswa)</label>
        </div>}
      </div>
    </Modal>
  );
}

/* Form "Penilaian manual baru" — tidak butuh ujian/tugas/Google Form */
function ManualAssessmentForm({ open, onClose, classes, subjects, initial, preset, onSaved, onSubjectsChanged }) {
  const { backend, settings } = useApp(); const toast = useToast();
  const p = (settings && settings.portal) || {};
  const blank = { name: '', category: 'Hafalan', class_id: '', subject_id: '', semester: p.semester || 'Ganjil', academic_year: p.academic_year || '', date: new Date().toISOString().slice(0, 10), max_score: 100, kktp: p.default_kktp || 75, description: '' };
  const [v, setV] = useState(blank); const [fe, setFe] = useState({}); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [newCat, setNewCat] = useState(null); const [newSub, setNewSub] = useState(null);
  useEffect(() => { if (open) { setV(initial ? Object.assign({}, blank, initial, { description: initial.description || '' }) : Object.assign({}, blank, preset || {})); setFe({}); setErr(''); setNewCat(null); setNewSub(null); } }, [open]);
  const set = (k) => (e) => { const val = e.target.value; const nv = Object.assign({}, v, { [k]: val }); if (k === 'class_id') { const c = classes.find((x) => x.id === val); if (c) nv.academic_year = c.academic_year; } setV(nv); };
  const addSubject = async () => { if (!newSub || !newSub.trim()) return; setBusy(true); try { const s = await backend.insert('subjects', { name: newSub.trim() }); await onSubjectsChanged(); setV(Object.assign({}, v, { subject_id: s.id })); setNewSub(null); } catch (x) { setFe({ subject_id: x.message }); } finally { setBusy(false); } };
  const submit = async (e) => {
    e && e.preventDefault(); if (busy) return;
    const f = {}; if (!v.name.trim()) f.name = 'Nama penilaian wajib diisi'; if (!v.class_id) f.class_id = 'Pilih kelas'; if (!v.subject_id) f.subject_id = 'Pilih mata pelajaran';
    if (!(newCat !== null ? newCat : v.category).trim()) f.category = 'Kategori wajib diisi';
    if (!/^\d{4}\/\d{4}$/.test(String(v.academic_year).trim())) f.academic_year = 'Format: 2026/2027'; if (!v.date) f.date = 'Tanggal wajib diisi';
    const mx = Number(v.max_score); if (isNaN(mx) || mx <= 0 || mx > 1000) f.max_score = '1–1000';
    const k = Number(v.kktp); if (v.kktp === '' || isNaN(k) || k < 0 || k > 100) f.kktp = 'KKTP 0–100 (skala 100)';
    setFe(f); if (Object.keys(f).length) return;
    setBusy(true); setErr('');
    const cat = (newCat !== null ? newCat : v.category).trim();
    const row = { kind: 'manual', delivery: 'manual', name: v.name.trim(), category: cat, exam_type: cat, class_id: v.class_id, subject_id: v.subject_id, semester: v.semester, academic_year: String(v.academic_year).trim(), date: v.date, max_score: mx, kktp: k, status: 'selesai', description: v.description.trim() || null };
    try { const s = initial ? await backend.update('exams', initial.id, row) : await backend.insert('exams', Object.assign({ question_count: 0 }, row)); backend.audit(initial ? 'update' : 'create', 'manual_assessment', s.id, row.name); toast.success(initial ? 'Penilaian diperbarui' : 'Penilaian dibuat — silakan isi nilai'); onSaved(s); onClose(); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} size="lg" title={initial ? 'Edit Penilaian Manual' : 'Penilaian Manual Baru'} subtitle="Untuk nilai hafalan, praktik, presentasi, keaktifan, dll. — tanpa ujian atau Google Form"
      footer={<><button className="btn btn-outline" onClick={onClose} disabled={busy}>Batal</button><button className="btn btn-primary" onClick={submit} disabled={busy}>{busy && <Spinner />}{initial ? 'Simpan' : 'Buat & isi nilai'}</button></>}>
      <form className="col gap-16" onSubmit={submit} noValidate>
        {err && <Alert tone="err">{err}</Alert>}
        {!classes.length && <Alert tone="warn">Belum ada kelas. <Link to="/admin/kelas">Tambahkan kelas</Link> terlebih dahulu.</Alert>}
        <div className="grid g2">
          <Field label="Nama penilaian" required error={fe.name}><input className={'input' + (fe.name ? ' err' : '')} value={v.name} onChange={set('name')} placeholder="Contoh: Hafalan Surah Al-Mulk 1–10" disabled={busy} autoFocus /></Field>
          <Field label="Kategori nilai" required error={fe.category}>
            {newCat === null ? <div className="row gap-6"><select className="select" value={v.category} onChange={set('category')} disabled={busy}>{[...new Set(U.MANUAL_CATEGORIES.concat(v.category ? [v.category] : []))].map((c) => <option key={c}>{c}</option>)}</select><button type="button" className="btn btn-outline btn-icon" title="Kategori baru" onClick={() => setNewCat('')} disabled={busy}><Icon name="Plus" size={16} /></button></div>
              : <div className="row gap-6"><input className="input" autoFocus value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nama kategori baru" /><button type="button" className="btn btn-outline btn-icon" onClick={() => setNewCat(null)}><Icon name="X" size={16} /></button></div>}
          </Field>
          <Field label="Kelas" required error={fe.class_id}><select className={'select' + (fe.class_id ? ' err' : '')} value={v.class_id} onChange={set('class_id')} disabled={busy}><option value="">Pilih kelas</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.academic_year}</option>)}</select></Field>
          <Field label="Mata pelajaran" required error={fe.subject_id}>
            {newSub === null ? <div className="row gap-6"><select className={'select' + (fe.subject_id ? ' err' : '')} value={v.subject_id} onChange={set('subject_id')} disabled={busy}><option value="">Pilih mapel</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><button type="button" className="btn btn-outline btn-icon" title="Mapel baru" onClick={() => setNewSub('')} disabled={busy}><Icon name="Plus" size={16} /></button></div>
              : <div className="row gap-6"><input className="input" autoFocus value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Nama mapel" /><button type="button" className="btn btn-primary btn-icon" onClick={addSubject} disabled={busy}><Icon name="Check" size={16} /></button><button type="button" className="btn btn-outline btn-icon" onClick={() => setNewSub(null)}><Icon name="X" size={16} /></button></div>}
          </Field>
          <Field label="Semester" required><select className="select" value={v.semester} onChange={set('semester')} disabled={busy}>{U.SEMESTERS.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Tahun pelajaran" required error={fe.academic_year}><input className={'input' + (fe.academic_year ? ' err' : '')} value={v.academic_year} onChange={set('academic_year')} placeholder="2026/2027" disabled={busy} /></Field>
          <Field label="Tanggal penilaian" required error={fe.date}><input className={'input' + (fe.date ? ' err' : '')} type="date" value={v.date} onChange={set('date')} disabled={busy} /></Field>
          <div className="grid g2" style={{ gap: 12 }}>
            <Field label="Nilai maksimal" required error={fe.max_score}><input className={'input' + (fe.max_score ? ' err' : '')} type="number" min="1" value={v.max_score} onChange={set('max_score')} disabled={busy} /></Field>
            <Field label="KKTP" required error={fe.kktp} hint="skala 0–100"><input className={'input' + (fe.kktp ? ' err' : '')} type="number" min="0" max="100" value={v.kktp} onChange={set('kktp')} disabled={busy} /></Field>
          </div>
        </div>
        <Field label="Keterangan" hint="Opsional"><input className="input" value={v.description} onChange={set('description')} disabled={busy} /></Field>
      </form>
    </Modal>
  );
}

function GradesPage({ query }) {
  const { backend, google, settings } = useApp(); const toast = useToast(); const confirm = useConfirm();
  const q = useTables(['exams', 'classes', 'subjects', 'students', 'grades', 'exam_questions']);
  const [kind, setKind] = useState(query.kind || '');
  const [f, setF] = useState({ year: query.year || '', semester: query.semester || '', class: query.class || '', subject: query.subject || '' });
  const [examId, setExamId] = useState(query.exam || ''); const [search, setSearch] = useState('');
  const [bulk, setBulk] = useState(false); const [print, setPrint] = useState(false); const [syncing, setSyncing] = useState(false); const [syncRes, setSyncRes] = useState(null);
  const [manual, setManual] = useState(query.new === 'manual' ? {} : null);
  const d = q.data || { exams: [], classes: [], subjects: [], students: [], grades: [], exam_questions: [] };
  const exams = filterExams(d.exams, f).filter((e) => !kind || U.kindOf(e) === kind).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  useEffect(() => { if (q.data && examId && !d.exams.some((e) => e.id === examId)) setExamId(''); }, [q.data]);
  useEffect(() => { if (q.data && examId && !exams.some((e) => e.id === examId)) { const ex = d.exams.find((e) => e.id === examId); if (ex && kind && U.kindOf(ex) !== kind) setExamId(''); } }, [kind, f.year, f.semester, f.class, f.subject]);
  useEffect(() => { setQuery({ ...f, kind, exam: examId, new: '' }); setSyncRes(null); }, [f, kind, examId]);
  const exam = d.exams.find((e) => e.id === examId);
  const cls = exam && d.classes.find((c) => c.id === exam.class_id); const subject = exam && d.subjects.find((s) => s.id === exam.subject_id);
  const students = exam ? d.students.filter((s) => s.class_id === exam.class_id && (s.status === 'aktif' || d.grades.some((g) => g.exam_id === exam.id && g.student_id === s.id))).sort((a, b) => a.full_name.localeCompare(b.full_name)) : [];
  const gmap = exam ? Object.fromEntries(d.grades.filter((g) => g.exam_id === exam.id).map((g) => [g.student_id, g])) : {};
  const shown = students.filter((s) => !search || U.norm(s.full_name).includes(U.norm(search)) || (s.nisn || '').includes(search));
  const st = exam ? U.stats(Object.values(gmap).map((g) => Number(g.score)), exam.kktp) : null;
  const patchGrade = (g) => { q.data.grades = [...q.data.grades.filter((x) => x.id !== g.id && !(x.exam_id === g.exam_id && x.student_id === g.student_id)), g]; q.reload(true); };
  const delGrade = (s) => confirm({ title: 'Hapus nilai?', danger: true, confirmText: 'Hapus nilai', message: <>Nilai <b>{s.full_name}</b> ({U.fmtNum(Number(gmap[s.id].score), 2)}) akan dihapus. Status siswa kembali menjadi belum dinilai.</>, onConfirm: async () => { await backend.deleteGrade(exam.id, s.id); backend.audit('delete', 'grades', exam.id, s.full_name); toast.success('Nilai dihapus'); q.reload(true); } });
  const delAssessment = () => confirm({ title: 'Hapus penilaian manual?', danger: true, confirmText: 'Hapus', message: <>Penilaian <b>{exam.name}</b> beserta {Object.keys(gmap).length} nilai akan dihapus permanen.</>, onConfirm: async () => { await backend.remove('exams', exam.id); toast.success('Penilaian dihapus'); setExamId(''); q.reload(true); } });
  const sync = async () => { setSyncing(true); setSyncRes(null); try { const r = await syncExam({ backend, exam, students: d.students, grades: d.grades, google, questions: d.exam_questions }); setSyncRes(r); q.reload(true); } catch (x) { toast.error(x.message); } finally { setSyncing(false); } };
  const emptyLabel = exam && (['selesai', 'arsip', 'ditutup'].includes(exam.status)) && U.kindOf(exam) !== 'manual' ? 'Belum mengerjakan' : 'Belum dinilai';
  const printCtx = exam && { exam, cls, subject, students, gmap, profile: (settings && settings.profile) || {}, allExams: d.exams.filter((e) => e.class_id === exam.class_id && (!f.year || e.academic_year === f.year) && (!f.semester || e.semester === f.semester) && (!f.subject || e.subject_id === f.subject)).sort((a, b) => (a.date || '').localeCompare(b.date || '')), allGrades: d.grades, subjects: d.subjects };
  const k = exam && U.kindOf(exam); const max = exam ? Number(exam.max_score) || 100 : 100;
  const counts = { '': d.exams.length, ujian: d.exams.filter((e) => U.kindOf(e) === 'ujian').length, tugas: d.exams.filter((e) => U.kindOf(e) === 'tugas').length, manual: d.exams.filter((e) => U.kindOf(e) === 'manual').length };
  return (
    <>
      <PageHead title="Input Nilai" desc="Nilai ujian, nilai tugas, dan nilai manual (hafalan, praktik, keaktifan, dll). Tersimpan otomatis ke server."
        actions={<>{exam && <><button className="btn btn-outline" onClick={() => setPrint(true)} disabled={!students.length}><Icon name="Printer" size={16} />Print</button><button className="btn btn-outline" onClick={() => setBulk(true)} disabled={!students.length}><Icon name="Rows3" size={16} />Isi Massal / Import</button>{exam.google_form_id && <button className="btn btn-green" onClick={sync} disabled={syncing}>{syncing ? <Spinner /> : <Icon name="RefreshCw" size={16} />}Sinkronisasi</button>}</>}
          <button className="btn btn-primary" onClick={() => setManual({})} disabled={!q.data}><Icon name="Plus" size={16} />Penilaian Manual</button></>} />
      <div className="card card-pad col gap-16">
        <div className="seg" style={{ alignSelf: 'flex-start', flexWrap: 'wrap' }}>{[['', 'Semua'], ['ujian', 'Nilai Ujian'], ['tugas', 'Nilai Tugas'], ['manual', 'Nilai Manual']].map(([kk, l]) => <button key={kk} className={kind === kk ? 'on' : ''} onClick={() => setKind(kk)}>{l} ({counts[kk]})</button>)}</div>
        <AcademicFilters value={f} onChange={setF} data={d} />
        <Field label={kind === 'manual' ? 'Penilaian manual' : kind === 'tugas' ? 'Tugas' : kind === 'ujian' ? 'Ujian' : 'Penilaian (ujian / tugas / manual)'}>
          <select className="select" value={examId} onChange={(e) => setExamId(e.target.value)} disabled={!q.data}>
            <option value="">{q.loading && !q.data ? 'Memuat…' : exams.length ? `Pilih penilaian (${exams.length} tersedia)` : 'Tidak ada penilaian untuk filter ini'}</option>
            {exams.map((e) => <option key={e.id} value={e.id}>[{U.KINDS[U.kindOf(e)]}] {e.name} — {(d.subjects.find((s) => s.id === e.subject_id) || {}).name} — {(d.classes.find((c) => c.id === e.class_id) || {}).name} ({U.fmtDate(e.date)})</option>)}
          </select>
        </Field>
      </div>
      {q.loading && !q.data ? <div className="card"><TableSkeleton cols={7} /></div> : q.error && !q.data ? <div className="card"><ErrorState error={q.error} onRetry={q.reload} /></div>
        : !d.exams.length ? <div className="card"><EmptyState icon="PencilLine" title="Belum ada penilaian" text="Buat penilaian manual untuk langsung mengisi nilai, atau buat ujian/tugas di Manajemen Ujian & Tugas." action={<div className="row"><Link className="btn btn-outline" to="/admin/ujian?new=ujian">Buat Ujian/Tugas</Link><button className="btn btn-primary" onClick={() => setManual({})}><Icon name="Plus" size={16} />Penilaian Manual</button></div>} /></div>
        : !exam ? <div className="card"><EmptyState icon="MousePointerClick" title="Pilih penilaian" text="Pilih jenis nilai dan penilaian di atas untuk menampilkan tabel nilai, atau buat penilaian manual baru." action={<button className="btn btn-soft" onClick={() => setManual({ class_id: f.class || '', subject_id: f.subject || '' })}><Icon name="Plus" size={16} />Penilaian Manual baru</button>} /></div>
        : <>
          <SyncResult r={syncRes} />
          <div className="card card-pad row gap-16" style={{ flexWrap: 'wrap' }}>
            <Badge tone={k === 'manual' ? 'green' : k === 'tugas' ? 'amber' : 'indigo'}>{U.KINDS[k]}</Badge>
            <div className="grow"><div className="semibold">{exam.name}</div><div className="small muted">{U.typeLabel(exam)} · {subject && subject.name} · Kelas {cls && cls.name} · {exam.semester} {exam.academic_year} · {U.fmtDate(exam.date)} · nilai maks {max} · KKTP {exam.kktp}</div></div>
            {k === 'manual' ? <><button className="btn btn-ghost btn-sm" onClick={() => setManual(exam)}><Icon name="Pencil" size={15} />Edit</button><button className="btn btn-ghost btn-sm icon-danger" onClick={delAssessment}><Icon name="Trash2" size={15} />Hapus</button></> : <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/ujian/' + exam.id)}>Detail {U.KINDS[k].toLowerCase()} →</button>}
          </div>
          <div className="grid g4">
            <div className="card stat"><div className="s-top">Dinilai</div><div className="s-val">{st.count}<span className="muted" style={{ fontSize: 16 }}>/{students.length}</span></div></div>
            <div className="card stat"><div className="s-top">Rata-rata (0–100)</div><div className="s-val">{st.avg === null ? '—' : U.fmtNum(st.avg)}</div></div>
            <div className="card stat"><div className="s-top">Tuntas</div><div className="s-val" style={{ color: 'var(--green)' }}>{st.pass}</div></div>
            <div className="card stat"><div className="s-top">Belum tuntas</div><div className="s-val" style={{ color: 'var(--red)' }}>{st.fail}</div></div>
          </div>
          <div className="card">
            <div className="toolbar"><SearchInput value={search} onChange={setSearch} placeholder="Cari siswa…" /><div className="small muted">{max !== 100 ? <>Isi nilai 0–<b>{max}</b> (dikonversi ke 0–100) · </> : null}KKTP <b>{exam.kktp}</b>{exam.google_form_id ? <> · Sinkron terakhir: {exam.last_synced_at ? U.fmtDateTime(exam.last_synced_at) : 'belum pernah'}</> : ''}</div></div>
            {!students.length ? <EmptyState icon="Users" title="Belum ada siswa aktif di kelas ini" action={<Link className="btn btn-primary" to="/admin/siswa">Kelola Data Siswa</Link>} />
              : <div className="table-wrap"><table className="table"><thead><tr><th className="num">No</th><th>Nama siswa</th><th>Nilai{max !== 100 ? ' (0–' + max + ')' : ''}</th><th>Status</th><th>Keterangan</th><th>Sumber</th><th className="actions">Aksi</th></tr></thead>
                <tbody>{shown.map((s, i) => { const g = gmap[s.id]; return (
                  <tr key={s.id}>
                    <td className="num">{i + 1}</td>
                    <td><button className="link-text" onClick={() => navigate('/admin/siswa/' + s.id)}>{s.full_name}</button>{s.status !== 'aktif' && <Badge>{s.status}</Badge>}</td>
                    <td><GradeCell exam={exam} student={s} grade={g} onSaved={patchGrade} /></td>
                    <td><PassBadge score={g ? Number(g.score) : null} kktp={exam.kktp} emptyLabel={emptyLabel} /></td>
                    <td><NoteCell exam={exam} student={s} grade={g} onSaved={patchGrade} /></td>
                    <td>{g ? (g.source === 'manual' ? <Badge><Icon name="Pencil" size={11} />Manual</Badge> : <Badge tone="indigo"><Icon name="FileText" size={11} />Google Forms</Badge>) : <span className="faint">—</span>}</td>
                    <td className="actions">{g && <button className="btn btn-ghost btn-icon btn-sm icon-danger" title="Hapus nilai" onClick={() => delGrade(s)}><Icon name="Trash2" size={16} /></button>}</td>
                  </tr>); })}</tbody></table></div>}
          </div>
          <BulkEdit open={bulk} onClose={() => setBulk(false)} exam={exam} students={students} gmap={gmap} onDone={() => q.reload(true)} />
          <PrintModal open={print} onClose={() => setPrint(false)} ctx={printCtx} />
        </>}
      <ManualAssessmentForm open={!!manual} onClose={() => setManual(null)} initial={manual && manual.id ? manual : null} preset={manual && !manual.id ? manual : null} classes={d.classes} subjects={d.subjects} onSubjectsChanged={() => q.reload(true)} onSaved={(s) => { q.reload(true); setKind('manual'); setExamId(s.id); }} />
    </>
  );
}

Object.assign(window, { GradesPage });
