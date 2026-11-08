/* Rekap Nilai & Grafik Perkembangan — filter terhubung, tabel ujian/tugas/manual,
 * grafik individu & kelas, export Word/PDF, dan print fleksibel (A4, portrait/landscape, tanda tangan). */

function Svg({ svg, style }) { return <div className="chart-svg" style={style} dangerouslySetInnerHTML={{ __html: svg }} />; }

function RecapPrintDoc({ R, opt }) {
  const t = opt.studentId ? RecapExport.detailData(R, opt.studentId) : RecapExport.tableData(R, opt);
  const charts = opt.showCharts ? RecapExport.chartSvgs(R, opt) : [];
  const S = R.summary; const sg = opt.signature || {};
  const stu = opt.studentId && R.rows.find((r) => r.s.id === opt.studentId);
  return (
    <div className="report">
      <h1>{opt.title}</h1>
      {opt.showSchool && <div className="r-school">{(opt.profile || {}).school_name || ''}</div>}
      <hr className="r-rule" />
      <div className="r-meta">{RecapExport.meta(R, opt).filter(([k]) => (opt.showSchool || k !== 'Nama sekolah') && (opt.showTeacher || k !== 'Nama guru')).map(([k, v]) => <div key={k}><span>{k}</span>: <b>{v}</b></div>)}{stu && <div><span>Nama siswa</span>: <b>{stu.s.full_name}</b></div>}</div>
      {!opt.studentId && <div className="r-stats"><div>Rata-rata<b>{RecapExport.f1(S.avg)}</b></div><div>Tertinggi<b>{RecapExport.f1(S.max)}</b></div><div>Terendah<b>{RecapExport.f1(S.min)}</b></div><div>Siswa tuntas<b>{S.studentsPass}</b></div><div>Belum tuntas<b>{S.studentsFail}</b></div><div>% Ketuntasan<b>{S.pctStudents === null ? '-' : RecapExport.f1(S.pctStudents) + '%'}</b></div></div>}
      {opt.showTable !== false && <table><thead><tr>{t.head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{t.body.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={j === 0 || (j >= 2 && !isNaN(parseFloat(String(c).replace(',', '.')))) ? { textAlign: 'center' } : null}>{c}</td>)}</tr>)}</tbody></table>}
      {charts.map((c) => <div key={c.title} className="r-chart"><div className="r-chart-title">{c.title}</div><Svg svg={c.svg} /></div>)}
      {sg.enabled && <div className="r-sign"><div>{sg.place ? sg.place + ', ' : ''}{sg.date || new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br />Mengetahui,<br />{sg.title || 'Guru Mata Pelajaran'}<br /><br /><br /><br /><b><u>{sg.name || '(........................................)'}</u></b>{sg.nip && <><br />NIP. {sg.nip}</>}</div></div>}
    </div>
  );
}

function RecapOutputModal({ open, onClose, R, f, mode, profile, students }) {
  const { backend, reloadSettings } = useApp(); const toast = useToast();
  const p = profile || {};
  const many = R && (R.exams.length > 6 || !f.class);
  const [o, setO] = useState({});
  const [busy, setBusy] = useState(false); const [step, setStep] = useState(1);
  useEffect(() => { if (open) { setStep(1); setO({ scope: 'kelas', content: 'both', studentId: '', orientation: many ? 'landscape' : 'portrait', showSchool: true, showTeacher: true, sigEnabled: !!p.sign_enabled, sigName: p.full_name || '', sigTitle: p.sign_title || 'Guru Mata Pelajaran', sigPlace: p.sign_place || '', sigNip: p.sign_nip || '', sigDate: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), remember: false }); } }, [open]);
  if (!open || !R) return null;
  const set = (k) => (e) => setO(Object.assign({}, o, { [k]: e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));
  const opt = { f, profile: p, orientation: o.orientation, studentId: o.scope === 'siswa' ? o.studentId : '', showTable: o.content !== 'chart', showCharts: o.content !== 'table', showSchool: o.showSchool, showTeacher: o.showTeacher,
    title: o.scope === 'siswa' ? 'REKAP NILAI SISWA' : f.subject ? 'REKAP NILAI ' + String((R.sMap[f.subject] || {}).name || '').toUpperCase() : 'REKAP NILAI KELAS',
    signature: { enabled: o.sigEnabled, name: o.sigName, title: o.sigTitle, place: o.sigPlace, nip: o.sigNip, date: o.sigDate },
    filename: ('rekap-nilai-' + (f.class ? (R.cMap[f.class] || {}).name : 'semua-kelas') + (o.scope === 'siswa' && o.studentId ? '-' + ((students.find((s) => s.s.id === o.studentId) || { s: {} }).s.full_name || '') : '')).replace(/[\\/:*?"<>|\s]+/g, '-').toLowerCase() };
  const valid = o.scope !== 'siswa' || o.studentId;
  const saveSig = async () => { if (!o.remember) return; try { await backend.saveProfile({ sign_enabled: o.sigEnabled, sign_title: o.sigTitle, sign_place: o.sigPlace, sign_nip: o.sigNip }); reloadSettings(); } catch (e) {} };
  const run = async () => {
    if (!valid) { toast.error('Pilih siswa terlebih dahulu'); return; }
    if (mode === 'print') { setStep(2); return; }
    setBusy(true);
    try { await saveSig(); if (mode === 'pdf') await RecapExport.pdf(R, opt); else await RecapExport.word(R, opt); toast.success((mode === 'pdf' ? 'PDF' : 'Dokumen Word') + ' berhasil dibuat'); onClose(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const doPrint = async () => { await saveSig(); printNode(<div className={'paper ' + (o.orientation === 'landscape' ? 'landscape' : '')}><style>{`@page{size:A4 ${o.orientation}}`}</style><RecapPrintDoc R={R} opt={opt} /></div>); };
  const title = { print: 'Print Rekap Nilai', pdf: 'Download Rekap (PDF)', word: 'Download Rekap (Word)' }[mode];
  return (
    <Modal open onClose={onClose} busy={busy} size={step === 2 ? 'xl' : 'lg'} title={step === 2 ? 'Preview Print' : title} subtitle="Data sesuai filter yang sedang dipilih"
      footer={step === 2 ? <><button className="btn btn-outline" onClick={() => setStep(1)}><Icon name="ArrowLeft" size={16} />Ubah pengaturan</button><button className="btn btn-primary" onClick={doPrint}><Icon name="Printer" size={16} />Print</button></>
        : <><button className="btn btn-outline" onClick={onClose} disabled={busy}>Batal</button><button className="btn btn-primary" onClick={run} disabled={busy || !valid}>{busy && <Spinner />}{mode === 'print' ? <><Icon name="Eye" size={16} />Preview Print</> : <><Icon name="Download" size={16} />Download {mode === 'pdf' ? 'PDF' : 'Word'}</>}</button></>}>
      {step === 2 ? <div className="paper-stage"><div className={'paper ' + (o.orientation === 'landscape' ? 'landscape' : '')}><RecapPrintDoc R={R} opt={opt} /></div></div> : (
        <div className="col gap-16">
          <div className="grid g2">
            <Field label="Cakupan"><select className="select" value={o.scope} onChange={set('scope')}><option value="kelas">{f.class ? 'Rekap seluruh kelas ' + (R.cMap[f.class] || {}).name : 'Rekap semua kelas (sesuai filter)'}</option><option value="siswa">Rekap siswa tertentu</option></select></Field>
            {o.scope === 'siswa' ? <Field label="Siswa" required><select className="select" value={o.studentId} onChange={set('studentId')}><option value="">Pilih siswa</option>{students.map((r) => <option key={r.s.id} value={r.s.id}>{r.s.full_name} · {(r.cls || {}).name}</option>)}</select></Field>
              : <Field label="Isi dokumen"><select className="select" value={o.content} onChange={set('content')}><option value="both">Tabel nilai dan grafik</option><option value="table">Tabel nilai saja</option><option value="chart">Grafik perkembangan saja</option></select></Field>}
            {o.scope === 'siswa' && <Field label="Isi dokumen"><select className="select" value={o.content} onChange={set('content')}><option value="both">Tabel nilai dan grafik</option><option value="table">Tabel nilai saja</option><option value="chart">Grafik perkembangan saja</option></select></Field>}
            <Field label="Kertas & orientasi"><div className="seg" style={{ width: '100%' }}>{[['portrait', 'A4 Portrait'], ['landscape', 'A4 Landscape']].map(([k, l]) => <button key={k} type="button" className={o.orientation === k ? 'on' : ''} style={{ flex: 1 }} onClick={() => set('orientation')(k)}>{l}</button>)}</div></Field>
          </div>
          <div className="row-wrap gap-16"><label className="check"><input type="checkbox" checked={o.showSchool} onChange={set('showSchool')} />Tampilkan identitas sekolah</label><label className="check"><input type="checkbox" checked={o.showTeacher} onChange={set('showTeacher')} />Tampilkan nama guru</label><label className="check"><input type="checkbox" checked={o.content !== 'table'} onChange={(e) => set('content')(e.target.checked ? 'both' : 'table')} />Tampilkan grafik</label></div>
          {many && o.orientation === 'portrait' && o.content !== 'chart' && <Alert tone="info">Tabel memiliki banyak kolom. Disarankan <b>A4 Landscape</b> agar tidak terpotong.</Alert>}
          <div className="card card-pad col gap-12" style={{ background: '#fafbff' }}>
            <div className="row between"><div><div className="semibold">Tanda tangan guru</div><div className="hint">Tidak wajib. Jika dinonaktifkan, bagian tanda tangan tidak dicetak.</div></div><Switch on={!!o.sigEnabled} onChange={(v) => set('sigEnabled')(v)} label="Tampilkan tanda tangan" /></div>
            {o.sigEnabled && <div className="grid g2">
              <Field label="Nama guru"><input className="input" value={o.sigName} onChange={set('sigName')} /></Field>
              <Field label="Jabatan"><input className="input" value={o.sigTitle} onChange={set('sigTitle')} /></Field>
              <Field label="Tempat"><input className="input" value={o.sigPlace} onChange={set('sigPlace')} placeholder="Contoh: Bandung" /></Field>
              <Field label="Tanggal"><input className="input" value={o.sigDate} onChange={set('sigDate')} /></Field>
              <Field label="NIP" hint="Opsional"><input className="input" value={o.sigNip} onChange={set('sigNip')} /></Field>
              <label className="check" style={{ alignSelf: 'end', paddingBottom: 10 }}><input type="checkbox" checked={o.remember} onChange={set('remember')} />Simpan sebagai default saya</label>
            </div>}
          </div>
        </div>)}
    </Modal>
  );
}

function RecapPage({ query }) {
  const { settings } = useApp();
  const q = useTables(['exams', 'classes', 'subjects', 'students', 'grades']);
  const [f, setF] = useState({ year: query.year || '', semester: query.semester || '', class: query.class || '', subject: query.subject || '', kind: query.kind || '' });
  const [status, setStatus] = useState(query.status || ''); const [view, setView] = useState(query.view || 'siswa');
  const [studentId, setStudentId] = useState(query.student || ''); const [out, setOut] = useState(null);
  useEffect(() => { setQuery({ ...f, status, view, student: studentId }); }, [f, status, view, studentId]);
  const R = useMemo(() => (q.data ? RecapData.build(q.data, f) : null), [q.data, f.year, f.semester, f.class, f.subject, f.kind]);
  useEffect(() => { if (R && studentId && !R.rows.some((r) => r.s.id === studentId)) setStudentId(''); }, [R]);
  if (q.loading && !q.data) return <><PageHead title="Rekap Nilai" /><div className="card"><TableSkeleton /></div></>;
  if (q.error && !q.data) return <div className="card"><ErrorState error={q.error} onRetry={q.reload} /></div>;
  const d = q.data; const S = R.summary;
  const rows = R.rows.filter((r) => !status || (status === 'tuntas' ? r.tuntas : status === 'belum' ? r.n > 0 && !r.tuntas : r.n === 0));
  const f1 = RecapExport.f1;
  // grafik
  const ct = RecapData.classTimeline(R);
  const tl = studentId ? RecapData.studentTimeline(R, studentId) : [];
  const stu = studentId && R.rows.find((r) => r.s.id === studentId);
  const sem = RecapData.perSemester(R); const pk = RecapData.perKind(R).filter((x) => x.n);
  const kc = { ujian: '#4f46e5', tugas: '#d97706', manual: '#16a34a' };
  const exportX = () => {
    const t = RecapExport.tableData(R, { f });
    U.downloadXlsx('rekap-nilai.xlsx', [{ name: 'Rekap Siswa', header: t.head, rows: t.body.map((r) => Object.fromEntries(t.head.map((h, i) => [h, r[i]]))) },
      { name: 'Per Penilaian', header: ['Tanggal', 'Jenis', 'Penilaian', 'Mapel', 'Kelas', 'Dinilai', 'Rata-rata', 'Tertinggi', 'Terendah', 'KKTP', 'Tuntas', '% Tuntas'], rows: R.perExam.map((p) => ({ Tanggal: p.e.date, Jenis: U.KINDS[p.kind], Penilaian: p.e.name, Mapel: (p.subject || {}).name, Kelas: (p.cls || {}).name, Dinilai: p.count, 'Rata-rata': p.avg === null ? '' : Math.round(p.avg * 100) / 100, Tertinggi: p.max ?? '', Terendah: p.min ?? '', KKTP: p.e.kktp, Tuntas: p.pass, '% Tuntas': p.pct === null ? '' : Math.round(p.pct) })) }]);
  };
  const empty = !R.exams.length;
  return (
    <>
      <PageHead title="Rekap Nilai" desc="Analisis perkembangan siswa dan kelas berdasarkan filter. Semua data hanya milik akun Anda."
        actions={<><button className="btn btn-outline" onClick={exportX} disabled={!R.grades.length}><Icon name="FileSpreadsheet" size={16} />Excel</button><button className="btn btn-outline" onClick={() => setOut('word')} disabled={empty}><Icon name="FileText" size={16} />Word</button><button className="btn btn-outline" onClick={() => setOut('pdf')} disabled={empty}><Icon name="FileDown" size={16} />PDF</button><button className="btn btn-primary" onClick={() => setOut('print')} disabled={empty}><Icon name="Printer" size={16} />Print</button></>} />
      <div className="card card-pad col gap-16">
        <AcademicFilters value={f} onChange={(v) => setF(Object.assign({}, v, { kind: f.kind }))} data={d} />
        <div className="row-wrap gap-16"><span className="label">Jenis penilaian</span><div className="seg">{[['', 'Semua'], ['ujian', 'Ujian saja'], ['tugas', 'Tugas saja'], ['manual', 'Nilai manual saja']].map(([k, l]) => <button key={k} className={f.kind === k ? 'on' : ''} onClick={() => setF(Object.assign({}, f, { kind: k }))}>{l}</button>)}</div></div>
      </div>
      {empty ? <div className="card"><EmptyState icon="ChartColumn" title="Belum ada nilai untuk dianalisis" text="Tidak ada penilaian untuk filter ini. Ubah filter, atau buat ujian/tugas/penilaian manual terlebih dahulu." /></div> : <>
        <div className="grid g3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
          {[['Rata-rata', f1(S.avg), 'Gauge', 'indigo'], ['Nilai tertinggi', f1(S.max), 'TrendingUp', 'green'], ['Nilai terendah', f1(S.min), 'TrendingDown', 'red'], ['Siswa tuntas', S.studentsPass, 'CircleCheck', 'green'], ['Siswa belum tuntas', S.studentsFail, 'CircleX', 'red'], ['% Ketuntasan', S.pctStudents === null ? '—' : f1(S.pctStudents) + '%', 'Percent', 'amber']].map(([l, v, ic, t]) => <div key={l} className="card stat"><div className="s-top">{l}<span className={'s-ico ico-' + t}><Icon name={ic} size={17} /></span></div><div className="s-val">{v}</div></div>)}
        </div>
        <div className="card">
          <div className="card-head"><div><div className="card-title">Grafik perkembangan siswa</div><div className="card-sub">Nilai per penilaian berdasarkan tanggal · warna titik = jenis penilaian</div></div>
            <select className="select select-sm" style={{ width: 260 }} value={studentId} onChange={(e) => setStudentId(e.target.value)} aria-label="Pilih siswa"><option value="">Pilih siswa…</option>{R.rows.filter((r) => r.n).map((r) => <option key={r.s.id} value={r.s.id}>{r.s.full_name} · {(r.cls || {}).name}</option>)}</select></div>
          <div className="card-pad">{!studentId ? <div className="state" style={{ padding: 28 }}><Icon name="UserRound" size={22} style={{ color: 'var(--faint)' }} /><p>Pilih siswa untuk melihat perkembangan nilainya dari waktu ke waktu.</p></div>
            : !tl.length ? <div className="state" style={{ padding: 28 }}><p>Belum ada nilai untuk siswa ini pada filter yang dipilih.</p></div>
            : <><Svg svg={Charts.line({ categories: tl.map((p) => p.e.name), series: [{ name: stu.s.full_name, color: '#4f46e5', values: tl.map((p) => p.score), kinds: tl.map((p) => U.kindOf(p.e)) }], kktp: R.kktp })} />
              <div className="table-wrap mt-12"><table className="table"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Penilaian</th><th>Mapel</th><th>Semester</th><th className="right">Nilai</th><th>Status</th></tr></thead><tbody>{tl.map((p, i) => { const prev = i ? tl[i - 1].score : null; return <tr key={p.e.id}><td className="nowrap small">{U.fmtDate(p.e.date)}</td><td><Badge tone={U.kindOf(p.e) === 'tugas' ? 'amber' : U.kindOf(p.e) === 'manual' ? 'green' : 'indigo'}>{U.KINDS[U.kindOf(p.e)]}</Badge></td><td><button className="link-text" onClick={() => navigate('/admin/ujian/' + p.e.id)}>{p.e.name}</button></td><td>{(R.sMap[p.e.subject_id] || {}).name}</td><td className="small">{p.e.semester} {p.e.academic_year}</td><td className="right"><ScoreBadge score={p.score} kktp={Number(p.e.kktp)} />{prev !== null && <span className="xs" style={{ marginLeft: 6, color: p.score >= prev ? 'var(--green-600)' : 'var(--red)' }}>{p.score >= prev ? '▲' : '▼'}{f1(Math.abs(p.score - prev))}</span>}</td><td><PassBadge score={p.score} kktp={Number(p.e.kktp)} /></td></tr>; })}</tbody></table></div></>}
          </div>
        </div>
        <div className="grid g2">
          <div className="card"><div className="card-head"><div><div className="card-title">Perkembangan kelas</div><div className="card-sub">Rata-rata, tertinggi & terendah per penilaian{f.class ? '' : ' (pilih kelas untuk analisis satu kelas)'}</div></div></div><div className="card-pad">{ct.length ? <Svg svg={Charts.line({ categories: ct.map((p) => p.e.name), series: [{ name: 'Rata-rata', color: '#4f46e5', values: ct.map((p) => p.avg), kinds: ct.map((p) => p.kind) }, { name: 'Tertinggi', color: '#16a34a', values: ct.map((p) => p.max), dashed: true }, { name: 'Terendah', color: '#dc2626', values: ct.map((p) => p.min), dashed: true }], kktp: R.kktp, w: 760, h: 320 })} /> : <div className="state" style={{ padding: 28 }}><p>Belum ada nilai untuk dianalisis.</p></div>}</div></div>
          <div className="col gap-16">
            <div className="card"><div className="card-head"><div className="card-title">Ketuntasan siswa</div><span className="xs muted">Tuntas = semua nilai ≥ KKTP</span></div><div className="card-pad"><Svg svg={Charts.pass({ pass: S.studentsPass, fail: S.studentsFail })} /></div></div>
            <div className="card"><div className="card-head"><div className="card-title">Rata-rata per jenis penilaian</div></div><div className="card-pad">{pk.length ? <Svg svg={Charts.bars({ categories: pk.map((x) => x.label), values: pk.map((x) => x.value), colors: pk.map((x) => kc[x.kind]), kktp: R.kktp, h: 220 })} /> : <p className="muted">Belum ada data.</p>}</div></div>
          </div>
        </div>
        {sem.length > 1 && <div className="card"><div className="card-head"><div className="card-title">Perbandingan antarsemester</div></div><div className="card-pad"><Svg svg={Charts.bars({ categories: sem.map((x) => x.label), values: sem.map((x) => x.value), kktp: R.kktp, h: 240 })} /></div></div>}
        <div className="card">
          <div className="card-head"><div className="seg"><button className={view === 'siswa' ? 'on' : ''} onClick={() => setView('siswa')}>Per siswa</button><button className={view === 'ujian' ? 'on' : ''} onClick={() => setView('ujian')}>Per penilaian</button></div>
            {view === 'siswa' && <select className="select select-sm" style={{ width: 200 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter ketuntasan"><option value="">Semua ketuntasan</option><option value="tuntas">Tuntas</option><option value="belum">Belum tuntas</option><option value="kosong">Belum dinilai</option></select>}</div>
          {view === 'siswa' ? (!rows.length ? <EmptyState icon="Users" title="Tidak ada siswa untuk filter ini" /> :
            <div className="table-wrap"><table className="table"><thead><tr><th className="num">No</th><th>Nama siswa</th><th>Kelas</th><th className="right">Ujian</th><th className="right">Tugas</th><th className="right">Manual</th><th className="right">Rata-rata</th><th className="right">Tertinggi</th><th className="right">Terendah</th><th className="right">KKTP</th><th>Ketuntasan</th><th></th></tr></thead>
              <tbody>{rows.map((r, i) => <tr key={r.s.id}><td className="num">{i + 1}</td><td><button className="link-text" onClick={() => navigate('/admin/siswa/' + r.s.id)}>{r.s.full_name}</button></td><td>{(r.cls || {}).name}</td><td className="right">{f1(r.ujian)}</td><td className="right">{f1(r.tugas)}</td><td className="right">{f1(r.manual)}</td><td className="right bold">{r.avg === null ? <span className="faint">—</span> : <ScoreBadge score={r.avg} kktp={r.kktp} />}</td><td className="right">{f1(r.max)}</td><td className="right">{f1(r.min)}</td><td className="right muted">{f1(r.kktp)}</td><td>{!r.n ? <Badge>Belum dinilai</Badge> : r.tuntas ? <Badge tone="green" dot>Tuntas</Badge> : <Badge tone="red" dot>{r.fails} belum tuntas</Badge>}</td><td>{r.n > 0 && <button className="btn btn-ghost btn-icon btn-sm" title="Lihat grafik siswa" onClick={() => { setStudentId(r.s.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Icon name="ChartLine" size={16} /></button>}</td></tr>)}</tbody></table></div>)
            : <div className="table-wrap"><table className="table"><thead><tr><th>Tanggal</th><th>Penilaian</th><th>Kelas</th><th className="right">Dinilai</th><th className="right">Rata-rata</th><th className="right">Maks</th><th className="right">Min</th><th className="right">Tuntas</th><th className="right">% Tuntas</th></tr></thead>
              <tbody>{R.perExam.map((p) => <tr key={p.e.id}><td className="small nowrap">{U.fmtDate(p.e.date)}</td><td><div className="row gap-6"><Badge tone={p.kind === 'tugas' ? 'amber' : p.kind === 'manual' ? 'green' : 'indigo'}>{U.KINDS[p.kind]}</Badge><button className="link-text" onClick={() => navigate(p.kind === 'manual' ? '/admin/nilai?exam=' + p.e.id : '/admin/ujian/' + p.e.id)}>{p.e.name}</button></div><div className="xs muted">{(p.subject || {}).name} · KKTP {p.e.kktp}</div></td><td>{(p.cls || {}).name}</td><td className="right">{p.count}/{p.size}</td><td className="right bold">{f1(p.avg)}</td><td className="right">{f1(p.max)}</td><td className="right">{f1(p.min)}</td><td className="right">{p.pass}</td><td className="right">{p.pct === null ? '—' : f1(p.pct) + '%'}</td></tr>)}</tbody></table></div>}
        </div>
      </>}
      <RecapOutputModal open={!!out} onClose={() => setOut(null)} R={R} f={f} mode={out} profile={settings && settings.profile} students={R.rows.filter((r) => r.n)} />
    </>
  );
}

Object.assign(window, { RecapPage });
