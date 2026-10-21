/* 호봉 획정 · 연장 계약 · 급여 계산
 * 근거: 2026 계약제교원 운영 지침 p.4, p.8~9, p.13~17, p.21, p.25, p.37(참고자료 3), p.82~84(경력환산율표),
 *       서식 4~8, Q&A 11·12·14·15·16·33·34
 */
(function (root) {
  'use strict';
  const R = root.Rules || (typeof require !== 'undefined' ? require('./rules.js') : null);
  const { D, iso, kdate, addDays, diffDays, periodEnd } = R;

  /* =====================================================================
   * 2. 호봉 획정 ([별지 제16호 서식] 호봉획정표 방식)
   *   - 경력기간은 년·월·일로 계산, 1년 = 12월, 1월 = 30일
   *   - 환산년수 = 경력기간(일 환산) × 환산율, 일 미만 버림
   *   - (14) 환산 총경력 + (15) 가감년수 = (16) 호봉 획정 경력
   *   - (17) 사정호봉 = 기산호봉 + (16)의 년수, 나머지는 잔여기간
   * ===================================================================== */
  // 자격별 기산호봉 (공무원보수규정 [별표 22] — 학교에서 쓰던 호봉획정표 코드표 기준)
  const CERT = [
    ['1급정교사', 9], ['2급정교사', 8], ['준교사', 5], ['실기교사', 5], ['특수1급정교사', 9], ['특수2급정교사', 8], ['특수준교사', 5],
    ['1급보건교사', 9], ['2급보건교사', 8], ['1급영양교사', 9], ['2급영양교사', 8], ['사서교사', 8], ['교도교사', 9],
    ['1급전문상담교사', 9], ['2급전문상담교사', 8],
  ];
  // 학력별 가감년수 (학령 기준 4년제 대학 졸업 = 0, 교대·사범대 4년 = +1)
  const EDU = [
    ['교대졸(4년)', 1], ['사범대졸(4년)', 1], ['대졸(4년)', 0], ['교대졸(2년)', -1], ['사범대졸(2년)', -1], ['전문대졸(3년)', -1], ['전문대졸(2년)', -2],
    ['사범학교졸', -3], ['고졸', -4], ['고2년수료', -5], ['고1년수료', -6], ['중졸', -7],
  ];
  const CAREER = [
    { k: 'teacher', label: '교원 경력(같은 학교급·자격)', rate: 100, ref: '환산율표 1' },
    { k: 'teacher80', label: '교원 경력(학교급·자격 불일치)', rate: 80, ref: '환산율표 1' },
    { k: 'privateNoReport', label: '사립학교 교원(임면 보고 안 됨)', rate: 50, ref: '환산율표 1' },
    { k: 'gangsa', label: '유·초·중등 강사(근무시간 비례)', rate: null, ref: '환산율표 4' },
    { k: 'military', label: '병역(현역·대체복무 등)', rate: 100, ref: '공무원보수규정 별표16' },
    { k: 'leaveCounted', label: '휴직 등 경력 인정 기간(육아휴직 등)', rate: 100, ref: '공무원보수 업무지침' },
    { k: 'publicServant', label: '국가·지방 공무원(기능직 포함)', rate: 100, ref: '환산율표 3' },
    { k: 'gradSchool', label: '대학원 학위취득(석사 2년·박사 3년 이내)', rate: 100, ref: '환산율표 7' },
    { k: 'univLecturer', label: '대학 시간강사(주당 수업시수 기준)', rate: null, ref: '환산율표 5' },
    { k: 'researcher', label: '연구원(정원 내 유급, 주 15시간 이상)', rate: 100, ref: '환산율표 6' },
    { k: 'eduStaff', label: '교육공무직원(정기 보수, 동일 분야 자격 후)', rate: 80, ref: '환산율표 8-1' },
    { k: 'govAgency', label: '국가·지자체 기관 근무(3개월 이상, 사실상 공무)', rate: 50, ref: '환산율표 8' },
    { k: 'publicInst', label: '공공기관(행정·경영·연구·기술 분야)', rate: 50, ref: '환산율표 9' },
    { k: 'academy', label: '학원 강사(교육감 신고)', rate: 50, ref: '환산율표 10' },
    { k: 'company', label: '회사(법인)', rate: 40, ref: '환산율표 11' },
    { k: 'companyPersonal', label: '개인회사(법인격 없음)', rate: 30, ref: '환산율표 11' },
    { k: 'custom', label: '직접 입력', rate: null, ref: '' },
  ];
  // 시작~종료(포함) 달력 기간 → {y, m, d}
  //   민법 제160조: k개월 기간은 기산일에 해당하는 날의 전날 끝나고, 해당하는 날이 없으면 그 달 말일에 끝남
  //   개월 = 그 끝나는 날이 종료일을 넘지 않는 최대 k, 일 = 종료일 − k개월 끝나는 날 (엑셀 저장본 수식과 같음)
  function edate(s, k) {
    const y = s.getFullYear(), m = s.getMonth() + k;
    const last = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(s.getDate(), last), 12);
  }
  const pend = (s, k) => { const x = edate(s, k); return x.getDate() === s.getDate() ? addDays(x, -1) : x; };
  function ymd(s, e) {
    const e1 = addDays(e, 1);
    let k = (e1.getFullYear() - s.getFullYear()) * 12 + e1.getMonth() - s.getMonth();
    if (pend(s, k) > e) k--;
    return { y: Math.floor(k / 12), m: k % 12, d: diffDays(pend(s, k), e) };
  }
  const toD = p => p.y * 360 + p.m * 30 + p.d;                 // 1년=360일, 1월=30일
  const fromD = n => { n = Math.max(0, Math.floor(n)); return { y: Math.floor(n / 360), m: Math.floor((n % 360) / 30), d: n % 30 }; };
  const fmt = p => `${p.y}년 ${p.m}월 ${p.d}일`;

  // 강사 주당 근무시간 기준(정규 교원): ~2004학년도 44, 2005학년도 43, 2006~2011학년도 42, 2012학년도~ 40
  function baseHoursFor(d) {
    if (!d) return 40;
    const sy = d.getMonth() + 1 >= 3 ? d.getFullYear() : d.getFullYear() - 1;   // 학년도
    return sy <= 2004 ? 44 : sy === 2005 ? 43 : sy <= 2011 ? 42 : 40;
  }
  function careerRate(row, s, e) {
    const c = CAREER.find(x => x.k === row.kind) || CAREER[CAREER.length - 1];
    if (row.kind === 'gangsa') {
      const base = baseHoursFor(s);
      let weekly = Number(row.hours) || 0;
      if (!weekly && Number(row.totalHours) && s && e) weekly = Number(row.totalHours) / ((diffDays(s, e) + 1) / 7);   // 총 시간 → 주당 평균
      let rate = weekly < 12 ? 30 : Math.min(100, Math.floor(weekly / base * 100));
      if (row.mismatch) rate = Math.floor(rate * 0.8);
      return { rate: Math.max(30, rate), base, weekly: Math.round(weekly * 10) / 10 };
    }
    if (row.kind === 'univLecturer') return { rate: Math.max(50, Math.min(100, Number(row.rate) || 50)) };
    if (c.rate != null && (row.rate === '' || row.rate == null)) return { rate: c.rate };
    return { rate: Math.max(0, Math.min(100, Number(row.rate) || 0)) };
  }

  function hobong(inp) {
    const msgs = [];
    const rows = (inp.rows || []).map((r, i) => {
      const s = D(r.start), e = D(r.end);
      const ok = s && e && e >= s;
      const cr = ok ? careerRate(r, s, e) : {};
      const lab = (CAREER.find(c => c.k === r.kind) || {}).label;
      return { i, kind: r.kind, label: (r.content || '').trim() || lab, kindLabel: lab, note: r.note || '', s, e, ok, rate: cr.rate || 0, base: cr.base, weekly: cr.weekly };
    }).filter(r => r.ok).sort((a, b) => a.s - b.s);   // 호봉획정표는 경력기간 순
    // 경력 중복: 날짜마다 가장 유리한(높은) 환산율 하나만 인정 (환산율표 15·16)
    const points = [...new Set(rows.flatMap(r => [r.s.getTime(), addDays(r.e, 1).getTime()]))].sort((a, b) => a - b);
    const segs = [];
    let overlapped = false;
    for (let k = 0; k < points.length - 1; k++) {
      const a = new Date(points[k]), b = addDays(new Date(points[k + 1]), -1);
      const cover = rows.filter(r => r.s <= a && r.e >= b);
      if (!cover.length) continue;
      if (cover.length > 1) overlapped = true;
      const best = cover.reduce((x, y) => (y.rate > x.rate ? y : x));
      const last = segs[segs.length - 1];
      if (last && last.row === best && diffDays(last.e, a) === 1) last.e = b;
      else segs.push({ s: a, e: b, row: best });
    }
    let rawD = 0, totalD = 0;
    rows.forEach(r => { r.period = ymd(r.s, r.e); r.usedD = 0; rawD += toD(r.period); });
    segs.forEach(sg => { const t = Math.floor(toD(ymd(sg.s, sg.e)) * sg.row.rate / 100); sg.row.usedD += t; totalD += t; });
    rows.forEach(r => { r.usedP = fromD(r.usedD); });
    if (overlapped) msgs.push({ level: 'info', text: '겹치는 경력이 있어 같은 기간은 환산율이 높은 경력 하나만 인정했습니다. 학교 강사 경력이 겹치면 학교별 실 근무시간을 합산해 한 줄로 입력하세요(중·고+초, 대학+전문대만 합산 가능).', ref: '지침 p.84' });
    rows.filter(r => r.kind === 'gangsa').forEach(r => msgs.push({ level: 'info', text: `${r.label}: 주당 ${r.weekly}시간 ÷ 기준 ${r.base}시간 → 환산율 ${r.rate}%${r.weekly < 12 ? '(주 12시간 미만은 최저 30%)' : ''}`, ref: '지침 p.82' }));

    const base = Number(inp.base) || 0;
    const add = (Number(inp.eduAdj) || 0) + (Number(inp.adj) || 0);
    const p14 = fromD(totalD);
    const d16 = Math.max(0, totalD + add * 360);
    const p16 = fromD(d16);
    let grade = base + p16.y, capped = false;
    if (inp.limit14 && grade > 14) { grade = 14; capped = true; }
    if (grade > 40) grade = 40;
    const rest = fromD(d16 - p16.y * 360);
    // 차기승급일: 잔여기간이 1년이 되는 날이 속한 달의 다음 달 1일(그날이 1일이면 그날)
    let next = null;
    const at = D(inp.date);
    if (at) {
      const need = 360 - toD(rest);
      const reach = addDays(new Date(at.getFullYear(), at.getMonth() + Math.floor(need / 30), at.getDate(), 12), need % 30);
      next = reach.getDate() === 1 ? reach : new Date(reach.getFullYear(), reach.getMonth() + 1, 1, 12);
    }
    msgs.unshift({ level: 'ok', text: `(17) 사정호봉 = 기산호봉 ${base} + (16) 호봉획정경력 ${p16.y}년 = ${base + p16.y}호봉${capped ? ' → 호봉상한제 14호봉 적용' : ''} · 잔여 ${rest.m}월 ${rest.d}일`, ref: '공무원보수규정 제8조' });
    if (capped) msgs.push({ level: 'warn', text: '퇴직연금 수령자(일시금 포함)·명예퇴직자·정년퇴직자는 14호봉을 넘지 못합니다. 정근수당도 14호봉 기준·근무연수 5년만 인정합니다.', ref: '지침 p.16~17' });
    if (rows.some(r => ['gangsa', 'univLecturer', 'company', 'companyPersonal', 'academy', 'publicInst', 'researcher', 'govAgency'].includes(r.kind)))
      msgs.push({ level: 'warn', text: '유사경력(강사·회사·학원 등)은 반드시 전력조회(서식 12·13)로 확인하고, 주당 근무시간 15시간 이상인지(강사는 12시간) 확인하세요.', ref: '지침 p.16, p.82~84' });
    if (rows.some(r => r.kind === 'leaveCounted')) msgs.push({ level: 'info', text: '휴직 기간의 경력 인정 범위(예: 육아휴직 자녀별 인정 기간)는 공무원보수 업무지침으로 확인하고, 인정되는 부분만 입력하세요.', ref: '' });
    msgs.push({ level: 'info', text: '기간제교원은 계약 기간 중 호봉 정정·재획정·승급을 하지 않습니다(차기승급일은 참고용). 연장 계약 때 다시 획정하고, 1정 자격 취득 시에는 재획정합니다.', ref: '지침 p.14, p.16' });
    return { rows, segs, rawP: fromD(rawD), p14, add, p16, grade, capped, rest, next, msgs, fmt };
  }

  /* =====================================================================
   * 3. 연장 계약 판정
   * ===================================================================== */
  function extend(inp) {
    const msgs = [], say = (level, text, ref) => msgs.push({ level, text, ref });
    const first = D(inp.firstStart), curS = D(inp.curStart), curE = D(inp.curEnd), nS = D(inp.newStart), nE = D(inp.newEnd);
    if (!first || !curE || !nS || !nE || nE < nS) return { error: '최초 임용일, 현재 계약 종료일, 연장 기간을 입력하세요.' };
    const r = { msgs, ok: true };
    r.gap = diffDays(curE, nS) - 1;
    r.limitEnd = addDays(periodEnd(first, 48), 0);
    r.newMonths = R.contractMonths(nS, nE);
    r.cumMonths = R.contractMonths(first, nE);
    let isExtension = true;

    if (inp.curType && inp.curType !== '기간제교원') {
      say('block', '강사로 근무한 기간은 기간제교원 연장 계약 대상이 아니고, 강사 기간을 소급해 기간제교원으로 바꿀 수도 없습니다. 연장 기간이 1개월 이상이면 별도 채용 절차로 기간제교원을 임용하세요(나이스: 계약직 구분이 달라 퇴직 처리 후 신규 등록).', 'Q&A 16, 지침 p.87');
      isExtension = false; r.ok = false;
    }
    if (r.gap > 0) {
      say('block', `현재 계약 종료일과 새 계약 시작일 사이에 ${r.gap}일 공백이 있어 연장 계약이 아닙니다. 새 채용 절차를 거치고, 결격사유·범죄경력 조회와 유효기간 내 마약류 서류를 다시 받아야 합니다. 공백일이 모두 공휴일·휴업일이면 계약 기간에 포함해 이어서 계약할 수 있습니다.`, '지침 p.4, Q&A 15');
      isExtension = false; r.ok = false;
    } else if (r.gap < 0) say('warn', '새 계약 시작일이 현재 계약 종료일과 겹칩니다. 종료일 다음 날로 맞추세요.', '');
    if (!inp.sameVacancy) { say('block', '같은 교원(또는 같은 교과, 유·초등은 교과 무관)의 결원이 이어지는 경우에만 연장 계약할 수 있습니다. 다른 결원이면 새 채용 절차를 거치세요. (인력풀 등록 재직 교사를 같은 학교에서 기간 단절 없이 재임용하면 공고는 생략 가능)', '지침 p.13~14'); isExtension = false; r.ok = false; }
    if (!inp.wants) { say('block', '기존 근무자가 연장을 희망해야 합니다.', '지침 p.14'); r.ok = false; }
    if (inp.hiredBy === 'expand') { say('block', '2차 공고에서 자격 확대(상한 연령, 명예퇴직 2년 미만, 학교급 불일치, 유사 과목)로 채용된 사람은 연장 계약할 수 없습니다. 원 자격 기준으로 공개 모집을 다시 하세요.', '지침 p.14'); r.ok = false; }
    if (inp.hiredBy !== 'open' && inp.hiredBy !== 'expand' && r.newMonths >= 6)
      say('warn', '6개월 이상 연장은 처음 임용 당시 공개전형으로 채용된 경우에 인사자문위원회 자문만으로 가능합니다. 인력풀·공고 생략으로 채용됐다면 공개전형을 거치는 것이 원칙입니다.', 'Q&A 14');
    if (nE > r.limitEnd) {
      say('block', `같은 학교 총 임용 기간은 4년까지입니다. 최초 임용일(${kdate(first)}) 기준 ${kdate(r.limitEnd)}까지만 연장할 수 있습니다. 그 이후는 퇴직 처리(4대보험 상실, 퇴직금 지급) 후 공개모집으로 다시 채용하세요.`, '지침 p.13, Q&A 11');
      r.ok = false;
    } else say('ok', `4년 상한: ${kdate(r.limitEnd)}까지 (최초 임용일 ${kdate(first)}, 연장 후 누적 약 ${r.cumMonths}개월)`, '지침 p.13');
    if (r.newMonths > 12) say('warn', `이번 연장 기간이 약 ${r.newMonths}개월입니다. 계약은 1년 범위 내로 정하고, 필요하면 1년 단위로 다시 연장하세요.`, '지침 p.13, Q&A 14');
    if (r.ok) say('ok', '연장 계약 요건을 충족합니다. 인사자문위원회 자문을 받아 새 채용 절차 없이 연장 계약할 수 있습니다(회의록 구비).', '지침 p.14');

    if (isExtension) {
      say('info', '계약서를 새로 작성하고 호봉을 다시 획정합니다. 계약 기간 동안은 확정 호봉으로 고정(정기승급 없음)입니다.', '지침 p.14, p.87');
      say('info', '기간 단절이 없으므로 결격사유·범죄경력 조회, 검사서(잠복결핵·채용신체검사·마약류), 경력 증빙서류는 각각 생략할 수 있습니다.', '지침 p.4');
      const al = R.annualLeave(r.newMonths, R.contractMonths(curS || first, curE) + (curS && curS > first ? R.contractMonths(first, addDays(curS, -1)) : 0));
      say('info', `연가는 기존 계약 기간을 누적해 계산합니다: 이번 연장분 ${r.newMonths}개월 × ${al.base}일/12 = ${al.days}일`, '지침 p.25');
      if (r.newMonths >= 3) say('info', '3개월 이상이면 법정의무교육(원격) 이수와 근무실적 평가 대상입니다(계약서 제14·15조).', '지침 p.15~16');
    }
    r.neis = isExtension
      ? ['퇴직예정년월일을 연장 계약 종료일로 수정: 교원인사 > 계약제교원 > 인사기록관리 > 퇴직예정자관리(계약제교원)',
        '연장 계약 때 확정한 호봉으로 승급기록 추가 및 근무사항 반영: 인사기록(계약제교원) > 승급기록',
        '계약 만료 때까지 확정 호봉 유지(정기승급 없음), 1정 자격 취득 시 재획정']
      : ['공백이 있거나 계약직 구분이 다르면 연장 불가: 기존 계약은 퇴직 처리(퇴직사유: 계약만료)',
        '새 계약은 신규 등록. 같은 학교에 기존 인사기록이 있으면 수정해서 사용(동일인 카드는 1개만)'];
    return r;
  }

  /* =====================================================================
   * 4. 급여 계산
   * ===================================================================== */
  const JG_RATE = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];  // 공무원수당 등에 관한 규정 별표 2(근무연수별, 월봉급액 대비 %)
  function jeonggeun(pay, years, months, limit14) {
    const y = Math.min(10, Math.max(0, Math.floor(limit14 ? Math.min(years, 5) : years)));
    const rate = JG_RATE[y];
    const m = Math.min(6, Math.max(0, months));
    return { y, rate, amount: Math.floor(pay * rate / 100 * m / 6), m };
  }
  function severance(inp) {
    const s = D(inp.start), e = D(inp.end);
    if (!s || !e || e < s) return { error: '계속근로 시작일과 마지막 근무일을 입력하세요.' };
    const days = diffDays(s, e) + 1;
    const out = { days, years: days / 365 };
    out.eligible = days >= 365;
    const w3 = Number(inp.wage3) || 0, d3 = Number(inp.days3) || 0;
    const bonus = (Number(inp.annualBonus) || 0) * 3 / 12;
    out.avg = d3 > 0 ? (w3 + bonus) / d3 : 0;
    out.ordinary = Number(inp.ordinaryDaily) || 0;
    out.daily = Math.max(out.avg, out.ordinary);
    out.usedOrdinary = out.ordinary > out.avg;
    out.amount = out.eligible ? Math.floor(out.daily * 30 * days / 365) : 0;
    out.payBy = addDays(e, 15);
    return out;
  }
  function weeklyHoliday(hoursPerWeek, rate) {
    if (hoursPerWeek < 15) return { eligible: false, amount: 0 };
    return { eligible: true, amount: Math.floor(Math.min(40, hoursPerWeek) / 40 * 8 * rate) };
  }

  const api = { CERT, EDU, CAREER, baseHoursFor, hobong, ymd, edate, toD, fromD, fmt, extend, JG_RATE, jeonggeun, severance, weeklyHoliday };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Rules3 = api;
})(this);
