/* Layout admin (sidebar + topbar) dan Dashboard */

const NAV = [
  { group: 'Utama' },
  { to: '/admin', label: 'Dashboard', icon: 'LayoutDashboard', exact: true },
  { group: 'Data Master' },
  { to: '/admin/siswa', label: 'Data Siswa', icon: 'Users' },
  { to: '/admin/kelas', label: 'Data Kelas', icon: 'School' },
  { group: 'Ujian & Nilai' },
  { to: '/admin/ujian', label: 'Ujian & Tugas', icon: 'ClipboardList' },
  { to: '/admin/nilai', label: 'Input Nilai', icon: 'PencilLine' },
  { to: '/admin/rekap', label: 'Rekap Nilai', icon: 'ChartColumn' },
  { to: '/admin/publikasi', label: 'Publikasi Nilai', icon: 'Megaphone' },
  { group: 'Sistem' },
  { to: '/admin/portal', label: 'Portal Siswa', icon: 'Globe' },
  { to: '/admin/pengaturan', label: 'Pengaturan', icon: 'Settings' },
  { to: '/admin/akun', label: 'Akun Guru', icon: 'UserCog', admin: true },
];

function AdminLayout({ path, title, children }) {
  const { session, backend, setSession, settings } = useApp();
  const toast = useToast();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sm_sb_collapsed') === '1');
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => { setOpen(false); setMenu(false); }, [path]);
  useEffect(() => { localStorage.setItem('sm_sb_collapsed', collapsed ? '1' : '0'); }, [collapsed]);
  useEffect(() => { if (!menu) return; const c = () => setMenu(false); setTimeout(() => document.addEventListener('click', c), 0); return () => document.removeEventListener('click', c); }, [menu]);
  const isActive = (n) => (n.exact ? path === n.to : path === n.to || path.startsWith(n.to + '/'));
  const logout = async () => { await backend.signOut(); setSession(null); toast.success('Anda telah keluar'); navigate('/login'); };
  const name = (settings && settings.profile && settings.profile.full_name) || (session && session.user.email) || 'Guru';
  return (
    <div className="admin">
      <div className={'sb-backdrop' + (open ? ' show' : '')} onClick={() => setOpen(false)} />
      <aside className={'sidebar' + (collapsed ? ' collapsed' : '') + (open ? ' open' : '')}>
        <div className="sb-head">
          <span className="brand-mark"><Icon name="GraduationCap" size={20} /></span>
          <div className="brand-text grow" style={{ lineHeight: 1.2 }}><div className="bold" style={{ fontSize: 14 }}>Ujian & Nilai</div><div className="xs muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{(settings && settings.profile && settings.profile.school_name) || 'Panel Guru'}</div></div>
          <button className="btn btn-ghost btn-icon btn-sm mobile-only" onClick={() => setOpen(false)} aria-label="Tutup menu"><Icon name="X" /></button>
        </div>
        <nav className="sb-nav">
          {NAV.filter((n) => !n.admin || (settings && settings.profile && settings.profile.role === 'admin')).map((n, i) => n.group ? <div className="sb-group" key={i}>{n.group}</div> : (
            <Link key={n.to} to={n.to} className={'sb-link' + (isActive(n) ? ' active' : '')} title={collapsed ? n.label : undefined} aria-current={isActive(n) ? 'page' : undefined}>
              <Icon name={n.icon} size={19} /><span className="sb-label">{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sb-foot">
          <button className="sb-link desktop-only" style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => setCollapsed(!collapsed)}>
            <Icon name={collapsed ? 'PanelLeftOpen' : 'PanelLeftClose'} size={19} /><span className="sb-label">Ciutkan sidebar</span>
          </button>
          <Link to="/" className="sb-link"><Icon name="House" size={19} /><span className="sb-label">Halaman publik</span></Link>
        </div>
      </aside>
      <div className="main">
        {backend.mode === 'demo' && <div className="demo-ribbon"><Icon name="FlaskConical" size={15} /><span><b>MODE DEMO</b> — Website belum dihubungkan ke Supabase oleh administrator. Data hanya tersimpan di browser ini dan bukan data sekolah.</span><Link to="/admin/pengaturan?tab=supabase">Panduan administrator</Link></div>}
        <header className="topbar">
          <button className="btn btn-ghost btn-icon mobile-only" onClick={() => setOpen(true)} aria-label="Buka menu"><Icon name="Menu" /></button>
          {path !== '/admin' && <Link to={backTarget(path)} className="back-btn" title="Kembali"><Icon name="ArrowLeft" size={16} /><span className="desktop-only">{backLabel(path)}</span></Link>}
          <h1 className="grow" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
          {settings && settings.portal && <Link to="/admin/portal" className="desktop-only" title={'Status Portal Siswa di website · nilai Anda: ' + (settings.portal.enabled ? 'dibuka' : 'ditutup')}>{(settings.app ? settings.app.public_open : settings.portal.enabled) ? <Badge tone="green" dot>Portal terbuka{!settings.portal.enabled ? ' (guru lain)' : ''}</Badge> : <Badge dot>Portal ditutup</Badge>}</Link>}
          <div style={{ position: 'relative' }}>
            <button className="user-chip" onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu}>
              <span className="avatar">{U.initials(name)}</span><span className="small semibold desktop-only" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span><Icon name="ChevronDown" size={15} className="desktop-only" />
            </button>
            {menu && <div className="menu" role="menu">
              <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--border-2)', marginBottom: 4 }}><div className="semibold small">{name}</div><div className="xs muted">{session && session.user.email}</div></div>
              <button className="menu-item" onClick={() => navigate('/admin/pengaturan?tab=profil')}><Icon name="UserRound" size={16} />Profil</button>
              <button className="menu-item" onClick={() => navigate('/admin/pengaturan?tab=keamanan')}><Icon name="ShieldCheck" size={16} />Keamanan</button>
              <button className="menu-item" onClick={logout} style={{ color: 'var(--red)' }}><Icon name="LogOut" size={16} />Keluar</button>
            </div>}
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

/* Tombol kembali: halaman detail → daftar; halaman menu → Dashboard */
const BACK_LIST = { siswa: 'Data Siswa', kelas: 'Data Kelas', ujian: 'Ujian & Tugas' };
function backTarget(path) { const p = path.split('/').filter(Boolean); return p.length >= 3 && BACK_LIST[p[1]] ? '/admin/' + p[1] : '/admin'; }
function backLabel(path) { const p = path.split('/').filter(Boolean); return p.length >= 3 && BACK_LIST[p[1]] ? BACK_LIST[p[1]] : 'Dashboard'; }

/* ---------- Shared academic filter ---------- */
function AcademicFilters({ value, onChange, data, show = ['year', 'semester', 'class', 'subject'] }) {
  const years = [...new Set([...(data.classes || []).map((c) => c.academic_year), ...(data.exams || []).map((e) => e.academic_year)].filter(Boolean))].sort().reverse();
  const set = (k, v) => onChange(Object.assign({}, value, { [k]: v }));
  const classes = (data.classes || []).filter((c) => !value.year || c.academic_year === value.year);
  return (
    <div className="filters">
      {show.includes('year') && <Field label="Tahun pelajaran"><select className="select select-sm" value={value.year || ''} onChange={(e) => set('year', e.target.value)}><option value="">Semua</option>{years.map((y) => <option key={y}>{y}</option>)}</select></Field>}
      {show.includes('semester') && <Field label="Semester"><select className="select select-sm" value={value.semester || ''} onChange={(e) => set('semester', e.target.value)}><option value="">Semua</option>{U.SEMESTERS.map((y) => <option key={y}>{y}</option>)}</select></Field>}
      {show.includes('class') && <Field label="Kelas"><select className="select select-sm" value={value.class || ''} onChange={(e) => set('class', e.target.value)}><option value="">Semua kelas</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
      {show.includes('subject') && <Field label="Mata pelajaran"><select className="select select-sm" value={value.subject || ''} onChange={(e) => set('subject', e.target.value)}><option value="">Semua mapel</option>{(data.subjects || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
      {show.includes('type') && <Field label="Jenis ujian"><select className="select select-sm" value={value.type || ''} onChange={(e) => set('type', e.target.value)}><option value="">Semua jenis</option>{U.EXAM_TYPES.map((y) => <option key={y}>{y}</option>)}</select></Field>}
    </div>
  );
}
function filterExams(exams, f) {
  return exams.filter((e) => (!f.year || e.academic_year === f.year) && (!f.semester || e.semester === f.semester) && (!f.class || e.class_id === f.class) && (!f.subject || e.subject_id === f.subject) && (!f.type || e.exam_type === f.type) && (!f.exam || e.id === f.exam));
}

/* ---------- Charts (data-driven, no fake data) ---------- */
function HBarChart({ rows, max = 100, kktp, empty }) {
  if (!rows.length) return <div className="state" style={{ padding: 28 }}><p>{empty || 'Belum ada data'}</p></div>;
  return <div>{rows.map((r, i) => (
    <div className="hbar" key={i} title={r.title}>
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="semibold">{r.label}</div>
      <div className="track"><div className="fill" style={{ width: Math.max(0, Math.min(100, (r.value / max) * 100)) + '%', background: kktp !== undefined && r.kktp !== undefined ? (r.value >= r.kktp ? 'var(--green)' : 'var(--red)') : undefined }} />{r.kktp !== undefined && <div className="kk" style={{ left: (r.kktp / max) * 100 + '%' }} />}</div>
      <div className="right bold">{U.fmtNum(r.value)}</div>
    </div>))}</div>;
}
function VBarChart({ rows, empty }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.some((r) => r.value)) return <div className="state" style={{ padding: 28 }}><p>{empty || 'Belum ada data'}</p></div>;
  const colors = ['#dc2626', '#f97316', '#eab308', '#22c55e', '#16a34a'];
  return <div className="vbars">{rows.map((r, i) => (
    <div className="vbar" key={i}><div className="vv">{r.value}</div><div className="col-fill" style={{ height: (r.value / max) * 140 + 'px', background: colors[i] || 'var(--primary)' }} /><div className="vl">{r.label}</div></div>))}</div>;
}
function Donut({ pass, fail, empty }) {
  const t = pass + fail;
  if (!t) return <div className="state" style={{ padding: 28 }}><p>{empty || 'Belum ada data'}</p></div>;
  const p = (pass / t) * 100;
  return (
    <div className="row gap-20" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
      <div className="donut" style={{ background: `conic-gradient(var(--green) 0 ${p}%, #fca5a5 ${p}% 100%)` }}><div className="dc"><div className="bold" style={{ fontSize: 24 }}>{U.fmtNum(p, 0)}%</div><div className="xs muted">tuntas</div></div></div>
      <div className="legend">
        <div className="row"><span className="sw" style={{ background: 'var(--green)' }} />Tuntas<b className="mono" style={{ marginLeft: 'auto', paddingLeft: 16 }}>{pass}</b></div>
        <div className="row"><span className="sw" style={{ background: '#fca5a5' }} />Belum tuntas<b className="mono" style={{ marginLeft: 'auto', paddingLeft: 16 }}>{fail}</b></div>
        <div className="xs muted">Dari {t} nilai tercatat</div>
      </div>
    </div>
  );
}

/* ---------- Dashboard ---------- */
function DashboardPage() {
  const q = useTables(['students', 'classes', 'subjects', 'exams', 'grades', 'publication_settings']);
  const { settings } = useApp();
  const [f, setF] = useState({ year: '', semester: '', class: '', subject: '' });
  useEffect(() => { if (settings && settings.portal) setF((x) => ({ ...x, year: x.year || '' })); }, [settings]);
  if (q.loading && !q.data) return <><PageHead title="Dashboard" desc="Ringkasan data ujian dan nilai." /><div className="grid g4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="card stat"><div className="skel" style={{ width: '60%' }} /><div className="skel" style={{ height: 28, width: '40%' }} /></div>)}</div></>;
  if (q.error && !q.data) return <div className="card"><ErrorState error={q.error} onRetry={q.reload} /></div>;
  const d = q.data;
  const examById = Object.fromEntries(d.exams.map((e) => [e.id, e]));
  const published = new Set(d.publication_settings.filter((p) => p.is_published).map((p) => p.exam_id));
  const fx = filterExams(d.exams, f); const fxIds = new Set(fx.map((e) => e.id));
  const fGrades = d.grades.filter((g) => fxIds.has(g.exam_id));
  const pass = fGrades.filter((g) => g.score >= examById[g.exam_id].kktp).length;
  const avg = fGrades.length ? fGrades.reduce((a, g) => a + Number(g.score), 0) / fGrades.length : null;
  // per-student ketuntasan: siswa tuntas = semua nilainya ≥ KKTP
  const perStudent = {}; fGrades.forEach((g) => { const ok = g.score >= examById[g.exam_id].kktp; perStudent[g.student_id] = (perStudent[g.student_id] ?? true) && ok; });
  const sPass = Object.values(perStudent).filter(Boolean).length; const sFail = Object.values(perStudent).length - sPass;
  const hasFilter = f.year || f.semester || f.class || f.subject;
  const qs = new URLSearchParams(Object.entries({ year: f.year, semester: f.semester, class: f.class, subject: f.subject }).filter(([, v]) => v)).toString();
  const cards = [
    { label: 'Total siswa', value: d.students.filter((s) => s.status === 'aktif').length, sub: `${d.students.length} terdaftar`, icon: 'Users', tone: 'indigo', to: '/admin/siswa' },
    { label: 'Total kelas', value: d.classes.length, icon: 'School', tone: 'slate', to: '/admin/kelas' },
    { label: 'Ujian & tugas', value: fx.filter((e) => U.kindOf(e) !== 'manual').length, sub: fx.filter((e) => U.kindOf(e) === 'ujian').length + ' ujian · ' + fx.filter((e) => U.kindOf(e) === 'tugas').length + ' tugas · ' + fx.filter((e) => U.kindOf(e) === 'manual').length + ' nilai manual', icon: 'ClipboardList', tone: 'indigo', to: '/admin/ujian' + (qs ? '?' + qs : '') },
    { label: 'Ujian/tugas aktif', value: fx.filter((e) => e.status === 'aktif').length, icon: 'Activity', tone: 'amber', to: '/admin/ujian?status=aktif' },
    { label: 'Nilai dipublikasikan', value: fx.filter((e) => published.has(e.id)).length, sub: 'penilaian terpublikasi', icon: 'Megaphone', tone: 'green', to: '/admin/publikasi?status=published' },
    { label: 'Rata-rata nilai', value: avg === null ? '—' : U.fmtNum(avg), sub: `${fGrades.length} nilai`, icon: 'Gauge', tone: 'indigo', to: '/admin/rekap' + (qs ? '?' + qs : '') },
    { label: 'Siswa tuntas', value: sPass, sub: 'semua nilai ≥ KKTP', icon: 'CircleCheck', tone: 'green', to: '/admin/rekap?status=tuntas' + (qs ? '&' + qs : '') },
    { label: 'Siswa belum tuntas', value: sFail, sub: 'ada nilai < KKTP', icon: 'CircleX', tone: 'red', to: '/admin/rekap?status=belum' + (qs ? '&' + qs : '') },
  ];
  // charts
  const bySubject = d.subjects.map((s) => { const g = fGrades.filter((x) => examById[x.exam_id].subject_id === s.id); return { label: s.name, value: g.length ? g.reduce((a, x) => a + Number(x.score), 0) / g.length : null }; }).filter((r) => r.value !== null);
  const byClass = d.classes.map((c) => { const g = fGrades.filter((x) => examById[x.exam_id].class_id === c.id); return { label: c.name, value: g.length ? g.reduce((a, x) => a + Number(x.score), 0) / g.length : null }; }).filter((r) => r.value !== null);
  const empty = !d.students.length && !d.exams.length;
  return (
    <>
      <PageHead title={`Selamat datang${settings && settings.profile && settings.profile.full_name ? ', ' + settings.profile.full_name : ''}`} desc="Ringkasan data ujian dan nilai dari database." actions={<button className="btn btn-outline btn-sm" onClick={() => q.reload()} disabled={q.loading}>{q.loading ? <Spinner /> : <Icon name="RefreshCw" size={15} />}Muat ulang</button>} />
      {empty && <Alert tone="info" title="Database masih kosong">Mulai dengan menambahkan <Link to="/admin/kelas">Data Kelas</Link>, lalu <Link to="/admin/siswa">Data Siswa</Link>, kemudian buat ujian di <Link to="/admin/ujian">Manajemen Ujian</Link>.</Alert>}
      <div className="card card-pad"><AcademicFilters value={f} onChange={setF} data={d} /></div>
      <div className="grid g4">
        {cards.map((c) => (
          <button key={c.label} className="card stat" onClick={() => navigate(c.to)}>
            <div className="s-top"><span>{c.label}</span><span className={'s-ico ico-' + c.tone}><Icon name={c.icon} size={17} /></span></div>
            <div className="s-val">{c.value}</div>
            {c.sub && <div className="s-sub">{c.sub}</div>}
          </button>
        ))}
      </div>
      <div className="grid g2">
        <div className="card"><div className="card-head"><div><div className="card-title">Rata-rata nilai per mata pelajaran</div><div className="card-sub">Skala 0–100</div></div></div><div className="card-pad"><HBarChart rows={bySubject} empty="Belum ada nilai untuk filter ini" /></div></div>
        <div className="card"><div className="card-head"><div><div className="card-title">Rata-rata nilai per kelas</div><div className="card-sub">Skala 0–100</div></div></div><div className="card-pad"><HBarChart rows={byClass} empty="Belum ada nilai untuk filter ini" /></div></div>
        <div className="card"><div className="card-head"><div><div className="card-title">Distribusi nilai</div><div className="card-sub">Jumlah nilai per rentang</div></div></div><div className="card-pad"><VBarChart rows={U.distribution(fGrades.map((g) => Number(g.score)))} empty="Belum ada nilai untuk filter ini" /></div></div>
        <div className="card"><div className="card-head"><div><div className="card-title">Ketuntasan nilai</div><div className="card-sub">Berdasarkan KKTP masing-masing ujian</div></div></div><div className="card-pad"><Donut pass={pass} fail={fGrades.length - pass} empty="Belum ada nilai untuk filter ini" /></div></div>
      </div>
    </>
  );
}

Object.assign(window, { AdminLayout, DashboardPage, AcademicFilters, filterExams, HBarChart, VBarChart, Donut });
