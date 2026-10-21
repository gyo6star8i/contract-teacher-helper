/* ④ 육아휴직 · 중도 계약 해지 화면 */
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const { schoolVars, toast, showTab, refBtns, h, todayIso, fJ } = window.App;
  const LV = { ok: '가능', info: '참고', warn: '주의', block: '불가' };

  $$('[data-sub2]').forEach(b => b.addEventListener('click', () => {
    $$('[data-sub2]').forEach(x => x.classList.toggle('on', x === b));
    $$('.sub2').forEach(p => p.classList.toggle('on', p.dataset.panel2 === b.dataset.sub2));
  }));

  function read(form) {
    const o = {};
    $$('input,select,textarea', form).forEach(el => o[el.name] = el.type === 'checkbox' ? el.checked : el.value);
    return o;
  }
  function render(out, r, title, extra) {
    out.classList.remove('empty');
    if (r.error) { out.innerHTML = `<div class="msg block">${h(r.error)}</div>`; return; }
    const blocked = r.msgs.some(m => m.level === 'block');
    out.innerHTML = `<div class="verdict ${blocked ? 'bad' : ''}"><div class="lbl">확인 결과</div><div class="big">${h(title(blocked))}</div>${extra || ''}</div>` +
      r.msgs.map(m => `<div class="msg ${m.level}"><span class="tag">${LV[m.level]}</span>${h(m.text)}${refBtns(m.ref)}</div>`).join('') +
      (r.steps && r.steps.length ? '<h3>처리 순서</h3><ol class="steps mini">' + r.steps.map(s =>
        `<li><div class="t">${h(s.t)}${s.date ? `<span class="when">${Rules.kdate(s.date, true)}</span>` : ''}</div>${s.d ? `<div class="d">${h(s.d)}</div>` : ''}</li>`).join('') + '</ol>' : '');
  }
  async function make(tpl, data, name) {
    data.vars = Object.assign({}, schoolVars(), data.vars || {});
    try {
      const blob = await Hwpx.build(`templates/${tpl}.hwpx`, data);
      Hwpx.download(blob, name + '.hwpx'); toast('한글 파일을 내려받았습니다.');
    } catch (e) { console.error(e); toast('파일을 만들지 못했습니다: ' + e.message); }
  }

  /* ---------- 육아휴직 ---------- */
  const fL = $('#fLeave');
  fL.applyDate.value = todayIso;
  let lastLeave = null;
  fL.addEventListener('submit', e => {
    e.preventDefault();
    const f = read(fL);
    const r = Rules2.judgeLeave(f);
    lastLeave = { f, r };
    render($('#leaveOut'), r, bad => bad ? '육아휴직 허용 요건 미충족' : '육아휴직 허용 가능',
      r.error ? '' : `<div class="facts">
        <div class="fact"><div class="k">휴직 가능 시작일(6개월 근무)</div><div class="v">${Rules.kdate(r.sixMonth)}</div></div>
        <div class="fact"><div class="k">신청 기한</div><div class="v">${Rules.kdate(r.applyBy, true)}</div></div>
        <div class="fact"><div class="k">신청 기간 / 남은 기간</div><div class="v">${r.want}개월 / ${r.remain}개월</div></div>
        <div class="fact"><div class="k">실제 종료(계약 종료 반영)</div><div class="v">${Rules.kdate(r.effEnd)}</div></div></div>`);
  });
  function leaveData() {
    const f = read(fL);
    if (!f.lStart || !f.lEnd) { toast('휴직 시작일·종료일을 입력하세요.'); return null; }
    const r = Rules2.judgeLeave(f);
    f.childAge = r.childAge;
    return { f, r };
  }
  $$('[data-ldoc]').forEach(b => b.addEventListener('click', () => {
    const x = leaveData(); if (!x) return;
    const { f, r } = x, stamp = f.lStart.replace(/-/g, '');
    if (b.dataset.ldoc === 'form25') make('form25', { vars: Docs3.leaveVars(f) }, `${stamp}_육아휴직원`);
    if (b.dataset.ldoc === 'form26') { if (!f.returnDate) toast('복직 예정일을 넣으면 복직원에 함께 들어갑니다.'); make('form26', { vars: Docs3.leaveVars(f) }, `${stamp}_육아휴직 복직원`); }
    if (b.dataset.ldoc === 'gian') { if (r.msgs.some(m => m.level === 'block')) toast('요건 미충족 항목이 있습니다. 확인 결과를 먼저 보세요.'); make('gian', Docs3.leaveGian(f, r), `${stamp}_기간제교원 육아휴직 허가`); }
  }));
  $('#btnLeaveReplace').addEventListener('click', () => {
    const x = leaveData(); if (!x) return;
    window.App.setLeaveTypes(['leave']);
    fJ.start.value = x.f.lStart; fJ.end.value = Rules.iso(x.r.effEnd);
    if (x.f.subject) fJ.target.value = x.f.subject;
    fJ.birth.value = ''; fJ.retire.value = ''; fJ.extend.checked = false;
    showTab('judge'); toast('결원 기간을 넣었습니다. 판별하기를 누르세요.');
  });

  /* ---------- 중도 계약 해지 ---------- */
  const fT = $('#fTerm');
  fT.reason.innerHTML = Object.entries(Rules2.TERM).map(([k, v]) => `<option value="${k}">${h(v.label)}</option>`).join('');
  fT.today.value = todayIso; fT.noticeDate.value = todayIso;
  fT.addEventListener('submit', e => {
    e.preventDefault();
    const f = read(fT);
    const r = Rules2.judgeTerminate(f);
    if (!r.error && r.committeeBy && !fT.committeeDate.value) fT.committeeDate.value = Rules.iso(r.committeeBy);
    // 귀책 해지는 위원회 결정 뒤에 서면 통지
    if (!r.error && r.reason.fault && fT.committeeDate.value && fT.noticeDate.value <= fT.committeeDate.value)
      fT.noticeDate.value = Rules.iso(Rules.addDays(Rules.D(fT.committeeDate.value), 1));
    render($('#termOut'), r, bad => bad ? '확인 필요' : (r.reason.fault ? '귀책 사유 해지(소명 절차 필요)' : '계약 해지 가능'),
      r.error ? '' : `<div class="facts">
        <div class="fact"><div class="k">계속근로</div><div class="v">${r.served}일 ${r.under3 ? '(3개월 미만)' : ''}</div></div>
        <div class="fact"><div class="k">30일 전 서면 예고 기한</div><div class="v">${r.under3 ? '생략 가능' : Rules.kdate(r.noticeBy, true)}</div></div>
        ${r.committeeBy ? `<div class="fact"><div class="k">인사자문위원회 개최 기한</div><div class="v">${Rules.kdate(r.committeeBy, true)}</div></div>` : ''}
        <div class="fact"><div class="k">교육청 보고 기한</div><div class="v">${Rules.kdate(r.reportBy, true)}</div></div></div>`);
  });
  $$('[data-tdoc]').forEach(b => b.addEventListener('click', () => {
    const f = read(fT);
    if (!f.cStart || !f.cEnd || !f.endDay) { toast('계약 기간과 해지일을 입력하세요.'); return; }
    const r = Rules2.judgeTerminate(f), stamp = f.endDay.replace(/-/g, '');
    if (b.dataset.tdoc === 'form28') make('form28', { vars: Docs3.form28Vars(f), lists: { reasonLines: Docs3.termReason(f) } }, `${stamp}_중도 계약 해지(예고) 확인서`);
    if (b.dataset.tdoc === 'report') make('gian', Docs3.termReport(f, r), `${stamp}_기간제교원 중도 계약 해지 보고`);
    if (b.dataset.tdoc === 'committee') {
      if (!r.reason || !r.reason.fault) toast('조기 복직 등 귀책이 없는 해지는 보통 인사자문위원회가 필요 없습니다.');
      make('gian', Docs3.termCommittee(f, r), `${stamp}_계약 해지 심의 인사자문위원회 개최`);
    }
  }));
})();
