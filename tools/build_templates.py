"""hwpx 템플릿 생성기 (개발용).

웹에서 JSZip으로 채울 자리표시자가 들어간 hwpx 템플릿을 만든다.
- {{key}}            : 단순 치환
- {{#H}} {{#L0}} ... : 문단 원형(prototype). 웹에서 복제해 본문을 구성한다.
- {{#BODY}} {{#BODY2}}...: 본문 묶음이 들어갈 위치
- {{@key}}           : 목록 치환(문단을 항목 수만큼 복제)
실행: python tools/build_templates.py  (python-hwpx 필요)
"""
import os, re, shutil, subprocess, tempfile, warnings
warnings.filterwarnings("ignore")
from hwpx import HwpxDocument

F = "맑은 고딕"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "templates")
FULL = 46000  # 본문 폭(HWPUNIT)


class Doc:
    def __init__(self):
        self.d = HwpxDocument.new()
        self.first = True
        s = self.d.ensure_run_style
        self.body = s(font=F, size=11.5)
        self.bold = s(font=F, size=11.5, bold=True)
        self.small = s(font=F, size=10)
        self.tiny = s(font=F, size=9)
        self.tinyb = s(font=F, size=9, bold=True)
        self.head = s(font=F, size=13, bold=True)
        self.title = s(font=F, size=20, bold=True)
        self.big = s(font=F, size=16, bold=True)
        self.d.set_page_margins(left=5669, right=5669, top=4252, bottom=4252)

    def p(self, text="", cp=None, align="justify", left=0.0, hang=0.0, pb=False):
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
        if pb:
            par.element.set('pageBreak', '1')
        return par

    def protos(self):
        """본문 문단 원형. 웹에서 복제 후 제거된다."""
        self.p("{{#H}}", self.head)                       # Ⅰ. 대제목
        self.p("{{#L0}}", hang=5)                         # 1. 2.
        self.p("{{#L1}}", left=3, hang=5)                 # 가. 나.
        self.p("{{#L2}}", left=8, hang=5)                 # 1) 2)
        self.p("{{#L3}}", left=13, hang=2.5)              # -
        self.p("{{#NOTE}}", self.small, left=8, hang=3)   # ※ 작은 글씨
        self.p("{{#C}}", align="center")                  # 가운데
        self.p("{{#ATT}}")                                # 붙임
        self.p("{{#ATT2}}", left=12)                      # 붙임 둘째 줄

    def table(self, data, widths, cps, merges=()):
        t = self.d.add_table(len(data), len(data[0]), width=sum(widths))
        t.set_column_widths(widths)
        for r, row in enumerate(data):
            for c, val in enumerate(row):
                if val is None: continue
                t.set_cell_text(r, c, val)
                cp = cps(r, c)
                for el in t.cell(r, c).element.iter():
                    if el.tag.endswith('}run'):
                        el.set('charPrIDRef', str(cp))
        for m in merges:
            self.d.merge_table_cells(t, m)
        return t

    def head_table(self, data, widths, small=False):
        b, n = (self.tinyb, self.tiny) if small else (self.bold, self.body)
        return self.table(data, widths, lambda r, c: b if r == 0 else n)

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
        # 셀 안 줄바꿈(\n)을 한글 줄바꿈 요소로 변환
        sp = os.path.join(x, "Contents", "section0.xml")
        sx = open(sp, encoding="utf-8").read()
        sx = re.sub(r'<hp:t>([^<]*)</hp:t>', lambda m: '<hp:t>' + m.group(1).replace('\n', '<hp:lineBreak/>') + '</hp:t>', sx)
        open(sp, "w", encoding="utf-8").write(sx)
        pv = os.path.join(x, "Preview", "PrvText.txt")
        if os.path.exists(pv):
            open(pv, "w", encoding="utf-8").write("")
        out = os.path.join(OUT, name)
        if os.path.exists(out): os.remove(out)
        subprocess.run(["zip", "-X0", "-q", out, "mimetype"], cwd=x, check=True)
        subprocess.run(["zip", "-Xrq", out, ".", "-x", "mimetype"], cwd=x, check=True)
        shutil.rmtree(tmpd)
        print("saved", out)


def gian_header(D):
    D.p("{{slogan}}", D.small, "center")
    D.p("{{schoolName}}", D.title, "center")
    D.p("")
    D.p("수신  {{receiver}}")
    D.p("(경유)")
    D.p("제목  {{title}}", D.bold, hang=11)
    D.p("")


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
    gian_header(D)
    D.p("{{#BODY}}")
    D.protos()
    footer(D)
    D.save("gian.hwpx")


def minutes(n):
    R = Doc()
    R.p("- {{year}} 인사자문위원회 회의록 -", R.big, "center")
    R.p("")
    R.table([
        ["일    시", "{{datetime}}"],
        ["장    소", "{{place}}"],
        ["위    원", "인사자문위원회"],
        ["안    건", "{{agenda}}"],
        ["회의 결과", ""],
        ["{{@result}}", ""],
    ], [8500, 37500], lambda r, c: R.bold if (c == 0 and r < 5) else R.body, merges=("A5:B5", "A6:B6"))
    R.p("")
    R.p("위 사실을 확인함", R.body, "center")
    R.p("")
    R.p("{{dateOnly}}", R.big, "center")
    R.p("")
    R.p("{{schoolName}} {{year}} 인사자문위원회", R.big, "center")
    R.p("")
    first = 5800
    rest = (FULL - first) // n
    R.table([
        ["구분", "위원장"] + ["위원"] * (n - 1),
        ["직위"] + ["{{p%d}}" % i for i in range(1, n + 1)],
        ["성명"] + ["{{m%d}}" % i for i in range(1, n + 1)],
        ["확인서명"] + [""] * n,
    ], [first] + [rest] * n, lambda r, c: R.bold if c == 0 else R.body)
    R.save("minutes_%d.hwpx" % n)


def plan(n):
    """참고자료 3: 채용 계획(안) — 붙임 문서. n = 심사위원 수(3~5)"""
    D = Doc()
    D.p("{{schoolName}} {{typeLabel}} 채용 계획(안)", D.big, "center")
    D.p("")
    D.p("{{schoolName}}", D.bold, "right")
    D.p("{{#BODY}}")
    D.protos()
    D.head_table([["과목(담당)", "인원(명)", "기간", "채용 사유"],
                  ["{{subject}}", "{{count}}", "{{periodText}}", "{{reasonText}}"]], [10000, 6000, 16000, 14000])
    D.p("{{#BODY2}}")
    D.head_table([["일  정", "날  짜", "비  고"]] +
                 [["{{s%d}}" % i, "{{d%d}}" % i, "{{n%d}}" % i] for i in range(1, 8)], [13000, 20000, 13000])
    D.p("{{#BODY3}}")
    D.head_table([["평가요소", "교원자격증", "경력", "직무관련 자격증", "자기소개서", "합계"],
                  ["배점", "{{dp1}}", "{{dp2}}", "{{dp3}}", "{{dp4}}", "{{dpSum}}"]], [8000, 7600, 7600, 7600, 7600, 7600])
    D.p("{{#BODY4}}")
    D.head_table([["평가요소", "교직자 품성", "교과 전문성", "업무수행 및 생활지도", "근무경력 및 자격증 활용", "합계"],
                  ["배점", "{{ip1}}", "{{ip2}}", "{{ip3}}", "{{ip4}}", "{{ipSum}}"]], [8000, 7600, 7600, 7600, 7600, 7600])
    D.p("{{#BODY5}}")
    D.head_table([["구분", "직위", "성명", "비고"],
                  ["심사위원회 위원장", "{{cp1}}", "{{cm1}}", ""]] +
                 [["심사위원", "{{cp%d}}" % i, "{{cm%d}}" % i, ""] for i in range(2, n + 1)], [12000, 10000, 12000, 12000])
    D.p("{{#BODY6}}")
    D.save("plan_%d.hwpx" % n)


def notice():
    """참고자료 4: 채용 공고문"""
    D = Doc()
    D.p("{{schoolName}} 공고 제{{year}} - {{noticeNo}}호", D.small)
    D.p("")
    D.p("{{schoolName}} {{typeLabel}} 채용 공고", D.big, "center")
    D.p("")
    D.p("{{#BODY}}")
    D.protos()
    D.table([
        ["구분", "제출서류", "제출일"],
        ["지원자\n공통", "가. 지원서 1부(서식, 사진 첨부, 연락 가능한 전화번호 반드시 기재)\n나. 자기소개서 1부(서식)\n다. 개인정보 수집·이용 동의서(서식)", "원서접수\n기간"],
        ["서류전형\n합격자", "라. 교원자격증 사본 또는 자격 인정 조서 1부\n마. 최종학력증명서 1부\n바. 경력증명서 1부", "면접시험\n당일"],
        ["최종\n합격자", "{{@finalDocs}}", "최종 합격 후\n학교 안내에\n따름"],
    ], [7000, 30000, 9000], lambda r, c: D.tinyb if (r == 0 or c == 0) else D.tiny)
    D.p("{{#BODY2}}")
    D.p("")
    D.p("{{noticeDate}}", D.body, "center")
    D.p("{{schoolName}}장", D.big, "center")
    D.save("notice.hwpx")


def contract():
    """서식 14: 기간제교원/전일제강사 채용계약서"""
    D = Doc()
    D.p("계약제교원 [{{typeLabel}}] 채용계약서", D.big, "center")
    D.p("")
    D.p("{{typeLabel}}를 채용하는 기관의 장을 “사용자”라 하고, {{typeLabel}}를 “근로자”라 하여 다음과 같이 채용계약을 체결한다.")
    D.p("")
    arts = [
        ("제1조(계약당사자)", ["(사용자) 주소: {{address}}", "              {{schoolName}}장", "(근로자) 주소:", "              성명:                      생년월일:"]),
        ("제2조(임무) {{typeLabel}}로 근무하는 “근로자”의 임무는 다음과 같다.",
         ["① “근로자”가 소지한 교원자격에 따라 수업을 담당한다.", "② 학교 교육활동 및 기타 특별활동을 지원한다.", "③ “업무분장”에 의한 기타의 업무를 수행한다."]),
        ("제3조(계약기간) 계약기간은 {{cStart}}부터 {{cEnd}}까지로 한다. (단, 계약기간 만료일 이전에 정규교사가 조기 복귀하는 경우 그 복귀일 전일에 계약이 만료되는 것으로 한다.)", []),
        ("제4조(채용구분) {{typeLabel}}", []),
        ("제5조(호봉 및 보수 지급 방법)",
         ["① “근로자”의 호봉은 ( {{grade}} )호봉이며, 법령이 정하는 바에 따라 소득세와 국민연금(비상환액) 등을 원천 징수한다. 이 경우 “근로자”의 호봉 및 승급은 ‘공무원보수규정’에 의한다.",
          "② 보수는 매월 ( {{payDay}} )일에 지급한다. 보수 지급일이 토요일 또는 공휴일인 때에는 그 전일에 지급한다.",
          "③ “근로자”의 근무일이 한 달이 되지 않는 경우에는 근무 개시일과 종료일을 기준으로 일할 계산하여 보수를 지급한다.",
          "④ “근로자”가 사전 허가 없이 무단결근 하였을 경우에는 결근일수 만큼 일할 계산하여 보수에서 공제한다.",
          "⑤ “근로자”는 본 계약에 규정된 보수 이외에는 일체의 다른 보수를 청구할 수 없다.",
          "⑥ 학교 휴업기간(또는 공휴일)의 보수는 {{holidayPay}}.",
          "⑦ 기타 “근로자”의 보수에 관련한 사항은 공무원보수규정 및 공무원수당규정을 준용한다."]),
        ("제6조(사직)", ["① “근로자”는 제3조에 규정된 임용 기간 동안 임무를 수행한다.",
                       "② “근로자”가 불가피하게 임용 기간 중도에 사직할 경우에는 30일 이전에 사직하는 일자와 사유를 서면으로 “사용자”에게 통보하여야 한다."]),
        ("제7조(근무지)", ["① “근로자”의 근무지는 “사용자”가 지정하는 ( {{schoolName}} )로 한다.",
                        "② “사용자”는 “근로자”의 근무지를 복수의 기관으로 지정하거나 겸임시킬 수 있다."]),
        ("제8조(근무시간)", ["① “근로자”는 1일 ( {{hoursPerDay}} )시간, 주 ( {{daysPerWeek}} )일을 근무하되 공휴일은 근무하지 않는다.",
                         "② “근로자”의 출퇴근 시간 및 근무시간은 정규교사의 근무시간을 준용하되, “사용자”가 조정할 수 있다.",
                         "③ “사용자”는 “근로자”에게 제①항 및 제②항에 의한 근무일 또는 근무 시간 이외의 근무를 지시할 수 있다. 이 경우에는 시간 외 수당을 지급할 수 있다."]),
        ("제9조(휴가 등)", ["① “근로자”는 국가공무원복무규정에서 정한 휴가를 정규교사에 준하여 실시할 수 있으며 휴가일수 및 업무처리는 ‘국가공무원복무규정’ 및 ‘교원휴가에 관한 예규’를 준용하되, 경상북도교육청 계약제교원 운영 지침에 따른다.",
                         "② 제1항에 의한 휴가자의 보수는 관계 규정에 의하여 지급한다."]),
        ("제10조(병가)", ["① “근로자”는 계약기간 중 업무수행이 곤란할 정도의 질환이 있을 때에는 “사용자”의 사전 승인을 받아 병가를 받을 수 있다.",
                       "② 병가 기간은 총 ( {{sickDays}} )일 이내로 한다.",
                       "③ 공무상 질병 또는 부상으로 직무를 수행할 수 없거나 요양을 요할 경우에는 감독기관의 승인을 받아 연 180일의 범위 안에서 유급으로 허가할 수 있다. 다만, 6개월 미만의 단기간 계약자가 요양이 필요한 경우의 병가는 “사용자”가 판단하여 그 기간을 적정한 범위 내에서 조정하여 허가할 수 있다."]),
        ("제11조(복무) “근로자”의 기타 복무에 관한 사항은 국가공무원법 제7장(복무)의 규정 및 국가공무원복무규정 제1장(총칙), 제4장(영리업무 및 겸직), 제5장(정치운동 및 노동운동)의 규정을 적용한다.", []),
        ("제12조(계약의 해지)", ["① “사용자”는 “근로자”가 다음 각 호의 어느 하나에 해당할 경우 본 계약을 해지할 수 있다."] + TERMS + [
            "② 제1항 각호의 사유로 인하여 계약이 해지되는 경우, “사용자”는 “근로자”에게 보수를 일할 계산하여 지급한다."]),
        ("제13조(성과상여금) 성과상여금과 관련한 사항은 당해 연도 성과상여금지급지침에 따른다.", []),
        ("{{art14}}", []),
        ("{{art15}}", []),
        ("제16조(기타 채용조건)", ["① 위 계약으로 정하지 않은 사항은 국가공무원법 및 교육공무원법 등에서 정한 교육공무원 인사 및 복무 관계 규정 등을 준용한다.",
                               "② 기타 필요한 사항은 “사용자”와 “근로자”가 합의하여 정한다."]),
    ]
    for head, items in arts:
        D.p(head, hang=5)
        for it in items:
            D.p(it, left=3, hang=4)
    sign(D)
    D.save("contract.hwpx")


TERMS = [
    "  1. 업무를 태만히 하거나 업무 수행 능력이 부족한 때",
    "  2. 신체·정신상의 이상으로 계약기간 내에 계약 내용을 수행하기 곤란한 때",
    "  3. 복무상 의무 및 금지사항을 위반한 때",
    "  4. 채용 자격에 결격 사유가 있거나 형사 사건으로 기소된 때, 다만, 약식 명령이 청구된 경우에는 제외(성폭력범죄, 아동학대범죄, 혈중알콜농도 0.03% 이상 음주운전(음주측정 불응 포함) 적발 시에는 약식명령이 청구된 경우도 계약 해지)",
    "  5. 특별한 이유 없이 1주일 이상 연속하여 근무하지 않는 경우",
    "  6. 부당한 방법으로 채용된 경우",
    "  7. 성추행 및 성폭행 등 성비위 관련 물의를 일으킨 경우",
    "  8. 휴직 교사가 조기 복직하거나 별도 정원 교사가 복직하게 된 때",
    "  9. 기타 사회통념상 본 계약을 계속하기 어려운 사유가 발생한 경우",
    "  10. 기타 동 계약서에 의한 임무를 성실하게 수행하지 않는 경우",
]


def sign(D):
    D.p("")
    D.p("본 계약서는 2통을 작성하여 각각 1통씩 보관한다.")
    D.p("")
    D.p("{{contractDate}}", D.body, "center")
    D.p("")
    D.p("“사용자”: {{schoolName}}장          (인)", D.body, "right")
    D.p("“근로자”: 성명                      (인)", D.body, "right")


def contract_hourly():
    """서식 15: 시간강사 근로계약서"""
    D = Doc()
    D.p("계약제교원(시간강사) 근로계약서", D.big, "center")
    D.p("")
    D.p("{{schoolName}}장(이하 “사용자”라 함)과 ○○○(이하 “근로자”라 함)은 다음과 같이 근로계약을 체결한다.")
    D.p("")
    arts = [
        ("제1조(계약당사자)", ["(사용자) 주소: {{address}}", "              {{schoolName}}장", "(근로자) 주소:", "              성명:                      생년월일:"]),
        ("제2조(계약기간) 계약기간은 {{cStart}}부터 {{cEnd}}까지로 한다. (단, 계약기간 만료일 이전에 정규교사가 조기 복귀하거나, 수업이 폐지될 경우에는 계약기간은 자동으로 종료됨)", []),
        ("제3조(채용구분) 시간강사", []),
        ("제4조(근로장소 및 업무내용)", ["① 근무장소: {{schoolName}} 및 관할 장소", "② 업무내용: {{subject}}"]),
        ("제5조(근로시간 및 휴게시간)", ["① 근로일은 ( {{workDays}} )이며, 근로시간은 총 ( {{totalHours}} )시간이다.",
                                   "② 제①항의 근로일, 근로시간은 교육운영상 필요에 따라 상호 협의하에 변경할 수 있음."]),
        ("제6조(임금 등)", ["① (지급형태 및 수준) 시간당 ( {{hourlyRate}} )원으로 한다. (4시간 초과 시간당 10,000원)",
                         "② (지급일) 당월 ( {{payDay}} )일, 임금 지급일이 토요일 또는 공휴일인 경우에는 전일에 지급한다."]),
        ("제7조(휴일 및 휴가 등) 근로기준법에서 정하는 바에 따르되, 사용자와 근로자가 합의하여 정한다.", []),
        ("제8조(계약의 해지) “사용자”는 “근로자”가 다음 각 호의 어느 하나에 해당할 경우 본 계약을 해지할 수 있다.", TERMS),
        ("제9조(기타) 위 계약에서 정하지 아니한 사항은 사용자와 근로자가 합의하여 정하되, 근로기준법을 포함한 각종 노동관계법령에서 정하는 바에 따른다.", []),
    ]
    for head, items in arts:
        D.p(head, hang=5)
        for it in items:
            D.p(it, left=3, hang=4)
    sign(D)
    D.save("contract_hourly.hwpx")


def report():
    """서식 21: 기간제교원 임용사항 보고(기안)"""
    D = Doc()
    gian_header(D)
    D.p("{{#BODY}}")
    D.protos()
    D.table([
        ["성명\n(한자)", "생년\n월일", "성별", "자격\n종별", "자격증\n번호", "담당\n과목", "임용기간", "임용사유", "호봉", "퇴직교원\n임용 여부", "퇴직종류\n(퇴직일자)", "공고\n횟수"],
        ["○○○\n(   )", "", "", "{{certType}}", "", "{{subject}}", "{{periodText}}", "{{reasonText}}", "{{grade}}", "{{retiredYN}}", "{{retireKind}}", "{{noticeCount}}"],
    ], [3600, 3400, 2400, 3600, 3800, 3600, 5600, 5400, 2600, 4000, 4400, 3000], lambda r, c: D.tinyb if r == 0 else D.tiny)
    D.p("{{#BODY2}}")
    D.table([
        ["구분", "아동·청소년 관련기관 등에의\n취업제한 여부\n(성범죄경력 조회결과)", "아동관련기관의\n취업제한 여부\n(아동학대관련범죄 전력 조회결과)", "마약·대마·향정신성의약품\n중독자 여부 판별 검진결과"],
        ["○○○", "", "", ""],
    ], [7000, 13000, 13000, 13000], lambda r, c: D.tinyb if r == 0 else D.tiny)
    D.p("{{#BODY3}}")
    footer(D)
    D.save("report.hwpx")


def form25():
    """서식 25: 기간제교원 육아휴직원"""
    D = Doc()
    D.p("육 아 휴 직 원", D.title, "center")
    D.p("")
    D.p("□ 양육대상 자녀", D.bold)
    D.table([
        ["자녀 구분", "{{childOrder}}", "생년월일", "{{childBirth}}", "성 명", ""],
        ["휴직가능\n여부확인", "{{eligible}}", None, None, None, None],
        ["주 소", "", None, None, None, None],
        ["휴직신청\n기간", "{{leavePeriod}}", None, None, None, None],
    ], [8000, 9000, 7000, 9000, 6000, 7000], lambda r, c: D.bold if c in (0, 2, 4) and r == 0 or c == 0 else D.body,
        merges=("B2:F2", "B3:F3", "B4:F4"))
    D.p("")
    D.p("□ 기 육아휴직 사용 기간", D.bold)
    D.p("자녀 모두에 대하여 기 사용한 육아휴직 기간 기입", D.small)
    D.table([["사용 기간", "대상자녀 성명", "생년월일"]] + [["{{u%d}}" % i, "", ""] for i in range(1, 7)],
            [26000, 10000, 10000], lambda r, c: D.bold if r == 0 else D.body)
    D.p("")
    D.p("상기 자녀의 양육으로 인하여 이미 사용한 육아휴직 조회에 동의하며, 육아휴직하고자 증빙서를 붙여 제출하오니 허가하여 주시기 바랍니다.")
    D.p("")
    D.p("{{applyDate}}", D.body, "center")
    D.p("")
    D.p("소        속 : {{schoolName}}", D.body, "right")
    D.p("직위(교과) : 기간제교원({{subject}})", D.body, "right")
    D.p("생 년 월 일 :                              ", D.body, "right")
    D.p("성        명 :                         (인)", D.body, "right")
    D.p("")
    D.p("{{schoolName}}장 귀하", D.big)
    D.save("form25.hwpx")


def form26():
    """서식 26: 기간제교원 육아휴직 복직원"""
    D = Doc()
    D.p("복  직  원", D.title, "center")
    D.p("")
    D.p("")
    D.p("자녀(성명:          , {{childBirth}} 생) 양육으로 인하여 {{leaveFrom}}부터 {{leaveTo}}까지({{leaveMonths}}개월간) 휴직한 바 「남녀고용평등과 일·가정 양립 지원에 관한 법률 시행령」 제14조제1항에 따른 사유로 종료되었기에 증빙서를 붙여 제출하오니 허가하여 주시기 바랍니다.")
    D.p("")
    D.p("복직 예정일: {{returnDate}}")
    D.p("")
    D.p("{{applyDate}}", D.body, "center")
    D.p("")
    D.p("소        속 : {{schoolName}}", D.body, "right")
    D.p("직위(교과) : 기간제교원({{subject}})", D.body, "right")
    D.p("생 년 월 일 :                              ", D.body, "right")
    D.p("성        명 :                         (인)", D.body, "right")
    D.p("")
    D.p("{{schoolName}}장 귀하", D.big)
    D.save("form26.hwpx")


def form28():
    """서식 28: 중도 계약 해지(예고) 확인서"""
    D = Doc()
    D.p("중도 계약 해지(예고) 확인서", D.title, "center")
    D.p("")
    D.table([
        ["성    명", ""],
        ["생년월일", ""],
        ["소    속", "{{schoolName}}"],
        ["직", "{{position}}"],
        ["계약기간", "{{contractPeriod}}"],
        ["해 지 일", "{{endDay}} (최종근로일 다음날)"],
        ["계약 해지\n사유", "{{@reasonLines}}"],
    ], [10000, 36000], lambda r, c: D.bold if c == 0 else D.body)
    D.p("")
    D.p("{{noticeDate}}", D.body, "center")
    D.p("")
    D.p("{{schoolName}}장 (직인)", D.big, "center")
    D.p("")
    D.p("※ 본인이 수령을 거부할 경우에는 내용증명(우편) 발송도 가능함.", D.small)
    D.p("※ 계약기간 만료 전 중도 계약 해지 시 공문으로 즉시 보고(해임일로부터 5일 이내)", D.small)
    D.save("form28.hwpx")


def form3():
    """서식 3: 심사위원 서약서"""
    D = Doc()
    D.p("심사위원 서약서", D.title, "center")
    D.p(""); D.p("")
    D.p("본인은 {{year}}학년도 {{schoolName}} 『{{typeLabel}}』 임용 심사위원으로서 부여된 임무를 성실히 수행할 것이며, 심사위원으로서 알게 된 심사자료 등에 대해서 누구에게도 누설하지 아니할 것을 서약합니다.")
    D.p(""); D.p("")
    D.p("{{dateText}}", D.body, "center")
    D.p(""); D.p("")
    D.p("소속 : {{schoolName}}", D.body, "right")
    D.p("직위 :                              ", D.body, "right")
    D.p("성명 :                     (서명)", D.body, "right")
    D.p(""); D.p("")
    D.p("{{schoolName}}장 귀하", D.big)
    D.save("form3.hwpx")


ROWS = 8


def form4():
    """서식 4: 서류심사 평가표"""
    D = Doc()
    D.p("{{typeLabel}} 서류심사 평가표", D.big, "center")
    D.p("")
    D.p("▣ 평가내용", D.bold)
    D.table([
        ["평가 요소", "평가 기준"],
        ["① 교원자격증({{dp1}}점)", "◈ 전공 자격증 소지자({{c1a}}점)\n◈ 부전공 자격증 소지자({{c1b}}점)\n◈ 신규임용후보자 가점({{c1c}}점)"],
        ["② 경력({{dp2}}점)", "◈ 학교근무 경력 5년 이상({{c2a}}점)\n◈ 학교근무 경력 1년 이상 5년 미만({{c2b}}점)\n◈ 학교근무 경력 1년 미만({{c2c}}점)"],
        ["③ 직무관련 자격증({{dp3}}점)", "◈ 직무관련 자격증 2개 이상 소지({{c3a}}점)\n◈ 직무관련 자격증 1개 소지({{c3b}}점)\n◈ 직무관련 자격증 미소지({{c3c}}점)"],
        ["④ 자기소개서({{dp4}}점)", "◈ 자기소개서 내용 충실({{c4a}}점)\n◈ 자기소개서 내용 보통({{c4b}}점)\n◈ 자기소개서 내용 미흡({{c4c}}점)"],
    ], [14000, 32000], lambda r, c: D.bold if r == 0 or c == 0 else D.body)
    D.p("")
    D.p("▣ 평가 결과", D.bold)
    D.head_table([["연번", "지원자", "①", "②", "③", "④", "합계({{dpSum}}점)"]] +
                 [[str(i), "{{n%d}}" % i, "", "", "", "", ""] for i in range(1, ROWS + 1)],
                 [4000, 12000, 5500, 5500, 5500, 5500, 8000])
    D.p("")
    D.p("평 가 자   소속 : {{schoolName}}     직 :            성명 :                 (서명)", D.body, "right")
    D.p("※ 학교의 여건에 맞게 평가 기준 및 평가 점수를 조정하여 사용", D.small)
    D.save("form4.hwpx")


def form6():
    """서식 6: 면접심사 평가표"""
    D = Doc()
    D.p("{{typeLabel}} 면접심사 평가표", D.big, "center")
    D.p("")
    D.p("▣ 면접 문항", D.bold)
    D.table([
        ["평가요소", "문항", "상", "중", "하"],
        ["① 교직자 인성\n({{ip1}}점)", "1. 교원이 갖추어야 할 덕목 중 가장 중요한 것은 무엇이라 생각하며, 그 이유는 무엇입니까?\n2. 직원 간의 협조가 잘 안될 때 어떻게 대처하겠습니까?\n3. 학교에서 필요시 퇴근시간 이후에도 근무할 용의가 있습니까?", "{{h1}}", "{{m1}}", "{{l1}}"],
        ["② 교과 전문성\n({{ip2}}점)", "1. 수행평가를 실시하는 목적은 무엇이라 생각합니까?\n2. 해당 교과에서 적용할 수 있는 대표적인 수행평가 방법을 말씀해 주십시오.\n3. 학습지도안 작성 시 포함되는 내용을 말씀해 보세요.\n4. 정기고사 실시 후 특정 문항의 정답에 대하여 이의 제기가 있을 때, 어떻게 처리하시겠습니까?", "{{h2}}", "{{m2}}", "{{l2}}"],
        ["③ 업무수행 및\n생활지도({{ip3}}점)", "1. 선생님의 정당한 지시에 잘 따르지 않는 학생이 있다면 어떻게 지도하시겠습니까?\n2. 학생상담 시 유의해야 할 사항은 무엇이라 생각합니까?\n3. NEIS와 업무관리시스템에 대하여 아는 대로 설명해 보세요.", "{{h3}}", "{{m3}}", "{{l3}}"],
        ["④ 근무경력 및\n자격증 활용({{ip4}}점)", "1. 이전에 학생을 직접 지도해 보신 적이 있습니까?\n2. 어떤 자격증을 소지하고 있으며, 교육현장에서 어떻게 활용할 수 있나요?\n3. 선생님을 채용할 경우 우리 학교나 학생들에게 줄 수 있는 만족은 무엇이라 생각합니까?", "{{h4}}", "{{m4}}", "{{l4}}"],
    ], [8500, 28500, 3000, 3000, 3000], lambda r, c: D.tinyb if r == 0 or c == 0 else D.tiny)
    D.p("※ 학원 강사(또는 운영) 및 과외 교습 여부에 대해 별도로 확인할 것. 면접 심사 기준과 관련 없고 인권 침해 소지가 있는 질문은 하지 않습니다.", D.small)
    D.p("")
    D.p("▣ 평가 결과", D.bold)
    D.head_table([["연번", "지원자", "①", "②", "③", "④", "합계({{ipSum}}점)"]] +
                 [[str(i), "{{n%d}}" % i, "", "", "", "", ""] for i in range(1, ROWS + 1)],
                 [4000, 12000, 5500, 5500, 5500, 5500, 8000])
    D.p("")
    D.p("평 가 자   소속 : {{schoolName}}     직 :            성명 :                 (서명)", D.body, "right")
    D.save("form6.hwpx")


def form8():
    """서식 8: 수업실연 평가표"""
    D = Doc()
    D.p("{{typeLabel}} 수업실연 평가표", D.big, "center")
    D.p("")
    D.p("과    목 : {{subject}}                관리번호 :          ")
    D.head_table([["평가 기준", "상(10점)", "중(8점)", "하(5점)"],
                  ["1. 수업 계획의 적절성", "", "", ""], ["2. 수업 구상 능력", "", "", ""],
                  ["3. 발음 및 발문 능력", "", "", ""], ["4. 태도 및 동작의 적절성", "", "", ""],
                  ["소계", "", "", ""], ["합계", "/40점", None, None]], [19000, 9000, 9000, 9000])
    D.p("")
    D.p("심사위원 확인   성명 :                 (서명)", D.body, "right")
    D.p("")
    D.p("[수업실연 진행 요령]", D.bold)
    for t in ["1. 해당 학년(교과)에서 적정 단원을 지정하여 수업 지도안 작성 출제(단원명, 차시, 구상 시 고려 사항, 학급 구성, 차시 수업에 포함되어야 할 내용, 수업시간, 단원 목표, 지문 등 필수 요소 제시)",
              "2. 수업 지도안 작성(40~50분 정도)", "3. 수업 실연(10분 정도)"]:
        D.p(t, left=3, hang=4)
    D.p("※ 학교의 여건에 맞게 평가 기준 및 평가 점수를 조정하여 사용", D.small)
    D.save("form8.hwpx")


def tally(j):
    """서식 5·7: 점수 집계표(심사위원 j명)"""
    D = Doc()
    D.p("{{typeLabel}} {{phase}} 점수 집계표", D.big, "center")
    D.p("")
    for i in range(1, j + 1):
        D.p("심사위원 %d :                (인)" % i, D.body, "right")
    D.p("")
    w_judge = 4600
    widths = [3200, 9000] + [w_judge] * j + [5000, 5000, 3500]
    widths[1] += 46000 - sum(widths)
    D.head_table([["연번", "지원자"] + ["위원%d" % i for i in range(1, j + 1)] + ["합계", "평균", "순위"]] +
                 [["{{r%d_no}}" % r, "{{r%d_n}}" % r] + ["{{r%d_%d}}" % (r, k) for k in range(1, j + 1)] + ["{{r%d_s}}" % r, "{{r%d_a}}" % r, "{{r%d_k}}" % r]
                  for r in range(1, 11)], widths)
    D.p("")
    D.p("※ {{note}}", D.small)
    D.p("")
    D.p("{{dateText}}", D.body, "center")
    D.p("{{schoolName}}장", D.big, "center")
    D.save("tally_%d.hwpx" % j)


# ---------------------------------------------------------------- 호봉획정표([별지 제16호 서식])
def hobong_sheet():
    D = Doc()
    D.p("[별지 제16호 서식]", D.tiny)
    D.p("호 봉 획 정 표", D.title, "center")
    D.p("* 호봉획정사유 : {{reason}}", D.small)
    D.table([["(1)소속", "{{org}}", None, "(2)제청(내신)자격", "(3)현직위(급)"],
             ["(4)성명", "", None, "{{cert}}", "{{position}}"],
             ["(5)학력", "사범계", "{{edu1}}", "(6)현호봉", "{{curGrade}}"],
             [None, "비사범계", "{{edu2}}", None, None]],
            [7000, 6000, 15000, 9000, 9000], lambda r, c: D.bold if (c == 0 or (c == 3 and r != 1) or (r == 0 and c == 4)) else D.body,
            merges=("B1:C1", "B2:C2", "A3:A4", "D3:D4", "E3:E4"))
    D.p("")
    W = [5200, 5200, 8000, 2400, 2400, 2400, 3400, 2400, 2400, 2400, 9800]
    D.table([["(7)경력기간", None, "(8)경력내용", "(9)경력년수", None, None, "(10)\n환산율", "(11)환산년수", None, None, "(12)비고"],
             ["부터", "까지", None, "년", "월", "일", None, "년", "월", "일", None],
             ["{{%%r:%d}}" % i for i in range(11)],
             ["(13)계", None, None, "{{s9y}}", "{{s9m}}", "{{s9d}}", "", "{{s11y}}", "{{s11m}}", "{{s11d}}", ""]],
            W, lambda r, c: D.tinyb if r in (0, 1, 3) else D.tiny,
            merges=("A1:B1", "C1:C2", "D1:F1", "G1:G2", "H1:J1", "K1:K2", "A4:C4"))
    D.p("")
    D.table([["(14)환산\n총경력년수", "(15)가감\n년수", "(16)호봉\n획정경력년수", "(17)사정호봉", "※호봉\n획정(승급)일", "(18)사정호봉에 요하는\n경력년수"],
             ["{{p14}}", "{{p15}}", "{{p16}}", "{{grade}}", "{{date}}", "{{p18}}"]],
            [8400, 5600, 8400, 6600, 7000, 10000], lambda r, c: D.tinyb if r == 0 else D.small)
    D.p("")
    D.table([["작성자 직위(급) : {{writerPos}}", "성명 :                (인)", "잔여월수 : {{rest}} ({{date}} 현재)"],
             ["확인자 직위(급) : {{checkerPos}}", "성명 :                (인)", "차기승급일 : {{next}}"]],
            [15000, 13000, 18000], lambda r, c: D.small)
    D.p("")
    D.p("{{limitText}}", D.tiny)
    D.p("※ 경력년수는 년·월·일로 계산(1년=12월, 1월=30일)하고, 환산년수는 경력기간 × 환산율(일 미만 버림). 같은 기간에 겹치는 경력은 유리한 것 하나만 인정. 유사경력은 전력조회(서식 12·13) 결과로 확정.", D.tiny)
    D.p("※ 기간제교원은 계약 기간 중 호봉 정정·재획정·승급을 하지 않음(고정급). 차기승급일은 참고용.", D.tiny)
    D.save("hobong.hwpx")


# ---------------------------------------------------------------- 최종합격자 서류 묶음
def bundle():
    D = Doc()
    D.p("")
    def sign(name_line=True):
        D.p("")
        D.p("{{date}}", D.body, "center")
        D.p("")

    # 서식 9
    D.p("{{?f9}}")
    D.p("계약제교원 채용을 위한 개인정보 수집·이용 동의서(지원자용)", D.big, "center", pb=True)
    D.p("")
    D.p("계약제교원 채용 및 관리를 위하여 「개인정보보호법」 제15조, 제17조 및 제22조 등 관계 법령에 따라 아래와 같이 개인정보를 수집·이용하고자 합니다.")
    D.p("")
    D.p("○ 개인정보 수집·이용 내역", D.bold)
    D.table([["항목", "성명, 생년월일, 성별, 주소, 사진, 연락처, 학력사항, 경력사항, 자격사항 등 채용 관련 자료"],
             ["수집·이용 목적", "채용 및 서류심사"], ["보유·이용 기간", "채용 종료 후 180일까지"]], [10000, 36000], lambda r, c: D.bold if c == 0 else D.body)
    D.p("※ 개인정보 수집·이용에 대한 동의를 거부할 권리가 있습니다. 그러나 동의를 거부할 경우 원활한 채용심사를 할 수 없어 채용에 제한을 받을 수 있습니다.", D.small)
    D.p("")
    D.p("○ 개인정보 수집·이용 동의", D.bold)
    D.p("개인정보 수집·이용에 동의하십니까?        □ 동의함     □ 동의하지 않음")
    D.p("")
    D.p("개인정보 제공자가 동의한 내용 이외의 다른 목적으로 활용하지 않으며, 제공된 개인정보의 이용을 거부하고자 할 때에는 개인정보 관리책임자를 통해 열람, 정정, 삭제를 요구할 수 있습니다.")
    sign()
    D.p("본인 성명                    (서명 또는 인)", D.body, "right")
    D.p("")
    D.p("{{schoolName}}장 귀하", D.big)
    D.p("{{/f9}}")

    # 서식 10
    D.p("{{?f10}}")
    D.p("계약제교원 채용을 위한 개인정보 수집·이용 동의서(최종합격자용)", D.big, "center", pb=True)
    D.p("")
    D.p("계약제교원 채용 및 관리를 위하여 「개인정보보호법」 제15조, 제17조 및 제22조 등 관계 법령에 따라 아래와 같이 개인정보를 수집·이용하고자 합니다.")
    D.p("")
    D.p("○ 개인정보 수집·이용 내역", D.bold)
    D.table([["항목", "계좌정보(은행, 계좌번호, 예금주)"], ["수집·이용 목적", "근로계약 체결"], ["보유·이용 기간", "계약 종료 후 180일까지"]],
            [10000, 36000], lambda r, c: D.bold if c == 0 else D.body)
    D.p("※ 개인정보 수집·이용에 대한 동의를 거부할 권리가 있습니다. 그러나 동의를 거부할 경우 근로계약을 체결할 수 없어 채용에 제한을 받을 수 있습니다.", D.small)
    D.p("")
    D.p("○ 개인정보 수집·이용 동의", D.bold)
    D.p("개인정보 수집·이용에 동의하십니까?        □ 동의함     □ 동의하지 않음")
    D.p("")
    D.p("○ 주민등록번호·외국인등록번호 처리 사항 고지", D.bold)
    D.p("「개인정보 보호법」 제24조의2에 따라 정보주체의 동의 없이 주민등록번호를 처리합니다.")
    D.table([["개인정보 처리 목적", "개인정보항목", "처리 근거"],
             ["근로계약 체결(채용)\n원천징수의무자 등의\n주민등록번호 기재", "주민등록번호\n외국인등록번호", "「소득세법」 제127조 및 제137조 및 「국세기본법」 시행령 제68조\n「교육공무원법」 제32조\n「초중등교육법」 제22조"]],
            [12000, 10000, 24000], lambda r, c: D.tinyb if r == 0 else D.tiny)
    D.p("")
    D.p("개인정보 제공자가 동의한 내용 이외의 다른 목적으로 활용하지 않으며, 제공된 개인정보의 이용을 거부하고자 할 때에는 개인정보 관리책임자를 통해 열람, 정정, 삭제를 요구할 수 있습니다.")
    sign()
    D.p("본인 성명                    (서명 또는 인)", D.body, "right")
    D.p("")
    D.p("{{schoolName}}장 귀하", D.big)
    D.p("{{/f10}}")

    # 서식 17
    D.p("{{?f17}}")
    D.p("근무실적 평가 결과 활용 동의서", D.title, "center", pb=True)
    D.p("")
    D.p("")
    D.p("본인은 {{cFrom}} ∼ {{cTo}}까지 {{schoolName}} 기간제교원으로 임용되어 복무하는 동안, 기간제교원 인력풀 등재를 위한 목적으로 실시하는 근무기간 동안의 근무실적(근무상황, 학습지도, 업무수행능력, 학생생활지도 등) 종합평가에 동의합니다.")
    sign()
    D.p("성명 :                    (서명)", D.body, "right")
    D.p("생년월일 :                         ", D.body, "right")
    D.p("주소 :                              ", D.body, "right")
    D.p("")
    D.p("{{schoolName}}장 귀하", D.big)
    D.p("{{/f17}}")

    # 서식 19
    D.p("{{?f19}}")
    D.p("성범죄 경력조회 및 아동학대관련범죄 전력조회 동의서", D.big, "center", pb=True)
    D.p("")
    D.table([["대상자", "성명", "한글 :                    한자 :                    영문 :"],
             [None, "주민등록번호", "              -              (외국인: 국적과 여권번호 또는 외국인등록번호)"],
             [None, "주소", ""],
             [None, "전화번호", "자택 :                         휴대전화 :"]],
            [6000, 9000, 31000], lambda r, c: D.bold if c < 2 else D.body, merges=("A1:A4",))
    D.p("")
    D.p("본인은 교육기관(시설)(예: 유치원, 어린이집, 아동복지시설, 청소년쉼터, 청소년활동시설, 의료기관 등)을 운영하려는 자, 취업(예정)자 또는 노무 제공(예정)자로서, 「아동ㆍ청소년의 성보호에 관한 법률」 제56조 및 같은 법 시행령 제25조에 따른 성범죄경력 조회, 「아동복지법」 제29조의3에 따른 아동학대 관련 범죄전력 조회 신청에 동의합니다.")
    D.p("")
    D.p("      년      월      일", D.body, "right")
    D.p("동의자                    (서명 또는 인)", D.body, "right")
    D.p("")
    D.p("경찰서장 귀하", D.big)
    D.p("")
    D.p("유의사항", D.bold, "center")
    for t in ["1. 개인정보 수집항목 : 성명, 주민등록번호, 외국인의 경우 외국인등록번호",
              "2. 대상자가 외국인의 경우 성명(영문), 외국인등록번호를 적습니다.",
              "3. 개인정보 제공 거부에 따른 제한사항 : 귀하는 개인정보 제공 동의를 거부할 권리가 있으나, 동의 거부 시에는 취업에 제한을 받을 수 있습니다.",
              "4. 개인정보의 보유 : 수집된 개인정보는 성범죄·아동학대 관련 범죄 경력 조회 신청 등을 위하여 사용됩니다."]:
        D.p(t, D.small, hang=3)
    D.p("{{/f19}}")

    # 서식 20
    D.p("{{?f20}}")
    D.p("행정정보 공동이용 사전동의서", D.title, "center", pb=True)
    D.p("")
    D.table([["이용기관 명칭", "{{schoolName}}"], ["이용사무(이용목적)", "결격사유 및 범죄경력 조회(계약제교원 채용)"],
             ["행정정보 공동이용을 위해 제공하는 정보", "성명, 생년월일, 전화번호, 고유식별번호"], ["공동이용 행정정보(구비서류)", "결격사유 유무 조회\n범죄경력 유무 조회"]],
            [16000, 30000], lambda r, c: D.bold if c == 0 else D.body)
    D.p("")
    D.p("본인은 위 사무의 처리를 위하여 「전자정부법」 제36조에 따른 행정정보의 공동이용을 통하여 이용기관의 업무처리담당자가 전자적으로 본인의 공동이용 행정정보(첨부서류)를 확인하는 것에 동의합니다.")
    D.p("※ 행정정보의 공동이용에 대하여 동의하지 아니할 경우에도 불이익은 없으며, 동의하지 아니한 경우 본인이 해당 구비서류를 직접 제출하여야 합니다.", D.small)
    D.p("")
    D.p("이용기관은 본인이 동의한 위 공동이용 행정정보를 확인하기 위해 「전자정부법 시행령」 제90조에 따라 주민등록번호, 여권번호, 운전면허의 면허번호 또는 외국인등록번호가 포함된 행정정보를 처리할 수 있습니다. 이용기관이 요청하는 경우 기재하여 주십시오.")
    D.p("(제공항목 체크) [  ]주민등록번호(            )  [  ]여권번호(            )", D.small)
    D.p("                    [  ]운전면허의 면허번호(            )  [  ]외국인등록번호(            )", D.small)
    D.p("")
    D.p("      년      월      일", D.body, "right")
    D.p("대상자(본인) 성명 :                (서명 또는 인)", D.body, "right")
    D.p("생년월일 :                        ", D.body, "right")
    D.p("전화번호 :                        ", D.body, "right")
    D.p("")
    D.p("{{schoolName}}장 귀하", D.big)
    D.p("{{/f20}}")

    # 서식 22
    D.p("{{?f22}}")
    D.p("서  약  서", D.title, "center", pb=True)
    D.p("")
    D.p("")
    D.p("본인은 {{schoolName}}장과 「계약제교원 채용계약」을 체결함에 있어 유관기관을 통한 결격사유조회에서 채용 결격사유가 발생할 경우 계약취소됨을 조건으로 계약함을 서약합니다.")
    sign()
    D.p("성       명 :                    (서명)", D.body, "right")
    D.p("생 년 월 일 :                         ", D.body, "right")
    D.p("주       소 :                         ", D.body, "right")
    D.p("")
    D.p("{{schoolName}}장 귀하", D.big)
    D.p("{{/f22}}")

    # 서식 23
    D.p("{{?f23}}")
    D.p("서  약  서", D.title, "center", pb=True)
    D.p("")
    D.p("")
    D.p("본인은 {{schoolName}}장과 「(시간)강사 채용계약」을 체결함에 있어 「초·중등교육법」 제22조, 「교육공무원법」 제10조의4 및 「국가공무원법」 제33조에 해당하는 결격사유가 없음을 확인하며, 계약기간 중 채용 결격사유가 발생할 경우 계약 취소됨을 조건으로 계약함을 서약합니다.")
    sign()
    D.p("성       명 :                    (서명)", D.body, "right")
    D.p("생 년 월 일 :                         ", D.body, "right")
    D.p("주       소 :                         ", D.body, "right")
    D.p("")
    D.p("{{schoolName}}장 귀하", D.big)
    D.p("{{/f23}}")

    # 서식 24
    D.p("{{?f24}}")
    D.p("■ 채용절차의 공정화에 관한 법률 시행규칙 [별지 제3호서식]", D.tiny, pb=True)
    D.p("채용서류 반환청구서", D.title, "center")
    D.p("")
    D.table([["접수번호", "", "접수일자", ""], ["청구인", "성명 :", "수험번호", ""], ["주 소", "", None, None],
             ["반환장소\n(주소와 다른 경우 기재)", "", None, None], ["반환청구서류", "", None, None]],
            [9000, 14000, 9000, 14000], lambda r, c: D.bold if c in (0, 2) else D.body, merges=("B3:D3", "B4:D4", "B5:D5"))
    D.p("")
    D.p("「채용절차의 공정화에 관한 법률」 제11조 및 같은 법 시행령 제2조 및 제4조에 따라 위와 같이 채용서류의 반환을 청구합니다.")
    D.p("")
    D.p("      년      월      일", D.body, "right")
    D.p("청구인                    (서명 또는 인)", D.body, "right")
    D.p("")
    D.p("{{schoolName}}장 귀하", D.big)
    D.p("")
    D.p("공지사항", D.bold, "center")
    for t in ["1. 「채용절차의 공정화에 관한 법률 시행령」 제2조제1항에 따라 신청인이 채용서류의 반환을 요청하면 해당 사업장은 14일 이내에 반환요구서류를 발송하도록 하고 있습니다.",
              "2. 「채용절차의 공정화에 관한 법률 시행령」 제2조제2항에 따라 반환요구서류는 특수취급우편물을 통해서 전달받거나, 사업장으로부터 직접 전달받을 수 있습니다.",
              "3. 「채용절차의 공정화에 관한 법률」 제11조제5항 및 같은 법 시행령 제5조제2항에 따라 채용서류의 반환에 드는 비용을 청구인이 부담할 수 있습니다."]:
        D.p(t, D.small, hang=3)
    D.p("{{/f24}}")
    D.save("bundle.hwpx")


# ---------------------------------------------------------------- 서식 18
def form18():
    D = Doc()
    D.p("기간제교원 근무실적 평가서", D.big, "center")
    D.p("")
    D.table([["학교명", "{{schoolName}}", "성 명", "", "성별", ""],
             ["근무기간", "{{period}}", "생년월일", "", "과목", "{{subject}}"]],
            [6000, 12400, 6000, 8000, 5000, 8600], lambda r, c: D.bold if c % 2 == 0 else D.body)
    D.p("")
    D.table([["순", "평 가 요 소", "매우우수", "우수", "보통", "미흡", "점수", "비고"],
             ["1", "교육자로서의 품성(10점)", "10", "9", "8", "7", "{{s1}}", "교육자로서의 품성과 태도"],
             ["2", "학습지도(수업 실행, 평가)(30점)", "30", "28", "26", "24", "{{s2}}", "학습지도능력 및 공개수업 참고"],
             ["3", "생활지도(30점)", "30", "28", "26", "24", "{{s3}}", "학생과의 소통 및 상담 횟수 등을 참고"],
             ["4", "전문성 개발 및 연수 이수(15점)", "15", "13", "11", "9", "{{s4}}", "연수 40시간 이수(법정의무교육(원격) 연수 포함)"],
             ["5", "담당업무(15점)", "15", "13", "11", "9", "{{s5}}", "수업시수, 담임 및 보직, 동아리, 업무 곤란도 등을 참고"],
             ["총점(100)", None, None, None, None, None, "{{total}}", ""]],
            [2400, 11000, 3600, 3000, 3000, 3000, 3600, 16400], lambda r, c: D.tinyb if r == 0 or r == 6 else D.tiny, merges=("A7:F7",))
    D.p("")
    D.table([["종합평가\n(해당란에 V표시)", "{{g1}} 매우 우수 (95점 이상)        {{g2}} 우수 (90점 이상 95점 미만)\n{{g3}} 보통 (80점 이상 90점 미만)     {{g4}} 미흡 (80점 미만)"],
             ["종합의견", "{{opinion}}"],
             ["참고사항", "1. 계약 시 평가 동의서를 제출한 3개월 이상 근무자를 대상으로 실시\n2. 종합의견은 교육활동 및 생활지도 중심으로 서술형으로 작성\n3. 전문성 개발 항목은 ‘법정의무교육 이수증(2년 유효)’을 소지하지 않은 경우 평가의 감점 요인으로 함. 연수 이수 결과를 인력풀에 등재하여야 함(이수증 사본 참조)\n4. 평가결과는 학교에서 보관하되, 그 결과는 기간제교원 인력풀(NEIS시스템)에 등재(교감)하여 재임용 시 참고될 수 있으며, 타 학교의 요구가 있을 경우 인비로 송부할 수 있음\n5. 다면평가 방법으로 평가를 실시한 경우 다면평가 결과를 본 평가 결과로 대체할 수 있음"]],
            [8000, 38000], lambda r, c: D.bold if c == 0 else D.tiny)
    D.p("")
    D.p("{{date}}", D.body, "center")
    D.p("")
    D.p("평가자: 교감  성명                (서명),     확인자: 교장  성명                (서명)", D.body, "center")
    D.save("form18.hwpx")


# ---------------------------------------------------------------- 서식 29·30
F29 = [("채용\n계획", "기간제교원 채용을 위한 채용계획을 수립하였는가?\n- 전형내용, 전형방법, 심사계획, 심사위원회 구성"),
       ("채용\n공고", "채용 공고는 경상북도교육청 홈페이지에만 게시하였는가?"),
       ("", "공고 기간(공고일 제외 3일 이상_공휴일 포함)을 준수하였는가?"),
       ("", "지원 자격, 채용 기간, 전형 방법, 전형 일정을 명시하였는가?"),
       ("", "우편, E-mail, 직접 방문 등 다양한 방법으로 응시 서류를 접수하였는가?"),
       ("선발\n전형", "선발 전형(서류심사, 면접 등)은 심사 기준에 맞게 실시하였는가?"),
       ("", "서류심사평가표, 면접평가표 등 전형 자료를 관리하고 있는가?"),
       ("채용\n확정", "최종선정자의 결격사유·범죄경력을 조회하였는가?"),
       ("", "채용계약서는 당사자가 직접 작성하고 상호 교환하였는가?"),
       ("", "교육(지원)청으로 임용 결과를 보고하였는가?"),
       ("", "계약제교원 채용에 따른 발령 대장 등을 정리·활용하고 있는가?"),
       ("관리", "3개월 이상 근무하는 기간제교원에 대해 근무실적 평가 동의서를 징구하였는가?"),
       ("", "기간제교원의 겸직에 대해 정규교원과 동일하게 적용하고 있는가?")]
F30 = ["임용에 따른 투명성, 공정성을 확보할 수 있는 계약제교원 채용 관련 자체 기준이나 계획이 수립·운영되고 있는가?",
       "6개월 이상 근무한 계약제 교사 근무성적평정을 실시하여 관리하고 있는가?",
       "계약제교원 운영 지침에 따라 결격사유조회, 범죄경력조회를 실시하고 있는가?",
       "계약제교원 채용에 따른 발령 대장 등을 비치·활용하고 있는가?",
       "계약제교원 채용 시 계약제 교사의 명칭, 근무기간 등을 명확하게 규정하여 운영하고 있는가?",
       "계약제교원 복무기준은 계약 사항에 명시되어 있는가?",
       "휴직 교사가 조기 복직하거나 별도 정원 교사가 복직하여 임용 사유가 소멸된 경우 계약이 해지될 수 있음을 계약서에 명시하였는가?",
       "계약제교원이 정당, 기타 정치단체의 결성에 관여하거나 이에 가입되어 있지는 않은가?",
       "학교장은 계약제교원에 대한 지도·감독을 철저히 하고 있는가?"]


def form29():
    D = Doc()
    D.p("기간제교원 채용 점검표", D.big, "center")
    D.p("")
    D.table([["학교명", "{{schoolName}}", "점검일자", "{{date}}"], ["작성자", "교감                (서명)", "확인자", "교장                (서명)"]],
            [7000, 16000, 7000, 16000], lambda r, c: D.bold if c % 2 == 0 else D.body)
    D.p("교육지원청 학교지원센터를 통해 기간제교원을 채용하였습니까?   예 {{centerY}}   아니오 {{centerN}}", D.small)
    D.p("(예: 채용확정 항목부터 작성, 아니오: 모든 항목 작성)", D.tiny)
    rows = [["항목", "점검내용", "점검결과\n(○, ×)", "비고"]]
    for i, (cat, txt) in enumerate(F29, 1):
        rows.append([cat, txt, "{{c%d}}" % i, "{{n%d}}" % i])
    rows.append(["특이\n사항", "{{special}}", None, None])
    D.table(rows, [5000, 27000, 5000, 9000], lambda r, c: D.tinyb if r == 0 or c == 0 else D.tiny, merges=("B%d:D%d" % (len(rows), len(rows)),))
    D.p("※ 채용공고 생략 가능한 경우는 비고에 “생략” 표기", D.tiny)
    D.save("form29.hwpx")


def form30():
    D = Doc()
    D.p("계약제교원 운영 현황 자체 점검표", D.big, "center")
    D.p("")
    D.p("{{schoolName}}", D.body, "right")
    D.p("확인자 교장                (서명)", D.body, "right")
    D.p("작성자 교감                (서명)", D.body, "right")
    D.p("")
    rows = [["연번", "점 검 사 항", "미흡", "보통", "우수"]]
    for i, t in enumerate(F30, 1):
        rows.append([str(i), t, "{{a%d}}" % i, "{{b%d}}" % i, "{{c%d}}" % i])
    rows.append(["특기 및\n조치 사항", "{{special}}", None, None, None])
    D.table(rows, [4000, 30000, 4000, 4000, 4000], lambda r, c: D.tinyb if r == 0 else D.tiny, merges=("B%d:E%d" % (len(rows), len(rows)),))
    D.p("")
    D.p("점검일자 : {{date}}", D.body, "right")
    D.save("form30.hwpx")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    gian()
    for n in range(3, 10):
        minutes(n)
    for n in range(3, 6):
        plan(n)
    notice()
    contract()
    contract_hourly()
    report()
    form25()
    form26()
    form28()
    hobong_sheet()
    bundle()
    form18()
    form29()
    form30()
    form3(); form4(); form6(); form8()
    for j in range(3, 6):
        tally(j)
