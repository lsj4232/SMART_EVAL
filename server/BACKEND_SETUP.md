# SMART 백엔드 서버 설치 가이드

## 📁 폴더 구조

```
SMART/
├── my-app/          (기존 프론트엔드)
└── server/          (새로 만들 백엔드)
    ├── server.js
    ├── package.json
    └── uploads/     (자동 생성됨)
```

## 🚀 설치 방법

### 1. 백엔드 폴더 만들기

```bash
cd C:\Users\IPLAB\OneDrive\문서\56. AI프로젝트\SMART
mkdir server
cd server
```

### 2. 파일 복사

다운로드한 파일들을 `server` 폴더에 복사:
- `server.js`
- `package.json`

### 3. 패키지 설치

```bash
npm install
```

이 명령어는 다음 패키지들을 설치합니다:
- **express**: 웹 서버 프레임워크
- **cors**: CORS 설정 (프론트엔드-백엔드 통신)
- **multer**: 파일 업로드 처리
- **pdf-parse**: PDF 파싱
- **nodemon**: 개발용 자동 재시작

### 4. 서버 실행

```bash
npm start
```

또는 개발 모드로 실행 (파일 변경시 자동 재시작):
```bash
npm run dev
```

### 5. 서버 실행 확인

터미널에 다음 메시지가 나타나면 성공:
```
✅ SMART 백엔드 서버가 포트 5000에서 실행 중입니다.
   http://localhost:5000
```

## 🔗 프론트엔드 연동

### App.jsx 수정 필요

프론트엔드에서 API 호출하는 부분을 다음과 같이 수정해야 합니다:

```javascript
// 기존 코드에서 API 엔드포인트 찾기
const response = await fetch('/api/analyze', {  // 또는 다른 경로
  method: 'POST',
  body: formData
});

// 다음과 같이 수정
const response = await fetch('http://localhost:5000/api/analyze', {
  method: 'POST',
  body: formData
});
```

**또는 vite.config.js에 프록시 설정:**

```javascript
// vite.config.js
export default {
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
}
```

## 📊 API 엔드포인트

### POST /api/analyze

**요청:**
- Method: POST
- Content-Type: multipart/form-data
- Body: PDF 파일 (field name: 'pdf')

**응답:**
```json
{
  "totalCount": 18,
  "independentCount": 4,
  "dependentCount": 14,
  "claimSeries": 2,
  "claims": [
    {
      "no": 1,
      "text": "청구항 텍스트...",
      "tail": "지그",
      "isIndependent": true,
      "reason": "인용문구가 없어 독립항으로 판단함",
      "isDeleted": false,
      "isMultiDependent": false,
      "references": []
    },
    // ...
  ]
}
```

## 🛠️ 실행 순서

1. **백엔드 서버 시작** (터미널 1)
   ```bash
   cd C:\Users\IPLAB\OneDrive\문서\56. AI프로젝트\SMART\server
   npm start
   ```

2. **프론트엔드 시작** (터미널 2)
   ```bash
   cd C:\Users\IPLAB\OneDrive\문서\56. AI프로젝트\SMART\my-app
   npm run dev
   ```

3. **브라우저에서 확인**
   - `http://localhost:5175` (또는 표시된 포트)

## 🐛 문제 해결

### "Cannot find module 'express'" 에러
```bash
npm install
```

### "Port 5000 is already in use" 에러
`server.js`에서 포트 번호 변경:
```javascript
const PORT = 5001;  // 또는 다른 포트
```

### CORS 에러
`server.js`의 CORS 설정 확인:
```javascript
app.use(cors());  // 이미 포함되어 있음
```

### PDF 파싱 에러
- PDF 형식이 올바른지 확인
- 청구항이 【청구항 1】 형식으로 되어있는지 확인

## 📝 추가 기능 (선택사항)

### 환경변수 설정 (.env)

```bash
PORT=5000
NODE_ENV=development
```

`server.js` 수정:
```javascript
require('dotenv').config();
const PORT = process.env.PORT || 5000;
```

### 로깅 추가

```bash
npm install morgan
```

```javascript
const morgan = require('morgan');
app.use(morgan('dev'));
```

## 🎯 체크리스트

- [ ] server 폴더 생성
- [ ] server.js, package.json 복사
- [ ] `npm install` 실행
- [ ] `npm start`로 서버 시작
- [ ] 터미널에 "서버가 실행 중입니다" 메시지 확인
- [ ] 프론트엔드에서 API 호출 확인
- [ ] PDF 업로드 테스트

## 💡 참고사항

- 백엔드 서버와 프론트엔드는 **동시에 실행**되어야 합니다
- 두 개의 터미널(명령 프롬프트)을 열어서 각각 실행하세요
- 개발 중에는 `npm run dev`(nodemon) 사용 권장
