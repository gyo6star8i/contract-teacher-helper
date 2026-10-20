/* 채용 심사 점수 집계 (참고자료 3 Ⅳ-2, 서식 4~8)
 * - 단계별 점수 = 심사위원 점수의 평균
 * - 과락: 서류·면접·수업실연 중 하나라도 배점의 40% 미만, 또는 총점 60% 미만
 * - 서류 합격: 과락이 아닌 지원자 중 선발 인원의 n배수(경계 동점자 포함)
 * - 동점자: 면접 → 서류 → 교과 전문성 고득점자 순
 */
(function (root) {
  'use strict';
  const num = v => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
  const avg = arr => { const a = arr.map(num).filter(x => x !== null); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
  const sum = arr => { const a = arr.map(num).filter(x => x !== null); return a.length ? a.reduce((s, x) => s + x, 0) : null; };
  const r1 = x => (x === null ? null : Math.round(x * 100) / 100);

  function compute(cfg, apps) {
    const demoMax = cfg.demo ? 40 : 0;
    const totalMax = cfg.dMax + cfg.iMax + demoMax;
    const out = apps.map((a, i) => ({
      i, name: a.name || `지원자 ${i + 1}`,
      docSum: sum(a.doc), doc: r1(avg(a.doc)), intSum: sum(a.int), int: r1(avg(a.int)),
      demoSum: cfg.demo ? sum(a.demo) : null, demo: cfg.demo ? r1(avg(a.demo)) : null,
      subj: num(a.subj), fails: [], docPass: false, total: null, rank: null, status: '',
    }));
    // 1. 서류 과락·서류 합격
    out.forEach(o => { if (o.doc !== null && o.doc < cfg.dMax * 0.4) o.fails.push(`서류 ${o.doc}점(배점의 40% 미만)`); });
    const cand = out.filter(o => o.doc !== null && !o.fails.length).sort((a, b) => b.doc - a.doc);
    const cut = Math.max(1, (cfg.multiple || 3) * (cfg.count || 1));
    const cutScore = cand.length >= cut ? cand[cut - 1].doc : -Infinity;
    cand.forEach(o => { if (o.doc >= cutScore) o.docPass = true; });
    // 2. 면접·실연·총점
    out.forEach(o => {
      if (!o.docPass) { if (o.doc !== null && !o.fails.length) o.status = '서류 불합격'; return; }
      if (o.int === null) { o.status = '면접 점수 미입력'; return; }
      if (o.int < cfg.iMax * 0.4) o.fails.push(`면접 ${o.int}점(배점의 40% 미만)`);
      if (cfg.demo) {
        if (o.demo === null) { o.status = '수업실연 점수 미입력'; return; }
        if (o.demo < demoMax * 0.4) o.fails.push(`수업실연 ${o.demo}점(배점의 40% 미만)`);
      }
      o.total = r1(o.doc + o.int + (cfg.demo ? o.demo : 0));
      if (o.total < totalMax * 0.6) o.fails.push(`총점 ${o.total}점(${totalMax}점의 60% 미만)`);
    });
    // 3. 순위
    const ranked = out.filter(o => o.total !== null && !o.fails.length);
    const cmp = (a, b) => (b.total - a.total) || (b.int - a.int) || (b.doc - a.doc) || ((b.subj || 0) - (a.subj || 0));
    ranked.sort(cmp);
    ranked.forEach((o, k) => {
      const prev = ranked[k - 1];
      o.rank = prev && cmp(prev, o) === 0 ? prev.rank : k + 1;
      if (prev && prev.total === o.total && cmp(prev, o) !== 0) o.tieNote = '동점자 처리 기준 적용';
    });
    ranked.forEach(o => {
      o.status = o.rank <= cfg.count ? `${o.rank}순위(합격 예정)` : o.rank <= cfg.count + 1 ? `${o.rank}순위(예비)` : `${o.rank}순위`;
    });
    out.forEach(o => { if (o.fails.length) o.status = '불합격(과락)'; });
    const tiesUnresolved = ranked.some((o, k) => ranked[k + 1] && cmp(o, ranked[k + 1]) === 0);
    return { rows: out, ranked, cut, totalMax, demoMax, docPassCount: out.filter(o => o.docPass).length, tiesUnresolved };
  }

  root.Score = { compute, avg, sum };
})(this);
