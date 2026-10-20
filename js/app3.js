/* ④ 심사·평가 화면: 채용 심사 점수 집계 */
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const { schoolVars, toast, h, todayIso } = window.App;
  const kd = (s, w) => (s ? Rules.kdate(Rules.D(s), w) : '');
  const fmt = x => (x === null || x === undefined ? '' : (Math.round(x * 100) / 100).toString());

  $$('[data-sub3]').forEach(b => b.addEventListener('click', () => {
    $$('[data-sub3]').forEach(x => x.classList.toggle('on', x === b));
    $$('.sub3').forEach(p => p.classList.toggle('on', p.dataset.panel3 === b.dataset.sub3));
  }));

  const f = $('#fScore');
  for (let i = 1; i <= 10; i++) f.n.insertAdjacentHTML('beforeend', `<option ${i === 3 ? 'selected' : ''}>${i}</option>`);
  f.docDate.value = todayIso; f.intDate.value = todayIso;
  // 채용 서류 탭의 배점과 동기화
  function syncFromHire() {
    const H = $('#fHire'); if (!H) return;
    const d = ['dp1', 'dp2', 'dp3', 'dp4'].reduce((s, k) => s + (Number(H[k].value) || 0), 0);
    const i = ['ip1', 'ip2', 'ip3', 'ip4'].reduce((s, k) => s + (Number(H[k].value) || 0), 0);
    if (d) f.dMax.value = d; if (i) f.iMax.value = i;
    f.demo.checked = H.demo.checked; f.typeLabel.value = H.typeLabel.value;
    if (H.judges) f.j.value = H.judges.value;
    if (H.multiple.value) f.multiple.value = H.multiple.value;
    if (H.count.value) f.count.value = H.count.value;
  }
  document.querySelector('[data-tab=review]').addEventListener('click', syncFromHire);

  /* 입력 표 */
  let keep = {};
  function snapshot() { $$('#scoreGrids input').forEach(i => keep[i.name] = i.value); }
  function grid(phase, label, n, j, extra) {
    let t = `<h3>${label}</h3><div class="grid-wrap"><table class="sg"><tr><th>연번</th><th>지원자(관리번호)</th>`;
    for (let k = 1; k <= j; k++) t += `<th>위원${k}</th>`;
    if (extra) t += `<th>${extra}</th>`;
    t += '<th>평균</th></tr>';
    for (let r = 1; r <= n; r++) {
      t += `<tr><td>${r}</td><td class="nm">${phase === 'doc' ? `<input name="name${r}" placeholder="${r}번">` : `<span data-nm="${r}"></span>`}</td>`;
      for (let k = 1; k <= j; k++) t += `<td><input type="number" step="0.5" min="0" name="${phase}${r}_${k}"></td>`;
      if (extra) t += `<td><input type="number" step="0.5" min="0" name="${phase}${r}_x" title="동점자 처리용"></td>`;
      t += `<td class="av" data-av="${phase}${r}"></td></tr>`;
    }
    return t + '</table></div>';
  }
  function buildGrids() {
    snapshot();
    const n = Number(f.n.value), j = Number(f.j.value);
    $('#scoreGrids').innerHTML = grid('doc', `서류심사 (만점 ${f.dMax.value}점)`, n, j) +
      grid('int', `면접심사 (만점 ${f.iMax.value}점)`, n, j, '교과 전문성<br><small>평균, 동점 시</small>') +
      (f.demo.checked ? grid('demo', '수업실연 (만점 40점)', n, j) : '');
    $$('#scoreGrids input').forEach(i => { if (keep[i.name] !== undefined) i.value = keep[i.name]; });
    liveAvg();
  }
  function liveAvg() {
    const n = Number(f.n.value), j = Number(f.j.value);
    for (let r = 1; r <= n; r++) {
      const nm = (f.querySelector(`[name=name${r}]`) || {}).value || `${r}번`;
      $$(`[data-nm="${r}"]`).forEach(s => s.textContent = nm);
      ['doc', 'int', 'demo'].forEach(p => {
        const cell = $(`[data-av="${p}${r}"]`); if (!cell) return;
        const vals = []; for (let k = 1; k <= j; k++) vals.push((f.querySelector(`[name=${p}${r}_${k}]`) || {}).value);
        cell.textContent = fmt(Score.avg(vals));
      });
    }
  }
  ['n', 'j', 'demo', 'dMax', 'iMax'].forEach(k => f[k].addEventListener('change', buildGrids));
  $('#scoreGrids').addEventListener('input', liveAvg);
  buildGrids();

  function read() {
    const n = Number(f.n.value), j = Number(f.j.value);
    const cfg = { n, j, count: Number(f.count.value) || 1, multiple: Number(f.multiple.value) || 3, dMax: Number(f.dMax.value) || 40, iMax: Number(f.iMax.value) || 60, demo: f.demo.checked };
    const g = name => (f.querySelector(`[name="${name}"]`) || {}).value;
    const apps = [];
    for (let r = 1; r <= n; r++) {
      const col = p => { const a = []; for (let k = 1; k <= j; k++) a.push(g(`${p}${r}_${k}`)); return a; };
      apps.push({ name: (g(`name${r}`) || '').trim() || `${r}번`, doc: col('doc'), int: col('int'), demo: col('demo'), subj: g(`int${r}_x`) });
    }
    return { cfg, apps };
  }
  let last = null;
  f.addEventListener('submit', e => {
    e.preventDefault();
    const { cfg, apps } = read();
    const res = Score.compute(cfg, apps);
    last = { cfg, apps, res };
    const out = $('#scoreOut'); out.classList.remove('empty');
    const cls = s => /합격 예정/.test(s) ? 'badge-ok' : /불합격|과락/.test(s) ? 'badge-no' : 'badge-mid';
    out.innerHTML = `<h2>집계 결과</h2>
      <p class="muted small">서류 합격 기준: 과락 아닌 지원자 중 상위 ${res.cut}명(선발 ${cfg.count}명 × ${cfg.multiple}배수, 경계 동점자 포함) · 총점 만점 ${res.totalMax}점 · 과락: 단계별 40% 미만 또는 총점 60% 미만</p>
      <div class="grid-wrap"><table class="sg res"><tr><th>지원자</th><th>서류</th><th>서류 결과</th><th>면접</th>${cfg.demo ? '<th>수업실연</th>' : ''}<th>총점</th><th>순위·결과</th><th>비고</th></tr>` +
      res.rows.slice().sort((a, b) => (a.rank || 99) - (b.rank || 99) || (b.doc || 0) - (a.doc || 0)).map(o => `<tr>
        <td>${h(o.name)}</td><td>${fmt(o.doc)}</td><td>${o.doc === null ? '' : o.docPass ? '합격' : (o.fails.length && !o.docPass ? '과락' : '불합격')}</td>
        <td>${o.docPass ? fmt(o.int) : ''}</td>${cfg.demo ? `<td>${o.docPass ? fmt(o.demo) : ''}</td>` : ''}<td><b>${fmt(o.total)}</b></td>
        <td class="${cls(o.status)}">${h(o.status)}</td><td class="small">${h(o.fails.join(', '))}${o.tieNote ? h(o.tieNote) : ''}</td></tr>`).join('') + '</table></div>' +
      (res.tiesUnresolved ? '<div class="msg warn"><span class="tag">주의</span>동점자 처리 기준(면접 → 서류 → 교과 전문성)으로도 순위가 갈리지 않는 지원자가 있습니다. 교과 전문성 점수를 입력하거나 학교 채용 계획의 기준으로 정하세요.</div>' : '') +
      (res.ranked.length ? `<div class="msg ok"><span class="tag">다음</span>1·2순위자를 학교장에게 추천하고, 최종 선정자의 결격사유·성범죄·아동학대 범죄경력을 통합조회한 뒤 채용을 확정하세요.<span class="ref" data-ref="p.12">지침 p.12</span></div>` :
        '<div class="msg block"><span class="tag">결과</span>최종 합격 가능한 지원자가 없습니다. 재공고(1차였다면 2차 공고, 자격 확대 검토)를 진행하세요.<span class="ref" data-ref="p.13">지침 p.13</span></div>');
  });

  /* 문서 */
  async function make(tpl, data, name) {
    data.vars = Object.assign({}, schoolVars(), data.vars || {});
    try { Hwpx.download(await Hwpx.build(`templates/${tpl}.hwpx`, data), name + '.hwpx'); toast('한글 파일을 내려받았습니다.'); }
    catch (e) { console.error(e); toast('파일을 만들지 못했습니다: ' + e.message); }
  }
  function tallyVars(phase) {
    const { cfg, apps } = read();
    const res = Score.compute(cfg, apps);
    const key = { doc: 'doc', int: 'int', demo: 'demo' }[phase];
    let rows = res.rows.map((o, i) => ({ o, scores: apps[i][key] }));
    if (phase !== 'doc') rows = rows.filter(x => x.o.docPass);
    const valOf = x => x.o[key];
    const sorted = rows.filter(x => valOf(x) !== null).sort((a, b) => valOf(b) - valOf(a));
    const v = { phase: { doc: '서류심사', int: '면접심사', demo: '수업실연' }[phase], typeLabel: f.typeLabel.value, dateText: kd(phase === 'doc' ? f.docDate.value : f.intDate.value) };
    for (let r = 1; r <= 10; r++) {
      const x = rows[r - 1];
      v[`r${r}_no`] = x ? String(r) : ''; v[`r${r}_n`] = x ? x.o.name : '';
      for (let k = 1; k <= cfg.j; k++) v[`r${r}_${k}`] = x ? (x.scores[k - 1] || '') : '';
      v[`r${r}_s`] = x ? fmt(Score.sum(x.scores)) : ''; v[`r${r}_a`] = x ? fmt(valOf(x)) : '';
      v[`r${r}_k`] = x && valOf(x) !== null ? String(sorted.findIndex(y => valOf(y) === valOf(x)) + 1) : '';
    }
    v.note = `평균은 심사위원 점수의 평균입니다. ` + (phase === 'doc' ? `서류 합격: 과락(배점 40% 미만) 아닌 지원자 중 상위 ${res.cut}명(선발 인원의 ${cfg.multiple}배수).` : '서류심사 합격자만 기재합니다. 배점의 40% 미만은 불합격입니다.');
    return { vars: v, j: cfg.j };
  }
  function resultGian() {
    const { cfg, apps } = read();
    const res = Score.compute(cfg, apps);
    const type = f.typeLabel.value, L = (s, t) => ({ s, t });
    const b = [L('L0', '1. 관련'), L('L1', '가. 2026 계약제교원 운영 지침(경상북도교육청, 2026. 2.)')];
    if (f.related.value.trim()) b.push(L('L1', `나. ${f.related.value.trim()}`));
    b.push(L('L0', `2. ${type} 채용 심사 결과를 다음과 같이 보고합니다.`));
    b.push(L('L1', `가. 심사 일시: 서류심사 ${kd(f.docDate.value, true)}, 면접심사 ${kd(f.intDate.value, true)}`));
    b.push(L('L1', `나. 심사위원: 채용심사위원회 ${cfg.j}명`));
    b.push(L('L1', `다. 지원 현황: 지원자 ${cfg.n}명, 서류심사 합격 ${res.docPassCount}명(선발 인원의 ${cfg.multiple}배수)`));
    b.push(L('L1', `라. 심사 결과(총점 ${res.totalMax}점: 서류 ${cfg.dMax}점, 면접 ${cfg.iMax}점${cfg.demo ? ', 수업실연 40점' : ''})`));
    let k = 1;
    res.ranked.forEach(o => b.push(L('L2', `${k++}) ${o.status}: ${o.name} - 서류 ${fmt(o.doc)}점, 면접 ${fmt(o.int)}점${cfg.demo ? `, 수업실연 ${fmt(o.demo)}점` : ''}, 총점 ${fmt(o.total)}점${o.tieNote ? '(동점자 처리 기준 적용)' : ''}`)));
    res.rows.filter(o => o.fails.length).forEach(o => b.push(L('L2', `${k++}) 불합격: ${o.name} - ${o.fails.join(', ')}`)));
    if (!res.ranked.length) b.push(L('L2', '1) 최종 합격 가능 지원자 없음 → 재공고 추진'));
    b.push(L('L1', '마. 향후 일정'));
    ['합격 예정자 결격사유·성범죄·아동학대 관련 범죄경력 통합조회(e-하나로)', '최종 합격자 통지 및 서류 제출', '채용 계약 체결, 나이스 등록 및 교육(지원)청 임용 결과 보고']
      .forEach((t, i) => b.push(L('L2', `${i + 1}) ${t}`)));
    b.push(L('L0', ''));
    b.push(L('ATT', '붙임  1. 서류심사 점수 집계표 1부.'));
    b.push(L('ATT2', `2. 면접심사 점수 집계표 1부.${cfg.demo ? '' : '  끝.'}`));
    if (cfg.demo) b.push(L('ATT2', '3. 수업실연 점수 집계표 1부.  끝.'));
    return { body: b, vars: { title: `${type} 채용 심사 결과`, receiver: '내부결재' } };
  }
  function hireScale() {
    const H = $('#fHire'), g = k => Number(H && H[k] && H[k].value) || 0;
    const dp = [g('dp1') || 10, g('dp2') || 10, g('dp3') || 10, g('dp4') || 10], ip = [g('ip1') || 20, g('ip2') || 20, g('ip3') || 10, g('ip4') || 10];
    const sc = (base, x, of) => String(Math.round(x * base / of));
    const v = { typeLabel: f.typeLabel.value, subject: H ? H.subject.value : '', dateText: kd(f.docDate.value) || '20  .   .   .', year: (f.docDate.value || todayIso).slice(0, 4) };
    dp.forEach((d, i) => v['dp' + (i + 1)] = String(d)); v.dpSum = String(dp.reduce((a, b) => a + b, 0));
    ip.forEach((d, i) => { v['ip' + (i + 1)] = String(d); v['h' + (i + 1)] = String(d); v['m' + (i + 1)] = sc(d, 8, 10); v['l' + (i + 1)] = sc(d, 6, 10); });
    v.ipSum = String(ip.reduce((a, b) => a + b, 0));
    [[7, 1, 2], [10, 8, 1], [10, 8, 5], [10, 8, 5]].forEach((arr, i) => ['a', 'b', 'c'].forEach((c, j) => v[`c${i + 1}${c}`] = sc(dp[i], arr[j], 10)));
    const { apps } = read(); for (let i = 1; i <= 8; i++) v['n' + i] = apps[i - 1] ? apps[i - 1].name : '';
    return v;
  }
  $$('[data-sdoc]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.sdoc, stamp = (f.intDate.value || todayIso).replace(/-/g, ''), type = f.typeLabel.value;
    if (k === 'tallyDoc' || k === 'tallyInt' || k === 'tallyDemo') {
      if (k === 'tallyDemo' && !f.demo.checked) { toast('수업실연을 실시하지 않는 설정입니다.'); return; }
      const t = tallyVars({ tallyDoc: 'doc', tallyInt: 'int', tallyDemo: 'demo' }[k]);
      make(`tally_${t.j}`, { vars: t.vars }, `${stamp}_${type}_${t.vars.phase} 점수 집계표`);
    }
    if (k === 'result') { if (!last) toast('먼저 집계하기를 눌러 결과를 확인하세요.'); make('gian', resultGian(), `${stamp}_${type} 채용 심사 결과`); }
    if (['form3', 'form4', 'form6', 'form8'].includes(k)) {
      const nm = { form3: '심사위원 서약서', form4: '서류심사 평가표', form6: '면접심사 평가표', form8: '수업실연 평가표' }[k];
      make(k, { vars: hireScale() }, `${type}_${nm}`);
    }
  }));
})();
