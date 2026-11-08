/* Portal Siswa (pengaturan) & Pengaturan (Profil, Akademik, Google, Supabase, Portal, Keamanan) */

function useSettingsForm(initial, keys) {
  const [v, setV] = useState({}); const [dirty, setDirty] = useState(false);
  useEffect(() => { if (initial) { setV(Object.fromEntries(keys.map((k) => [k, initial[k] ?? '']))); setDirty(false); } }, [initial]);
  const set = (k) => (e) => { setV(Object.assign({}, v, { [k]: e && e.target ? e.target.value : e })); setDirty(true); };
  return [v, set, dirty, setDirty, setV];
}

function PortalToggleCard() {
  const { backend, settings, reloadSettings } = useApp(); const toast = useToast(); const confirm = useConfirm();
  const [busy, setBusy] = useState(''); 
  const p = settings && settings.portal; const app = (settings && settings.app) || { portal_master: true, public_open: !!(p && p.enabled) };
  const isAdmin = settings && settings.profile && settings.profile.role === 'admin';
  if (!p) return <div className="card"><LoadingState /></div>;
  const toggle = async (on) => { setBusy('mine'); try { await backend.savePortalSettings({ enabled: on }); backend.audit(on ? 'portal_open' : 'portal_close', 'portal_settings', p.id); await reloadSettings(); toast.success(on ? 'Nilai Anda dibuka di Portal Siswa' : 'Nilai Anda ditutup dari Portal Siswa'); } catch (x) { toast.error('Gagal menyimpan: ' + x.message); } finally { setBusy(''); } };
  const master = async (on) => {
    if (!on) { const ok = await confirm({ title: 'Tutup Portal Siswa untuk seluruh sekolah?', danger: true, confirmText: 'Tutup portal', message: 'Halaman Cek Nilai akan ditutup untuk semua siswa, termasuk nilai dari semua guru. Pengaturan masing-masing guru tidak diubah.' }); if (!ok) return; }
    setBusy('master'); try { await backend.setPortalMaster(on); backend.audit(on ? 'portal_master_open' : 'portal_master_close', 'app_settings', 1); await reloadSettings(); toast.success(on ? 'Portal Siswa sekolah dibuka' : 'Portal Siswa sekolah ditutup untuk semua siswa'); } catch (x) { toast.error('Gagal menyimpan: ' + x.message); } finally { setBusy(''); }
  };
  const others = app.public_open && !p.enabled;
  return (
    <div className="col gap-16">
      <div className={'alert ' + (app.public_open ? 'alert-ok' : 'alert-warn')} style={{ alignItems: 'center' }}>
        <span className={app.public_open ? 'dot-live' : 'dot-off'} />
        <div className="grow"><b>Status di website saat ini: Portal Siswa {app.public_open ? 'TERBUKA' : 'DITUTUP'}</b>
          <div className="small mt-4">{!app.portal_master ? 'Ditutup oleh administrator untuk seluruh sekolah.' : app.public_open ? `Terbuka karena ${app.open_teachers || 1} guru membuka nilainya${others ? ' (bukan Anda — nilai Anda tetap tertutup)' : ''}.` : 'Tidak ada guru yang membuka nilainya.'}</div></div>
        <a className="btn btn-outline btn-sm" href="#/cek-nilai" target="_blank" rel="noopener">Lihat</a>
      </div>
      <div className="card card-pad row gap-16" style={{ flexWrap: 'wrap' }}>
        <span className={p.enabled && app.portal_master ? 'dot-live' : 'dot-off'} />
        <div className="grow"><div className="bold" style={{ fontSize: 17 }}>Nilai saya di Portal Siswa: {p.enabled ? 'dibuka' : 'ditutup'}</div><div className="small muted">{p.enabled ? 'Siswa dapat mencari nilai Anda yang telah dipublikasikan.' : 'Nilai Anda tidak dapat dicari siswa, walaupun sudah dipublikasikan.'} Pengaturan ini hanya untuk data Anda.</div></div>
        {busy === 'mine' && <Spinner />}
        <Switch on={!!p.enabled} onChange={toggle} disabled={!!busy} label="Buka nilai saya di Portal Siswa" />
      </div>
      {isAdmin && <div className="card card-pad row gap-16" style={{ flexWrap: 'wrap', borderColor: 'var(--primary-100)' }}>
        <span className="s-ico ico-indigo" style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="ShieldCheck" size={20} /></span>
        <div className="grow"><div className="bold" style={{ fontSize: 17 }}>Sakelar utama sekolah (administrator): {app.portal_master ? 'portal diizinkan' : 'portal DITUTUP'}</div><div className="small muted">Jika dimatikan, halaman Cek Nilai ditutup untuk <b>semua siswa dan semua guru</b>, apa pun pengaturan masing-masing guru.</div></div>
        {busy === 'master' && <Spinner />}
        <Switch on={!!app.portal_master} onChange={master} disabled={!!busy} label="Sakelar utama Portal Siswa" />
      </div>}
    </div>
  );
}

function PortalSettingsForm() {
  const { backend, settings, reloadSettings } = useApp(); const toast = useToast();
  const [v, set, dirty, setDirty] = useSettingsForm(settings && settings.portal, ['message']);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const save = async () => { if (v.message.length > 300) { setErr('Pesan maksimal 300 karakter'); return; } setBusy(true); setErr(''); try { await backend.savePortalSettings({ message: v.message.trim() }); await reloadSettings(); setDirty(false); toast.success('Pengaturan portal disimpan'); } catch (x) { setErr(x.message); } finally { setBusy(false); } };
  if (!settings) return null;
  return (
    <div className="card">
      <div className="card-head"><div className="card-title">Pesan untuk siswa</div></div>
      <div className="card-pad col gap-16">
        {err && <Alert tone="err">{err}</Alert>}
        <Alert tone="info">Cara siswa mencari nilai: <b>pilih kelas + ketik nama lengkap</b>. Tanpa akun, password, NISN, atau OTP. Hanya nilai yang dipublikasikan yang tampil.</Alert>
        <Field label="Pesan untuk siswa" hint={`Tampil di beranda & halaman Cek Nilai (${(v.message || '').length}/300)`}><textarea className="textarea" value={v.message || ''} onChange={set('message')} disabled={busy} placeholder="Contoh: Nilai PTS Ganjil sudah dapat dicek. Hubungi wali kelas jika ada pertanyaan." /></Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-primary" onClick={save} disabled={busy || !dirty}>{busy && <Spinner />}Simpan</button></div>
      </div>
    </div>
  );
}

function PortalAdminPage() {
  const { settings } = useApp(); const toast = useToast();
  const q = useTables(['students', 'publication_settings', 'exams']);
  const url = location.origin + location.pathname + '#/cek-nilai';
  const copy = async () => { if (await U.copyText(url)) toast.success('Link Portal Siswa disalin'); else toast.error('Gagal menyalin'); };
  const d = q.data;
  // nama kembar dalam satu kelas (akan tampil sebagai beberapa hasil di portal)
  const dupNames = d ? (() => { const m = {}; d.students.filter((s) => s.status === 'aktif').forEach((s) => { const k = s.class_id + '|' + U.normName(s.full_name); m[k] = (m[k] || 0) + 1; }); return Object.values(m).filter((n) => n > 1).length; })() : 0;
  return (
    <>
      <PageHead title="Portal Siswa" desc="Atur akses siswa untuk mengecek nilai tanpa login." actions={<a className="btn btn-outline" href="#/cek-nilai" target="_blank" rel="noopener"><Icon name="ExternalLink" size={16} />Buka Portal</a>} />
      <PortalToggleCard />
      <div className="card card-pad col">
        <div className="label">Link Portal Siswa</div>
        <div className="row gap-6"><input className="input mono" readOnly value={url} onFocus={(e) => e.target.select()} /><button className="btn btn-primary" onClick={copy}><Icon name="Copy" size={16} />Salin Link</button></div>
        <div className="hint">Bagikan ke siswa. Alamat ini sama dengan website utama.</div>
      </div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <PortalSettingsForm />
        <div className="card">
          <div className="card-head"><div className="card-title">Kesiapan data</div><button className="btn btn-ghost btn-sm" onClick={() => q.reload()}><Icon name="RefreshCw" size={14} /></button></div>
          <div className="card-pad col gap-16">
            {!d ? <LoadingState /> : <>
              <div className="row between"><span>Ujian terpublikasi</span><Link to="/admin/publikasi" className="bold">{d.publication_settings.filter((p) => p.is_published).length} / {d.exams.length}</Link></div>
              <div className="row between"><span>Siswa aktif</span><b>{d.students.filter((s) => s.status === 'aktif').length}</b></div>
              {dupNames > 0 ? <Alert tone="warn">Ada {dupNames} nama siswa yang sama dalam satu kelas. Di portal, keduanya tampil terpisah. Pertimbangkan menambahkan pembeda (mis. inisial) pada nama. <Link to="/admin/siswa">Data Siswa</Link></Alert> : <Alert tone="ok">Tidak ada nama siswa kembar dalam satu kelas.</Alert>}
              <div className="small muted"><Icon name="Info" size={14} style={{ verticalAlign: '-2px' }} /> Pencarian dilakukan di server: hanya siswa dengan nama yang cocok di kelas terpilih, dan hanya nilai dari ujian yang dipublikasikan. Daftar siswa tidak pernah dikirim ke browser.</div>
            </>}
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------------- Pengaturan ---------------- */
const SET_TABS = [['profil', 'Profil', 'UserRound'], ['akademik', 'Akademik', 'CalendarRange'], ['google', 'Google Forms', 'FileText'], ['supabase', 'Supabase', 'Database'], ['portal', 'Portal Siswa', 'Globe'], ['keamanan', 'Keamanan', 'ShieldCheck']];

function SettingsPage({ query }) {
  const tab = SET_TABS.some((t) => t[0] === query.tab) ? query.tab : 'profil';
  const { settings } = useApp();
  return (
    <>
      <PageHead title="Pengaturan" desc="Konfigurasi profil, akademik, integrasi, dan keamanan." />
      <div className="tabs">{SET_TABS.map(([k, l, ic]) => <button key={k} className={'tab' + (tab === k ? ' active' : '')} onClick={() => navigate('/admin/pengaturan?tab=' + k)}><Icon name={ic} size={16} />{l}</button>)}</div>
      {!settings ? <div className="card"><LoadingState /></div> : <>
        {tab === 'profil' && <ProfileTab />}
        {tab === 'akademik' && <AcademicTab />}
        {tab === 'google' && <GoogleTab />}
        {tab === 'supabase' && <SupabaseTab />}
        {tab === 'portal' && <><PortalToggleCard /><PortalSettingsForm /></>}
        {tab === 'keamanan' && <SecurityTab />}
      </>}
    </>
  );
}

function ProfileTab() {
  const { backend, settings, reloadSettings } = useApp(); const toast = useToast();
  const [v, set, dirty, setDirty] = useSettingsForm(settings.profile, ['full_name', 'school_name', 'subject']);
  const [fe, setFe] = useState({}); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const save = async (e) => {
    e && e.preventDefault(); const f = {}; if (!v.full_name.trim()) f.full_name = 'Nama guru wajib diisi'; if (!v.school_name.trim()) f.school_name = 'Nama sekolah wajib diisi'; setFe(f); if (Object.keys(f).length) return;
    setBusy(true); setErr('');
    try { await backend.saveProfile({ full_name: v.full_name.trim(), school_name: v.school_name.trim(), subject: v.subject.trim() }); await backend.savePortalSettings({ school_name: v.school_name.trim() }); await reloadSettings(); setDirty(false); toast.success('Profil disimpan'); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <form className="card" onSubmit={save} noValidate>
      <div className="card-head"><div><div className="card-title">Profil guru</div><div className="card-sub">{settings.profile.email}</div></div></div>
      <div className="card-pad col gap-16">
        {err && <Alert tone="err">{err}</Alert>}
        <div className="grid g2">
          <Field label="Nama guru" required error={fe.full_name}><input className={'input' + (fe.full_name ? ' err' : '')} value={v.full_name || ''} onChange={set('full_name')} disabled={busy} /></Field>
          <Field label="Mata pelajaran yang diampu"><input className="input" value={v.subject || ''} onChange={set('subject')} disabled={busy} /></Field>
          <Field label="Nama sekolah" required error={fe.school_name} hint="Tampil di kop laporan & Portal Siswa" className="g-span"><input className={'input' + (fe.school_name ? ' err' : '')} value={v.school_name || ''} onChange={set('school_name')} disabled={busy} /></Field>
        </div>
      </div>
      <div className="modal-foot"><button type="button" className="btn btn-outline" disabled={busy || !dirty} onClick={() => { setDirty(false); reloadSettings(); }}>Batal</button><button className="btn btn-primary" disabled={busy || !dirty}>{busy && <Spinner />}Simpan</button></div>
    </form>
  );
}

function AcademicTab() {
  const { backend, settings, reloadSettings } = useApp(); const toast = useToast();
  const [v, set, dirty, setDirty] = useSettingsForm(settings.portal, ['academic_year', 'semester', 'default_kktp']);
  const [fe, setFe] = useState({}); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const save = async (e) => {
    e && e.preventDefault(); const f = {};
    if (!/^\d{4}\/\d{4}$/.test(String(v.academic_year).trim())) f.academic_year = 'Format: 2026/2027'; else { const [a, b] = v.academic_year.split('/').map(Number); if (b !== a + 1) f.academic_year = 'Tahun kedua harus tahun pertama + 1'; }
    const k = Number(v.default_kktp); if (v.default_kktp === '' || isNaN(k) || k < 0 || k > 100) f.default_kktp = 'KKTP 0–100';
    setFe(f); if (Object.keys(f).length) return;
    setBusy(true); setErr('');
    try { await backend.savePortalSettings({ academic_year: String(v.academic_year).trim(), semester: v.semester, default_kktp: k }); await reloadSettings(); setDirty(false); toast.success('Pengaturan akademik disimpan'); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <form className="card" onSubmit={save} noValidate>
      <div className="card-head"><div><div className="card-title">Pengaturan akademik</div><div className="card-sub">Dipakai sebagai nilai bawaan saat membuat kelas dan ujian baru</div></div></div>
      <div className="card-pad col gap-16">
        {err && <Alert tone="err">{err}</Alert>}
        <div className="grid g3">
          <Field label="Tahun pelajaran aktif" required error={fe.academic_year}><input className={'input' + (fe.academic_year ? ' err' : '')} value={v.academic_year || ''} onChange={set('academic_year')} placeholder="2026/2027" disabled={busy} /></Field>
          <Field label="Semester aktif" required><select className="select" value={v.semester || 'Ganjil'} onChange={set('semester')} disabled={busy}>{U.SEMESTERS.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="KKTP default" required error={fe.default_kktp}><input className={'input' + (fe.default_kktp ? ' err' : '')} type="number" min="0" max="100" value={v.default_kktp} onChange={set('default_kktp')} disabled={busy} /></Field>
        </div>
        <Alert tone="info">Mengubah KKTP default tidak mengubah KKTP ujian yang sudah ada. Ubah KKTP per ujian melalui Edit Ujian.</Alert>
      </div>
      <div className="modal-foot"><button className="btn btn-primary" disabled={busy || !dirty}>{busy && <Spinner />}Simpan</button></div>
    </form>
  );
}

function GoogleTab() {
  const { backend, settings, reloadSettings, google } = useApp(); const toast = useToast();
  const [v, set, dirty, setDirty] = useSettingsForm(settings.profile, ['google_script_url', 'google_token']);
  const [busy, setBusy] = useState(false); const [testing, setTesting] = useState(false); const [test, setTest] = useState(null); const [err, setErr] = useState(''); const [showTok, setShowTok] = useState(false);
  const save = async () => {
    const u = (v.google_script_url || '').trim();
    if (u && !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(u)) { setErr('URL harus berformat https://script.google.com/macros/s/…/exec'); return; }
    if (u && (v.google_token || '').trim().length < 16) { setErr('Token rahasia minimal 16 karakter dan harus sama dengan SECRET_TOKEN di Apps Script'); return; }
    setBusy(true); setErr('');
    try { await backend.saveProfile({ google_script_url: u || null, google_token: (v.google_token || '').trim() || null }); await reloadSettings(); setDirty(false); setTest(null); toast.success('Konfigurasi Google disimpan'); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const runTest = async () => { setTesting(true); setTest(null); try { const r = await GoogleForms.ping({ google_script_url: (v.google_script_url || '').trim(), google_token: (v.google_token || '').trim() }); setTest({ ok: true, r }); } catch (x) { setTest({ ok: false, msg: x.message }); } finally { setTesting(false); } };
  const genTok = () => { const a = new Uint8Array(24); crypto.getRandomValues(a); set('google_token')(Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')); };
  const connected = !!google.google_script_url;
  return (
    <div className="col gap-20">
      <div className="card card-pad row gap-16" style={{ flexWrap: 'wrap' }}>
        <span className={connected ? 'dot-live' : 'dot-off'} />
        <div className="grow"><div className="bold">{connected ? 'Apps Script terkonfigurasi' : 'Google Forms belum terhubung'}</div><div className="small muted">{connected ? 'Gunakan "Uji koneksi" untuk memastikan script dapat dihubungi. Status ini tidak diasumsikan berhasil sebelum diuji.' : 'Ikuti panduan di bawah untuk menghubungkan akun Google Anda.'}</div></div>
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">Koneksi Apps Script</div></div>
        <div className="card-pad col gap-16">
          {err && <Alert tone="err">{err}</Alert>}
          <Field label="URL Web App" hint="Dari Deploy → Manage deployments → Web app URL"><input className="input mono" value={v.google_script_url || ''} onChange={set('google_script_url')} placeholder="https://script.google.com/macros/s/XXXX/exec" disabled={busy} /></Field>
          <Field label="Token rahasia" hint="Harus sama persis dengan SECRET_TOKEN di Script Properties. Jangan dibagikan.">
            <div className="row gap-6"><input className="input mono" type={showTok ? 'text' : 'password'} value={v.google_token || ''} onChange={set('google_token')} disabled={busy} autoComplete="off" /><button type="button" className="btn btn-outline btn-icon" onClick={() => setShowTok(!showTok)} aria-label="Tampilkan token"><Icon name={showTok ? 'EyeOff' : 'Eye'} size={16} /></button><button type="button" className="btn btn-outline" onClick={genTok} disabled={busy}><Icon name="KeyRound" size={16} />Buat token</button></div>
          </Field>
          {test && (test.ok ? <Alert tone="ok" title="Koneksi berhasil">Apps Script v{test.r.version} · akun {test.r.owner || '(tersembunyi)'} · {test.r.time}</Alert> : <Alert tone="err" title="Koneksi gagal">{test.msg}</Alert>)}
          <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={runTest} disabled={testing || !(v.google_script_url || '').trim()}>{testing ? <Spinner /> : <Icon name="PlugZap" size={16} />}Uji koneksi</button><button className="btn btn-primary" onClick={save} disabled={busy || !dirty}>{busy && <Spinner />}Simpan</button></div>
        </div>
      </div>
      <div className="card card-pad guide">
        <div className="card-title mb-8">Panduan setup Google Forms</div>
        <ol>
          <li>Buka <a href="https://script.google.com" target="_blank" rel="noopener">script.google.com</a> dengan akun Google guru → <b>New project</b>. Beri nama "Ujian & Nilai — Forms".</li>
          <li>Hapus isi <code>Code.gs</code>, lalu salin seluruh isi file <code>google-apps-script/Code.gs</code> dari source code proyek ini.</li>
          <li>Klik <b>Project Settings</b> (ikon gerigi) → <b>Script Properties</b> → <b>Add property</b>: nama <code>SECRET_TOKEN</code>, nilai = token dari tombol <b>Buat token</b> di atas.</li>
          <li>(Opsional, Google Cloud project) Tidak diperlukan: Apps Script memakai layanan <code>FormApp</code> bawaan. Jika organisasi Anda membatasi, minta admin Workspace mengizinkan Apps Script.</li>
          <li>Klik <b>Deploy → New deployment</b> → tipe <b>Web app</b>. <i>Execute as:</i> <b>Me</b>. <i>Who has access:</i> <b>Anyone</b>. Klik <b>Deploy</b> dan berikan izin OAuth (Forms & Drive) saat diminta.</li>
          <li>Salin <b>Web app URL</b> (berakhiran <code>/exec</code>), tempel di kolom URL di atas, isi token, lalu <b>Simpan</b>.</li>
          <li>Klik <b>Uji koneksi</b>. Jika berhasil, buka sebuah ujian yang sudah memiliki soal → <b>Buat Google Form</b>.</li>
          <li>Uji sinkronisasi: isi form sekali sebagai siswa (gunakan NISN/kode siswa yang terdaftar) → klik <b>Sinkronisasi</b> di halaman ujian.</li>
          <li>Setiap kali mengubah <code>Code.gs</code>, buat <b>New version</b> pada deployment yang sama agar URL tidak berubah.</li>
        </ol>
      </div>
    </div>
  );
}

function SupabaseTab() {
  const { backend, settings } = useApp();
  const cfg = window.__SB_CFG || {};
  const [ping, setPing] = useState(null); const [testing, setTesting] = useState(false);
  const isAdmin = settings && settings.profile && settings.profile.role === 'admin';
  const test = async () => { setTesting(true); setPing(null); try { const ms = await backend.ping(); setPing({ ok: true, ms }); } catch (x) { setPing({ ok: false, msg: x.message }); } finally { setTesting(false); } };
  return (
    <div className="col gap-20">
      <div className="card card-pad row gap-16" style={{ flexWrap: 'wrap' }}>
        <span className={backend.mode === 'supabase' ? 'dot-live' : 'dot-off'} />
        <div className="grow"><div className="bold">{backend.mode === 'supabase' ? 'Terhubung ke database sekolah' : 'Website belum dihubungkan ke Supabase — Mode Demo'}</div><div className="small muted">{backend.mode === 'supabase' ? 'Konfigurasi dikelola administrator (satu kali, saat deploy). Guru tidak perlu mengatur apa pun.' : 'Data saat ini adalah data DEMO di browser ini. Administrator perlu mengisi konfigurasi saat deploy.'}</div></div>
        {backend.mode === 'supabase' && <button className="btn btn-outline" onClick={test} disabled={testing}>{testing ? <Spinner /> : <Icon name="Activity" size={16} />}Uji koneksi</button>}
      </div>
      {ping && (ping.ok ? <Alert tone="ok">Database merespons dalam {ping.ms} ms dan akun Anda memiliki akses.</Alert> : <Alert tone="err" title="Koneksi gagal">{ping.msg}</Alert>)}
      {(isAdmin || backend.mode === 'demo') && <div className="card card-pad guide">
        <div className="card-title mb-8">Panduan administrator — konfigurasi satu kali</div>
        <ol>
          <li>Buat project di <a href="https://supabase.com" target="_blank" rel="noopener">supabase.com</a>.</li>
          <li>SQL Editor → jalankan berurutan: <code>0001_init.sql</code>, <code>0002_portal_kelas_nama.sql</code>, <code>0003_multi_guru_tugas.sql</code>.</li>
          <li>Isi <code>SUPABASE_URL</code> dan <code>SUPABASE_ANON_KEY</code> (publishable key) di <code>config.js</code> / environment variable Vercel, lalu deploy. <b>Jangan</b> memakai service_role key di frontend.</li>
          <li>Buat akun administrator pertama: Authentication → Users → Add user, lalu SQL: <code>update profiles set role='admin', active=true where email='admin@sekolah.sch.id';</code></li>
          <li>Deploy Edge Function <code>admin-teachers</code> (<code>supabase functions deploy admin-teachers</code>) agar menu <b>Akun Guru</b> dapat membuat/menonaktifkan akun.</li>
          <li>Matikan pendaftaran publik: Authentication → Providers → Email → nonaktifkan "Allow new users to sign up".</li>
          <li>Jika ada data lama sebelum versi multi-guru: <code>select public.claim_legacy_data('email.pemilik@sekolah.sch.id');</code></li>
          <li>Guru lain cukup membuka website dan login dengan akun dari menu Akun Guru.</li>
        </ol>
        {cfg.url && <div className="small muted mt-8">Project aktif: <span className="mono">{cfg.url}</span></div>}
      </div>}
    </div>
  );
}
function atobSafe(s) { try { return atob(s.replace(/-/g, '+').replace(/_/g, '/')); } catch (e) { return ''; } }

function SecurityTab() {
  const { backend, session, setSession } = useApp(); const toast = useToast();
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const logs = useQuery(() => backend.list('audit_logs', { order: ['created_at', 'desc'] }), [backend]);
  const change = async (e) => {
    e.preventDefault(); if (pw.length < 8) { setErr('Password minimal 8 karakter'); return; } if (pw !== pw2) { setErr('Konfirmasi password tidak sama'); return; }
    if (backend.mode !== 'supabase') { setErr('Ganti password memerlukan Supabase Auth.'); return; }
    setBusy(true); setErr('');
    try { const { error } = await backend.client.auth.updateUser({ password: pw }); if (error) throw error; setPw(''); setPw2(''); toast.success('Password diperbarui'); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const logoutAll = async () => { if (backend.mode === 'supabase') await backend.client.auth.signOut({ scope: 'global' }); else await backend.signOut(); setSession(null); navigate('/login'); };
  return (
    <div className="col gap-20">
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <form className="card" onSubmit={change} noValidate>
          <div className="card-head"><div className="card-title">Ganti password</div></div>
          <div className="card-pad col gap-16">
            {err && <Alert tone="err">{err}</Alert>}
            <Field label="Password baru"><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" disabled={busy} /></Field>
            <Field label="Ulangi password baru"><input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" disabled={busy} /></Field>
            <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-primary" disabled={busy || !pw}>{busy && <Spinner />}Simpan password</button></div>
          </div>
        </form>
        <div className="card card-pad col gap-16">
          <div className="card-title">Sesi</div>
          <dl className="kv"><dt>Akun</dt><dd>{session && session.user.email}</dd><dt>Mode</dt><dd>{backend.mode === 'supabase' ? 'Supabase Auth' : 'Demo'}</dd></dl>
          <button className="btn btn-outline icon-danger" onClick={logoutAll}><Icon name="LogOut" size={16} />Keluar dari semua perangkat</button>
          <div className="small muted">Perlindungan aktif: RLS di semua tabel, kunci jawaban & respons hanya dapat dibaca guru, Portal Siswa via fungsi server dengan rate limit.</div>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><div className="card-title">Log aktivitas</div><button className="btn btn-ghost btn-sm" onClick={() => logs.reload()}><Icon name="RefreshCw" size={14} />Muat ulang</button></div>
        {logs.loading && !logs.data ? <TableSkeleton rows={4} cols={4} /> : logs.error ? <ErrorState error={logs.error} onRetry={logs.reload} /> : !logs.data.length ? <EmptyState icon="ScrollText" title="Belum ada aktivitas" /> :
          <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}><table className="table"><thead><tr><th>Waktu</th><th>Aksi</th><th>Entitas</th><th>Detail</th></tr></thead><tbody>{logs.data.slice(0, 100).map((l) => <tr key={l.id}><td className="nowrap small">{U.fmtDateTime(l.created_at)}</td><td><Badge>{l.action}</Badge></td><td className="small">{l.entity}</td><td className="small muted">{typeof l.detail === 'object' ? JSON.stringify(l.detail) : l.detail}</td></tr>)}</tbody></table></div>}
      </div>
    </div>
  );
}

Object.assign(window, { PortalAdminPage, SettingsPage });
