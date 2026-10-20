import pdfplumber, re, json, sys, os
# 사용: python tools/extract_pdf.py 지침.pdf QA.pdf
GUIDE_PDF, QA_PDF = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
def page_lines(p):
    rows={}
    for c in p.chars:
        rows.setdefault(round(c['top']/2.5),[]).append(c)
    out=[]
    for k in sorted(rows):
        cs=sorted(rows[k],key=lambda c:c['x0'])
        buf=''
        for i,c in enumerate(cs):
            if i and c['text']!=' ' and not buf.endswith(' '):
                gap=c['x0']-cs[i-1]['x1']
                if gap > 0.25*c.get('size',10): buf+=' '   # 공백 문자 없이 간격만 있는 경우
            buf+=c['text']
        out.append((buf, cs[0]['x0']))
    return out

MARK=re.compile(r'^\s*(○|◦|-|※|\*|[가-하]\.|\d+\)|[①-⑳]|▪|•|·|<|\[|예\)|<)')
def join(lines):
    paras=[]
    for t in lines:
        s=t.rstrip('\n')
        if not s.strip(): continue
        if not paras or MARK.match(s):
            paras.append(s.strip()+(' ' if s.endswith(' ') else ''))
        else:
            paras[-1]+=s.lstrip() if paras[-1].endswith(' ') else s.strip()+(' ' if s.endswith(' ') else '')
            if not s.endswith(' '): paras[-1]=paras[-1].rstrip()
    return [re.sub(r'\s+',' ',p).strip() for p in paras]

# ---- QA
pdf=pdfplumber.open(QA_PDF)
lines=[]
for p in pdf.pages[1:]:
    for t,x in page_lines(p):
        if re.fullmatch(r'\s*-\s*\d+\s*-\s*',t): continue
        lines.append(t)
qa=[];sec='';cur=None;mode=None
for t in lines:
    s=t.strip()
    if s.startswith('▣'):
        sec=s.replace('▣','').strip() or sec; continue
    if s in('Q','A','▣'):
        continue
    m=re.match(r'^(\d+)\.\s*(.*)',s)
    if m and (cur is None or int(m.group(1))==cur['no']+1) and not s.startswith('1)'):
        cur={'no':int(m.group(1)),'section':sec,'q_lines':[t.split('.',1)[1]],'a_lines':[]};qa.append(cur);mode='q';continue
    if cur is None: continue
    if mode=='q' and (s.startswith('○')):
        mode='a'
    (cur['q_lines'] if mode=='q' else cur['a_lines']).append(t)
SEC={}
for rng,name in [((1,5),'신규채용'),((6,16),'계약기간'),((17,17),'임용 보고'),((18,21),'육아휴직'),((22,23),'계약해지'),((24,24),'신체검사서'),((25,25),'호봉'),((26,27),'호봉 재획정'),((28,28),'자격취득 봉급 재산정'),((29,29),'정근수당'),((30,30),'가족수당'),((31,31),'담임수당'),((32,34),'퇴직금'),((35,35),'징계'),((36,36),'연가'),((37,37),'특별휴가(육아시간)'),((38,39),'겸직·보험')]:
    for n in range(rng[0],rng[1]+1): SEC[n]=name
for q in qa:
    q['section']=SEC.get(q['no'],'')
    q['q']=' '.join(join(q.pop('q_lines')))
    q['a']=join(q.pop('a_lines'))
json.dump(qa,open(os.path.join(OUT,'qa.json'),'w'),ensure_ascii=False,indent=1)
print(len(qa),[ (q['no'],q['section']) for q in qa][:40])
# ---- guide
pdf=pdfplumber.open(GUIDE_PDF)
chunks=[]
for i,p in enumerate(pdf.pages):
    pg=i-4
    if pg<1 or pg>84 or 33<=pg<=77: continue
    txt=[t for t,x in page_lines(p)]
    body=[t for t in txt if not re.fullmatch(r'\s*\d{1,2}\s*',t) and '경상북도교육청' not in t.replace(' ','')[:12] and not re.fullmatch(r'\s*\d{1,2}\s*∣.*',t)]
    for para in join(body):
        if len(para)>4: chunks.append({'page':pg,'text':para})
json.dump(chunks,open(os.path.join(OUT,'guide.json'),'w'),ensure_ascii=False,indent=0)
print(len(chunks))
