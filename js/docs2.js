/* 채용 계획·공고문·계약서·임용 보고 문구 생성 (참고자료 2~4, 서식 14·15·21 기반) */
(function (root) {
  'use strict';
  const R = root.Rules || (typeof require !== 'undefined' ? require('./rules.js') : null);
  const { kdate } = R;
  const D = s => (s ? R.D(s) : null);
  const kd = (s, w) => (s ? kdate(D(s), w) : '      .    .    .');
  const ymd = s => { const d = D(s); return d ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일` : '      년    월    일'; };
  const L = (s, t) => ({ s, t });
  const LET = '가나다라마바사아자차카'.split('');
  const n = v => Number(v) || 0;
  // 받침에 따라 을/를
  const eul = w => { const c = (w || '').charCodeAt(w.length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? w + '을' : w + '를'; };
  const subj = (f, t) => (f.subject || '').trim() || (t || '○○');

  /* 공고일 기준 일정: 접수 마감은 공고일 제외 3일(공휴일 포함), 이후 일정은 평일로 */
  function weekday(d) { const x = new Date(d); while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1); return x; }
  function schedule(nd) {
    const recvEnd = R.addDays(nd, 3);
    const docA = weekday(R.addDays(recvEnd, 1));
    const intv = weekday(R.addDays(docA, 1));
    const sub = weekday(R.addDays(intv, 2));
    return { recvEnd: R.iso(recvEnd), docAnnounce: R.iso(docA), interviewDate: R.iso(intv), finalAnnounce: R.iso(intv), submitEnd: R.iso(sub) };
  }

  /* 판별 결과 → 채용 정보 기본값 */
  function hireDefaults(r, inp) {
    const o = {};
    let type = r.type, from = r.start, to = r.end;
    if (r.route === 'two_step') { type = r.stepB.isGigan ? '기간제교원' : '전일제강사'; from = r.stepB.from; to = r.stepB.to; }
    o.typeLabel = type;
    o.cStart = R.iso(from); o.cEnd = R.iso(to);
    const lk = R.leaveKeys(inp);
    o.reasonText = lk.length && lk.every(k => k === 'temporary' || k === 'expert')
      ? `${(inp.target || '').trim() || '○○'} ${R.leaveLabel(inp)}`
      : `${(inp.target || '').trim() || '○○○'} ○○○ 교사의 ${R.leaveLabel(inp)} 대체`;
    o.related = R.legalBasis(inp).join('\n');
    o.round = inp.noticeStage === 'none' ? '1차' : '2차';
    const expanded = ['gigan_2nd_expand', 'gangsa_2nd_expand', 'two_step'].includes(r.route) && o.round === '2차';
    o.expandText = expanded ? r.expansions.map(e => e.replace(/\(.*\)/, '').trim()).join(', ') : '';
    o.method = r.route === 'gigan_pool' ? 'pool' : (['gangsa_skip', 'gangsa_urgent_expand', 'gigan_extend'].includes(r.route) ? 'skip' : 'notice');
    o.certReq = inp.schoolLevel === 'mid' ? '해당 교과 중등학교 2급 정교사 이상 자격증 소지자' : inp.schoolLevel === 'kinder' ? '유치원 2급 정교사 이상 자격증 소지자' : inp.schoolLevel === 'special' ? '해당 학교(급) 특수학교 2급 정교사 이상 자격증 소지자' : '초등학교 2급 정교사 이상 자격증 소지자';
    o.noticeDate = R.iso(r.today || new Date());
    Object.assign(o, schedule(r.today || new Date()));
    o.retiredYN = ['honor', 'age', 'pension', 'other'].includes(inp.retire) ? '예' : '아니오';
    o.retireKind = { honor: '명예퇴직', age: '정년퇴직', pension: '퇴직', other: '퇴직' }[inp.retire] || '';
    o.months = R.contractMonths(from, to);
    return o;
  }

  function ageLine(f) {
    const base = f.typeLabel === '기간제교원' ? 62 : 65;
    if (f.round === '2차' && /연령/.test(f.expandText)) return `◦ 응모 자격: 1차 공개채용 모집에 적격한 지원자가 없어 임용 상한 연령을 만 70세까지 확대(임용일 기준 만 70세 생일이 지나지 않은 자)`;
    return `◦ 응모 자격: 임용 상한 연령(만 ${base}세) 미해당자(임용일 기준 만 ${base}세 생일이 지나지 않은 자)`;
  }
  function periodText(f) { return `${kd(f.cStart)} ~ ${kd(f.cEnd)}`; }
  function methodText(f) {
    return f.method === 'pool' ? '인력풀 활용(공고 생략)' : f.method === 'skip' ? '공고 생략(인사자문위원회 적부 심사)' : `공개채용(${f.round} 공고)` + (f.pool ? ', 인력풀 병행' : '');
  }

  /* ---------- 채용 계획 기안(참고자료 2) ---------- */
  function planGian(f) {
    const b = [];
    // 관련: 법령 → 지침 → 그 밖의 문서 순
    const extra = (f.related || '').split('\n').map(s => s.trim()).filter(Boolean);
    const laws = extra.filter(t => /「[^」]*(법|령|규칙)」/.test(t)), others = extra.filter(t => !laws.includes(t));
    const rel = laws.concat(['2026 계약제교원 운영 지침(경상북도교육청, 2026. 2.)'], others);
    b.push(L('L0', '1. 관련'));
    rel.forEach((t, i) => b.push(L('L1', `${LET[i]}. ${t}`)));
    b.push(L('L0', /교사의 /.test(f.reasonText)
      ? `2. ${f.reasonText.replace(/ 대체$/, '')}에 따른 결원으로 다음과 같이 ${eul(f.typeLabel)} 채용하고자 합니다.`
      : `2. ${f.reasonText}을 위하여 다음과 같이 ${eul(f.typeLabel)} 채용하고자 합니다.`));
    b.push(L('L1', '가. 채용 개요'));
    b.push(L('L2', `1) 과목(담당): ${subj(f)}`));
    b.push(L('L2', `2) 채용 기간: ${periodText(f)}` + (f.months ? `(${f.months}개월)` : '')));
    b.push(L('L2', `3) 인원: ${f.count || 1}명`));
    b.push(L('L2', `4) 채용 방식: ${methodText(f)}`));
    if (f.expandText) b.push(L('L2', `5) 자격 확대: ${f.expandText}(1차 공개채용 적격 지원자 없음, 인사자문위원회 회의록 구비)`));
    b.push(L('L1', '나. 제출 서류 및 세부 계획: 붙임 참조'));
    b.push(L('L0', ''));
    if (f.method === 'notice') {
      b.push(L('ATT', `붙임  1. ${f.typeLabel} 채용 계획 1부.`));
      b.push(L('ATT2', '2. 채용 공고문 1부.  끝.'));
    } else b.push(L('ATT', `붙임  ${f.typeLabel} 채용 계획 1부.  끝.`));
    return { body: b, vars: { title: `${kd(f.cStart)}자 ${f.typeLabel} 채용 계획`, receiver: '내부결재' } };
  }

  /* ---------- 채용 계획(참고자료 3) ---------- */
  function planDoc(f) {
    const notice = f.method === 'notice';
    const ds = [n(f.dp1), n(f.dp2), n(f.dp3), n(f.dp4)], is = [n(f.ip1), n(f.ip2), n(f.ip3), n(f.ip4)];
    const dSum = ds.reduce((a, b) => a + b, 0), iSum = is.reduce((a, b) => a + b, 0);
    const B = {}, push = (k, s, t) => (B[k] = B[k] || []).push(L(s, t));
    push('BODY', 'H', 'Ⅰ. 채용 개요');
    push('BODY2', 'L0', '');
    push('BODY2', 'H', 'Ⅱ. 추진 방침');
    ['기간제교원 유경험자 우대 선발', '채용 심사위원 중 후보자와 친·인척, 사제 관계 등인 자는 참여 제한', '채용과정의 투명성 및 공정성 제고, 개인정보보호에 유의하여 진행']
      .concat(f.expandText ? [`1차 공개채용 모집에 적격한 지원자가 없어 ${f.round} 공개채용부터 자격 확대(${f.expandText}) 적용(인사자문위원회 회의록 구비)`] : [])
      .forEach(t => push('BODY2', 'L3', '❍ ' + t));
    push('BODY2', 'L0', '');
    push('BODY2', 'H', 'Ⅲ. 추진 일정');

    push('BODY3', 'L0', '');
    push('BODY3', 'H', 'Ⅳ. 세부 추진 계획');
    push('BODY3', 'L0', '1. 채용 방식');
    if (notice) {
      push('BODY3', 'L1', `가. 채용 공고(${f.round} 공고)`);
      push('BODY3', 'L2', `1) 기간: ${kd(f.noticeDate, true)} ~ ${kd(f.recvEnd, true)} (공고일 제외 3일 이상, 공휴일 포함)`);
      push('BODY3', 'L2', '2) 방법: 경상북도교육청 홈페이지(채용정보/기간제교사/구인란)에만 공고');
      push('BODY3', 'L2', '3) 내용: 계약조건, 자격요건, 직무수행 요건, 구비서류, 채용서류의 반환 안내, 채용일정, 심사방법, 심사일, 발표일 등');
      if (f.pool) push('BODY3', 'L1', '나. 인력풀 병행: 인력풀 등재자 중 복수(2배수 이상)로 대상자를 선정하여 면접 실시');
    } else if (f.method === 'pool') {
      push('BODY3', 'L1', '가. 인력풀 활용 채용: 공고 없이 나이스 기간제교원 인력풀 등재자 중 채용 인원의 2배수 이상을 조회·선정하여 면접 등을 실시한 후 채용(6개월 미만 임용)');
    } else {
      push('BODY3', 'L1', '가. 공고 생략 채용: 결원 기간이 1개월 미만으로 공고 기간을 운영할 수 없어, 교원인사자문위원회를 통해 대상자 면접 등 적부 심사 후 채용');
    }
    push('BODY3', 'L0', '2. 전형 방법');
    push('BODY3', 'L1', `가. 서류심사${notice ? '' : '(생략 가능)'}`);
    push('BODY3', 'L2', '1) 대상: 지원자 전원');
    push('BODY3', 'L2', `2) 심사일시: ${kd(f.docReview || f.docAnnounce, true)}`);
    push('BODY3', 'L2', `3) 심사장소: ${f.place || '교무회의실'}`);
    push('BODY3', 'L2', '4) 심사위원: 채용심사위원회');
    push('BODY3', 'L2', '5) 심사영역 및 배점');

    push('BODY4', 'L2', `6) 심사결과 및 통보: 선발인원의 ${f.multiple || 3}배수 선발, 개별 통보(유선전화 및 문자)`);
    push('BODY4', 'L2', Number(f.returnDays) === 0
      ? '7) 응시 서류는 전자우편으로만 접수하므로 「채용절차의 공정화에 관한 법률」 제11조제1항 단서에 따라 반환 대상이 아니며, 개인정보 보유기간이 지나면 「개인정보 보호법」 제21조에 따라 파기함'
      : `7) 최종 채용 여부가 확정된 날 이후 ${f.returnDays || 14}일 이내에 「채용절차의 공정화에 관한 법률」에 따른 채용서류 반환 청구가 없으면 「개인정보 보호법」 제21조에 따라 파기함`);
    push('BODY4', 'L1', `나. 면접심사${f.demo ? '(및 수업실연)' : ''}`);
    push('BODY4', 'L2', '1) 대상: 서류심사 합격자');
    push('BODY4', 'L2', `2) 내용 및 방법: 기 제출한 자기소개서(직무수행계획, 업무추진실적 등)를 바탕으로 개인별 면접${f.demo ? ' 및 수업 시연' : ''} 실시`);
    push('BODY4', 'L2', `3) 심사일시: ${kd(f.interviewDate, true)} ${f.interviewTime || ''}`);
    push('BODY4', 'L2', `4) 심사장소: ${f.place || '교무회의실'}`);
    push('BODY4', 'L2', '5) 심사위원: 채용심사위원회');
    push('BODY4', 'L2', '6) 심사영역 및 배점');

    if (f.demo) push('BODY5', 'NOTE', '※ 수업실연: 수업계획의 적절성, 수업 구상 능력, 발음 및 발문 능력, 태도 및 동작의 적절성 각 10점(계 40점)');
    push('BODY5', 'L1', '다. 최종 합격자 결정');
    push('BODY5', 'L2', `1) 서류심사 성적(${dSum}점) 및 면접심사 성적(${iSum}점)${f.demo ? ', 수업실연 성적(40점)' : ''}을 합산한 점수의 고득점자 순으로 선발`);
    push('BODY5', 'L2', '2) 합격선에 동점자가 있을 경우 면접 고득점자, 서류전형 고득점자, 면접 평가 요소 중 교과 전문성 고득점자 순으로 결정');
    push('BODY5', 'L2', '3) 서류심사, (수업실연) 및 면접 중 하나라도 배점의 40% 미만 득점하였거나, 총점 60% 미만을 득점하였을 경우 불합격 처리');
    push('BODY5', 'L2', '4) 합격자 선정 취소');
    ['응시자격 제한자 또는 임용 결격자', '졸업예정자로서 합격된 자가 계약 이전까지 교원자격증을 취득하지 못한 자', '각종 증명서류를 위·변조하거나, 제출 서류의 내용이 사실과 다른 자',
      '공무원채용 신체검사에서 불합격 판정을 받은 자', '성범죄경력 및 아동학대 관련 범죄전력 조회 결격자'].forEach((t, i) => push('BODY5', 'L3', `${LET[i]}) ${t}`));
    push('BODY5', 'L2', '5) 심사 결과에 따라 임용 예정자를 학교장에게 추천(심사결과 1, 2순위자)하고 결격사유 확인');
    push('BODY5', 'L2', '6) 학교장 결재 후 채용 대상자에게 결정 통지');
    push('BODY5', 'L0', '');
    push('BODY5', 'H', 'Ⅴ. 채용심사위원회 구성');
    push('BODY5', 'NOTE', '- 교원인사자문위원회 등 활용하여 구성 가능(3~5인으로 구성)');
    push('BODY6', 'NOTE', '※ 일정에 따라 심사위원은 변경될 수 있음.');

    const sched = notice ? [
      ['채용 공고', kd(f.noticeDate, true), ''],
      ['원서 접수', `${kd(f.noticeDate, true)} ~ ${kd(f.recvEnd, true)}`, f.recvMethod || '이메일, 우편, 방문 접수'],
      ['서류전형 합격자 발표', kd(f.docAnnounce, true), `개별 통지(${f.multiple || 3}배수)`],
      ['면접심사', `${kd(f.interviewDate, true)} ${f.interviewTime || ''}`.trim(), ''],
      ['최종합격자 발표', kd(f.finalAnnounce, true), '개별 통지'],
      ['최종합격자 서류제출', `~ ${kd(f.submitEnd, true)}`, ''],
      Number(f.returnDays) === 0 ? ['채용서류 반환', '해당 없음', '전자우편 접수'] : ['채용서류 반환', `채용 확정 후 ${f.returnDays || 14}일 이내`, '청구 시'],
    ] : [
      [f.method === 'pool' ? '인력풀 조회·대상자 선정' : '대상자 선정', kd(f.noticeDate, true), f.method === 'pool' ? '2배수 이상' : ''],
      ['면접(적부 심사)', `${kd(f.interviewDate, true)} ${f.interviewTime || ''}`.trim(), f.method === 'pool' ? '' : '인사자문위원회'],
      ['결격사유·범죄경력 조회', '', ''],
      ['최종 확정·통지', kd(f.finalAnnounce, true), ''],
      ['서류 제출·계약', `~ ${kd(f.submitEnd, true)}`, ''], ['', '', ''], ['', '', ''],
    ];
    const vars = {
      typeLabel: f.typeLabel, subject: subj(f), count: String(f.count || 1), periodText: periodText(f) + (f.months ? `, ${f.months}개월` : ''), reasonText: f.reasonText,
      dp1: ds[0], dp2: ds[1], dp3: ds[2], dp4: ds[3], dpSum: dSum, ip1: is[0], ip2: is[1], ip3: is[2], ip4: is[3], ipSum: iSum,
    };
    sched.forEach((r, i) => { vars['s' + (i + 1)] = r[0]; vars['d' + (i + 1)] = r[1]; vars['n' + (i + 1)] = r[2]; });
    const cn = Math.min(5, Math.max(3, n(f.judges) || 3));
    for (let i = 1; i <= cn; i++) { vars['cp' + i] = i === 1 ? (f.chairPos || '교감') : (f.memberPos || '교사'); vars['cm' + i] = '○○○'; }
    return { bodies: B, vars, template: `plan_${cn}` };
  }

  /* ---------- 채용 공고문(참고자료 4) ---------- */
  function noticeDoc(f) {
    const B = { BODY: [], BODY2: [] }, p = (k, s, t) => B[k].push(L(s, t));
    const year = (f.cStart || '').slice(0, 4);
    p('BODY', 'L0', `${year}학년도 ${f.schoolName} ${eul(f.typeLabel)} 다음과 같이 공고합니다.`);
    p('BODY', 'L0', '');
    p('BODY', 'L0', '1. 전형 내용');
    p('BODY', 'L1', `가. 인원 및 교과: ${subj(f)} ${f.count || 1}명`);
    p('BODY', 'L1', `나. 채용 기간: ${periodText(f)}` + (f.months ? ` (${f.months}개월)` : ''));
    p('BODY', 'L1', '다. 응모 자격 및 지원 자격');
    p('BODY', 'L3', ageLine(f));
    p('BODY', 'L3', `◦ 자격: ${f.certReq}` + (/학교급|유사/.test(f.expandText) ? `(2차 공고 자격 확대: ${f.expandText.split(', ').filter(x => /학교급|유사/.test(x)).join(', ')} 포함)` : ''));
    p('BODY', 'L3', '◦ 채용의 제한');
    ['「국가공무원법」 제33조에 의한 결격 사유에 해당되는 자', '「교육공무원법」 제10조의3(채용의 제한) 제1항 및 제10조의4에 해당하는 자',
      '「아동·청소년의 성보호에 관한 법률」 제56조 제1항 해당자', '채용비리와 관련하여 임용계약이 해지된 경우가 있는 자',
      /명예퇴직/.test(f.expandText) ? '퇴직일로부터 2년이 경과하지 않은 명예퇴직 교원(이번 2차 공고는 1차 공개채용 적격자가 없어 응모 가능)' : '퇴직일로부터 2년이 경과하지 않은 명예퇴직 교원(단, 1차 공개채용 모집에도 적격한 지원자가 없을 경우 2차 공개채용부터 임용 가능)',
      '성추행, 성폭행 등 성비위에 연루되거나 성비위 관련으로 계약해지된 자', '「아동복지법」 제29조의3에 따라 아동학대 관련 범죄로 형 또는 치료감호를 선고받고 확정된 사람으로서 취업제한명령을 선고받고 그 기간이 경과하지 않은 사람',
      '기타 관계 법령에 의하여 임용에 결격 사유가 있는 자'].concat(f.mid ? ['중등학교의 경우 자녀가 재학 중인 자'] : []).forEach(t => p('BODY', 'L3', '  - ' + t));
    p('BODY', 'L1', '라. 보수 및 복무: 경상북도교육청의 「계약제교원 운영 지침」에 의함');
    p('BODY', 'L0', '');
    p('BODY', 'L0', '2. 전형방법');
    p('BODY', 'L1', '가. 1차 시험: 서류전형');
    p('BODY', 'L1', `나. 2차 시험: 면접${f.demo ? ' 및 수업실연' : ''}(서류전형 합격자에 한하여 개별 통보)`);
    p('BODY', 'L0', '');
    p('BODY', 'L0', '3. 제출서류');

    p('BODY2', 'NOTE', '* 마약류 관련 서류는 유효기간이 1년이며, 국가건강검진에 마약류 검사를 포함한 검진 결과 인정 가능');
    p('BODY2', 'NOTE', '** 신체검사 시 흉부 X-선 촬영을 실시한 경우 결핵검진 실시로 간주, 잠복결핵감염검진(혈액검사)은 최초 1회만 실시하며, 이후 채용 계약 시 추가 검진 불필요');
    p('BODY2', 'L0', '');
    p('BODY2', 'L0', '4. 서류접수 및 전형일정');
    p('BODY2', 'L1', '가. 원서접수');
    p('BODY2', 'L3', `◦ 접수기간: ${kd(f.noticeDate, true)} ~ ${kd(f.recvEnd, true)}`);
    p('BODY2', 'L3', `◦ 접수방법: ${f.recvMethod || '방문접수, 우편접수, 이메일접수'}`);
    p('BODY2', 'L3', `◦ 접수처: ${f.recvPlace || f.schoolName + ' 행정실'}`);
    p('BODY2', 'L1', `나. 1차: 서류전형 합격자 발표(개별 전화 통지) 예정일: ${kd(f.docAnnounce, true)}`);
    p('BODY2', 'L1', `다. 2차: 면접(서류심사 합격자에 한함) 예정일: ${kd(f.interviewDate, true)} ${f.interviewTime || ''}`.trim());
    p('BODY2', 'L3', '◦ 면접일시 및 장소는 서류전형 합격자에게만 개별 통보');
    p('BODY2', 'L0', '');
    p('BODY2', 'L0', '5. 합격자 발표');
    p('BODY2', 'L3', `◦ 최종합격자 발표: ${kd(f.finalAnnounce, true)} 개별 통보`);
    p('BODY2', 'NOTE', '※ 상기 일정은 진행 상황에 따라 변경될 수 있음');
    p('BODY2', 'L0', '');
    p('BODY2', 'L0', '6. 유의사항');
    [Number(f.returnDays) === 0
      ? '응시 서류는 전자우편으로만 접수하며, 「채용절차의 공정화에 관한 법률」 제11조제1항 단서에 따라 반환하지 않습니다. 제출된 서류는 개인정보 보유기간이 지나면 파기합니다.'
      : `접수된 서류는 「채용절차의 공정화에 관한 법률」에 따라 응시자 본인이 채용서류 반환청구서를 작성·제출한 경우에 한하여 반환함. 단, 반환 청구는 최종합격자 발표(채용 여부 확정) 후 ${f.returnDays || 14}일 이내 가능하며, 반환 청구기간 이후에 반환되지 않은 서류는 파기합니다.`,
      '기재사항이 사실과 다르거나 허위로 작성된 경우는 합격을 취소합니다.',
      '제출서류의 기재 착오, 누락, 서류 미제출, 연락 불능 등으로 인한 불이익은 모두 응시자 책임으로 합니다.',
      '최종합격자로 발표된 이후에도 결격 사유가 있는 자는 합격을 취소하며, 기타 공고되지 아니한 사항은 우리 학교의 결정에 따릅니다.',
      `기타 자세한 사항은 ${f.schoolName}(☎${f.tel || '○○○-○○○○'})로 문의하시기 바랍니다.`].forEach(t => p('BODY2', 'L3', '◦ ' + t));

    const finalDocs = ['사. 성범죄 및 아동학대관련 범죄경력 조회 동의서 1부', '아. 행정정보 공동이용 사전동의서 1부', '자. 마약류 중독자 여부 판별 결과 통보서 1부(유효기간 1년)*',
      '차. 결핵검진 및 잠복결핵감염검진확인서**(신규채용 후 1개월 이내)', '카. 공무원 채용신체검사서 1부(유효기간 1년) - 일반건강검진 결과통보서 또는 채용 건강검진 대체통보서로 대체 가능',
      '타. 호봉획정을 위한 경력합산 신청서 1부', '파. 서약서 1부', '하. 근무실적 평가 동의서 1부(3개월 이상)', '거. 개인정보 수집·이용 동의서(서식)', '너. (해당자) 주민등록표 초본 또는 병적증명서 1부'];
    return {
      bodies: B, lists: { finalDocs },
      vars: { typeLabel: f.typeLabel + (f.round === '2차' ? '(2차)' : ''), year, noticeNo: '00', noticeDate: kd(f.noticeDate) },
    };
  }

  /* ---------- 계약서(서식 14, 15) ---------- */
  function contractDoc(f) {
    const months = n(f.months);
    const hourly = f.typeLabel === '시간강사';
    const vars = {
      typeLabel: f.typeLabel, cStart: ymd(f.cStart), cEnd: ymd(f.cEnd), grade: f.grade || '    ', payDay: f.payDay || '    ',
      holidayPay: f.holidayPay === 'no' ? '지급하지 아니한다' : '지급한다', hoursPerDay: f.hoursPerDay || '8', daysPerWeek: f.daysPerWeek || '5',
      sickDays: String(f.sickDays !== undefined && f.sickDays !== '' ? f.sickDays : Math.floor(months / 12 * 60)),
      art14: months >= 3 ? '제14조(연수) “근로자”는 계약 기간 동안 반드시 경상북도교육청연수원에서 개설하는 ‘법정의무교육(원격)’을 이수하여야 한다.' : '제14조(연수) 3개월 미만 계약으로 해당 없음.',
      art15: months >= 3 ? '제15조(평가) “근로자”는 임용 기간이 3개월 이상인 경우에는 학교장이 실시하는 평가를 받아야 한다.' : '제15조(평가) 3개월 미만 계약으로 학교 여건에 따라 자율 평가(평가 시 동의서 징구).',
      contractDate: ymd(f.contractDate), subject: subj(f, '○○교과'), workDays: f.workDays || '월요일 ~ 금요일', totalHours: f.totalHours || '    ',
      hourlyRate: f.hourlyRate || '25,000',
    };
    return { vars, template: hourly ? 'contract_hourly' : 'contract' };
  }

  /* ---------- 임용사항 보고(서식 21) ---------- */
  function reportDoc(f) {
    const b1 = [L('L0', '1. 관련: 「경상북도교육감 행정권한의 위임에 관한 규칙」 제6조제3호'),
      L('L0', '2. 위 규정에 의거 아래와 같이 기간제교원 임용사항을 보고합니다.'),
      L('L1', '가. 임용사항')];
    const b2 = [L('NOTE', '※ 퇴직일로부터 2년이 경과하지 않은 명예퇴직 교원은 1차 공개채용 후 지원자가 없을 경우 임용 가능하며, 공고 횟수 반드시 기재'),
      L('L0', ''), L('L1', '나. 성범죄경력, 아동학대관련범죄 전력 조회 여부 및 결격사유 조회 결과')];
    const b3 = [L('NOTE', '* 성범죄경력 조회: 아동·청소년의 성보호에 관한 법률 제56조, 같은 법 시행령 제25조 / 아동학대관련범죄 전력 조회: 아동복지법 시행령 제26조의5 / 마약류 중독자 여부: 교육공무원법 제10조의4'),
      L('L0', ''), L('ATT', '붙임  호봉획정표 1부.  끝.')];
    return {
      bodies: { BODY: b1, BODY2: b2, BODY3: b3 },
      vars: {
        receiver: f.receiver || '○○교육지원청교육장', title: '기간제교원 임용사항 보고',
        certType: f.certType || '', subject: subj(f, ''), periodText: `${kd(f.cStart)}~\n${kd(f.cEnd)}`, reasonText: f.reasonText,
        grade: f.grade || '', retiredYN: f.retiredYN || '', retireKind: f.retireKind ? `${f.retireKind}${f.retireDate ? '\n(' + kd(f.retireDate) + ')' : ''}` : '', noticeCount: f.noticeCount || '',
      },
    };
  }

  const api = { schedule, hireDefaults, planGian, planDoc, noticeDoc, contractDoc, reportDoc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Docs2 = api;
})(this);
