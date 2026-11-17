(function () {
  'use strict';
  const H = window.Hobong, O = window.Ocr;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let rows = [];
  let images = [];
  let mode = 'ai';
  let last = null;

  /* ---------- 선택 목록 ---------- */
  $('#cert').innerHTML = H.CERT.map(([n, v], i) => `<option value="${i}">${n} — ${v}호봉</option>`).join('');
  $('#edu').innerHTML = H.EDU.map(([n, v]) => `<option value="${v}">${n} (${v}년)</option>`).join('');
  const groups = [...new Set(H.CAREER.map(c => c.g))];
  const kindOptions = groups.map(g => `<optgroup label="${{ 교원: '1. 교원 경력', 공무원: '2. 교원 외 공무원·군', 유사: '3. 유사경력', 그밖: '3.라 그 밖의 경력', 휴직: '휴직 등', 직접: '기타' }[g]}">` +
    H.CAREER.filter(c => c.g === g).map(c => `<option value="${c.k}">${c.label}${c.rate != null ? ' (' + c.rate + '%)' : ''}</option>`).join('') + '</optgroup>').join('');
  $('#lawCert').innerHTML = '<table class="law"><tr><th>자격</th><th>기산호봉</th></tr>' + H.CERT.map(([n, v]) => `<tr><td>${n}</td><td>${v}</td></tr>`).join('') + '</table><p class="hint">교장·원장·교감·원감·교육장·장학관·교육연구관·장학사·교육연구사는 정교사(1급) 호봉 적용</p>';
  $('#lawCareer').innerHTML = '<table class="law"><tr><th>경력</th><th>환산율</th><th>근거</th></tr>' + H.CAREER.filter(c => c.k !== 'custom').map(c => `<tr><td>${c.label}</td><td>${c.rate == null ? '근무시간 비례(30~100%)' : c.rate + '%'}</td><td>${c.ref}</td></tr>`).join('') + '</table><p class="hint">"이내"로 정한 경력은 예규 기준에 따라 낮게 인정될 수 있으니 환산율 칸에서 조정하세요. 채용 직종과 상통하는 분야 경력은 교육부장관 협의로 100%까지 상향 가능(비고1, 보건·영양·사서·전문상담교사 등).</p>';

  /* ---------- 경력 표 ---------- */
  const blank = () => ({ start: '', end: '', content: '', kind: 'teacher', rate: '', weekly: '', totalHours: '', mismatch: false, note: '' });
  function renderRows() {
    const tb = $('#careers tbody');
    tb.innerHTML = rows.map((r, i) => {
      const g = r.kind === 'gangsa';
      return `<tr data-i="${i}">
        <td><input type="date" data-k="start" value="${esc(r.start)}"></td>
        <td><input type="date" data-k="end" value="${esc(r.end)}"></td>
        <td><input data-k="content" value="${esc(r.content)}" placeholder="○○초(기간제)"><div class="x" data-x="note">${esc(r.note || '')}</div></td>
        <td><select data-k="kind">${kindOptions}</select><div class="x" data-x="ref"></div></td>
        <td>${g ? '<div class="x" data-x="rate">자동</div><label class="chk" style="font-size:12px"><input type="checkbox" data-k="mismatch"' + (r.mismatch ? ' checked' : '') + '>불일치 80%</label>'
          : `<input type="number" data-k="rate" min="0" max="100" value="${esc(r.rate)}" placeholder="기본">`}</td>
        <td><input type="number" data-k="weekly" min="0" step="0.5" value="${esc(r.weekly)}" placeholder="주당 h">${g ? `<input type="number" data-k="totalHours" min="0" value="${esc(r.totalHours)}" placeholder="또는 총 h" style="margin-top:3px">` : ''}</td>
        <td class="num" data-x="period"></td><td class="num" data-x="used"></td>
        <td><button class="del sm" data-del="${i}" type="button" title="삭제">✕</button></td></tr>`;
    }).join('') || '<tr><td colspan="9" class="hint" style="text-align:center;padding:14px">경력을 추가하거나 경력증명서를 인식시키세요.</td></tr>';
    rows.forEach((r, i) => { const s = tb.querySelector(`tr[data-i="${i}"] select`); if (s) s.value = r.kind; });
    update();
  }
  $('#careers').addEventListener('input', e => {
    const tr = e.target.closest('tr[data-i]'); if (!tr) return;
    const r = rows[+tr.dataset.i], k = e.target.dataset.k; if (!k) return;
    r[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (k === 'kind') { r.rate = ''; renderRows(); } else update();
  });
  $('#careers').addEventListener('click', e => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    rows.splice(+b.dataset.del, 1); renderRows();
  });
  $('#addRow').onclick = () => { const p = rows[rows.length - 1]; const r = blank(); if (p && p.end) { const d = H.addDays(H.D(p.end), 1); r.start = H.iso(d); } rows.push(r); renderRows(); };
  $('#addGrad').onclick = () => { rows.push({ ...blank(), kind: 'grad', content: '대학원 석사학위 취득(학칙 최저 수업연한)', note: '입학일부터 2년(학칙상 수업연한) — 경력과 겹치면 유리한 하나만' }); renderRows(); };
  $('#clearAll').onclick = () => { if (confirm('입력한 경력을 모두 지울까요?')) { rows = []; renderRows(); } };
  $('#sample').onclick = () => {
    $('#reason').value = '호봉재획정'; $('#date').value = '2026-03-01'; $('#cert').value = '0'; $('#edu').value = '16'; $('#sabeom').checked = true;
    $('#org').value = '경북초등학교'; $('#name').value = '홍길동'; $('#pos').value = '초등교사';
    rows = [
      { ...blank(), start: '2005-04-21', end: '2007-04-20', content: '군경력(육군 병장 만기전역)', kind: 'military' },
      { ...blank(), start: '2016-03-01', end: '2016-05-19', content: '○○초(기간제)', kind: 'teacher' },
      { ...blank(), start: '2016-05-20', end: '2025-07-25', content: '○○초, ○○초, ○○초', kind: 'teacher' },
      { ...blank(), start: '2025-07-26', end: '2026-02-28', content: '육아휴직(첫째)', kind: 'leave' },
    ];
    renderRows();
  };

  /* ---------- 입력 저장/불러오기 (파일로만, 브라우저 저장 안 함) ---------- */
  const formIds = ['reason', 'date', 'org', 'name', 'cert', 'pos', 'curGrade', 'edu', 'sabeom', 'special', 'sabeomShort', 'extraAdj', 'limit14', 'pre97', 'wPos', 'wName', 'cPos', 'cName'];
  const getState = () => ({ v: 1, form: Object.fromEntries(formIds.map(id => [id, $('#' + id).type === 'checkbox' ? $('#' + id).checked : $('#' + id).value])), rows });
  function applyState(d) {
    formIds.forEach(id => { if (d.form && id in d.form) { const el = $('#' + id); if (el.type === 'checkbox') el.checked = !!d.form[id]; else el.value = d.form[id]; } });
    rows = (d.rows || []).map(r => ({ ...blank(), ...r })); syncSpecial(); renderRows();
  }
  $('#saveXlsx').onclick = async () => {
    if (!last) return;
    const cert = H.CERT[+$('#cert').value];
    const eduName = (H.EDU.find(e => e[1] === +$('#edu').value) || [''])[0];
    const info = { reason: $('#reason').value, org: $('#org').value, name: $('#name').value, certName: cert[0], pos: $('#pos').value, curGrade: $('#curGrade').value,
      eduText: eduName + ($('#special').checked ? ' (특수)' : ''), sabeom: $('#sabeom').checked, writerPos: $('#wPos').value, writerName: $('#wName').value,
      checkerPos: $('#cPos').value, checkerName: $('#cName').value, contract: $('#reason').value === '계약제 교원 임용' };
    try {
      const blob = await window.HobongXlsx.exportXlsx(info, last, getState());
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileBase() + '.xlsx'; a.click();
    } catch (e) { alert('엑셀 저장 실패: ' + e.message); }
  };
  $('#exportJson').onclick = () => {
    const data = getState();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    a.download = fileBase() + '.json'; a.click();
  };
  $('#importJsonBtn').onclick = () => $('#importJson').click();
  $('#importJson').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      if (/\.json$/i.test(f.name)) applyState(JSON.parse(await f.text()));
      else {
        const res = await window.HobongXlsx.importXlsx(await f.arrayBuffer());
        applyState(res.state);
        $('#status').textContent = '';
        alert(res.type === 'own' ? '저장했던 호봉획정표를 그대로 불러왔습니다.' : `기존 호봉획정표에서 기본 정보와 경력 ${res.state.rows.length}건을 불러왔습니다.\n경력 구분·환산율·학력을 한 번 확인하세요.`);
      }
    } catch (err) { alert('불러오기 실패: ' + err.message); }
    e.target.value = '';
  };

  /* ---------- 계산 ---------- */
  function syncSpecial() { $('#shortWrap').style.display = $('#special').checked ? '' : 'none'; }
  $('#special').addEventListener('change', syncSpecial);
  document.querySelectorAll('section.card:first-of-type input, section.card:first-of-type select').forEach(el => el.addEventListener('input', update));
  $('#reason').addEventListener('change', () => { if ($('#reason').value === '계약제 교원 임용') update(); });

  function update() {
    const cert = H.CERT[+$('#cert').value];
    const inp = {
      rows, base: cert[1], eduYears: +$('#edu').value, sabeom: $('#sabeom').checked, special: $('#special').checked,
      sabeomShort: $('#sabeomShort').checked, extraAdj: $('#extraAdj').value, date: $('#date').value,
      pre97: $('#pre97').checked, limit14: $('#limit14').checked, contract: $('#reason').value === '계약제 교원 임용',
    };
    const r = last = H.calc(inp);
    $('#eduWhy').textContent = `총수학연수 ${inp.eduYears}년 − 16 = ${r.edu.base}년${r.edu.add ? ` + 가산 ${r.edu.add}년(${r.edu.why})` : ''}${r.extra ? ` + 추가 ${r.extra}년` : ''} → 가감 ${r.adj >= 0 ? '+' : ''}${r.adj}년`;
    // 행별 표시
    const tb = $('#careers tbody');
    r.rows.forEach(x => {
      const tr = tb.querySelector(`tr[data-i="${x.i}"]`); if (!tr) return;
      const v = r.valid.find(y => y.i === x.i);
      tr.querySelector('[data-x="period"]').textContent = v ? H.fmt(v.period) : '';
      tr.querySelector('[data-x="used"]').innerHTML = v ? `${H.fmt(v.used)}<div class="x">${v.ratePct}%</div>` : '';
      const ref = tr.querySelector('[data-x="ref"]'); if (ref) ref.textContent = [x.ref, ...(x.notes || [])].filter(Boolean).join(' · ');
      const rt = tr.querySelector('[data-x="rate"]'); if (rt) rt.textContent = v ? v.ratePct + '%' : '자동';
      const rin = tr.querySelector('input[data-k="rate"]'); if (rin) rin.placeholder = (H.KIND[x.kind] || {}).rate != null ? H.KIND[x.kind].rate : '%';
    });
    const nextTxt = inp.contract ? '없음(계약 기간 중 승급 없음)' : r.next ? H.kdate(r.next) : (r.capped ? '없음(상한)' : '획정일 입력');
    $('#big').innerHTML = [
      ['(17) 사정호봉', r.gradeText], ['(14) 환산 총경력', H.fmt(r.p14)], ['(15) 가감년수', (r.adj >= 0 ? '+' : '') + r.adj + '년'],
      ['(16) 호봉획정 경력', `${r.years}년 ${r.rest.m}월 ${r.rest.d}일`], ['잔여기간', `${r.rest.m}월 ${r.rest.d}일`], ['차기승급일', nextTxt],
    ].map(([a, b]) => `<div><span>${a}</span><b>${esc(b)}</b></div>`).join('');
    const cg = +$('#curGrade').value;
    const extra = [];
    if (cg && !r.capped && cg !== r.grade) extra.push({ level: 'warn', text: `현 호봉 ${cg}호봉과 ${r.grade > cg ? '+' : ''}${r.grade - cg}호봉 차이가 있습니다. 재획정·정정 사유와 경력을 다시 확인하세요.` });
    $('#msgs').innerHTML = [...r.msgs, ...extra].map(m => `<div class="msg ${m.level}">${esc(m.text)}${m.ref ? `<small>${esc(m.ref)}</small>` : ''}</div>`).join('');
    buildPrint(r, inp, cert, nextTxt);
  }

  /* ---------- 인쇄용 호봉획정표 ---------- */
  function buildPrint(r, inp, cert, nextTxt) {
    const eduName = H.EDU.find(e => e[1] === inp.eduYears)[0];
    const trs = r.valid.map(v => `<tr><td class="c">${H.kdate(v.s)}</td><td class="c">${H.kdate(v.e)}</td><td>${esc(v.content)}</td>
      <td class="c">${v.period.y}</td><td class="c">${v.period.m}</td><td class="c">${v.period.d}</td><td class="c">${v.ratePct}%</td>
      <td class="c">${v.used.y}</td><td class="c">${v.used.m}</td><td class="c">${v.used.d}</td><td style="font-size:9pt">${esc([v.usedD === 0 && v.factor > 0 ? '중복 기간(유리한 경력만 인정)' : '', v.kind === 'gangsa' ? v.notes.join(', ') : '', v.note].filter(Boolean).join(' '))}</td></tr>`).join('');
    const pad = Math.max(0, 12 - r.valid.length);
    $('#printArea').innerHTML = `<h1 class="ptitle">호 봉 획 정 표</h1>
    <table class="pf"><tr><th style="width:18%">호봉획정사유</th><td colspan="3">${esc($('#reason').value)}</td></tr>
    <tr><th>(1) 소속</th><td>${esc($('#org').value)}</td><th style="width:18%">(2) 제청(내신)자격</th><td>${esc(cert[0])}</td></tr>
    <tr><th>(4) 성명</th><td>${esc($('#name').value)}</td><th>(3) 현직위(급)</th><td>${esc($('#pos').value)}</td></tr>
    <tr><th>(5) 학력</th><td>${esc(eduName)}${inp.sabeom ? ' · 사범계' : ' · 비사범계'}${inp.special ? ' · 특수' : ''}</td><th>(6) 현호봉</th><td>${esc($('#curGrade').value)}</td></tr></table>
    <table class="pf" style="margin-top:6px"><tr><th colspan="2">(7) 경력기간</th><th rowspan="2">(8) 경력내용</th><th colspan="3">(9) 경력년수</th><th rowspan="2">(10)<br>환산율</th><th colspan="3">(11) 환산년수</th><th rowspan="2">(12) 비고</th></tr>
    <tr><th>부터</th><th>까지</th><th>년</th><th>월</th><th>일</th><th>년</th><th>월</th><th>일</th></tr>
    ${trs}${'<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'.repeat(pad)}
    <tr><th colspan="3">(13) 계</th><td class="c">${r.p13.y}</td><td class="c">${r.p13.m}</td><td class="c">${r.p13.d}</td><td></td><td class="c">${r.p14.y}</td><td class="c">${r.p14.m}</td><td class="c">${r.p14.d}</td><td></td></tr></table>
    <table class="pf" style="margin-top:6px"><tr><th>(14) 환산 총경력년수</th><th>(15) 가감년수</th><th>(16) 호봉획정 경력년수</th><th>(17) 사정호봉</th><th>호봉획정(승급)일</th><th>(18) 사정호봉에 요하는 경력년수</th></tr>
    <tr><td class="c">${H.fmt(r.p14)}</td><td class="c">${r.adj}년</td><td class="c">${r.years}년 ${r.rest.m}월 ${r.rest.d}일</td><td class="c"><b>${esc(r.gradeText)}</b></td><td class="c">${H.kdate(r.at)}</td><td class="c">${r.grade - r.base}년</td></tr></table>
    <table class="pf" style="margin-top:6px"><tr><th style="width:18%">잔여월수</th><td>${r.rest.m}월 ${r.rest.d}일</td><th style="width:18%">차기승급일</th><td>${esc(nextTxt)}</td></tr>
    <tr><th>작성자 직위(급)</th><td>${esc($('#wPos').value)}</td><th>성명</th><td style="height:34px">${esc($('#wName').value)} <span style="float:right">(인)</span></td></tr>
    <tr><th>확인자 직위(급)</th><td>${esc($('#cPos').value)}</td><th>성명</th><td style="height:34px">${esc($('#cName').value)} <span style="float:right">(인)</span></td></tr></table>
    <p style="font-size:8.5pt;margin-top:6px">근거: 공무원보수규정 제8조·별표22·23·25, 교육공무원 호봉획정시 경력환산율표의 적용 등에 관한 예규 · 경력기간 1년=12월, 1월=30일 환산, 일 미만 버림</p>`;
  }
  // 파일명: 학교명(줄임)-성명, 예) 구미초-홍길동
  function fileBase() {
    const org = $('#org').value.replace(/\s+/g, '').replace(/초등학교$/, '초').replace(/중학교$/, '중').replace(/고등학교$/, '고').replace(/유치원$/, '유');
    const nm = $('#name').value.trim();
    return ([org, nm].filter(Boolean).join('-') || '호봉획정표').replace(/[\\/:*?"<>|]/g, '');
  }
  $('#print').onclick = () => {
    const t = document.title;
    document.title = fileBase();          // 'PDF로 저장' 기본 파일명
    window.addEventListener('afterprint', () => { document.title = t; }, { once: true });
    window.print();
    setTimeout(() => { document.title = t; }, 3000);
  };
  $('#copy').onclick = async () => {
    if (!last) return;
    const t = [`사정호봉 ${last.gradeText} (기산 ${last.base} + 경력 ${last.years}년), 잔여 ${last.rest.m}월 ${last.rest.d}일, 차기승급일 ${last.next ? H.kdate(last.next) : '-'}`,
      ...last.valid.map(v => `${H.kdate(v.s)}~${H.kdate(v.e)} ${v.content}: ${H.fmt(v.period)} × ${v.ratePct}% = ${H.fmt(v.used)}`),
      `환산 총경력 ${H.fmt(last.p14)}, 가감 ${last.adj}년`].join('\n');
    try { await navigator.clipboard.writeText(t); $('#copy').textContent = '복사됨'; setTimeout(() => $('#copy').textContent = '결과 복사', 1500); } catch (e) { alert(t); }
  };

  /* ---------- 이미지 입력 ---------- */
  function addFiles(list) {
    [...list].filter(f => /^image\/|pdf$/.test(f.type)).forEach(f => images.push(f));
    renderThumbs();
  }
  function renderThumbs() {
    $('#thumbs').innerHTML = images.map((f, i) => `<div>${f.type === 'application/pdf' ? `<span class="hint" style="display:inline-block;border:1px solid var(--line);padding:30px 10px;border-radius:6px">PDF<br>${esc(f.name.slice(0, 14))}</span>` : `<img src="${URL.createObjectURL(f)}" alt="">`}<button class="del" data-rm="${i}" type="button">✕</button></div>`).join('');
    $('#runOcr').disabled = !images.length;
  }
  $('#thumbs').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { images.splice(+b.dataset.rm, 1); renderThumbs(); } });
  $('#drop').onclick = () => $('#file').click();
  $('#file').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
  ['dragover', 'dragenter'].forEach(t => $('#drop').addEventListener(t, e => { e.preventDefault(); $('#drop').classList.add('on'); }));
  ['dragleave', 'drop'].forEach(t => $('#drop').addEventListener(t, e => { e.preventDefault(); $('#drop').classList.remove('on'); }));
  $('#drop').addEventListener('drop', e => addFiles(e.dataTransfer.files));
  document.addEventListener('paste', e => {
    // 엑셀·한글에서 복사한 호봉획정표 경력 부분(글자) → 바로 후보로
    const tag = (e.target && e.target.tagName) || '';
    const txt = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
    const tbl = tag === 'INPUT' || tag === 'TEXTAREA' ? [] : O.parseTable(txt);
    if (tbl.length) {
      e.preventDefault();
      cands = tbl.map(c => ({ ...blank(), ...c }));
      showCands();
      $('#status').textContent = `복사한 표에서 경력 ${tbl.length}건을 읽었습니다(AI 사용 안 함). 확인 후 추가하세요.`;
      $('#candWrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const fs = [...(e.clipboardData || {}).items || []].filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean);
    if (fs.length) { e.preventDefault(); addFiles(fs.map((f, k) => new File([f], `붙여넣기${images.length + k + 1}.png`, { type: f.type || 'image/png' }))); $('#status').textContent = `캡처 ${fs.length}장을 붙여 넣었습니다.`; }
  });
  $('#clearImgs').onclick = () => { images = []; renderThumbs(); $('#candWrap').style.display = 'none'; $('#status').textContent = ''; };
  function setMode(m) { mode = m; $('#modeAI').classList.toggle('on', m === 'ai'); $('#modeOCR').classList.toggle('on', m === 'ocr'); $('#aiBox').style.display = m === 'ai' ? '' : 'none'; $('#ocrBox').style.display = m === 'ocr' ? '' : 'none'; }
  $('#modeAI').onclick = () => setMode('ai');
  $('#modeOCR').onclick = () => setMode('ocr');
  try { const k = localStorage.getItem('hobong.gemini'); if (k) { $('#apiKey').value = k; $('#saveKey').checked = true; } const m = localStorage.getItem('hobong.model'); if (m) $('#model').value = m; } catch (e) { /* 저장소 사용 불가 */ }
  function rememberKey() {
    try {
      if ($('#saveKey').checked) { localStorage.setItem('hobong.gemini', $('#apiKey').value.trim()); localStorage.setItem('hobong.model', $('#model').value.trim()); }
      else { localStorage.removeItem('hobong.gemini'); }
    } catch (e) { /* 무시 */ }
  }
  $('#saveKey').onchange = rememberKey;

  let cands = [];
  $('#runOcr').onclick = async () => {
    const btn = $('#runOcr'); btn.disabled = true;
    $('#status').textContent = '인식 중…';
    try {
      let res;
      if (mode === 'ai') { rememberKey(); res = await O.gemini(images, $('#apiKey').value.trim(), $('#model').value.trim(), s => { $('#status').textContent = s; }); }
      else { const t = await O.tesseract(images, s => { $('#status').textContent = 'OCR: ' + s; }); res = t.rows; if (!res.length) $('#status').textContent = '날짜 기간을 찾지 못했습니다. 인식된 글자:\n' + t.text.slice(0, 600); }
      cands = res.map(c => ({ ...blank(), ...c }));
      showCands();
      if (res.length) $('#status').textContent = `경력 ${res.length}건을 찾았습니다. 날짜·구분을 확인하고 추가하세요.`;
    } catch (e) { $('#status').textContent = '오류: ' + e.message + (mode === 'ai' ? '\n(키·모델명을 확인하거나 "브라우저 OCR"을 써 보세요.)' : ''); }
    btn.disabled = false;
  };
  function showCands() {
    $('#candWrap').style.display = cands.length ? '' : 'none';
    $('#cand').innerHTML = '<tr><th></th><th>부터</th><th>까지</th><th>경력내용</th><th>추정 구분</th><th>환산율</th><th>주당/총 시간</th><th>비고</th></tr>' +
      cands.map((c, i) => `<tr><td><input type="checkbox" data-ci="${i}" checked></td><td>${esc(c.start)}</td><td>${esc(c.end) || '<b style="color:var(--bad)">비어 있음</b>'}</td><td>${esc(c.content)}</td><td>${esc((H.KIND[c.kind] || {}).label)}</td><td>${c.rate !== '' && c.rate != null ? esc(c.rate) + '%' : ''}</td><td>${esc([c.weekly, c.totalHours].filter(Boolean).join(' / '))}</td><td>${esc(c.note)}</td></tr>`).join('');
  }
  $('#addCand').onclick = () => {
    const sel = [...document.querySelectorAll('#cand input[data-ci]')].filter(x => x.checked).map(x => cands[+x.dataset.ci]);
    if (!sel.length) return;
    if (!$('#date').value) {
      const ends = sel.map(c => c.end).filter(Boolean).sort();
      if (ends.length) $('#date').value = H.iso(H.addDays(H.D(ends[ends.length - 1]), 1));
    }
    sel.forEach(c => {
      if (c.rate === '' || c.rate == null) return;
      if (c.kind === 'gangsa' || c.kind === 'univ') { c.kind = 'custom'; c.note = [c.note, '호봉획정표 환산율 그대로'].filter(Boolean).join(' '); }
      const def = (H.KIND[c.kind] || {}).rate;
      if (def != null && Number(c.rate) === def) c.rate = '';
      else if (def != null) { c.kind = 'custom'; }
    });
    rows = rows.concat(sel.map(c => ({ ...c, end: c.end || $('#date').value ? (c.end || H.iso(H.addDays(H.D($('#date').value), -1))) : '' })))
      .sort((a, b) => String(a.start).localeCompare(String(b.start)));
    $('#candWrap').style.display = 'none';
    $('#status').textContent = `${sel.length}건을 경력 표에 추가했습니다. 경력 구분·환산율을 확인하세요.`;
    renderRows();
    $('#careers').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  $('#date').value = '';
  renderRows();
})();
