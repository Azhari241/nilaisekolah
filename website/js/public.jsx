/* Halaman publik: Beranda, Panduan, Login Guru, Lupa Password, Cek Nilai (Portal Siswa) */

function PublicHeader({ active }) {
  const { session } = useApp();
  return (
    <header className="pub-header">
      <div className="pub-header-in">
        <Link to="/" className="brand"><span className="brand-mark"><Icon name="GraduationCap" size={20} /></span><span>Ujian & Nilai<small>Sistem Manajemen Sekolah</small></span></Link>
        <nav className="pub-nav">
          <Link to="/" className={'nl' + (active === 'home' ? ' active' : '')}>Beranda</Link>
          <Link to="/panduan" className={'nl' + (active === 'guide' ? ' active' : '')}>Panduan</Link>
          <Link to="/cek-nilai" className={'nl' + (active === 'portal' ? ' active' : '')}>Cek Nilai</Link>
          {session ? <Link to="/admin" className="btn btn-primary btn-sm"><Icon name="LayoutDashboard" size={16} />Dashboard</Link>
            : <Link to="/login" className="btn btn-primary btn-sm"><Icon name="LogIn" size={16} />Login Guru</Link>}
        </nav>
      </div>
    </header>
  );
}

function PortalStatusCard() {
  const { backend } = useApp();
  const q = useQuery(() => backend.getPortalStatus(), [backend]);
  return (
    <div className="card portal-status">
      {q.loading ? <><Spinner /><span className="muted">Memeriksa status portal…</span></>
        : q.error ? <><Icon name="CircleAlert" style={{ color: 'var(--red)' }} /><div className="grow"><div className="semibold">Status portal tidak dapat dimuat</div><div className="small muted">{q.error}</div></div><button className="btn btn-outline btn-sm" onClick={() => q.reload()}>Coba lagi</button></>
        : q.data.enabled ? <><span className="dot-live" /><div className="grow"><div className="semibold">Portal Siswa aktif {q.data.school_name ? '— ' + q.data.school_name : ''}</div><div className="small muted">{q.data.message || ('Nilai yang telah dipublikasikan guru dapat dicek sekarang' + (q.data.academic_year ? ` · Tahun pelajaran ${q.data.academic_year}, semester ${q.data.semester}` : '') + '.')}</div></div><Link to="/cek-nilai" className="btn btn-green btn-sm">Cek Nilai<Icon name="ArrowRight" size={16} /></Link></>
        : <><span className="dot-off" /><div className="grow"><div className="semibold">Portal Siswa sedang ditutup</div><div className="small muted">{q.data.message || 'Guru belum membuka akses pengecekan nilai. Silakan kembali lagi nanti.'}</div></div></>}
    </div>
  );
}

function HomePage() {
  return (
    <>
      <PublicHeader active="home" />
      <main className="pub-main">
        <section className="hero">
          <div>
            <Badge tone="indigo">Untuk guru & siswa</Badge>
            <h1 className="mt-16">Sistem Manajemen <em>Ujian & Nilai</em></h1>
            <p className="lead">Kelola ujian, nilai, dan hasil belajar siswa dalam satu sistem yang mudah digunakan.</p>
          </div>
          <PortalStatusCard />
        </section>
        <section className="grid g2">
          <div className="card entry-card">
            <div className="ec-icon ico-indigo"><Icon name="UserCog" size={24} /></div>
            <h3>Login Guru</h3>
            <p>Masuk untuk mengelola siswa, kelas, ujian, dan nilai.</p>
            <div className="mt-8"><Link to="/login" className="btn btn-primary btn-lg"><Icon name="LogIn" size={18} />Login Guru</Link></div>
          </div>
          <div className="card entry-card">
            <div className="ec-icon ico-green"><Icon name="SearchCheck" size={24} /></div>
            <h3>Cek Nilai Siswa</h3>
            <p>Cari hasil ujian menggunakan identitas siswa.</p>
            <div className="mt-8"><Link to="/cek-nilai" className="btn btn-green btn-lg"><Icon name="Search" size={18} />Cari Nilai</Link></div>
          </div>
        </section>
      </main>
    </>
  );
}

function GuidePage() {
  return (
    <>
      <PublicHeader active="guide" />
      <main className="pub-main" style={{ maxWidth: 860 }}>
        <div style={{ padding: '40px 0 24px' }}><h1 style={{ fontSize: 34, fontWeight: 800 }}>Panduan Penggunaan</h1><p className="muted mt-8">Langkah singkat untuk siswa dan guru.</p></div>
        <div className="col gap-16">
          <div className="card card-pad guide">
            <h3 className="row"><Icon name="GraduationCap" style={{ color: 'var(--green)' }} />Untuk Siswa</h3>
            <ol>
              <li>Buka menu <b>Cek Nilai</b> (tidak perlu login).</li>
              <li><b>Pilih kelas</b> Anda.</li>
              <li>Ketik <b>nama lengkap</b> sesuai data sekolah (huruf besar/kecil tidak berpengaruh).</li>
              <li>Klik <b>CARI NILAI</b>.</li>
              <li>Hanya nilai yang <b>sudah dipublikasikan</b> guru yang akan tampil. Jika nilai belum muncul, berarti guru belum mempublikasikannya.</li>
            </ol>
          </div>
          <div className="card card-pad guide">
            <h3 className="row"><Icon name="UserCog" style={{ color: 'var(--primary)' }} />Untuk Guru</h3>
            <ol>
              <li>Masuk melalui <b>Login Guru</b> dengan akun yang dibuat administrator di Supabase.</li>
              <li>Isi <b>Pengaturan → Akademik</b> (tahun pelajaran, semester, KKTP default).</li>
              <li>Tambahkan <b>Data Kelas</b>, lalu <b>Data Siswa</b> (manual atau import Excel).</li>
              <li>Buat ujian di <b>Manajemen Ujian</b>, unggah soal dari template Excel, lalu buat Google Form.</li>
              <li>Gunakan <b>Sinkronisasi</b> untuk menarik nilai dari Google Forms ke <b>Input Nilai</b>.</li>
              <li>Periksa di <b>Rekap Nilai</b>, lalu <b>Publikasikan</b> agar siswa dapat melihat nilainya.</li>
            </ol>
          </div>
        </div>
      </main>
    </>
  );
}

function LoginPage() {
  const { backend, setSession, session } = useApp();
  const toast = useToast();
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [fe, setFe] = useState({});
  const [forgot, setForgot] = useState(false);
  useEffect(() => { if (session) navigate('/admin'); }, [session]);
  useEffect(() => { const m = sessionStorage.getItem('sm_login_msg'); if (m) { setErr(m); sessionStorage.removeItem('sm_login_msg'); } }, []);
  const submit = async (e) => {
    e.preventDefault(); if (busy) return;
    const f = {}; if (!/^\S+@\S+\.\S+$/.test(email)) f.email = 'Masukkan email yang valid'; if (pw.length < 6) f.pw = 'Password minimal 6 karakter';
    setFe(f); setErr(''); if (Object.keys(f).length) return;
    setBusy(true);
    try { const s = await backend.signIn(email.trim(), pw); setSession(s); toast.success('Berhasil masuk'); navigate('/admin'); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const demo = async (id) => { setBusy(true); setErr(''); try { const s = await backend.signInDemo(id); setSession(s); toast.info('Masuk Mode Demo — data hanya tersimpan di browser ini'); navigate('/admin'); } catch (x) { setErr(x.message); } finally { setBusy(false); } };
  const accounts = backend.mode === 'demo' ? backend.demoAccounts() : [];
  return (
    <>
      <PublicHeader />
      <div className="auth-wrap">
        <div className="card auth-card">
          {forgot ? <ForgotForm onBack={() => setForgot(false)} initialEmail={email} /> : (
            <form onSubmit={submit} className="col gap-16" noValidate>
              <div><div className="brand-mark" style={{ width: 44, height: 44 }}><Icon name="LockKeyhole" size={22} /></div><h2 className="mt-16" style={{ fontSize: 24, fontWeight: 800 }}>Login Guru</h2><p className="muted mt-4">Masuk untuk mengelola ujian dan nilai.</p></div>
              {backend.mode === 'demo' && <Alert tone="warn" title="Website belum dihubungkan ke Supabase">Administrator perlu mengisi konfigurasi Supabase satu kali saat deploy. Sementara itu Anda dapat mencoba <b>Mode Demo</b> dengan salah satu akun contoh di bawah (data tersimpan di browser ini saja).</Alert>}
              {err && <Alert tone="err">{err}</Alert>}
              <Field label="Email" required error={fe.email}><input className={'input' + (fe.email ? ' err' : '')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@sekolah.sch.id" disabled={busy} /></Field>
              <Field label="Password" required error={fe.pw}>
                <div className="input-wrap"><span className="lead"><Icon name="KeyRound" size={16} /></span>
                  <input className={'input' + (fe.pw ? ' err' : '')} type={show ? 'text' : 'password'} autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} disabled={busy} style={{ paddingRight: 44 }} />
                  <span className="trail"><button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setShow(!show)} aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}><Icon name={show ? 'EyeOff' : 'Eye'} size={16} /></button></span>
                </div>
              </Field>
              <div className="row between"><span /><button type="button" className="link-text small" style={{ color: 'var(--primary)' }} onClick={() => setForgot(true)}>Lupa password?</button></div>
              <button className="btn btn-primary btn-lg btn-block" disabled={busy || backend.mode === 'demo'}>{busy && <Spinner />}Login</button>
              {backend.mode === 'demo' && <div className="col gap-6"><div className="label">Masuk Mode Demo sebagai:</div>{accounts.map((a) => <button key={a.id} type="button" className="btn btn-outline btn-block" style={{ justifyContent: 'flex-start', height: 46 }} onClick={() => demo(a.id)} disabled={busy || !a.active}><span className="avatar" style={{ width: 28, height: 28, fontSize: 12 }}>{U.initials(a.full_name)}</span><span className="grow" style={{ textAlign: 'left' }}>{a.full_name}</span>{a.role === 'admin' ? <Badge tone="indigo">Admin</Badge> : <Badge>Guru</Badge>}{!a.active && <Badge tone="red">Nonaktif</Badge>}</button>)}</div>}
              <p className="xs muted center">Akun guru dibuat oleh administrator. Tidak ada pendaftaran publik.</p>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

function ForgotForm({ onBack, initialEmail }) {
  const { backend } = useApp();
  const [email, setEmail] = useState(initialEmail || ''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [sent, setSent] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); if (!/^\S+@\S+\.\S+$/.test(email)) { setErr('Masukkan email yang valid'); return; }
    setBusy(true); setErr(''); try { await backend.resetPassword(email.trim()); setSent(true); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="col gap-16" noValidate>
      <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onBack}><Icon name="ArrowLeft" size={16} />Kembali</button>
      <div><h2 style={{ fontSize: 22, fontWeight: 800 }}>Lupa Password</h2><p className="muted mt-4">Kami akan mengirim tautan reset ke email Anda.</p></div>
      {sent ? <Alert tone="ok" title="Email terkirim">Jika email terdaftar, tautan reset password telah dikirim. Periksa kotak masuk atau folder spam.</Alert> : <>
        {err && <Alert tone="err">{err}</Alert>}
        <Field label="Email" required><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} /></Field>
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy && <Spinner />}Kirim Tautan Reset</button>
      </>}
    </form>
  );
}

function PortalPage() {
  const { backend } = useApp();
  const status = useQuery(() => backend.getPortalStatus(), [backend]);
  const [cls, setCls] = useState(''); const [name, setName] = useState(''); const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(''); const [fe, setFe] = useState({}); const [result, setResult] = useState(null);
  const classes = (status.data && status.data.classes) || [];
  const submit = async (e) => {
    e.preventDefault(); if (busy) return;
    const f = {}; if (!cls) f.cls = 'Pilih kelas terlebih dahulu';
    if (!name.trim()) f.name = 'Nama siswa wajib diisi'; else if (name.trim().length < 2) f.name = 'Nama terlalu pendek';
    setFe(f); setErr(''); if (Object.keys(f).length) return;
    setBusy(true); setResult(null);
    try {
      const r = await backend.portalLookup(cls, name);
      if (r.ok) setResult(r);
      else setErr(r.reason === 'closed' ? 'Portal Siswa sedang ditutup oleh guru.' : 'not_found');
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const reset = () => { setResult(null); setName(''); setErr(''); };
  return (
    <>
      <PublicHeader active="portal" />
      <main className="pub-main" style={{ maxWidth: 780 }}>
        <div style={{ padding: '40px 0 20px' }}><Badge tone="green">Portal Siswa</Badge><h1 className="mt-12" style={{ fontSize: 'clamp(26px,4vw,34px)', fontWeight: 800, letterSpacing: '-.02em' }}>CEK NILAI UJIAN SISWA</h1><p className="muted mt-8">Masukkan kelas dan nama siswa untuk melihat hasil ujian yang telah dipublikasikan oleh guru.</p></div>
        {status.loading ? <div className="card"><LoadingState text="Memeriksa status portal…" /></div>
          : status.error ? <div className="card"><ErrorState error={status.error} onRetry={status.reload} /></div>
          : !status.data.enabled ? <div className="card"><div className="state"><div className="state-icon warn"><Icon name="DoorClosed" size={24} /></div><h3>Portal Siswa sedang ditutup</h3><p>{status.data.message || 'Guru belum membuka akses pengecekan nilai. Silakan kembali lagi nanti.'}</p></div></div>
          : !classes.length ? <div className="card"><EmptyState icon="School" title="Belum ada kelas yang tersedia." text="Guru belum menambahkan data kelas." /></div>
          : result ? <PortalResult r={result} onReset={reset} />
          : (
            <form className="card card-pad col gap-16" onSubmit={submit} noValidate>
              {status.data.message && <Alert tone="info">{status.data.message}</Alert>}
              {err === 'not_found' ? <Alert tone="err" title="Nama siswa tidak ditemukan pada kelas yang dipilih.">Periksa kembali nama dan kelas.</Alert> : err ? <Alert tone="err">{err}</Alert> : null}
              <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)' }}>
                <Field label="Pilih Kelas" required error={fe.cls}>
                  <select className={'select' + (fe.cls ? ' err' : '')} value={cls} onChange={(e) => { setCls(e.target.value); setErr(''); }} disabled={busy}>
                    <option value="">Pilih kelas</option>{classes.map((c) => { const n = typeof c === 'string' ? c : c.name; return <option key={n} value={n}>{n}</option>; })}
                  </select>
                </Field>
                <Field label="Nama Siswa" required error={fe.name} hint="Ketik nama lengkap. Huruf besar/kecil tidak berpengaruh.">
                  <input className={'input' + (fe.name ? ' err' : '')} value={name} onChange={(e) => { setName(e.target.value); setErr(''); }} disabled={busy} autoComplete="off" placeholder="Contoh: Ahmad Fauzi" />
                </Field>
              </div>
              <button className="btn btn-green btn-lg" disabled={busy}>{busy ? <Spinner /> : <Icon name="Search" size={18} />}CARI NILAI</button>
              <p className="xs muted">Hanya nilai yang telah dipublikasikan guru yang ditampilkan.</p>
            </form>
          )}
      </main>
    </>
  );
}

function PortalStudentResult({ st }) {
  const grouped = {};
  st.results.forEach((x) => { const k = 'Tahun Pelajaran ' + x.academic_year + ' · Semester ' + x.semester; (grouped[k] = grouped[k] || []).push(x); });
  return (
    <div className="col gap-16">
      <div className="card card-pad row gap-16" style={{ flexWrap: 'wrap' }}>
        <div className="avatar" style={{ width: 52, height: 52, fontSize: 18 }}>{U.initials(st.full_name)}</div>
        <div className="grow"><div className="bold" style={{ fontSize: 18 }}>{st.full_name}</div><div className="muted">Kelas {st.class_name}{st.hint ? ' · ' + st.hint : ''}</div></div>
      </div>
      {!st.results.length ? <div className="card"><EmptyState icon="FileClock" title="Nilai belum tersedia untuk ditampilkan." text="Nilai akan muncul setelah guru mempublikasikannya." /></div>
        : Object.entries(grouped).map(([k, rows]) => (
          <div className="card" key={k}>
            <div className="card-head"><div className="card-title">{k}</div><span className="small muted">{rows.length} nilai</span></div>
            <div className="table-wrap"><table className="table"><thead><tr><th>Mata Pelajaran</th><th>Penilaian</th><th className="right">Nilai</th><th className="right">KKTP</th><th>Status</th></tr></thead>
              <tbody>{rows.map((x, i) => <tr key={i}><td className="semibold">{x.subject}{x.teacher && <div className="xs muted" style={{ fontWeight: 400 }}>{x.teacher}</div>}</td><td>{x.exam_name}<div className="xs muted">{KIND_LABEL[x.kind] || 'Ujian'} · {x.exam_type} · {U.fmtDate(x.date)}</div></td><td className="right" style={{ fontSize: 17 }}><ScoreBadge score={Number(x.score)} kktp={Number(x.kktp)} /></td><td className="right muted">{U.fmtNum(Number(x.kktp))}</td><td><PassBadge score={Number(x.score)} kktp={Number(x.kktp)} /></td></tr>)}</tbody></table></div>
          </div>
        ))}
    </div>
  );
}

const KIND_LABEL = { ujian: 'Ujian', tugas: 'Tugas', manual: 'Nilai' };
function PortalResult({ r, onReset }) {
  // Entri tanpa 'hint' = siswa yang sama tercatat di beberapa guru → gabungkan menjadi satu kartu
  const plain = r.students.filter((s) => !s.hint); const dups = r.students.filter((s) => s.hint);
  const merged = plain.length ? [{ full_name: plain[0].full_name, class_name: plain[0].class_name, hint: '', results: plain.flatMap((s) => s.results).sort((a, b) => (b.academic_year || '').localeCompare(a.academic_year || '') || (a.semester === b.semester ? 0 : a.semester === 'Ganjil' ? -1 : 1) || String(a.subject).localeCompare(String(b.subject)) || String(a.date || '').localeCompare(String(b.date || ''))) }] : [];
  r = Object.assign({}, r, { students: merged.concat(dups) });
  return (
    <div className="col gap-20">
      <div className="row between"><button className="btn btn-outline" onClick={onReset}><Icon name="ArrowLeft" size={16} />Cari nama lain</button>{r.students.length > 1 && <Badge tone="amber">{r.students.length} siswa dengan nama sama</Badge>}</div>
      {r.students.length > 1 && <Alert tone="warn">Ditemukan {r.students.length} siswa dengan nama yang sama di kelas ini. Nilai masing-masing ditampilkan terpisah.</Alert>}
      {r.students.map((st, i) => <PortalStudentResult key={i} st={st} />)}
    </div>
  );
}

Object.assign(window, { HomePage, GuidePage, LoginPage, PortalPage, PublicHeader });
