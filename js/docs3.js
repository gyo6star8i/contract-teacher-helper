/* 육아휴직 · 중도 계약 해지 문서 문구 */
(function (root) {
  'use strict';
  const R = root.Rules || (typeof require !== 'undefined' ? require('./rules.js') : null);
  const R2 = root.Rules2 || (typeof require !== 'undefined' ? require('./rules2.js') : null);
  const { kdate } = R;
  const D = s => (s ? R.D(s) : null);
  const kd = (s, w) => (s ? kdate(D(s), w) : '      .    .    .');
  const L = (s, t) => ({ s, t });
  const LET = '가나다라마바사아자차'.split('');
  const lines = t => String(t || '').split('\n').map(x => x.trim()).filter(Boolean);
  const who = f => `기간제교원(${(f.subject || '').trim() || '○○'}) ○○○`;

  /* ----- 육아휴직 ----- */
  function leaveVars(f) {
    const months = R.contractMonths(D(f.lStart), D(f.lEnd));
    const used = lines(f.usedList);
    const v = {
      childOrder: f.childOrder || '', childBirth: f.pregnant ? '(출산 예정일: ' + kd(f.dueDate) + ')' : kd(f.childBirth),
      eligible: f.pregnant ? '임신 중(모성 보호)' : `초등 2학년 이하(${f.grade2 ? '○' : '  '}), 만 8세 이하(${f.childAge !== undefined && f.childAge <= 8 ? '○' : '  '})`,
      leavePeriod: `${kd(f.lStart)}부터 ${kd(f.lEnd)}까지(${months}개월간)`, applyDate: kd(f.applyDate), subject: (f.subject || '').trim(),
      leaveFrom: kd(f.lStart), leaveTo: kd(f.returnDate ? R.iso(R.addDays(D(f.returnDate), -1)) : f.lEnd), leaveMonths: String(months), returnDate: kd(f.returnDate),
    };
    for (let i = 1; i <= 6; i++) v['u' + i] = used[i - 1] || `${i}. 20  .   .   .부터 20  .   .   .까지(   개월간)`;
    return v;
  }
  function leaveGian(f, r) {
    const months = R.contractMonths(D(f.lStart), D(f.lEnd));
    const b = [L('L0', '1. 관련'), L('L1', '가. 「남녀고용평등과 일·가정 양립 지원에 관한 법률」 제19조'), L('L1', '나. 2026 계약제교원 운영 지침 Ⅲ-6(육아휴직)'),
      L('L1', `다. ${who(f)} 육아휴직원(${kd(f.applyDate)} 접수)`),
      L('L0', `2. ${who(f)}의 육아휴직 신청에 대하여 다음과 같이 허가하고자 합니다.`)];
    const it = [
      `대상: ${who(f)}`,
      `계약 기간: ${kd(f.cStart)} ~ ${kd(f.cEnd)}`,
      `휴직 기간: ${kd(f.lStart)} ~ ${kd(r && r.effEnd ? R.iso(r.effEnd) : f.lEnd)}(${months}개월)`,
      `휴직 사유: ${f.pregnant ? '임신 중 모성 보호' : '자녀 양육(○○○, ' + kd(f.childBirth) + '생)'}`,
    ];
    it.forEach((t, i) => b.push(L('L1', `${LET[i]}. ${t}`)));
    b.push(L('L1', `${LET[it.length]}. 검토 결과`));
    [`같은 학교 6개월 이상 근무 요건 충족(${r && r.sixMonth ? kdate(r.sixMonth) : '    .   .   .'}부터 가능)`,
      `신청 기한(휴직 개시 ${f.urgent ? 7 : 30}일 전) 준수`, f.pregnant ? '임신 중 여성 기간제교원으로 대상에 해당' : '대상 자녀(만 8세 이하 또는 초등학교 2학년 이하) 해당',
      `해당 자녀 기 사용 기간 ${Number(f.usedMonths) || 0}개월, 사용 가능 기간 이내`].forEach((t, i) => b.push(L('L2', `${i + 1}) ${t}`)));
    b.push(L('L1', `${LET[it.length + 1]}. 행정 사항`));
    ['육아휴직 확인서(고용보험법 시행규칙 별지 제102호서식) 발급: 육아휴직 급여는 본인이 지방고용관서에 신청',
      '휴직일이 속하는 달의 봉급은 일할 계산하여 지급하며, 휴직 기간 중 보수는 지급하지 아니함',
      '육아휴직 기간은 경력 및 퇴직금 산정 근속기간에 포함',
      '계약 종료일이 도래하면 육아휴직 기간이 남아 있어도 근로계약은 종료됨(계약 연장 의무 없음)',
      '육아휴직 대체 기간제교원 채용 추진'].forEach((t, i) => b.push(L('L2', `${i + 1}) ${t}`)));
    b.push(L('L0', ''));
    b.push(L('ATT', '붙임  육아휴직원 및 증빙서류 1부.  끝.'));
    return { body: b, vars: { title: '기간제교원 육아휴직 허가', receiver: '내부결재' } };
  }

  /* ----- 중도 계약 해지 ----- */
  function termReason(f) {
    const t = R2.TERM[f.reason] || R2.TERM.etc;
    const base = f.reason === 'early' ? `위 교사는 ○○○ 교사(${(f.subject || '').trim() || '○○'})의 ${f.leaveKind || '휴직'} 대체 기간제교원으로 임용되었으나, 해당 교사의 조기 복직(${kd(f.endDay)})으로 임용 사유가 소멸되어 채용계약서 제12조제1항제8호에 따라 계약을 해지함.`
      : `위 교사는 ${t.label}에 해당하여 채용계약서 제12조제1항에 따라 계약을 해지함.`;
    return [base].concat(lines(f.detail));
  }
  function form28Vars(f) {
    return {
      position: `기간제교원 ${(f.subject || '').trim()}`.trim(), contractPeriod: `${kd(f.cStart)} ~ ${kd(f.cEnd)}`,
      endDay: kd(f.endDay), noticeDate: kd(f.noticeDate),
    };
  }
  function termReport(f, r) {
    const t = R2.TERM[f.reason] || R2.TERM.etc;
    const b = [L('L0', '1. 관련: 2026 계약제교원 운영 지침 Ⅰ-3-자(계약 기간 중 계약해지)'),
      L('L0', '2. 우리 학교 기간제교원의 중도 계약 해지 사항을 다음과 같이 보고합니다.')];
    const it = [
      `대상: ${who(f)}`,
      `계약 기간: ${kd(f.cStart)} ~ ${kd(f.cEnd)}`,
      `해지일: ${kd(f.endDay)}(최종 근로일 ${r && r.lastWork ? kdate(r.lastWork) : ''})`,
      `해지 사유: ${t.label}`,
      `해지 통지: ${kd(f.noticeDate)} 서면 통지` + (r && r.under3 ? '(계속근로 3개월 미만으로 30일 전 예고 생략)' : ''),
    ];
    if (t.fault) it.push(`인사자문위원회: ${kd(f.committeeDate)} 개최, 소명 기회 부여 후 계약 해지 결정` + (t.sexual ? '(성고충심의위원회 결정 선행)' : ''));
    it.push('조치: 나이스 계약제교원 퇴직 처리(퇴직사유: 계약해지)' + (t.sexual ? ', 계약직 인사기록 비고 및 근무실적평가서에 사유 기록' : ''));
    if (f.reason === 'early') it.push('요청: 해당 기간제교원이 다른 학교 계약제교원 채용 시 우선 추천될 수 있도록 협조 요청');
    it.forEach((x, i) => b.push(L('L1', `${LET[i]}. ${x}`)));
    b.push(L('L0', ''));
    b.push(L('ATT', '붙임  중도 계약 해지(예고) 확인서 1부.  끝.'));
    return { body: b, vars: { title: '기간제교원 중도 계약 해지 보고', receiver: f.receiver || '○○교육지원청교육장' } };
  }
  function termCommittee(f, r) {
    const t = R2.TERM[f.reason] || R2.TERM.etc;
    const b = [L('L0', '1. 관련: 2026 계약제교원 운영 지침 Ⅰ-3-자, 참고자료 5(기간제교원 중도 계약 해지 절차)'),
      L('L0', '2. 기간제교원 계약 해지 심의를 위한 인사자문위원회를 아래와 같이 개최하고자 합니다.')];
    [`일시: ${kd(f.committeeDate, true)} ${f.committeeTime || ''}`.trim(), `장소: ${f.place || '교무회의실'}`, '참석대상: 인사자문위원회 위원',
      `안건: ${who(f)} 계약 해지 심의(사유: ${t.label})`].forEach((x, i) => b.push(L('L1', `${LET[i]}. ${x}`)));
    b.push(L('L1', '마. 진행 절차'));
    [(t.sexual ? '성고충심의위원회 결정 확인 후 개최' : null),
      `해당 교원에게 회의 10일 전(${f.committeeDate ? kdate(R.addDays(D(f.committeeDate), -10), true) : '    .   .   .'})까지 참석 및 소명 기회 통지(문자·서면, 서면 소명 가능, 심의 사안 구체적 명시)`,
      '위원 제척 및 기피 신청 안내, 의결 정족수 확인', '해당 교원 소명 청취 후 협의사항 결정, 결과 내부결재',
      '계약 해지 결정 시 해지 사유와 시기를 서면 통지(계속근로 3개월 이상은 30일 전 예고)']
      .filter(Boolean).forEach((x, i) => b.push(L('L2', `${i + 1}) ${x}`)));
    b[b.length - 1].t += '  끝.';
    return { body: b, vars: { title: '기간제교원 계약 해지 심의를 위한 인사자문위원회 개최', receiver: '내부결재' } };
  }

  const api = { leaveVars, leaveGian, termReason, form28Vars, termReport, termCommittee };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Docs3 = api;
})(this);
