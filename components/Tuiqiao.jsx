"use client";

import { useState, useCallback, useRef } from "react";

/* ═══════════════════════════════════════════
   推敲 — Progressive disclosure design
   Heatmap + click-to-reveal
   ═══════════════════════════════════════════ */

const LAYERS = {
  abstraction: {
    sensory:   { label: "感官", color: "#C27A5A" },
    structure: { label: "结构", color: "#A68B3C" },
    function:  { label: "功能", color: "#5A8FA6" },
    strategy:  { label: "策略", color: "#7E5EA6" },
    value:     { label: "价值", color: "#A65A72" },
  },
  speech_act: {
    describe: { label: "描述", color: "#5A8FA6" },
    feel:     { label: "感受", color: "#C27A5A" },
    judge:    { label: "判断", color: "#A68B3C" },
    claim:    { label: "主张", color: "#7E5EA6" },
    reason:   { label: "论据", color: "#5AA67E" },
  },
};

const LOGIC_LABELS = {
  cause: "因果", contrast: "转折", addition: "递进", condition: "条件",
  concession: "让步", sequence: "顺序", summary: "总结", parallel: "并列", none: "",
};

const EXAMPLES = [
  { label: "设计评审", text: "我觉得这个设计很简单，但是用户体验并不好。因为导航结构太复杂了，用户根本找不到想要的功能。如果能把界面做得更自然一些，效果会好很多。" },
  { label: "跳层吵架", text: "这个颜色太丑了。不是颜色的问题，是整个产品方向就不对。你说方向不对，那你觉得用户到底需要什么？用户需要的是更简单的操作，不是更好看的界面。" },
  { label: "论文段落", text: "研究表明沉浸式环境能显著提升学习效果。然而现有系统的交互设计往往过于复杂，导致认知负担增加。因此我们提出一种新的交互范式，通过自然手势降低操作门槛。" },
];

export default function Tuiqiao() {
  const [inputText, setInputText] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedWord, setExpandedWord] = useState(null);
  const [hoveredWord, setHoveredWord] = useState(null);
  const [showOverlay, setShowOverlay] = useState(null);
  const [layerMode, setLayerMode] = useState("abstraction");
  const [analyzed, setAnalyzed] = useState(false);
  const textRef = useRef(null);

  const analyze = useCallback(async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setExpandedWord(null);
    setShowOverlay(null);
    setAnalyzed(false);

    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);
      setAnalysis(data);
      setAnalyzed(true);
    } catch (e) {
      console.error("Analysis error:", e);
      setError(`分析失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [inputText]);

  const getSeverityColor = (severity) => {
    if (severity >= 3) return { bg: "rgba(194,90,70,0.14)", border: "#C25A46" };
    if (severity >= 2) return { bg: "rgba(194,122,90,0.10)", border: "#C27A5A" };
    return { bg: "rgba(194,152,120,0.06)", border: "#C29878" };
  };

  const totalAmbig = analysis?.sentences?.reduce((s, sent) => s + (sent.ambiguous?.length || 0), 0) || 0;
  const totalJumps = analysis?.layer_transitions?.length || 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F8F6F2",
      color: "#2C2B28",
      fontFamily: "'Noto Serif SC', 'Source Han Serif SC', Georgia, serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;600;700&display=swap');
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dotPulse { 0%,100%{opacity:.3} 50%{opacity:1} }
        @keyframes slideDown { from{opacity:0;max-height:0;padding-top:0;padding-bottom:0} to{opacity:1;max-height:400px;padding-top:12px;padding-bottom:12px} }
        .xc-word { cursor:pointer; transition:all .12s; position:relative; }
        .xc-word:hover { filter:brightness(0.95); }
        .xc-pill:hover { background:rgba(0,0,0,.06) !important; }
        .xc-ex:hover { background:#EDEAE4 !important; }
        * { box-sizing:border-box; }
        textarea:focus { outline:none; border-color:#B8A080 !important; }
      `}</style>

      <header style={{
        maxWidth: "640px", margin: "0 auto", padding: "28px 16px 0",
        display: "flex", justifyContent: "space-between", alignItems: "flex-end",
      }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "5px", margin: 0 }}>推敲</h1>
          <p style={{ fontSize: "10px", color: "#B0A898", marginTop: "2px", fontWeight: 300, margin: 0 }}>
            点击模糊处 · 逐个想清楚
          </p>
        </div>
      </header>

      <main style={{ maxWidth: "640px", margin: "0 auto", padding: "24px 16px 80px" }}>

        <div style={{ marginBottom: "24px" }}>
          <textarea
            value={inputText}
            onChange={e => { setInputText(e.target.value); setAnalyzed(false); }}
            placeholder="粘贴或输入一段中文..."
            rows={4}
            style={{
              width: "100%", background: "#FFFEFC", border: "1px solid #DDD8CE",
              borderRadius: "6px", padding: "16px 18px", fontSize: "15px",
              lineHeight: "2", color: "#2C2B28", fontFamily: "inherit",
              resize: "vertical", transition: "border-color .2s",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {EXAMPLES.map((ex, i) => (
                <button key={i} className="xc-ex" onClick={() => { setInputText(ex.text); setAnalyzed(false); setAnalysis(null); }} style={{
                  background: "#F0EDE6", border: "1px solid #DDD8CE", color: "#8A8478",
                  fontSize: "11px", padding: "3px 10px", borderRadius: "3px",
                  cursor: "pointer", fontFamily: "inherit",
                }}>{ex.label}</button>
              ))}
            </div>
            <button onClick={analyze} disabled={!inputText.trim() || loading} style={{
              padding: "8px 24px",
              background: inputText.trim() && !loading ? "#2C2B28" : "#D0CCC4",
              color: inputText.trim() && !loading ? "#F8F6F2" : "#A8A298",
              border: "none", borderRadius: "4px", fontSize: "13px",
              fontWeight: 600, cursor: inputText.trim() && !loading ? "pointer" : "default",
              letterSpacing: "3px", fontFamily: "inherit",
            }}>{loading ? "推敲中..." : "推敲"}</button>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "36px 0", animation: "fadeIn .3s" }}>
            <div style={{ display: "flex", gap: "5px", justifyContent: "center", marginBottom: "10px" }}>
              {[0,1,2].map(i => <div key={i} style={{ width:"5px",height:"5px",borderRadius:"50%",background:"#C27A5A",animation:`dotPulse 1.2s ${i*.2}s infinite` }}/>)}
            </div>
            <p style={{ fontSize: "12px", color: "#A8A298", margin: 0 }}>逐句拆解中...</p>
          </div>
        )}

        {error && (
          <div style={{ padding: "12px 16px", background: "#FDF5F2", border: "1px solid #E8D0C8", borderRadius: "5px", color: "#9A5A4A", fontSize: "13px", marginBottom: "16px" }}>
            {error}
          </div>
        )}

        {analysis && analyzed && !loading && (
          <div style={{ animation: "fadeIn .4s" }}>

            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              marginBottom: "16px", flexWrap: "wrap",
            }}>
              <span style={{ fontSize: "11px", color: "#B0A898" }}>
                发现 <b style={{ color: "#C27A5A" }}>{totalAmbig}</b> 处模糊表达
                {totalJumps > 0 && <>，<b style={{ color: "#A65A72", marginLeft: "4px" }}>{totalJumps}</b> 处跳层</>}
              </span>
              <span style={{ flex: 1 }} />
              {["layers", "logic"].map(key => (
                <button key={key} className="xc-pill" onClick={() => setShowOverlay(showOverlay === key ? null : key)} style={{
                  padding: "4px 12px", borderRadius: "3px", fontSize: "10px",
                  border: `1px solid ${showOverlay === key ? "#C27A5A44" : "#DDD8CE"}`,
                  background: showOverlay === key ? "#C27A5A0A" : "#F0EDE6",
                  color: showOverlay === key ? "#C27A5A" : "#8A8478",
                  cursor: "pointer", fontFamily: "inherit", fontWeight: showOverlay === key ? 600 : 400,
                }}>
                  {key === "layers" ? "层级" : "逻辑"}
                </button>
              ))}
              {showOverlay === "layers" && (
                <div style={{ display: "flex", gap: "1px", background: "#E0DCD4", borderRadius: "3px", padding: "1px" }}>
                  {[{ key: "abstraction", label: "抽象" }, { key: "speech_act", label: "话语" }].map(m => (
                    <button key={m.key} onClick={() => setLayerMode(m.key)} style={{
                      padding: "3px 10px", border: "none", borderRadius: "2px", fontSize: "10px",
                      background: layerMode === m.key ? "#FFFEFC" : "transparent",
                      color: layerMode === m.key ? "#2C2B28" : "#A8A298",
                      cursor: "pointer", fontFamily: "inherit",
                    }}>{m.label}</button>
                  ))}
                </div>
              )}
            </div>

            {showOverlay === "layers" && (
              <div style={{
                display: "flex", gap: "10px", marginBottom: "12px", padding: "6px 0",
                animation: "fadeIn .2s", flexWrap: "wrap",
              }}>
                {Object.entries(LAYERS[layerMode]).map(([id, l]) => (
                  <span key={id} style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "10px", color: l.color }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: l.color, display: "inline-block" }} />
                    {l.label}
                  </span>
                ))}
              </div>
            )}

            <div ref={textRef} style={{
              background: "#FFFEFC",
              border: "1px solid #E8E4DC",
              borderRadius: "8px",
              padding: "24px 28px",
              fontSize: "16px",
              lineHeight: "2.2",
              position: "relative",
            }}>
              {analysis.sentences.map((sent, si) => {
                const layerKey = layerMode === "abstraction" ? sent.abstraction_layer : sent.speech_act_layer;
                const layer = LAYERS[layerMode][layerKey];
                const transition = analysis.layer_transitions?.find(t => t.to_idx === si);
                const logic = LOGIC_LABELS[sent.logic_to_prev];

                return (
                  <span key={si} style={{ position: "relative" }}>
                    {transition && showOverlay === "layers" && (
                      <span style={{
                        display: "inline-block",
                        verticalAlign: "middle",
                        margin: "0 4px",
                        padding: "1px 8px",
                        background: "#A65A7210",
                        border: "1px dashed #A65A7240",
                        borderRadius: "3px",
                        fontSize: "10px",
                        color: "#A65A72",
                        fontWeight: 500,
                      }}>
                        ⚡{transition.description}
                      </span>
                    )}

                    {si > 0 && logic && showOverlay === "logic" && (
                      <span style={{
                        display: "inline-block",
                        verticalAlign: "middle",
                        margin: "0 2px",
                        fontSize: "10px",
                        color: "#B0A898",
                        fontWeight: 500,
                        background: "#F0EDE6",
                        padding: "0 6px",
                        borderRadius: "2px",
                      }}>
                        {logic}
                      </span>
                    )}

                    {showOverlay === "layers" && layer && (
                      <span style={{
                        display: "inline-block",
                        verticalAlign: "middle",
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: layer.color,
                        marginRight: "4px",
                        opacity: 0.7,
                      }} />
                    )}

                    <SentenceDisplay
                      sentence={sent}
                      sentIdx={si}
                      expandedWord={expandedWord}
                      setExpandedWord={setExpandedWord}
                      hoveredWord={hoveredWord}
                      setHoveredWord={setHoveredWord}
                      getSeverityColor={getSeverityColor}
                    />
                  </span>
                );
              })}
            </div>

            {expandedWord && (() => {
              const sent = analysis.sentences[expandedWord.sentIdx];
              const amb = sent?.ambiguous?.[expandedWord.wordIdx];
              if (!amb) return null;
              return (
                <div style={{
                  marginTop: "12px",
                  padding: "16px 20px",
                  background: "#FFFEFC",
                  border: "1px solid #E0D8CC",
                  borderRadius: "8px",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                  animation: "fadeIn .2s",
                  position: "relative",
                }}>
                  <button onClick={() => setExpandedWord(null)} style={{
                    position: "absolute", top: "10px", right: "14px",
                    background: "none", border: "none", fontSize: "16px",
                    color: "#C8C4BC", cursor: "pointer",
                  }}>×</button>

                  <div style={{ marginBottom: "12px" }}>
                    <span style={{ fontSize: "18px", fontWeight: 600, color: "#C27A5A" }}>
                      「{amb.phrase}」
                    </span>
                    <span style={{ fontSize: "12px", color: "#A8A298", marginLeft: "10px" }}>
                      {amb.why_ambiguous}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
                    {amb.possible_meanings?.map((m, mi) => (
                      <div key={mi} style={{
                        display: "flex", alignItems: "baseline", gap: "8px",
                        fontSize: "13px", lineHeight: "1.6", flexWrap: "wrap",
                      }}>
                        <span style={{ color: "#C27A5A", fontWeight: 600, fontSize: "11px", opacity: 0.6, flexShrink: 0 }}>
                          {String.fromCharCode(65 + mi)}
                        </span>
                        <span style={{ color: "#4A4A45" }}>{m.interpretation}</span>
                        <span style={{ color: "#C8C0B4" }}>→</span>
                        <span style={{
                          color: "#6A5A48", fontWeight: 500,
                          background: "#F0EAE0", padding: "0 6px", borderRadius: "2px",
                        }}>
                          {m.rewrite}
                        </span>
                      </div>
                    ))}
                  </div>

                  {amb.followup_question && (
                    <div style={{
                      padding: "8px 14px",
                      background: "#C27A5A08",
                      borderLeft: "2px solid #C27A5A30",
                      borderRadius: "0 4px 4px 0",
                    }}>
                      <span style={{ fontSize: "10px", color: "#C27A5A", fontWeight: 600, marginRight: "6px" }}>追问</span>
                      <span style={{ fontSize: "13px", color: "#6A5A48", lineHeight: "1.7" }}>
                        {amb.followup_question}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {expandedWord && (() => {
              const sent = analysis.sentences[expandedWord.sentIdx];
              if (!sent?.annotation) return null;
              return (
                <div style={{
                  marginTop: "6px",
                  padding: "6px 14px",
                  fontSize: "11px",
                  color: "#A8A298",
                  fontStyle: "italic",
                  animation: "fadeIn .2s",
                }}>
                  编辑批注：{sent.annotation}
                </div>
              );
            })()}
          </div>
        )}

        {!analysis && !loading && !inputText && (
          <div style={{ textAlign: "center", padding: "56px 0", animation: "fadeIn .6s" }}>
            <div style={{ fontSize: "48px", color: "#D8D4CC", marginBottom: "14px", letterSpacing: "6px", fontWeight: 300 }}>推敲</div>
            <p style={{ fontSize: "13px", color: "#B8B0A4", lineHeight: "2.2", maxWidth: "280px", margin: "0 auto", fontWeight: 300 }}>
              粘贴一段文字<br />
              模糊之处会以深浅标出<br />
              点击任意一处，逐个想清楚
            </p>
          </div>
        )}
      </main>

      {hoveredWord && !expandedWord && (
        <HoverTooltip hoveredWord={hoveredWord} analysis={analysis} />
      )}
    </div>
  );
}

function SentenceDisplay({ sentence, sentIdx, expandedWord, setExpandedWord, hoveredWord, setHoveredWord, getSeverityColor }) {
  const text = sentence.text;
  const words = sentence.ambiguous || [];

  if (words.length === 0) return <span>{text}。</span>;

  const highlights = [];
  for (let wi = 0; wi < words.length; wi++) {
    const w = words[wi];
    const idx = text.indexOf(w.phrase);
    if (idx !== -1) {
      const overlaps = highlights.some(h => idx < h.end && idx + w.phrase.length > h.start);
      if (!overlaps) highlights.push({ start: idx, end: idx + w.phrase.length, wordIdx: wi, severity: w.severity || 2 });
    }
  }
  highlights.sort((a, b) => a.start - b.start);

  const parts = [];
  let last = 0;
  for (const h of highlights) {
    if (h.start > last) parts.push(<span key={`t${last}`}>{text.slice(last, h.start)}</span>);
    const isExpanded = expandedWord?.sentIdx === sentIdx && expandedWord?.wordIdx === h.wordIdx;
    const isHovered = hoveredWord?.sentIdx === sentIdx && hoveredWord?.wordIdx === h.wordIdx;
    const colors = getSeverityColor(h.severity);

    parts.push(
      <span
        key={`w${h.start}`}
        className="xc-word"
        onClick={e => {
          e.stopPropagation();
          setExpandedWord(isExpanded ? null : { sentIdx, wordIdx: h.wordIdx });
        }}
        onMouseEnter={e => {
          const rect = e.target.getBoundingClientRect();
          setHoveredWord({ sentIdx, wordIdx: h.wordIdx, rect, hint: words[h.wordIdx]?.hint });
        }}
        onMouseLeave={() => setHoveredWord(null)}
        style={{
          background: isExpanded ? "rgba(194,122,90,0.18)" : isHovered ? colors.bg : `rgba(194,122,90,${0.02 + h.severity * 0.03})`,
          borderBottom: `${Math.max(1.5, h.severity)}px ${h.severity >= 3 ? "solid" : "dashed"} ${colors.border}`,
          padding: "0 1px",
          borderRadius: "1px",
          color: isExpanded ? "#A05A3A" : "inherit",
        }}
      >
        {text.slice(h.start, h.end)}
      </span>
    );
    last = h.end;
  }
  if (last < text.length) parts.push(<span key="tend">{text.slice(last)}</span>);
  parts.push(<span key="period">。</span>);

  return <>{parts}</>;
}

function HoverTooltip({ hoveredWord, analysis }) {
  if (!hoveredWord || !analysis) return null;
  const sent = analysis.sentences[hoveredWord.sentIdx];
  const amb = sent?.ambiguous?.[hoveredWord.wordIdx];
  if (!amb) return null;

  const { rect } = hoveredWord;
  const hint = amb.hint || amb.why_ambiguous?.slice(0, 12) || "";

  return (
    <div style={{
      position: "fixed",
      left: rect.left + rect.width / 2,
      top: rect.top - 6,
      transform: "translate(-50%, -100%)",
      padding: "4px 10px",
      background: "#3A3835",
      color: "#F0EDE6",
      fontSize: "11px",
      borderRadius: "4px",
      whiteSpace: "nowrap",
      pointerEvents: "none",
      zIndex: 1000,
      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      animation: "fadeIn .12s",
    }}>
      {hint}
      <div style={{
        position: "absolute",
        bottom: "-4px",
        left: "50%",
        transform: "translateX(-50%)",
        width: 0, height: 0,
        borderLeft: "4px solid transparent",
        borderRight: "4px solid transparent",
        borderTop: "4px solid #3A3835",
      }} />
    </div>
  );
}
