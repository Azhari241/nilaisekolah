/* Perhitungan rekap — SATU sumber data untuk halaman, grafik, print, PDF, dan Word.
 * Hanya memakai data yang sudah dibatasi RLS (milik guru yang login). Tidak membuat nilai baru. */
(function () {
  const SEM = { Ganjil: 1, Genap: 2 };
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

  function build(d, f) {
    const kindOf = U.kindOf;
    const exams = d.exams.filter((e) => (!f.year || e.academic_year === f.year) && (!f.semester || e.semester === f.semester) && (!f.class || e.class_id === f.class) && (!f.subject || e.subject_id === f.subject) && (!f.kind || kindOf(e) === f.kind))
      .sort((a, b) => (a.academic_year || '').localeCompare(b.academic_year || '') || (SEM[a.semester] - SEM[b.semester]) || (a.date || '').localeCompare(b.date || '') || a.name.localeCompare(b.name));
    const eMap = Object.fromEntries(exams.map((e) => [e.id, e]));
    const grades = d.grades.filter((g) => eMap[g.exam_id]);
    const cMap = Object.fromEntries(d.classes.map((c) => [c.id, c])); const sMap = Object.fromEntries(d.subjects.map((s) => [s.id, s]));
    const classIds = new Set(exams.map((e) => e.class_id));
    const students = d.students.filter((s) => (f.class ? s.class_id === f.class : classIds.has(s.class_id)) && (s.status === 'aktif' || grades.some((g) => g.student_id === s.id)))
      .sort((a, b) => ((cMap[a.class_id] || {}).name || '').localeCompare((cMap[b.class_id] || {}).name || '', 'id', { numeric: true }) || a.full_name.localeCompare(b.full_name));
    const kktpDefault = exams.length ? Math.round(avg(exams.map((e) => Number(e.kktp))) * 10) / 10 : 75;
    const rows = students.map((s) => {
      const sg = grades.filter((g) => g.student_id === s.id);
      const by = { ujian: [], tugas: [], manual: [] }; let fails = 0;
      sg.forEach((g) => { const e = eMap[g.exam_id]; by[kindOf(e)].push(Number(g.score)); if (Number(g.score) < Number(e.kktp)) fails++; });
      const all = sg.map((g) => Number(g.score));
      const myExams = exams.filter((e) => e.class_id === s.class_id);
      const a = avg(all);
      return { s, cls: cMap[s.class_id], n: sg.length, total: myExams.length, ujian: avg(by.ujian), tugas: avg(by.tugas), manual: avg(by.manual), avg: a, max: all.length ? Math.max(...all) : null, min: all.length ? Math.min(...all) : null, fails, tuntas: sg.length > 0 && fails === 0, kktp: kktpDefault }; // tuntas = semua nilai ≥ KKTP masing-masing penilaian
    });
    const allScores = grades.map((g) => Number(g.score));
    const passN = grades.filter((g) => Number(g.score) >= Number(eMap[g.exam_id].kktp)).length;
    const perExam = exams.map((e) => { const sc = grades.filter((g) => g.exam_id === e.id).map((g) => Number(g.score)); const st = U.stats(sc, Number(e.kktp)); return Object.assign({ e, kind: kindOf(e), cls: cMap[e.class_id], subject: sMap[e.subject_id], size: d.students.filter((x) => x.class_id === e.class_id && x.status === 'aktif').length }, st); });
    const graded = rows.filter((r) => r.n);
    return {
      exams, grades, rows, perExam, cMap, sMap, kktp: kktpDefault,
      summary: { avg: avg(allScores), max: allScores.length ? Math.max(...allScores) : null, min: allScores.length ? Math.min(...allScores) : null, count: allScores.length, passGrades: passN, failGrades: allScores.length - passN,
        studentsPass: graded.filter((r) => r.tuntas).length, studentsFail: graded.filter((r) => !r.tuntas).length, pctStudents: graded.length ? (graded.filter((r) => r.tuntas).length / graded.length) * 100 : null },
    };
  }

  /** Data grafik perkembangan individu (urut tanggal) */
  function studentTimeline(R, studentId) {
    const pts = R.exams.map((e) => { const g = R.grades.find((x) => x.exam_id === e.id && x.student_id === studentId); return g ? { e, score: Number(g.score) } : null; }).filter(Boolean)
      .sort((a, b) => (a.e.date || '').localeCompare(b.e.date || ''));
    return pts;
  }
  /** Data grafik kelas: rata-rata/max/min per penilaian */
  function classTimeline(R) {
    return R.perExam.filter((p) => p.count).sort((a, b) => (a.e.date || '').localeCompare(b.e.date || ''));
  }
  /** Rata-rata per semester */
  function perSemester(R) {
    const m = {}; R.grades.forEach((g) => { const e = R.exams.find((x) => x.id === g.exam_id); const k = e.academic_year + ' ' + e.semester; (m[k] = m[k] || []).push(Number(g.score)); });
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ label: k, value: avg(v) }));
  }
  function perKind(R) { return ['ujian', 'tugas', 'manual'].map((k) => { const v = R.grades.filter((g) => U.kindOf(R.exams.find((e) => e.id === g.exam_id)) === k).map((g) => Number(g.score)); return { kind: k, label: U.KINDS[k], value: avg(v), n: v.length }; }); }

  window.RecapData = { build, studentTimeline, classTimeline, perSemester, perKind };
})();
