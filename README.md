# SMART_EVAL

**특허 명세서 한 건을 넣으면, 청구항 구조부터 예상 SMART 등급까지 한 화면에서 확인할 수 있습니다.**

SMART_EVAL은 한국 특허의 출원서류·공개공보·등록공고에서 정보를 추출하고, 입력한 평가 지표와 함께 점수 및 등급을 **예측**하는 웹 앱입니다. 특허 담당자와 발명자가 청구항 분석 결과를 확인하고, 추출값을 고쳐 다시 계산할 때 사용할 수 있습니다.

> **결과는 참고용 예측치입니다.** 공식 SMART 평가 결과를 조회하는 서비스가 아닙니다. 문서 종류와 PDF의 텍스트 추출 상태에 따라 값이 달라질 수 있으므로, 중요한 판단 전에는 원문과 대조하세요.

## 무엇을 할 수 있나요?

- PDF·DOCX 업로드 또는 명세서 텍스트 붙여넣기로 분석
- 독립항·종속항, 청구항 계열, 종속항 평균깊이 등 확인
- IPC, 도면, 발명자, 발명의 설명 길이 등 추출값 확인 및 수정
- 기술분야와 우선심사·의견서 제출 등 평가 지표를 반영한 점수 계산
- 주요 요소 검증 결과와 보수적 최종 예상 등급 확인

## 바로 사용하기

1. 아래 [로컬 실행](#로컬-실행) 방법으로 앱을 엽니다.
2. 특허 문서 **PDF/DOCX 파일을 업로드**하거나 문서의 텍스트를 붙여넣습니다. 파일을 선택하면 파일 내용이 분석에 사용됩니다.
3. 문서 포맷을 `출원서류` 또는 `등록 / 공개 특허공보`로 선택하고, 기술분야·우선심사 청구 여부·의견서 제출 수를 실제 값으로 입력합니다. 등록 특허라면 연차등록 횟수도 확인합니다.
4. 알고 있는 추가 지표가 있다면 **상세 평가 지표 직접 입력**을 열어 수정합니다. 비어 있는 추가 지표는 기본값 `0`으로 계산됩니다.
5. **추출 및 SMART 점수 분석 시작**을 누릅니다. 청구항별 판별 사유와 평가 입력값을 원문과 대조하세요.
6. 자동 추출값이 틀렸다면 결과 표에서 숫자를 고치고 **수정한 숫자로 결과 즉시 재계산**을 누릅니다.

현재 웹 UI는 **Google Patents URL을 직접 입력해 가져오는 기능은 제공하지 않습니다.** 해당 문서의 PDF/DOCX를 업로드하거나 텍스트를 붙여넣어 주세요. 이미지로만 된 PDF는 텍스트 추출이 되지 않을 수 있으므로 OCR 처리 후 사용하세요.

## 로컬 실행

필요한 도구: Python 3, Node.js와 npm.

```bash
git clone https://github.com/lsj4232/SMART_EVAL.git
cd SMART_EVAL
```

**터미널 1 · Python API**

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8787
```

**터미널 2 · 웹 UI** (저장소 루트에서 실행)

```bash
cd my-app
npm ci
VITE_API_URL=http://127.0.0.1:8787 npm run dev
```

터미널에 표시된 Vite 주소(보통 `http://localhost:5173`)를 엽니다. API 명세와 요청 시험은 `http://127.0.0.1:8787/docs`에서 할 수 있습니다. Windows PowerShell에서는 가상환경을 `.\.venv\Scripts\Activate.ps1`로 활성화하고, 웹 UI를 실행하기 전에 `$env:VITE_API_URL = "http://127.0.0.1:8787"`을 설정하세요.

`VITE_API_URL`을 지정하지 않으면 웹 UI는 코드에 설정된 공개 백엔드(`https://smart-eval-backend.onrender.com`)로 요청을 보냅니다. 문서 내용은 선택한 API 서버로 전송되므로, 자체 문서로 작업할 때는 위처럼 로컬 API를 지정하세요.

## API로 사용하기

FastAPI 서버를 실행한 뒤 `POST /api/analyze`에 `multipart/form-data`를 보냅니다. 파일은 `pdf` 필드에 전달하며, 필드 이름과 무관하게 PDF와 DOCX를 모두 받습니다. 파일 없이 `text` 필드로 본문을 보낼 수도 있습니다.

```bash
curl -X POST http://127.0.0.1:8787/api/analyze \
  -F 'pdf=@/path/to/patent.pdf' \
  -F 'isRegistration=false' \
  -F 'techField=기계' \
  -F 'fastTrack=1' \
  -F 'officeActionCount=0' \
  -F 'annuityCount=1'
```

응답의 `basic`은 서지정보, `claims`는 청구항 분석, `inputsTable`은 계산 입력값, `smart`는 산식 점수와 등급, `validation`은 주요 요소 검증 결과입니다. 수동으로 고친 추출값을 다시 계산하는 `POST /api/recalculate`의 전체 필드는 [API 문서](http://127.0.0.1:8787/docs)에서 확인할 수 있습니다.

## 결과를 읽을 때

- **산식 기반 등급**은 선택한 기술분야의 가중치와 입력값으로 계산합니다. 점수는 1~9 범위로 제한되어 `C`~`AAA`로 표시됩니다.
- **보수적 최종 등급**은 산식 등급과 주요 요소 검증 결과를 함께 반영합니다. 검증 규칙은 연차등록 횟수가 1 이하인 경우에 적용됩니다.
- 추가 평가 지표의 기본값 `0`은 **확인된 0건을 뜻하지 않습니다.** 모르는 항목은 확인해 직접 입력해야 예측의 근거가 분명해집니다.
- 문서 양식에 따라 청구항 말미, IPC, 도면 수, 설명 길이 등의 자동 추출이 틀릴 수 있습니다. 결과 표의 숫자와 청구항별 판별 사유를 확인한 뒤 재계산하세요.

평가 항목과 가중치의 원래 요청 내용은 [참고 프롬프트](%ED%94%84%EB%A1%AC%ED%94%84%ED%8A%B8%20%EB%82%B4%EC%9A%A9.txt)에 남겨 두었습니다. 현재 동작과 점수 계산 기준은 [`server/main.py`](server/main.py)를 기준으로 확인하세요.

## 프로젝트 구조

```text
my-app/   React + Vite 웹 UI
server/   FastAPI 분석·재계산 API
```
