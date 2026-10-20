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
    const vars = data.vars || {};
    xml = xml.replace(/\{\{(\w+)\}\}/g, (mm, k) => (k in vars ? escT(vars[k]) : ''));
    return xml;
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
