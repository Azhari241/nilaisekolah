/* Data Kelas: CRUD, detail kelas, pindah siswa */

function ClassForm({ open, onClose, initial, onSaved }) {
  const { backend, settings } = useApp(); const toast = useToast();
  const defYear = (settings && settings.portal && settings.portal.academic_year) || '';
  const [v, setV] = useState({}); const [fe, setFe] = useState({}); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { if (open) { setV(initial ? { name: initial.name, grade: initial.grade || '', academic_year: initial.academic_year, homeroom: initial.homeroom || '' } : { name: '', grade: '', academic_year: defYear, homeroom: '' }); setFe({}); setErr(''); } }, [open]);
  const set = (k) => (e) => setV(Object.assign({}, v, { [k]: e.target.value }));
  const submit = async (e) => {
    e && e.preventDefault(); if (busy) return;
    const f = {}; if (!v.name.trim()) f.name = 'Nama kelas wajib diisi'; if (!v.grade) f.grade = 'Tingkat wajib dipilih';
    if (!/^\d{4}\/\d{4}$/.test(v.academic_year.trim())) f.academic_year = 'Format: 2026/2027'; else { const [a, b] = v.academic_year.split('/').map(Number); if (b !== a + 1) f.academic_year = 'Tahun kedua harus tahun pertama + 1'; }
    setFe(f); if (Object.keys(f).length) return;
    setBusy(true); setErr('');
    const row = { name: v.name.trim(), grade: v.grade, academic_year: v.academic_year.trim(), homeroom: v.homeroom.trim() || null };
    try { const s = initial ? await backend.update('classes', initial.id, row) : await backend.insert('classes', row); backend.audit(initial ? 'update' : 'create', 'classes', s.id, row.name); toast.success(initial ? 'Kelas diperbarui' : 'Kelas ditambahkan'); onSaved(s); onClose(); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} title={initial ? 'Edit Kelas' : 'Tambah Kelas'} footer={<><button className="btn btn-outline" onClick={onClose} disabled={busy}>Batal</button><button className="btn btn-primary" onClick={submit} disabled={busy}>{busy && <Spinner />}Simpan</button></>}>
      <form className="col gap-16" onSubmit={submit} noValidate>
        {err && <Alert tone="err">{err}</Alert>}
        <div className="grid g2">
          <Field label="Nama kelas" required error={fe.name} hint="Contoh: VII-A"><input className={'input' + (fe.name ? ' err' : '')} value={v.name || ''} onChange={set('name')} disabled={busy} autoFocus /></Field>
          <Field label="Tingkat" required error={fe.grade}><select className={'select' + (fe.grade ? ' err' : '')} value={v.grade || ''} onChange={set('grade')} disabled={busy}><option value="">Pilih</option>{['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((g) => <option key={g} value={g}>Kelas {g}</option>)}</select></Field>
          <Field label="Tahun pelajaran" required error={fe.academic_year}><input className={'input' + (fe.academic_year ? ' err' : '')} value={v.academic_year || ''} onChange={set('academic_year')} placeholder="2026/2027" disabled={busy} /></Field>
          <Field label="Wali kelas" hint="Opsional"><input className="input" value={v.homeroom || ''} onChange={set('homeroom')} disabled={busy} /></Field>
        </div>
      </form>
    </Modal>
  );
}

function ClassesPage() {
  const { backend } = useApp(); const toast = useToast(); const confirm = useConfirm();
  const q = useTables(['classes', 'students', 'exams']);
  const [search, setSearch] = useState(''); const [year, setYear] = useState(''); const [form, setForm] = useState(null);
  const d = q.data || { classes: [], students: [], exams: [] };
  const count = (id) => d.students.filter((s) => s.class_id === id && s.status === 'aktif').length;
  const years = [...new Set(d.classes.map((c) => c.academic_year))].sort().reverse();
  const rows = d.classes.filter((c) => (!year || c.academic_year === year) && (!search || U.norm(c.name).includes(U.norm(search)) || U.norm(c.homeroom).includes(U.norm(search)))).sort((a, b) => (a.grade - b.grade) || a.name.localeCompare(b.name));
  const del = (c) => confirm({ title: 'Hapus kelas?', danger: true, confirmText: 'Hapus', message: <>Kelas <b>{c.name}</b> akan dihapus. Kelas yang masih memiliki siswa atau ujian tidak dapat dihapus.</>, onConfirm: async () => { await backend.remove('classes', c.id); backend.audit('delete', 'classes', c.id, c.name); toast.success('Kelas dihapus'); q.reload(true); } });
  return (
    <>
      <PageHead title="Data Kelas" desc="Kelola rombongan belajar per tahun pelajaran." actions={<button className="btn btn-primary" onClick={() => setForm({})} disabled={!q.data}><Icon name="Plus" size={16} />Tambah Kelas</button>} />
      <div className="card">
        <div className="toolbar"><SearchInput value={search} onChange={setSearch} placeholder="Cari nama kelas atau wali kelas…" /><select className="select" style={{ width: 180 }} value={year} onChange={(e) => setYear(e.target.value)} aria-label="Tahun pelajaran"><option value="">Semua tahun</option>{years.map((y) => <option key={y}>{y}</option>)}</select></div>
        {q.loading && !q.data ? <TableSkeleton cols={5} /> : q.error && !q.data ? <ErrorState error={q.error} onRetry={q.reload} />
          : !d.classes.length ? <EmptyState icon="School" title="Belum ada kelas" text="Buat kelas terlebih dahulu sebelum menambahkan siswa dan ujian." action={<button className="btn btn-primary" onClick={() => setForm({})}><Icon name="Plus" size={16} />Tambah Kelas</button>} />
          : !rows.length ? <EmptyState icon="SearchX" title="Tidak ditemukan" text="Tidak ada kelas yang cocok." />
          : <div className="table-wrap"><table className="table"><thead><tr><th>Nama kelas</th><th>Tingkat</th><th>Tahun pelajaran</th><th>Wali kelas</th><th className="right">Jumlah siswa</th><th className="right">Ujian</th><th className="actions">Aksi</th></tr></thead>
            <tbody>{rows.map((c) => (
              <tr key={c.id}>
                <td><button className="link-text" onClick={() => navigate('/admin/kelas/' + c.id)}>{c.name}</button></td>
                <td>Kelas {c.grade}</td><td>{c.academic_year}</td><td>{c.homeroom || <span className="faint">—</span>}</td>
                <td className="right bold">{count(c.id)}</td><td className="right">{d.exams.filter((e) => e.class_id === c.id).length}</td>
                <td className="actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/kelas/' + c.id)}><Icon name="Users" size={15} />Lihat siswa</button>
                  <button className="btn btn-ghost btn-icon btn-sm" title="Edit" onClick={() => setForm(c)}><Icon name="Pencil" size={16} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm icon-danger" title="Hapus" onClick={() => del(c)}><Icon name="Trash2" size={16} /></button>
                </td>
              </tr>))}</tbody></table></div>}
      </div>
      <ClassForm open={!!form} onClose={() => setForm(null)} initial={form && form.id ? form : null} onSaved={() => q.reload(true)} />
    </>
  );
}

function MoveStudents({ open, onClose, students, classes, fromId, onDone }) {
  const { backend } = useApp(); const toast = useToast();
  const [sel, setSel] = useState([]); const [to, setTo] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { if (open) { setSel([]); setTo(''); setErr(''); } }, [open]);
  const toggle = (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const go = async () => {
    if (!sel.length) { setErr('Pilih minimal satu siswa'); return; } if (!to) { setErr('Pilih kelas tujuan'); return; }
    setBusy(true); setErr('');
    try { await backend.updateMany('students', sel, { class_id: to }); backend.audit('move', 'students', null, `${sel.length} siswa → ${to}`); toast.success(`${sel.length} siswa dipindahkan`); onDone(); onClose(); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Pindahkan Siswa" footer={<><button className="btn btn-outline" onClick={onClose} disabled={busy}>Batal</button><button className="btn btn-primary" onClick={go} disabled={busy}>{busy && <Spinner />}Pindahkan {sel.length || ''} siswa</button></>}>
      <div className="col gap-16">
        {err && <Alert tone="err">{err}</Alert>}
        <Field label="Kelas tujuan" required><select className="select" value={to} onChange={(e) => setTo(e.target.value)} disabled={busy}><option value="">Pilih kelas</option>{classes.filter((c) => c.id !== fromId).map((c) => <option key={c.id} value={c.id}>{c.name} · {c.academic_year}</option>)}</select></Field>
        <div className="row between"><span className="label">Pilih siswa ({sel.length}/{students.length})</span><button className="btn btn-ghost btn-sm" onClick={() => setSel(sel.length === students.length ? [] : students.map((s) => s.id))}>{sel.length === students.length ? 'Batal pilih semua' : 'Pilih semua'}</button></div>
        <div className="card" style={{ maxHeight: 300, overflowY: 'auto', padding: 6 }}>
          {students.map((s) => <label key={s.id} className="menu-item"><input type="checkbox" checked={sel.includes(s.id)} onChange={() => toggle(s.id)} style={{ accentColor: 'var(--primary)' }} />{s.full_name}<span className="xs muted mono" style={{ marginLeft: 'auto' }}>{s.nisn || s.student_code}</span></label>)}
        </div>
      </div>
    </Modal>
  );
}

function ClassDetailPage({ id }) {
  const q = useTables(['classes', 'students', 'exams', 'subjects', 'grades']);
  const [form, setForm] = useState(false); const [move, setMove] = useState(false); const [addS, setAddS] = useState(false); const [tab, setTab] = useState('siswa');
  if (q.loading && !q.data) return <div className="card"><LoadingState /></div>;
  if (q.error && !q.data) return <div className="card"><ErrorState error={q.error} onRetry={q.reload} /></div>;
  const d = q.data; const c = d.classes.find((x) => x.id === id);
  if (!c) return <div className="card"><EmptyState icon="School" title="Kelas tidak ditemukan" action={<Link className="btn btn-outline" to="/admin/kelas">Kembali</Link>} /></div>;
  const students = d.students.filter((s) => s.class_id === id).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const exams = d.exams.filter((e) => e.class_id === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const subj = Object.fromEntries(d.subjects.map((s) => [s.id, s]));
  const examStats = exams.map((e) => { const g = d.grades.filter((x) => x.exam_id === e.id).map((x) => Number(x.score)); return Object.assign({ e }, U.stats(g, e.kktp)); });
  const studentAvg = (sid) => { const g = d.grades.filter((x) => x.student_id === sid && exams.some((e) => e.id === x.exam_id)).map((x) => Number(x.score)); return U.stats(g).avg; };
  return (
    <>
      <PageHead crumbs={[{ label: 'Data Kelas', to: '/admin/kelas' }, { label: c.name }]} title={'Kelas ' + c.name} desc={`Tingkat ${c.grade} · ${c.academic_year}${c.homeroom ? ' · Wali kelas: ' + c.homeroom : ''}`}
        actions={<><button className="btn btn-outline" onClick={() => setMove(true)} disabled={!students.length}><Icon name="ArrowRightLeft" size={16} />Pindahkan Siswa</button><button className="btn btn-outline" onClick={() => setForm(true)}><Icon name="Pencil" size={16} />Edit</button></>} />
      <div className="grid g3">
        <div className="card stat"><div className="s-top">Jumlah siswa<span className="s-ico ico-indigo"><Icon name="Users" size={17} /></span></div><div className="s-val">{students.filter((s) => s.status === 'aktif').length}</div><div className="s-sub">{students.length} terdaftar</div></div>
        <div className="card stat"><div className="s-top">Ujian kelas<span className="s-ico ico-slate"><Icon name="ClipboardList" size={17} /></span></div><div className="s-val">{exams.length}</div></div>
        <div className="card stat"><div className="s-top">Rata-rata kelas<span className="s-ico ico-green"><Icon name="Gauge" size={17} /></span></div><div className="s-val">{(() => { const a = U.stats(d.grades.filter((g) => exams.some((e) => e.id === g.exam_id)).map((g) => Number(g.score))).avg; return a === null ? '—' : U.fmtNum(a); })()}</div></div>
      </div>
      <div className="card">
        <div style={{ padding: '0 16px' }}><div className="tabs">{[['siswa', 'Daftar Siswa', 'Users'], ['ujian', 'Ujian Kelas', 'ClipboardList'], ['rekap', 'Rekap Nilai', 'ChartColumn']].map(([k, l, ic]) => <button key={k} className={'tab' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}><Icon name={ic} size={16} />{l}</button>)}</div></div>
        {tab === 'siswa' && (!students.length ? <EmptyState icon="Users" title="Belum ada siswa di kelas ini" action={<button className="btn btn-primary" onClick={() => setAddS(true)}><Icon name="Plus" size={16} />Tambah Siswa</button>} /> :
          <><div className="toolbar" style={{ justifyContent: 'flex-end' }}><button className="btn btn-soft btn-sm" onClick={() => setAddS(true)}><Icon name="Plus" size={15} />Tambah siswa ke kelas ini</button></div>
          <div className="table-wrap"><table className="table"><thead><tr><th className="num">No</th><th>NISN</th><th>Nama</th><th>Status</th><th className="right">Rata-rata</th></tr></thead>
            <tbody>{students.map((s, i) => { const a = studentAvg(s.id); return <tr key={s.id}><td className="num">{i + 1}</td><td className="mono">{s.nisn || '—'}</td><td><button className="link-text" onClick={() => navigate('/admin/siswa/' + s.id)}>{s.full_name}</button></td><td><Badge tone={s.status === 'aktif' ? 'green' : ''}>{s.status}</Badge></td><td className="right bold">{a === null ? <span className="faint">—</span> : U.fmtNum(a)}</td></tr>; })}</tbody></table></div></>)}
        {tab === 'ujian' && (!exams.length ? <EmptyState icon="ClipboardList" title="Belum ada ujian" action={<Link className="btn btn-primary" to="/admin/ujian?new=1">Buat Ujian</Link>} /> :
          <div className="table-wrap"><table className="table"><thead><tr><th>Ujian</th><th>Mapel</th><th>Tanggal</th><th>Status</th></tr></thead>
            <tbody>{exams.map((e) => <tr key={e.id}><td><button className="link-text" onClick={() => navigate('/admin/ujian/' + e.id)}>{e.name}</button></td><td>{(subj[e.subject_id] || {}).name}</td><td>{U.fmtDate(e.date)}</td><td><Badge tone={U.EXAM_STATUS[e.status][1]}>{U.EXAM_STATUS[e.status][0]}</Badge></td></tr>)}</tbody></table></div>)}
        {tab === 'rekap' && (!examStats.length ? <EmptyState icon="ChartColumn" title="Belum ada nilai" /> :
          <div className="table-wrap"><table className="table"><thead><tr><th>Ujian</th><th className="right">Dinilai</th><th className="right">Rata-rata</th><th className="right">Tertinggi</th><th className="right">Terendah</th><th className="right">Tuntas</th><th className="right">% Tuntas</th></tr></thead>
            <tbody>{examStats.map((s) => <tr key={s.e.id}><td><button className="link-text" onClick={() => navigate('/admin/ujian/' + s.e.id)}>{s.e.name}</button><div className="xs muted">{(subj[s.e.subject_id] || {}).name} · KKTP {s.e.kktp}</div></td><td className="right">{s.count}/{students.filter((x) => x.status === 'aktif').length}</td><td className="right bold">{U.fmtNum(s.avg)}</td><td className="right">{U.fmtNum(s.max)}</td><td className="right">{U.fmtNum(s.min)}</td><td className="right">{s.pass}</td><td className="right">{s.pct === null ? '—' : U.fmtNum(s.pct, 0) + '%'}</td></tr>)}</tbody></table></div>)}
      </div>
      <ClassForm open={form} onClose={() => setForm(false)} initial={c} onSaved={() => q.reload(true)} />
      <MoveStudents open={move} onClose={() => setMove(false)} students={students} classes={d.classes} fromId={id} onDone={() => q.reload(true)} />
      <StudentForm open={addS} onClose={() => setAddS(false)} initial={null} preset={{ class_id: id }} classes={d.classes} allStudents={d.students} onSaved={() => q.reload(true)} />
    </>
  );
}
// Pre-select class when adding from class detail
Object.assign(window, { ClassesPage, ClassDetailPage });
