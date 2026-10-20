/* 계약제교원 채용 판별 엔진
 * 기준: 2026 경상북도 계약제교원 운영 지침(2026. 2. 1. 시행), 계약제교원 운영 관련 Q&A(2026. 2.)
 * 지침이 개정되면 이 파일의 RULES 상수와 judge() 분기만 고치면 된다.
 */
(function (root) {
  'use strict';

  const RULES = {
    version: '2026. 2. 1. 시행 지침 기준',
    ageLimit: { gigan: 62, gangsa: 65, expanded: 70 },   // 지침 p.2 라.
    noticeMinDays: 3,          // 공고일 제외 3일 이상(공휴일 포함) p.12~13
    urgentDays: 4,             // 근무 예정일이 공고일로부터 4일 이내 p.19 바-4)
    poolSkipMonths: 6,         // 인력풀 등록자 6개월 미만 공고 생략 p.13
    honorRetireYears: 2,       // 명예퇴직 2년 미만 채용 제한 p.6
    hourlyMaxDays: 3,          // 3일 이내 시간강사 p.20
  };

  /* ---------- 날짜 유틸 ---------- */
  function D(s) { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
  function daysIn(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function diffDays(a, b) { return Math.round((b - a) / 86400000); }
  // 민법 제160조: 기산일에 해당한 날의 전일 만료, 해당일이 없으면 그 월의 말일 만료 (Q&A 6)
  function periodEnd(start, months) {
    const y = start.getFullYear(), m = start.getMonth() + months, day = start.getDate();
    const ty = y + Math.floor(m / 12), tm = ((m % 12) + 12) % 12;
    if (day <= daysIn(ty, tm)) return addDays(new Date(ty, tm, day, 12), -1);
    return new Date(ty, tm, daysIn(ty, tm), 12);
  }
  function addYears(d, n) { return new Date(d.getFullYear() + n, d.getMonth(), d.getDate(), 12); }
  function ageAt(birth, at) {
    let a = at.getFullYear() - birth.getFullYear();
    if (at.getMonth() < birth.getMonth() || (at.getMonth() === birth.getMonth() && at.getDate() < birth.getDate())) a--;
    return a;
  }
  // 학기 말: 3~8월 → 8. 31., 9~2월 → 2월 말일
  function semesterEnd(d) {
    const m = d.getMonth() + 1, y = d.getFullYear();
    if (m >= 3 && m <= 8) return new Date(y, 7, 31, 12);
    const fy = m >= 9 ? y + 1 : y;
    return new Date(fy, 1, daysIn(fy, 1), 12);
  }
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  function kdate(d, withDay) {
    if (!d) return '';
    return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.' + (withDay ? '(' + WEEK[d.getDay()] + ')' : '');
  }

  /* ---------- 상수 라벨 ---------- */
  const LEAVE = {
    sick: '병가', leave: '휴직', maternity: '출산휴가', longservice: '장기재직휴가',
    annual: '연가', dispatch: '파견·연수', etc: '기타 사유'
  };

  /* ---------- 판별 ---------- */
  function judge(inp) {
    const r = { msgs: [], expansions: [], route: null, type: null, steps: [], ok: true };
    const say = (level, text, ref) => r.msgs.push({ level, text, ref });

    const start = D(inp.start), end = D(inp.end);
    const workStart = D(inp.workStart) || start;
    const today = D(inp.today);
    if (!start || !end || end < start) { r.ok = false; r.error = '결원 시작일과 종료일을 확인해 주세요.'; return r; }

    r.start = start; r.end = end; r.workStart = workStart; r.today = today;
    r.days = diffDays(start, end) + 1;
    r.oneMonthEnd = periodEnd(start, 1);
    r.sixMonthEnd = periodEnd(start, 6);
    r.isOneMonth = end >= r.oneMonthEnd;
    r.isSixMonth = end >= r.sixMonthEnd;
    r.daysToStart = today ? diffDays(today, workStart) : null;
    r.urgent = r.daysToStart !== null && r.daysToStart <= RULES.urgentDays;

    /* 1. 신분 결정 */
    if (r.isOneMonth) r.type = '기간제교원';
    else if (r.days <= RULES.hourlyMaxDays) r.type = '시간강사';
    else r.type = '전일제강사';
    r.isGigan = r.type === '기간제교원';

    if (inp.leaveType === 'sick' && r.days >= 30)
      say('info', '병가가 30일 이상 계속되면 휴가 일수에 토요일·공휴일이 포함되므로, 종료일이 공휴일이어도 계약 기간에 포함합니다.', 'Q&A 9');
    if (inp.leaveType === 'longservice')
      say('info', '장기재직휴가는 평일 기준으로 결원 기간이 연속될 때만 하나의 채용 기간으로 묶을 수 있습니다. 연속 1개월 미만이면 강사, 1개월 이상이면 기간제교원입니다.', '지침 p.14');
    if (inp.leaveType === 'annual')
      say('info', '병가·연가 뒤에 휴직이 이어지고 합산 1개월 이상이면 병가·연가 기간부터 기간제교원 채용이 가능합니다.', 'Q&A 13');

    /* 2. 후보자 정보 → 자격 확대 필요 여부 */
    const birth = D(inp.birth);
    const base = r.isGigan ? RULES.ageLimit.gigan : RULES.ageLimit.gangsa;
    r.ageBase = base;
    if (birth) {
      r.age = ageAt(birth, workStart);
      r.birth = birth;
      r.base70Day = addYears(birth, RULES.ageLimit.expanded);
      if (r.age >= RULES.ageLimit.expanded) {
        r.route = 'impossible'; r.ok = false;
        say('block', `근무 시작일 기준 만 ${r.age}세로, 자격을 확대해도 임용 상한(만 70세)을 넘어 계약제교원으로 채용할 수 없습니다.`, '지침 p.2');
      } else if (r.age >= base) {
        r.expansions.push(`임용 상한 연령(만 ${base}세 초과, 만 ${r.age}세)`);
        // 계약 중 만 70세 도달 시 학기말까지
        const semEnd = semesterEnd(r.base70Day);
        if (r.base70Day <= end) say('warn', `계약 기간 중 만 70세(${kdate(r.base70Day)})가 됩니다. 만 70세 생일이 포함된 학기 말(${kdate(semEnd)})까지만 계약할 수 있습니다.`, '지침 p.2');
      } else {
        const baseDay = addYears(birth, base);
        if (baseDay <= end) {
          const semEnd = semesterEnd(baseDay);
          say('warn', `계약 기간 중 만 ${base}세(${kdate(baseDay)})가 됩니다. 생일 전에 임용했다면 학기 말(${kdate(semEnd)})까지 계약이 유효하고, 그 이후는 신규·재계약이 불가합니다.`, '지침 p.2');
        }
      }
    }
    if (inp.retire === 'honor' && inp.retireDate) {
      const rd = D(inp.retireDate);
      if (addYears(rd, RULES.honorRetireYears) > workStart) r.expansions.push('명예퇴직 후 2년 미경과');
    }
    if (inp.cert === 'level') r.expansions.push('학교급 불일치 자격');
    if (inp.cert === 'similar') r.expansions.push('유사 과목 자격');
    if (inp.cert === 'none') {
      if (r.type !== '시간강사' && !inp.specialSubject) {
        r.route = 'impossible'; r.ok = false;
        say('block', '결원 보충을 위한 기간제교원·강사는 교원자격증 소지자여야 합니다. (특수한 교과목 담당 강사만 자격증 소지 불문)', '지침 p.18');
      }
    }
    r.expanded = r.expansions.length > 0;
    if (inp.cert === 'level' && r.isGigan && inp.schoolLevel === 'elem')
      say('info', '초등에서 학교급이 다른 자격증 소지자는 교과전담·특수·사서에 한해 2차 공고 후 임용할 수 있고, 호봉 경력은 8할만 인정됩니다.', '지침 p.18');
    if (['honor', 'age', 'pension'].includes(inp.retire))
      say('info', '퇴직연금 수령자·명예퇴직자·정년퇴직자를 기간제교원으로 임용하면 호봉은 14호봉을 넘지 못합니다.', '지침 p.16');
    if (inp.retire === 'age')
      say('warn', '정년퇴직자는 공고 없이 채용할 수 없습니다(인력풀 공고 생략 대상 아님).', '지침 p.13');

    if (r.route === 'impossible') { buildSteps(r, inp); return r; }

    const stage = inp.noticeStage; // none | first_failed | second
    const afterFirst = stage === 'first_failed' || stage === 'second';

    /* 3. 경로 결정 */
    if (inp.extend && r.isGigan) {
      if (r.expanded || inp.hiredByExpansion) {
        say('block', '2차 공고에서 자격 확대(연령, 명예퇴직 2년 미만, 학교급 불일치, 유사 과목)로 채용된 경우 연장 계약이 불가합니다. 동일 과목 자격으로 공개 모집 절차를 다시 진행하세요.', '지침 p.14');
        r.route = afterFirst ? 'gigan_2nd_expand' : 'gigan_need_1st';
      } else {
        r.route = 'gigan_extend';
        say('ok', '동일 학교·동일 결원·기간 단절 없이 연장되고 본인이 희망하면, 인사자문위원회 자문을 받아 새 채용 절차 없이 연장 계약할 수 있습니다(회의록 구비).', '지침 p.14');
        say('info', '연장 계약 시에도 계약서를 새로 쓰고 호봉을 다시 획정합니다. 임용 기간은 최초 1년 이내, 연장 포함 동일교 총 4년까지입니다.', '지침 p.13~14');
      }
    } else if (r.type === '시간강사' || r.type === '전일제강사') {
      if (!r.expanded) {
        r.route = 'gangsa_skip';
        say('ok', '1개월 미만 결원 보충 강사는 공고 기간을 운영할 수 없는 부득이한 경우 공고를 생략하고, 인사자문위원회 등을 통해 면접 등 적부 심사 후 채용할 수 있습니다.', '지침 p.19');
      } else if (r.urgent) {
        r.route = 'gangsa_urgent_expand';
        say('ok', `근무 예정일이 공고일로부터 ${r.daysToStart}일 뒤로 4일 이내이므로, 인사자문위원회 자문을 받아 자격을 확대(${r.expansions.join(', ')})하여 공고 없이 강사로 채용할 수 있습니다(회의록 구비).`, '지침 p.19');
      } else if (afterFirst) {
        r.route = 'gangsa_2nd_expand';
        say('ok', '1차 공고에 적격자가 없었으므로 2차 공개채용 모집부터 자격 확대 채용이 가능합니다.', '지침 p.19');
      } else {
        r.route = 'gangsa_need_1st';
        say('warn', '자격 확대 채용은 2차 공고부터 가능합니다. 원래 자격 기준으로 1차 공고를 먼저 내세요. 단, 근무 예정일이 4일 이내로 임박하면 공고 없이 자격 확대 채용이 가능합니다.', '지침 p.19');
      }
    } else { // 기간제교원
      if (!r.expanded) {
        if (!r.isSixMonth && inp.pool) {
          r.route = 'gigan_pool';
          say('ok', '인력풀 등록자를 6개월 미만으로 채용하므로 공고를 생략할 수 있습니다. 채용 인원의 2배수 이상을 조회·선정해 면접 심사를 하세요.', '지침 p.13');
        } else {
          r.route = 'gigan_notice';
          say('ok', `경상북도교육청 홈페이지에 공고(공고일 제외 ${RULES.noticeMinDays}일 이상, 공휴일 포함) 후 서류·면접 심사로 채용합니다.` + (r.isSixMonth ? ' 6개월 이상 채용은 공고를 생략할 수 없습니다.' : ''), '지침 p.12~13');
        }
      } else {
        if (r.urgent) {
          r.route = 'two_step';
          say('block', '공고 없는 긴급 자격 확대 채용은 1개월 미만 강사에만 허용되며, 채용 기간이 1개월을 넘는 기간제교원은 불가합니다.', '지침 p.19');
          say('warn', '강사로 근무한 기간을 소급해 기간제교원으로 전환할 수 없습니다. 남은 기간은 별도 절차(2차 공고)로 채용해야 합니다.', 'Q&A 16');
          r.stepA = { from: workStart, to: addDays(periodEnd(workStart, 1), -1) };
          if (r.stepA.to > end) r.stepA.to = end;
          r.stepB = { from: addDays(r.stepA.to, 1), to: end };
          r.stepB.isGigan = r.stepB.from <= end && end >= periodEnd(r.stepB.from, 1);
          // 1단계는 강사이므로 연령 기준이 만 65세
          const otherExp = r.expansions.filter(e => !e.startsWith('임용 상한 연령'));
          r.stepAExpanded = otherExp.length > 0 || (r.age !== undefined && r.age >= RULES.ageLimit.gangsa);
          say('ok', `① ${kdate(r.stepA.from)} ~ ${kdate(r.stepA.to)}: 전일제강사로 공고 없이 긴급 채용(인사자문위원회 ${r.stepAExpanded ? '자문, 자격 확대' : '적부 심사'}) ② ${kdate(r.stepB.from)} ~ ${kdate(r.stepB.to)}: ` +
            (afterFirst ? '자격 확대 2차 공고로 ' : '1차 공고(원 자격) → 적격자 없으면 2차 공고(자격 확대)로 ') + (r.stepB.isGigan ? '기간제교원 채용' : '강사 채용(잔여 기간 1개월 미만)'), '지침 p.13, p.19');
        } else if (afterFirst) {
          r.route = 'gigan_2nd_expand';
          say('ok', `1차 공고에 적격자가 없었으므로 2차 공고부터 자격 확대(${r.expansions.join(', ')}) 채용이 가능합니다. 공고 기간(3일 이상)은 2차에도 동일하게 지켜야 하며 인사자문위원회 회의록을 반드시 갖춥니다.`, '지침 p.13');
        } else {
          r.route = 'gigan_need_1st';
          say('warn', '자격 확대는 1차 공고에 적격 지원자가 없을 때 2차 공고부터 가능합니다. 원래 자격 기준으로 1차 공고를 먼저 내세요.', '지침 p.2, p.13');
        }
      }
      if (r.expanded) say('info', '자격 확대로 채용된 사람은 연장 계약이 불가합니다. 결원이 연장되면 원래 자격 기준으로 다시 공개 모집합니다.', '지침 p.14, p.18');
    }

    /* 4. 공통 안내 */
    if (r.isGigan && inp.homeroom) say('info', '기간제교원에게 담임을 배정할 때는 계약 기간이 6개월 이상 남은 사람으로 하고, 3개월 미만 단기 계약자는 불가피한 경우에만 신중히 결정합니다.', '지침 p.18');
    if (!r.isGigan && inp.homeroom) say('info', '강사는 담임 발령이 불가하고 담임수당도 지급할 수 없습니다. 단, 초등학교 1개월 미만 결원 대체 강사는 예외입니다.', '지침 p.21');
    if (r.isGigan && start.getMonth() === 2 && start.getDate() === 2) say('warn', '1년 계약은 3월 1일을 포함해 계약하세요. 제외하면 퇴직금 미지급 사례가 생깁니다.', '지침 p.9, Q&A 7');
    if (r.isGigan && r.days >= 365) say('info', '계속근로 1년 이상이면 퇴직금 지급 대상입니다. 퇴직일이 속한 달 4일까지 예산을 요구하세요.', '지침 p.8~9');
    r.committee = ['gangsa_skip', 'gangsa_urgent_expand', 'gangsa_2nd_expand', 'gigan_2nd_expand', 'gigan_extend', 'two_step'].includes(r.route);

    buildSteps(r, inp);
    return r;
  }

  /* ---------- 경로 설명 ---------- */
  const ROUTE = {
    gigan_notice: { title: '기간제교원 공개채용', notice: '공고 필수', committee: '채용심사위원회(인사자문위원회 활용 가능)' },
    gigan_pool: { title: '기간제교원 인력풀 채용', notice: '공고 생략 가능', committee: '채용심사위원회 면접' },
    gigan_extend: { title: '기간제교원 연장 계약', notice: '공고 없음', committee: '인사자문위원회 자문(회의록)' },
    gigan_2nd_expand: { title: '기간제교원 2차 공고 자격 확대 채용', notice: '2차 공고 필수', committee: '인사자문위원회(회의록 필수)' },
    gigan_need_1st: { title: '1차 공고 먼저 진행', notice: '1차 공고 필요', committee: '채용심사위원회' },
    gangsa_skip: { title: '1개월 미만 강사 채용(공고 생략)', notice: '공고 생략 가능', committee: '인사자문위원회 적부 심사' },
    gangsa_urgent_expand: { title: '긴급 결원 강사 자격 확대 채용', notice: '공고 생략(4일 이내 특례)', committee: '인사자문위원회 자문(회의록 필수)' },
    gangsa_2nd_expand: { title: '강사 2차 공고 자격 확대 채용', notice: '2차 공고', committee: '인사자문위원회(회의록)' },
    gangsa_need_1st: { title: '1차 공고 먼저 진행', notice: '1차 공고 필요', committee: '인사자문위원회' },
    two_step: { title: '2단계 채용(긴급 강사 + 2차 공고)', notice: '1단계 공고 생략 / 2단계 공고', committee: '인사자문위원회(회의록 필수)' },
    impossible: { title: '채용 불가', notice: '-', committee: '-' },
  };

  /* ---------- 절차 단계 ---------- */
  function buildSteps(r, inp) {
    const s = [];
    const t = r.today || new Date();
    const add = (title, desc, date, doc, ref) => s.push({ title, desc, date, doc, ref });
    const noticeEnd = addDays(t, RULES.noticeMinDays);
    const route = r.route;
    if (route === 'impossible') { r.steps = s; return; }

    add('채용 계획 수립(내부결재)', '전형 내용·방법, 심사 계획, 채용심사위원회(3~5인) 구성. 공고를 생략해도 반드시 수립합니다.', t, null, '지침 p.13, 참고자료 2·3');
    if (r.committee) add('인사자문위원회 개최', '개최 기안 → 회의 → 결과 기안(회의록 첨부). 자격 확대·공고 생략·연장 계약은 회의록이 필수입니다.', t, 'committee', '지침 p.13~14, p.19');

    if (route === 'gigan_notice' || route === 'gigan_2nd_expand' || route === 'gigan_need_1st' || route === 'gangsa_2nd_expand' || route === 'gangsa_need_1st') {
      add(route.endsWith('need_1st') ? '1차 채용 공고(원 자격 기준)' : (route.includes('2nd') ? '2차 채용 공고(자격 확대 명시)' : '채용 공고'),
        '경상북도교육청 홈페이지(채용정보/기간제교사/구인)에만 게시. 계약조건·구비서류·일정·채용서류 반환 안내 포함.', t, null, '지침 p.12~13, 참고자료 4');
      add('원서 접수 마감(최소)', `공고일 제외 ${RULES.noticeMinDays}일 이상, 공휴일 포함 → 가장 빠른 마감일`, noticeEnd, null, '지침 p.13');
      add('서류심사 → 면접(수업실연 생략 가능)', '심사위원 서약서, 평가표·집계표 작성. 선발 전형 자료는 비전자문서 준영구 보관. 인권 침해 소지 질문 자제.', addDays(noticeEnd, 1), null, '지침 p.13, 서식 3~8');
    }
    if (route === 'gigan_pool') add('인력풀 조회·면접', '나이스 계약제교원-인력풀검색조회. 채용 인원의 2배수 이상 조회·선정 후 면접(서류심사 생략 가능).', t, null, '지침 p.13, p.85');
    if (route === 'two_step') {
      add('[1단계] 전일제강사 긴급 채용', `${kdate(r.stepA.from)} ~ ${kdate(r.stepA.to)} (1개월 미만). 인사자문위원회 자문 후 공고 없이 채용.`, r.stepA.from, null, '지침 p.19');
      add('[2단계] 잔여 기간 공고', `${kdate(r.stepB.from)} ~ ${kdate(r.stepB.to)}. ` + ((inp.noticeStage === 'none') ? '1차 공고(원 자격) 후 적격자 없으면 2차 공고(자격 확대).' : '2차 공고(자격 확대).') + ' 1단계 강사도 지원 가능.', t, null, '지침 p.13');
      add('[2단계] 원서 접수 마감(최소)', '공고일 제외 3일 이상', noticeEnd, null, '지침 p.13');
    }
    add('결격사유·범죄경력 통합조회', r.type === '시간강사' || r.type === '전일제강사'
      ? '1개월 미만 강사: 서약서(서식 23)로 결격사유 본인 확인 + 성범죄·아동학대 범죄경력 조회(행정정보공동이용 e-하나로). 경찰서 공문 조회 금지.'
      : '행정정보 공동이용시스템(e-하나로)으로 결격사유·성범죄·아동학대 통합조회. 특수교사는 장애인학대 범죄 경력 추가.', null, null, '지침 p.5');
    add('최종합격자 서류 구비·계약 체결', '계약서 2부 작성·교환(서식 14·15), 호봉 획정(유사경력은 전력조회), 발령대장 정리.', r.workStart, null, '지침 p.3~4, p.16');
    add('나이스 등록', '계약제교원 신규등록(최초임용일=계약시작일) + 퇴직예정자등록(계약만료일). 연장 시 퇴직예정일 수정·승급기록 추가.', r.workStart, null, '지침 p.85~87');
    add('교육(지원)청 임용 결과 보고', '임용사항 보고(서식 21): 호봉획정표 첨부, 공고 횟수·퇴직교원 여부 기재.', r.workStart, null, '지침 p.12, 서식 21');
    if (r.isGigan && r.days >= 90) add('근무 중 관리', '법정의무교육(원격) 이수 확인, 계약종료일까지 근무실적 평가(서식 18), 인력풀 등재.', null, null, '지침 p.14~16');
    add('계약 종료', '나이스 퇴직 처리(퇴직일: 계약 만료 다음날). 중도 해지 시 30일 전 서면 예고, 5일 이내 보고(서식 28).', r.end, null, '지침 p.6, p.33');
    r.steps = s;
  }

  /* ---------- 구비 서류 ---------- */
  function checklist(type) {
    const common = ['지원서(서식 1)', '자기소개서(서식 2)', '개인정보 수집·이용 동의서 - 지원자용(서식 9)'];
    const paper = ['교원자격증 사본 또는 자격인정조서', '최종학력증명서', '경력증명서'];
    if (type === '기간제교원') return {
      '지원자 공통': common, '서류전형 합격자': paper,
      '최종합격자(본인)': ['범죄경력 조회 동의서(서식 19)', '행정정보 공동이용 사전동의서(서식 20)', '마약류 중독 여부 검사결과통보서 또는 진단서(유효 1년)',
        '결핵검진·잠복결핵감염 검진확인서(채용 후 1개월 이내)', '공무원채용 신체검사서(일반건강검진 결과통보서·채용건강검진 대체통보서로 대체 가능)',
        '호봉 획정을 위한 경력 합산신청서(서식 11)', '서약서(서식 22)', '근무실적 평가 동의서(3개월 이상, 서식 17)', '개인정보 수집·이용 동의서 - 최종합격자용(서식 10)', '(해당자) 병적 사항 포함 주민등록초본 또는 병적증명서'],
      '학교(임용기관)': ['호봉획정표(증빙서류)', '범죄경력조회 회보서', '결격사유조회 회보서', '발령대장 정리', '상피제 확인', '나이스 퇴직예정일자 입력'],
    };
    return {
      '지원자 공통': common, '서류전형 합격자': paper,
      '최종합격자(본인)': ['범죄경력 조회 동의서(서식 19)', '행정정보 공동이용 사전동의서(서식 20)', '마약류 중독 여부 검사결과통보서 또는 진단서', '결핵검진·잠복결핵감염 검진확인서',
        '서약서(강사용, 서식 23)', '일반건강검진 결과통보서 또는 채용 건강검진 대체통보서(1개월 미만 신체검사서 요구 시 비용은 학교 부담)'],
      '학교(임용기관)': ['범죄경력조회 회보서', '결격사유조회 회보서(1개월 이상 임용 강사)', '발령대장 정리'],
      '생략 가능': ['동일 학교에서 기간 단절 없이 재계약: 결격·범죄경력 조회, 검사서, 경력 증빙 생략 가능(하루라도 단절 시 조회 필수)'],
    };
  }

  /* ---------- 계산기 ---------- */
  function annualLeave(months, priorMonths) {
    const total = months + (priorMonths || 0);
    const tbl = total >= 48 ? 17 : total >= 36 ? 16 : total >= 12 ? 15 : 11;
    return { base: tbl, days: Math.round(months / 12 * tbl) };
  }
  function sickLeave(months) { return Math.floor(months / 12 * 60); }
  function hourlyPay(hours) { return hours <= 4 ? hours * 25000 : 100000 + (hours - 4) * 10000; }
  // 계약 개월 수: 15일 이상 1개월, 미만 미산입
  function contractMonths(start, end) {
    let m = 0, cur = start;
    while (true) { const e = periodEnd(cur, 1); if (e <= end) { m++; cur = addDays(e, 1); } else break; }
    const rest = diffDays(cur, end) + 1;
    if (rest >= 15) m++;
    return m;
  }

  const api = { RULES, ROUTE, LEAVE, judge, checklist, annualLeave, sickLeave, hourlyPay, contractMonths, periodEnd, ageAt, semesterEnd, D, iso, kdate, addDays, diffDays };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Rules = api;
})(this);
