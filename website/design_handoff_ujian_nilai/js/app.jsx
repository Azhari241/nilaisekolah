/* Root: pilih backend, sesi, pengaturan, routing */

function pickBackend() {
  const c = window.APP_CONFIG || {};
  // Konfigurasi SATU KALI oleh administrator di config.js / environment deploy.
  // Tidak ada konfigurasi per guru dan tidak dibaca dari localStorage.
  let cfg = null;
  if (c.SUPABASE_URL && c.SUPABASE_ANON_KEY) cfg = { url: c.SUPABASE_URL, key: c.SUPABASE_ANON_KEY, source: 'config' };
  try { localStorage.removeItem('sm_supabase_cfg'); } catch (e) {}
  window.__SB_CFG = cfg || {};
  if (cfg) {
    try { return makeSupabaseBackend(cfg.url, cfg.key); }
    catch (e) {
      // Konfigurasi produksi ADA tetapi gagal dimuat → JANGAN diam-diam jatuh ke Mode Demo
      // (guru bisa mengira data tersimpan padahal hanya di browser). Tampilkan error yang memblokir.
      console.error(e); window.__SB_ERR = e.message; return null;
    }
  }
  return DemoBackend;
}

function DemoDataCard() {
  const { backend, reloadSettings } = useApp(); const toast = useToast(); const confirm = useConfirm();
  if (backend.mode !== 'demo') return null;
  const seed = () => confirm({ title: 'Isi data contoh DEMO?', confirmText: 'Isi data DEMO', message: 'Data demo di browser ini diganti dengan data contoh untuk DUA guru (Guru A: Bahasa Arab — ujian, tugas PG+essay, nilai manual; Guru B: Matematika). Keduanya punya kelas "VIII.1" dan siswa "Ahmad Fauzi" untuk menguji pemisahan data. Data ini bukan data nyata.', onConfirm: async () => { await backend.seedDemo(); await reloadSettings(); toast.success('Data contoh DEMO dimuat'); setTimeout(() => location.reload(), 300); } });
  const reset = () => confirm({ title: 'Kosongkan data DEMO?', danger: true, confirmText: 'Kosongkan', message: 'Semua data demo di browser ini akan dihapus.', onConfirm: async () => { await backend.resetDemo(); await reloadSettings(); toast.success('Data demo dikosongkan'); setTimeout(() => location.reload(), 300); } });
  return (
    <div className="card card-pad row gap-16" style={{ flexWrap: 'wrap', borderColor: 'var(--amber-100)', background: 'var(--amber-50)' }}>
      <Icon name="FlaskConical" style={{ color: 'var(--amber)' }} />
      <div className="grow"><div className="semibold">Data DEMO</div><div className="small muted">Mode demo menyimpan data di browser ini. Coba login sebagai Guru A lalu Guru B untuk melihat bahwa data tiap guru terpisah.</div></div>
      <button className="btn btn-outline btn-sm" onClick={reset}>Kosongkan</button><button className="btn btn-primary btn-sm" onClick={seed}><Icon name="Sparkles" size={15} />Isi data contoh</button>
    </div>
  );
}

const ADMIN_TITLES = { '': 'Dashboard', siswa: 'Data Siswa', kelas: 'Data Kelas', ujian: 'Manajemen Ujian & Tugas', nilai: 'Input Nilai', rekap: 'Rekap Nilai', publikasi: 'Publikasi Nilai', portal: 'Portal Siswa', pengaturan: 'Pengaturan', akun: 'Akun Guru' };

const __BACKEND = pickBackend(); // dipilih sekali saat halaman dimuat
function App() {
  if (!__BACKEND) return <div className="state" style={{ minHeight: '100vh' }}><div className="state-icon err"><Icon name="TriangleAlert" size={24} /></div><h3>Database sekolah tidak dapat dimuat</h3><p>{window.__SB_ERR}. Periksa koneksi internet lalu muat ulang halaman. Jika masalah berlanjut, hubungi administrator.</p><button className="btn btn-primary mt-8" onClick={() => location.reload()}><Icon name="RefreshCw" size={16} />Muat ulang</button></div>;
  return <AppMain backend={__BACKEND} />;
}

function AppMain({ backend }) {
  const route = useRoute();
  const [session, setSession] = useState(undefined); // undefined = memeriksa
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    backend.getSession().then((s) => setSession(s || null)).catch(() => setSession(null));
    return backend.onAuthChange((s) => setSession(s || null));
  }, [backend]);
  const reloadSettings = useCallback(async () => { try { setSettings(await backend.getSettings()); } catch (e) { console.error(e); setSettings({ profile: {}, portal: {}, error: e.message }); } }, [backend]);
  useEffect(() => { if (session) reloadSettings(); else setSettings(null); }, [session && session.user && session.user.id]);
  // Sesi tersimpan bisa milik akun yang kemudian dinonaktifkan / belum disetujui → keluarkan dengan pesan jelas.
  // (RLS tetap memblokir data; ini hanya agar UI tidak tampak kosong tanpa penjelasan.)
  useEffect(() => {
    const p = settings && settings.profile;
    if (!session || !p || settings.error) return;
    if (p.active === false || (p.role && !['teacher', 'admin'].includes(p.role))) {
      const msg = p.active === false ? 'Akun Anda dinonaktifkan oleh administrator.' : 'Akun Anda belum disetujui sebagai guru.';
      backend.signOut().finally(() => { setSession(null); sessionStorage.setItem('sm_login_msg', msg); navigate('/login'); });
    }
  }, [settings]);
  const google = useMemo(() => ({ google_script_url: settings && settings.profile && settings.profile.google_script_url, google_token: settings && settings.profile && settings.profile.google_token }), [settings]);
  const ctx = { backend, session, setSession, settings, reloadSettings, google };

  const { path, query } = route;
  let page;
  if (path.startsWith('/admin')) {
    if (session === undefined) page = <div className="state" style={{ minHeight: '100vh' }}><Spinner lg /><p>Memeriksa sesi…</p></div>;
    else if (!session) { setTimeout(() => navigate('/login'), 0); page = null; }
    else {
      const parts = path.split('/').filter(Boolean); const sec = parts[1] || ''; const id = parts[2];
      let body;
      switch (sec) {
        case '': body = <><DemoDataCard /><DashboardPage /></>; break;
        case 'siswa': body = id ? <StudentDetailPage id={id} key={id} /> : <StudentsPage query={query} />; break;
        case 'kelas': body = id ? <ClassDetailPage id={id} key={id} /> : <ClassesPage />; break;
        case 'ujian': body = id ? <ExamDetailPage id={id} key={id} /> : <ExamsPage query={query} />; break;
        case 'nilai': body = <GradesPage query={query} />; break;
        case 'rekap': body = <RecapPage query={query} />; break;
        case 'publikasi': body = <PublicationPage query={query} />; break;
        case 'portal': body = <PortalAdminPage />; break;
        case 'akun': body = <AccountsPage />; break;
        case 'pengaturan': body = <>{query.tab === 'supabase' && <DemoDataCard />}<SettingsPage query={query} /></>; break;
        default: body = <div className="card"><EmptyState icon="MapPinOff" title="Halaman tidak ditemukan" action={<Link className="btn btn-primary" to="/admin">Ke Dashboard</Link>} /></div>;
      }
      page = <AdminLayout path={path} title={ADMIN_TITLES[sec] || 'Halaman'}>{settings && settings.error && <Alert tone="err" title="Pengaturan gagal dimuat">{settings.error}</Alert>}{body}</AdminLayout>;
    }
  } else if (path === '/login') page = <LoginPage />;
  else if (path === '/cek-nilai') page = <PortalPage />;
  else if (path === '/panduan') page = <GuidePage />;
  else if (path === '/') page = <HomePage />;
  else page = <><PublicHeader /><div className="pub-main"><EmptyState icon="MapPinOff" title="Halaman tidak ditemukan" action={<Link className="btn btn-primary" to="/">Ke Beranda</Link>} /></div></>;

  useEffect(() => { document.title = (path.startsWith('/admin') ? (ADMIN_TITLES[path.split('/')[2] || ''] || 'Admin') + ' · ' : '') + 'Sistem Manajemen Ujian & Nilai'; }, [path]);

  return (
    <AppCtx.Provider value={ctx}>
      <ToastProvider><ConfirmProvider>
        {window.__SB_ERR && <div className="demo-ribbon" style={{ background: '#7f1d1d' }}>Gagal memuat Supabase: {window.__SB_ERR}. Aplikasi berjalan dalam Mode Demo.</div>}
        {page}
      </ConfirmProvider></ToastProvider>
    </AppCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
