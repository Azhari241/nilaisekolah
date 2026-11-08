/* Laporan cetak A4: Daftar Nilai, Rekap, Individu, Analisis Ketuntasan */

function ReportHeader({ title, school, meta }) {
  return (
    <>
      <h1>{title}</h1>
      <div className="r-school">{school || 'Nama sekolah belum diatur (Pengaturan → Profil)'}</div>
      <hr className="r-rule" />
      <div className="r-meta">{meta.map(([k, v]) => <div key={k}><span>{k}</span>: <b>{v}</b></div>)}<div><span>Tanggal cetak</span>: <b>{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</b></div></div>
    </>
  );
}
function ReportSign({ teacher }) {
  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  return <div className="r-sign"><div>{today}<br />Guru Mata Pelajaran<br /><br /><br /><br /><b><u>{teacher || '........................................'}</u></b></div></div>;
}

/* ctx: { exam, cls, subject, students, grades(map student_id->grade), profile } */
function ReportDaftar({ ctx }) {
  const { exam, cls, subject, students, gmap, profile } = ctx;
  return (
    <div className="report">
      <ReportHeader title="Daftar Nilai Kelas" school={profile.school_name} meta={[['Ujian', exam.name], ['Mata pelajaran', subject.name], ['Kelas', cls.name], ['Jenis ujian', exam.exam_type], ['Semester / TP', `${exam.semester} / ${exam.academic_year}`], ['KKTP', exam.kktp]]} />
      <table><thead><tr><th style={{ width: 30 }}>No</th><th style={{ width: 95 }}>NISN</th><th>Nama Siswa</th><th style={{ width: 55 }}>Nilai</th><th style={{ width: 45 }}>KKTP</th><th style={{ width: 95 }}>Ketuntasan</th></tr></thead>
        <tbody>{students.map((s, i) => { const g = gmap[s.id]; const v = g ? Number(g.score) : null; return <tr key={s.id}><td style={{ textAlign: 'center' }}>{i + 1}</td><td>{s.nisn || '-'}</td><td>{s.full_name}</td><td style={{ textAlign: 'center' }}>{v === null ? '-' : U.fmtNum(v, 2)}</td><td style={{ textAlign: 'center' }}>{exam.kktp}</td><td>{v === null ? 'Belum dinilai' : v >= exam.kktp ? 'Tuntas' : 'Belum tuntas'}</td></tr>; })}</tbody></table>
      <ReportSign teacher={profile.full_name} />
    </div>
  );
}
function ReportRekap({ ctx }) {
  const { exam, cls, subject, students, gmap, profile } = ctx;
  const st = U.stats(students.map((s) => gmap[s.id] ? Number(gmap[s.id].score) : null), exam.kktp);
  return (
    <div className="report">
      <ReportHeader title="Rekap Nilai" school={profile.school_name} meta={[['Ujian', exam.name], ['Mata pelajaran', subject.name], ['Kelas', cls.name], ['Semester / TP', `${exam.semester} / ${exam.academic_year}`], ['KKTP', exam.kktp], ['Jumlah siswa', students.length]]} />
      <div className="r-stats">
        <div>Rata-rata<b>{U.fmtNum(st.avg, 2)}</b></div><div>Nilai tertinggi<b>{U.fmtNum(st.max, 2)}</b></div><div>Nilai terendah<b>{U.fmtNum(st.min, 2)}</b></div>
        <div>Jumlah dinilai<b>{st.count} / {students.length}</b></div><div>Tuntas<b>{st.pass}</b></div><div>Belum tuntas<b>{st.fail}</b></div>
      </div>
      <table><thead><tr><th>Rentang nilai</th><th style={{ width: 120 }}>Jumlah siswa</th><th style={{ width: 120 }}>Persentase</th></tr></thead>
        <tbody>{U.distribution(students.map((s) => gmap[s.id] && Number(gmap[s.id].score)).filter((x) => x !== undefined)).map((b) => <tr key={b.label}><td>{b.label}</td><td style={{ textAlign: 'center' }}>{b.value}</td><td style={{ textAlign: 'center' }}>{st.count ? U.fmtNum((b.value / st.count) * 100, 1) + '%' : '-'}</td></tr>)}</tbody></table>
      <ReportSign teacher={profile.full_name} />
    </div>
  );
}
function ReportAnalisis({ ctx }) {
  const { exam, cls, subject, students, gmap, profile } = ctx;
  const st = U.stats(students.map((s) => gmap[s.id] ? Number(gmap[s.id].score) : null), exam.kktp);
  const missing = students.filter((s) => !gmap[s.id]);
  const remed = students.filter((s) => gmap[s.id] && Number(gmap[s.id].score) < exam.kktp);
  return (
    <div className="report">
      <ReportHeader title="Analisis Ketuntasan" school={profile.school_name} meta={[['Ujian', exam.name], ['Mata pelajaran', subject.name], ['Kelas', cls.name], ['Semester / TP', `${exam.semester} / ${exam.academic_year}`], ['KKTP', exam.kktp], ['Tanggal ujian', U.fmtDate(exam.date)]]} />
      <table><thead><tr><th>Keterangan</th><th style={{ width: 110 }}>Jumlah</th><th style={{ width: 110 }}>Persentase</th></tr></thead>
        <tbody>
          <tr><td>Siswa tuntas (nilai ≥ {exam.kktp})</td><td style={{ textAlign: 'center' }}>{st.pass}</td><td style={{ textAlign: 'center' }}>{st.count ? U.fmtNum(st.pct, 1) + '%' : '-'}</td></tr>
          <tr><td>Siswa belum tuntas</td><td style={{ textAlign: 'center' }}>{st.fail}</td><td style={{ textAlign: 'center' }}>{st.count ? U.fmtNum(100 - st.pct, 1) + '%' : '-'}</td></tr>
          <tr><td>Belum dinilai / belum mengikuti</td><td style={{ textAlign: 'center' }}>{missing.length}</td><td style={{ textAlign: 'center' }}>-</td></tr>
        </tbody></table>
      <p style={{ margin: '10px 0' }}>Ketuntasan klasikal: <b>{st.count ? U.fmtNum(st.pct, 1) + '%' : '-'}</b> dari {st.count} siswa yang dinilai.</p>
      <h3 style={{ fontSize: '11pt', margin: '14px 0 6px' }}>Daftar siswa perlu remedial</h3>
      {remed.length ? <table><thead><tr><th style={{ width: 30 }}>No</th><th>Nama</th><th style={{ width: 70 }}>Nilai</th><th style={{ width: 90 }}>Selisih KKTP</th></tr></thead><tbody>{remed.map((s, i) => <tr key={s.id}><td style={{ textAlign: 'center' }}>{i + 1}</td><td>{s.full_name}</td><td style={{ textAlign: 'center' }}>{U.fmtNum(Number(gmap[s.id].score), 2)}</td><td style={{ textAlign: 'center' }}>{U.fmtNum(Number(gmap[s.id].score) - exam.kktp, 2)}</td></tr>)}</tbody></table> : <p>Tidak ada.</p>}
      {missing.length > 0 && <><h3 style={{ fontSize: '11pt', margin: '14px 0 6px' }}>Belum dinilai</h3><p>{missing.map((s) => s.full_name).join(', ')}</p></>}
      <ReportSign teacher={profile.full_name} />
    </div>
  );
}
/* individu: per siswa, semua nilai pada kelas & filter */
function ReportIndividu({ ctx }) {
  const { students, allExams, allGrades, subjects, cls, profile, onlyStudent } = ctx;
  const list = onlyStudent ? students.filter((s) => s.id === onlyStudent) : students;
  const sMap = Object.fromEntries(subjects.map((s) => [s.id, s]));
  return <>{list.map((s, idx) => {
    const rows = allExams.map((e) => ({ e, g: allGrades.find((g) => g.exam_id === e.id && g.student_id === s.id) }));
    const st = U.stats(rows.filter((r) => r.g).map((r) => Number(r.g.score)));
    return (
      <div className={'report' + (idx < list.length - 1 ? ' page-break' : '')} key={s.id} style={idx < list.length - 1 ? { marginBottom: 24 } : null}>
        <ReportHeader title="Lembar Nilai Individu" school={profile.school_name} meta={[['Nama', s.full_name], ['NISN', s.nisn || '-'], ['Kelas', cls.name], ['NIS', s.nis || '-']]} />
        <table><thead><tr><th style={{ width: 30 }}>No</th><th>Ujian</th><th>Mata pelajaran</th><th style={{ width: 80 }}>Smt/TP</th><th style={{ width: 50 }}>Nilai</th><th style={{ width: 45 }}>KKTP</th><th style={{ width: 85 }}>Ketuntasan</th></tr></thead>
          <tbody>{rows.length ? rows.map(({ e, g }, i) => <tr key={e.id}><td style={{ textAlign: 'center' }}>{i + 1}</td><td>{e.name}</td><td>{(sMap[e.subject_id] || {}).name}</td><td>{e.semester} {e.academic_year}</td><td style={{ textAlign: 'center' }}>{g ? U.fmtNum(Number(g.score), 2) : '-'}</td><td style={{ textAlign: 'center' }}>{e.kktp}</td><td>{g ? (Number(g.score) >= e.kktp ? 'Tuntas' : 'Belum tuntas') : 'Belum dinilai'}</td></tr>) : <tr><td colSpan="7" style={{ textAlign: 'center' }}>Tidak ada ujian</td></tr>}</tbody></table>
        <p style={{ marginTop: 10 }}>Rata-rata: <b>{U.fmtNum(st.avg, 2)}</b> dari {st.count} nilai.</p>
        <ReportSign teacher={profile.full_name} />
      </div>
    );
  })}</>;
}

const REPORTS = [
  { id: 'daftar', label: 'Daftar Nilai Kelas', desc: 'Nama, NISN, nilai, KKTP, ketuntasan', icon: 'ListOrdered', C: ReportDaftar },
  { id: 'rekap', label: 'Rekap Nilai', desc: 'Rata-rata, tertinggi, terendah, tuntas', icon: 'ChartColumn', C: ReportRekap },
  { id: 'individu', label: 'Lembar Nilai Individu', desc: 'Satu halaman per siswa', icon: 'UserRound', C: ReportIndividu },
  { id: 'analisis', label: 'Analisis Ketuntasan', desc: 'Persentase & daftar remedial', icon: 'ChartPie', C: ReportAnalisis },
];

function PrintModal({ open, onClose, ctx, initial }) {
  const [type, setType] = useState(initial || 'daftar'); const [step, setStep] = useState(1); const [only, setOnly] = useState('');
  useEffect(() => { if (open) { setStep(1); setType(initial || 'daftar'); setOnly(''); } }, [open]);
  if (!ctx) return null;
  const R = REPORTS.find((r) => r.id === type); const fullCtx = Object.assign({}, ctx, { onlyStudent: only });
  const doPrint = () => printNode(<div className="paper"><R.C ctx={fullCtx} /></div>);
  const exportX = () => {
    const { exam, cls, subject, students, gmap } = ctx;
    U.downloadXlsx(`nilai-${cls.name}-${subject.name}-${exam.name}.xlsx`.replace(/[\\/:*?"<>|]+/g, '-'), [{ name: 'Nilai', header: ['No', 'NISN', 'Nama Siswa', 'Nilai', 'KKTP', 'Ketuntasan', 'Sumber'], widths: [5, 14, 32, 8, 8, 14, 14], rows: students.map((s, i) => { const g = gmap[s.id]; return { No: i + 1, NISN: s.nisn || '', 'Nama Siswa': s.full_name, Nilai: g ? Number(g.score) : '', KKTP: exam.kktp, Ketuntasan: g ? (Number(g.score) >= exam.kktp ? 'Tuntas' : 'Belum tuntas') : 'Belum dinilai', Sumber: g ? (g.source === 'manual' ? 'Manual' : 'Google Forms') : '' }; }) }]);
  };
  return (
    <Modal open={open} onClose={onClose} size={step === 2 ? 'xl' : 'lg'} title={step === 1 ? 'Print Laporan Nilai' : 'Preview: ' + R.label} subtitle={`${ctx.exam.name} · ${ctx.cls.name}`}
      footer={step === 1 ? <><button className="btn btn-outline" onClick={exportX}><Icon name="FileSpreadsheet" size={16} />Export Excel</button><span className="grow" /><button className="btn btn-outline" onClick={onClose}>Batal</button><button className="btn btn-primary" onClick={() => setStep(2)}><Icon name="Eye" size={16} />Preview Print</button></>
        : <><button className="btn btn-outline" onClick={() => setStep(1)}><Icon name="ArrowLeft" size={16} />Ubah pilihan</button><button className="btn btn-primary" onClick={doPrint}><Icon name="Printer" size={16} />Print</button></>}>
      {step === 1 ? <div className="col gap-16">
        <div className="grid g2">{REPORTS.map((r) => (
          <button key={r.id} className="card card-pad row" style={{ textAlign: 'left', cursor: 'pointer', borderColor: type === r.id ? 'var(--primary)' : undefined, boxShadow: type === r.id ? '0 0 0 3px var(--primary-100)' : undefined, font: 'inherit', background: '#fff' }} onClick={() => setType(r.id)}>
            <span className={'s-ico ' + (type === r.id ? 'ico-indigo' : 'ico-slate')} style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={r.icon} size={20} /></span>
            <div className="grow"><div className="semibold">{r.label}</div><div className="small muted">{r.desc}</div></div>
            {type === r.id && <Icon name="CircleCheck" style={{ color: 'var(--primary)' }} />}
          </button>))}</div>
        {type === 'individu' && <Field label="Siswa" hint="Kosongkan untuk mencetak semua siswa (satu halaman per siswa)"><select className="select" value={only} onChange={(e) => setOnly(e.target.value)}><option value="">Semua siswa ({ctx.students.length})</option>{ctx.students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></Field>}
        <Alert tone="info">Laporan hanya memuat data sesuai ujian & kelas yang sedang dipilih. Ukuran kertas A4; sidebar dan tombol tidak ikut tercetak.</Alert>
      </div> : <div className="paper-stage"><div className="paper"><R.C ctx={fullCtx} /></div></div>}
    </Modal>
  );
}

Object.assign(window, { PrintModal, REPORTS });
