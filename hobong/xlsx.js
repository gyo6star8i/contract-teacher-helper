/* 호봉획정표 엑셀(.xlsx) 저장 — 브라우저 안에서만 처리(JSZip)
 *  - 저장 전용: [별지] 호봉획정표 모양 + 계산 수식 (엑셀 파일 불러오기는 개인정보 보호를 위해 두지 않음)
 */
(function (root) {
  'use strict';
  const H = root.Hobong;
  const COLS = 'ABCDEFGHIJKLMN'.split('');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const serial = d => Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000);

  const S = { txt: 1, head: 2, dateIn: 3, pctIn: 4, txtIn: 5, title: 6, plain: 7, num: 8, grade: 9, years: 10, date: 11, leftIn: 12, numIn: 13, small: 14 };
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy\\.\\ m\\.\\ d\\."/><numFmt numFmtId="165" formatCode="0&quot;호봉&quot;"/></numFmts>
<fonts count="4"><font><sz val="10"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font><font><b/><sz val="10"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font><font><b/><sz val="18"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font><font><sz val="9"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0F0F0"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF8DC"/><bgColor indexed="64"/></patternFill></fill></fills>
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
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
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
      cells, heights,
      set(ref, o) { cells[ref] = Object.assign(cells[ref] || {}, o); return this; },
      merge(range, style) {
        merges.push(range);
        const [a, b] = range.split(':').map(at);
        for (let r = a.r; r <= b.r; r++) for (let c = a.c; c <= b.c; c++) { const k = COLS[c] + r; cells[k] = cells[k] || {}; if (style !== undefined && cells[k].s === undefined) cells[k].s = style; }
        return this;
      },
      xml(widths, hidden) {
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
              x += `<c r="${ref}"${s}${str ? ' t="str"' : ''}><f>${esc(c.f)}</f>${c.v === undefined || c.v === '' ? '' : `<v>${esc(c.v)}</v>`}</c>`;
            } else if (c.v === undefined || c.v === '') x += `<c r="${ref}"${s}/>`;
            else if (typeof c.v === 'number') x += `<c r="${ref}"${s}><v>${c.v}</v></c>`;
            else x += `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`;
          });
          x += '</row>';
        });
        const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"${hidden.includes(i) ? ' hidden="1"' : ''}/>`).join('');
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:N${maxR}"/>
<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="16.5"/>
<cols>${cols}</cols><sheetData>${x}</sheetData>
${merges.length ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
      },
    };
  }

  /* info = { reason, org, name, certName, pos, curGrade, eduText, sabeom, writerPos, writerName, checkerPos, checkerName, contract }
   * r = Hobong.calc 결과 */
  async function exportXlsx(info, r) {
    const sh = Sheet();
    const rows = r.valid, N = Math.max(12, rows.length);
    sh.set('A1', { v: '호봉획정표', s: S.plain });
    sh.merge('A2:K2', S.title).set('A2', { v: '호 봉 획 정 표' }); sh.heights[2] = 34;
    sh.merge('A3:B3', S.plain).set('A3', { v: '* 호봉획정사유 :' });
    sh.merge('C3:F3', S.txtIn).set('C3', { v: info.reason || '' });
    sh.merge('A4:B4', S.head).set('A4', { v: '(1)소속' }); sh.merge('C4:F4', S.txtIn).set('C4', { v: info.org || '' });
    sh.merge('G4:H4', S.head).set('G4', { v: '(2)제청(내신)자격' }); sh.merge('I4:K4', S.head).set('I4', { v: '(3)현직위(급)' });
    sh.merge('A5:B5', S.head).set('A5', { v: '(4)성명' }); sh.merge('C5:F5', S.txtIn).set('C5', { v: info.name || '' });
    sh.merge('G5:H5', S.txtIn).set('G5', { v: info.certName || '' }); sh.merge('I5:K5', S.txtIn).set('I5', { v: info.pos || '' });
    sh.merge('A6:A7', S.head).set('A6', { v: '(5)학력' });
    sh.set('B6', { v: '사범계', s: S.head }); sh.merge('C6:F6', S.txtIn).set('C6', { v: info.sabeom ? info.eduText : '' });
    sh.set('B7', { v: '비사범계', s: S.head }); sh.merge('C7:F7', S.txtIn).set('C7', { v: info.sabeom ? '' : info.eduText });
    sh.merge('G6:H7', S.head).set('G6', { v: '(6)현호봉' }); sh.merge('I6:K7', S.txtIn).set('I6', { v: info.curGrade ? Number(info.curGrade) || info.curGrade : '' });

    sh.merge('A9:B9', S.head).set('A9', { v: '(7)경력기간' }); sh.merge('C9:C10', S.head).set('C9', { v: '(8)경력내용' });
    sh.merge('D9:F9', S.head).set('D9', { v: '(9)경력년수' }); sh.merge('G9:G10', S.head).set('G9', { v: '(10)\n환산율' });
    sh.merge('H9:J9', S.head).set('H9', { v: '(11)환산년수' }); sh.merge('K9:K10', S.head).set('K9', { v: '(12)비고' });
    [['A10', '부터'], ['B10', '까지'], ['D10', '년'], ['E10', '월'], ['F10', '일'], ['H10', '년'], ['I10', '월'], ['J10', '일']].forEach(([k, v]) => sh.set(k, { v, s: S.head }));
    sh.set('L10', { v: '경력일수', s: S.plain }); sh.set('M10', { v: '환산일수', s: S.plain }); sh.set('N10', { v: '개월', s: S.plain });

    const first = 11, last = 10 + N;
    for (let i = 0; i < N; i++) {
      const row = first + i, x = rows[i];
      const A = `A${row}`, B = `B${row}`, blank = `OR(${A}="",${B}="")`;
      const k0 = `((YEAR(${B}+1)-YEAR(${A}))*12+MONTH(${B}+1)-MONTH(${A}))`;
      const pe = k => `IF(DAY(EDATE(${A},${k}))=DAY(${A}),EDATE(${A},${k})-1,EDATE(${A},${k}))`;
      sh.set(A, { v: x ? serial(x.s) : '', s: S.dateIn }); sh.set(B, { v: x ? serial(x.e) : '', s: S.dateIn });
      sh.set(`C${row}`, { v: x ? x.content : '', s: S.leftIn });
      sh.set(`N${row}`, { f: `IF(${blank},"",${k0}-IF(${pe(k0)}>${B},1,0))`, v: x ? x.period.y * 12 + x.period.m : '', s: S.plain });
      sh.set(`D${row}`, { f: `IF(${blank},"",INT(N${row}/12))`, v: x ? x.period.y : '', s: S.num });
      sh.set(`E${row}`, { f: `IF(${blank},"",MOD(N${row},12))`, v: x ? x.period.m : '', s: S.num });
      sh.set(`F${row}`, { f: `IF(${blank},"",MIN(29,${B}-${pe(`N${row}`)}))`, v: x ? x.period.d : '', s: S.num });
      sh.set(`G${row}`, { v: x ? Math.round(x.factor * 10000) / 10000 : '', s: S.pctIn });
      sh.set(`L${row}`, { f: `IF(D${row}="",0,D${row}*360+E${row}*30+F${row})`, v: x ? H.toD(x.period) : 0, s: S.plain });
      const plain = x ? Math.floor(H.toD(x.period) * x.factor + 1e-9) : 0;
      if (x && x.usedD !== plain) sh.set(`M${row}`, { v: x.usedD, s: S.plain });            // 중복 기간 제외 → 값으로
      else sh.set(`M${row}`, { f: `IF(D${row}="",0,INT(ROUND(L${row}*G${row},6)))`, v: x ? x.usedD : 0, s: S.plain });
      sh.set(`H${row}`, { f: `IF(D${row}="","",INT(M${row}/360))`, v: x ? x.used.y : '', s: S.num });
      sh.set(`I${row}`, { f: `IF(D${row}="","",INT(MOD(M${row},360)/30))`, v: x ? x.used.m : '', s: S.num });
      sh.set(`J${row}`, { f: `IF(D${row}="","",MOD(M${row},30))`, v: x ? x.used.d : '', s: S.num });
      const note = x ? [x.usedD !== plain ? '중복기간 제외' : '', x.kind === 'gangsa' ? x.notes.join(', ') : '', x.note].filter(Boolean).join(' ') : '';
      sh.set(`K${row}`, { v: note, s: S.leftIn });
    }
    const T = last + 1;
    sh.merge(`A${T}:C${T}`, S.head).set(`A${T}`, { v: '(13)계' });
    sh.set(`L${T}`, { f: `SUM(L${first}:L${last})`, v: H.toD(r.p13), s: S.plain });
    sh.set(`M${T}`, { f: `SUM(M${first}:M${last})`, v: H.toD(r.p14), s: S.plain });
    sh.set(`D${T}`, { f: `INT(L${T}/360)`, v: r.p13.y, s: S.head }); sh.set(`E${T}`, { f: `INT(MOD(L${T},360)/30)`, v: r.p13.m, s: S.head }); sh.set(`F${T}`, { f: `MOD(L${T},30)`, v: r.p13.d, s: S.head });
    sh.set(`G${T}`, { s: S.head });
    sh.set(`H${T}`, { f: `INT(M${T}/360)`, v: r.p14.y, s: S.head }); sh.set(`I${T}`, { f: `INT(MOD(M${T},360)/30)`, v: r.p14.m, s: S.head }); sh.set(`J${T}`, { f: `MOD(M${T},30)`, v: r.p14.d, s: S.head });
    sh.set(`K${T}`, { s: S.head });

    const Hh = T + 2, V = T + 3, B0 = T + 5;
    sh.merge(`A${Hh}:B${Hh}`, S.head).set(`A${Hh}`, { v: '(14)환산\n총경력년수' });
    sh.set(`C${Hh}`, { v: '(15)가감\n년수', s: S.head });
    sh.merge(`D${Hh}:F${Hh}`, S.head).set(`D${Hh}`, { v: '(16)호봉\n획정경력년수' });
    sh.set(`G${Hh}`, { v: '(17)\n사정호봉', s: S.head });
    sh.merge(`H${Hh}:J${Hh}`, S.head).set(`H${Hh}`, { v: '※호봉\n획정(승급)일' });
    sh.set(`K${Hh}`, { v: '(18)사정호봉에\n요하는 경력년수', s: S.head }); sh.heights[Hh] = 30;
    const ymdTxt = c => `INT(${c}/360)&"년 "&INT(MOD(${c},360)/30)&"월 "&MOD(${c},30)&"일"`;
    sh.merge(`A${V}:B${V}`, S.txt).set(`A${V}`, { f: ymdTxt(`M${T}`), v: H.fmt(r.p14) });
    sh.set(`C${V}`, { v: r.adj, s: S.numIn });
    const d16 = H.toD(r.p14) + r.adj * 360;
    sh.set(`L${V}`, { f: `M${T}+C${V}*360`, v: d16, s: S.plain });
    sh.merge(`D${V}:F${V}`, S.txt).set(`D${V}`, { f: ymdTxt(`L${V}`), v: `${r.p16.y}년 ${r.p16.m}월 ${r.p16.d}일` });
    const capF = `IF(UPPER(F${B0})="Y",14,999)`;
    sh.set(`G${V}`, { f: `MAX(1,MIN(${capF},C${B0}+INT(L${V}/360)))`, v: r.grade, s: S.grade });
    sh.merge(`H${V}:J${V}`, S.dateIn).set(`H${V}`, { v: r.at ? serial(r.at) : '' });
    sh.set(`K${V}`, { f: `G${V}-C${B0}&"년"`, v: `${r.grade - r.base}년`, s: S.years });

    sh.merge(`A${B0}:B${B0}`, S.head).set(`A${B0}`, { v: '기산호봉' });
    sh.set(`C${B0}`, { v: r.base, s: S.numIn });
    sh.merge(`D${B0}:E${B0}`, S.head).set(`D${B0}`, { v: '호봉상한제(Y/N)' });
    sh.set(`F${B0}`, { v: r.capped ? 'Y' : 'N', s: S.txtIn });
    sh.merge(`G${B0}:H${B0}`, S.head).set(`G${B0}`, { v: '40호봉 초과' });
    sh.merge(`I${B0}:K${B0}`, S.txt).set(`I${B0}`, { f: `IF(G${V}>40,"40호봉 + 근속가봉 "&(G${V}-40),"-")`, v: r.grade > 40 ? `40호봉 + 근속가봉 ${r.grade - 40}` : '-' });

    const P1 = B0 + 2, P2 = B0 + 3;
    sh.merge(`A${P1}:B${P1}`, S.plain).set(`A${P1}`, { v: '작성자 직위(급) :' }); sh.merge(`C${P1}:D${P1}`, S.plain).set(`C${P1}`, { v: info.writerPos || '' });
    sh.merge(`E${P1}:G${P1}`, S.plain).set(`E${P1}`, { v: `성명 : ${info.writerName || ''}    (인)` });
    sh.merge(`H${P1}:I${P1}`, S.plain).set(`H${P1}`, { v: '잔여월수 :' });
    sh.merge(`J${P1}:K${P1}`, S.plain).set(`J${P1}`, { f: `INT(MOD(L${V},360)/30)&"월 "&MOD(MOD(L${V},360),30)&"일"`, v: `${r.rest.m}월 ${r.rest.d}일` });
    sh.merge(`A${P2}:B${P2}`, S.plain).set(`A${P2}`, { v: '확인자 직위(급) :' }); sh.merge(`C${P2}:D${P2}`, S.plain).set(`C${P2}`, { v: info.checkerPos || '' });
    sh.merge(`E${P2}:G${P2}`, S.plain).set(`E${P2}`, { v: `성명 : ${info.checkerName || ''}    (인)` });
    sh.merge(`H${P2}:I${P2}`, S.plain).set(`H${P2}`, { v: '차기승급일 :' });
    if (info.contract) sh.merge(`J${P2}:K${P2}`, S.plain).set(`J${P2}`, { v: '없음' });
    else {
      const rm = `INT(MOD(L${V},360)/30)`, rd = `MOD(MOD(L${V},360),30)`;
      const reach = `(EDATE(H${V},12-${rm})-${rd})`;
      sh.merge(`J${P2}:K${P2}`, S.date).set(`J${P2}`, { f: `IF(H${V}="","",IF(DAY(${reach})=1,${reach},DATE(YEAR(${reach}),MONTH(${reach})+1,1)))`, v: r.next ? serial(r.next) : '' });
    }
    const N1 = P2 + 2;
    sh.merge(`A${N1}:K${N1}`, S.small).set(`A${N1}`, { v: '※ 노란 칸을 고치면 다시 계산됩니다. 경력년수는 년·월·일(1년=12월, 1월=30일), 환산년수 = 경력기간 × 환산율(일 미만 버림). 같은 기간에 겹치는 경력은 유리한 것 하나만 인정(비고 "중복기간 제외" 줄은 값으로 기록). 근거: 공무원보수규정 제8조·별표22·23·25.' });
    sh.heights[N1] = 40;

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
    zip.file('xl/worksheets/sheet1.xml', sh.xml([11, 11, 20, 4.5, 4.5, 4.5, 7, 4.5, 4.5, 4.5, 18, 8, 8, 6], [11, 12, 13]));
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', compression: 'DEFLATE' });
  }

  root.HobongXlsx = { exportXlsx };
})(typeof self !== 'undefined' ? self : this);
