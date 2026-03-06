// middleware.js
export default function middleware(request) {
  // 1. 접속자의 외부 IP 확인
  const ip = request.headers.get('x-forwarded-for') || '';
  const allowedIp = '112.218.85.3'; 

  // 사내 IP인 경우: 프리패스 통과
  if (ip.includes(allowedIp)) {
    return; 
  }

  // 2. 인증 쿠키 확인 (비밀번호를 이미 맞춘 접속자인지 확인)
  const cookie = request.headers.get('cookie') || '';
  if (cookie.includes('iplab-auth=pass')) {
    return; 
  }

  // 3. 외부 IP이고 쿠키도 없는 경우: 비밀번호 입력 화면(HTML) 제공
  return new Response(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>IPLAB WORKSTATION</title>
      <style>
        body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: 'Malgun Gothic', sans-serif; background-color: #ffffff; }
        .login-box { padding: 40px; text-align: center; width: 100%; max-width: 380px; }
        h2 { margin-bottom: 10px; font-size: 20px; font-weight: 800; letter-spacing: 1px; color: #333; }
        .subtitle { color: #666; font-size: 15px; font-weight: bold; margin-bottom: 30px; }
        .info-text { font-size: 13px; color: #555; margin-bottom: 40px; line-height: 1.6; font-weight: 500;}
        .info-text span { color: #a0a0a0; font-size: 12px; }
        .input-group { text-align: left; margin-bottom: 20px; }
        .input-label { font-weight: bold; font-size: 14px; margin-bottom: 10px; display: block; color: #333; }
        input[type="password"] { width: 100%; padding: 14px; border: 1px solid #e0e0e0; border-radius: 2px; box-sizing: border-box; font-size: 14px; outline: none; }
        input[type="password"]:focus { border-color: #a0a0a0; }
        button { width: 100%; padding: 14px; background-color: #a0a0a0; color: white; border: none; border-radius: 2px; cursor: pointer; font-size: 15px; font-weight: bold; transition: background-color 0.2s; }
        button:hover { background-color: #888; }
      </style>
    </head>
    <body>
      <div class="login-box">
        <h2>IPLAB WORKSTATION</h2>
        <div class="subtitle">특허법인 아이피랩</div>

        <div class="info-text">
          본 사이트는 아이피랩 임직원 전용입니다.<br/>
          아이피랩 외부에서는 접속이 제한됩니다.<br/><br/>
          <span>내부 네트워크(112.218.85.3)에서는 자동 인증됩니다</span>
        </div>

        <div class="input-group">
          <label class="input-label" for="pwInput">접근 비밀번호</label>
          <input type="password" id="pwInput" placeholder="비밀번호를 입력하세요" onkeypress="if(event.keyCode==13) checkPw()" />
        </div>
        <button onclick="checkPw()">접속</button>
      </div>

      <script>
        function checkPw() {
          const pw = document.getElementById('pwInput').value;
          
          // ★ 이곳에서 원하시는 접속 비밀번호를 설정하세요!
          if (pw === 'thinker1234^^') { 
            // 비밀번호가 맞으면 쿠키를 생성 (max-age=86400은 24시간 동안 유지된다는 뜻입니다)
            document.cookie = "iplab-auth=pass; path=/; max-age=86400"; 
            
            // 페이지를 새로고침하면 쿠키와 함께 서버로 요청이 가면서 리액트 화면으로 넘어갑니다.
            window.location.reload(); 
          } else {
            alert('비밀번호가 일치하지 않습니다.');
          }
        }
      </script>
    </body>
    </html>
  `, {
    status: 401,
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  });
}

export const config = {
  matcher: '/(.*)', 
};