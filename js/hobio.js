/* 호봉획정표 파일 입출력: 엑셀(.xlsx) 저장·불러오기, PDF 불러오기
 * 모두 브라우저 안에서만 처리합니다(서버 전송 없음).
 */
(function (root) {
  'use strict';
  const R = root.Rules, R3 = root.Rules3;

  /* ===================================================================
   * 공통: 경력 종류 추정(문서에는 경력 구분이 없으므로 내용·환산율로 추정)
   * =================================================================== */
  function guessKind(content, rate, note) {
    const hm = String(note || '').match(/주당\s*([\d.]+)\s*h/);
    if (hm) return { kind: 'gangsa', hours: hm[1] };
    if (/강사/.test(content) && rate && rate < 100) return { kind: 'custom', rate };
    if (/군|병역|복무/.test(content) && rate === 100) return { kind: 'military' };
    if (/휴직/.test(content) && rate === 100) return { kind: 'leaveCounted' };
    if (/대학원|석사|박사/.test(content) && rate === 100) return { kind: 'gradSchool' };
    if (rate === 100 && /초|중|고|학교|유치원|기간제|교원|교사/.test(content)) return { kind: 'teacher' };
    if (rate === 80 && /초|중|고|학교|유치원|기간제|교원|교사/.test(content)) return { kind: 'teacher80' };
    if (rate === 40 && /회사|주식|㈜|\(주\)/.test(content)) return { kind: 'company' };
    return { kind: 'custom', rate: rate || '' };
  }
  const eduKindOf = text => {
    const t = String(text || '');
    const hit = R3.EDU.map(([n]) => n).find(n => t.includes(n));
    if (hit) return hit;
    if (/교육대학/.test(t)) return '교대졸(4년)';
    if (/사범대/.test(t)) return '사범대졸(4년)';
    return '';
  };

  /* ===================================================================
   * 1. 엑셀(.xlsx) 만들기 — JSZip으로 직접 작성, 수식 포함
   * =================================================================== */
  const COLS = 'ABCDEFGHIJKLMN'.split('');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const serial = d => Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000);
  const fromSerial = n => { const t = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000); return new Date(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 12); };

  // 스타일 번호
  const S = { txt: 1, head: 2, dateIn: 3, pctIn: 4, txtIn: 5, title: 6, plain: 7, num: 8, grade: 9, years: 10, date: 11, leftIn: 12, numIn: 13, small: 14 };
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="yyyy\\.\\ mm\\.\\ dd\\."/><numFmt numFmtId="165" formatCode="0&quot;호봉&quot;"/><numFmt numFmtId="166" formatCode="0&quot;년&quot;"/></numFmts>
<fonts count="4"><font><sz val="10"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font><font><b/><sz val="10"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font><font><b/><sz val="18"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font><font><sz val="9"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0F3EE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF8DC"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="15">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="9" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="165" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="표준" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  function Sheet() {
    const cells = {}, merges = [], heights = {};
    const at = ref => { const m = ref.match(/^([A-Z]+)(\d+)$/); return { c: COLS.indexOf(m[1]), r: +m[2] }; };
    return {
      cells, merges, heights,
      set(ref, o) { cells[ref] = Object.assign(cells[ref] || {}, o); return this; },
      merge(range, style) {
        merges.push(range);
        const [a, b] = range.split(':').map(at);
        for (let r = a.r; r <= b.r; r++) for (let c = a.c; c <= b.c; c++) { const k = COLS[c] + r; cells[k] = cells[k] || {}; if (style !== undefined && cells[k].s === undefined) cells[k].s = style; }
        return this;
      },
      xml(colWidths, hiddenCols) {
        const rows = {};
        Object.entries(cells).forEach(([ref, c]) => { const p = at(ref); (rows[p.r] = rows[p.r] || []).push([p.c, ref, c]); });
        const maxR = Math.max(...Object.keys(rows).map(Number));
        let x = '';
        Object.keys(rows).map(Number).sort((a, b) => a - b).forEach(r => {
          x += `<row r="${r}"${heights[r] ? ` ht="${heights[r]}" customHeight="1"` : ''}>`;
          rows[r].sort((a, b) => a[0] - b[0]).forEach(([, ref, c]) => {
            const s = c.s !== undefined ? ` s="${c.s}"` : '';
            if (c.f !== undefined) {
              const str = typeof c.v === 'string';
              x += `<c r="${ref}"${s}${str ? ' t="str"' : ''}><f>${esc(c.f)}</f>${c.v === undefined || c.v === '' ? (str ? '<v></v>' : '') : `<v>${esc(c.v)}</v>`}</c>`;
            } else if (c.v === undefined || c.v === '') x += `<c r="${ref}"${s}/>`;
            else if (typeof c.v === 'number') x += `<c r="${ref}"${s}><v>${c.v}</v></c>`;
            else x += `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`;
          });
          x += '</row>';
        });
        const cols = colWidths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"${hiddenCols.includes(i) ? ' hidden="1"' : ''}/>`).join('');
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:N${maxR}"/>
<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="16.5"/>
<cols>${cols}</cols><sheetData>${x}</sheetData>
<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
      },
    };
  }

  async function exportXlsx(inp, r, school) {
    const sh = Sheet();
    const N = Math.max(12, r.rows.length);
    const sab = /교대|사범/.test(inp.eduName2);
    const eduText = `${inp.eduName ? inp.eduName + ' ' : ''}(${inp.eduName2})`;
    const base = Number(inp.base) || 0, cap = !!inp.limit14;

    sh.set('A1', { v: '[별지 제16호 서식]', s: S.plain });
    sh.merge('A2:K2', S.title).set('A2', { v: '호 봉 획 정 표' }); sh.heights[2] = 34;
    sh.merge('A3:B3', S.plain).set('A3', { v: '* 호봉획정사유 :' });
    sh.merge('C3:F3', S.txtIn).set('C3', { v: inp.reason || '' });
    sh.merge('A4:B4', S.head).set('A4', { v: '(1)소속' }); sh.merge('C4:F4', S.txtIn).set('C4', { v: inp.org || school || '' });
    sh.merge('G4:H4', S.head).set('G4', { v: '(2)제청(내신)자격' }); sh.merge('I4:K4', S.head).set('I4', { v: '(3)현직위(급)' });
    sh.merge('A5:B5', S.head).set('A5', { v: '(4)성명' }); sh.merge('C5:F5', S.txtIn);
    sh.merge('G5:H5', S.txtIn).set('G5', { v: inp.proposed || inp.certName || '' }); sh.merge('I5:K5', S.txtIn).set('I5', { v: inp.position || '' });
    sh.merge('A6:A7', S.head).set('A6', { v: '(5)학력' });
    sh.set('B6', { v: '사범계', s: S.head }); sh.merge('C6:F6', S.txtIn).set('C6', { v: sab ? eduText : '' });
    sh.set('B7', { v: '비사범계', s: S.head }); sh.merge('C7:F7', S.txtIn).set('C7', { v: sab ? '' : eduText });
    sh.merge('G6:H7', S.head).set('G6', { v: '(6)현호봉' }); sh.merge('I6:K7', S.txtIn).set('I6', { v: inp.curGrade ? Number(inp.curGrade) || inp.curGrade : '' });

    // 경력 표 머리
    sh.merge('A9:B9', S.head).set('A9', { v: '(7)경력기간' }); sh.merge('C9:C10', S.head).set('C9', { v: '(8)경력내용' });
    sh.merge('D9:F9', S.head).set('D9', { v: '(9)경력년수' }); sh.merge('G9:G10', S.head).set('G9', { v: '(10)\n환산율' });
    sh.merge('H9:J9', S.head).set('H9', { v: '(11)환산년수' }); sh.merge('K9:K10', S.head).set('K9', { v: '(12)비고' });
    [['A10', '부터'], ['B10', '까지'], ['D10', '년'], ['E10', '월'], ['F10', '일'], ['H10', '년'], ['I10', '월'], ['J10', '일']].forEach(([k, v]) => sh.set(k, { v, s: S.head }));
    sh.set('L10', { v: '경력일수', s: S.plain }); sh.set('M10', { v: '환산일수', s: S.plain }); sh.set('N10', { v: '개월', s: S.plain });

    const first = 11, last = 10 + N;
    for (let i = 0; i < N; i++) {
      const row = first + i, x = r.rows[i];
      const A = `A${row}`, B = `B${row}`;
      const blank = `OR(${A}="",${B}="")`;
      const k0 = `((YEAR(${B}+1)-YEAR(${A}))*12+MONTH(${B}+1)-MONTH(${A}))`;
      const pe = k => `IF(DAY(EDATE(${A},${k}))=DAY(${A}),EDATE(${A},${k})-1,EDATE(${A},${k}))`;
      sh.set(A, { v: x ? serial(x.s) : '', s: S.dateIn }); sh.set(B, { v: x ? serial(x.e) : '', s: S.dateIn });
      sh.set(`C${row}`, { v: x ? x.label : '', s: S.leftIn });
      sh.set(`N${row}`, { f: `IF(${blank},"",${k0}-IF(${pe(k0)}>${B},1,0))`, v: x ? x.period.y * 12 + x.period.m : '', s: S.plain });
      sh.set(`D${row}`, { f: `IF(${blank},"",INT(N${row}/12))`, v: x ? x.period.y : '', s: S.num });
      sh.set(`E${row}`, { f: `IF(${blank},"",MOD(N${row},12))`, v: x ? x.period.m : '', s: S.num });
      sh.set(`F${row}`, { f: `IF(${blank},"",${B}-${pe(`N${row}`)})`, v: x ? x.period.d : '', s: S.num });
      sh.set(`G${row}`, { v: x ? x.rate / 100 : '', s: S.pctIn });
      sh.set(`L${row}`, { f: `IF(D${row}="",0,D${row}*360+E${row}*30+F${row})`, v: x ? R3.toD(x.period) : 0, s: S.plain });
      const plain = x ? Math.floor(R3.toD(x.period) * x.rate / 100) : 0;
      if (x && x.usedD !== plain) {
        // 겹치는 기간을 뺀 경우: 계산 결과를 값으로 기록
        sh.set(`M${row}`, { v: x.usedD, s: S.plain });
      } else {
        sh.set(`M${row}`, { f: `IF(D${row}="",0,INT(ROUND(L${row}*G${row},6)))`, v: x ? x.usedD : 0, s: S.plain });
      }
      sh.set(`H${row}`, { f: `IF(D${row}="","",INT(M${row}/360))`, v: x ? x.usedP.y : '', s: S.num });
      sh.set(`I${row}`, { f: `IF(D${row}="","",INT(MOD(M${row},360)/30))`, v: x ? x.usedP.m : '', s: S.num });
      sh.set(`J${row}`, { f: `IF(D${row}="","",MOD(M${row},30))`, v: x ? x.usedP.d : '', s: S.num });
      const note = x ? [x.note, x.kind === 'gangsa' ? `주당 ${x.weekly}h/${x.base}h` : '', x.usedD !== plain ? '중복기간 제외' : ''].filter(Boolean).join(' ') : '';
      sh.set(`K${row}`, { v: note, s: S.leftIn });
    }
    const T = last + 1;
    sh.merge(`A${T}:C${T}`, S.head).set(`A${T}`, { v: '(13)계' });
    const rawD = R3.toD(r.rawP), totD = R3.toD(r.p14);
    sh.set(`L${T}`, { f: `SUM(L${first}:L${last})`, v: rawD, s: S.plain }); sh.set(`M${T}`, { f: `SUM(M${first}:M${last})`, v: totD, s: S.plain });
    sh.set(`D${T}`, { f: `INT(L${T}/360)`, v: r.rawP.y, s: S.head }); sh.set(`E${T}`, { f: `INT(MOD(L${T},360)/30)`, v: r.rawP.m, s: S.head }); sh.set(`F${T}`, { f: `MOD(L${T},30)`, v: r.rawP.d, s: S.head });
    sh.set(`G${T}`, { s: S.head });
    sh.set(`H${T}`, { f: `INT(M${T}/360)`, v: r.p14.y, s: S.head }); sh.set(`I${T}`, { f: `INT(MOD(M${T},360)/30)`, v: r.p14.m, s: S.head }); sh.set(`J${T}`, { f: `MOD(M${T},30)`, v: r.p14.d, s: S.head });
    sh.set(`K${T}`, { s: S.head });

    const H = T + 2, V = T + 3, B0 = T + 5;
    sh.merge(`A${H}:B${H}`, S.head).set(`A${H}`, { v: '(14)환산\n총경력년수' });
    sh.set(`C${H}`, { v: '(15)가감\n년수', s: S.head });
    sh.merge(`D${H}:F${H}`, S.head).set(`D${H}`, { v: '(16)호봉\n획정경력년수' });
    sh.set(`G${H}`, { v: '(17)\n사정호봉', s: S.head });
    sh.merge(`H${H}:J${H}`, S.head).set(`H${H}`, { v: '※호봉\n획정(승급)일' });
    sh.set(`K${H}`, { v: '(18)사정호봉에\n요하는 경력년수', s: S.head }); sh.heights[H] = 30;
    const ymdTxt = c => `INT(${c}/360)&"년 "&INT(MOD(${c},360)/30)&"월 "&MOD(${c},30)&"일"`;
    sh.merge(`A${V}:B${V}`, S.txt).set(`A${V}`, { f: ymdTxt(`M${T}`), v: R3.fmt(r.p14) });
    sh.set(`C${V}`, { v: r.add, s: S.numIn });
    const d16 = R3.toD(r.p16);
    sh.set(`L${V}`, { f: `MAX(0,M${T}+C${V}*360)`, v: d16, s: S.plain });
    sh.merge(`D${V}:F${V}`, S.txt).set(`D${V}`, { f: ymdTxt(`L${V}`), v: R3.fmt(r.p16) });
    const capF = `IF(UPPER(F${B0})="Y",14,40)`;
    sh.set(`G${V}`, { s: S.grade }).set(`G${V}`, { f: `MIN(${capF},C${B0}+INT(L${V}/360))`, v: r.grade });
    sh.merge(`H${V}:J${V}`, S.dateIn).set(`H${V}`, { v: inp.date ? serial(R.D(inp.date)) : '' });
    sh.set(`K${V}`, { s: S.years }); sh.set(`K${V}`, { f: `IF(AND(UPPER(F${B0})="Y",C${B0}+INT(L${V}/360)>14),14-C${B0},INT(L${V}/360))`, v: r.capped ? 14 - base : r.p16.y });

    sh.merge(`A${B0}:B${B0}`, S.head).set(`A${B0}`, { v: '기산호봉' });
    sh.set(`C${B0}`, { v: base, s: S.numIn });
    sh.merge(`D${B0}:E${B0}`, S.head).set(`D${B0}`, { v: '호봉상한제(Y/N)' });
    sh.set(`F${B0}`, { v: cap ? 'Y' : 'N', s: S.txtIn });
    sh.merge(`G${B0}:H${B0}`, S.head).set(`G${B0}`, { v: '소지 자격' });
    sh.merge(`I${B0}:K${B0}`, S.txtIn).set(`I${B0}`, { v: inp.certName || '' });

    const P1 = B0 + 2, P2 = B0 + 3;
    sh.merge(`A${P1}:B${P1}`, S.plain).set(`A${P1}`, { v: '작성자 직위(급) :' }); sh.merge(`C${P1}:D${P1}`, S.plain).set(`C${P1}`, { v: inp.writerPos || '' });
    sh.merge(`E${P1}:G${P1}`, S.plain).set(`E${P1}`, { v: '성명 :              (인)' });
    sh.merge(`H${P1}:I${P1}`, S.plain).set(`H${P1}`, { v: '잔여월수 :' });
    sh.merge(`J${P1}:K${P1}`, S.plain).set(`J${P1}`, { f: `INT(MOD(L${V},360)/30)&"월 "&MOD(MOD(L${V},360),30)&"일"`, v: `${r.rest.m}월 ${r.rest.d}일` });
    sh.merge(`A${P2}:B${P2}`, S.plain).set(`A${P2}`, { v: '확인자 직위(급) :' }); sh.merge(`C${P2}:D${P2}`, S.plain).set(`C${P2}`, { v: inp.checkerPos || '' });
    sh.merge(`E${P2}:G${P2}`, S.plain).set(`E${P2}`, { v: '성명 :              (인)' });
    sh.merge(`H${P2}:I${P2}`, S.plain).set(`H${P2}`, { v: '차기승급일 :' });
    const need = `(360-MOD(L${V},360))`, reach = `(EDATE(H${V},INT(${need}/30))+MOD(${need},30))`;
    sh.merge(`J${P2}:K${P2}`, S.date).set(`J${P2}`, { f: `IF(H${V}="","",IF(DAY(${reach})=1,${reach},DATE(YEAR(${reach}),MONTH(${reach})+1,1)))`, v: r.next ? serial(r.next) : '' });
    const N1 = P2 + 2;
    sh.merge(`A${N1}:K${N1}`, S.small).set(`A${N1}`, { v: '※ 노란 칸을 고치면 다시 계산됩니다. 경력년수는 년·월·일(1년=12월, 1월=30일), 환산년수 = 경력기간 × 환산율(일 미만 버림). 같은 기간에 겹치는 경력은 유리한 것 하나만 인정(비고 "중복기간 제외" 줄은 값으로 기록). 기간제교원은 계약 기간 중 승급 없음(차기승급일은 참고용).' });
    sh.heights[N1] = 40;

    const widths = [11, 11, 18, 4.5, 4.5, 4.5, 7, 4.5, 4.5, 4.5, 16, 8, 8, 6];
    const zip = new JSZip();
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="호봉획정표" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">호봉획정표!$A$1:$K$${N1}</definedName></definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`);
    zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    zip.file('xl/styles.xml', STYLES);
    zip.file('xl/worksheets/sheet1.xml', sh.xml(widths, [11, 12, 13]));
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
  }

  /* ===================================================================
   * 2. 엑셀(.xlsx) 불러오기 — 이 도우미가 만든 양식(엑셀에서 고쳐 저장해도 됨)
   * =================================================================== */
  async function parseXlsx(buf) {
    const zip = await JSZip.loadAsync(buf);
    const parse = async p => (zip.file(p) ? new DOMParser().parseFromString(await zip.file(p).async('string'), 'application/xml') : null);
    const T = (el, n) => [...el.getElementsByTagNameNS('*', n)];
    const ssDoc = await parse('xl/sharedStrings.xml');
    const ss = ssDoc ? T(ssDoc, 'si').map(si => T(si, 't').map(t => t.textContent).join('')) : [];
    const wb = await parse('xl/workbook.xml'), rels = await parse('xl/_rels/workbook.xml.rels');
    let sheetPath = 'xl/worksheets/sheet1.xml';
    if (wb && rels) {
      const sh = T(wb, 'sheet')[0];
      const rid = sh && (sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
      const rel = T(rels, 'Relationship').find(x => x.getAttribute('Id') === rid);
      if (rel) sheetPath = 'xl/' + rel.getAttribute('Target').replace(/^\/?xl\//, '').replace(/^\//, '');
    }
    const sd = await parse(sheetPath);
    if (!sd) return null;
    const cell = {};
    T(sd, 'c').forEach(c => {
      const t = c.getAttribute('t'), v = T(c, 'v')[0], is = T(c, 'is')[0];
      let val = '';
      if (t === 's') val = ss[Number(v && v.textContent)] || '';
      else if (t === 'inlineStr') val = is ? T(is, 't').map(x => x.textContent).join('') : '';
      else if (t === 'str' || t === 'e') val = v ? v.textContent : '';
      else if (v) val = Number(v.textContent);
      cell[c.getAttribute('r')] = val;
    });
    const get = ref => (cell[ref] === undefined ? '' : cell[ref]);
    const find = re => Object.keys(cell).find(k => typeof cell[k] === 'string' && re.test(cell[k]));
    const rowOf = ref => Number(ref.replace(/[A-Z]+/, ''));
    const head = find(/\(7\)\s*경력기간/), tot = find(/\(13\)\s*계/);
    if (!head || !tot) return null;
    const dateOf = v => (typeof v === 'number' ? R.iso(fromSerial(v)) : (String(v).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/) ? (m => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`)(String(v).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)) : ''));
    const o = { rows: [] };
    const rr = find(/호봉획정사유/); if (rr) o.reason = String(get('C' + rowOf(rr))).trim();
    const org = find(/\(1\)\s*소속/); if (org) o.org = String(get('C' + rowOf(org)));
    const pr = find(/\(2\)\s*제청/); if (pr) { o.proposed = String(get('G' + (rowOf(pr) + 1))); o.position = String(get('I' + (rowOf(pr) + 1))); }
    const sb = find(/^사범계$/), nsb = find(/^비사범계$/);
    const eduTxt = [sb && get('C' + rowOf(sb)), nsb && get('C' + rowOf(nsb))].filter(Boolean).join(' ');
    o.eduKind = eduKindOf(eduTxt); o.eduName = String(eduTxt).replace(/\s*\([^()]*(\([^()]*\))?[^()]*\)\s*$/, '').trim();
    const cg = find(/\(6\)\s*현호봉/); if (cg) o.curGrade = String(get('I' + rowOf(cg)));
    for (let r = rowOf(head) + 2; r < rowOf(tot); r++) {
      const s = dateOf(get('A' + r)), e = dateOf(get('B' + r));
      if (!s || !e) continue;
      let rate = get('G' + r);
      rate = typeof rate === 'number' ? Math.round(rate * 1000) / 10 : Number(String(rate).replace(/[^\d.]/g, '')) || '';
      const content = String(get('C' + r)), note = String(get('K' + r));
      o.rows.push(Object.assign({ start: s, end: e, content, note: note.replace(/주당\s*[\d.]+h\/\d+h|중복기간 제외/g, '').trim() }, guessKind(content, rate, note)));
    }
    const sum = find(/\(14\)/);
    if (sum) {
      const v = rowOf(sum) + 1;
      o.add = Number(get('C' + v)) || 0;
      o.date = dateOf(get('H' + v)) || dateOf(get('I' + v));
    }
    const b = find(/^기산호봉$/); if (b) { o.base = Number(get('C' + rowOf(b))) || ''; o.limit14 = String(get('F' + rowOf(b))).toUpperCase() === 'Y'; o.certName = String(get('I' + rowOf(b))); }
    const w = find(/작성자 직위/); if (w) o.writerPos = String(get('C' + rowOf(w)));
    const c = find(/확인자 직위/); if (c) o.checkerPos = String(get('C' + rowOf(c)));
    return o;
  }

  /* ===================================================================
   * 3. PDF 불러오기 — 글자로 된 PDF만(스캔 이미지 PDF는 불가)
   * =================================================================== */
  let pdfReady = null;
  function loadPdfJs() {
    if (pdfReady) return pdfReady;
    pdfReady = new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = 'vendor/pdfjs/pdf.min.js';
      s.onload = () => { root.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js'; ok(root.pdfjsLib); };
      s.onerror = () => no(new Error('PDF 읽기 도구를 불러오지 못했습니다.'));
      document.head.appendChild(s);
    });
    return pdfReady;
  }
  const DATE_RE = /(\d{4})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})\s*[.일]?/g;
  async function pdfLines(buf) {
    const lib = await loadPdfJs();
    const pdf = await lib.getDocument({ data: new Uint8Array(buf), cMapUrl: 'vendor/pdfjs/cmaps/', cMapPacked: true }).promise;
    const lines = [];
    for (let p = 1; p <= Math.min(pdf.numPages, 5); p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const items = tc.items.filter(it => it.str && it.str.trim()).map(it => ({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: Math.abs(it.transform[3]) || 8 }));
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const group = [];
      items.forEach(it => {
        const g = group.find(l => Math.abs(l.y - it.y) <= Math.max(2.5, it.h * 0.35));
        if (g) g.items.push(it); else group.push({ y: it.y, items: [it] });
      });
      group.sort((a, b) => b.y - a.y).forEach(l => {
        l.items.sort((a, b) => a.x - b.x);
        let t = '', prev = null;
        l.items.forEach(it => { if (prev) t += it.x - (prev.x + prev.w) > it.h * 0.25 ? ' ' : ''; t += it.s; prev = it; });
        lines.push(t.replace(/\s+/g, ' ').trim());
      });
    }
    return lines;
  }
  async function parsePdf(buf) {
    const lines = await pdfLines(buf);
    const full = lines.join('\n');
    if (!full.replace(/\s/g, '')) return { error: 'scan' };
    const iso = m => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    const o = { rows: [] };
    let afterTotal = false;
    lines.forEach(line => {
      if (/\(13\)\s*계/.test(line)) { afterTotal = true; return; }
      const ds = [...line.matchAll(DATE_RE)];
      if (!afterTotal && ds.length >= 2 && !/부터|까지/.test(line)) {
        const restAll = line.slice(ds[1].index + ds[1][0].length).trim();
        const pm = restAll.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
        const rate = pm ? Number(pm[1]) : '';
        // 경력내용: 둘째 날짜 뒤부터 첫 숫자 묶음(년 월 일)·오류표시 전까지
        const cut = restAll.search(/\s(\d+\s+){2}\d+(\s|$)|\s\d+\s*년|#VALUE|###|\s\d{1,3}(?:\.\d+)?\s*%/);
        const content = (cut >= 0 ? restAll.slice(0, cut) : restAll.replace(/\d{1,3}\s*%.*$/, '')).trim();
        const note = pm ? restAll.slice(pm.index + pm[0].length).replace(/^[\s\d#A-Z!]+/, '').trim() : '';
        o.rows.push(Object.assign({ start: iso(ds[0]), end: iso(ds[1]), content, note: note.replace(/주당\s*[\d.]+\s*h\s*\/\s*\d+\s*h|중복기간\s*제외/g, '').trim() }, guessKind(content, rate, note)));
      } else if (afterTotal && ds.length === 1 && !o.date && !/차기승급/.test(line)) {
        o.date = iso(ds[0]);
      }
    });
    const m1 = full.match(/호봉\s*획정\s*사유\s*:?\s*([^\n(]+)/); if (m1) o.reason = m1[1].trim();
    const m2 = full.match(/\(1\)\s*소속\s*([^\n(]+)/); if (m2) o.org = m2[1].trim();
    const m3 = full.match(/(초등|중등|유치원|특수)?\s*([12])\s*급\s*(정교사|보건교사|영양교사|전문상담교사)/);
    if (m3) { o.proposed = m3[0].replace(/\s+/g, ' ').trim(); o.certName = (m3[3] === '정교사' && m3[1] === '특수' ? '특수' : '') + `${m3[2]}급${m3[3]}`; }
    else if (/준교사/.test(full)) o.certName = '준교사';
    const m4 = full.match(/\(6\)\s*현\s*호봉\s*(\d{1,2})/); if (m4) o.curGrade = m4[1];
    const m5 = full.match(/(\S*(?:교육대학교|대학교|대학))/); if (m5) o.eduName = m5[1];
    o.eduKind = eduKindOf(full);
    const m6 = full.match(/작성자\s*직위\s*\(급\)\s*:?\s*([^\s성]+)/); if (m6) o.writerPos = m6[1];
    const m7 = full.match(/확인자\s*직위\s*\(급\)\s*:?\s*([^\s성]+)/); if (m7) o.checkerPos = m7[1];
    if (/호봉상한제 적용 대상/.test(full)) o.limit14 = true;
    return o;
  }

  root.HobIO = { exportXlsx, parseXlsx, parsePdf, guessKind, eduKindOf, serial, fromSerial };
})(this);
