/* Export Rekap Nilai ke PDF (jsPDF + autoTable) dan Word .docx (docx).
 * Isi = data yang sama dengan halaman (RecapData.build). A4, portrait/landscape. */
(function () {
  const f1 = (v) => (v === null || v === undefined || isNaN(v) ? '-' : (Math.round(v * 10) / 10).toLocaleString('id-ID'));
  const todayStr = () => new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  function meta(R, opt) {
    const p = opt.profile || {};
    return [
      ['Nama sekolah', p.school_name || '-'], ['Nama guru', p.full_name || '-'],
      ['Tahun pelajaran', opt.f.year || 'Semua'], ['Semester', opt.f.semester || 'Semua'],
      ['Kelas', opt.f.class ? (R.cMap[opt.f.class] || {}).name : 'Semua kelas'], ['Mata pelajaran', opt.f.subject ? (R.sMap[opt.f.subject] || {}).name : 'Semua mapel'],
      ['Jenis penilaian', opt.f.kind ? U.KINDS[opt.f.kind] : 'Ujian, tugas & nilai manual'], ['Tanggal cetak', todayStr()],
    ];
  }
  function tableData(R, opt) {
    const rows = opt.studentId ? R.rows.filter((r) => r.s.id === opt.studentId) : R.rows;
    const multiClass = !opt.f.class;
    const head = ['No', 'Nama Siswa'].concat(multiClass ? ['Kelas'] : [], ['Ujian', 'Tugas', 'Manual', 'Rata-rata', 'Tertinggi', 'Terendah', 'KKTP', 'Ketuntasan', 'Keterangan']);
    const body = rows.map((r, i) => [String(i + 1), r.s.full_name].concat(multiClass ? [(r.cls || {}).name || ''] : [],
      [f1(r.ujian), f1(r.tugas), f1(r.manual), f1(r.avg), f1(r.max), f1(r.min), f1(r.kktp), r.n ? (r.tuntas ? 'Tuntas' : 'Belum tuntas') : 'Belum dinilai', r.n ? (r.fails ? r.fails + ' nilai < KKTP' : '') + (r.n < r.total ? (r.fails ? '; ' : '') + (r.total - r.n) + ' belum dinilai' : '') : '']));
    return { head, body, rows };
  }
  function detailData(R, studentId) {
    const pts = RecapData.studentTimeline(R, studentId);
    return { head: ['No', 'Tanggal', 'Jenis', 'Penilaian', 'Mapel', 'Nilai', 'KKTP', 'Status'], body: pts.map((p, i) => [String(i + 1), U.fmtDate(p.e.date), U.KINDS[U.kindOf(p.e)], p.e.name, (R.sMap[p.e.subject_id] || {}).name || '', f1(p.score), f1(Number(p.e.kktp)), p.score >= Number(p.e.kktp) ? 'Tuntas' : 'Belum tuntas']) };
  }
  function chartSvgs(R, opt) {
    const out = [];
    if (opt.studentId) {
      const pts = RecapData.studentTimeline(R, opt.studentId);
      if (pts.length) out.push({ title: 'Grafik perkembangan nilai — ' + (R.rows.find((r) => r.s.id === opt.studentId) || { s: {} }).s.full_name, svg: Charts.line({ categories: pts.map((p) => p.e.name), series: [{ name: 'Nilai', color: '#4f46e5', values: pts.map((p) => p.score), kinds: pts.map((p) => U.kindOf(p.e)) }], kktp: R.kktp }) });
    } else {
      const ct = RecapData.classTimeline(R);
      if (ct.length) out.push({ title: 'Grafik perkembangan kelas (rata-rata, tertinggi, terendah per penilaian)', svg: Charts.line({ categories: ct.map((p) => p.e.name), series: [{ name: 'Rata-rata', color: '#4f46e5', values: ct.map((p) => p.avg), kinds: ct.map((p) => p.kind) }, { name: 'Tertinggi', color: '#16a34a', values: ct.map((p) => p.max), dashed: true }, { name: 'Terendah', color: '#dc2626', values: ct.map((p) => p.min), dashed: true }], kktp: R.kktp }) });
      if (R.summary.studentsPass + R.summary.studentsFail) out.push({ title: 'Ketuntasan siswa', svg: Charts.pass({ pass: R.summary.studentsPass, fail: R.summary.studentsFail }) });
    }
    return out;
  }

  async function pdf(R, opt) {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) throw new Error('Library PDF belum dimuat. Periksa koneksi internet.');
    const doc = new jsPDF({ orientation: opt.orientation === 'landscape' ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(); const M = 14; let y = 16;
    const p = opt.profile || {};
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(opt.title || 'REKAP NILAI SISWA', W / 2, y, { align: 'center' }); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); if (p.school_name) { doc.text(p.school_name, W / 2, y, { align: 'center' }); y += 4; }
    doc.setLineWidth(0.6); doc.line(M, y, W - M, y); y += 6;
    doc.setFontSize(9.5);
    const m = meta(R, opt); const colW = (W - 2 * M) / 2;
    m.forEach(([k, v], i) => { const x = M + (i % 2) * colW; doc.text(k, x, y); doc.text(': ' + String(v), x + 30, y); if (i % 2) y += 5; });
    if (m.length % 2) y += 5; y += 2;
    const S = R.summary;
    if (!opt.studentId) { doc.setFont('helvetica', 'bold'); doc.text(`Rata-rata ${f1(S.avg)}   ·   Tertinggi ${f1(S.max)}   ·   Terendah ${f1(S.min)}   ·   Siswa tuntas ${S.studentsPass}   ·   Belum tuntas ${S.studentsFail}   ·   Ketuntasan ${S.pctStudents === null ? '-' : f1(S.pctStudents) + '%'}`, M, y); doc.setFont('helvetica', 'normal'); y += 4; }
    if (opt.showTable !== false) {
      const t = opt.studentId ? detailData(R, opt.studentId) : tableData(R, opt);
      doc.autoTable({ startY: y + 2, head: [t.head], body: t.body, theme: 'grid', margin: { left: M, right: M },
        styles: { fontSize: opt.orientation === 'landscape' ? 8.5 : 7.8, cellPadding: 1.6, lineColor: [60, 60, 60], lineWidth: 0.15, textColor: 20, overflow: 'linebreak' },
        headStyles: { fillColor: [238, 240, 251], textColor: 20, fontStyle: 'bold', halign: 'center' },
        columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 1: { cellWidth: opt.studentId ? 22 : 'auto' } }, rowPageBreak: 'avoid' });
      y = doc.lastAutoTable.finalY + 6;
    }
    if (opt.showCharts) {
      for (const c of chartSvgs(R, opt)) {
        const png = await Charts.toPng(c.svg); const iw = W - 2 * M; const ih = (png.h / png.w) * iw;
        if (y + ih + 8 > doc.internal.pageSize.getHeight() - 14) { doc.addPage(); y = 16; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(c.title, M, y); y += 3; doc.addImage(png.dataUrl, 'PNG', M, y, iw, ih); y += ih + 6;
      }
    }
    if (opt.signature && opt.signature.enabled) {
      const H = doc.internal.pageSize.getHeight(); if (y + 40 > H - 10) { doc.addPage(); y = 20; }
      const x = W - M - 70; doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.text(`${opt.signature.place ? opt.signature.place + ', ' : ''}${opt.signature.date || todayStr()}`, x, y); y += 5;
      doc.text('Mengetahui,', x, y); y += 5; doc.text(opt.signature.title || 'Guru Mata Pelajaran', x, y); y += 22;
      doc.setFont('helvetica', 'bold'); doc.text(opt.signature.name || '(........................................)', x, y); y += 5;
      if (opt.signature.nip) { doc.setFont('helvetica', 'normal'); doc.text('NIP. ' + opt.signature.nip, x, y); }
    }
    const n = doc.internal.getNumberOfPages();
    for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120); doc.text(`Halaman ${i} dari ${n} · Dicetak ${todayStr()}`, W / 2, doc.internal.pageSize.getHeight() - 7, { align: 'center' }); doc.setTextColor(0); }
    doc.save((opt.filename || 'rekap-nilai') + '.pdf');
  }

  async function word(R, opt) {
    const D = window.docx; if (!D) throw new Error('Library Word belum dimuat. Periksa koneksi internet.');
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, PageOrientation, ImageRun, BorderStyle, Footer, PageNumber } = D;
    const land = opt.orientation === 'landscape';
    const P = (text, o = {}) => new Paragraph({ alignment: o.align, spacing: { after: o.after ?? 60 }, children: [new TextRun({ text: String(text), bold: o.bold, size: o.size || 20, font: 'Arial' })] });
    const cell = (t, head) => new TableCell({ children: [new Paragraph({ alignment: head ? AlignmentType.CENTER : undefined, children: [new TextRun({ text: String(t), bold: !!head, size: land ? 17 : 16, font: 'Arial' })] })], shading: head ? { fill: 'EEF0FB' } : undefined, margins: { top: 40, bottom: 40, left: 60, right: 60 } });
    const tbl = (head, body) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, cantSplit: true, children: head.map((h) => cell(h, true)) })].concat(body.map((r) => new TableRow({ cantSplit: true, children: r.map((c) => cell(c)) }))) });
    const kids = [];
    kids.push(P(opt.title || 'REKAP NILAI SISWA', { align: AlignmentType.CENTER, bold: true, size: 28, after: 40 }));
    if ((opt.profile || {}).school_name) kids.push(P(opt.profile.school_name, { align: AlignmentType.CENTER, size: 22, after: 40 }));
    kids.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '000000' } }, spacing: { after: 120 }, children: [] }));
    const m = meta(R, opt);
    kids.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
      rows: Array.from({ length: Math.ceil(m.length / 2) }, (_, i) => new TableRow({ children: [m[i * 2], m[i * 2 + 1]].map((kv) => new TableCell({ borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [new Paragraph({ children: kv ? [new TextRun({ text: kv[0] + ': ', size: 19, font: 'Arial' }), new TextRun({ text: String(kv[1]), bold: true, size: 19, font: 'Arial' })] : [] })] })) })) }));
    const S = R.summary;
    if (!opt.studentId) kids.push(P(`Rata-rata ${f1(S.avg)} · Tertinggi ${f1(S.max)} · Terendah ${f1(S.min)} · Siswa tuntas ${S.studentsPass} · Belum tuntas ${S.studentsFail} · Ketuntasan ${S.pctStudents === null ? '-' : f1(S.pctStudents) + '%'}`, { bold: true, size: 19, after: 120 }));
    if (opt.showTable !== false) { const t = opt.studentId ? detailData(R, opt.studentId) : tableData(R, opt); kids.push(tbl(t.head, t.body)); kids.push(P('', { after: 120 })); }
    if (opt.showCharts) {
      const iw = land ? 900 : 620;
      for (const c of chartSvgs(R, opt)) {
        const png = await Charts.toPng(c.svg); const bin = Uint8Array.from(atob(png.dataUrl.split(',')[1]), (ch) => ch.charCodeAt(0));
        kids.push(P(c.title, { bold: true, size: 20 }));
        kids.push(new Paragraph({ keepLines: true, children: [new ImageRun({ data: bin, type: 'png', transformation: { width: iw, height: Math.round((png.h / png.w) * iw) } })], spacing: { after: 160 } }));
      }
    }
    if (opt.signature && opt.signature.enabled) {
      const sg = opt.signature; const R2 = (t, b) => new Paragraph({ alignment: AlignmentType.LEFT, indent: { left: land ? 9500 : 5600 }, keepNext: true, children: [new TextRun({ text: t, bold: b, size: 20, font: 'Arial' })] });
      kids.push(P('', { after: 200 }));
      kids.push(R2(`${sg.place ? sg.place + ', ' : ''}${sg.date || todayStr()}`)); kids.push(R2('Mengetahui,')); kids.push(R2(sg.title || 'Guru Mata Pelajaran'));
      kids.push(R2('')); kids.push(R2('')); kids.push(R2('')); kids.push(R2(sg.name || '(........................................)', true)); if (sg.nip) kids.push(R2('NIP. ' + sg.nip));
    }
    const doc = new Document({ sections: [{ properties: { page: { size: { orientation: land ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT, width: 11906, height: 16838 }, margin: { top: 850, bottom: 850, left: 850, right: 850 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Dicetak ' + todayStr() + ' · Halaman ', size: 16, font: 'Arial', color: '777777' }), new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: '777777' })] })] }) },
      children: kids }] });
    const blob = await Packer.toBlob(doc);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (opt.filename || 'rekap-nilai') + '.docx'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  window.RecapExport = { pdf, word, tableData, detailData, chartSvgs, meta, f1 };
})();
