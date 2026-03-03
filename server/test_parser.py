import os
import json

# main.py 파일에 있는 우리의 핵심 엔진 함수들을 그대로 불러옵니다.
from main import (
    extract_text_from_file,
    extract_basic_info,
    extract_drawing_count,
    parse_claims,
    calculate_smart_score,
    validate_and_compare_grades
)

def test_patent_parsing(file_path):
    print(f"\n{'='*50}")
    print(f"🚀 딥 파싱 테스트 시작: {file_path}")
    print(f"{'='*50}\n")
    
    # 0. 파일 존재 여부 확인
    if not os.path.exists(file_path):
        print(f"❌ 파일을 찾을 수 없습니다. 경로를 확인해주세요: {file_path}")
        return
        
    with open(file_path, "rb") as f:
        file_bytes = f.read()
        
    filename = os.path.basename(file_path)
    
    # ---------------------------------------------------------
    # 1. 텍스트 추출 모듈 테스트
    # ---------------------------------------------------------
    print("▶ [1단계] PDF 텍스트 추출")
    full_text = extract_text_from_file(file_bytes, filename)
    print(f"  ✓ 추출된 전체 텍스트 길이: {len(full_text):,} 글자")
    
    if len(full_text) < 100:
        print("  ⚠️ 경고: 텍스트가 거의 추출되지 않았습니다! (스캔된 이미지 PDF이거나 보안 문서일 수 있습니다)")
        print(f"  ✓ 텍스트 미리보기: {full_text[:100]}\n")
        return

    # ---------------------------------------------------------
    # 2. 서지 정보 및 도면 수 파싱 테스트
    # ---------------------------------------------------------
    print("\n▶ [2단계] 서지 정보 파싱 결과")
    basic_info = extract_basic_info(full_text)
    print(json.dumps(basic_info, indent=4, ensure_ascii=False))

    print("\n▶ [3단계] 도면 수 파싱 결과")
    drawing_count = extract_drawing_count(full_text)
    print(f"  ✓ 도면 수: {drawing_count} 개")

    # ---------------------------------------------------------
    # 3. 청구항 분석 테스트 (가장 중요한 부분!)
    # ---------------------------------------------------------
    print("\n▶ [4단계] 청구항 트리 구조 분석 결과")
    claims_data = parse_claims(full_text)
    
    print(f"  ✓ 총 청구항 수 : {claims_data['totalCount']}")
    print(f"  ✓ 독립항 수    : {claims_data['independentCount']}")
    print(f"  ✓ 종속항 수    : {claims_data['dependentCount']}")
    print(f"  ✓ 청구항 계열수: {claims_data['claimSeries']}")
    print(f"  ✓ 종속항 평균깊이: {claims_data['avgDepth']}")
    
    print("\n  [청구항 상세 분류 미리보기 (최대 3개)]:")
    for r in claims_data['rows'][:3]:
        print(f"    - No.{r['no']}: 독립여부({r['isIndependent']}), 말미({r['tail']}), 사유({r['reason']})")

    # ---------------------------------------------------------
    # 4. 계산 및 등급 산출 테스트
    # ---------------------------------------------------------
    print("\n▶ [5단계] SMART 점수 산식 결과 (가상입력: 기계, 우선심사X, 의견서 0)")
    smart_data = calculate_smart_score(claims_data, fast_track=0, oa_count=0, tech_field="기계")
    print(json.dumps(smart_data, indent=4, ensure_ascii=False))

    print("\n▶ [6단계] 주요 요소(BBB+) 검증 결과")
    validation_data = validate_and_compare_grades(
        claims_data, fast_track=0, oa_count=0, tech_field="기계", 
        text=full_text, smart_grade=smart_data["grade"], annuity_count=0
    )
    print(f"  ✓ BBB 이상 조건을 충족했는가?: {validation_data['bbbOrAbove']}")
    print(f"  ✓ 최종 예측된 보수적 등급  : {validation_data['conservativeGrade']}")
    print(f"\n{'='*50}")
    print("🏁 테스트 완료!")
    print(f"{'='*50}\n")

if __name__ == "__main__":
    # ⚠️ 여기에 테스트하고 싶은 PDF 파일의 이름이나 절대 경로를 적어주세요.
    # 예: test_patent.pdf (server 폴더 안에 있는 경우)
    TEST_FILE_NAME = "sample.pdf" 
    
    test_patent_parsing(TEST_FILE_NAME)