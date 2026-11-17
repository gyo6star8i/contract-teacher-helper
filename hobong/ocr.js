/* 경력증명서 캡처 인식
 *  1) Gemini 비전(사용자 API 키, 브라우저 → Google 직접 호출)
 *  2) Tesseract.js 한국어 OCR(기기 안에서 처리) + 날짜 패턴 해석
 */
(function (root) {
  'use strict';

  const loadScript = src => new Promise((ok, no) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => no(new Error('스크립트를 불러오지 못했습니다: ' + src));
    document.head.appendChild(s);
  });
  const toB64 = file => new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = no; r.readAsDataURL(file);
  });

  /* 경력 내용 → 경력 구분 추정 */
  function classify(t) {
    t = String(t || '');
    if (/육아\s*휴직|출산|공무상\s*질병|병역\s*휴직|노조전임/.test(t)) return 'leave';
    if (/휴직|정직|직위해제/.test(t)) return 'leave0';
    if (/육군|해군|공군|해병|병역|군\s*복무|현역|보충역|상근예비역|사회복무|군경력|전역|입대/.test(t)) return 'military';
    if (/시간\s*강사|강사|방과후/.test(t) && /대학교|대학(?!원)|전문대/.test(t) && !/교육대학교부설/.test(t)) return 'univ';
    if (/시간\s*강사|시간제\s*강사|전일제\s*강사|강사/.test(t) && !/학원/.test(t)) return 'gangsa';
    if (/학원|교습소/.test(t)) return 'academy';
    if (/대학원|석사|박사/.test(t)) return 'grad';
    if (/연구원|연구소/.test(t)) return 'research';
    if (/어린이집/.test(t)) return 'daycare';
    if (/교육공무직|교무행정|실무사|조리|돌봄|교육복지사|임시직|촉탁|계약직/.test(t)) return 'temp';
    if (/주식회사|\(주\)|㈜|회사|Co\.|Inc/.test(t)) return 'company';
    if (/(초등학교|중학교|고등학교|유치원|특수학교|학교|교사|교원|교감|교장|기간제|교육청|교육지원청|장학)/.test(t)) return 'teacher';
    if (/(공무원|시청|군청|구청|도청|주민센터|행정복지센터|읍사무소|면사무소|주사|서기)/.test(t)) return 'gov';
    return 'teacher';
  }

  /* ---------- 1) Gemini ---------- */
  const PROMPT = `이 이미지는 한국의 경력증명서(또는 인사기록카드·병적증명서) 캡처입니다.
호봉획정에 필요한 "근무 경력 기간"을 모두 찾아 JSON 배열로만 답하세요.
각 항목: {"start":"YYYY-MM-DD","end":"YYYY-MM-DD","org":"근무기관(학교명 등)","position":"직위·직종·담당(예: 기간제교사, 시간강사, 교사, 일병 등)","category":"교원|기간제교원|시간강사|군복무|공무원|휴직|대학원|회사|학원|기타","weeklyHours":숫자 또는 null,"totalHours":숫자 또는 null,"note":"휴직 종류·전공 불일치·미보고 등 특이사항, 없으면 빈 문자열"}
규칙:
- 날짜는 반드시 서기 YYYY-MM-DD. "현재", "재직중"이면 end는 빈 문자열.
- 한 행에 여러 기간이 있으면 각각 나누어 적으세요. 휴직 기간이 별도로 적혀 있으면 별도 항목(category "휴직")으로 넣으세요.
- 시간강사의 주당 수업시간·총 수업시간이 보이면 weeklyHours/totalHours에 넣으세요.
- 주민등록번호, 주소, 전화번호 등 개인 식별 정보는 절대 출력하지 마세요.
- 경력 기간이 없으면 [] 로 답하세요.`;

  async function gemini(files, key, model) {
    if (!key) throw new Error('Gemini API 키를 입력하세요.');
    const parts = [{ text: PROMPT }];
    for (const f of files) parts.push({ inline_data: { mime_type: f.type || 'image/png', data: await toB64(f) } });
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || 'gemini-flash-latest')}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Gemini 오류(${res.status}): ${(j.error && j.error.message) || res.statusText}`);
    const txt = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('');
    let arr;
    try { arr = JSON.parse(txt.replace(/^```(json)?|```$/g, '').trim()); } catch (e) { throw new Error('AI 응답을 해석하지 못했습니다: ' + txt.slice(0, 200)); }
    if (!Array.isArray(arr)) arr = arr.items || arr.careers || [];
    return arr.map(a => {
      const content = [a.org, a.position].filter(Boolean).join(' ').trim();
      const cat = a.category || '';
      let kind = cat === '군복무' ? 'military' : cat === '시간강사' ? classify(content + ' 강사') : cat === '휴직' ? classify(content + ' ' + (a.note || '') + ' 휴직')
        : cat === '대학원' ? 'grad' : cat === '회사' ? 'company' : cat === '학원' ? 'academy' : cat === '공무원' ? 'gov'
        : cat === '교원' || cat === '기간제교원' ? 'teacher' : classify(content + ' ' + (a.note || ''));
      if (kind === 'teacher' && /불일치|자격.*다름|미보고/.test(a.note || '')) kind = /미보고/.test(a.note) ? 'privNoReport' : 'teacher80';
      return { start: a.start || '', end: a.end || '', content, kind, weekly: a.weeklyHours || '', totalHours: a.totalHours || '', note: a.note || '' };
    });
  }

  /* ---------- 2) Tesseract ---------- */
  async function pdfToImages(file, onStatus) {
    await loadScript('../vendor/pdfjs/pdf.min.js');
    const lib = root.pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = '../vendor/pdfjs/pdf.worker.min.js';
    const doc = await lib.getDocument({ data: await file.arrayBuffer(), cMapUrl: '../vendor/pdfjs/cmaps/', cMapPacked: true }).promise;
    const out = [];
    for (let p = 1; p <= Math.min(doc.numPages, 6); p++) {
      onStatus && onStatus(`PDF ${p}/${doc.numPages}쪽 변환 중…`);
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale: 2.2 });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      out.push(c);
    }
    return out;
  }

  async function tesseract(files, onStatus) {
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
    const worker = await root.Tesseract.createWorker('kor+eng', 1, {
      logger: m => { if (m.status && onStatus) onStatus(`${m.status} ${m.progress ? Math.round(m.progress * 100) + '%' : ''}`); },
    });
    let text = '';
    try {
      for (const f of files) {
        const imgs = f.type === 'application/pdf' ? await pdfToImages(f, onStatus) : [f];
        for (const im of imgs) { const r = await worker.recognize(im); text += r.data.text + '\n'; }
      }
    } finally { await worker.terminate(); }
    return { text, rows: parseText(text) };
  }

  /* OCR 문자열 → 경력 기간 후보 */
  function normDate(y, m, d) {
    y = +y; if (y < 100) y += y >= 50 ? 1900 : 2000;
    m = +m; d = +d;
    if (y < 1950 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return '';
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  function parseText(text) {
    const t = String(text || '')
      .replace(/[Oo](?=\d)|(?<=\d)[Oo]/g, '0').replace(/(?<=\d)[lI|](?=\d)/g, '1')
      .replace(/년\s*/g, '.').replace(/월\s*/g, '.').replace(/일/g, '')
      .replace(/[〜∼～]/g, '~');
    const re = /((?:19|20)?\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\.?/g;
    const out = [];
    t.split(/\n/).forEach(line => {
      const ds = [...line.matchAll(re)].map(m => ({ v: normDate(m[1], m[2], m[3]), i: m.index, len: m[0].length })).filter(x => x.v);
      if (!ds.length) return;
      const rest = line.replace(re, ' ').replace(/[~\-–—]+/g, ' ').replace(/\s+/g, ' ').trim();
      for (let k = 0; k + 1 < ds.length; k += 2) {
        const a = ds[k].v, b = ds[k + 1].v;
        if (b < a) continue;
        out.push({ start: a, end: b, content: rest.slice(0, 60), kind: classify(rest), weekly: '', totalHours: '', note: 'OCR' });
      }
      if (ds.length % 2 === 1 && /현재|재직/.test(line)) out.push({ start: ds[ds.length - 1].v, end: '', content: rest.slice(0, 60), kind: classify(rest), weekly: '', totalHours: '', note: 'OCR(종료일 확인)' });
    });
    return out;
  }

  root.Ocr = { gemini, tesseract, parseText, classify };
})(typeof self !== 'undefined' ? self : this);
