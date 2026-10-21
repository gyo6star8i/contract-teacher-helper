/* 판별 결과 → 공문 문구 생성 */
(function (root) {
  'use strict';
  const R = root.Rules || (typeof require !== 'undefined' ? require('./rules.js') : null);
  const LETTERS = '가나다라마바사아자차카타파하'.split('');
  const { kdate } = R;

  function ctx(r, inp) {
    const vacancy = (inp.target || '').trim() || '○학년 ○반 담임교사';
    const leave = R.leaveLabel(inp);
    let type = r.type, from = r.start, to = r.end, expanded = r.expanded;
    if (r.route === 'two_step') { type = '전일제강사'; from = r.stepA.from; to = r.stepA.to; expanded = r.stepAExpanded; }
    const exps = (r.route === 'two_step' && !expanded) ? [] : r.expansions.map(e => e.replace(/\(.*\)/, '').trim());
    return { vacancy, leave, type, from, to, expanded, exps, period: `${kdate(from)} ~ ${kdate(to)}`, vacPeriod: `${kdate(r.start)} ~ ${kdate(r.end)}` };
  }

  function defaults(r, inp) {
    const c = ctx(r, inp);
    const expStr = c.exps.length ? `자격 확대(${c.exps.join(', ')})` : '';
    let title, agenda;
    switch (r.route) {
      case 'gangsa_skip':
        title = '단기간 결원 발생(1개월 미만)으로 인한 계약제교원 채용 심의를 위한 인사자문위원회 개최';
        agenda = '단기간 결원 발생(1개월 미만)으로 인한 계약제교원(' + c.type + ') 채용 심의'; break;
      case 'gangsa_urgent_expand': case 'two_step':
        title = `${c.vacancy} ${c.leave}에 따른 긴급 결원 보충 계약제교원 채용 심의를 위한 인사자문위원회 개최`;
        agenda = `긴급 결원 보충을 위한 계약제교원(${c.type})` + (expStr ? ` ${expStr} 공고 생략` : ' 공고 생략') + ' 채용 심의'; break;
      case 'gigan_2nd_expand': case 'gangsa_2nd_expand':
        title = `${c.vacancy} ${c.leave}에 따른 계약제교원 2차 공개채용 자격 확대 심의를 위한 인사자문위원회 개최`;
        agenda = `계약제교원(${c.type}) 2차 공개채용 ${expStr || '자격 확대'} 심의`; break;
      case 'gigan_extend':
        title = '기간제교원 연장 계약 심의를 위한 인사자문위원회 개최';
        agenda = `${c.vacancy} ${c.leave} 연장에 따른 기간제교원 연장 계약 심의`; break;
      default:
        title = `${c.vacancy} ${c.leave}에 따른 계약제교원 채용 심의를 위한 인사자문위원회 개최`;
        agenda = `계약제교원(${c.type}) 채용 심의`;
    }

    const reasons = [`결원 사유: ${c.vacancy} ○○○ 선생님의 ${c.leave}(${c.vacPeriod})`];
    if (inp.noticeStage !== 'none') reasons.push('1차 공개채용 결과 적격한 지원자 없음');
    if (r.route === 'gangsa_urgent_expand' || r.route === 'two_step')
      reasons.push(`근무 예정일이 공고일로부터 4일 이내로 공고 기간(공고일 제외 3일 이상)을 운영할 수 없어 수업 결손 및 생활지도 공백이 우려됨`);
    if (r.route === 'gangsa_skip') reasons.push('결원 기간이 1개월 미만으로 공고 기간을 운영할 수 없어 수업 결손이 우려됨');
    if (r.route === 'gigan_extend') reasons.push('동일 결원이 기간 단절 없이 연장되었으며 기존 근무자가 연장을 희망함');
    if (c.exps.length) reasons.push(`채용 예정자 ${c.exps.join(', ')}에 해당하여 자격 확대 필요`);

    const basis = {
      gangsa_skip: ['2026 계약제교원 운영 지침 Ⅱ-2-바-2): 1개월 미만의 결원 보충 시, 교육과정 운영상 공고 기간을 운영할 수 없는 부득이한 경우 채용 공고 생략 가능. 교원인사자문위원회 등을 통해 대상자 면접 등 적부 심사 후 채용'],
      gangsa_urgent_expand: ['2026 계약제교원 운영 지침 Ⅱ-2-바-4): 갑작스러운 결원 발생으로 근무 예정일이 공고일로부터 4일 이내인 경우에 한하여, 인사자문위원회 자문을 받아 자격을 확대(연령, 과목, 명예퇴직 2년 미만자 포함)하여 공고 없이 채용 가능(인사자문위원회 회의록 구비)'],
      two_step: ['2026 계약제교원 운영 지침 Ⅱ-2-바-4): 근무 예정일이 공고일로부터 4일 이내인 경우에 한하여 인사자문위원회 자문을 받아 자격을 확대하여 공고 없이 강사 채용 가능(단, 채용 기간이 1개월을 넘는 기간제교원 채용은 불가)', '2026 계약제교원 운영 지침 Ⅱ-1-마-2): 1차 공개 채용 모집에도 적격한 지원자가 없는 경우, 2차 공개 채용 모집부터 자격 확대 가능'],
      gigan_2nd_expand: ['2026 계약제교원 운영 지침 Ⅱ-1-마-2): 1차 공개 채용 모집에도 적격한 지원자가 없는 경우, 2차 공개 채용 모집부터 자격 확대(퇴직자, 학교급 불일치, 유사과목) 가능(인사자문위원회 회의록 반드시 구비)'],
      gangsa_2nd_expand: ['2026 계약제교원 운영 지침 Ⅱ-2-바-3): 자격 확대(연령, 과목 등)가 필요한 경우에는 기간제교원과 동일하게 2차 공개채용 모집부터 채용 가능'],
      gigan_extend: ['2026 계약제교원 운영 지침 Ⅱ-1-바-7): 동일 기관에서 동일 교원(교과) 결원이 기간 단절 없이 연장될 때, 기존 근무자가 희망하는 경우 인사자문위원회 자문을 받아 새로운 채용 절차 없이 연장 계약 가능(회의록 구비)'],
    }[r.route] || ['2026 계약제교원 운영 지침(경상북도교육청, 2026. 2.)'];

    const plan = r.route === 'two_step' ? [
      `1단계(긴급): ${kdate(r.stepA.from)} ~ ${kdate(r.stepA.to)}, 전일제강사, 인사자문위원회 자문 후 공고 생략 채용`,
      `2단계: ${kdate(r.stepB.from)} ~ ${kdate(r.stepB.to)}, ${r.stepB.isGigan ? '기간제교원' : '강사'}, ` + (inp.noticeStage === 'none' ? '1차 공고 후 적격자 없으면 2차 공고(자격 확대)' : '2차 공개채용 공고(자격 확대) 후 서류·면접 심사'),
    ] : [];

    const notes = [];
    if (c.expanded || r.route === 'two_step') notes.push('자격 확대로 채용된 자는 연장 계약 불가(결원 연장 시 원 자격 기준으로 다시 공개 채용)');
    if (r.route === 'two_step') notes.push('강사 임용 기간을 소급하여 기간제교원으로 전환 임용할 수 없음(교육공무원임용령 제5조, 계약제교원 운영 관련 Q&A 16)');
    if (c.exps.some(e => e.includes('연령'))) notes.push('임용 상한 연령: 임용일 기준 만 70세 생일이 지나지 않은 자(만 70세 생일이 포함된 학기 말까지 임용 가능)');
    if (c.type !== '기간제교원') notes.push('1개월 미만 강사는 서약서(<서식 23>)로 결격사유 없음을 본인 확인하고 성범죄경력 및 아동학대 관련 범죄전력 조회 실시');
    else notes.push('채용 확정 전 결격사유·성범죄·아동학대 관련 범죄경력 통합조회 실시');
    if (['honor', 'age', 'pension'].includes(inp.retire) && (c.type === '기간제교원' || r.route === 'two_step')) notes.push('퇴직교원(명예퇴직·정년퇴직·연금수령자)을 기간제교원으로 임용 시 호봉은 14호봉을 넘지 못함');

    const minutes = [];
    if (inp.noticeStage !== 'none') minutes.push('1차 공개채용 모집에 적격한 지원자가 없었음.');
    if (r.route === 'gangsa_urgent_expand' || r.route === 'two_step')
      minutes.push('근무 예정일이 공고일로부터 4일 이내로 공고 기간을 운영할 수 없어, 담임 부재에 따른 수업 결손 및 생활지도 공백을 막기 위해 긴급 채용이 필요함.');
    if (r.route === 'gangsa_skip') minutes.push('결원 기간이 1개월 미만으로 공고 기간을 운영할 수 없어 적부 심사를 통해 채용함.');
    if (c.exps.length) minutes.push(`2026 계약제교원 운영 지침에 따라 자격을 확대(${c.exps.join(', ')})하여 채용할 수 있으며, 채용 예정자는 임용 상한 연령(만 70세) 미만에 해당함.`.replace(/, 채용 예정자는 임용 상한 연령\(만 70세\) 미만에 해당함/, c.exps.some(e => e.includes('연령')) ? ', 채용 예정자는 임용 상한 연령(만 70세) 미만에 해당함' : ''));
    if (r.route === 'gigan_extend') minutes.push('계약 기간 동안 성실히 근무하였으며, 동일 결원이 기간 단절 없이 연장되어 학급 운영의 연속성을 위해 연장 계약이 바람직함.');
    if (['honor', 'age'].includes(inp.retire)) minutes.push('교직 경력이 풍부한 퇴직 교원으로 학생의 특성을 잘 이해하여 학습지도 및 생활지도를 잘 할 것으로 판단함.');
    else minutes.push('학생의 특성을 잘 이해하여 학습지도 및 생활지도를 잘 할 것으로 판단함.');
    minutes.push('경력조회 결과 결격사유 없음.');
    minutes.push('교원이 갖추어야 할 덕목을 잘 알고 있으며, 학생들을 잘 지도하리라 판단함.');
    minutes.push('이에 위원 전원 채용 적격으로 의견을 모음.');

    return { title, agenda, reasons, basis, plan, notes, minutes, type: c.type, period: c.period, verdict: '채용 적격' };
  }

  function lines(text) { return String(text || '').split('\n').map(s => s.trim()).filter(Boolean); }
  function letters(arr) { return arr.map((t, i) => `${LETTERS[i]}. ${t}`); }

  /* 개최 기안 본문 */
  function openBody(f) {
    const out = [];
    const rel = lines(f.related);
    out.push({ s: 'L0', t: '1. 관련' });
    letters(rel).forEach(t => out.push({ s: 'L1', t }));
    out.push({ s: 'L0', t: `2. ${f.title.replace(/ 개최$/, '')}를 아래와 같이 개최하고자 합니다.` });
    const items = [];
    items.push([`일시: ${f.datetime}`]);
    items.push([`장소: ${f.place}`]);
    items.push([`참석대상: 위원장 1명, 위원 ${f.members - 1}명`]);
    items.push([`안건: ${f.agenda}`]);
    const subs = [['사유', lines(f.reasons)], ['근거', lines(f.basis)], ['채용 개요', lines(f.plan)], ['유의 사항', lines(f.notes)]];
    subs.forEach(([h, arr]) => { if (arr.length) items.push([h, arr]); });
    items.forEach((it, i) => {
      out.push({ s: 'L1', t: `${LETTERS[i]}. ${it[0]}` });
      if (it[1]) it[1].forEach((t, j) => out.push({ s: 'L2', t: `${j + 1}) ${t}` }));
    });
    out[out.length - 1].t += '  끝.';
    return out;
  }

  /* 결과 기안 본문 */
  function resultBody(f) {
    const out = [];
    const rel = lines(f.related).concat(f.openRef ? [f.openRef] : []);
    out.push({ s: 'L0', t: '1. 관련' });
    letters(rel).forEach(t => out.push({ s: 'L1', t }));
    out.push({ s: 'L0', t: `2. ${f.title.replace(/ 개최$/, '')} 개최 결과가 붙임과 같습니다.` });
    const it = [
      `일시: ${f.datetime}`,
      `참석 인원: 인사자문위원(위원장 1명, 위원 ${f.members - 1}명)`,
      `안건: ${f.agenda}`,
      `사유: ${lines(f.reasons)[0] ? lines(f.reasons)[0].replace(/^결원 사유:\s*/, '') : ''}`,
      `심의 결과: ${f.verdict}`,
      `계약제교원: ${f.type} ○○○(${f.period})`,
    ];
    letters(it).forEach(t => out.push({ s: 'L1', t }));
    out.push({ s: 'L0', t: '' });
    out.push({ s: 'ATT', t: '붙임  인사자문위원회 회의록 1부.  끝.' });
    return out;
  }

  function minutesList(f) {
    const reasonsLine = lines(f.reasons)[0] ? lines(f.reasons)[0].replace(/^결원 사유:\s*/, '') : '';
    return [`1. 사유: ${reasonsLine}`, '', '2. 결과:'].concat(lines(f.minutes).map(t => ` - ${t.replace(/^-\s*/, '')}`));
  }

  const api = { defaults, openBody, resultBody, minutesList, lines };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Docs = api;
})(this);
