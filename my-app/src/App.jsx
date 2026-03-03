// C:\Users\IPLAB\Desktop\smart-patent-web\web\src\App.jsx
import React, { useRef, useState } from "react";

export default function App() {
  // 1. 사용자 입력 상태
  const [pdfFile, setPdfFile] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [fastTrack, setFastTrack] = useState(1);
  const [officeActionCount, setOfficeActionCount] = useState(0);
  const [annuityCount, setAnnuityCount] = useState(1); // 연차등록 횟수 (새로 추가됨)
  const [techField, setTechField] = useState("기계");

  // 2. UI 제어 상태
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [report, setReport] = useState(null); // 백엔드 결과물
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // 3. 접기/펼치기 상태
  const [collapsed, setCollapsed] = useState({
    basic: false, claims: false, inputs: false, smart: false, validation: false
  });

  const toggleCollapse = (key) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ---------------------------
  // 파일 선택 및 드래그 앤 드롭
  // ---------------------------
  function onPickFile(e) {
    const f = e.target.files?.[0];
    if (f) {
      if (!f.name.toLowerCase().endsWith('.pdf') && !f.name.toLowerCase().endsWith('.docx')) {
        setErrorMsg('PDF 또는 DOCX 파일만 업로드할 수 있습니다.');
        return;
      }
    }
    setPdfFile(f || null);
    setErrorMsg("");
    setReport(null);
  }

  function onDropFile(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const f = e.dataTransfer?.files?.[0];
    if (!f) return;

    if (!f.name.toLowerCase().endsWith('.pdf') && !f.name.toLowerCase().endsWith('.docx')) {
      setErrorMsg("PDF 또는 DOCX 파일만 업로드할 수 있습니다.");
      return;
    }
    setErrorMsg("");
    setPdfFile(f);
    setReport(null);
  }

  function onDragOver(e) { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }
  function onDragLeave(e) { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }

  // ---------------------------
  // 🚀 서버 통신 (API Fetch)
  // ---------------------------
  async function onAnalyze() {
    setErrorMsg("");
    setReport(null);

    if (!pdfFile && !textInput.trim()) {
      setErrorMsg("PDF/DOCX 파일을 업로드하거나 텍스트를 입력해 주세요.");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      if (pdfFile) form.append("pdf", pdfFile);
      if (textInput) form.append("text", textInput);
      
      // 입력값 전송 (연차 추가)
      form.append("fastTrack", String(fastTrack));
      form.append("officeActionCount", String(officeActionCount));
      form.append("annuityCount", String(annuityCount)); 
      form.append("techField", techField);

      // 백엔드 API (main.py) 호출
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "서버 분석 중 오류가 발생했습니다.");
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setReport(data); // 데이터 장착 완료!

    } catch (e) {
      setErrorMsg(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------
  // 스타일 정의
  // ---------------------------
  const styles = {
    page: { fontFamily: "'Pretendard', sans-serif", background: "#ffffff", color: "#111827", minHeight: "100vh" },
    container: { maxWidth: 1100, margin: "0 auto", padding: "28px 18px 48px" },
    header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18 },
    titleWrap: { display: "flex", flexDirection: "column", gap: 6 },
    h1: { fontSize: 20, fontWeight: 700, margin: 0 },
    subtitle: { fontSize: 13, color: "#6b7280", lineHeight: 1.5 },
    pill: { display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 10px", border: "1px solid #e5e7eb", background: "#fafafa", borderRadius: 999, fontSize: 12 },
    grid: { display: "grid", gridTemplateColumns: "1fr", gap: 16 },
    card: { border: "1px solid #e5e7eb", background: "#ffffff", padding: 20, borderRadius: 10, boxShadow: "0 6px 22px rgba(17, 24, 39, 0.06)" },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    cardTitle: { fontSize: 14, fontWeight: 700, margin: 0, color: "#3b82f6", borderBottom: "2px solid #3b82f6", paddingBottom: 8 },
    collapseBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4, color: '#6b7280' },
    field: { display: "flex", flexDirection: "column", gap: 6 },
    label: { fontSize: 12, color: "#374151", fontWeight: 600 },
    help: { fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginTop: 10, whiteSpace: "pre-line" },
    inputNum: { width: 60, padding: "8px", border: "1px solid #e5e7eb", borderRadius: 6, textAlign: "center" },
    btn: { border: "1px solid #2563eb", background: "#3b82f6", color: "#fff", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", minHeight: 40 },
    btnDisabled: { opacity: 0.6, cursor: "not-allowed" },
    warn: { border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", padding: "10px 12px", borderRadius: 10, fontSize: 13, marginTop: 12, whiteSpace: "pre-wrap" },
    ok: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", padding: "10px 12px", borderRadius: 10, fontSize: 13, marginTop: 12, textAlign: 'center', fontWeight: 600 },
    dropZoneLarge: (dragging) => ({ border: `2px dashed ${dragging ? "#FB923C" : "#d1d5db"}`, background: dragging ? "#FFF7F1" : "#fafafa", borderRadius: 12, padding: "32px 24px", minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }),
    table: { width: "100%", borderCollapse: "collapse", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", tableLayout: "fixed" },
    th: { textAlign: "left", fontSize: 12, color: "#111827", padding: "10px 10px", background: "#fafafa", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" },
    td: { fontSize: 12, color: "#111827", padding: "10px 10px", borderBottom: "1px solid #f3f4f6", overflow: "hidden", textOverflow: "ellipsis" },
    badge: (tone) => {
      const map = { O: { border: "#bbf7d0", bg: "#f0fdf4", fg: "#166534" }, X: { border: "#fecaca", bg: "#fff1f2", fg: "#991b1b" }, INFO: { border: "#e5e7eb", bg: "#fafafa", fg: "#374151" } };
      const c = map[tone] || map.INFO;
      return { display: "inline-flex", alignItems: "center", justifyContent: "center", border: `1px solid ${c.border}`, background: c.bg, color: c.fg, borderRadius: 10, padding: "6px 10px", fontSize: 12, fontWeight: 700 };
    },
  };

  // ---------------------------
  // 뷰 매핑 (백엔드 데이터 구조 분해)
  // ---------------------------
  const basic = report?.basic || {};
  const claims = report?.claims || {};
  const claimRows = claims?.rows || [];
  const inputsTable = report?.inputsTable || [];
  const smart = report?.smart || {};
  const validation = report?.validation || {};
  const valRows = validation?.rows || [];

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.titleWrap}>
            <h1 style={styles.h1}>SMART 등급 예측 (웹)</h1>
            <p style={styles.subtitle}>실무 기반 청구항 해체 및 SMART 회귀분석 데이터 정량 평가 엔진 탑재</p>
          </div>
          <div style={styles.pill}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: "#22c55e" }} />
            API Server: 8787 (Python)
          </div>
        </div>

        <div style={styles.grid}>
          {/* ===================== [입력 영역] ===================== */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle} style={{...styles.cardTitle, marginBottom: 16}}>🔍 분석 데이터 입력</h2>
            
            <div style={styles.field}>
              <div style={styles.label}>1. 명세서 / 공보 파일 업로드 (또는 텍스트 입력)</div>
              <input ref={fileInputRef} type="file" accept=".pdf,.docx" onChange={onPickFile} style={{ display: "none" }} />
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div 
                  style={{ ...styles.dropZoneLarge(isDragging), height: 200 }}
                  onClick={() => fileInputRef.current?.click()} onDrop={onDropFile} onDragOver={onDragOver} onDragLeave={onDragLeave}
                >
                  {pdfFile ? (
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: 24 }}>📄</span>
                      <div style={{ fontWeight: 600, marginTop: 8 }}>{pdfFile.name}</div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#6b7280' }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }}>📁</div>
                      <div style={{ fontWeight: 600, color: '#111827' }}>드래그 앤 드롭</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>PDF / DOCX</div>
                    </div>
                  )}
                </div>
                <textarea
                  value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="문서 텍스트 복사 붙여넣기..."
                  style={{ height: 200, padding: 16, border: '2px solid #e5e7eb', borderRadius: 10, resize: 'none', fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ height: 24 }} />
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
              {/* 기술분야 */}
              <div style={styles.field}>
                <div style={styles.label}>2. 기술분야 선택</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                  {['기계', '전기 전자 IT', '기구', '화학'].map(field => (
                    <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="radio" value={field} checked={techField === field} onChange={(e) => setTechField(e.target.value)} />
                      <span style={{ fontSize: 14 }}>{field} {field === '전기 전자 IT' && <span style={{fontSize: 11, color: '#ef4444'}}>(가중치 높음)</span>}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 추가 옵션 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={styles.field}>
                  <div style={styles.label}>3. 우선심사 청구 여부</div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="radio" value={1} checked={fastTrack === 1} onChange={(e) => setFastTrack(Number(e.target.value))} />
                      <span style={{ fontSize: 14 }}>청구(1)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="radio" value={0} checked={fastTrack === 0} onChange={(e) => setFastTrack(Number(e.target.value))} />
                      <span style={{ fontSize: 14 }}>미청구(0)</span>
                    </label>
                  </div>
                </div>
                
                <div style={styles.field}>
                  <div style={styles.label}>4. 의견서 제출 수</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    {[0, 1, 2, 3].map(num => (
                      <button key={num} type="button" onClick={() => setOfficeActionCount(num)}
                        style={{ padding: '6px 14px', border: officeActionCount === num ? '2px solid #FB923C' : '1px solid #e5e7eb', background: officeActionCount === num ? '#FFF7F1' : '#fafafa', color: officeActionCount === num ? '#ea580c' : '#6b7280', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* 연차등록 (룰 검증용) */}
              <div style={styles.field}>
                <div style={styles.label}>5. 연차등록 횟수 (등록 특허인 경우)</div>
                <div style={{ marginTop: 4, fontSize: 13, color: '#4b5563' }}>
                  <input type="number" min="0" value={annuityCount} onChange={(e) => setAnnuityCount(Number(e.target.value))} style={styles.inputNum} /> 년차
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>* 1년 이하일 때만 BBB 룰 검증을 수행합니다.</div>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <button style={{ ...styles.btn, fontSize: 16, padding: '16px 48px', width: '100%', maxWidth: 400 }} onClick={onAnalyze} disabled={loading}>
                {loading ? "⏳ 서버에서 딥 파싱 및 계산 중..." : "📊 추출 및 SMART 점수 분석 시작"}
              </button>
            </div>

            {errorMsg && <div style={styles.warn}>{errorMsg}</div>}
            {!errorMsg && report && <div style={styles.ok}>✅ 서버 분석 완료! 하단 리포트를 확인하세요.</div>}
          </div>

          {/* ===================== [결과 출력 영역] ===================== */}
          {report && (
            <>
              {/* 1. 기본 정보 */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h2 style={styles.cardTitle}>1️⃣ 특허 기본 서지 정보</h2>
                  <button onClick={() => toggleCollapse('basic')} style={styles.collapseBtn}>{collapsed.basic ? '▼ 펼치기' : '▲ 접기'}</button>
                </div>
                {!collapsed.basic && (
                  <table style={styles.table}>
                    <colgroup><col style={{ width: '25%' }} /><col style={{ width: '75%' }} /></colgroup>
                    <tbody>
                      <tr><td style={styles.th}>출원번호</td><td style={styles.td}><b>{basic.applicationNumber}</b></td></tr>
                      <tr><td style={styles.th}>출원일</td><td style={styles.td}>{basic.filingDate}</td></tr>
                      <tr><td style={styles.th}>발명의 명칭</td><td style={styles.td}>{basic.inventionTitle}</td></tr>
                      <tr><td style={styles.th}>발명자</td><td style={styles.td}>{basic.inventors}</td></tr>
                    </tbody>
                  </table>
                )}
              </div>

              {/* 2. 청구항 분석 결과 */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h2 style={styles.cardTitle}>2️⃣ 청구항 트리 구조 분석</h2>
                  <button onClick={() => toggleCollapse('claims')} style={styles.collapseBtn}>{collapsed.claims ? '▼ 펼치기' : '▲ 접기'}</button>
                </div>
                {!collapsed.claims && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                      <div style={styles.pill}>총 청구항: <b>{claims.totalCount}</b> 개</div>
                      <div style={styles.pill}>독립항: <b style={{color:'#ef4444'}}>{claims.independentCount}</b> / 종속항: <b>{claims.dependentCount}</b></div>
                      <div style={styles.pill}>청구항 계열 수: <b>{claims.claimSeries}</b></div>
                      <div style={styles.pill}>종속항 평균깊이: <b>{claims.avgDepth}</b></div>
                      <div style={styles.pill}>독립항 총 단어수: <b>{claims.indepWordLen}</b> 자</div>
                    </div>
                    
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={{...styles.th, width: '10%'}}>No</th>
                          <th style={{...styles.th, width: '15%'}}>구분</th>
                          <th style={{...styles.th, width: '25%'}}>말미(대상어) 추정</th>
                          <th style={{...styles.th, width: '50%'}}>서버 판별 사유</th>
                        </tr>
                      </thead>
                      <tbody>
                        {claimRows.map((r, i) => (
                          <tr key={i} style={{ backgroundColor: r.isIndependent ? '#fff1f2' : 'transparent' }}>
                            <td style={{...styles.td, textAlign: 'center', fontWeight: 'bold'}}>{r.no}</td>
                            <td style={styles.td}>
                              <span style={styles.badge(r.isIndependent ? "X" : "INFO")}>{r.isIndependent ? "독립항" : "종속항"}</span>
                            </td>
                            <td style={styles.td}>{r.tail}</td>
                            <td style={{...styles.td, fontSize: 11, color: '#4b5563'}}>{r.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>

              {/* 3. 스마트 입력 테이블 */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h2 style={styles.cardTitle}>3️⃣ 평가 가중치 산출용 입력값 목록</h2>
                  <button onClick={() => toggleCollapse('inputs')} style={styles.collapseBtn}>{collapsed.inputs ? '▼ 펼치기' : '▲ 접기'}</button>
                </div>
                {!collapsed.inputs && (
                  <table style={styles.table}>
                    <thead>
                      <tr><th style={styles.th}>평가 항목</th><th style={styles.th}>추출 값</th><th style={styles.th}>데이터 출처</th></tr>
                    </thead>
                    <tbody>
                      {inputsTable.map((r, i) => (
                        <tr key={i}>
                          <td style={styles.td}>{r.key}</td>
                          <td style={styles.td}><b>{r.value}</b></td>
                          <td style={{...styles.td, color: r.status.includes('자동') ? '#16a34a' : '#6b7280'}}>{r.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* 4. SMART 산식 점수 */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h2 style={styles.cardTitle}>4️⃣ SMART 산식 기반 점수 산출</h2>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  <div style={{ padding: 20, background: "#f8fafc", borderRadius: 12, textAlign: "center", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>가중치 반영 원점수</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#475569" }}>{smart.rawScore} 점</div>
                  </div>
                  <div style={{ padding: 20, background: "#f8fafc", borderRadius: 12, textAlign: "center", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>1~9 클램프 처리 점수</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: "#0f172a" }}>{smart.roundedScore} 점</div>
                  </div>
                  <div style={{ padding: 20, background: "#eff6ff", borderRadius: 12, textAlign: "center", border: "2px solid #bfdbfe" }}>
                    <div style={{ fontSize: 13, color: "#3b82f6", marginBottom: 8, fontWeight: 600 }}>1차 산출 등급</div>
                    <div style={{ fontSize: 36, fontWeight: 900, color: "#1d4ed8" }}>{smart.grade}</div>
                  </div>
                </div>
              </div>

              {/* 5. 룰 기반 검증 및 최종 결론 */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h2 style={styles.cardTitle}>5️⃣ 주요 요소 검증표 및 보수적 최종 등급</h2>
                  <button onClick={() => toggleCollapse('validation')} style={styles.collapseBtn}>{collapsed.validation ? '▼ 펼치기' : '▲ 접기'}</button>
                </div>
                {!collapsed.validation && (
                  <>
                    <table style={styles.table}>
                      <thead>
                        <tr><th style={styles.th}>중요도</th><th style={styles.th}>항목</th><th style={styles.th}>목표 기준치</th><th style={styles.th}>실제 값</th><th style={styles.th}>충족 여부</th></tr>
                      </thead>
                      <tbody>
                        {valRows.map((r, i) => (
                          <tr key={i}>
                            <td style={styles.td}><b>{r.level}</b></td>
                            <td style={styles.td}>{r.item}</td>
                            <td style={styles.td}>{r.threshold}</td>
                            <td style={styles.td}><b>{r.value}</b></td>
                            <td style={styles.td}><span style={styles.badge(r.pass ? "O" : "X")}>{r.pass ? "PASS" : "FAIL"}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    <div style={styles.help}>
                      * 중요도 [상] 3개 필수 충족 및 [중] 2개 충족 시 BBB 이상 부여. (단, [중] 1개 실패 시, 다른 [중] 항목이 목표치의 1.2배 달성 시 구제됨)<br/>
                      * 위 검증 룰은 <b>연차등록 1년 이하</b> 특허에만 적용됩니다. (현재 설정: {annuityCount}년차)
                    </div>

                    <div style={{ marginTop: 24, padding: 24, background: "#fff7ed", borderRadius: 12, border: "2px solid #fdba74", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, color: "#c2410c", fontWeight: 700, marginBottom: 4 }}>RULE 검증 (1.2배 구제 포함) 예측치: {validation.bbbOrAbove ? "BBB 이상" : "BBB 미만"}</div>
                        <div style={{ fontSize: 18, color: "#9a3412", fontWeight: 800 }}>최종 보수적 예측 등급 결재</div>
                        <div style={{ fontSize: 12, color: "#ea580c", marginTop: 4 }}>산식 등급({smart.grade})과 검증 예측을 비교하여 가장 낮은(엄격한) 등급을 채택했습니다.</div>
                      </div>
                      <div style={{ fontSize: 48, fontWeight: 900, color: "#ea580c", textShadow: "2px 2px 0px #ffedd5" }}>
                        {validation.conservativeGrade}
                      </div>
                    </div>
                  </>
                )}
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  );
}