// Supabase Edge Function: admin-teachers
// Manajemen akun guru — HANYA untuk pengguna dengan role 'admin'.
// Service role key hanya ada di server (secret SUPABASE_SERVICE_ROLE_KEY bawaan Edge Functions),
// tidak pernah dikirim ke browser.
//
// Deploy:  supabase functions deploy admin-teachers
// Aksi: list | create {email, full_name, role, password} | update {id, patch:{full_name, role, active}} | delete {id}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const OWNED = ['classes', 'subjects', 'students', 'exams', 'exam_questions', 'grades', 'exam_responses', 'publication_settings'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    // verifikasi pemanggil
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: u, error: ue } = await admin.auth.getUser(jwt);
    if (ue || !u?.user) return json({ error: 'Tidak terautentikasi' }, 401);
    const { data: me } = await admin.from('profiles').select('id, role, active').eq('id', u.user.id).single();
    if (!me || me.role !== 'admin' || !me.active) return json({ error: 'Hanya administrator yang dapat mengelola akun guru.' }, 403);

    const body = await req.json();
    switch (body.action) {
      case 'list': {
        const { data: ps, error } = await admin.from('profiles').select('id, email, full_name, role, active, created_at').order('created_at');
        if (error) throw error;
        const teachers = await Promise.all(ps!.map(async (p) => {
          const counts: Record<string, number> = {};
          for (const t of ['classes', 'students', 'exams']) {
            const { count } = await admin.from(t).select('id', { count: 'exact', head: true }).eq('teacher_id', p.id);
            counts[t] = count || 0;
          }
          return { ...p, counts };
        }));
        return json({ teachers });
      }
      case 'create': {
        const { email, full_name, role, password } = body;
        if (!/^\S+@\S+\.\S+$/.test(email || '')) return json({ error: 'Email tidak valid' }, 400);
        if (!password || password.length < 8) return json({ error: 'Password awal minimal 8 karakter' }, 400);
        const { data: cu, error: ce } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
        if (ce) return json({ error: /already/i.test(ce.message) ? 'Email sudah terdaftar' : ce.message }, 400);
        const r = role === 'admin' ? 'admin' : 'teacher';
        const { data: p, error: pe } = await admin.from('profiles').upsert({ id: cu.user.id, email, full_name: full_name || '', role: r, active: true }).select().single();
        if (pe) throw pe;
        return json({ teacher: p });
      }
      case 'update': {
        const { id, patch } = body;
        if (id === me.id && (patch.role === 'teacher' || patch.active === false)) return json({ error: 'Anda tidak dapat menurunkan role atau menonaktifkan akun Anda sendiri.' }, 400);
        const safe: Record<string, unknown> = {};
        if (typeof patch.full_name === 'string') safe.full_name = patch.full_name;
        if (patch.role === 'admin' || patch.role === 'teacher') safe.role = patch.role;
        if (typeof patch.active === 'boolean') safe.active = patch.active;
        const { data: p, error } = await admin.from('profiles').update(safe).eq('id', id).select().single();
        if (error) throw error;
        // Catatan: auth.admin.signOut() membutuhkan JWT pengguna, bukan user id, jadi tidak dipanggil di sini.
        // Akun nonaktif langsung terblokir karena semua policy RLS memeriksa is_teacher() (active = true),
        // dan login berikutnya ditolak oleh pemeriksaan profil di frontend.
        return json({ teacher: p });
      }
      case 'delete': {
        const { id } = body;
        if (id === me.id) return json({ error: 'Anda tidak dapat menghapus akun Anda sendiri.' }, 400);
        let n = 0;
        for (const t of OWNED) { const { count } = await admin.from(t).select('id', { count: 'exact', head: true }).eq('teacher_id', id); n += count || 0; }
        if (n > 0) return json({ error: `Akun ini masih memiliki ${n} data. Nonaktifkan akun saja agar data tetap aman.` }, 400);
        await admin.from('portal_settings').delete().eq('teacher_id', id);
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) throw error;
        return json({ ok: true });
      }
      default: return json({ error: 'Aksi tidak dikenal' }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message || String(e) }, 500);
  }
});
