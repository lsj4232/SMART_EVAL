import re
import math
from io import BytesIO
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader
import docx

app = FastAPI(title="SMART Patent Analysis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def make_spaced_regex(keyword):
    return r"\s*".join(list(keyword))

# ==========================================
# 1. 텍스트 추출 및 기초 서지사항 파싱
# ==========================================
def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    ext = filename.lower().split('.')[-1]
    text = ""
    if ext == 'pdf':
        reader = PdfReader(BytesIO(file_bytes))
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted: text += extracted + "\n\n"
    elif ext == 'docx':
        doc = docx.Document(BytesIO(file_bytes))
        text = "\n".join([para.text for para in doc.paragraphs])
    return text

def extract_patent_data(text: str) -> dict:
    data = {
        "applicationNumber": "-", "filingDate": "-", "inventionTitle": "-", "inventors": "-",
        "ipcCount": 1, "inventorCount": 0, "drawingCount": 0, "descWordLen": 0
    }
    
    app_no = re.search(r'(?:출\s*원\s*번\s*호|application\s*no)[^\d]*([0-9]{2,4}[-\s]?[0-9]{4}[-\s]?[0-9]{7,8})', text, re.IGNORECASE)
    if app_no: data["applicationNumber"] = re.sub(r'\s+', '-', app_no.group(1))

    date_m = re.search(r'(?:출\s*원\s*일\s*자|출\s*원\s*일|filing\s*date)[^\d]*([0-9]{4}[-./\s]?[0-9]{2}[-./\s]?[0-9]{2})', text, re.IGNORECASE)
    if date_m: data["filingDate"] = re.sub(r'[-./\s]+', '.', date_m.group(1))

    title_m = re.search(r'(?:발\s*명\s*의\s*명\s*칭|발\s*명\s*의\s*국\s*문\s*명\s*칭)[\s:]*([^\n]+(?:\n[^\n]+)?)', text)
    if title_m: 
        raw_title = title_m.group(1).replace('\n', ' ').strip()
        # [해결 3] 기관명(워터마크) 노이즈 완벽 제거 로직
        raw_title = re.sub(r'지\s*식\s*재\s*산\s*처\s*장', '', raw_title)
        raw_title = re.sub(r'특\s*허\s*청\s*장', '', raw_title)
        data["inventionTitle"] = re.sub(r'\s+', ' ', raw_title).strip()

    inventor_matches = re.findall(r'(?:【|\[)\s*성\s*명\s*(?:】|\])[\s:]*([가-힣]{2,5})', text)
    if inventor_matches:
        data["inventors"] = ", ".join(inventor_matches)
        data["inventorCount"] = len(inventor_matches)
    else:
        inv_m = re.search(r'발\s*명\s*자\s*성\s*명[\s\S]*?\n\s*([가-힣\s]+?)(?=\n|발명의 명칭)', text)
        if inv_m:
            inv_list = inv_m.group(1).split()
            data["inventors"] = ", ".join(inv_list)
            data["inventorCount"] = len(inv_list)

    ipc_matches = re.findall(r'[A-H]\d{2}[A-Z]', text)
    if ipc_matches: data["ipcCount"] = len(set(ipc_matches))

    figs = re.findall(r'(?:【|\[)\s*도\s*(\d+)\s*(?:】|\])', text)
    if figs: data["drawingCount"] = len(set(int(n) for n in figs))

    desc_match = re.search(r'(?:【|\[)\s*발\s*명\s*의\s*설\s*명\s*(?:】|\])([\s\S]*?)(?=(?:【|\[)\s*청\s*구\s*범\s*위\s*(?:】|\])|$)', text)
    if desc_match: data["descWordLen"] = len(desc_match.group(1).split())
    else: data["descWordLen"] = len(text.split()) // 2

    return data

# ==========================================
# 2. 청구항 해체 및 종속/독립 트리 분석 (수정됨)
# ==========================================
def parse_claims(text: str):
    scope_match = re.search(r'(?:【|\[)\s*청\s*구\s*범\s*위\s*(?:】|\])([\s\S]*?)(?=(?:【|\[)\s*요\s*약\s*서|(?:【|\[)\s*도\s*면|(?:【|\[)\s*발\s*명\s*의\s*설\s*명|$)', text)
    scope_text = scope_match.group(1) if scope_match else text

    claims_raw = re.split(r'(?:【|\[)\s*청\s*구\s*항\s*(\d+)\s*(?:】|\])', scope_text)
    
    rows = []
    indep_set = set()
    cite_map = {}
    tail_map = {} 

    indep_word_len = 0

    for i in range(1, len(claims_raw), 2):
        if i + 1 >= len(claims_raw): break
        no = int(claims_raw[i])
        claim_text = claims_raw[i+1].strip()
        if not claim_text: continue

        # 날짜 및 페이지 번호 노이즈 제거
        noise_removed = re.sub(r'\d{4}[-./]\d{2}[-./]\d{2}', '', claim_text) 
        noise_removed = re.sub(r'(?<!\w)\d+\s*-\s*\d+(?!\w)', '', noise_removed) 
        
        cleaned = re.sub(r'[。\.\s;,:\)\]\}]+$', '', noise_removed).strip()
        tokens = cleaned.split()
        
        boundary_re = re.compile(r'(하는|한|된|인|하여|가진|갖는)$')
        tail = tokens[-1] if tokens else "미상"
        for idx in range(len(tokens)-1, max(-1, len(tokens)-10), -1):
            if boundary_re.search(tokens[idx]):
                tail = " ".join(tokens[idx+1:])
                break
        
        tail_map[no] = tail
        is_deleted = '삭제' in claim_text[:10]
        
        # [해결 1] 정밀한 인용항 추출 및 다중종속항 판별 로직
        references = []
        is_multi = False
        
        if not is_deleted:
            # 문장 초반 80자(인용 구역)만 분리
            intro = claim_text[:80]
            cut_match = re.search(r'(에\s*있어서|에\s*따[르른]|을\s*따르는)', intro)
            
            if cut_match:
                ref_part = intro[:cut_match.end()] # "제1항 내지 제3항에 있어서" 까지만 추출
                
                if re.search(r'(제|청구항|항)', ref_part):
                    nums = [int(n) for n in re.findall(r'\d+', ref_part)]
                    if nums:
                        if '내지' in ref_part or '~' in ref_part:
                            is_multi = True
                            if len(nums) >= 2:
                                references = list(range(min(nums), max(nums) + 1))
                            else:
                                references = nums
                        else:
                            if len(nums) > 1 and ('또는' in ref_part or ',' in ref_part or '및' in ref_part):
                                is_multi = True
                            references = sorted(list(set(nums)))
            
            # 폴백: 위 정규식에 안 걸렸을 경우 기본 탐색
            if not references:
                fallback_matches = re.findall(r'(?:제|청구항)\s*(\d+)\s*항?', intro)
                if fallback_matches:
                    references = sorted(list(set(int(m) for m in fallback_matches)))
                    if len(references) > 1:
                        is_multi = True

        if is_deleted:
            is_independent = False
            reason = "삭제된 청구항"
        elif not references:
            is_independent = True
            reason = "인용문구가 없어 원칙적 독립항으로 판단함"
        else:
            first_ref = references[0]
            ref_tail = tail_map.get(first_ref, "")
            
            # [해결 2] 모든 띄어쓰기를 없애고 비교 ("처리방법" == "처리 방법")
            ref_tail_clean = re.sub(r'\s+', '', ref_tail)
            tail_clean = re.sub(r'\s+', '', tail)
            
            if ref_tail_clean and ref_tail_clean != tail_clean:
                is_independent = True
                reason = f"인용문구가 있으나, 인용항({ref_tail})과 말미({tail})의 범주가 달라 독립항으로 판단함"
            else:
                is_independent = False
                ref_str = ", ".join(map(str, references))
                reason = f"다중종속항 (제[{ref_str}]항 참조)" if is_multi else f"종속항 (제{ref_str}항 참조)"

        if is_independent:
            indep_set.add(no)
            indep_word_len += len(tokens)

        cite_map[no] = references
        rows.append({
            "no": no, "text": claim_text, "tail": tail,
            "isIndependent": is_independent, "isDeleted": is_deleted,
            "isMultiDependent": is_multi, "references": references,
            "reason": reason
        })

    # 종속항 평균 깊이 산술 로직 정밀화 (반복적 최단 경로 탐색)
    depths = {}
    
    for r in rows:
        if not r["isDeleted"] and r["isIndependent"]:
            depths[r["no"]] = 1 # 독립항은 무조건 깊이 1

    changed = True
    while changed:
        changed = False
        for r in rows:
            if r["isDeleted"] or r["isIndependent"]: continue
            no = r["no"]
            
            # 현재 청구항이 인용하는 부모 항들의 깊이 중 '가장 짧은 깊이' 탐색
            valid_ref_depths = [depths[ref] for ref in r["references"] if ref in depths]
            
            if valid_ref_depths:
                new_depth = min(valid_ref_depths) + 1
            else:
                new_depth = 2 
                
            if no not in depths or depths[no] != new_depth:
                depths[no] = new_depth
                changed = True

    dep_depths = [depths[r["no"]] for r in rows if not r["isIndependent"] and not r["isDeleted"] and r["no"] in depths]
    avg_depth = round(sum(dep_depths) / len(dep_depths), 3) if dep_depths else 0

    indep_rows = [r for r in rows if r["isIndependent"]]
    has_method = any(r["tail"].endswith('방법') or r["tail"].endswith('공정') for r in indep_rows)
    has_other = any(not (r["tail"].endswith('방법') or r["tail"].endswith('공정')) for r in indep_rows)
    claim_series = 2 if (has_method and has_other) else 1

    indep_count = len(indep_rows)
    if indep_count < claim_series: indep_count = claim_series

    return {
        "rows": rows,
        "totalCount": len([r for r in rows if not r["isDeleted"]]),
        "independentCount": indep_count,
        "dependentCount": len([r for r in rows if not r["isIndependent"] and not r["isDeleted"]]),
        "claimSeries": claim_series,
        "avgDepth": avg_depth,
        "indepWordLen": indep_word_len
    }

# ==========================================
# 3. SMART 산식 및 가중치 계산 모듈
# ==========================================
def calculate_smart_score(claims_info: dict, patent_info: dict, fast_track: int, oa_count: int, tech_field: str, annuity_count: int):
    v = {
        "ipc": patent_info.get("ipcCount", 1),
        "appeal": 0, "assignee_change": 0, "pledge": 0, "divisional_priority": 0, "licensee": 0,
        "prior_art_foreign": 0, "total_cited_by": 0, "cited_ref_foreign": 0, "cited_vs_filing_gap": 0, "family_country": 0,
        "drawing": patent_info.get("drawingCount", 0),
        "desc_word_len": patent_info.get("descWordLen", 0),
        "inventor_count": patent_info.get("inventorCount", 1),
        "indep_word_len": claims_info["indepWordLen"],
        "indep_count": claims_info["independentCount"],
        "dep_count": claims_info["dependentCount"],
        "claim_series": claims_info["claimSeries"],
        "avg_depth": claims_info["avgDepth"],
        "fast_track": fast_track,
        "oa_count": oa_count,
        "annuity": annuity_count if annuity_count > 0 else 1
    }

    if tech_field == "전기 전자 IT":
        raw = (0.06816 * v["ipc"]) + (-0.63435 * v["appeal"]) + (1.02710 * v["assignee_change"]) + \
              (0.87428 * v["pledge"]) + (-0.01293 * v["drawing"]) + (-0.00015 * v["indep_word_len"]) + \
              (0.10874 * v["indep_count"]) + (-0.00000 * v["desc_word_len"]) + (-0.02668 * v["inventor_count"]) + \
              (0.05896 * v["divisional_priority"]) + (0.05873 * v["prior_art_foreign"]) + (0.38531 * v["licensee"]) + \
              (0.02098 * v["annuity"]) + (1.57725 * v["fast_track"]) + (-0.04931 * v["oa_count"]) + \
              (0.01102 * v["dep_count"]) + (0.10645 * v["avg_depth"]) + (1.37085 * v["claim_series"]) + \
              (-0.09986 * v["total_cited_by"]) + (0.12839 * v["cited_ref_foreign"]) + (0.00101 * v["cited_vs_filing_gap"]) + \
              (0.82152 * v["family_country"]) + (0.46585)
    else: 
        raw = (0.05667 * v["ipc"]) + (-0.32971 * v["appeal"]) + (0.51385 * v["assignee_change"]) + \
              (0.45075 * v["pledge"]) + (-0.00030 * v["drawing"]) + (-0.00028 * v["indep_word_len"]) + \
              (0.20924 * v["indep_count"]) + (-0.00006 * v["desc_word_len"]) + (0.01125 * v["inventor_count"]) + \
              (-0.00062 * v["divisional_priority"]) + (0.03811 * v["prior_art_foreign"]) + (-0.01446 * v["licensee"]) + \
              (0.07736 * v["annuity"]) + (1.49230 * v["fast_track"]) + (-0.10205 * v["oa_count"]) + \
              (0.02501 * v["dep_count"]) + (0.13994 * v["avg_depth"]) + (1.89104 * v["claim_series"]) + \
              (-0.09986 * v["total_cited_by"]) + (0.10803 * v["cited_ref_foreign"]) + (0.00083 * v["cited_vs_filing_gap"]) + \
              (1.54186 * v["family_country"]) + (-0.104374267)

    clamped = max(1, min(9, round(raw)))
    g_map = {9: "AAA", 8: "AA", 7: "A", 6: "BBB", 5: "BB", 4: "B", 3: "CCC", 2: "CC", 1: "C"}
    
    return {"rawScore": round(raw, 4), "roundedScore": clamped, "grade": g_map.get(clamped, "C"), "variables": v}

# ==========================================
# 4. 룰 검증 (1.2배 구제 룰 포함)
# ==========================================
def validate_rules(claims_info, patent_info, fast_track, oa_count, tech_field, smart_grade, annuity_count):
    indep_std = 4 if tech_field == "전기 전자 IT" else 3
    indep = claims_info["independentCount"]
    dep = claims_info["dependentCount"]
    series = claims_info["claimSeries"]
    depth = claims_info["avgDepth"]
    drawings = patent_info["drawingCount"]
    desc_words = patent_info["descWordLen"]

    rows = [
        {"level": "상", "item": "우선심사 청구 여부", "threshold": "1", "value": fast_track, "pass": fast_track == 1},
        {"level": "상", "item": "청구항 계열 수", "threshold": "≥ 2", "value": series, "pass": series >= 2},
        {"level": "상", "item": "독립항 수", "threshold": f"≥ {indep_std}", "value": indep, "pass": indep >= indep_std},
        {"level": "중", "item": "종속항 수", "threshold": "≥ 7", "value": dep, "pass": dep >= 7},
        {"level": "중", "item": "종속항 평균깊이", "threshold": "≥ 2.3", "value": depth, "pass": depth >= 2.3},
        {"level": "하", "item": "도면 수", "threshold": "≥ 5", "value": drawings, "pass": drawings >= 5},
        {"level": "하", "item": "발명의 설명 길이(단어)", "threshold": "≥ 2000", "value": desc_words, "pass": desc_words >= 2000},
        {"level": "하", "item": "의견서 제출 수", "threshold": "≤ 1", "value": oa_count, "pass": oa_count <= 1},
    ]

    bbb_predict = False
    
    if annuity_count <= 1:
        top_ok = all(r["pass"] for r in rows if r["level"] == "상")
        mid_pass_count = sum(1 for r in rows if r["level"] == "중" and r["pass"])
        if top_ok:
            if mid_pass_count == 2: bbb_predict = True
            elif mid_pass_count == 1:
                mid_pass = [r for r in rows if r["level"] == "중" and r["pass"]][0]
                std = 7 if "종속항 수" in mid_pass["item"] else 2.3
                if float(mid_pass["value"]) >= std * 1.2: bbb_predict = True

    grade6 = "BBB" if bbb_predict else "BB"
    score_map = {"AAA":9, "AA":8, "A":7, "BBB":6, "BB":5, "B":4, "CCC":3, "CC":2, "C":1}
    
    s5, s6 = score_map.get(smart_grade, 0), score_map.get(grade6, 0)
    final_grade = smart_grade if s5 <= s6 else grade6

    return {"rows": rows, "bbbOrAbove": bbb_predict, "conservativeGrade": final_grade}

# ==========================================
# 🚀 메인 API 라우터
# ==========================================
@app.post("/api/analyze")
async def analyze_patent(
    pdf: UploadFile = File(None),
    text: str = Form(""),
    fastTrack: int = Form(0),
    officeActionCount: int = Form(0),
    annuityCount: int = Form(0),
    techField: str = Form("기계")
):
    try:
        full_text = text
        if pdf:
            file_bytes = await pdf.read()
            full_text = extract_text_from_file(file_bytes, pdf.filename)

        if not full_text.strip(): return {"error": "텍스트를 추출할 수 없습니다."}

        patent_info = extract_patent_data(full_text)
        claims_info = parse_claims(full_text)
        smart_data = calculate_smart_score(claims_info, patent_info, fastTrack, officeActionCount, techField, annuityCount)
        validation_data = validate_rules(claims_info, patent_info, fastTrack, officeActionCount, techField, smart_data["grade"], annuityCount)

        v = smart_data["variables"]
        inputs = [
            {"key": "IPC 수", "value": v["ipc"], "status": "자동추출 (중복제거)"},
            {"key": "독립항 수", "value": v["indep_count"], "status": "자동추출"},
            {"key": "종속항 수", "value": v["dep_count"], "status": "자동추출"},
            {"key": "종속항의 평균깊이", "value": v["avg_depth"], "status": "자동추출"},
            {"key": "청구항 계열 수", "value": v["claim_series"], "status": "자동추출"},
            {"key": "독립항 단어수", "value": v["indep_word_len"], "status": "자동추출"},
            {"key": "발명의 설명의 단어수", "value": v["desc_word_len"], "status": "자동추출"},
            {"key": "도면 수", "value": v["drawing"], "status": "자동추출"},
            {"key": "발명자수", "value": v["inventor_count"], "status": "자동추출"},
            
            {"key": "우선심사청구 여부", "value": v["fast_track"], "status": "사용자입력"},
            {"key": "의견서 제출 수", "value": v["oa_count"], "status": "사용자입력"},
            {"key": "연차등록 횟수", "value": v["annuity"], "status": "사용자입력(기본1)"},
            {"key": "기술분야", "value": techField, "status": "사용자입력"},

            {"key": "거절결정불복심판 수", "value": 0, "status": "미확인(기본0)"},
            {"key": "권리자 변동 수", "value": 0, "status": "미확인(기본0)"},
            {"key": "금융기관 질권설정 수", "value": 0, "status": "미확인(기본0)"},
            {"key": "분할출원·우선권주장수", "value": 0, "status": "미확인(기본0)"},
            {"key": "해외 패밀리 국가수", "value": 0, "status": "미확인(기본0)"},
        ]

        return {
            "basic": patent_info, 
            "claims": claims_info, 
            "inputsTable": inputs,
            "smart": smart_data, 
            "validation": validation_data
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": f"서버 분석 오류: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8787)