/* Utilitas umum: format, statistik, Excel (SheetJS), validasi */
(function () {
  const fmtDate = (d) => { if (!d) return '-'; const x = new Date(d); if (isNaN(x)) return d; return x.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const fmtDateTime = (d) => { if (!d) return '-'; const x = new Date(d); return x.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  const fmtNum = (n, d = 1) => (n === null || n === undefined || isNaN(n) ? '-' : Number(n).toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: 0 }));
  const initials = (s) => (s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

  function stats(scores, kktp) {
    const v = scores.filter((x) => typeof x === 'number' && !isNaN(x));
    if (!v.length) return { count: 0, avg: null, max: null, min: null, pass: 0, fail: 0, pct: null };
    const pass = kktp === undefined ? 0 : v.filter((x) => x >= kktp).length;
    return { count: v.length, avg: v.reduce((a, b) => a + b, 0) / v.length, max: Math.max(...v), min: Math.min(...v), pass, fail: v.length - pass, pct: (pass / v.length) * 100 };
  }
  const BUCKETS = [[0, 59, '0–59'], [60, 69, '60–69'], [70, 79, '70–79'], [80, 89, '80–89'], [90, 100, '90–100']];
  function distribution(scores) { return BUCKETS.map(([a, b, l]) => ({ label: l, value: scores.filter((s) => s >= a && s <= (b === 100 ? 100 : b + 0.999)).length })); }

  const NISN_RE = /^\d{10}$/;
  const ARABIC_RE = /[\u0600-\u06FF]/;

  function downloadXlsx(filename, sheets) {
    if (!window.XLSX) throw new Error('Library Excel belum dimuat.');
    const wb = XLSX.utils.book_new();
    // Cegah "formula injection": teks yang diawali = + - @ (mis. nama siswa dari import) disimpan sebagai teks biasa
    const safe = (v) => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v);
    sheets.forEach(({ name, rows, header, widths }) => {
      const ws = XLSX.utils.json_to_sheet(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safe(v)]))), { header });
      if (widths) ws['!cols'] = widths.map((w) => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    });
    XLSX.writeFile(wb, filename);
  }
  function readXlsx(file) {
    return new Promise((resolve, reject) => {
      if (!window.XLSX) return reject(new Error('Library Excel belum dimuat.'));
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return reject(new Error('Format file harus .xlsx, .xls, atau .csv'));
      if (file.size > 5 * 1024 * 1024) return reject(new Error('Ukuran file maksimal 5 MB'));
      const r = new FileReader();
      r.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array', cellDates: false });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
          const header = (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || []).map((h) => String(h).trim());
          resolve({ rows, header, sheet: wb.SheetNames[0] });
        } catch (err) { reject(new Error('File tidak dapat dibaca: ' + err.message)); }
      };
      r.onerror = () => reject(new Error('Gagal membaca file'));
      r.readAsArrayBuffer(file);
    });
  }
  const normName = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (x) {} ta.remove(); return ok;
    }
  }
  const EXAM_TYPES = ['Penilaian Harian', 'PTS', 'PAS', 'PAT', 'Ujian Praktik', 'Asesmen Sumatif', 'Lainnya'];
  const SEMESTERS = ['Ganjil', 'Genap'];
  const EXAM_STATUS = { draft: ['Draft', ''], aktif: ['Aktif', 'b-green'], ditutup: ['Ditutup', 'b-amber'], selesai: ['Selesai', 'b-indigo'], arsip: ['Arsip', ''] };
  const KINDS = { ujian: 'Ujian', tugas: 'Tugas', manual: 'Nilai Manual' };
  const TASK_TYPES = ['Tugas menulis', 'Tugas menghafal', 'Tugas praktik', 'Tugas membaca', 'Tugas membuat rangkuman', 'Tugas individu', 'Tugas kelompok', 'Pekerjaan rumah', 'Lainnya'];
  const MANUAL_CATEGORIES = ['Hafalan', 'Praktik', 'Tugas Kelas', 'Presentasi', 'Keaktifan', 'Pekerjaan Rumah', 'Kedisiplinan', 'Keterampilan', 'Penilaian Harian', 'Nilai Tambahan'];
  const kindOf = (e) => e.kind || 'ujian';
  const typeLabel = (e) => e.category || e.task_type || e.exam_type || '';
  // skor mentah (0..max) → nilai 0..100
  const toScore = (raw, max) => Math.round((Number(raw) / (Number(max) || 100)) * 10000) / 100;
  const fromScore = (score, max) => Math.round((Number(score) * (Number(max) || 100)) / 100 * 100) / 100;

  window.U = { fmtDate, fmtDateTime, fmtNum, initials, stats, distribution, NISN_RE, ARABIC_RE, downloadXlsx, readXlsx, norm, normName, copyText, EXAM_TYPES, SEMESTERS, EXAM_STATUS, KINDS, TASK_TYPES, MANUAL_CATEGORIES, kindOf, typeLabel, toScore, fromScore };
})();
