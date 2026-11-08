/* Publikasi Nilai */

function PublicationPage({ query }) {
  const { backend } = useApp(); const toast = useToast(); const confirm = useConfirm();
  const q = useTables(['exams', 'classes', 'subjects', 'students', 'grades', 'publication_settings']);
  const [f, setF] = useState({ year: query.year || '', semester: query.semester || '', class: query.class || '', subject: query.subject || '' });
  const [status, setStatus] = useState(query.status || ''); const [busyId, setBusyId] = useState(null); const [preview, setPreview] = useState(null);
  useEffect(() => { setQuery({ ...f, status }); }, [f, status]);
  if (q.loading && !q.data) return <><PageHead title="Publikasi Nilai" /><div className="card"><TableSkeleton /></div></>;
  if (q.error && !q.data) return <div className="card"><ErrorState error={q.error} onRetry={q.reload} /></div>;
  const d = q.data;
  const pub = Object.fromEntries(d.publication_settings.map((p) => [p.exam_id, p]));
  const cMap = Object.fromEntries(d.classes.map((c) => [c.id, c])); const sMap = Object.fromEntries(d.subjects.map((c) => [c.id, c]));
  const rows = filterExams(d.exams, f).filter((e) => !status || (status === 'published' ? pub[e.id] && pub[e.id].is_published : !(pub[e.id] && pub[e.id].is_published))).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const setPub = async (e, on) => {
    const nG = d.grades.filter((g) => g.exam_id === e.id).length; const n = d.students.filter((s) => s.class_id === e.class_id && s.status === 'aktif').length;
    if (on) { const ok = await confirm({ title: 'Publikasikan nilai?', confirmText: 'Publikasikan', message: <div className="col"><div>Nilai ujian <b>{e.name}</b> ({cMap[e.class_id].name}) akan dapat dilihat siswa melalui Portal Siswa.</div>{nG < n && <Alert tone="warn">{n - nG} dari {n} siswa belum memiliki nilai. Mereka akan melihat bahwa nilai belum tersedia.</Alert>}</div> }); if (!ok) return; }
    setBusyId(e.id);
    try { await backend.setPublication(e.id, on); backend.audit(on ? 'publish' : 'unpublish', 'exams', e.id, e.name); toast.success(on ? 'Nilai dipublikasikan' : 'Nilai disembunyikan dari Portal Siswa'); await q.reload(true); }
    catch (x) { toast.error('Gagal menyimpan: ' + x.message); } finally { setBusyId(null); }
  };
  const openPreview = (e) => { const students = d.students.filter((s) => s.class_id === e.class_id).sort((a, b) => a.full_name.localeCompare(b.full_name)); const gmap = Object.fromEntries(d.grades.filter((g) => g.exam_id === e.id).map((g) => [g.student_id, g])); setPreview({ e, students: students.filter((s) => s.status === 'aktif' || gmap[s.id]), gmap, pick: '' }); };
  const nPub = d.exams.filter((e) => pub[e.id] && pub[e.id].is_published).length;
  return (
    <>
      <PageHead title="Publikasi Nilai" desc="Hanya nilai dari ujian yang dipublikasikan yang tampil di Portal Siswa." actions={<Link className="btn btn-outline" to="/admin/portal"><Icon name="Globe" size={16} />Pengaturan Portal</Link>} />
      <div className="grid g3">
        <div className="card stat"><div className="s-top">Terpublikasi<span className="s-ico ico-green"><Icon name="Eye" size={17} /></span></div><div className="s-val">{nPub}</div></div>
        <div className="card stat"><div className="s-top">Disembunyikan<span className="s-ico ico-slate"><Icon name="EyeOff" size={17} /></span></div><div className="s-val">{d.exams.length - nPub}</div></div>
        <PortalMini />
      </div>
      <div className="card">
        <div className="card-pad" style={{ borderBottom: '1px solid var(--border-2)' }}><AcademicFilters value={f} onChange={setF} data={d} /></div>
        <div className="toolbar"><div className="seg">{[['', 'Semua'], ['published', 'Terpublikasi'], ['hidden', 'Disembunyikan']].map(([k, l]) => <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}</button>)}</div></div>
        {!d.exams.length ? <EmptyState icon="Megaphone" title="Belum ada ujian" /> : !rows.length ? <EmptyState icon="SearchX" title="Tidak ada ujian untuk filter ini" /> :
          <div className="table-wrap"><table className="table"><thead><tr><th>Ujian</th><th>Kelas</th><th>Mata pelajaran</th><th className="right">Siswa dinilai</th><th>Status publikasi</th><th className="actions">Aksi</th></tr></thead>
            <tbody>{rows.map((e) => { const p = pub[e.id]; const on = p && p.is_published; const nG = d.grades.filter((g) => g.exam_id === e.id).length; const n = d.students.filter((s) => s.class_id === e.class_id && s.status === 'aktif').length; return (
              <tr key={e.id}>
                <td><button className="link-text" onClick={() => navigate('/admin/ujian/' + e.id)}>{e.name}</button><div className="xs muted">{U.KINDS[U.kindOf(e)]} · {U.typeLabel(e)} · {U.fmtDate(e.date)}</div></td>
                <td>{(cMap[e.class_id] || {}).name}</td><td>{(sMap[e.subject_id] || {}).name}</td><td className="right">{nG}/{n}</td>
                <td>{on ? <div><Badge tone="green" dot>Terpublikasi</Badge><div className="xs muted mt-4">{U.fmtDateTime(p.published_at)}</div></div> : <Badge dot>Disembunyikan</Badge>}</td>
                <td className="actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => openPreview(e)}><Icon name="ScanEye" size={15} />Preview</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/ujian/' + e.id)}>Detail</button>
                  {on ? <button className="btn btn-outline btn-sm" onClick={() => setPub(e, false)} disabled={busyId === e.id}>{busyId === e.id ? <Spinner /> : <Icon name="EyeOff" size={15} />}Sembunyikan</button>
                    : <button className="btn btn-green btn-sm" onClick={() => setPub(e, true)} disabled={busyId === e.id || !nG} title={!nG ? 'Belum ada nilai' : ''}>{busyId === e.id ? <Spinner /> : <Icon name="Send" size={15} />}Publikasikan</button>}
                </td>
              </tr>); })}</tbody></table></div>}
      </div>
      {preview && <Modal open onClose={() => setPreview(null)} size="lg" title="Preview tampilan siswa" subtitle={`${preview.e.name} · ${cMap[preview.e.class_id].name}`}>
        <div className="col gap-16">
          <Alert tone={pub[preview.e.id] && pub[preview.e.id].is_published ? 'ok' : 'warn'}>{pub[preview.e.id] && pub[preview.e.id].is_published ? 'Ujian ini sudah terpublikasi — siswa melihat nilai seperti di bawah.' : 'Ujian ini belum dipublikasikan — siswa BELUM dapat melihat nilai ini.'}</Alert>
          <Field label="Lihat sebagai siswa"><select className="select" value={preview.pick} onChange={(ev) => setPreview({ ...preview, pick: ev.target.value })}><option value="">Pilih siswa…</option>{preview.students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>
          {preview.pick ? (() => { const s = preview.students.find((x) => x.id === preview.pick); const g = preview.gmap[s.id]; return (
            <div className="card"><div className="card-pad row"><div className="avatar">{U.initials(s.full_name)}</div><div><div className="bold">{s.full_name}</div><div className="small muted">Kelas {cMap[s.class_id].name}</div></div></div>
              <table className="table"><thead><tr><th>Mata Pelajaran</th><th>Ujian</th><th className="right">Nilai</th><th>Status</th></tr></thead><tbody><tr><td>{sMap[preview.e.subject_id].name}</td><td>{preview.e.name}</td><td className="right"><ScoreBadge score={g ? Number(g.score) : null} kktp={preview.e.kktp} /></td><td>{g ? <PassBadge score={Number(g.score)} kktp={preview.e.kktp} /> : <Badge>Nilai belum tersedia</Badge>}</td></tr></tbody></table></div>); })()
            : <div className="card table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}><table className="table"><thead><tr><th>Siswa</th><th className="right">Nilai</th><th>Status</th></tr></thead><tbody>{preview.students.map((s) => { const g = preview.gmap[s.id]; return <tr key={s.id}><td>{s.full_name}</td><td className="right"><ScoreBadge score={g ? Number(g.score) : null} kktp={preview.e.kktp} /></td><td><PassBadge score={g ? Number(g.score) : null} kktp={preview.e.kktp} emptyLabel="Nilai belum tersedia" /></td></tr>; })}</tbody></table></div>}
          <p className="xs muted">Di Portal Siswa, setiap siswa hanya melihat nilainya sendiri setelah verifikasi identitas.</p>
        </div>
      </Modal>}
    </>
  );
}
function PortalMini() {
  const { settings } = useApp(); const on = settings && settings.portal && settings.portal.enabled;
  return <button className="card stat" onClick={() => navigate('/admin/portal')}><div className="s-top">Portal Siswa<span className={'s-ico ' + (on ? 'ico-green' : 'ico-red')}><Icon name="Globe" size={17} /></span></div><div className="s-val" style={{ fontSize: 22 }}>{on ? 'Aktif' : 'Ditutup'}</div><div className="s-sub">{on ? 'Siswa dapat mencari nilai' : 'Siswa belum bisa mengakses — atur →'}</div></button>;
}

Object.assign(window, { PublicationPage });
