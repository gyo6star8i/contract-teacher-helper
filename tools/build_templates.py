"""hwpx 템플릿 생성기 (개발용).

웹에서 JSZip으로 채울 자리표시자가 들어간 hwpx 템플릿을 만든다.
- {{key}}       : 단순 치환
- {{#Lx}}       : 문단 원형(prototype). 웹에서 복제해 본문을 구성한다.
- {{#BODY}}     : 본문이 들어갈 위치
- {{@key}}      : 목록 치환(문단을 항목 수만큼 복제)
실행: python tools/build_templates.py  (python-hwpx 필요)
"""
import os, re, shutil, subprocess, sys, tempfile, warnings
warnings.filterwarnings("ignore")
from hwpx import HwpxDocument

F = "맑은 고딕"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "templates")


class Doc:
    def __init__(self):
        self.d = HwpxDocument.new()
        self.first = True
        s = self.d.ensure_run_style
        self.body = s(font=F, size=11.5)
        self.bold = s(font=F, size=11.5, bold=True)
        self.small = s(font=F, size=10)
        self.title = s(font=F, size=20, bold=True)
        self.big = s(font=F, size=16, bold=True)
        self.d.set_page_margins(left=5669, right=5669, top=4252, bottom=4252)

    def p(self, text="", cp=None, align="justify", left=0.0, hang=0.0):
        cp = self.body if cp is None else cp
        if self.first:
            par = self.d.paragraphs[0]; par.text = text; self.first = False
        else:
            par = self.d.add_paragraph(text, char_pr_id_ref=cp)
        for r in par.element.iter():
            if r.tag.endswith('}run'):
                r.set('charPrIDRef', str(cp))
        idx = len(self.d.paragraphs) - 1
        self.d.set_paragraph_format(paragraph_index=idx, alignment=align, line_spacing_percent=103,
                                    indent_left_mm=left + hang, first_line_indent_mm=-hang)
        return par

    def table(self, data, widths, cps):
        t = self.d.add_table(len(data), len(data[0]), width=sum(widths))
        t.set_column_widths(widths)
        for r, row in enumerate(data):
            for c, val in enumerate(row):
                t.set_cell_text(r, c, val)
                cp = cps(r, c)
                for el in t.cell(r, c).element.iter():
                    if el.tag.endswith('}run'):
                        el.set('charPrIDRef', str(cp))
        return t

    def save(self, name):
        tmpd = tempfile.mkdtemp()
        tmp = os.path.join(tmpd, "t.hwpx")
        self.d.save_to_path(tmp)
        x = os.path.join(tmpd, "x"); os.makedirs(x)
        subprocess.run(["unzip", "-oq", tmp, "-d", x], check=True)
        h = os.path.join(x, "Contents", "header.xml")
        s = open(h, encoding="utf-8").read()
        s = re.sub(r'<hh:lineSpacing type="PERCENT" value="\d+" unit="HWPUNIT"/>',
                   '<hh:lineSpacing type="PERCENT" value="103" unit="HWPUNIT"/>', s)
        open(h, "w", encoding="utf-8").write(s)
        # 미리보기 텍스트에 자리표시자가 남지 않도록 비움
        pv = os.path.join(x, "Preview", "PrvText.txt")
        if os.path.exists(pv):
            open(pv, "w", encoding="utf-8").write("")
        out = os.path.join(OUT, name)
        if os.path.exists(out): os.remove(out)
        subprocess.run(["zip", "-X0", "-q", out, "mimetype"], cwd=x, check=True)
        subprocess.run(["zip", "-Xrq", out, ".", "-x", "mimetype"], cwd=x, check=True)
        shutil.rmtree(tmpd)
        print("saved", out)


def footer(D):
    D.p("")
    D.p("")
    D.p("★{{drafterTitle}}           {{approverTitle}}", D.body)
    D.p("협조자", D.small)
    D.p("시행  {{schoolName}}-       (          )          접수                (          )", D.small)
    D.p("{{addrLine}}", D.small)
    D.p("{{contactLine}}", D.small)


def gian():
    D = Doc()
    D.p("{{slogan}}", D.small, "center")
    D.p("{{schoolName}}", D.title, "center")
    D.p("")
    D.p("수신  내부결재")
    D.p("(경유)")
    D.p("제목  {{title}}", D.bold, hang=11)
    D.p("")
    D.p("{{#BODY}}")
    D.p("{{#L0}}", hang=5)            # 1. 2. 수준
    D.p("{{#L1}}", left=3, hang=5)    # 가. 나. 수준
    D.p("{{#L2}}", left=8, hang=5)    # 1) 2) 수준
    D.p("{{#L3}}", left=13, hang=2.5) # - 수준
    D.p("{{#NOTE}}", D.small, left=13, hang=2.5)  # 작은 글씨 인용
    D.p("{{#ATT}}", left=0, hang=0)   # 붙임
    D.p("{{#ATT2}}", left=12)         # 붙임 2번째 줄 이후
    footer(D)
    D.save("gian.hwpx")


def minutes(n):
    R = Doc()
    R.p("- {{year}} 인사자문위원회 회의록 -", R.big, "center")
    R.p("")
    t = R.table([
        ["일    시", "{{datetime}}"],
        ["장    소", "{{place}}"],
        ["위    원", "인사자문위원회"],
        ["안    건", "{{agenda}}"],
        ["회의 결과", ""],
        ["{{@result}}", ""],
    ], [8500, 37500], lambda r, c: R.bold if (c == 0 and r < 5) else R.body)
    R.d.merge_table_cells(t, "A5:B5")
    R.d.merge_table_cells(t, "A6:B6")
    R.p("")
    R.p("위 사실을 확인함", R.body, "center")
    R.p("")
    R.p("{{dateOnly}}", R.big, "center")
    R.p("")
    R.p("{{schoolName}} {{year}} 인사자문위원회", R.big, "center")
    R.p("")
    first = 5800
    rest = (46000 - first) // n
    R.table([
        ["구분", "위원장"] + ["위원"] * (n - 1),
        ["직위", "{{p1}}"] + ["{{p%d}}" % i for i in range(2, n + 1)],
        ["성명"] + ["{{m%d}}" % i for i in range(1, n + 1)],
        ["확인서명"] + [""] * n,
    ], [first] + [rest] * n, lambda r, c: R.bold if c == 0 else R.body)
    R.save("minutes_%d.hwpx" % n)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    gian()
    for n in range(3, 10):
        minutes(n)
