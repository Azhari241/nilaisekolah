/* Core UI: ikon, router hash, konteks aplikasi, toast, dialog, state components */
const { useState, useEffect, useRef, useMemo, useCallback, useContext, createContext, Fragment } = React;

/* ---------- Icon (Lucide) ---------- */
function Icon({ name, size = 18, stroke = 2, className, style }) {
  const lib = window.lucide && window.lucide.icons;
  const node = lib && (lib[name] || lib[name.replace(/(^|-)(\w)/g, (_, a, b) => b.toUpperCase())]);
  if (!node) return <span style={{ width: size, height: size, display: 'inline-block', flex: 'none' }} />;
  const children = Array.isArray(node[0]) ? node : node[2] || [];
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} style={Object.assign({ flex: 'none' }, style)} aria-hidden="true">
      {children.map(([tag, attrs], i) => React.createElement(tag, Object.assign({ key: i }, attrs)))}
    </svg>
  );
}

/* ---------- Router ---------- */
function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  return { path: path.replace(/\/+$/, '') || '/', query };
}
function useRoute() {
  const [r, setR] = useState(parseHash());
  useEffect(() => { const on = () => { setR(parseHash()); window.scrollTo(0, 0); }; window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  return r;
}
function navigate(to) { location.hash = to; }
function setQuery(patch) {
  const { path, query } = parseHash();
  const q = Object.assign({}, query, patch);
  Object.keys(q).forEach((k) => (q[k] === '' || q[k] === undefined || q[k] === null) && delete q[k]);
  const s = new URLSearchParams(q).toString();
  history.replaceState(null, '', '#' + path + (s ? '?' + s : ''));
}
function Link({ to, children, className, onClick, ...rest }) {
  return <a href={'#' + to} className={className} onClick={onClick} {...rest}>{children}</a>;
}

/* ---------- App context ---------- */
const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

/* ---------- Toasts ---------- */
const ToastCtx = createContext(null);
const useToast = () => useContext(ToastCtx);
function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((type, msg) => {
    const id = Math.random();
    setItems((x) => [...x, { id, type, msg }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), type === 'error' ? 6000 : 3500);
  }, []);
  const api = useMemo(() => ({ success: (m) => push('success', m), error: (m) => push('error', m), info: (m) => push('info', m) }), [push]);
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={'toast ' + t.type}>
            <Icon className="ti" name={t.type === 'success' ? 'CircleCheck' : t.type === 'error' ? 'CircleAlert' : 'Info'} />
            <div>{t.msg}</div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Modal ---------- */
function Modal({ open, onClose, title, subtitle, size, children, footer, busy }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => { if (e.key === 'Escape' && !busy) onClose && onClose(); };
    document.addEventListener('keydown', k); document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [open, busy]);
  if (!open) return null;
  return ReactDOM.createPortal(
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose && onClose(); }}>
      <div className={'modal ' + (size || '')} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div><div className="modal-title">{title}</div>{subtitle && <div className="small muted mt-4">{subtitle}</div>}</div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} disabled={busy} aria-label="Tutup"><Icon name="X" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>, document.body);
}

/* ---------- Confirm ---------- */
const ConfirmCtx = createContext(null);
const useConfirm = () => useContext(ConfirmCtx);
function ConfirmProvider({ children }) {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // confirm({title, message, confirmText, danger, onConfirm: async () => {}}) -> Promise<boolean>
  const confirm = useCallback((opts) => new Promise((resolve) => { setErr(''); setSt(Object.assign({}, opts, { resolve })); }), []);
  const close = (v) => { if (busy) return; st && st.resolve(v); setSt(null); };
  const go = async () => {
    if (!st.onConfirm) { st.resolve(true); setSt(null); return; }
    setBusy(true); setErr('');
    try { await st.onConfirm(); st.resolve(true); setSt(null); }
    catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!st} onClose={() => close(false)} title={st && st.title} size="sm" busy={busy}
        footer={<><button className="btn btn-outline" onClick={() => close(false)} disabled={busy}>Batal</button>
          <button className={'btn ' + (st && st.danger ? 'btn-danger' : 'btn-primary')} onClick={go} disabled={busy}>{busy && <span className="spinner" />}{(st && st.confirmText) || 'Ya, lanjutkan'}</button></>}>
        <div className="col">
          <div className="text-2">{st && st.message}</div>
          {err && <div className="alert alert-err"><Icon className="ai" name="CircleAlert" /><div>{err}</div></div>}
        </div>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

/* ---------- Data hook ---------- */
function useQuery(fn, deps) {
  const [st, setSt] = useState({ data: null, loading: true, error: null });
  const tick = useRef(0);
  const run = useCallback(async (silent) => {
    const my = ++tick.current;
    if (!silent) setSt((s) => ({ data: s.data, loading: true, error: null }));
    try { const d = await fn(); if (my === tick.current) setSt({ data: d, loading: false, error: null }); }
    catch (e) { if (my === tick.current) setSt((s) => ({ data: s.data, loading: false, error: e.message || String(e) })); }
  }, deps); // eslint-disable-line
  useEffect(() => { run(); }, [run]);
  return Object.assign({}, st, { reload: run });
}
/** Ambil beberapa tabel sekaligus */
function useTables(names) {
  const { backend } = useApp();
  return useQuery(async () => {
    const res = await Promise.all(names.map((n) => backend.list(n)));
    return Object.fromEntries(names.map((n, i) => [n, res[i]]));
  }, [backend, names.join(',')]);
}

/* ---------- Small components ---------- */
function Field({ label, required, error, hint, children, className }) {
  return (
    <label className={'field ' + (className || '')}>
      {label && <span className="label">{label}{required && <span className="req">*</span>}</span>}
      {children}
      {error ? <span className="error-text">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}
function Badge({ tone, dot, children }) { return <span className={'badge ' + (tone ? 'b-' + tone : '') + (dot ? ' b-dot' : '')}>{children}</span>; }
function Spinner({ lg }) { return <span className={'spinner' + (lg ? ' lg' : '')} />; }
function LoadingState({ text = 'Memuat data…' }) { return <div className="state"><Spinner lg /><p>{text}</p></div>; }
function TableSkeleton({ rows = 5, cols = 5 }) {
  return <div style={{ padding: 16 }} className="col">{Array.from({ length: rows }).map((_, i) => <div key={i} className="row" style={{ gap: 16 }}>{Array.from({ length: cols }).map((_, j) => <div key={j} className="skel" style={{ flex: j === 1 ? 2 : 1 }} />)}</div>)}</div>;
}
function EmptyState({ icon = 'Inbox', title, text, action }) {
  return <div className="state"><div className="state-icon"><Icon name={icon} size={24} /></div><h3>{title}</h3>{text && <p>{text}</p>}{action && <div className="mt-8">{action}</div>}</div>;
}
function ErrorState({ error, onRetry }) {
  return <div className="state"><div className="state-icon err"><Icon name="TriangleAlert" size={24} /></div><h3>Gagal memuat data</h3><p>{error}</p>{onRetry && <button className="btn btn-outline mt-8" onClick={() => onRetry()}><Icon name="RefreshCw" size={16} />Coba lagi</button>}</div>;
}
function Alert({ tone = 'info', icon, title, children }) {
  const ic = icon || { info: 'Info', warn: 'TriangleAlert', err: 'CircleAlert', ok: 'CircleCheck' }[tone];
  return <div className={'alert alert-' + tone}><Icon className="ai" name={ic} /><div className="grow">{title && <b>{title}</b>}{title && children ? <div className="mt-4">{children}</div> : children}</div></div>;
}
function Pager({ page, total, perPage, onPage }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total ? (page - 1) * perPage + 1 : 0; const to = Math.min(total, page * perPage);
  return (
    <div className="pager">
      <div className="small muted">Menampilkan {from}–{to} dari {total} data</div>
      <div className="row gap-6">
        <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><Icon name="ChevronLeft" size={16} />Sebelumnya</button>
        <span className="small semibold" style={{ padding: '0 6px' }}>{page} / {pages}</span>
        <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Berikutnya<Icon name="ChevronRight" size={16} /></button>
      </div>
    </div>
  );
}
function SearchInput({ value, onChange, placeholder }) {
  return <div className="input-wrap"><span className="lead"><Icon name="Search" size={16} /></span><input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />{value && <span className="trail"><button className="btn btn-ghost btn-icon btn-sm" onClick={() => onChange('')} aria-label="Hapus pencarian"><Icon name="X" size={14} /></button></span>}</div>;
}
function Switch({ on, onChange, disabled, label }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={'switch' + (on ? ' on' : '')} disabled={disabled} onClick={() => onChange(!on)} />;
}
function DemoTag() { const { backend } = useApp(); return backend.mode === 'demo' ? <Badge tone="amber">DEMO</Badge> : null; }
function ScoreBadge({ score, kktp }) {
  if (score === null || score === undefined) return <span className="faint">—</span>;
  return <span className="bold" style={{ color: score >= kktp ? 'var(--green-600)' : 'var(--red)' }}>{U.fmtNum(score, 2)}</span>;
}
function PassBadge({ score, kktp, emptyLabel = 'Belum dinilai' }) {
  if (score === null || score === undefined) return <Badge>{emptyLabel}</Badge>;
  return score >= kktp ? <Badge tone="green" dot>Tuntas</Badge> : <Badge tone="red" dot>Belum tuntas</Badge>;
}
function PageHead({ title, desc, crumbs, actions }) {
  return (
    <div className="page-head">
      <div className="grow">
        {crumbs && <div className="crumb">{crumbs.map((c, i) => <span key={i} className="row gap-6">{i > 0 && <Icon name="ChevronRight" size={13} />}{c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}</span>)}</div>}
        <h2>{title}</h2>{desc && <p>{desc}</p>}
      </div>
      {actions && <div className="row-wrap">{actions}</div>}
    </div>
  );
}

/* ---------- Print ---------- */
let __printRoot = null;
function printNode(node) {
  const el = document.getElementById('print-root');
  if (!__printRoot) __printRoot = ReactDOM.createRoot(el); // satu root dipakai ulang (hindari bentrok print beruntun)
  __printRoot.render(node);
  const cleanup = () => { window.removeEventListener('afterprint', cleanup); __printRoot.render(null); };
  window.addEventListener('afterprint', cleanup);
  // tunggu render + font siap agar tabel/grafik tidak terpotong
  const go = () => requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(go, 50)); else setTimeout(go, 300);
}

Object.assign(window, { Icon, useRoute, navigate, setQuery, Link, AppCtx, useApp, ToastProvider, useToast, Modal, ConfirmProvider, useConfirm, useQuery, useTables, Field, Badge, Spinner, LoadingState, TableSkeleton, EmptyState, ErrorState, Alert, Pager, SearchInput, Switch, DemoTag, ScoreBadge, PassBadge, PageHead, printNode, parseHash });
