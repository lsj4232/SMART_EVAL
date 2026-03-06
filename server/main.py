import re
import math
from io import BytesIO
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader
from pydantic import BaseModel
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

def extract_patent_data(text: str, is_registration: bool = False) -> dict:
    data = {
        "applicationNumber": "-", "filingDate": "-", "inventionTitle": "-", "inventors": "-",
        "ipcCount": 1, "inventorCount": 0, "drawingCount": 0, "descWordLen": 0
    }
    
    if is_registration:
        # [등록공보 모드] (PDF 포맷)
        app_no = re.search(r'\(\s*21\s*\)\s*출\s*원\s*번\s*호[^\d]*([0-9]{2,4}[-\s]?[0-9]{4}[-\s]?[0-9]{7,8})', text)
        if app_no: data["applicationNumber"] = re.sub(r'\s+', '-', app_no.group(1))

        date_m = re.search(r'\(\s*22\s*\)\s*출\s*원\s*일\s*자[^\d]*([0-9]{4}년\s*[0-9]{2}월\s*[0-9]{2}일)', text)
        if date_m: data["filingDate"] = re.sub(r'[년월일\s]+', '.', date_m.group(1)).strip('.')

        # 🚀 [수정] 발명의 명칭 뒤에 붙는 (57) 요약 등 노이즈 제거
        title_m = re.search(r'\(\s*54\s*\)\s*발\s*명\s*의\s*명\s*칭[\s:]*([^\n]+(?:\n[^\n]+)?)', text)
        if title_m: 
            raw_title = title_m.group(1).replace('\n', ' ').strip()
            # "(57) 요 약" 또는 "심사관" 텍스트를 기준으로 그 앞부분만 취함
            raw_title = re.split(r'\(\s*57\s*\)\s*요\s*약?|심\s*사\s*관\s*:', raw_title)[0]
            data["inventionTitle"] = re.sub(r'\s+', ' ', raw_title).strip()

# 🚀 [수정] 괄호 텍스트 병합 현상 방지 및 숫자가 없는 주소지(예: 대전광역시 서구) 완벽 차단
        inv_blocks = re.findall(r'\(\s*72\s*\)\s*발\s*명\s*자([\s\S]*?)(?=\(\s*\d{2}\s*\)|명\s*세\s*서|청\s*구\s*범\s*위|이\s*발\s*명\s*을\s*지\s*원\s*한|$)', text)
        
        if inv_blocks:
            combined_inv_text = "\n".join(inv_blocks)
            
            # 1. 괄호 뒤에 이름이 바짝 붙어 추출되는 PDF 오류를 방지하기 위해 괄호 뒤에 줄바꿈 강제 삽입
            clean_text = combined_inv_text.replace(')', ')\n')
            
            # 2. 줄 단위로 분리하여 한 줄씩 검사
            lines = clean_text.split('\n')
            
            names = []
            stop_words = [
                '요약', '도면', '계속', '발명자', '심사관', '대리인', 
                '청구범위', '명세서', '특허청구의', '대표도', '공개특허', '등록특허', '뒷면에'
            ]
            # 확실한 주소 및 과제 키워드
            address_keywords = ['광역시', '특별시', '도 ', '시 ', '구 ', '로 ', '길 ', '동 ', '번지', '아파트', '대학교', '산학협력단']
            project_keywords = ['연구사업', '과제수행', '부처명', '과제명', '연구과제', '국가연구개발', '사업명', '기관명', '출원인']
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                # 3. 주소의 특징(숫자나 괄호)이 포함된 줄은 무조건 배제 (사람 이름엔 숫자/괄호가 없음)
                if re.search(r'[\d\(\)]', line):
                    continue
                    
                # 4. 노이즈 단어 및 과제 정보 스킵
                if any(sw in line for sw in stop_words) or any(kw in line for kw in project_keywords):
                    continue
                    
                # 5. 숫자가 없는 짧은 주소지 줄 스킵 ("대전광역시 서구" 등)
                if any(kw in line for kw in address_keywords):
                    continue
                    
                # 6. 남은 문자열이 순수 한글, 영문, 공백, 마침표, 하이픈, 쉼표로만 구성된 경우 이름으로 최종 판별
                if re.match(r'^[가-힣A-Za-z\s\.\-\,]+$', line):
                    # 혹시 쉼표로 여러 명이 한 줄에 있을 경우를 대비해 분리
                    for part in line.split(','):
                        name = part.strip()
                        # 이름 길이 필터 (너무 짧거나 너무 긴 문자열의 오작동 방지)
                        if 2 <= len(name) <= 40 and name not in names:
                            names.append(name)
                            
            if names:
                data["inventors"] = ", ".join(names)
                data["inventorCount"] = len(names) 
    else:
        # [출원서류 모드] (기존 XML/Word 포맷)
        app_no = re.search(r'(?:출\s*원\s*번\s*호|application\s*no)[^\d]*([0-9]{2,4}[-\s]?[0-9]{4}[-\s]?[0-9]{7,8})', text, re.IGNORECASE)
        if app_no: data["applicationNumber"] = re.sub(r'\s+', '-', app_no.group(1))

        date_m = re.search(r'(?:출\s*원\s*일\s*자|출\s*원\s*일|filing\s*date)[^\d]*([0-9]{4}[-./\s]?[0-9]{2}[-./\s]?[0-9]{2})', text, re.IGNORECASE)
        if date_m: data["filingDate"] = re.sub(r'[-./\s]+', '.', date_m.group(1))

        title_m = re.search(r'(?:발\s*명\s*의\s*명\s*칭|발\s*명\s*의\s*국\s*문\s*명\s*칭)[\s:]*([^\n]+(?:\n[^\n]+)?)', text)
        if title_m: 
            raw_title = title_m.group(1).replace('\n', ' ').strip()
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

    # 공통: IPC, 도면수, 발명의 설명 길이 추출 (양식 차이가 크지 않은 부분)
    ipc_matches = re.findall(r'[A-H]\d{2}[A-Z]', text)
    if ipc_matches: data["ipcCount"] = len(set(ipc_matches))

    figs = re.findall(r'(?:【|\[)?\s*도\s*(\d+)\s*(?:】|\])?', text)
    if figs: data["drawingCount"] = len(set(int(n) for n in figs))

    pattern = r'(?:(?:【|\[)?\s*발\s*명\s*의\s*설\s*명\s*(?:】|\])?|(?:^|\n)\s*명\s*세\s*서\s*\n\s*기\s*술\s*분\s*야)([\s\S]*?)(?=(?:(?:【|\[)?\s*청\s*구\s*범\s*위\s*(?:】|\])?|(?:^|\n)\s*도\s*면\s*\n|$))'


    desc_match = re.search(pattern, text)
    if desc_match: data["descWordLen"] = len(desc_match.group(1).split())
    else: data["descWordLen"] = len(text.split()) // 2

    return data

# ==========================================
# 2. 청구항 카테고리(말미) 지능형 비교 함수
# ==========================================
def is_same_category(ref_tail, curr_tail):
    ref_clean = re.sub(r'\s+', '', ref_tail) if ref_tail else ""
    curr_clean = re.sub(r'\s+', '', curr_tail) if curr_tail else ""
    
    if not ref_clean or not curr_clean: return False
    if ref_clean == curr_clean: return True
    
    ref_last = ref_tail.split()[-1] if ref_tail else ""
    curr_last = curr_tail.split()[-1] if curr_tail else ""
    if ref_last and curr_last and ref_last == curr_last: return True
    
    if ref_clean.endswith(curr_clean) or curr_clean.endswith(ref_clean): return True
    
    core_suffixes = [
        "시스템", "방법", "장치", "지그", "조성물", "단말기", "단말", "서버", "모듈",
        "발효조", "구조체", "플랫폼", "네트워크", "센서", "부재", "물질", "프로그램", 
        "기록매체", "매체", "기기", "공정", "기재", "장비", "설비", "어셈블리", "유닛"
    ]
    for suf in core_suffixes:
        if ref_clean.endswith(suf) and curr_clean.endswith(suf):
            return True
            
    core_1char = ["망", "조", "기", "부", "재", "제", "액", "층", "판", "막", "물", "폼", "함", "통", "관"]
    for suf in core_1char:
        if ref_clean.endswith(suf) and curr_clean.endswith(suf):
            return True
            
    return False

# ==========================================
# 3. 청구항 해체 및 종속/독립 트리 분석 
# ==========================================
import re

def parse_claims(text: str, is_registration: bool = False):
    # 전역 바닥글 청소 (공통)
    text = re.sub(r'(?m)^\s*\d+\s*-\s*\d+\s*$', '', text)
    text = re.sub(r'(?m)^\s*\d{4}[-./]\d{2}[-./]\d{2}\s*$', '', text)

    if is_registration:
        # [등록공보 모드]
        scope_match = re.search(r'(?:특\s*허\s*)?청\s*구\s*(?:의\s*)?범\s*위\s*(?:】|\])?([\s\S]*?)(?=(?:【|\[)?\s*요\s*약\s*(?:서|의\s*설\s*명)?\s*(?:】|\])?|(?:【|\[)?\s*도\s*면\s*(?:의\s*간\s*단\s*한\s*설\s*명)?\s*(?:】|\])?|(?:【|\[)?\s*발\s*명\s*의\s*설\s*명\s*(?:】|\])?|$)', text)
        scope_text = scope_match.group(1) if scope_match else text
        claims_raw = re.split(r'(?m)^\s*(?:【|\[)?\s*청\s*구\s*항\s*(\d+)\s*(?:】|\])?\s*$', scope_text)
    else:
        # [출원서류 모드]
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

        is_deleted = '삭제' in claim_text[:10]
        
        references = []
        is_multi = False

        if is_deleted:
            tail = "삭제"
            tail_map[no] = tail
            is_independent = False
            reason = "삭제된 청구항"
        else:
            while True:
                prev = claim_text
                claim_text = re.sub(r'등\s*록\s*특\s*허\s*\d+-\d+[\s\d\-]*$', '', claim_text).strip()
                claim_text = re.sub(r'\d{4}[-./]\d{2}[-./]\d{2}\s*$', '', claim_text).strip()
                claim_text = re.sub(r'\d+\s*-\s*\d+\s*$', '', claim_text).strip()
                claim_text = re.sub(r'[。\.\s;,:\)\]\}]+$', '', claim_text).strip()
                if prev == claim_text:
                    break
            
            tokens = claim_text.split()
            boundary_re = re.compile(r'(하는|한|된|인|하여|가진|갖는)$')
            tail = tokens[-1] if tokens else "미상"
            for idx in range(len(tokens)-1, max(-1, len(tokens)-10), -1):
                if boundary_re.search(tokens[idx]):
                    tail = " ".join(tokens[idx+1:])
                    break
            
            tail_map[no] = tail
            
            intro = claim_text[:80]
            cut_match = re.search(r'(에\s*있어서|에\s*따[르른]|을\s*따르는)', intro)
            
            if cut_match:
                ref_part = intro[:cut_match.end()]
                # 🚀 [방어 1] "제1 방법" 등을 걸러내기 위해, 반드시 '항' 또는 '청구항' 단어가 있을 때만 인용항으로 취급
                if re.search(r'(청구항|항)', ref_part):
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
            
            if not references:
                # 🚀 [방어 2] 문장 중간에서 숫자를 찾을 때도 무조건 뒤에 '항'이 붙어있는 숫자만 추출하도록 정규식 강화
                fallback_matches = re.finditer(r'(?:제\s*)?(\d+)\s*항|청구항\s*(\d+)', intro)
                nums = []
                for m in fallback_matches:
                    if m.group(1): nums.append(int(m.group(1)))
                    if m.group(2): nums.append(int(m.group(2)))
                
                if nums:
                    references = sorted(list(set(nums)))
                    if len(references) > 1:
                        is_multi = True

            # 🚀 [방어 3] 혹시라도 파싱 오류로 인해 '자기 자신'을 인용항으로 삼은 경우, 즉시 삭제하여 모순 해결
            if no in references:
                references.remove(no)

            if not references:
                is_independent = True
                reason = "인용문구가 없어 원칙적 독립항으로 판단함"
            else:
                first_ref = references[0]
                ref_tail = tail_map.get(first_ref, "")
                
                if not is_same_category(ref_tail, tail):
                    is_independent = True
                    reason = f"인용항({ref_tail})과 현재항({tail})의 대상어 범주가 달라 독립항으로 판단함"
                else:
                    is_independent = False
                    ref_str = ", ".join(map(str, references))
                    reason = f"다중종속항 (제[{ref_str}]항 참조)" if is_multi else f"종속항 (제{ref_str}항 참조)"

        if is_independent:
            indep_set.add(no)
            if not is_deleted:
                indep_word_len += len(tokens)

        cite_map[no] = references
        rows.append({
            "no": no, "text": claim_text, "tail": tail,
            "isIndependent": is_independent, "isDeleted": is_deleted,
            "isMultiDependent": is_multi, "references": references,
            "reason": reason
        })

    depths = {}
    for r in rows:
        if not r["isDeleted"] and r["isIndependent"]:
            depths[r["no"]] = 1 

    changed = True
    loop_limit = 100 # 🚀 [방어 4] 어떠한 경우에도 무한루프에 빠져 서버가 죽지 않도록 최대 반복 횟수(100회) 제한 설정
    loops = 0
    
    while changed and loops < loop_limit:
        loops += 1
        changed = False
        for r in rows:
            if r["isDeleted"] or r["isIndependent"]: continue
            no = r["no"]
            
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
# 4. SMART 산식 및 가중치 계산 모듈
# ==========================================
def calculate_smart_score(claims_info: dict, patent_info: dict, fast_track: int, oa_count: int, tech_field: str, annuity_count: int, early_publication: int = 0):
    v = {
        "ipc": patent_info.get("ipcCount", 1),
        "appeal": patent_info.get("appeal", 0), 
        "assignee_change": patent_info.get("assignee_change", 0), 
        "pledge": patent_info.get("pledge", 0), 
        "divisional_priority": patent_info.get("divisional_priority", 0), 
        "licensee": patent_info.get("licensee", 0),
        "prior_art_foreign": patent_info.get("prior_art_foreign", 0), 
        "total_cited_by": patent_info.get("total_cited_by", 0), 
        "cited_ref_foreign": patent_info.get("cited_ref_foreign", 0), 
        "cited_vs_filing_gap": patent_info.get("cited_vs_filing_gap", 0), 
        "family_country": patent_info.get("family_country", 0),
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
        "annuity": annuity_count if annuity_count > 0 else 1,
        "early_publication": early_publication
    }

    if tech_field == "전기 전자 IT":
        raw = (0.06816 * v["ipc"]) + (-0.63435 * v["appeal"]) + (1.02710 * v["assignee_change"]) + \
              (0.87428 * v["pledge"]) + (-0.01293 * v["drawing"]) + (-0.00015 * v["indep_word_len"]) + \
              (0.10874 * v["indep_count"]) + (-0.00000 * v["desc_word_len"]) + (-0.02668 * v["inventor_count"]) + \
              (0.05896 * v["divisional_priority"]) + (0.05873 * v["prior_art_foreign"]) + (0.38531 * v["licensee"]) + \
              (0.02098 * v["annuity"]) + (1.57725 * v["fast_track"]) + (-0.04931 * v["oa_count"]) + \
              (0.01102 * v["dep_count"]) + (0.10645 * v["avg_depth"]) + (1.37085 * v["claim_series"]) + \
              (-0.09986 * v["total_cited_by"]) + (0.12839 * v["cited_ref_foreign"]) + (0.00101 * v["cited_vs_filing_gap"]) + \
              (0.82152 * v["family_country"]) + (0.78 * v["early_publication"]) + (0.46585)
        
        # 🚀 [요청 1 반영] 전기전자IT 분야는 반올림하지 않고 버림(int) 처리
        clamped = max(1, min(9, int(raw)))
    else: 
        early_pub_weight = 0.14 if tech_field == "화학" else 0.78
        raw = (0.05667 * v["ipc"]) + (-0.32971 * v["appeal"]) + (0.51385 * v["assignee_change"]) + \
              (0.45075 * v["pledge"]) + (-0.00030 * v["drawing"]) + (-0.00028 * v["indep_word_len"]) + \
              (0.20924 * v["indep_count"]) + (-0.00006 * v["desc_word_len"]) + (0.01125 * v["inventor_count"]) + \
              (-0.00062 * v["divisional_priority"]) + (0.03811 * v["prior_art_foreign"]) + (-0.01446 * v["licensee"]) + \
              (0.07736 * v["annuity"]) + (1.49230 * v["fast_track"]) + (-0.10205 * v["oa_count"]) + \
              (0.02501 * v["dep_count"]) + (0.13994 * v["avg_depth"]) + (1.89104 * v["claim_series"]) + \
              (-0.09986 * v["total_cited_by"]) + (0.10803 * v["cited_ref_foreign"]) + (0.00083 * v["cited_vs_filing_gap"]) + \
              (1.54186 * v["family_country"]) + (early_pub_weight * v["early_publication"]) + (-0.104374267)

        # 기존 방식: 반올림(round) 적용
        clamped = max(1, min(9, round(raw)))

    g_map = {9: "AAA", 8: "AA", 7: "A", 6: "BBB", 5: "BB", 4: "B", 3: "CCC", 2: "CC", 1: "C"}
    
    return {"rawScore": round(raw, 4), "roundedScore": clamped, "grade": g_map.get(clamped, "C"), "variables": v}

# ==========================================
# 5. 룰 검증 (구제 룰 포함)
# ==========================================
def validate_rules(claims_info, patent_info, fast_track, oa_count, tech_field, smart_grade, annuity_count):
    indep_std = 5 if tech_field == "전기 전자 IT" else 3
    
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
    all_passed = False       
    rescue_possible = False  
    
    if annuity_count <= 1:
        top_ok = all(r["pass"] for r in rows if r["level"] == "상")
        mid_pass_count = sum(1 for r in rows if r["level"] == "중" and r["pass"])
        low_pass_count = sum(1 for r in rows if r["level"] == "하" and r["pass"])
        
        if tech_field == "전기 전자 IT":
            if top_ok:
                if mid_pass_count == 2: 
                    bbb_predict = True
                    if low_pass_count == 3:
                        all_passed = True
                    else:
                        rescue_possible = True
                elif mid_pass_count == 1:
                    if indep >= indep_std:
                        bbb_predict = True
                        rescue_possible = True
        else:
            # 🚀 기계/기구/화학 분야 전용 구제 룰 적용 (Rule 1 ~ 4)
            
            # 1단계: 원래 통과 상태 백업
            eff_indep_pass = indep >= 3
            eff_dep_pass = dep >= 7
            eff_depth_pass = depth >= 2.3
            
            # 2단계: 구제 룰 검사 및 통과 상태 덮어쓰기
            
            # [Rule 1] 종속항 평균깊이 부족 구제
            if not eff_depth_pass:
                if (2.3 - depth) * 0.13994 < (indep - 3) * 0.20924:
                    eff_depth_pass = True
                    rescue_possible = True
                    
            # [Rule 2] 종속항 수 부족 구제
            if not eff_dep_pass:
                cond1 = (7 - dep) * 0.02501 < (indep - 3) * 0.20924
                cond2 = (7 - dep) * 0.02501 < (depth - 2.3) * 0.13994
                if cond1 or cond2:
                    eff_dep_pass = True
                    rescue_possible = True
                    
            # [Rule 4] 독립항 수 부족 구제
            if not eff_indep_pass:
                n = 3 - indep
                if n > 0 and depth >= 2.3 * 1.65 * n:
                    eff_indep_pass = True
                    rescue_possible = True

            # 3단계: 최종 판정
            # [Rule 3] 중요도 하(low_pass_count)의 fail 여부에 상관없이 상/중이 모두 pass면 구제 통과
            eff_top_ok = fast_track == 1 and series >= 2 and eff_indep_pass
            eff_mid_ok = eff_dep_pass and eff_depth_pass
            
            if eff_top_ok and eff_mid_ok:
                bbb_predict = True
                
                # 모든 항목이 자력으로 통과했고, 수식 구제가 필요 없었다면 all_passed
                if top_ok and mid_pass_count == 2 and not rescue_possible:
                    if low_pass_count == 3:
                        all_passed = True
                    else:
                        # Rule 3에 의해 하 항목 fail을 무시하고 통과한 것도 구제로 간주
                        rescue_possible = True

    grade6 = "BBB" if bbb_predict else "BB"
    score_map = {"AAA":9, "AA":8, "A":7, "BBB":6, "BB":5, "B":4, "CCC":3, "CC":2, "C":1}
    
    s5, s6 = score_map.get(smart_grade, 0), score_map.get(grade6, 0)
    final_grade = smart_grade if s5 <= s6 else grade6

    return {
        "rows": rows, 
        "bbbOrAbove": bbb_predict, 
        "conservativeGrade": final_grade,
        "summaryTable": {
            "allPassed": "O" if all_passed else "X",
            "rescuePossible": "O" if rescue_possible else "X",
            "overall": "BBB 이상" if bbb_predict else "BBB 미만"
        }
    }
# ==========================================
# 🚀 메인 API 라우터
# ==========================================
@app.post("/api/analyze")
async def analyze_patent(
    pdf: UploadFile = File(None),
    text: str = Form(""),
    isRegistration: bool = Form(False), # ⭐ 체크박스 값 수신 파라미터 추가
    fastTrack: int = Form(0),
    officeActionCount: int = Form(0),
    annuityCount: int = Form(1),
    techField: str = Form("기계"),
    appealCount: int = Form(0),
    assigneeChangeCount: int = Form(0),
    pledgeCount: int = Form(0),
    divisionalPriorityCount: int = Form(0),
    familyCountryCount: int = Form(0),
    licenseeCount: int = Form(0),
    priorArtForeignCount: int = Form(0),
    totalCitedByCount: int = Form(0),
    citedRefForeignCount: int = Form(0),
    citedVsFilingGap: int = Form(0),
    earlyPublication: int = Form(0)
):
    try:
        full_text = text
        if pdf:
            file_bytes = await pdf.read()
            full_text = extract_text_from_file(file_bytes, pdf.filename)

        if not full_text.strip(): return {"error": "텍스트를 추출할 수 없습니다."}

        # ⭐ 파싱 함수에 isRegistration 플래그 전달
        patent_info = extract_patent_data(full_text, is_registration=isRegistration)
        claims_info = parse_claims(full_text, is_registration=isRegistration)
        
    
        
        # UI에서 입력받은 심화 지표들을 patent_info에 강제로 덮어씌움 (calculate_smart_score가 읽을 수 있도록)
        patent_info["appeal"] = appealCount
        patent_info["assignee_change"] = assigneeChangeCount
        patent_info["pledge"] = pledgeCount
        patent_info["divisional_priority"] = divisionalPriorityCount
        patent_info["family_country"] = familyCountryCount
        patent_info["licensee"] = licenseeCount
        patent_info["prior_art_foreign"] = priorArtForeignCount
        patent_info["total_cited_by"] = totalCitedByCount
        patent_info["cited_ref_foreign"] = citedRefForeignCount
        patent_info["cited_vs_filing_gap"] = citedVsFilingGap



        # # =========================================================
        # # 🚨 [임시 테스트 블록] PDF 파싱 결과를 무시하고 임의 값 강제 주입
        # # 테스트가 끝나면 이 블록을 삭제하거나 주석 처리하세요.
        # # =========================================================
        # # 테스트 환경 세팅 (기계 분야, 우선심사 O, 청구항 계열 2)
        # fastTrack = 1
        # techField = "기계"
        # claims_info["claimSeries"] = 2
        
        # # 👇 여기서 값을 바꿔가며 Rule 1~4를 테스트해 볼 수 있습니다.
        # claims_info["independentCount"] = 3  # 독립항 수
        # claims_info["dependentCount"] = 5    # 종속항 수
        # claims_info["avgDepth"] = 5        # 종속항 평균 깊이
        # # =========================================================
        # # ⚠️calculate_smart_score 함수의 변수 매핑(v) 딕셔너리 내부에서 
        # # v["appeal"] = patent_info.get("appeal", 0) 처럼 호출하도록 기존 함수도 연결되어 있어야 합니다.
        
        smart_data = calculate_smart_score(
        claims_info, patent_info, fastTrack, officeActionCount, techField, annuityCount, earlyPublication
    )
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
            {"key": "연차등록 횟수", "value": v["annuity"], "status": "사용자입력"},
            {"key": "기술분야", "value": techField, "status": "사용자입력"},

            {"key": "거절결정불복심판 수", "value": appealCount, "status": "사용자입력(기본0)"},
            {"key": "권리자 변동 수", "value": assigneeChangeCount, "status": "사용자입력(기본0)"},
            {"key": "금융기관 질권설정 수", "value": pledgeCount, "status": "사용자입력(기본0)"},
            {"key": "분할출원·우선권주장수", "value": divisionalPriorityCount, "status": "사용자입력(기본0)"},
            {"key": "해외 패밀리 국가수", "value": familyCountryCount, "status": "사용자입력(기본0)"},
            {"key": "실시권자 수", "value": licenseeCount, "status": "사용자입력(기본0)"},
            {"key": "선행문헌 중 논문/외국특허수", "value": priorArtForeignCount, "status": "사용자입력(기본0)"},
            {"key": "총 피인용 수", "value": totalCitedByCount, "status": "사용자입력(기본0)"},
            {"key": "피인용의 특허의 인용문헌 중 논문/외국특허수", "value": citedRefForeignCount, "status": "사용자입력(기본0)"},
            {"key": "피인용과 출원일 차이", "value": citedVsFilingGap, "status": "사용자입력(기본0)"},
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
# ==========================================
# 🚀 [추가 1] 재계산 요청용 데이터 모델 정의
class RecalcRequest(BaseModel):
    fastTrack: int
    officeActionCount: int
    annuityCount: int
    techField: str
    appealCount: int
    assigneeChangeCount: int
    pledgeCount: int
    divisionalPriorityCount: int
    familyCountryCount: int
    licenseeCount: int
    priorArtForeignCount: int
    totalCitedByCount: int
    citedRefForeignCount: int
    citedVsFilingGap: int
    earlyPublication: int
    
    # 추출 수정값
    ipcCount: int
    indepCount: int
    depCount: int
    avgDepth: float
    claimSeries: int
    indepWordLen: int
    descWordLen: int
    drawingCount: int
    inventorCount: int

# 🚀 [추가 2] 문서 재파싱 없이 산식/룰만 다시 돌리는 엔드포인트
@app.post("/api/recalculate")
async def recalculate_score(req: RecalcRequest):
    try:
        patent_info = {
            "ipcCount": req.ipcCount, "inventorCount": req.inventorCount, "drawingCount": req.drawingCount,
            "descWordLen": req.descWordLen, "appeal": req.appealCount, "assignee_change": req.assigneeChangeCount,
            "pledge": req.pledgeCount, "divisional_priority": req.divisionalPriorityCount, "family_country": req.familyCountryCount,
            "licensee": req.licenseeCount, "prior_art_foreign": req.priorArtForeignCount, "total_cited_by": req.totalCitedByCount,
            "cited_ref_foreign": req.citedRefForeignCount, "cited_vs_filing_gap": req.citedVsFilingGap,
        }
        claims_info = {
            "independentCount": req.indepCount, "dependentCount": req.depCount,
            "claimSeries": req.claimSeries, "avgDepth": req.avgDepth, "indepWordLen": req.indepWordLen,
            "totalCount": req.indepCount + req.depCount 
        }

        # 기존 함수 재활용
        smart_data = calculate_smart_score(claims_info, patent_info, req.fastTrack, req.officeActionCount, req.techField, req.annuityCount, req.earlyPublication)
        validation_data = validate_rules(claims_info, patent_info, req.fastTrack, req.officeActionCount, req.techField, smart_data["grade"], req.annuityCount)

        # 업데이트된 입력값 테이블 다시 생성
        v = smart_data["variables"]
        inputs = [
            {"key": "IPC 수", "value": v["ipc"], "status": "수동수정됨"},
            {"key": "독립항 수", "value": v["indep_count"], "status": "수동수정됨"},
            {"key": "종속항 수", "value": v["dep_count"], "status": "수동수정됨"},
            {"key": "종속항의 평균깊이", "value": v["avg_depth"], "status": "수동수정됨"},
            {"key": "청구항 계열 수", "value": v["claim_series"], "status": "수동수정됨"},
            {"key": "독립항 단어수", "value": v["indep_word_len"], "status": "수동수정됨"},
            {"key": "발명의 설명의 단어수", "value": v["desc_word_len"], "status": "수동수정됨"},
            {"key": "도면 수", "value": v["drawing"], "status": "수동수정됨"},
            {"key": "발명자수", "value": v["inventor_count"], "status": "수동수정됨"},
            {"key": "우선심사청구 여부", "value": v["fast_track"], "status": "사용자입력"},
            {"key": "의견서 제출 수", "value": v["oa_count"], "status": "사용자입력"},
            {"key": "연차등록 횟수", "value": v["annuity"], "status": "사용자입력"},
            {"key": "기술분야", "value": req.techField, "status": "사용자입력"},
        ]

        return {"inputsTable": inputs, "smart": smart_data, "validation": validation_data}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": f"재계산 중 오류: {str(e)}"}
# ==========================================
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8787)