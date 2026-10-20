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
  function fromProto(proto, token, text) {
    return proto.replace(token, esc(text)).replace(/ id="\d+"/, ` id="${rid()}"`);
  }

  /* body: [{s:'L0'|'L1'|..., t:'...'}], vars: {key: value}, lists: {key: [..]} */
  function fill(xml, { body, vars, lists }) {
    if (body) {
      const keys = ['L0', 'L1', 'L2', 'L3', 'NOTE', 'ATT', 'ATT2'];
      const protos = {};
      keys.forEach(k => {
        const p = findPara(xml, `{{#${k}}}`);
        if (p) { protos[k] = p.text; xml = xml.slice(0, p.a) + xml.slice(p.b); }
      });
      const anchor = findPara(xml, '{{#BODY}}');
      const html = body.map(l => fromProto(protos[l.s] || protos.L0, `{{#${protos[l.s] ? l.s : 'L0'}}}`, l.t)).join('');
      xml = xml.slice(0, anchor.a) + html + xml.slice(anchor.b);
    }
    if (lists) for (const k in lists) {
      const p = findPara(xml, `{{@${k}}}`);
      if (!p) continue;
      const html = (lists[k] || []).map(t => fromProto(p.text, `{{@${k}}}`, t)).join('');
      xml = xml.slice(0, p.a) + html + xml.slice(p.b);
    }
    if (vars) xml = xml.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? esc(vars[k]) : ''));
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
