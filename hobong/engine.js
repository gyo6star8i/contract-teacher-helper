/* 교육공무원 호봉획정 계산 엔진
 * 근거
 *  - 공무원보수규정 제8조(초임호봉 획정), 제9조(호봉 재획정), [별표 15]
 *  - [별표 22] 교육공무원 등의 경력환산율표 (개정 2025. 1. 3.)
 *  - [별표 23] 총수학연수 가감 산정표: (총수학연수 − 16) + 가산연수 (개정 2021. 1. 5.)
 *  - [별표 25] 기산호봉표 (개정 2009. 3. 31.)
 *  - 교육공무원 호봉획정시 경력환산율표의 적용 등에 관한 예규(교육부, 2025. 4. 23.)
 *  - 계산 방식: 1년 = 12월, 1월 = 30일(경력 환산 시 1년 = 360일), 환산 후 일 미만 버림
 *    (첨부 호봉획정표.xlsm의 기간()/환산() 함수와 같은 방식)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Hobong = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- 날짜 도우미 ---------- */
  function D(v) {
    if (!v) return null;
    if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate(), 12);
    const m = String(v).trim().match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3], 12);
    return d.getMonth() === +m[2] - 1 ? d : null;
  }
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '';
  const kdate = d => d ? `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.` : '';
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
  const diffDays = (a, b) => Math.round((b - a) / 86400000);
  function addMonths(s, k) {
    const y = s.getFullYear(), m = s.getMonth() + k;
    const last = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(s.getDate(), last), 12);
  }

  /* 시작일~종료일(양 끝 포함) → {y, m, d}
   * 민법 제160조 방식: k개월은 기산일에 해당하는 날의 전날에 끝남(해당 날이 없으면 그 달 말일)
   * 2005.4.21~2007.4.20 = 2년 0월 0일, 2016.3.1~2016.5.19 = 0년 2월 19일 (엑셀 기간() 함수와 같음) */
  const pend = (s, k) => { const x = addMonths(s, k); return x.getDate() === s.getDate() ? addDays(x, -1) : x; };
  function ymd(s, e) {
    if (!s || !e || e < s) return { y: 0, m: 0, d: 0 };
    const e1 = addDays(e, 1);
    let k = (e1.getFullYear() - s.getFullYear()) * 12 + e1.getMonth() - s.getMonth();
    if (k > 0 && pend(s, k) > e) k--;
    let d = k > 0 ? diffDays(pend(s, k), e) : diffDays(s, e) + 1;
    if (d >= 30) d = 29;                       // 엑셀 기간() 함수: 30일은 29일로(1개월 미만)
    return { y: Math.floor(k / 12), m: k % 12, d };
  }
  const toD = p => p.y * 360 + p.m * 30 + p.d;
  const fromD = n => {
    n = Math.floor(n);
    const y = Math.floor(n / 360), r = n - y * 360;
    return { y, m: Math.floor(r / 30), d: r % 30 };
  };
  const fmt = p => `${p.y}년 ${p.m}월 ${p.d}일`;

  /* ---------- [별표 25] 기산호봉 ---------- */
  const CERT = [
    ['정교사(1급)', 9], ['정교사(2급)', 8], ['준교사', 5], ['실기교사', 5],
    ['전문상담교사(1급)', 9], ['전문상담교사(2급)', 8], ['사서교사(1급)', 9], ['사서교사(2급)', 8],
    ['보건교사(1급)', 9], ['보건교사(2급)', 8], ['영양교사(1급)', 9], ['영양교사(2급)', 8],
    ['교장·원장·교감·원감', 9], ['교육장·장학관·교육연구관', 9], ['장학사·교육연구사', 9],
  ];

  /* ---------- [별표 23] 총수학연수 ---------- */
  const EDU = [
    ['4년제 대학(사범대·교대 포함) 졸업', 16], ['5년제 대학 졸업', 17], ['6년제 대학 졸업', 18],
    ['3년제 전문대학 졸업', 15], ['2년제 전문대학·2년제 교육대학·2년제 사범대학 졸업', 14],
    ['사범학교 졸업', 13], ['고등학교 졸업', 12], ['고등학교 2년 수료', 11], ['고등학교 1년 수료', 10], ['중학교 졸업', 9],
  ];
  // 가산연수: 3.가 일반 교원 중 수학연한 2년 이상 사범계 졸업 1년 / 3.나 특수 교원(특수학교 자격증 소지)
  function eduAdjust(years, sabeom, special, sabeomShort) {
    let add = 0, why = '';
    if (special) {
      if (sabeom) { add = 2; why = '특수학교 등 근무 교원(특수학교 자격) · 사범계 2년 이상 졸업: 2년'; }
      else if (sabeomShort) { add = 1; why = '특수 교원 · 사범계 교원양성기관(1~2년) 수료: 1년'; }
      else { add = 1; why = '특수 교원 · 비사범계 졸업: 1년'; }
    } else if (sabeom && years >= 14) { add = 1; why = '수학연한 2년 이상 사범계(교육계 학과 포함) 졸업: 1년'; }
    return { total: (years - 16) + add, base: years - 16, add, why };
  }

  /* ---------- [별표 22] 경력 구분과 환산율 ---------- */
  const CAREER = [
    { k: 'teacher', g: '교원', label: '교원(교육공무원·기간제·사립 보고) 경력', rate: 100, ref: '별표22 1.가·나' },
    { k: 'teacher80', g: '교원', label: '기간제 교원 — 자격증 종류와 근무 학교 불일치', rate: 80, ref: '별표22 1.가 단서' },
    { k: 'privNoReport', g: '교원', label: '사립학교 교원 — 관할청 미보고', rate: 50, ref: '별표22 1.가 단서' },
    { k: 'lifelong', g: '교원', label: '학력인정 평생교육시설·재외 한국학교 교원', rate: 100, ref: '별표22 1.다·라' },
    { k: 'daycare', g: '교원', label: '어린이집 보육교직원(유치원 자격·임면보고)', rate: 100, ref: '별표22 1.마' },
    { k: 'daycareDis', g: '교원', label: '장애영유아 어린이집(특수학교 자격·임면보고)', rate: 80, ref: '별표22 1.바' },
    { k: 'military', g: '공무원', label: '군 복무(현역·보충역·상근예비역·대체역)', rate: 100, ref: '별표22 2.가' },
    { k: 'gov', g: '공무원', label: '국가·지방공무원(교원 외)', rate: 100, ref: '별표22 2.가' },
    { k: 'employ', g: '공무원', label: '고용직공무원', rate: 80, ref: '별표22 2.나' },
    { k: 'gangsa', g: '유사', label: '유치원·초·중등 강사(시간강사 등) — 근무시간 비례', rate: null, ref: '별표22 3.가, 예규 별표1' },
    { k: 'univ', g: '유사', label: '대학 시간강사(교육부 기준 30~100%)', rate: 50, ref: '별표22 3.가 3)' },
    { k: 'research', g: '유사', label: '연구경력(대학·정부출연연 연구원, 연구전담 조교)', rate: 100, ref: '별표22 3.나 1)~3)' },
    { k: 'grad', g: '유사', label: '대학원 학위 취득(석사: 학칙 최저 수업연한, 박사: 3년 이내)', rate: 100, ref: '별표22 3.나 4)' },
    { k: 'temp', g: '유사', label: '국가·지자체 임시직·촉탁·잡급(교육공무직 등) — 동일 분야 자격 후', rate: 80, ref: '별표22 3.다' },
    { k: 'temp50', g: '유사', label: '국가·지자체 임시직 등 — 그 밖의 경력', rate: 50, ref: '별표22 3.다 단서' },
    { k: 'milSpecial', g: '그밖', label: '예술·체육요원, 산업기능요원, 전문연구요원, 승선근무예비역', rate: 100, ref: '별표22 3.라 1)' },
    { k: 'rehab', g: '그밖', label: '장애인 지역사회재활시설(특수학교 자격)', rate: 80, ref: '별표22 3.라 2)' },
    { k: 'lawyer', g: '그밖', label: '변호사·법무사 법률사무', rate: 70, ref: '별표22 3.라 3)' },
    { k: 'union', g: '그밖', label: '교원단체·교원노조', rate: 70, ref: '별표22 3.라 4)' },
    { k: 'altEdu', g: '그밖', label: '대안교육 위탁교육기관(같은 분야 자격 후)', rate: 70, ref: '별표22 3.라 5)' },
    { k: 'religion', g: '그밖', label: '비영리 종교법인 교육활동 직무', rate: 60, ref: '별표22 3.라 6)' },
    { k: 'publicInst', g: '그밖', label: '공공기관·공공법인(행정·경영·연구·과학기술)', rate: 50, ref: '별표22 3.라 7)' },
    { k: 'overseas', g: '그밖', label: '재외교육기관·재외교육단체', rate: 50, ref: '별표22 3.라 8)' },
    { k: 'academy', g: '그밖', label: '학원·교습소(강사 등록·신고됨)', rate: 50, ref: '별표22 3.라 9)' },
    { k: 'academy30', g: '그밖', label: '학원·교습소(강사 미등록)', rate: 30, ref: '별표22 3.라 9) 단서' },
    { k: 'company', g: '그밖', label: '회사(상법상 회사, 외국회사 포함)', rate: 40, ref: '별표22 3.라 10)' },
    { k: 'other', g: '그밖', label: '그 밖의 직업(개인사업체 등)', rate: 30, ref: '별표22 3.라 11)' },
    { k: 'leave', g: '휴직', label: '휴직 등 — 승급기간 산입(육아휴직 등)', rate: 100, ref: '공무원보수규정 제14조·업무지침' },
    { k: 'leave0', g: '휴직', label: '휴직·정직 등 — 승급기간 불산입', rate: 0, ref: '공무원보수규정 제14조' },
    { k: 'custom', g: '직접', label: '직접 입력(환산율 지정)', rate: null, ref: '' },
  ];
  const KIND = Object.fromEntries(CAREER.map(c => [c.k, c]));

  // 정규 교원 평균 주당 근무시간(학년도 기준): ~2004 44h, 2005 43h, 2006~2011 42h, 2012~ 40h
  function baseHoursFor(d) {
    if (!d) return 40;
    const sy = d.getMonth() + 1 >= 3 ? d.getFullYear() : d.getFullYear() - 1;
    return sy <= 2004 ? 44 : sy === 2005 ? 43 : sy <= 2011 ? 42 : 40;
  }

  /* 한 경력 줄의 환산
   * 반환: { period, rawD, factor(0~1), note } — 환산일수 = floor(rawD × factor) */
  function rowFactor(r, s, e) {
    const c = KIND[r.kind] || KIND.custom;
    const notes = [];
    let factor;
    if (r.kind === 'gangsa') {
      const base = Number(r.baseHours) || baseHoursFor(s);
      const days = diffDays(s, e) + 1;
      let weekly = Number(r.weekly) || 0;
      if (!weekly && Number(r.totalHours)) {
        // 예규: 일 평균 = 총시간 ÷ 총 근무일(소수 셋째 자리 버림), 주당 = 일 평균 × 7 (소수 버림)
        const daily = Math.floor(Number(r.totalHours) / days * 100) / 100;
        weekly = Math.floor(daily * 7);
        notes.push(`총 ${r.totalHours}시간 ÷ ${days}일 = 일 ${daily}h × 7 = 주당 ${weekly}h`);
      }
      if (!weekly || weekly <= 12) { factor = 0.3; notes.push(`주당 실근무 ${weekly || '불명확'}h(12h 이하·불명확) → 30%`); }
      else { factor = Math.min(1, weekly / base); notes.push(`주당 ${weekly}h ÷ 기준 ${base}h = ${(factor * 100).toFixed(1)}%`); }
      if (r.mismatch) { factor *= 0.8; notes.push('자격-학교급 불일치 × 80%'); }
      factor = Math.max(factor, 0.3 * (r.mismatch ? 0.8 : 1));
    } else {
      const rate = (r.rate === '' || r.rate == null) ? (c.rate == null ? 0 : c.rate) : Number(r.rate);
      factor = Math.max(0, Math.min(100, rate || 0)) / 100;
      // 별표22 비고4: 통상 근무시간보다 짧게 근무한 경력은 비례(주 15시간 미만은 제외)
      const w = Number(r.weekly) || 0;
      if (w && w < 40 && !['military', 'gov', 'employ', 'leave', 'leave0', 'grad'].includes(r.kind)) {
        if (w < 15) { factor = 0; notes.push(`주 ${w}h(15h 미만) → 불인정(별표22 비고4)`); }
        else { factor *= w / 40; notes.push(`단시간 근무 주 ${w}h ÷ 40h 비례(별표22 비고4)`); }
      }
    }
    return { factor, notes };
  }

  /* 메인 계산
   * inp = { rows:[{start,end,content,kind,rate,weekly,totalHours,baseHours,mismatch,note}],
   *         base, eduYears, sabeom, special, sabeomShort, extraAdj, date, pre97, limit14, contract }
   */
  function calc(inp) {
    const msgs = [];
    const rows = (inp.rows || []).map((r, i) => {
      const s = D(r.start), e = D(r.end);
      const ok = !!(s && e && e >= s);
      const c = KIND[r.kind] || KIND.custom;
      const f = ok ? rowFactor(r, s, e) : { factor: 0, notes: [] };
      return { i, src: r, kind: r.kind, kindLabel: c.label, ref: c.ref, content: (r.content || '').trim() || c.label,
        s, e, ok, factor: f.factor, notes: f.notes, note: r.note || '' };
    });
    rows.filter(r => !r.ok && (r.src.start || r.src.end)).forEach(r =>
      msgs.push({ level: 'warn', text: `${r.i + 1}행: 날짜가 비었거나 종료일이 시작일보다 빠릅니다.` }));
    const valid = rows.filter(r => r.ok).sort((a, b) => a.s - b.s);

    // 경력 중복: 같은 날은 환산율이 가장 높은 경력 하나만 (별표22 비고3, 예규)
    const pts = [...new Set(valid.flatMap(r => [r.s.getTime(), addDays(r.e, 1).getTime()]))].sort((a, b) => a - b);
    const segs = [];
    let overlap = false;
    for (let k = 0; k < pts.length - 1; k++) {
      const a = new Date(pts[k]), b = addDays(new Date(pts[k + 1]), -1);
      const cover = valid.filter(r => r.s <= a && r.e >= b);
      if (!cover.length) continue;
      if (cover.length > 1) overlap = true;
      const best = cover.reduce((x, y) => (y.factor > x.factor ? y : x));
      const last = segs[segs.length - 1];
      if (last && last.row === best && diffDays(last.e, a) === 1) last.e = b; else segs.push({ s: a, e: b, row: best });
    }
    let rawD = 0, totD = 0;
    valid.forEach(r => { r.period = ymd(r.s, r.e); r.usedD = 0; rawD += toD(r.period); });
    segs.forEach(sg => { const t = Math.floor(toD(ymd(sg.s, sg.e)) * sg.row.factor + 1e-9); sg.row.usedD += t; totD += t; });
    valid.forEach(r => { r.used = fromD(r.usedD); r.ratePct = Math.round(r.factor * 1000) / 10; });
    if (overlap) msgs.push({ level: 'info', text: '겹치는 기간이 있어 같은 날은 환산율이 높은 경력 하나만 인정했습니다. 여러 학교 시간강사를 동시에 한 경우에는 주당 시간을 합산해 한 줄로 입력하세요.', ref: '별표22 비고3, 예규' });

    // (15) 가감년수
    const edu = eduAdjust(Number(inp.eduYears) || 16, !!inp.sabeom, !!inp.special, !!inp.sabeomShort);
    const extra = Number(inp.extraAdj) || 0;          // 특별승급·승급제한 등 직접 가감(년)
    const adj = edu.total + extra;
    const base = Number(inp.base) || 0;

    const p13 = fromD(rawD);            // 경력년수 합계(환산 전)
    const p14 = fromD(totD);            // 환산 총경력
    const d16 = totD + adj * 360;
    const p16 = fromD(d16);             // 호봉획정 경력(년은 음수 가능)
    let rest = { m: p16.m, d: p16.d };
    let years = p16.y;
    if (inp.pre97 && rest.d >= 15) {    // 1997.1.1. 이전 획정: 잔여 15일 이상은 1월
      rest = { m: rest.m + 1, d: 0 };
      if (rest.m === 12) { rest.m = 0; years += 1; }
    }
    let grade = base + years;
    let capped = false;
    if (inp.limit14 && grade > 14) { grade = 14; capped = true; }
    if (grade < 1) { msgs.push({ level: 'warn', text: '계산 결과가 1호봉 미만입니다. 입력을 확인하세요.' }); grade = 1; }
    const extraGabong = grade > 40 ? grade - 40 : 0;
    const gradeText = extraGabong ? `40호봉 + 근속가봉 ${extraGabong}` : `${grade}호봉`;

    // 차기승급일: 잔여기간 + 획정일 이후 근무가 1년이 되는 날, 그날이 1일이 아니면 다음 달 1일
    let next = null;
    const at = D(inp.date);
    if (at && !capped) {
      const reach = addDays(addMonths(at, 12 - rest.m), -rest.d);
      next = reach.getDate() === 1 ? reach : new Date(reach.getFullYear(), reach.getMonth() + 1, 1, 12);
      if (next <= at) next = new Date(at.getFullYear(), at.getMonth() + 1, 1, 12);
    }

    msgs.unshift({ level: 'ok', text: `(17) 사정호봉 = 기산호봉 ${base} + 호봉획정경력 ${years}년 = ${base + years}호봉${capped ? ' → 호봉상한 14호봉' : ''}${extraGabong ? ` (봉급표 최고 40호봉, 초과분 ${extraGabong}은 근속가봉)` : ''}, 잔여 ${rest.m}월 ${rest.d}일`, ref: '공무원보수규정 제8조, 별표25' });
    if (capped) msgs.push({ level: 'warn', text: '호봉상한(14호봉): 퇴직연금(퇴직연금일시금 포함) 수령자·명예퇴직자·정년퇴직자를 계약제교원으로 임용하는 경우에만 적용합니다.', ref: '계약제교원 운영 지침' });
    if (inp.contract) msgs.push({ level: 'info', text: '계약제교원은 계약 기간 중 승급하지 않습니다. 차기승급일은 참고용이며 연장 계약 시 다시 획정합니다.', ref: '기간제교원의 봉급 지급에 관한 예규' });
    if (valid.some(r => ['gangsa', 'univ', 'company', 'other', 'academy', 'academy30', 'publicInst', 'research', 'temp', 'temp50', 'religion', 'overseas'].includes(r.kind)))
      msgs.push({ level: 'info', text: '유사경력(강사·회사·학원 등)은 경력증명서와 함께 4대보험 가입내역 등 객관적 증빙으로 상근·보수 지급 여부를 확인하세요.', ref: '예규' });
    if (valid.some(r => r.kind === 'leave')) msgs.push({ level: 'info', text: '휴직 기간은 휴직 종류별로 승급기간 산입 여부가 다릅니다(육아휴직·공무상 질병휴직 등 산입, 일반 질병휴직 등은 불산입). 인정되는 기간만 "산입"으로 두세요.', ref: '공무원보수규정 제14조' });

    return { rows, valid, segs, p13, p14, edu, extra, adj, p16, years, rest, base, grade, gradeText, capped, next, at, msgs };
  }

  return { D, iso, kdate, ymd, toD, fromD, fmt, addMonths, addDays, diffDays, CERT, EDU, CAREER, KIND, baseHoursFor, eduAdjust, calc };
});
