/* hwpx 템플릿 채우기 (브라우저 전용, 서버 전송 없음) */
(function (root) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const rid = () => String(Math.floor(1e8 + Math.random() * 2e9));

  function findPara(xml, token) {
    const i = xml.indexOf(token);
    if (i < 0) return null;
    const a = xml.lastIndexOf('<hp:p ', i);
    const b = xml.indexOf('</hp:p>', i) + 7;
    return { a, b, text: xml.slice(a, b) };
  }

  const escT = s => esc(s).replace(/\n/g, '<hp:lineBreak/>');

  /* data = {
   *   body | bodies: {BODY:[{s:'L0',t:'...'}], BODY2:[...]}   본문 묶음
   *   lists: {key:[...]}  목록 치환,  vars: {key:value}  단순 치환 } */
  const PROTO_KEYS = ['H', 'L0', 'L1', 'L2', 'L3', 'NOTE', 'C', 'ATT', 'ATT2'];
  function fill(xml, data) {
    const bodies = data.bodies || (data.body ? { BODY: data.body } : null);
    const protos = {};
    PROTO_KEYS.forEach(k => {
      const p = findPara(xml, `{{#${k}}}`);
      if (p) { protos[k] = p.text; xml = xml.slice(0, p.a) + xml.slice(p.b); }
    });
    // 본문 위치 표시({{#BODY}}, {{#BODY2}} ...) 채우기 — 쓰지 않은 위치는 제거
    let m;
    while ((m = xml.match(/\{\{#(BODY\d*)\}\}/))) {
      const key = m[1], anchor = findPara(xml, m[0]);
      const items = (bodies && bodies[key]) || [];
      const html = items.map(l => {
        const k = protos[l.s] ? l.s : 'L0';
        return protos[k].replace(`{{#${k}}}`, escT(l.t)).replace(/ id="\d+"/, ` id="${rid()}"`);
      }).join('');
      xml = xml.slice(0, anchor.a) + html + xml.slice(anchor.b);
    }
    const lists = data.lists;
    if (lists) for (const k in lists) {
      const p = findPara(xml, `{{@${k}}}`);
      if (!p) continue;
      const html = (lists[k] || []).map(t => p.text.replace(`{{@${k}}}`, escT(t)).replace(/ id="\d+"/, ` id="${rid()}"`)).join('');
      xml = xml.slice(0, p.a) + html + xml.slice(p.b);
    }
    // 표 행 복제: 행 안의 {{%key:0}} {{%key:1}} ... → rows[key] = [[c0, c1, ...], ...]
    const rows = data.rows;
    if (rows) for (const k in rows) xml = expandRows(xml, k, rows[k] || []);
    // 선택 블록: {{?key}} ... {{/key}} 문단 사이를 blocks[key]가 거짓이면 삭제
    const blocks = data.blocks;
    if (blocks) {
      for (const k in blocks) {
        const s = findPara(xml, `{{?${k}}}`), e0 = xml.indexOf(`{{/${k}}}`);
        if (!s || e0 < 0) continue;
        const e = { a: xml.lastIndexOf('<hp:p ', e0), b: xml.indexOf('</hp:p>', e0) + 7 };
        if (blocks[k]) xml = xml.slice(0, s.a) + xml.slice(s.b, e.a) + xml.slice(e.b);
        else xml = xml.slice(0, s.a) + xml.slice(e.b);
      }
      // 남은 블록의 첫 쪽 나눔은 빈 첫 쪽을 만들지 않도록 해제
      xml = xml.replace(/(<hp:p [^>]*?)pageBreak="1"/, '$1pageBreak="0"');
    }
    const vars = data.vars || {};
    xml = xml.replace(/\{\{(\w+)\}\}/g, (mm, k) => (k in vars ? escT(vars[k]) : ''));
    return xml;
  }

  function expandRows(xml, key, list) {
    const tok = `{{%${key}:`;
    const i = xml.indexOf(tok);
    if (i < 0) return xml;
    const trA = Math.max(xml.lastIndexOf('<hp:tr>', i), xml.lastIndexOf('<hp:tr ', i));
    const trB = xml.indexOf('</hp:tr>', i) + 8;
    const proto = xml.slice(trA, trB);
    const html = list.map(row => proto
      .replace(new RegExp(`\\{\\{%${key}:(\\d+)\\}\\}`, 'g'), (m, c) => escT(row[Number(c)] == null ? '' : row[Number(c)]))
      .replace(/ id="\d+"/g, () => ` id="${rid()}"`)).join('');
    xml = xml.slice(0, trA) + html + xml.slice(trB);
    // 표의 행 번호(rowAddr)와 행 수(rowCnt) 다시 매기기
    const tA = xml.lastIndexOf('<hp:tbl ', trA), tB = xml.indexOf('</hp:tbl>', trA) + 9;
    let n = 0;
    let tbl = xml.slice(tA, tB).replace(/<hp:tr[\s>][\s\S]*?<\/hp:tr>/g, tr => {
      const out = tr.replace(/rowAddr="\d+"/g, `rowAddr="${n}"`); n++; return out;
    });
    tbl = tbl.replace(/rowCnt="\d+"/, `rowCnt="${n}"`);
    return xml.slice(0, tA) + tbl + xml.slice(tB);
  }

  async function build(templateUrl, data) {
    const buf = await (await fetch(templateUrl)).arrayBuffer();
    const src = await JSZip.loadAsync(buf);
    const out = new JSZip();
    out.file('mimetype', await src.file('mimetype').async('string'), { compression: 'STORE', createFolders: false });
    for (const name of Object.keys(src.files)) {
      const f = src.files[name];
      if (name === 'mimetype' || f.dir) continue;
      const content = name === 'Contents/section0.xml' ? fill(await f.async('string'), data) : await f.async('uint8array');
      out.file(name, content, { createFolders: false });
    }
    return out.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip', compression: 'DEFLATE' });
  }

  function download(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  root.Hwpx = { build, download, fill };
})(this);
