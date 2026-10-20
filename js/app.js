(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const h = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const todayIso = Rules.iso(new Date());
  let lastInput = null, lastResult = null;

  $('#ver').textContent = Rules.RULES.version;

  /* ---------- 탭 ---------- */
  function showTab(name) {
    $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    $$('.tab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + name));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $$('.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); }

  /* ---------- 학교 정보 (localStorage, 인명 없음) ---------- */
  const SCHOOL_KEY = 'cth.school.v1';
  function loadSchool() { try { return JSON.parse(localStorage.getItem(SCHOOL_KEY)) || {}; } catch (e) { return {}; } }
  function saveSchool(o) { try { localStorage.setItem(SCHOOL_KEY, JSON.stringify(o)); } catch (e) { /* 저장 불가 환경 */ } }
  const fSchool = $('#fSchool');
  $('#btnSchool').addEventListener('click', () => {
    const s = loadSchool();
    $$('input', fSchool).forEach(i => { if (s[i.name] !== undefined) i.value = s[i.name]; });
    $('#dlgSchool').showModal();
  });
  fSchool.addEventListener('submit', e => {
    if (e.submitter && e.submitter.value === 'save') {
      const o = {}; $$('input', fSchool).forEach(i => o[i.name] = i.value.trim());
      saveSchool(o); toast('학교 정보를 저장했습니다.');
    }
  });
  function schoolVars() {
    const s = loadSchool();
    return {
      schoolName: s.schoolName || '○○초등학교', slogan: s.slogan || '', zip: s.zip || '', address: s.address || '',
      homepage: s.homepage || '', tel: s.tel || '', fax: s.fax || '', email: s.email || '', openness: s.openness || '비공개(6)',
      receiver: '내부결재', drafterTitle: s.drafterTitle || '교감', approverTitle: s.approverTitle || '교장',
      addrLine: [s.zip ? '우 ' + s.zip + '  ' + (s.address || '') : (s.address || ''), s.homepage].filter(Boolean).join('  /  '),
      contactLine: [s.tel && '전화 ' + s.tel, s.fax && '전송 ' + s.fax, s.email, s.openness || '비공개(6)'].filter(Boolean).join('  /  '),
    };
  }

  /* ---------- ① 판별 ---------- */
  const fJ = $('#fJudge');
  fJ.today.value = todayIso;
  function readJudge() {
    const o = {};
    $$('input,select', fJ).forEach(el => { o[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
    return o;
  }
  fJ.addEventListener('submit', e => {
    e.preventDefault();
    const inp = readJudge();
    const r = Rules.judge(inp);
    lastInput = inp; lastResult = r;
    renderJudge(r);
    renderSteps(r, inp);
    if (r.ok !== false || r.route) { fillDocForm(r, inp); fillHire(r, inp); }
  });
  fJ.addEventListener('reset', () => setTimeout(() => { fJ.today.value = todayIso; }, 0));

  const LV = { ok: '가능', info: '참고', warn: '주의', block: '불가' };
  function refBtns(ref) {
    if (!ref) return '';
    return ref.split(/,\s*/).map(x => `<span class="ref" data-ref="${h(x)}">${h(x)}</span>`).join('');
  }
  function renderJudge(r) {
    const out = $('#judgeOut');
    out.classList.remove('empty');
    if (r.error) { out.innerHTML = `<div class="msg block">${h(r.error)}</div>`; return; }
    const R = Rules.ROUTE[r.route] || {};
    const bad = r.route === 'impossible';
    out.innerHTML = `
      <div class="verdict ${bad ? 'bad' : ''}">
        <div class="lbl">판정</div>
        <div class="big">${h(R.title || '')}</div>
        <div class="facts">
          <div class="fact"><div class="k">채용 신분</div><div class="v">${bad ? '-' : h(r.route === 'two_step' ? '전일제강사 → ' + (r.stepB.isGigan ? '기간제교원' : '강사') : r.type)}</div></div>
          <div class="fact"><div class="k">결원 기간</div><div class="v">${r.days}일 ${r.isOneMonth ? '(1개월 이상)' : '(1개월 미만)'}</div></div>
          <div class="fact"><div class="k">공고</div><div class="v">${h(R.notice || '')}</div></div>
          <div class="fact"><div class="k">심의</div><div class="v">${h(R.committee || '')}</div></div>
          ${r.age !== undefined ? `<div class="fact"><div class="k">근무 시작일 기준 나이</div><div class="v">만 ${r.age}세 <span class="muted">(상한 ${r.ageBase}세)</span></div></div>` : ''}
          ${r.expanded ? `<div class="fact"><div class="k">자격 확대 사유</div><div class="v">${h(r.expansions.join(', '))}</div></div>` : ''}
        </div>
      </div>
      ${r.msgs.map(m => `<div class="msg ${m.level}"><span class="tag">${LV[m.level]}</span>${h(m.text)}${refBtns(m.ref)}</div>`).join('')}
      ${bad ? '' : `<div class="actions"><button class="btn primary" data-go="steps">절차 보기</button><button class="btn" data-go="docs" data-sub-go="hire">채용 서류 만들기</button>${r.committee ? '<button class="btn" data-go="docs" data-sub-go="committee">인사자문위원회 공문 만들기</button>' : ''}</div>`}`;
  }
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (g) { showTab(g.dataset.go); if (g.dataset.subGo) showSub(g.dataset.subGo); }
    const rf = e.target.closest('.ref'); if (rf) { $('#q').value = rf.dataset.ref; doSearch(); showTab('search'); }
  });

  /* ---------- ② 절차 ---------- */
  const DOCLBL = { committee: '인사자문위원회 공문', plan: '채용 계획·공고문 만들기', contract: '계약서 만들기', report: '임용사항 보고 만들기' };
  function renderSteps(r, inp) {
    const out = $('#stepsOut');
    if (!r.steps || !r.steps.length) { out.innerHTML = '<p class="hint">채용이 불가한 상황입니다. ① 판별 결과를 확인하세요.</p>'; $('#checkOut').innerHTML = ''; return; }
    out.innerHTML = `<h2>${h((Rules.ROUTE[r.route] || {}).title)} 절차</h2><ol class="steps">` + r.steps.map(s => `
      <li><div class="t">${h(s.title)}${s.date ? `<span class="when">${Rules.kdate(s.date, true)}</span>` : ''}</div>
      <div class="d">${h(s.desc)} ${refBtns(s.ref)}</div>
      ${s.doc ? `<div class="go"><button class="btn" data-go="docs" data-sub-go="${s.doc === 'committee' ? 'committee' : 'hire'}">${DOCLBL[s.doc] || '공문 만들기'} →</button></div>` : ''}</li>`).join('') + '</ol>';
    const types = r.route === 'two_step' ? ['전일제강사'] : [r.type];
    const cl = Rules.checklist(types[0] === '기간제교원' ? '기간제교원' : '강사');
    $('#checkOut').innerHTML = `<h2>구비 서류 체크리스트 <span class="muted small">(${h(types[0])} · 체크는 저장되지 않음)</span></h2><div class="cl">` +
      Object.entries(cl).map(([k, arr]) => `<h3>${h(k)}</h3>` + arr.map(x => `<label><input type="checkbox"> ${h(x)}</label>`).join('')).join('') +
      `</div><p class="muted small">근거: 지침 p.3~5 · 유효기간: 신체검사·마약류 1년, 잠복결핵 없음, 일반건강검진 결과는 최근 검진대상연도(2년 이내)</p>`;
  }

  /* ---------- ③ 공문 ---------- */
  const fD = $('#fDoc');
  for (let n = 3; n <= 9; n++) fD.members.insertAdjacentHTML('beforeend', `<option ${n === 8 ? 'selected' : ''}>${n}</option>`);
  fD.mDate.value = todayIso;
  fD.related.value = '2026 계약제교원 운영 지침(경상북도교육청, 2026. 2.)';

  function fillDocForm(r, inp) {
    if (!r.route || r.route === 'impossible') return;
    const d = Docs.defaults(r, inp);
    fD.title.value = d.title; fD.agenda.value = d.agenda;
    fD.reasons.value = d.reasons.join('\n'); fD.basis.value = d.basis.join('\n');
    fD.plan.value = d.plan.join('\n'); fD.notes.value = d.notes.join('\n');
    fD.minutes.value = d.minutes.join('\n');
    fD.type.value = d.type; fD.period.value = d.period;
    fD.verdict.value = r.route === 'gigan_extend' ? '연장 계약 적격' : '채용 적격';
  }
  $('#btnRefill').addEventListener('click', () => {
    if (!lastResult) { toast('먼저 ① 상황 판별을 해 주세요.'); return; }
    fillDocForm(lastResult, lastInput); toast('판별 결과로 다시 채웠습니다.');
  });

  function docFields() {
    const o = {}; $$('input,select,textarea', fD).forEach(el => o[el.name] = el.value);
    o.members = Number(o.members);
    const d = o.mDate ? Rules.D(o.mDate) : null;
    o.dateOnly = d ? Rules.kdate(d) : '';
    o.datetime = d ? `${Rules.kdate(d, true)} ${o.mTime || ''}~` : '';
    o.year = d ? String(d.getFullYear()) : '';
    return o;
  }

  async function makeDoc(kind) {
    const f = docFields();
    if (!f.title.trim()) { toast('제목을 입력하거나 먼저 판별을 해 주세요.'); return; }
    const sv = schoolVars();
    const stamp = f.mDate ? f.mDate.replace(/-/g, '') : '';
    let blob, name;
    if (kind === 'open') {
      blob = await Hwpx.build('templates/gian.hwpx', { body: Docs.openBody(f), vars: { ...sv, title: f.title } });
      name = `${stamp}_인사자문위원회 개최.hwpx`;
    } else if (kind === 'result') {
      blob = await Hwpx.build('templates/gian.hwpx', { body: Docs.resultBody(f), vars: { ...sv, title: f.title + ' 결과' } });
      name = `${stamp}_인사자문위원회 개최 결과.hwpx`;
    } else {
      const n = f.members;
      const names = f.names.split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean);
      const vars = { ...sv, year: f.year, datetime: f.datetime, place: f.place, agenda: f.agenda, dateOnly: f.dateOnly };
      for (let i = 1; i <= n; i++) { vars['p' + i] = i === 1 ? f.chairPos : f.memberPos; vars['m' + i] = names[i - 1] || ''; }
      blob = await Hwpx.build(`templates/minutes_${n}.hwpx`, { vars, lists: { result: Docs.minutesList(f) } });
      name = `${stamp}_인사자문위원회 회의록.hwpx`;
    }
    Hwpx.download(blob, name);
    toast('한글 파일을 내려받았습니다.');
  }
  $$('[data-doc]', fD).forEach(b => b.addEventListener('click', async () => {
    b.disabled = true;
    try { await makeDoc(b.dataset.doc); } catch (e) { console.error(e); toast('파일을 만들지 못했습니다: ' + e.message); }
    b.disabled = false;
  }));

  /* ---------- ③-2 채용 서류 ---------- */
  function showSub(name) {
    $$('[data-sub]').forEach(b => b.classList.toggle('on', b.dataset.sub === name));
    $$('.sub').forEach(p => p.classList.toggle('on', p.dataset.subpanel === name));
  }
  $$('[data-sub]').forEach(b => b.addEventListener('click', () => showSub(b.dataset.sub)));

  const fH = $('#fHire');
  fH.contractDate.value = todayIso;
  function setDates(base) {
    const d = Rules.D(base); if (!d) return;
    const o = Docs2.schedule(d);
    for (const k in o) fH[k].value = o[k];
  }
  function updMonths() {
    const s = Rules.D(fH.cStart.value), e = Rules.D(fH.cEnd.value);
    fH.months.value = s && e && e >= s ? Rules.contractMonths(s, e) : '';
  }
  fH.noticeDate.addEventListener('change', () => setDates(fH.noticeDate.value));
  fH.cStart.addEventListener('change', updMonths); fH.cEnd.addEventListener('change', updMonths);
  fH.typeLabel.addEventListener('change', () => { if (fH.typeLabel.value !== '기간제교원' && fH.method.value === 'pool') fH.method.value = 'skip'; });

  function fillHire(r, inp) {
    if (!r.route || r.route === 'impossible') return;
    const o = Docs2.hireDefaults(r, inp);
    ['typeLabel', 'cStart', 'cEnd', 'reasonText', 'round', 'expandText', 'method', 'certReq', 'noticeDate', 'recvEnd', 'docAnnounce', 'interviewDate', 'finalAnnounce', 'submitEnd', 'retiredYN', 'retireKind']
      .forEach(k => { if (fH[k] && o[k] !== undefined) fH[k].value = o[k]; });
    if (inp.retireDate) fH.retireDate.value = inp.retireDate;
    if (inp.target && !fH.subject.value) fH.subject.value = inp.target.replace(/교사$/, '');
    fH.noticeCount.value = o.method === 'notice' ? (o.round === '2차' ? '2' : '1') : '0';
    updMonths();
  }
  $('#btnHireRefill').addEventListener('click', () => {
    if (!lastResult) { toast('먼저 ① 상황 판별을 해 주세요.'); return; }
    fillHire(lastResult, lastInput); toast('판별 결과로 다시 채웠습니다.');
  });

  function hireFields() {
    const o = {};
    $$('input,select,textarea', fH).forEach(el => o[el.name] = el.type === 'checkbox' ? el.checked : el.value);
    o.schoolName = schoolVars().schoolName; o.tel = schoolVars().tel;
    o.mid = lastInput && lastInput.schoolLevel === 'mid';
    if (!o.recvPlace) o.recvPlace = o.schoolName + ' 행정실';
    return o;
  }
  const HDOC = {
    planGian: f => ({ tpl: 'gian', data: Docs2.planGian(f), name: '채용계획 기안' }),
    plan: f => { const d = Docs2.planDoc(f); return { tpl: d.template, data: d, name: '채용 계획' }; },
    notice: f => ({ tpl: 'notice', data: Docs2.noticeDoc(f), name: '채용 공고문' }),
    contract: f => { const d = Docs2.contractDoc(f); return { tpl: d.template, data: d, name: d.template === 'contract' ? '채용계약서' : '근로계약서' }; },
    report: f => ({ tpl: 'report', data: Docs2.reportDoc(f), name: '임용사항 보고' }),
  };
  $$('[data-hdoc]', fH).forEach(b => b.addEventListener('click', async () => {
    const f = hireFields();
    if (!f.cStart || !f.cEnd) { toast('계약 시작일·종료일을 입력하세요.'); return; }
    if (b.dataset.hdoc === 'notice' && f.method !== 'notice') { if (!confirm('채용 방식이 공고 생략입니다. 그래도 공고문을 만들까요?')) return; }
    if (b.dataset.hdoc === 'report' && f.typeLabel !== '기간제교원') toast('임용사항 보고(서식 21)는 기간제교원용입니다. 강사는 학교 지침에 따르세요.');
    b.disabled = true;
    try {
      const { tpl, data, name } = HDOC[b.dataset.hdoc](f);
      data.vars = Object.assign({}, schoolVars(), data.vars);
      const blob = await Hwpx.build(`templates/${tpl}.hwpx`, data);
      Hwpx.download(blob, `${(f.cStart || '').replace(/-/g, '')}_${f.typeLabel}_${name}.hwpx`);
      toast('한글 파일을 내려받았습니다.');
    } catch (e) { console.error(e); toast('파일을 만들지 못했습니다: ' + e.message); }
    b.disabled = false;
  }));

  /* ---------- ④ 계산기 ---------- */
  const won = n => n.toLocaleString('ko-KR') + '원';
  function calcAge() {
    const b = Rules.D($('#cBirth').value), at = Rules.D($('#cAt').value || todayIso), o = $('#cAgeOut');
    if (!b) { o.textContent = '생년월일을 입력하세요.'; return; }
    const a = Rules.ageAt(b, at);
    const lim = (n) => { const d = new Date(b.getFullYear() + n, b.getMonth(), b.getDate(), 12); return `만 ${n}세 도달 ${Rules.kdate(d)} → 학기 말 ${Rules.kdate(Rules.semesterEnd(d))}`; };
    const st = x => a < x ? '<b>가능</b>' : '불가';
    o.innerHTML = `임용일 기준 <b>만 ${a}세</b><br>기간제교원(62세): ${st(62)} · 1개월 미만 강사(65세): ${st(65)} · 자격 확대(70세): ${st(70)}<br><span class="small">${lim(62)}<br>${lim(65)}<br>${lim(70)}</span>`;
  }
  function calcPeriod() {
    const s = Rules.D($('#cPStart').value), o = $('#cPOut');
    if (!s) { o.textContent = '시작일을 입력하세요.'; return; }
    o.innerHTML = `1개월 만료일: <b>${Rules.kdate(Rules.periodEnd(s, 1), true)}</b><br>6개월 만료일: <b>${Rules.kdate(Rules.periodEnd(s, 6), true)}</b><br>1년 만료일: <b>${Rules.kdate(Rules.periodEnd(s, 12), true)}</b>`;
  }
  function calcLeave() {
    const s = Rules.D($('#cLStart').value), e = Rules.D($('#cLEnd').value), o = $('#cLOut');
    if (!s || !e || e < s) { o.textContent = '계약 기간을 입력하세요.'; return; }
    const m = Rules.contractMonths(s, e);
    const al = Rules.annualLeave(m, Number($('#cLPrior').value) || 0);
    o.innerHTML = `계약 개월 수 <b>${m}개월</b> (15일 이상 1개월)<br>연가 <b>${al.days}일</b> <span class="small">(${m}/12 × ${al.base}일, 반올림)</span><br>최대 병가 <b>${Rules.sickLeave(m)}일</b> <span class="small">(${m}/12 × 60일, 절사)</span>`;
  }
  function calcHourly() {
    const hrs = Number($('#cHours').value) || 0, d = Number($('#cHDays').value) || 1;
    const p = Rules.hourlyPay(hrs);
    $('#cHOut').innerHTML = `1일 <b>${won(p)}</b> × ${d}일 = <b>${won(p * d)}</b>`;
  }
  function calcNotice() {
    const s = Rules.D($('#cNDate').value), o = $('#cNOut');
    if (!s) { o.textContent = '공고일을 입력하세요.'; return; }
    o.innerHTML = `공고일 제외 3일 이상(공휴일 포함)<br>가장 빠른 접수 마감: <b>${Rules.kdate(Rules.addDays(s, 3), true)}</b><br>긴급 특례 기준(4일 이내 근무): <b>${Rules.kdate(Rules.addDays(s, 4), true)}</b>까지`;
  }
  [['#cBirth', calcAge], ['#cAt', calcAge], ['#cPStart', calcPeriod], ['#cLStart', calcLeave], ['#cLEnd', calcLeave], ['#cLPrior', calcLeave], ['#cHours', calcHourly], ['#cHDays', calcHourly], ['#cNDate', calcNotice]]
    .forEach(([s, fn]) => $(s).addEventListener('input', fn));
  $('#cAt').value = todayIso; $('#cNDate').value = todayIso; calcHourly(); calcNotice();

  /* ---------- ⑤ 검색 ---------- */
  let QA = [], GUIDE = [];
  Promise.all([fetch('data/qa.json').then(r => r.json()), fetch('data/guide.json').then(r => r.json())])
    .then(([q, g]) => { QA = q; GUIDE = g; if ($('#q').value) doSearch(); })
    .catch(() => { $('#searchOut').innerHTML = '<p class="hint">검색 자료를 불러오지 못했습니다. 웹 주소(https)로 접속했는지 확인하세요.</p>'; });

  const QUICK = ['명예퇴직', '임용 상한 연령', '공고 생략', '2차 공개채용', '연장 계약', '인사자문위원회', '담임', '육아휴직', '퇴직금', '계약해지', '14호봉', '마약류', '연가'];
  $('#quick').innerHTML = QUICK.map(q => `<button type="button">${h(q)}</button>`).join('');
  $('#quick').addEventListener('click', e => { if (e.target.tagName === 'BUTTON') { $('#q').value = e.target.textContent; doSearch(); } });
  let timer; $('#q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(doSearch, 200); });

  function mark(text, terms) {
    let s = h(text);
    terms.forEach(t => { if (t) s = s.split(h(t)).join(`<mark>${h(t)}</mark>`); });
    return s;
  }
  function doSearch() {
    const raw = $('#q').value.trim(), out = $('#searchOut');
    if (!raw) { out.innerHTML = ''; return; }
    let html = '';
    const qa = raw.match(/Q&A\s*(\d+)/i);
    const pg = [...raw.matchAll(/p\.(\d+)(?:~(\d+))?/g)];
    if (qa || pg.length) {
      if (qa) QA.filter(x => x.no === Number(qa[1])).forEach(x => html += qaHit(x, []));
      pg.forEach(m => {
        const a = Number(m[1]), b = Number(m[2] || m[1]);
        const items = GUIDE.filter(g => g.page >= a && g.page <= b);
        if (items.length) html += `<div class="hit"><div class="src">지침 p.${a}${b !== a ? '~' + b : ''}</div>` + items.map(i => `<p>${h(i.text)}</p>`).join('') + '</div>';
      });
      out.innerHTML = html || '<p class="hint">해당 쪽을 찾지 못했습니다.</p>'; return;
    }
    const terms = raw.split(/\s+/).filter(Boolean);
    const has = s => terms.every(t => s.replace(/\s/g, '').includes(t.replace(/\s/g, '')));
    const qh = QA.filter(x => has(x.q + ' ' + x.a.join(' ') + ' ' + x.section));
    const gh = GUIDE.filter(g => has(g.text));
    html += `<p class="muted small">Q&amp;A ${qh.length}건 · 지침 ${gh.length}건</p>`;
    html += qh.map(x => qaHit(x, terms)).join('');
    html += gh.slice(0, 60).map(g => `<div class="hit"><div class="src">지침 p.${g.page} <span class="ref" data-ref="p.${g.page}">쪽 전체 보기</span></div><p>${mark(g.text, terms)}</p></div>`).join('');
    out.innerHTML = html;
  }
  function qaHit(x, terms) {
    return `<div class="hit"><div class="src">Q&amp;A ${x.no} · ${h(x.section)}</div><div class="q">Q. ${mark(x.q, terms)}</div>${x.a.map(a => `<p>${mark(a, terms)}</p>`).join('')}</div>`;
  }
  window.App = { schoolVars, toast, showTab, showSub, refBtns, h, todayIso, fJ };
})();
