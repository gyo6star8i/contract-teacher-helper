/* 호봉 획정 · 근무실적 평가 · 최종합격자 서류 · 자체 점검표 · 연장 계약 · 급여 계산 */
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const { schoolVars, toast, showTab, showSub, refBtns, h, todayIso, fJ } = window.App;
  const LV = { ok: '가능', info: '참고', warn: '주의', block: '불가' };
  const kd = (s, w) => (s ? Rules.kdate(Rules.D(s), w) : '');
  const won = n => Math.round(n).toLocaleString('ko-KR') + '원';
  const msgHtml = msgs => msgs.map(m => `<div class="msg ${m.level}"><span class="tag">${LV[m.level]}</span>${h(m.text)}${refBtns(m.ref)}</div>`).join('');
  async function make(tpl, data, name) {
    data.vars = Object.assign({}, schoolVars(), data.vars || {});
    try { Hwpx.download(await Hwpx.build(`templates/${tpl}.hwpx`, data), name + '.hwpx'); toast('한글 파일을 내려받았습니다.'); }
    catch (e) { console.error(e); toast('파일을 만들지 못했습니다: ' + e.message); }
  }

  /* =================== 호봉 획정([별지 제16호 서식]) =================== */
  const fHob = $('#fHob'), hobBody = $('#hobRows tbody');
  fHob.date.value = todayIso;
  fHob.cert.innerHTML = Rules3.CERT.map(([n, b], i) => `<option value="${i}" ${n === '2급정교사' ? 'selected' : ''}>${n} (${b}호봉)</option>`).join('');
  fHob.edu.innerHTML = Rules3.EDU.map(([n, a], i) => `<option value="${i}" ${n === '교대졸(4년)' ? 'selected' : ''}>${n} (${a > 0 ? '+' : ''}${a})</option>`).join('');
  const syncCert = () => { fHob.base.value = Rules3.CERT[fHob.cert.value][1]; };
  const syncEdu = () => { fHob.eduAdj.value = Rules3.EDU[fHob.edu.value][1]; };
  fHob.cert.addEventListener('change', syncCert); fHob.edu.addEventListener('change', syncEdu);
  syncCert(); syncEdu();
  const kindOpts = Rules3.CAREER.map(c => `<option value="${c.k}">${h(c.label)}${c.rate != null ? ` (${c.rate}%)` : ''}</option>`).join('');
  function addRow(v = {}) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><select name="kind">${kindOpts}</select></td><td><input type="date" name="start"></td><td><input type="date" name="end"></td>
      <td><input name="content" style="min-width:120px" placeholder="예: ○○초(기간제)"></td>
      <td><input type="number" name="rate" min="0" max="100" style="width:70px"></td>
      <td><input type="number" name="hours" min="0" step="0.5" style="width:64px" disabled></td><td><input type="number" name="totalHours" min="0" style="width:72px" disabled></td>
      <td><input type="checkbox" name="mismatch" disabled></td><td><input name="note" style="min-width:90px"></td><td class="del"><button type="button" title="삭제">✕</button></td>`;
    hobBody.appendChild(tr);
    const sel = tr.querySelector('[name=kind]');
    const sync = () => {
      const c = Rules3.CAREER.find(x => x.k === sel.value), gangsa = sel.value === 'gangsa';
      ['hours', 'totalHours', 'mismatch'].forEach(n => tr.querySelector(`[name=${n}]`).disabled = !gangsa);
      tr.querySelector('[name=rate]').disabled = gangsa;
      tr.querySelector('[name=rate]').placeholder = c && c.rate != null ? c.rate : (sel.value === 'univLecturer' ? '50~100' : '');
    };
    sel.addEventListener('change', sync);
    Object.entries(v).forEach(([k, x]) => { const el = tr.querySelector(`[name=${k}]`); if (el) el.type === 'checkbox' ? (el.checked = !!x) : (el.value = x); });
    sync();
    tr.querySelector('.del button').addEventListener('click', () => tr.remove());
  }
  addRow({ kind: 'military', content: '군경력' }); addRow({ kind: 'teacher' });
  $('#hobAdd').addEventListener('click', () => addRow());
  function readHob() {
    const rows = $$('tr', hobBody).map(tr => { const o = {}; $$('input,select', tr).forEach(el => o[el.name] = el.type === 'checkbox' ? el.checked : el.value); return o; });
    const o = {}; $$('input,select', fHob).forEach(el => { if (!el.closest('#hobRows')) o[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
    o.rows = rows; o.certName = Rules3.CERT[fHob.cert.value][0]; o.eduName2 = Rules3.EDU[fHob.edu.value][0];
    return o;
  }
  let lastHob = null;
  function calcHob() { const inp = readHob(); lastHob = { inp, r: Rules3.hobong(inp) }; return lastHob; }
  fHob.addEventListener('submit', e => {
    e.preventDefault();
    const { inp, r } = calcHob();
    const out = $('#hobOut'); out.classList.remove('empty');
    out.innerHTML = `<div class="verdict"><div class="lbl">(17) 사정호봉</div><div class="big">${r.grade}호봉${r.capped ? ' <span class="small">(호봉상한제)</span>' : ''}</div>
      <div class="facts"><div class="fact"><div class="k">(14) 환산 총경력년수</div><div class="v">${Rules3.fmt(r.p14)}</div></div>
      <div class="fact"><div class="k">(15) 가감년수</div><div class="v">${r.add > 0 ? '+' : ''}${r.add}년</div></div>
      <div class="fact"><div class="k">(16) 호봉 획정 경력년수</div><div class="v">${Rules3.fmt(r.p16)}</div></div>
      <div class="fact"><div class="k">잔여 / 차기승급일(참고)</div><div class="v">${r.rest.m}월 ${r.rest.d}일 / ${r.next ? Rules.kdate(r.next) : '-'}</div></div></div></div>` +
      (r.rows.length ? `<div class="grid-wrap"><table class="sg"><tr><th>(8)경력내용</th><th>(9)경력년수</th><th>(10)환산율</th><th>(11)환산년수</th></tr>${r.rows.map(x =>
        `<tr><td>${h(x.label)}</td><td>${Rules3.fmt(x.period)}</td><td>${x.rate}%</td><td><b>${Rules3.fmt(x.usedP)}</b></td></tr>`).join('')}
        <tr><th>(13)계</th><th>${Rules3.fmt(r.rawP)}</th><th></th><th>${Rules3.fmt(r.p14)}</th></tr></table></div>` : '') +
      msgHtml(r.msgs);
  });
  $('#hobDoc').addEventListener('click', () => {
    const { inp, r } = calcHob();
    const sab = /교대|사범/.test(inp.eduName2);
    const eduText = `${inp.eduName ? inp.eduName + ' ' : ''}(${inp.eduName2})`;
    const rows = r.rows.map(x => [Rules.kdate(x.s), Rules.kdate(x.e), x.label, x.period.y, x.period.m, x.period.d, x.rate + '%', x.usedP.y, x.usedP.m, x.usedP.d,
      [x.note, x.kind === 'gangsa' ? `주당 ${x.weekly}h/${x.base}h` : ''].filter(Boolean).join(' ')].map(String));
    while (rows.length < 6) rows.push(Array(11).fill(''));
    const sv = schoolVars();
    make('hobong', {
      rows: { r: rows },
      vars: {
        reason: inp.reason, org: inp.org || sv.schoolName, cert: inp.proposed || inp.certName, position: inp.position, curGrade: inp.curGrade,
        edu1: sab ? eduText : '', edu2: sab ? '' : eduText,
        s9y: String(r.rawP.y), s9m: String(r.rawP.m), s9d: String(r.rawP.d), s11y: String(r.p14.y), s11m: String(r.p14.m), s11d: String(r.p14.d),
        p14: Rules3.fmt(r.p14), p15: `${r.add > 0 ? '+' : ''}${r.add}`, p16: Rules3.fmt(r.p16), grade: `${r.grade}호봉`, date: kd(inp.date),
        p18: `${r.capped ? 14 - (Number(inp.base) || 0) : r.p16.y}년`, rest: `${r.rest.m}월 ${r.rest.d}일`, next: r.next ? Rules.kdate(r.next) : '',
        writerPos: inp.writerPos, checkerPos: inp.checkerPos,
        limitText: inp.limit14 ? `※ 호봉상한제 적용 대상(연금수급자·명예퇴직·정년퇴직 교원): 14호봉 상한${r.capped ? ` → 산정 ${Number(inp.base) + r.p16.y}호봉을 14호봉으로 획정` : ''}` : '',
      },
    }, `${(inp.date || todayIso).replace(/-/g, '')}_호봉획정표`);
  });

  /* =================== 근무실적 평가(서식 18) =================== */
  const PERF = [['교육자로서의 품성', [10, 9, 8, 7]], ['학습지도(수업 실행, 평가)', [30, 28, 26, 24]], ['생활지도', [30, 28, 26, 24]],
    ['전문성 개발 및 연수 이수', [15, 13, 11, 9]], ['담당업무', [15, 13, 11, 9]]];
  const GRADES = ['매우우수', '우수', '보통', '미흡'];
  const fP = $('#fPerf');
  fP.date.value = todayIso;
  $('#perfTbl tbody').innerHTML = PERF.map(([n, pts], i) => `<tr><td style="text-align:left">${i + 1}. ${n}(${pts[0]}점)</td>
    <td><select name="g${i}">${GRADES.map((g, k) => `<option value="${k}" ${k === 1 ? 'selected' : ''}>${g} (${pts[k]})</option>`).join('')}</select></td><td class="av" data-ps="${i}"></td></tr>`).join('');
  function perfCalc() {
    const s = PERF.map(([, pts], i) => pts[Number(fP['g' + i].value)]);
    s.forEach((x, i) => $(`[data-ps="${i}"]`).textContent = x);
    const total = s.reduce((a, b) => a + b, 0);
    const g = total >= 95 ? 0 : total >= 90 ? 1 : total >= 80 ? 2 : 3;
    return { s, total, g };
  }
  fP.addEventListener('change', perfCalc); perfCalc();
  fP.addEventListener('submit', e => {
    e.preventDefault();
    const { total, g } = perfCalc(), msgs = [];
    const months = fP.from.value && fP.to.value ? Rules.contractMonths(Rules.D(fP.from.value), Rules.D(fP.to.value)) : null;
    if (months !== null && months < 3) msgs.push({ level: 'info', text: `근무 ${months}개월로 3개월 미만입니다. 학교 여건에 따른 자율평가 대상이며, 평가하려면 계약서에 평가 내용과 동의서가 있어야 합니다.`, ref: '지침 p.15' });
    if (!fP.consent.checked) msgs.push({ level: 'warn', text: '평가 동의서(서식 17)를 받지 않았습니다. 3개월 이상 임용자는 계약 시 동의서를 받습니다.', ref: '지침 p.14' });
    if (!fP.edu.checked) msgs.push({ level: 'warn', text: `법정의무교육(원격) 이수증이 없으면 '전문성 개발 및 연수 이수' 항목의 감점 요인입니다. 현재 이 항목은 '${GRADES[Number(fP.g3.value)]}'입니다.`, ref: '서식 18' });
    msgs.push({ level: 'info', text: '계약 종료일까지 평가를 마치고, 결과는 학교에 보관하며 인력풀 등록자는 나이스 기간제교원 인력풀에 등재합니다(교감). 성비위로 해지된 경우 평가서에 사유를 기록합니다.', ref: '지침 p.15' });
    const out = $('#perfOut'); out.classList.remove('empty');
    out.innerHTML = `<div class="verdict"><div class="lbl">종합평가</div><div class="big">${total}점 · ${GRADES[g]}</div></div>${msgHtml(msgs)}`;
  });
  $('#perfDoc').addEventListener('click', () => {
    const { s, total, g } = perfCalc();
    const v = { period: fP.from.value ? `${kd(fP.from.value)} ~ ${kd(fP.to.value)}` : '20  .   .   . ~ 20  .   .   .', subject: fP.subject.value, total: String(total),
      opinion: fP.opinion.value, date: kd(fP.date.value) };
    s.forEach((x, i) => v['s' + (i + 1)] = String(x));
    [0, 1, 2, 3].forEach(k => v['g' + (k + 1)] = k === g ? '■' : '□');
    make('form18', { vars: v }, `${(fP.date.value || todayIso).replace(/-/g, '')}_근무실적 평가서`);
  });

  /* =================== 최종합격자 서류 묶음 =================== */
  const fB = $('#fBundle');
  fB.date.value = todayIso;
  const FORMS = {
    f9: '개인정보 수집·이용 동의서 - 지원자용(서식 9)', f10: '개인정보 수집·이용 동의서 - 최종합격자용(서식 10)', f17: '근무실적 평가 결과 활용 동의서(서식 17)',
    f19: '성범죄·아동학대관련범죄 전력조회 동의서(서식 19)', f20: '행정정보 공동이용 사전동의서(서식 20)', f22: '서약서 - 기간제교원(서식 22)',
    f23: '서약서 - 강사용(서식 23)', f24: '채용서류 반환청구서(서식 24, 불합격자 안내용)',
  };
  function bundlePlan() {
    const type = fB.type.value, gigan = type === '기간제교원', cont = fB.cont.checked;
    const months = fB.from.value && fB.to.value ? Rules.contractMonths(Rules.D(fB.from.value), Rules.D(fB.to.value)) : null;
    const plan = {};
    const set = (k, on, why) => plan[k] = { on, why };
    set('f9', false, '지원 때 이미 받았으면 생략');
    set('f10', true, '계좌정보 수집(근로계약)');
    set('f17', gigan && (months === null || months >= 3), gigan ? (months !== null && months < 3 ? '3개월 미만: 자율평가 시에만' : '3개월 이상 기간제교원') : '기간제교원만');
    set('f19', !cont, cont ? '단절 없는 연장·재계약: 조회 생략 가능' : '성범죄·아동학대 조회');
    set('f20', !cont, cont ? '단절 없는 연장·재계약: 조회 생략 가능' : '결격사유·범죄경력 공동이용 조회');
    set('f22', gigan, gigan ? '결격사유 발생 시 계약 취소 조건' : '기간제교원용');
    set('f23', !gigan, !gigan ? '강사: 결격사유 없음 본인 확인' : '강사용');
    set('f24', false, '불합격자에게 반환 청구 안내 시');
    const other = gigan ? [
      ['마약류 중독 여부 검사결과통보서 또는 의사 진단서', '유효 1년, 국가건강검진 포함 결과 인정', cont],
      ['결핵검진·잠복결핵감염 검진확인서', '채용 후 1개월 이내, 잠복결핵은 최초 1회', cont],
      ['공무원채용 신체검사서', '일반건강검진 결과통보서·채용 건강검진 대체통보서로 대체 가능, 퇴직 후 6개월 이내 재채용 시 면제 가능', cont],
      ['호봉획정을 위한 경력합산 신청서(서식 11) + 경력증명서', '유사경력은 전력조회(서식 12·13)', cont],
      ['(해당자) 병적사항 포함 주민등록초본 또는 병적증명서', '', false],
      ['교원자격증 사본, 최종학력증명서', '서류전형 합격자 단계', false],
    ] : [
      ['마약류 중독 여부 검사결과통보서 또는 의사 진단서', '유효 1년', cont],
      ['결핵검진·잠복결핵감염 검진확인서', '', cont],
      ['일반건강검진 결과통보서 또는 채용 건강검진 대체통보서', '1개월 이상 임용 강사. 1개월 미만에게 신체검사서를 요구하면 비용은 학교 부담', cont],
    ];
    return { plan, other, cont };
  }
  function renderBundle() {
    const { plan, other, cont } = bundlePlan();
    $('#bundleList').innerHTML = Object.entries(FORMS).map(([k, label]) =>
      `<label class="bl ${plan[k].on ? '' : 'omit'}"><input type="checkbox" name="${k}" ${plan[k].on ? 'checked' : ''}><span>${h(label)}<span class="why">${h(plan[k].why)}</span></span></label>`).join('');
    $('#bundleOther').innerHTML = '<ul>' + other.map(([t, w, omit]) => `<li>${omit ? '<s>' : ''}${h(t)}${omit ? '</s> <b>생략 가능</b>' : ''}${w ? ` <span class="muted">— ${h(w)}</span>` : ''}</li>`).join('') + '</ul>' +
      (cont ? '<p class="muted">하루라도 단절이 있으면 결격사유·범죄경력 조회는 반드시 다시 하고, 마약류 서류도 유효기간 내 서류를 받아야 합니다(지침 p.4).</p>' :
        '<p class="muted">퇴직교원은 경력증명서를 인사기록카드로 대신할 수 있지만 결격사유·범죄경력 조회는 반드시 합니다. 직전 근무학교에 공문으로 서류를 요청해 활용할 수 있습니다(지침 p.4).</p>');
  }
  ['type', 'from', 'to', 'cont'].forEach(k => fB[k].addEventListener('change', renderBundle));
  renderBundle();
  $('#bundleDoc').addEventListener('click', () => {
    const blocks = {}; let any = false;
    Object.keys(FORMS).forEach(k => { blocks[k] = $(`#bundleList [name=${k}]`).checked; any = any || blocks[k]; });
    if (!any) { toast('서식을 하나 이상 고르세요.'); return; }
    make('bundle', { blocks, vars: { date: kd(fB.date.value), cFrom: fB.from.value ? kd(fB.from.value) : '20  .   .   .', cTo: fB.to.value ? kd(fB.to.value) : '20  .   .   .' } },
      `${(fB.date.value || todayIso).replace(/-/g, '')}_${fB.type.value}_최종합격자 제출 서식`);
  });

  /* =================== 자체 점검표(서식 29·30) =================== */
  const C29 = [['채용 계획', '채용계획 수립(전형내용·방법, 심사계획, 심사위원회 구성)'], ['채용 공고', '채용 공고는 경상북도교육청 홈페이지에만 게시'], ['', '공고 기간(공고일 제외 3일 이상, 공휴일 포함) 준수'],
    ['', '지원 자격, 채용 기간, 전형 방법, 전형 일정 명시'], ['', '우편·E-mail·직접 방문 등 다양한 방법으로 접수'], ['선발 전형', '선발 전형(서류심사, 면접 등)을 심사 기준에 맞게 실시'],
    ['', '서류심사평가표, 면접평가표 등 전형 자료 관리'], ['채용 확정', '최종선정자의 결격사유·범죄경력 조회'], ['', '채용계약서를 당사자가 직접 작성하고 상호 교환'],
    ['', '교육(지원)청으로 임용 결과 보고'], ['', '발령 대장 등 정리·활용'], ['관리', '3개월 이상 기간제교원 근무실적 평가 동의서 징구'], ['', '기간제교원 겸직을 정규교원과 동일하게 적용']];
  const C30 = ['투명성·공정성 확보를 위한 채용 자체 기준·계획 수립·운영', '6개월 이상 근무한 계약제 교사 근무성적평정 실시·관리', '결격사유조회, 범죄경력조회 실시',
    '발령 대장 등 비치·활용', '계약제 교사 명칭, 근무기간 등 명확히 규정', '복무기준을 계약 사항에 명시', '조기 복직 등 임용 사유 소멸 시 계약 해지 가능함을 계약서에 명시',
    '정당·정치단체 결성 관여·가입 여부', '학교장의 지도·감독 철저'];
  const fC = $('#fCheck');
  fC.date.value = todayIso;
  let chkMode = '29';
  function renderCheck() {
    $('#centerWrap').style.display = chkMode === '29' ? '' : 'none';
    const skipTo = chkMode === '29' && fC.center.value === 'Y' ? 7 : 0;
    $('#chkTbl').innerHTML = chkMode === '29'
      ? '<tr><th>항목</th><th>점검 내용</th><th>결과</th><th>비고</th></tr>' + C29.map(([c, t], i) => `<tr${i < skipTo ? ' class="omit" style="opacity:.45"' : ''}><td>${h(c)}</td><td>${h(t)}</td>
        <td><select name="c${i + 1}" ${i < skipTo ? 'disabled' : ''}><option></option><option selected>○</option><option>×</option><option>생략</option></select></td><td><input name="n${i + 1}" ${i < skipTo ? 'disabled' : ''}></td></tr>`).join('')
      : '<tr><th>연번</th><th>점검 사항</th><th>결과</th></tr>' + C30.map((t, i) => `<tr><td>${i + 1}</td><td>${h(t)}</td>
        <td><select name="r${i + 1}"><option value="">-</option><option value="a">미흡</option><option value="b">보통</option><option value="c" selected>우수</option></select></td></tr>`).join('');
  }
  $$('[data-chk]').forEach(b => b.addEventListener('click', () => { chkMode = b.dataset.chk; $$('[data-chk]').forEach(x => x.classList.toggle('on', x === b)); renderCheck(); }));
  fC.center.addEventListener('change', renderCheck);
  renderCheck();
  $('#chkDoc').addEventListener('click', () => {
    const v = { date: kd(fC.date.value), special: fC.special.value };
    if (chkMode === '29') {
      v.centerY = fC.center.value === 'Y' ? '■' : '□'; v.centerN = fC.center.value === 'Y' ? '□' : '■';
      C29.forEach((_, i) => { const s = fC['c' + (i + 1)]; v['c' + (i + 1)] = s.disabled ? '' : s.value; v['n' + (i + 1)] = fC['n' + (i + 1)].value; });
      make('form29', { vars: v }, `${(fC.date.value || todayIso).replace(/-/g, '')}_기간제교원 채용 점검표`);
    } else {
      C30.forEach((_, i) => { const x = fC['r' + (i + 1)].value; ['a', 'b', 'c'].forEach(k => v[k + (i + 1)] = x === k ? '○' : ''); });
      make('form30', { vars: v }, `${(fC.date.value || todayIso).replace(/-/g, '')}_계약제교원 운영 현황 자체 점검표`);
    }
  });

  /* =================== 연장 계약 =================== */
  const fE = $('#fExt');
  const readE = () => { const o = {}; $$('input,select', fE).forEach(el => o[el.name] = el.type === 'checkbox' ? el.checked : el.value); return o; };
  fE.curEnd.addEventListener('change', () => { if (fE.curEnd.value && !fE.newStart.value) fE.newStart.value = Rules.iso(Rules.addDays(Rules.D(fE.curEnd.value), 1)); });
  let lastExt = null;
  fE.addEventListener('submit', e => {
    e.preventDefault();
    const inp = readE(), r = Rules3.extend(inp);
    lastExt = { inp, r };
    const out = $('#extOut'); out.classList.remove('empty');
    if (r.error) { out.innerHTML = `<div class="msg block">${h(r.error)}</div>`; return; }
    out.innerHTML = `<div class="verdict ${r.ok ? '' : 'bad'}"><div class="lbl">판정</div><div class="big">${r.ok ? '연장 계약 가능' : '연장 계약 불가 또는 확인 필요'}</div>
      <div class="facts"><div class="fact"><div class="k">4년 상한일</div><div class="v">${Rules.kdate(r.limitEnd)}</div></div>
      <div class="fact"><div class="k">이번 연장 / 누적</div><div class="v">${r.newMonths}개월 / ${r.cumMonths}개월</div></div>
      <div class="fact"><div class="k">공백</div><div class="v">${r.gap > 0 ? r.gap + '일' : '없음'}</div></div></div></div>` +
      msgHtml(r.msgs) + '<h3>나이스 처리</h3><ul class="small">' + r.neis.map(t => `<li>${h(t)}</li>`).join('') + '</ul>';
  });
  function pushToJudge(sub) {
    const inp = readE();
    if (!inp.newStart || !inp.newEnd) { toast('연장 시작일·종료일을 입력하세요.'); return; }
    const r = Rules3.extend(inp);
    if (!r.error && !r.ok) toast('연장 계약 요건을 먼저 확인하세요. 불가 항목이 있습니다.');
    fJ.reset();
    fJ.target.value = inp.target || ''; fJ.start.value = inp.newStart; fJ.end.value = inp.newEnd; fJ.workStart.value = inp.newStart;
    fJ.today.value = todayIso; fJ.noticeStage.value = 'none'; fJ.leaveType.value = 'leave';
    fJ.extend.checked = true; fJ.hiredByExpansion.checked = inp.hiredBy === 'expand';
    fJ.requestSubmit();
    showTab('docs'); showSub(sub);
    toast(sub === 'committee' ? '연장 계약 인사자문위원회 공문 양식을 채웠습니다.' : '연장 계약 기간으로 계약서 양식을 채웠습니다.');
  }
  $('#extCommittee').addEventListener('click', () => pushToJudge('committee'));
  $('#extContract').addEventListener('click', () => pushToJudge('hire'));

  /* =================== 계산기: 정근수당 · 퇴직금 · 주휴수당 =================== */
  function calcJg() {
    const pay = Number($('#jgPay').value) || 0, y = Number($('#jgYears').value) || 0, m = Number($('#jgMonths').value) || 0, lim = $('#jgLimit').checked;
    const o = $('#jgOut');
    if (!pay) { o.textContent = '월 봉급액을 입력하세요.'; return; }
    const r = Rules3.jeonggeun(pay, y, m, lim);
    o.innerHTML = r.rate ? `근무연수 ${r.y}년${lim && y > 5 ? '(5년 인정)' : ''} → 월봉급액의 <b>${r.rate}%</b><br>정근수당액 ${won(pay * r.rate / 100)} × ${r.m}/6 = <b>${won(r.amount)}</b>` : '근무연수 1년 미만은 정근수당 가산금 없이 <b>지급 대상 아님</b>(근무연수 기준)';
  }
  ['#jgPay', '#jgYears', '#jgMonths', '#jgLimit'].forEach(s => $(s).addEventListener('input', calcJg));
  function autoDays() {
    const e = Rules.D($('#svEnd').value); if (!e) return;
    const retire = Rules.addDays(e, 1);
    const from = new Date(retire.getFullYear(), retire.getMonth() - 3, retire.getDate(), 12);
    $('#svDays').value = Rules.diffDays(from, retire);
  }
  function calcSv() {
    const o = $('#svOut');
    const r = Rules3.severance({ start: $('#svStart').value, end: $('#svEnd').value, wage3: $('#svWage').value, days3: $('#svDays').value, annualBonus: $('#svBonus').value, ordinaryDaily: $('#svOrd').value });
    if (r.error) { o.textContent = r.error; return; }
    if (!r.eligible) { o.innerHTML = `계속근로 ${r.days}일로 1년 미만 → <b>퇴직금 지급 의무 없음</b>(Q&amp;A 33)`; return; }
    o.innerHTML = `계속근로 <b>${r.days}일</b>(${(r.days / 365).toFixed(2)}년)<br>1일 평균임금 ${won(r.avg)}${r.ordinary ? ` / 통상임금 ${won(r.ordinary)}` : ''} → ${r.usedOrdinary ? '통상임금' : '평균임금'} 적용<br>
      퇴직금 ≈ <b>${won(r.amount)}</b><br><span class="small">지급 기한: ${Rules.kdate(r.payBy, true)}(퇴직일로부터 14일) · 예산 요구: 퇴직일이 속한 달 4일까지</span>`;
  }
  $('#svEnd').addEventListener('change', () => { autoDays(); calcSv(); });
  ['#svStart', '#svWage', '#svDays', '#svBonus', '#svOrd'].forEach(s => $(s).addEventListener('input', calcSv));
  function calcWh() {
    const hr = Number($('#whHours').value) || 0, rate = Number($('#whRate').value) || 0;
    const r = Rules3.weeklyHoliday(hr, rate);
    $('#whOut').innerHTML = r.eligible ? `(${Math.min(40, hr)}/40) × 8 × ${won(rate)} = 주 <b>${won(r.amount)}</b>` : '1주 소정근로시간 15시간 미만 → <b>주휴수당 없음</b>';
  }
  ['#whHours', '#whRate'].forEach(s => $(s).addEventListener('input', calcWh));
  calcWh();
})();
