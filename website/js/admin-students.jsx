/* Data Siswa: tabel, CRUD, detail, import/export Excel */

const STUDENT_COLS = ['NISN', 'NIS', 'Nama Lengkap', 'Kelas', 'Kode Siswa', 'Tanggal Lahir', 'Status'];

const autoCode = () => 'S' + Date.now().toString(36).slice(-4).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();
function StudentForm({ open, onClose, initial, classes, onSaved, preset, allStudents }) {
  const { backend } = useApp(); const toast = useToast();
  const blank = { nisn: '', nis: '', full_name: '', class_id: '', student_code: '', birth_date: '', status: 'aktif' };
  const [v, setV] = useState(blank); const [fe, setFe] = useState({}); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { if (open) { setV(initial ? Object.assign({}, blank, initial, { nisn: initial.nisn || '', nis: initial.nis || '', birth_date: initial.birth_date || '' }) : Object.assign({}, blank, preset || {})); setFe({}); setErr(''); } }, [open]);
  const set = (k) => (e) => setV(Object.assign({}, v, { [k]: e.target.value }));
  const submit = async (e) => {
    e && e.preventDefault(); if (busy) return;
    const f = {};
    if (!v.full_name.trim()) f.full_name = 'Nama lengkap wajib diisi'; else if (v.full_name.trim().length < 3) f.full_name = 'Nama terlalu pendek';
    if (!v.class_id) f.class_id = 'Kelas wajib dipilih';
    if (v.nisn && !U.NISN_RE.test(v.nisn.trim())) f.nisn = 'NISN harus 10 digit angka';
    if (v.nis && !/^[0-9A-Za-z.\-/]{1,20}$/.test(v.nis.trim())) f.nis = 'NIS hanya huruf/angka, maks. 20 karakter';
    if (v.student_code.trim() && !/^[A-Za-z0-9\-_]{3,20}$/.test(v.student_code.trim())) f.student_code = '3–20 karakter: huruf, angka, - atau _';
    setFe(f); if (Object.keys(f).length) return;
    setBusy(true); setErr('');
    const row = { nisn: v.nisn.trim() || null, nis: v.nis.trim() || null, full_name: v.full_name.trim(), class_id: v.class_id, student_code: (v.student_code.trim() || autoCode()).toUpperCase(), birth_date: v.birth_date || null, status: v.status };
    try {
      const saved = initial ? await backend.update('students', initial.id, row) : await backend.insert('students', row);
      backend.audit(initial ? 'update' : 'create', 'students', saved.id, row.full_name);
      toast.success(initial ? 'Data siswa diperbarui' : 'Siswa berhasil ditambahkan'); onSaved(saved); onClose();
    } catch (x) {
      setErr(x.message);
      if (/NISN/i.test(x.message)) setFe({ nisn: x.message }); else if (/Kode/i.test(x.message)) setFe({ student_code: x.message }); else if (/NIS /i.test(x.message)) setFe({ nis: x.message });
    } finally { setBusy(false); }
  };
  const dupWarn = useMemo(() => { if (!v.full_name.trim() || !v.class_id || !allStudents) return ''; const n = U.normName(v.full_name); const hit = allStudents.find((x) => x.class_id === v.class_id && (!initial || x.id !== initial.id) && U.normName(x.full_name) === n); return hit ? '⚠ Sudah ada siswa dengan nama sama di kelas ini. Di portal keduanya akan tampil terpisah.' : ''; }, [v.full_name, v.class_id, allStudents]);
  const genCode = () => setV(Object.assign({}, v, { student_code: 'S' + Math.random().toString(36).slice(2, 7).toUpperCase() }));
  return (
    <Modal open={open} onClose={onClose} busy={busy} title={initial ? 'Edit Siswa' : 'Tambah Siswa'} footer={<><button className="btn btn-outline" onClick={onClose} disabled={busy}>Batal</button><button className="btn btn-primary" onClick={submit} disabled={busy}>{busy && <Spinner />}Simpan</button></>}>
      <form className="col gap-16" onSubmit={submit} noValidate>
        {err && <Alert tone="err">{err}</Alert>}
        {!classes.length && <Alert tone="warn">Belum ada kelas. <Link to="/admin/kelas">Tambahkan kelas</Link> terlebih dahulu.</Alert>}
        <Field label="Nama lengkap" required error={fe.full_name} hint={dupWarn || 'Nama ini dipakai siswa untuk mencari nilai di Portal Siswa'}><input className={'input' + (fe.full_name ? ' err' : '')} value={v.full_name} onChange={set('full_name')} disabled={busy} autoFocus /></Field>
        <div className="grid g2">
          <Field label="NISN" error={fe.nisn} hint="Opsional, 10 digit angka"><input className={'input' + (fe.nisn ? ' err' : '')} value={v.nisn} onChange={set('nisn')} inputMode="numeric" maxLength={10} disabled={busy} /></Field>
          <Field label="NIS" error={fe.nis} hint="Opsional, untuk administrasi"><input className={'input' + (fe.nis ? ' err' : '')} value={v.nis} onChange={set('nis')} disabled={busy} /></Field>
          <Field label="Kelas" required error={fe.class_id}><select className={'select' + (fe.class_id ? ' err' : '')} value={v.class_id} onChange={set('class_id')} disabled={busy}><option value="">Pilih kelas</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.academic_year}</option>)}</select></Field>
          <Field label="Kode siswa" error={fe.student_code} hint="Kosongkan untuk dibuat otomatis"><div className="row gap-6"><input className={'input' + (fe.student_code ? ' err' : '')} value={v.student_code} onChange={set('student_code')} disabled={busy} style={{ textTransform: 'uppercase' }} /><button type="button" className="btn btn-outline btn-icon" onClick={genCode} title="Buat kode otomatis" disabled={busy}><Icon name="Shuffle" size={16} /></button></div></Field>
          <Field label="Tanggal lahir" hint="Opsional"><input className="input" type="date" value={v.birth_date || ''} onChange={set('birth_date')} disabled={busy} /></Field>
          <Field label="Status"><select className="select" value={v.status} onChange={set('status')} disabled={busy}><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option><option value="lulus">Lulus</option><option value="pindah">Pindah</option></select></Field>
        </div>
      </form>
    </Modal>
  );
}

function StudentImport({ open, onClose, classes, students, onDone }) {
  const { backend } = useApp(); const toast = useToast();
  const [step, setStep] = useState(1); const [rows, setRows] = useState([]); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [result, setResult] = useState(null); const [drag, setDrag] = useState(false); const [fname, setFname] = useState('');
  const fileRef = useRef();
  useEffect(() => { if (open) { setStep(1); setRows([]); setErr(''); setResult(null); setFname(''); } }, [open]);
  const classByName = Object.fromEntries(classes.map((c) => [U.norm(c.name), c]));
  const handle = async (file) => {
    if (!file) return; setErr(''); setBusy(true); setFname(file.name);
    try {
      const { rows: raw, header } = await U.readXlsx(file);
      const missing = ['Nama Lengkap', 'Kelas'].filter((h) => !header.map(U.norm).includes(U.norm(h)));
      if (missing.length) throw new Error('Kolom wajib tidak ditemukan: ' + missing.join(', ') + '. Gunakan template yang disediakan.');
      if (!raw.length) throw new Error('File tidak berisi data.');
      const get = (r, k) => { const key = Object.keys(r).find((x) => U.norm(x) === U.norm(k)); return key ? String(r[key]).trim() : ''; };
      const seenN = {}; const seenC = {};
      const exN = new Set(students.map((s) => s.nisn).filter(Boolean)); const exC = new Set(students.map((s) => (s.student_code || '').toUpperCase()));
      const parsed = raw.map((r, i) => {
        const o = { line: i + 2, nisn: get(r, 'NISN'), nis: get(r, 'NIS'), full_name: get(r, 'Nama Lengkap'), class_name: get(r, 'Kelas'), student_code: (get(r, 'Kode Siswa') || autoCode()).toUpperCase(), birth_date: get(r, 'Tanggal Lahir'), status: (get(r, 'Status') || 'aktif').toLowerCase(), errors: [] };
        if (!o.full_name) o.errors.push('Nama kosong');
        const c = classByName[U.norm(o.class_name)]; if (!o.class_name) o.errors.push('Kelas kosong'); else if (!c) o.errors.push(`Kelas "${o.class_name}" tidak ada`); else o.class_id = c.id;
        if (o.nisn && !U.NISN_RE.test(o.nisn)) o.errors.push('NISN harus 10 digit');
        if (o.nisn && exN.has(o.nisn)) o.errors.push('NISN sudah terdaftar');
        if (o.nisn && seenN[o.nisn]) o.errors.push(`NISN duplikat dengan baris ${seenN[o.nisn]}`);
        if (!/^[A-Z0-9\-_]{3,20}$/.test(o.student_code)) o.errors.push('Kode siswa tidak valid');
        if (o.student_code && exC.has(o.student_code)) o.errors.push('Kode siswa sudah terdaftar');
        if (o.student_code && seenC[o.student_code]) o.errors.push(`Kode duplikat dengan baris ${seenC[o.student_code]}`);
        if (o.birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(o.birth_date)) o.errors.push('Tanggal lahir harus YYYY-MM-DD');
        if (!['aktif', 'nonaktif', 'lulus', 'pindah'].includes(o.status)) o.errors.push('Status tidak dikenal');
        if (o.nisn) seenN[o.nisn] = seenN[o.nisn] || o.line; if (o.student_code) seenC[o.student_code] = seenC[o.student_code] || o.line;
        return o;
      });
      setRows(parsed); setStep(2);
    } catch (x) { setErr(x.message); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const valid = rows.filter((r) => !r.errors.length); const invalid = rows.length - valid.length;
  const doImport = async () => {
    setBusy(true); setErr('');
    try {
      const res = await backend.insertMany('students', valid.map((r) => ({ nisn: r.nisn || null, nis: r.nis || null, full_name: r.full_name, class_id: r.class_id, student_code: r.student_code, birth_date: r.birth_date || null, status: r.status })));
      backend.audit('import', 'students', null, `${res.ok.length} berhasil, ${res.fail.length} gagal`);
      setResult({ ok: res.ok.length, fail: res.fail.length + invalid, failRows: res.fail.map((f) => ({ line: valid[f.index].line, msg: f.message })) });
      setStep(3); onDone(); toast.success(`${res.ok.length} siswa berhasil diimport`);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const template = () => U.downloadXlsx('template-data-siswa.xlsx', [{ name: 'Siswa', header: STUDENT_COLS, widths: [14, 10, 30, 10, 12, 14, 10], rows: [{ NISN: '0123456789', NIS: '2601', 'Nama Lengkap': 'Contoh Nama Siswa', Kelas: classes[0] ? classes[0].name : 'VII-A', 'Kode Siswa': 'S0001', 'Tanggal Lahir': '2013-05-20', Status: 'aktif' }] }, { name: 'Petunjuk', header: ['Kolom', 'Keterangan'], widths: [16, 70], rows: [{ Kolom: 'NISN', Keterangan: 'Opsional. 10 digit angka, unik.' }, { Kolom: 'NIS', Keterangan: 'Opsional. Untuk administrasi.' }, { Kolom: 'Nama Lengkap', Keterangan: 'Wajib. Dipakai siswa untuk mencari nilai di Portal Siswa (bersama kelas).' }, { Kolom: 'Kelas', Keterangan: 'Wajib. Harus sama persis dengan nama kelas di aplikasi: ' + classes.map((c) => c.name).join(', ') }, { Kolom: 'Kode Siswa', Keterangan: 'Opsional, unik. Kosong = dibuat otomatis. Dipakai sebagai identitas di Google Form.' }, { Kolom: 'Tanggal Lahir', Keterangan: 'Opsional. Format YYYY-MM-DD.' }, { Kolom: 'Status', Keterangan: 'aktif / nonaktif / lulus / pindah. Kosong = aktif.' }] }]);
  return (
    <Modal open={open} onClose={onClose} busy={busy} size="lg" title="Import Data Siswa dari Excel"
      footer={step === 1 ? <><button className="btn btn-outline" onClick={onClose}>Batal</button></>
        : step === 2 ? <><button className="btn btn-outline" onClick={() => setStep(1)} disabled={busy}>Pilih file lain</button><button className="btn btn-primary" onClick={doImport} disabled={busy || !valid.length}>{busy && <Spinner />}Import {valid.length} siswa</button></>
        : <button className="btn btn-primary" onClick={onClose}>Selesai</button>}>
      <div className="col gap-16">
        <div className="steps">{['Pilih file', 'Preview & validasi', 'Hasil'].map((s, i) => <span key={s} className="row gap-6">{i > 0 && <Icon name="ChevronRight" size={14} />}<span className={'st' + (step === i + 1 ? ' on' : step > i + 1 ? ' done' : '')}><span className="n">{step > i + 1 ? '✓' : i + 1}</span>{s}</span></span>)}</div>
        {err && <Alert tone="err">{err}</Alert>}
        {step === 1 && <>
          <Alert tone="info">Gunakan template agar kolom sesuai. Nama kelas di file harus sama dengan kelas yang sudah dibuat di aplikasi.<div className="mt-8"><button className="btn btn-soft btn-sm" onClick={template}><Icon name="Download" size={15} />Download Template</button></div></Alert>
          <div className={'dropzone' + (drag ? ' drag' : '')} onClick={() => fileRef.current.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}>
            {busy ? <Spinner lg /> : <Icon name="FileSpreadsheet" size={34} style={{ color: 'var(--primary)' }} />}
            <div className="semibold">{busy ? 'Membaca ' + fname + '…' : 'Klik atau seret file Excel ke sini'}</div><div className="small muted">.xlsx, .xls, atau .csv — maks. 5 MB</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => handle(e.target.files[0])} />
          </div>
        </>}
        {step === 2 && <>
          <div className="row-wrap"><Badge tone="indigo">{fname}</Badge><Badge tone="green">{valid.length} siap diimport</Badge>{invalid > 0 && <Badge tone="red">{invalid} baris bermasalah (dilewati)</Badge>}</div>
          <div className="card table-wrap" style={{ maxHeight: 380, overflowY: 'auto' }}>
            <table className="table"><thead><tr><th>Baris</th><th>NISN</th><th>Nama</th><th>Kelas</th><th>Kode</th><th>Validasi</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.line} className={r.errors.length ? 'row-err' : ''}><td className="muted">{r.line}</td><td className="mono">{r.nisn || '—'}</td><td>{r.full_name || '—'}</td><td>{r.class_name || '—'}</td><td className="mono">{r.student_code || '—'}</td><td>{r.errors.length ? <span className="error-text">{r.errors.join('; ')}</span> : <Badge tone="green">OK</Badge>}</td></tr>)}</tbody></table>
          </div>
        </>}
        {step === 3 && result && <div className="col">
          <div className="grid g2"><div className="card stat"><div className="s-top">Berhasil</div><div className="s-val" style={{ color: 'var(--green)' }}>{result.ok}</div></div><div className="card stat"><div className="s-top">Gagal / dilewati</div><div className="s-val" style={{ color: 'var(--red)' }}>{result.fail}</div></div></div>
          {result.failRows.length > 0 && <Alert tone="err" title="Gagal disimpan server">{result.failRows.map((f) => <div key={f.line}>Baris {f.line}: {f.msg}</div>)}</Alert>}
        </div>}
      </div>
    </Modal>
  );
}

function StudentsPage({ query }) {
  const { backend } = useApp(); const toast = useToast(); const confirm = useConfirm();
  const q = useTables(['students', 'classes']);
  const [search, setSearch] = useState(query.q || ''); const [cls, setCls] = useState(query.class || ''); const [st, setSt] = useState(query.status || ''); const [page, setPage] = useState(1);
  const [form, setForm] = useState(null); const [imp, setImp] = useState(false);
  const per = 10;
  useEffect(() => { setPage(1); setQuery({ q: search, class: cls, status: st }); }, [search, cls, st]);
  const data = q.data || { students: [], classes: [] };
  const cMap = Object.fromEntries(data.classes.map((c) => [c.id, c]));
  const s = U.norm(search);
  const rows = data.students.filter((x) => (!cls || x.class_id === cls) && (!st || x.status === st) && (!s || U.norm(x.full_name).includes(s) || (x.nisn || '').includes(s) || U.norm(x.student_code).includes(s) || (x.nis || '').includes(s)))
    .sort((a, b) => ((cMap[a.class_id] || {}).name || '').localeCompare((cMap[b.class_id] || {}).name || '') || a.full_name.localeCompare(b.full_name));
  const pageRows = rows.slice((page - 1) * per, page * per);
  const del = (x) => confirm({ title: 'Hapus siswa?', danger: true, confirmText: 'Hapus', message: <>Data <b>{x.full_name}</b> akan dihapus permanen. Siswa yang sudah memiliki nilai tidak dapat dihapus.</>, onConfirm: async () => { await backend.remove('students', x.id); backend.audit('delete', 'students', x.id, x.full_name); toast.success('Siswa dihapus'); q.reload(true); } });
  const exportX = () => {
    if (!rows.length) { toast.error('Tidak ada data untuk diexport'); return; }
    U.downloadXlsx(`data-siswa-${new Date().toISOString().slice(0, 10)}.xlsx`, [{ name: 'Siswa', header: ['No', ...STUDENT_COLS], widths: [5, 14, 10, 30, 10, 12, 14, 10], rows: rows.map((x, i) => ({ No: i + 1, NISN: x.nisn || '', NIS: x.nis || '', 'Nama Lengkap': x.full_name, Kelas: (cMap[x.class_id] || {}).name || '', 'Kode Siswa': x.student_code, 'Tanggal Lahir': x.birth_date || '', Status: x.status })) }]);
    toast.success(`${rows.length} data siswa diexport`);
  };
  const statusTone = { aktif: 'green', nonaktif: '', lulus: 'indigo', pindah: 'amber' };
  return (
    <>
      <PageHead title="Data Siswa" desc="Kelola data siswa, import dari Excel, dan export." actions={<>
        <button className="btn btn-outline" onClick={() => setImp(true)} disabled={!q.data}><Icon name="Upload" size={16} />Import</button>
        <button className="btn btn-outline" onClick={exportX} disabled={!q.data}><Icon name="Download" size={16} />Export</button>
        <button className="btn btn-primary" onClick={() => setForm({})} disabled={!q.data}><Icon name="Plus" size={16} />Tambah Siswa</button></>} />
      <div className="card">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari nama, NISN, NIS, atau kode siswa…" />
          <select className="select" style={{ width: 180 }} value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Filter kelas"><option value="">Semua kelas</option>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className="select" style={{ width: 150 }} value={st} onChange={(e) => setSt(e.target.value)} aria-label="Filter status"><option value="">Semua status</option><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option><option value="lulus">Lulus</option><option value="pindah">Pindah</option></select>
        </div>
        {q.loading && !q.data ? <TableSkeleton cols={6} /> : q.error && !q.data ? <ErrorState error={q.error} onRetry={q.reload} />
          : !data.students.length ? <EmptyState icon="Users" title="Belum ada siswa" text="Tambahkan siswa satu per satu atau import dari file Excel." action={<div className="row"><button className="btn btn-outline" onClick={() => setImp(true)}><Icon name="Upload" size={16} />Import Excel</button><button className="btn btn-primary" onClick={() => setForm({})}><Icon name="Plus" size={16} />Tambah Siswa</button></div>} />
          : !rows.length ? <EmptyState icon="SearchX" title="Tidak ditemukan" text="Tidak ada siswa yang cocok dengan pencarian atau filter." action={<button className="btn btn-outline" onClick={() => { setSearch(''); setCls(''); setSt(''); }}>Reset filter</button>} />
          : <>
            <div className="table-wrap"><table className="table"><thead><tr><th className="num">No</th><th>NISN</th><th>Nama</th><th>Kelas</th><th>Kode</th><th>Status</th><th className="actions">Aksi</th></tr></thead>
              <tbody>{pageRows.map((x, i) => (
                <tr key={x.id}>
                  <td className="num">{(page - 1) * per + i + 1}</td>
                  <td className="mono">{x.nisn || <span className="faint">—</span>}</td>
                  <td><button className="link-text" onClick={() => navigate('/admin/siswa/' + x.id)}>{x.full_name}</button></td>
                  <td>{cMap[x.class_id] ? <Link to={'/admin/kelas/' + x.class_id}>{cMap[x.class_id].name}</Link> : '—'}</td>
                  <td className="mono small">{x.student_code}</td>
                  <td><Badge tone={statusTone[x.status]}>{x.status}</Badge></td>
                  <td className="actions">
                    <button className="btn btn-ghost btn-icon btn-sm" title="Detail" onClick={() => navigate('/admin/siswa/' + x.id)}><Icon name="Eye" size={16} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm" title="Edit" onClick={() => setForm(x)}><Icon name="Pencil" size={16} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm icon-danger" title="Hapus" onClick={() => del(x)}><Icon name="Trash2" size={16} /></button>
                  </td>
                </tr>))}</tbody></table></div>
            <Pager page={page} total={rows.length} perPage={per} onPage={setPage} />
          </>}
      </div>
      <StudentForm open={!!form} onClose={() => setForm(null)} initial={form && form.id ? form : null} classes={data.classes} allStudents={data.students} onSaved={() => q.reload(true)} />
      <StudentImport open={imp} onClose={() => setImp(false)} classes={data.classes} students={data.students} onDone={() => q.reload(true)} />
    </>
  );
}

function StudentDetailPage({ id }) {
  const q = useTables(['students', 'classes', 'exams', 'subjects', 'grades', 'publication_settings']);
  const [form, setForm] = useState(false);
  if (q.loading && !q.data) return <div className="card"><LoadingState /></div>;
  if (q.error && !q.data) return <div className="card"><ErrorState error={q.error} onRetry={q.reload} /></div>;
  const d = q.data; const s = d.students.find((x) => x.id === id);
  if (!s) return <div className="card"><EmptyState icon="UserX" title="Siswa tidak ditemukan" text="Data mungkin sudah dihapus." action={<Link className="btn btn-outline" to="/admin/siswa">Kembali ke Data Siswa</Link>} /></div>;
  const c = d.classes.find((x) => x.id === s.class_id);
  const exams = d.exams.filter((e) => e.class_id === s.class_id).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const pub = new Set(d.publication_settings.filter((p) => p.is_published).map((p) => p.exam_id));
  const subj = Object.fromEntries(d.subjects.map((x) => [x.id, x]));
  const gMap = Object.fromEntries(d.grades.filter((g) => g.student_id === id).map((g) => [g.exam_id, g]));
  const st = U.stats(Object.values(gMap).map((g) => Number(g.score)));
  return (
    <>
      <PageHead crumbs={[{ label: 'Data Siswa', to: '/admin/siswa' }, { label: s.full_name }]} title={s.full_name} desc={`Kelas ${c ? c.name : '-'} · ${s.status}`} actions={<button className="btn btn-outline" onClick={() => setForm(true)}><Icon name="Pencil" size={16} />Edit</button>} />
      <div className="grid g3">
        <div className="card card-pad"><div className="card-title mb-12">Profil</div><dl className="kv"><dt>NISN</dt><dd className="mono">{s.nisn || '—'}</dd><dt>NIS</dt><dd className="mono">{s.nis || '—'}</dd><dt>Kode siswa</dt><dd className="mono">{s.student_code}</dd><dt>Kelas</dt><dd>{c ? <Link to={'/admin/kelas/' + c.id}>{c.name}</Link> : '—'}</dd><dt>Tanggal lahir</dt><dd>{U.fmtDate(s.birth_date)}</dd><dt>Status</dt><dd>{s.status}</dd></dl></div>
        <div className="card stat"><div className="s-top">Rata-rata nilai<span className="s-ico ico-indigo"><Icon name="Gauge" size={17} /></span></div><div className="s-val">{st.avg === null ? '—' : U.fmtNum(st.avg)}</div><div className="s-sub">{st.count} dari {exams.length} ujian dinilai</div></div>
        <div className="card stat"><div className="s-top">Rentang nilai<span className="s-ico ico-green"><Icon name="ArrowUpDown" size={17} /></span></div><div className="s-val">{st.count ? `${U.fmtNum(st.min)}–${U.fmtNum(st.max)}` : '—'}</div><div className="s-sub">terendah – tertinggi</div></div>
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">Nilai per ujian</div></div>
        {!exams.length ? <EmptyState icon="ClipboardList" title="Belum ada ujian untuk kelas ini" /> :
          <div className="table-wrap"><table className="table"><thead><tr><th>Ujian</th><th>Mapel</th><th>Tanggal</th><th className="right">Nilai</th><th className="right">KKTP</th><th>Status</th><th>Publikasi</th></tr></thead>
            <tbody>{exams.map((e) => { const g = gMap[e.id]; return (
              <tr key={e.id}><td><button className="link-text" onClick={() => navigate('/admin/ujian/' + e.id)}>{e.name}</button><div className="xs muted">{e.exam_type}</div></td><td>{(subj[e.subject_id] || {}).name}</td><td className="nowrap">{U.fmtDate(e.date)}</td><td className="right"><ScoreBadge score={g ? Number(g.score) : null} kktp={e.kktp} /></td><td className="right muted">{e.kktp}</td><td><PassBadge score={g ? Number(g.score) : null} kktp={e.kktp} emptyLabel={e.status === 'selesai' ? 'Belum mengikuti' : 'Belum dinilai'} /></td><td>{pub.has(e.id) ? <Badge tone="green">Terpublikasi</Badge> : <Badge>Disembunyikan</Badge>}</td></tr>); })}</tbody></table></div>}
      </div>
      <StudentForm open={form} onClose={() => setForm(false)} initial={s} classes={d.classes} allStudents={d.students} onSaved={() => q.reload(true)} />
    </>
  );
}

Object.assign(window, { StudentsPage, StudentDetailPage, StudentForm });
