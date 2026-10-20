/* 기간제교원 육아휴직 · 중도 계약 해지 판정
 * 근거: 2026 계약제교원 운영 지침 Ⅰ-3-자(p.6~7), Ⅲ-6(p.27~29), 참고자료 5(p.73), Q&A 18~22,
 *       남녀고용평등법 제19조, 같은 법 시행령 제11조, 근로기준법 제26조·제27조
 */
(function (root) {
  'use strict';
  const R = root.Rules || (typeof require !== 'undefined' ? require('./rules.js') : null);
  const { D, kdate, addDays, diffDays, periodEnd, ageAt } = R;

  /* ---------- 육아휴직 ---------- */
  function judgeLeave(inp) {
    const r = { msgs: [], ok: true };
    const say = (level, text, ref) => r.msgs.push({ level, text, ref });
    const cs = D(inp.cStart), ce = D(inp.cEnd), ls = D(inp.lStart), le = D(inp.lEnd), ap = D(inp.applyDate);
    if (!cs || !ce || !ls || !le || le < ls) { r.error = '계약 기간과 휴직 희망 기간을 입력하세요.'; r.ok = false; return r; }

    // 1. 대상 자녀
    if (inp.pregnant) {
      say('ok', '임신 중인 여성 기간제교원은 모성 보호를 위해 육아휴직을 신청할 수 있습니다. 이 기간은 분할 사용 횟수(3회)에 넣지 않습니다.', '지침 p.27~28');
    } else {
      const cb = D(inp.childBirth);
      if (!cb) { say('warn', '자녀 생년월일을 입력하면 대상 여부(만 8세 이하 또는 초등학교 2학년 이하)를 확인합니다.', '지침 p.27'); }
      else {
        const age = ageAt(cb, ls);
        r.childAge = age;
        if (age <= 8 || inp.grade2) say('ok', `휴직 시작일 기준 자녀 만 ${age}세${inp.grade2 ? '(초등 2학년 이하)' : ''}로 대상입니다. 만 8세인 초등 3학년, 만 9세인 초등 2학년도 모두 가능합니다.`, '지침 p.27');
        else { say('block', `휴직 시작일 기준 자녀가 만 ${age}세로 대상(만 8세 이하 또는 초등학교 2학년 이하)이 아닙니다. 초등 2학년 이하라면 '초등 2학년 이하'를 체크하세요.`, '지침 p.27'); r.ok = false; }
      }
    }
    if (inp.spouseSame) { say('block', '같은 영유아에 대해 배우자가 육아휴직 중이면 육아휴직을 할 수 없습니다.', '지침 p.28'); r.ok = false; }

    // 2. 동일 학교 6개월 근무
    r.sixMonth = addDays(periodEnd(cs, 6), 1);   // 6개월 근무를 채운 다음 날
    if (ls < r.sixMonth) {
      say('block', `같은 학교에서 6개월 이상 근무해야 남은 기간에 육아휴직을 신청할 수 있습니다. 이 계약 시작일(${kdate(cs)}) 기준 ${kdate(r.sixMonth, true)}부터 휴직 가능합니다. 다른 학교 근무 기간은 합산하지 않습니다.`, 'Q&A 19');
      r.ok = false;
    } else say('ok', `같은 학교 6개월 근무 요건 충족(${kdate(r.sixMonth)}부터 가능). 출산전후휴가 기간도 계속 근로에 포함됩니다.`, 'Q&A 19, Q&A 20');

    // 3. 신청 기한
    const lead = inp.urgent ? 7 : 30;
    r.applyBy = addDays(ls, -lead);
    if (ap) {
      if (ap <= r.applyBy) say('ok', `신청일(${kdate(ap)})이 휴직 개시 ${lead}일 전(${kdate(r.applyBy, true)}) 이전으로 기한을 지켰습니다.`, 'Q&A 21');
      else say('warn', `휴직 개시 예정일 ${lead}일 전(${kdate(r.applyBy, true)})까지 신청해야 합니다. 늦게 신청하면 학교는 신청일로부터 ${lead}일 이내 범위에서 개시일을 지정할 수 있습니다.`, 'Q&A 21');
    } else say('info', `신청 기한: 휴직 개시 예정일 ${lead}일 전인 ${kdate(r.applyBy, true)}까지` + (inp.urgent ? '(유산·사산 위험, 조기 출산, 배우자 사망·질병 등 예외 사유)' : ''), 'Q&A 21');

    // 4. 기간
    const maxMonths = 12 + (inp.extra ? 6 : 0);
    const used = Number(inp.usedMonths) || 0;
    const want = R.contractMonths(ls, le);
    r.want = want; r.remain = Math.max(0, maxMonths - used);
    if (used >= maxMonths) { say('block', `해당 자녀로 이미 ${used}개월을 사용해 남은 기간이 없습니다. 다른 학교에서 쓴 기간도 포함됩니다.`, 'Q&A 18'); r.ok = false; }
    else if (want > r.remain) say('warn', `신청 기간 약 ${want}개월이 남은 사용 가능 기간(${r.remain}개월)을 넘습니다.`, '지침 p.28');
    if (Number(inp.splits) >= 3 && !inp.pregnant) { say('block', '육아휴직은 3회까지만 나누어 쓸 수 있습니다.', '지침 p.28'); r.ok = false; }
    if (inp.extra) say('info', '부모 모두 같은 자녀로 각각 3개월 이상 사용, 한부모, 장애아동 부모는 6개월 이내 추가 사용이 가능합니다.', '지침 p.27');
    if (want % 6 !== 0) say('info', '학생의 학습권 보호를 위해 정규교원처럼 6개월(학기) 단위 사용을 권장합니다.', '지침 p.28');

    // 5. 계약 종료
    r.effEnd = le > ce ? ce : le;
    if (le > ce) say('warn', `육아휴직 기간이 남아 있어도 계약 종료일(${kdate(ce)})에 근로계약이 끝납니다. 계약 연장 의무는 없습니다.`, '지침 p.28');

    // 6. 행정 안내
    say('info', '육아휴직 급여는 고용보험에서 지급합니다(휴직 시작 전 피보험 단위기간 통산 180일 이상). 출산전후휴가급여를 받은 경우 최초 60일만 유급으로 인정되니 180일 산정에 유의하세요. 학교는 육아휴직 확인서(고용보험법 시행규칙 별지 제102호)를 발급합니다.', '지침 p.29, 서식 27');
    say('info', '휴직한 날이 속한 달의 봉급은 일할 계산해 지급하고, 휴직 기간 보수는 지급 의무가 없습니다. 휴직 기간은 경력과 퇴직금 근속기간에 포함합니다.', '지침 p.29, Q&A 34');
    say('info', '명백한 종료 사유가 없으면 조기 복직 신청을 거부할 수 있습니다.', '지침 p.28');
    say('info', `육아휴직 대체 기간제교원을 채용하려면 결원 기간 ${kdate(ls)} ~ ${kdate(r.effEnd)}으로 ① 상황 판별을 하세요.`, '지침 p.28');
    r.steps = [
      { t: '육아휴직원 접수(서식 25)', d: `휴직 개시 ${lead}일 전까지, 증빙서류(가족관계증명서 등) 첨부`, date: r.applyBy },
      { t: '허용 여부 결정(내부결재)', d: '자녀 요건, 6개월 근무, 사용 기간 확인' },
      { t: '육아휴직 확인서 발급(서식 27)', d: '본인이 지방고용관서에 육아휴직 급여 신청' },
      { t: '대체 기간제교원 채용', d: '공고 → 채용 → 나이스 등재 → 교육청 보고' },
      { t: '휴직 시작', d: '휴직 시작 달 봉급 일할 계산', date: ls },
      { t: '복직 또는 계약 종료', d: '복직 시 복직원(서식 26). 계약 종료일이 먼저 오면 그날 근로계약 종료', date: r.effEnd },
    ];
    return r;
  }

  /* ---------- 중도 계약 해지 ---------- */
  const TERM = {
    early: { label: '휴직 교사 조기 복직(별도 정원 교사 복직)', fault: false },
    lazy: { label: '업무 태만·업무 수행 능력 부족', fault: true },
    health: { label: '신체·정신상 이상으로 계약 내용 수행 곤란', fault: false },
    duty: { label: '복무상 의무 및 금지사항 위반', fault: true },
    sexual: { label: '성추행·성폭행 등 성비위', fault: true, sexual: true },
    disq: { label: '채용 자격 결격사유', fault: true, immediate: true },
    indict: { label: '형사 사건 기소(성폭력·아동학대·음주운전 0.03% 이상·측정 불응은 약식명령 청구 포함)', fault: true, immediate: true },
    absent: { label: '특별한 이유 없이 1주일 이상 연속 결근', fault: true },
    fraud: { label: '부당한 방법으로 채용', fault: true, immediate: true },
    etc: { label: '기타 사회통념상 계약을 계속하기 어려운 사유', fault: true },
  };

  function judgeTerminate(inp) {
    const r = { msgs: [], ok: true, steps: [] };
    const say = (level, text, ref) => r.msgs.push({ level, text, ref });
    const cs = D(inp.cStart), ce = D(inp.cEnd), tday = D(inp.endDay), today = D(inp.today);
    if (!cs || !ce || !tday) { r.error = '계약 기간과 해지일을 입력하세요.'; r.ok = false; return r; }
    const t = TERM[inp.reason] || TERM.etc;
    r.reason = t;
    r.lastWork = addDays(tday, -1);
    r.served = diffDays(cs, tday);                   // 계속근로 일수
    r.under3 = tday < addDays(periodEnd(cs, 3), 1);
    r.noticeBy = addDays(tday, -30);

    if (tday > ce) { say('block', '해지일이 계약 종료일보다 늦습니다. 계약 만료로 처리하세요.', '지침 p.33'); r.ok = false; return r; }
    if (r.under3) say('ok', '계속근로기간이 3개월 미만이므로 30일 전 예고는 생략할 수 있습니다. 단, 해지 사유와 시기는 반드시 서면으로 통지합니다.', '지침 p.6');
    else if (t.immediate) say('info', '즉시 계약 해지 사유입니다. 귀책에 따른 해고라도 사유와 시기는 서면으로 통지합니다. 30일 예고를 하지 않으면 근로기준법상 예고 예외(근로자의 고의 등)에 해당하는지 노무 검토가 필요합니다.', '지침 p.7')
    else {
      say(today && today > r.noticeBy ? 'warn' : 'ok', `해지일 30일 전인 ${kdate(r.noticeBy, true)}까지 해지 사유와 시기를 서면으로 통지해야 합니다.` + (today && today > r.noticeBy ? ` 오늘 기준 기한이 지났습니다. 예고하지 않으면 30일분 통상임금(해고예고수당)을 지급해야 하므로 해지일을 ${kdate(addDays(today, 30), true)} 이후로 조정하는 것을 검토하세요.` : ''), '지침 p.6');
    }
    if (inp.reason === 'early') {
      say('info', '휴직 교원이 조기 복직을 청원할 때는 계약 해지 예고 기간을 확보할 수 있도록 최소 30일 전에 복직 신청을 하게 합니다. 계약서에 조기 복직 시 해지 조건이 있어야 합니다.', '지침 p.6, Q&A 22');
      say('info', '관할 교육(지원)청과 협의해 다른 학교 계약제교원 임용 시 우선 추천하는 등 신분 보장 노력을 합니다.', '지침 p.6, p.14');
    }
    if (t.fault) {
      say('warn', '복무 불량·중대한 과오로 해지할 때는 교원인사자문위원회에서 당사자에게 충분한 소명 기회를 준 뒤 위원회 결정에 따라 서면으로 해고합니다. 회의 10일 전까지 참석과 소명 기회(서면 소명 가능)를 통지하고, 위원 제척·기피 신청을 안내합니다.', '지침 p.7, 참고자료 5');
      // 위원회 결정 → 서면 통지(30일 전) 순서이므로 위원회는 통지 기한 전날까지
      r.committeeBy = addDays(r.under3 || t.immediate ? tday : r.noticeBy, -1);
    }
    if (t.sexual) say('warn', '성비위는 성고충심의위원회 결정을 먼저 받은 뒤 인사자문위원회를 엽니다. 해지 후 교육(지원)청에 별도 보고하고, 근무실적평가서와 나이스 계약직 인사기록 「비고」에 사유를 기록합니다(예: 2026. 5. 11. 성추행으로 계약해지).', '지침 p.7, p.15');
    if (inp.reason === 'indict') say('info', '성폭력범죄, 아동학대범죄, 혈중알코올농도 0.03% 이상 음주운전(음주측정 불응 포함)은 약식명령이 청구된 경우에도 해지 사유입니다. 그 밖의 범죄는 약식명령 청구만으로는 해지 사유가 아닙니다.', '지침 p.7');
    if (inp.reason === 'fraud') say('warn', '부정한 방법으로 채용된 경우 즉시 관할 교육(지원)청에 보고합니다.', '지침 p.7');

    r.reportBy = addDays(tday, 5);
    say('info', `해지 후 5일 이내(${kdate(r.reportBy, true)}까지) 교육(지원)청에 중도 계약 해지를 보고합니다(서식 28 첨부).`, '지침 p.6, 서식 28');
    const yearUp = diffDays(cs, tday) >= 365;
    say('info', yearUp ? '계속근로 1년 이상이므로 퇴직금 지급 대상입니다(지급 사유 발생일로부터 14일 이내).' : '계속근로 1년 미만으로 퇴직금 지급 의무는 없습니다.', '지침 p.8~9');
    say('info', '연가를 계약 개월 비율보다 많이 썼다면 초과 일수는 결근 처리해 급여에서 환수합니다. 보수는 해지일까지 일할 계산합니다.', '지침 p.25, 서식 14 제12조');

    const st = r.steps;
    if (t.sexual) st.push({ t: '성고충심의위원회 결정', d: '인사자문위원회 개최 전 선행' });
    if (t.fault) {
      st.push({ t: '인사자문위원회 참석·소명 기회 통지', d: '회의 10일 전, 문자·서면. 서면 소명 가능, 구체적 사안 명시', date: addDays(r.committeeBy, -10) });
      st.push({ t: '인사자문위원회 개최·결과 내부결재', d: '의결 정족수 확인, 소명 청취, 제척·기피 안내', date: r.committeeBy });
    }
    st.push({ t: '계약 해지(예고) 서면 통지', d: '서식 28. 수령 거부 시 내용증명 우편', date: r.under3 || t.immediate ? null : r.noticeBy });
    st.push({ t: '최종 근로일', d: '', date: r.lastWork });
    st.push({ t: '해지일 · 나이스 퇴직 처리', d: '계약제교원-퇴직처리(퇴직사유: 계약해지)', date: tday });
    st.push({ t: '교육(지원)청 중도 계약 해지 보고', d: '5일 이내, 서식 28 첨부' + (t.sexual ? ' + 성비위 별도 공문 보고' : ''), date: r.reportBy });
    return r;
  }

  const api = { judgeLeave, judgeTerminate, TERM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Rules2 = api;
})(this);
