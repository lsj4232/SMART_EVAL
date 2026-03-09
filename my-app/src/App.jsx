// C:\Users\IPLAB\Desktop\smart-patent-web\web\src\App.jsx
import React, { useRef, useState } from "react";

export default function App() {
  // 1. 사용자 기본 입력 상태
  const [pdfFile, setPdfFile] = useState(null);
  const [textInput, setTextInput] = useState("");
  // 등록공보 여부 상태 (기본값: false - 출원서류)
  const [isRegistration, setIsRegistration] = useState(false);
  
  const [fastTrack, setFastTrack] = useState(1);
  const [officeActionCount, setOfficeActionCount] = useState(0);
  const [annuityCount, setAnnuityCount] = useState(1); 
  const [techField, setTechField] = useState("기계");

  // 1-1. 심화 평가 지표 (기본값 0) 상태 추가
  const [appealCount, setAppealCount] = useState(0);               // 거절결정불복심판 수
  const [assigneeChangeCount, setAssigneeChangeCount] = useState(0); // 권리자 변동 수
  const [pledgeCount, setPledgeCount] = useState(0);               // 금융기관 질권설정 수
  const [divisionalPriorityCount, setDivisionalPriorityCount] = useState(0); // 분할출원/우선권주장수
  const [familyCountryCount, setFamilyCountryCount] = useState(0);   // 해외 패밀리 국가수
  const [licenseeCount, setLicenseeCount] = useState(0);             // 실시권자 수
  const [priorArtForeignCount, setPriorArtForeignCount] = useState(0); // 선행문헌 중 논문/외국특허수
  const [totalCitedByCount, setTotalCitedByCount] = useState(0);     // 총 피인용 수
  const [citedRefForeignCount, setCitedRefForeignCount] = useState(0); // 피인용 특허의 인용문헌 중 논문/외국특허수
  const [citedVsFilingGap, setCitedVsFilingGap] = useState(0);       // 피인용과 출원일 차이
  
  // 🚀 [추가] 조기공개 여부 (체크 안 함: 0, 체크 함: 1)
  const [earlyPublication, setEarlyPublication] = useState(0);

  // 2. UI 제어 상태
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [report, setReport] = useState(null); 
  const [isDragging, setIsDragging] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false); // 심화 지표 토글 상태
  const fileInputRef = useRef(null);

  // 🚀 [추가] 추출된 값을 담아두고 수정할 수 있는 상태
  const [editableExtracted, setEditableExtracted] = useState({});

  // 3. 접기/펼치기 상태 (finalGrade 추가)
  const [collapsed, setCollapsed] = useState({
    basic: false, claims: false, inputs: false, smart: false, validation: false, finalGrade: false
  });

  const toggleCollapse = (key) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ---------------------------
  // 파일 선택 및 드래그 앤 드롭
  // ---------------------------
  function onPickFile(e) {
    const f = e.target.files?.[0];
    if (f && !f.name.toLowerCase().endsWith('.pdf') && !f.name.toLowerCase().endsWith('.docx')) {
      setErrorMsg('PDF 또는 DOCX 파일만 업로드할 수 있습니다.');
      return;
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
  // 서버 통신 (API Fetch)
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
      
      form.append("isRegistration", isRegistration);
      form.append("fastTrack", String(fastTrack));
      form.append("officeActionCount", String(officeActionCount));
      form.append("annuityCount", String(annuityCount)); 
      form.append("techField", techField);

      // 심화 입력값들을 FormData에 추가 전송
      form.append("appealCount", String(appealCount));
      form.append("assigneeChangeCount", String(assigneeChangeCount));
      form.append("pledgeCount", String(pledgeCount));
      form.append("divisionalPriorityCount", String(divisionalPriorityCount));
      form.append("familyCountryCount", String(familyCountryCount));
      form.append("licenseeCount", String(licenseeCount));
      form.append("priorArtForeignCount", String(priorArtForeignCount));
      form.append("totalCitedByCount", String(totalCitedByCount));
      form.append("citedRefForeignCount", String(citedRefForeignCount));
      form.append("citedVsFilingGap", String(citedVsFilingGap));
      
      // 🚀 [추가] 조기공개여부 전송
      form.append("earlyPublication", String(earlyPublication));

      // 🌟 API URL 환경변수 적용
      const apiUrl = "https://smart-eval-backend.onrender.com";
      const res = await fetch(`${apiUrl}/api/analyze`, { method: "POST", body: form });
      
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "서버 분석 중 오류가 발생했습니다.");
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setReport(data);

      // 🚀 [추가] 서버에서 온 자동추출 값을 수정 폼에 복사
      const v = data.smart?.variables || {};
      setEditableExtracted({
        ipcCount: v.ipc || 0,
        indepCount: v.indep_count || 0,
        depCount: v.dep_count || 0,
        avgDepth: v.avg_depth || 0,
        claimSeries: v.claim_series || 0,
        indepWordLen: v.indep_word_len || 0,
        descWordLen: v.desc_word_len || 0,
        drawingCount: v.drawing || 0,
        inventorCount: v.inventor_count || 0,
      });

    } catch (e) {
      setErrorMsg(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // 🚀 [추가] 재계산 API 호출 함수
  async function onRecalculate() {
    setLoading(true);
    try {
      const payload = {
        fastTrack, officeActionCount, annuityCount, techField, appealCount, assigneeChangeCount,
        pledgeCount, divisionalPriorityCount, familyCountryCount, licenseeCount, priorArtForeignCount,
        totalCitedByCount, citedRefForeignCount, citedVsFilingGap, earlyPublication,
        
        ipcCount: Number(editableExtracted.ipcCount),
        indepCount: Number(editableExtracted.indepCount),
        depCount: Number(editableExtracted.depCount),
        avgDepth: Number(editableExtracted.avgDepth),
        claimSeries: Number(editableExtracted.claimSeries),
        indepWordLen: Number(editableExtracted.indepWordLen),
        descWordLen: Number(editableExtracted.descWordLen),
        drawingCount: Number(editableExtracted.drawingCount),
        inventorCount: Number(editableExtracted.inventorCount),
      };

      // 🌟 API URL 환경변수 적용
      const apiUrl = "https://smart-eval-backend.onrender.com";
      const res = await fetch(`${apiUrl}/api/recalculate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // 수정된 계산 결과만 부분 업데이트
      setReport(prev => ({ ...prev, inputsTable: data.inputsTable, smart: data.smart, validation: data.validation }));
    } catch (e) {
      alert("재계산 실패: " + e.message);
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
    inputFull: { width: "100%", padding: "8px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" },
    btn: { border: "1px solid #2563eb", background: "#3b82f6", color: "#fff", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", minHeight: 40 },
    btnGhost: { background: "none", border: "1px solid #d1d5db", color: "#4b5563", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-block" },
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
            <h2 style={{...styles.cardTitle, marginBottom: 16}}>🔍 분석 데이터 입력</h2>
            
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
                  style={{ height: 200, padding: 16, border: '2px solid #e5e7eb', borderRadius: 10, resize: 'none', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>

              {/* 문서 포맷 선택 (라디오 버튼) */}
              <div style={{ display: 'flex', gap: 20, marginTop: 12, padding: "12px 16px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <div style={styles.label}>문서 포맷:</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="radio" checked={!isRegistration} onChange={() => setIsRegistration(false)} />
                  <span style={{ fontSize: 14 }}>출원서류</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="radio" checked={isRegistration} onChange={() => setIsRegistration(true)} />
                  <span style={{ fontSize: 14 }}>등록 / 공개 특허공보</span>
                </label>
              </div>
            </div>

            <div style={{ height: 24 }} />
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
              <div style={styles.field}>
                <div style={styles.label}>2. 기술분야 선택</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                  {['기계', '전기 전자 IT', '기구', '화학'].map(field => (
                    <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="radio" value={field} checked={techField === field} onChange={(e) => setTechField(e.target.value)} />
                      <span style={{ fontSize: 14 }}>{field}</span>
                    </label>
                  ))}
                </div>
              </div>

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
              
              <div style={styles.field}>
                <div style={styles.label}>5. 연차등록 횟수 (등록 특허인 경우)</div>
                <div style={{ marginTop: 4, fontSize: 13, color: '#4b5563' }}>
                  <input type="number" min="0" value={annuityCount} onChange={(e) => setAnnuityCount(Number(e.target.value))} style={styles.inputNum} /> 년차
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>* 1년 이하일 때만 BBB 룰 검증을 수행합니다.</div>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <button onClick={() => setShowAdvanced(!showAdvanced)} style={styles.btnGhost}>
                {showAdvanced ? "▲ 상세 평가 지표 직접 입력 닫기" : "▼ 상세 평가 지표 직접 입력 열기 (기본값 0)"}
              </button>
            </div>

            {/* 심화 지표 입력 그리드 */}
            {showAdvanced && (
              <div style={{ marginTop: 16, padding: 20, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
                  미확인되어 서버가 '0'으로 간주하는 항목들입니다. 정확한 값이 있다면 직접 숫자를 입력해주세요.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                  
                  {/* 🚀 [추가] 조기공개 여부 체크박스 (볼드체 강조) */}
                  <div style={{ ...styles.field, justifyContent: 'center', padding: '8px 0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={earlyPublication === 1} 
                        onChange={(e) => setEarlyPublication(e.target.checked ? 1 : 0)} 
                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 'bold', color: '#111827' }}>조기공개 여부</span>
                    </label>
                  </div>

                  <div style={styles.field}><div style={styles.label}>거절결정불복심판 수</div><input type="number" min="0" value={appealCount} onChange={(e) => setAppealCount(Number(e.target.value))} style={styles.inputFull} /></div>
                  <div style={styles.field}><div style={styles.label}>권리자 변동 수</div><input type="number" min="0" value={assigneeChangeCount} onChange={(e) => setAssigneeChangeCount(Number(e.target.value))} style={styles.inputFull} /></div>
                  <div style={styles.field}><div style={styles.label}>금융기관 질권설정 수</div><input type="number" min="0" value={pledgeCount} onChange={(e) => setPledgeCount(Number(e.target.value))} style={styles.inputFull} /></div>
                  <div style={styles.field}><div style={styles.label}>분할출원/우선권주장수</div><input type="number" min="0" value={divisionalPriorityCount} onChange={(e) => setDivisionalPriorityCount(Number(e.target.value))} style={styles.inputFull} /></div>
                  <div style={styles.field}><div style={styles.label}>해외 패밀리 국가수</div><input type="number" min="0" value={familyCountryCount} onChange={(e) => setFamilyCountryCount(Number(e.target.value))} style={styles.inputFull} /></div>
                  <div style={styles.field}><div style={styles.label}>실시권자 수</div><input type="number" min="0" value={licenseeCount} onChange={(e) => setLicenseeCount(Number(e.target.value))} style={styles.inputFull} /></div>
                  <div style={styles.field}><div style={styles.label}>선행문헌 중 논문/외국특허수</div><input type="number" min="0" value={priorArtForeignCount} onChange={(e) => setPriorArtForeignCount(Number(e.target.value))} style={styles.inputFull} /></div>
                  <div style={styles.field}><div style={styles.label}>총 피인용 수</div><input type="number" min="0" value={totalCitedByCount} onChange={(e) => setTotalCitedByCount(Number(e.target.value))} style={styles.inputFull} /></div>
                  <div style={styles.field}><div style={styles.label}>피인용의 특허의 인용문헌 중 논문/외국특허수</div><input type="number" min="0" value={citedRefForeignCount} onChange={(e) => setCitedRefForeignCount(Number(e.target.value))} style={styles.inputFull} /></div>
                  <div style={styles.field}><div style={styles.label}>피인용과 출원일 차이(년)</div><input type="number" min="0" value={citedVsFilingGap} onChange={(e) => setCitedVsFilingGap(Number(e.target.value))} style={styles.inputFull} /></div>
                </div>
              </div>
            )}

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
                  <>
                    <table style={styles.table}>
                      <thead>
                        <tr><th style={styles.th}>평가 항목</th><th style={styles.th}>추출 값</th><th style={styles.th}>데이터 출처</th></tr>
                      </thead>
                
                    <tbody>
                      {inputsTable.map((r, i) => {
                        // 추출항목 매핑 테이블
                        const fieldMap = {
                          "IPC 수": "ipcCount", "독립항 수": "indepCount", "종속항 수": "depCount",
                          "종속항의 평균깊이": "avgDepth", "청구항 계열 수": "claimSeries", "독립항 단어수": "indepWordLen",
                          "발명의 설명의 단어수": "descWordLen", "도면 수": "drawingCount", "발명자수": "inventorCount"
                        };
                        const editKey = fieldMap[r.key];

                        // HTML 스피너(화살표) 방어용 min/max 동적 설정
                        let minAttr = "1";
                        if (editKey === 'depCount' || editKey === 'avgDepth') minAttr = "0";
                        let maxAttr = editKey === 'claimSeries' ? "2" : undefined;

                        return (
                          <tr key={i}>
                            <td style={styles.td}>{r.key}</td>
                            <td style={styles.td}>
                              {/* 매핑된 추출값 항목이면 인풋박스를 보여주고, 아니면 그냥 텍스트 출력 */}
                              {editKey ? (
                                <input
                                  type="number"
                                  min={minAttr}
                                  max={maxAttr}
                                  step={editKey === 'avgDepth' ? '0.1' : '1'}
                                  value={editableExtracted[editKey] ?? r.value}
                                  onChange={(e) => {
                                    let val = e.target.value;
                                    // 입력 중 실시간 방어: 계열 수는 2 초과 불가능
                                    if (editKey === 'claimSeries' && Number(val) > 2) val = "2";
                                    setEditableExtracted({...editableExtracted, [editKey]: val});
                                  }}
                                  onBlur={(e) => {
                                    let val = e.target.value;
                                    let num = Number(val);

                                    // 비정상 값(빈 문자열 등)이 들어오면 기본값 0으로 처리 후 세부 검증
                                    if (isNaN(num) || val === "") num = 0;

                                    // 조건 1: 종속항 수 (최소 0)
                                    if (editKey === 'depCount') {
                                      if (num < 0) num = 0; 
                                    } 
                                    // 조건 2: 종속항의 평균깊이 (0 또는 2.1 이상)
                                    else if (editKey === 'avgDepth') {
                                      if (num <= 0) num = 0; 
                                      else if (num > 0 && num < 2.1) num = 2.1; 
                                    } 
                                    // 조건 3: 청구항 계열 수 (최소 1, 최대 2)
                                    else if (editKey === 'claimSeries') {
                                      if (num < 1) num = 1; 
                                      else if (num > 2) num = 2; 
                                    } 
                                    // 조건 4: 나머지 항목 (IPC, 독립항수, 단어수, 도면수, 발명자수 -> 최소 1)
                                    else {
                                      if (num < 1) num = 1; 
                                    }

                                    setEditableExtracted({...editableExtracted, [editKey]: num});
                                  }}
                                  style={{ width: 80, padding: 6, border: '1px solid #3b82f6', borderRadius: 4, textAlign: 'center', fontWeight: 'bold' }}
                                />
                              ) : (
                                <b>{r.value}</b>
                              )}
                            </td>
                            <td style={{...styles.td, color: r.status.includes('자동') ? '#16a34a' : (r.status.includes('입력') ? '#3b82f6' : '#ea580c')}}>
                              {r.status}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    </table>
                    
                    {/* 🚀 [추가] 재계산 버튼 */}
                    <div style={{ padding: "12px 16px", background: "#f8fafc", textAlign: "right", borderTop: "1px solid #e5e7eb", borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
                      <button onClick={onRecalculate} style={{ ...styles.btn, background: "#10b981", borderColor: "#059669", fontSize: 14 }}>
                        🔄 수정한 숫자로 결과 즉시 재계산
                      </button>
                    </div>
                  </>
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
                    <div style={{ fontSize: 13, color: "#3b82f6", marginBottom: 8, fontWeight: 600 }}>산식 기반 산출 등급</div>
                    <div style={{ fontSize: 36, fontWeight: 900, color: "#1d4ed8" }}>{smart.grade}</div>
                  </div>
                </div>
              </div>

              {/* 5. 룰 기반 주요 요소 검증표 */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h2 style={styles.cardTitle}>5️⃣ 주요 요소 검증표</h2>
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
                      * 검증요건 전항목 부합 여부를 원칙으로 하되, 자체적 구제룰을 적용하여 FAIL인 항목이 있더라도 BBB 이상으로 판정될 수 있습니다. <br />
                    </div>

                    {validation.summaryTable && (
                      <table style={{ ...styles.table, marginTop: 24, border: '2px solid #e5e7eb', fontFamily: "'맑은 고딕', sans-serif", lineHeight: 1.5 }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{...styles.th, textAlign: 'center', fontSize: '10pt', fontWeight: 'normal', color: 'black', borderRight: '1px solid #e5e7eb'}}>검증요건 전항목 부합 여부</th>
                            <th style={{...styles.th, textAlign: 'center', fontSize: '10pt', fontWeight: 'normal', color: 'black', borderRight: '1px solid #e5e7eb'}}>FAIL 구제 가능 여부</th>
                            <th style={{...styles.th, textAlign: 'center', fontSize: '10pt', fontWeight: 'normal', color: 'black'}}>종합평가</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{...styles.td, textAlign: 'center', fontSize: '10pt', fontWeight: 'bold', borderRight: '1px solid #f3f4f6', color: validation.summaryTable.allPassed === 'O' ? '#16a34a' : '#ef4444'}}>
                              {validation.summaryTable.allPassed}
                            </td>
                            <td style={{
                              ...styles.td, 
                              textAlign: 'center', 
                              fontSize: '10pt',
                              fontWeight: 'bold', 
                              borderRight: '1px solid #f3f4f6', 
                              color: validation.summaryTable.allPassed === 'O' ? '#9ca3af' : (validation.summaryTable.rescuePossible === 'O' ? '#16a34a' : '#ef4444')
                            }}>
                              {validation.summaryTable.allPassed === 'O' ? '-' : validation.summaryTable.rescuePossible}
                            </td>
                            <td style={{...styles.td, textAlign: 'center', fontSize: '10pt', fontWeight: 'bold', color: validation.summaryTable.overall === 'BBB 이상' ? '#1d4ed8' : '#ef4444'}}>
                              {validation.summaryTable.overall}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </>
                )}
              </div>

              {/* 6. 최종 결론 */}
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <h2 style={styles.cardTitle}>6️⃣ 보수적 최종 등급</h2>
                  <button onClick={() => toggleCollapse('finalGrade')} style={styles.collapseBtn}>{collapsed.finalGrade ? '▼ 펼치기' : '▲ 접기'}</button>
                </div>
                {!collapsed.finalGrade && (
                  <div style={{ padding: 24, background: "#fff7ed", borderRadius: 12, border: "2px solid #fdba74", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, color: "#c2410c", fontWeight: 700, marginBottom: 4 }}>1. 산식 기반 산출 등급: {report?.smart?.grade} / 2. 요소 검증 기반 등급: {validation.bbbOrAbove ? "BBB 이상" : "BBB 미만"}</div>
                      <div style={{ fontSize: 18, color: "#9a3412", fontWeight: 800 }}>최종 보수적 예측 등급 </div>
                      <div style={{ fontSize: 12, color: "#ea580c", marginTop: 4 }}>산식 등급({smart.grade})과 요소 기반 등급({validation.bbbOrAbove ? "BBB 이상" : "BBB 미만"})을 비교하여 가장 낮은(엄격한) 등급을 채택했습니다.</div>
                    </div>
                    <div style={{ fontSize: 48, fontWeight: 900, color: "#ea580c", textShadow: "2px 2px 0px #ffedd5" }}>
                      {validation.conservativeGrade}
                    </div>
                  </div>
                )}
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  );
}