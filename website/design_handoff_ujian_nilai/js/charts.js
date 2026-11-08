/* Grafik SVG berbasis data (dipakai halaman, print, PDF, dan Word → data identik).
 * Semua fungsi mengembalikan string SVG. Charts.toPng() mengubahnya menjadi PNG untuk PDF/Word. */
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const FONT = 'font-family="Plus Jakarta Sans, Arial, sans-serif"';
  const KIND_COLOR = { ujian: '#4f46e5', tugas: '#d97706', manual: '#16a34a' };
  const short = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));

  function axes(w, h, pad, min, max, steps) {
    let out = '';
    for (let i = 0; i <= steps; i++) {
      const v = min + ((max - min) * i) / steps; const y = h - pad.b - ((v - min) / (max - min)) * (h - pad.t - pad.b);
      out += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y}" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>`;
      out += `<text x="${pad.l - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#64748b" ${FONT}>${Math.round(v)}</text>`;
    }
    return out;
  }
  function xLabels(cats, xOf, h, pad, maxLen) {
    const rot = cats.length > 6;
    return cats.map((c, i) => rot
      ? `<text transform="translate(${xOf(i)},${h - pad.b + 14}) rotate(-35)" text-anchor="end" font-size="10.5" fill="#475569" ${FONT}>${esc(short(c, maxLen))}</text>`
      : `<text x="${xOf(i)}" y="${h - pad.b + 18}" text-anchor="middle" font-size="11" fill="#475569" ${FONT}>${esc(short(c, maxLen))}</text>`).join('');
  }

  /** Grafik garis: categories[], series[{name,color,values[],kinds?[]}], kktp */
  function line({ categories, series, kktp, w = 760, h = 300, legend = true }) {
    const rot = categories.length > 6;
    const pad = { l: 44, r: 20, t: legend ? 34 : 16, b: rot ? 90 : 40 };
    const xOf = (i) => (categories.length === 1 ? (pad.l + w - pad.r) / 2 : pad.l + 16 + (i * (w - pad.l - pad.r - 32)) / (categories.length - 1));
    const yOf = (v) => h - pad.b - (v / 100) * (h - pad.t - pad.b);
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#fff"/>`;
    s += axes(w, h, pad, 0, 100, 5);
    if (kktp != null) s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${yOf(kktp)}" y2="${yOf(kktp)}" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="6 4"/><text x="${w - pad.r}" y="${yOf(kktp) - 5}" text-anchor="end" font-size="10.5" fill="#dc2626" ${FONT}>KKTP ${kktp}</text>`;
    series.forEach((se) => {
      const pts = se.values.map((v, i) => (v == null ? null : [xOf(i), yOf(v), v, i])).filter(Boolean);
      if (pts.length > 1) s += `<polyline fill="none" stroke="${se.color}" stroke-width="${se.dashed ? 2 : 2.5}" ${se.dashed ? 'stroke-dasharray="5 4"' : ''} points="${pts.map((p) => p[0] + ',' + p[1]).join(' ')}"/>`;
      pts.forEach((p) => {
        const c = se.kinds ? KIND_COLOR[se.kinds[p[3]]] || se.color : se.color;
        s += `<circle cx="${p[0]}" cy="${p[1]}" r="${se.dashed ? 3.5 : 5}" fill="${se.dashed ? '#fff' : c}" stroke="${se.dashed ? se.color : '#fff'}" stroke-width="2"/>`;
        if (!se.dashed && se.labels !== false) s += `<text x="${p[0]}" y="${p[1] - 10}" text-anchor="middle" font-size="11" font-weight="700" fill="#0f172a" ${FONT}>${Math.round(p[2] * 10) / 10}</text>`;
      });
    });
    s += xLabels(categories, xOf, h, pad, rot ? 22 : 16);
    if (legend) {
      let lx = pad.l;
      series.forEach((se) => { s += `<line x1="${lx}" x2="${lx + 18}" y1="14" y2="14" stroke="${se.color}" stroke-width="2.5" ${se.dashed ? 'stroke-dasharray="5 4"' : ''}/><text x="${lx + 24}" y="18" font-size="11.5" fill="#334155" ${FONT}>${esc(se.name)}</text>`; lx += 34 + se.name.length * 6.4; });
      if (series.some((se) => se.kinds)) Object.entries({ Ujian: KIND_COLOR.ujian, Tugas: KIND_COLOR.tugas, Manual: KIND_COLOR.manual }).forEach(([k, c]) => { s += `<circle cx="${lx + 5}" cy="14" r="5" fill="${c}"/><text x="${lx + 14}" y="18" font-size="11.5" fill="#334155" ${FONT}>${k}</text>`; lx += 64; });
    }
    return s + '</svg>';
  }

  /** Grafik batang vertikal: categories[], values[], colors?[], kktp?, max=100 */
  function bars({ categories, values, colors, kktp, w = 760, h = 280, max = 100, valueFmt }) {
    const rot = categories.length > 6;
    const pad = { l: 44, r: 16, t: 20, b: rot ? 90 : 40 };
    const n = categories.length; const slot = (w - pad.l - pad.r) / Math.max(1, n); const bw = Math.min(56, slot * 0.62);
    const xOf = (i) => pad.l + slot * i + slot / 2; const yOf = (v) => h - pad.b - (v / max) * (h - pad.t - pad.b);
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#fff"/>`;
    s += axes(w, h, pad, 0, max, 5);
    values.forEach((v, i) => {
      if (v == null) return; const y = yOf(v); const c = colors ? colors[i] : '#4f46e5';
      s += `<rect x="${xOf(i) - bw / 2}" y="${y}" width="${bw}" height="${Math.max(1, h - pad.b - y)}" rx="5" fill="${c}"/>`;
      s += `<text x="${xOf(i)}" y="${y - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="#0f172a" ${FONT}>${valueFmt ? valueFmt(v) : Math.round(v * 10) / 10}</text>`;
    });
    if (kktp != null) s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${yOf(kktp)}" y2="${yOf(kktp)}" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="6 4"/><text x="${w - pad.r}" y="${yOf(kktp) - 5}" text-anchor="end" font-size="10.5" fill="#dc2626" ${FONT}>KKTP ${kktp}</text>`;
    s += xLabels(categories, xOf, h, pad, rot ? 22 : 14);
    return s + '</svg>';
  }

  /** Batang ketuntasan bertumpuk (tuntas vs belum tuntas) */
  function pass({ pass, fail, w = 760, h = 90 }) {
    const t = pass + fail; const pw = t ? ((w - 40) * pass) / t : 0; const pct = t ? Math.round((pass / t) * 100) : 0;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#fff"/>`;
    s += `<rect x="20" y="16" width="${w - 40}" height="30" rx="8" fill="#fecaca"/>`;
    if (pw > 0) s += `<rect x="20" y="16" width="${pw}" height="30" rx="8" fill="#16a34a"/>`;
    s += `<text x="28" y="36" font-size="13" font-weight="700" fill="#fff" ${FONT}>${pass ? pct + '% tuntas' : ''}</text>`;
    s += `<circle cx="26" cy="68" r="6" fill="#16a34a"/><text x="38" y="72" font-size="12" fill="#334155" ${FONT}>Tuntas: ${pass} siswa</text>`;
    s += `<circle cx="196" cy="68" r="6" fill="#fca5a5"/><text x="208" y="72" font-size="12" fill="#334155" ${FONT}>Belum tuntas: ${fail} siswa</text>`;
    return s + '</svg>';
  }

  function toPng(svg, scale = 2) {
    return new Promise((resolve, reject) => {
      const m = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/); const w = Number(m[1]), h = Number(m[2]);
      const img = new Image();
      img.onload = () => { const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale; const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height); resolve({ dataUrl: c.toDataURL('image/png'), w, h }); };
      img.onerror = () => reject(new Error('Gagal merender grafik'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  window.Charts = { line, bars, pass, toPng, KIND_COLOR };
})();
