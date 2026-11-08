/* Akun Guru — hanya administrator. Membuat, mengubah role, menonaktifkan, dan menghapus akun guru.
 * Di produksi semua aksi melewati Edge Function "admin-teachers" (service role hanya di server). */

function TeacherForm({ open, onClose, onSaved }) {
  const { backend } = useApp(); const toast = useToast();
  const [v, setV] = useState({ full_name: '', email: '', role: 'teacher', password: '' }); const [fe, setFe] = useState({}); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [show, setShow] = useState(false);
  useEffect(() => { if (open) { const a = new Uint8Array(6); crypto.getRandomValues(a); setV({ full_name: '', email: '', role: 'teacher', password: 'Guru-' + Array.from(a, (b) => b.toString(36)).join('').slice(0, 8) }); setFe({}); setErr(''); setShow(true); } }, [open]);
  const set = (k) => (e) => setV(Object.assign({}, v, { [k]: e.target.value }));
  const submit = async (e) => {
    e && e.preventDefault(); const f = {};
    if (!v.full_name.trim()) f.full_name = 'Nama wajib diisi'; if (!/^\S+@\S+\.\S+$/.test(v.email)) f.email = 'Email tidak valid'; if (v.password.length < 8) f.password = 'Minimal 8 karakter';
    setFe(f); if (Object.keys(f).length) return;
    setBusy(true); setErr('');
    try { await backend.createTeacher({ full_name: v.full_name.trim(), email: v.email.trim().toLowerCase(), role: v.role, password: v.password }); toast.success('Akun guru dibuat. Berikan email & password awal kepada guru.'); onSaved(); onClose(); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} busy={busy} title="Tambah Akun Guru" footer={<><button className="btn btn-outline" onClick={onClose} disabled={busy}>Batal</button><button className="btn btn-primary" onClick={submit} disabled={busy}>{busy && <Spinner />}Buat akun</button></>}>
      <form className="col gap-16" onSubmit={submit} noValidate>
        {err && <Alert tone="err">{err}</Alert>}
        <Field label="Nama guru" required error={fe.full_name}><input className={'input' + (fe.full_name ? ' err' : '')} value={v.full_name} onChange={set('full_name')} autoFocus disabled={busy} /></Field>
        <Field label="Email login" required error={fe.email}><input className={'input' + (fe.email ? ' err' : '')} type="email" value={v.email} onChange={set('email')} disabled={busy} /></Field>
        <Field label="Password awal" required error={fe.password} hint="Sampaikan ke guru secara pribadi. Guru dapat menggantinya di Pengaturan → Keamanan."><div className="row gap-6"><input className={'input mono' + (fe.password ? ' err' : '')} type={show ? 'text' : 'password'} value={v.password} onChange={set('password')} disabled={busy} /><button type="button" className="btn btn-outline btn-icon" onClick={() => setShow(!show)}><Icon name={show ? 'EyeOff' : 'Eye'} size={16} /></button></div></Field>
        <Field label="Role"><select className="select" value={v.role} onChange={set('role')} disabled={busy}><option value="teacher">Guru — hanya mengelola datanya sendiri</option><option value="admin">Administrator — juga mengelola akun guru</option></select></Field>
        <Alert tone="info">Setiap guru memiliki data terpisah (kelas, siswa, ujian, tugas, nilai). Administrator <b>tidak</b> dapat melihat data guru lain.</Alert>
      </form>
    </Modal>
  );
}

function AccountsPage() {
  const { backend, session, settings } = useApp(); const toast = useToast(); const confirm = useConfirm();
  const isAdmin = settings && settings.profile && settings.profile.role === 'admin';
  const q = useQuery(() => (isAdmin ? backend.listTeachers() : Promise.resolve([])), [backend, isAdmin]);
  const [form, setForm] = useState(false); const [busyId, setBusyId] = useState(null); const [edit, setEdit] = useState(null);
  if (!settings) return <div className="card"><LoadingState /></div>;
  if (!isAdmin) return <div className="card"><EmptyState icon="ShieldX" title="Khusus administrator" text="Halaman ini hanya dapat diakses oleh administrator untuk mengelola akun guru." action={<Link className="btn btn-outline" to="/admin">Ke Dashboard</Link>} /></div>;
  const me = session.user.id;
  const upd = async (t, patch, msg) => { setBusyId(t.id); try { await backend.updateTeacher(t.id, patch); toast.success(msg); q.reload(true); } catch (x) { toast.error(x.message); } finally { setBusyId(null); } };
  const toggle = (t) => t.active
    ? confirm({ title: 'Nonaktifkan akun?', confirmText: 'Nonaktifkan', danger: true, message: <><b>{t.full_name}</b> tidak dapat login dan portal siswanya ditutup. Data guru tetap tersimpan aman dan dapat diaktifkan kembali.</>, onConfirm: async () => { await backend.updateTeacher(t.id, { active: false }); toast.success('Akun dinonaktifkan'); q.reload(true); } })
    : upd(t, { active: true }, 'Akun diaktifkan');
  const del = (t) => confirm({ title: 'Hapus akun guru?', danger: true, confirmText: 'Hapus akun', message: <div className="col"><div>Akun <b>{t.full_name}</b> ({t.email}) akan dihapus.</div><Alert tone="warn">Penghapusan hanya diizinkan jika guru <b>tidak memiliki data</b>. Jika masih ada data, gunakan <b>Nonaktifkan</b> agar data tidak hilang.</Alert></div>, onConfirm: async () => { await backend.deleteTeacher(t.id); toast.success('Akun dihapus'); q.reload(true); } });
  const saveName = async () => { if (!edit.full_name.trim()) return; await upd(edit, { full_name: edit.full_name.trim() }, 'Nama diperbarui'); setEdit(null); };
  return (
    <>
      <PageHead title="Akun Guru" desc="Kelola akun guru. Hanya administrator yang dapat membuat akun — tidak ada pendaftaran publik." actions={<button className="btn btn-primary" onClick={() => setForm(true)}><Icon name="UserPlus" size={16} />Tambah Guru</button>} />
      <Alert tone="info" title="Konfigurasi satu kali">Website memakai satu project Supabase yang diatur administrator saat deploy. Guru baru cukup login dengan email & password dari Anda — tanpa konfigurasi apa pun.</Alert>
      <div className="card">
        {q.loading && !q.data ? <TableSkeleton cols={6} /> : q.error ? <ErrorState error={q.error} onRetry={q.reload} /> : !q.data.length ? <EmptyState icon="Users" title="Belum ada akun" /> :
          <div className="table-wrap"><table className="table"><thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Status</th><th className="right">Kelas</th><th className="right">Siswa</th><th className="right">Penilaian</th><th className="actions">Aksi</th></tr></thead>
            <tbody>{q.data.map((t) => (
              <tr key={t.id}>
                <td>{edit && edit.id === t.id ? <div className="row gap-6"><input className="input input-sm" value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} autoFocus onKeyDown={(e) => e.key === 'Enter' && saveName()} /><button className="btn btn-primary btn-icon btn-sm" onClick={saveName}><Icon name="Check" size={14} /></button><button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEdit(null)}><Icon name="X" size={14} /></button></div>
                  : <div className="row gap-6"><span className="avatar" style={{ width: 28, height: 28, fontSize: 12 }}>{U.initials(t.full_name)}</span><span className="semibold">{t.full_name || '—'}</span>{t.id === me && <Badge>Anda</Badge>}</div>}</td>
                <td className="small">{t.email}</td>
                <td><select className="select select-sm" style={{ width: 140 }} value={t.role} disabled={busyId === t.id || t.id === me} onChange={(e) => upd(t, { role: e.target.value }, 'Role diperbarui')}><option value="teacher">Guru</option><option value="admin">Administrator</option>{t.role === 'pending' && <option value="pending">Menunggu</option>}</select></td>
                <td>{t.active ? <Badge tone="green" dot>Aktif</Badge> : <Badge tone="red" dot>Nonaktif</Badge>}</td>
                <td className="right">{t.counts ? t.counts.classes : '—'}</td><td className="right">{t.counts ? t.counts.students : '—'}</td><td className="right">{t.counts ? t.counts.exams : '—'}</td>
                <td className="actions">
                  <button className="btn btn-ghost btn-icon btn-sm" title="Ubah nama" onClick={() => setEdit({ id: t.id, full_name: t.full_name })}><Icon name="Pencil" size={15} /></button>
                  {t.id !== me && <button className="btn btn-ghost btn-sm" onClick={() => toggle(t)} disabled={busyId === t.id}>{busyId === t.id ? <Spinner /> : <Icon name={t.active ? 'UserX' : 'UserCheck'} size={15} />}{t.active ? 'Nonaktifkan' : 'Aktifkan'}</button>}
                  {t.id !== me && <button className="btn btn-ghost btn-icon btn-sm icon-danger" title="Hapus akun" onClick={() => del(t)}><Icon name="Trash2" size={15} /></button>}
                </td>
              </tr>))}</tbody></table></div>}
      </div>
      <p className="xs muted">Angka kelas/siswa/penilaian hanya jumlah (untuk keputusan menghapus akun dengan aman). Isi data guru lain tidak dapat dibuka oleh administrator.</p>
      <TeacherForm open={form} onClose={() => setForm(false)} onSaved={() => q.reload(true)} />
    </>
  );
}

Object.assign(window, { AccountsPage });
