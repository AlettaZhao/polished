"use client";

import { useState, useCallback, useRef } from "react";

/* ═══════════════════════════════════════════
   推敲 v5 — Wide reading view + wheel picker
   ═══════════════════════════════════════════ */

const ABSTRACTION = {
  sensory:   { label: "感官", color: "#C27A5A" },
  structure: { label: "结构", color: "#A68B3C" },
  function:  { label: "功能", color: "#5A8FA6" },
  strategy:  { label: "策略", color: "#7E5EA6" },
  value:     { label: "价值", color: "#A65A72" },
};
const SPEECH_ACT = {
  describe: { label: "描述", color: "#5A8FA6" },
  feel:     { label: "感受", color: "#C27A5A" },
  judge:    { label: "判断", color: "#A68B3C" },
  claim:    { label: "主张", color: "#7E5EA6" },
  reason:   { label: "论据", color: "#5AA67E" },
};
const LAYERS = { abstraction: ABSTRACTION, speech_act: SPEECH_ACT };

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
  const [layerMode, setLayerMode] = useState("abstraction");
  const [xray, setXray] = useState(false);
  const [wheelTarget, setWheelTarget] = useState(null);   // { sentIdx, wordIdx, rect }
  const [picked, setPicked] = useState({});                // { "si-wi": meaningIdx }
  const [expandedJump, setExpandedJump] = useState(null);  // sentIdx or null
  const hideTimer = useRef(null);

  const analyze = useCallback(async () => {
    if (!inputText.trim()) return;
    setLoading(true); setError(null); setAnalysis(null);
    setWheelTarget(null); setPicked({}); setExpandedJump(null);
    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);
      setAnalysis(data);
    } catch (e) {
      console.error(e);
      setError(`分析失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [inputText]);

  const openWheel = (sentIdx, wordIdx, rect) => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    setWheelTarget({ sentIdx, wordIdx, rect });
  };
  const scheduleHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setWheelTarget(null), 180);
  };
  const cancelHide = () => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  };

  const pickMeaning = (sentIdx, wordIdx, mi) => {
    setPicked(prev => ({ ...prev, [`${sentIdx}-${wordIdx}`]: mi }));
    setWheelTarget(null);
  };
  const clearPick = (sentIdx, wordIdx) => {
    setPicked(prev => {
      const clone = { ...prev };
      delete clone[`${sentIdx}-${wordIdx}`];
      return clone;
    });
  };

  const totalAmbig = analysis?.sentences?.reduce((s, sent) => s + (sent.ambiguous?.length || 0), 0) || 0;
  const totalJumps = analysis?.layer_transitions?.length || 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F8F6F2",
      color: "#2C2B28",
      fontFamily: '"Noto Serif SC", "Source Han Serif SC", Georgia, serif',
    }}>
      <header style={{
        maxWidth: 1080, margin: "0 auto", padding: "28px 32px 0",
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: 5, margin: 0 }}>推敲</h1>
        <p style={{ fontSize: 11, color: "#B0A898", margin: "3px 0 0", fontWeight: 300 }}>
          逐句看清楚 · 逐词想清楚
        </p>
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 32px 120px" }}>

        {/* Input */}
        <div style={{ marginBottom: 28 }}>
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="粘贴或输入一段中文..."
            rows={3}
            style={{
              width: "100%", background: "#FFFEFC", border: "1px solid #DDD8CE",
              borderRadius: 6, padding: "14px 16px", fontSize: 15, lineHeight: 1.9,
              color: "#2C2B28", fontFamily: "inherit", resize: "vertical",
              transition: "border-color .2s",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {EXAMPLES.map((ex, i) => (
                <button key={i} className="tq-ex" onClick={() => { setInputText(ex.text); setAnalysis(null); }} style={{
                  background: "#F0EDE6", border: "1px solid #DDD8CE", color: "#8A8478",
                  fontSize: 11, padding: "3px 10px", borderRadius: 3,
                  cursor: "pointer", fontFamily: "inherit",
                }}>{ex.label}</button>
              ))}
            </div>
            <button onClick={analyze} disabled={!inputText.trim() || loading} style={{
              padding: "9px 28px",
              background: inputText.trim() && !loading ? "#2C2B28" : "#D0CCC4",
              color: inputText.trim() && !loading ? "#F8F6F2" : "#A8A298",
              border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600,
              cursor: inputText.trim() && !loading ? "pointer" : "default",
              letterSpacing: 3, fontFamily: "inherit",
            }}>{loading ? "推敲中..." : "推敲"}</button>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0", animation: "fadeIn .3s" }}>
            <div style={{ display: "flex", gap: 5, justifyContent: "center", marginBottom: 10 }}>
              {[0,1,2].map(i => <div key={i} style={{ width:5,height:5,borderRadius:"50%",background:"#C27A5A",animation:`dotPulse 1.2s ${i*.2}s infinite` }}/>)}
            </div>
            <p style={{ fontSize: 12, color: "#A8A298", margin: 0 }}>逐句拆解中...</p>
          </div>
        )}

        {error && (
          <div style={{ padding: "12px 16px", background: "#FDF5F2", border: "1px solid #E8D0C8", borderRadius: 5, color: "#9A5A4A", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {analysis && !loading && (
          <div style={{ animation: "fadeIn .4s" }}>

            {/* Toolbar */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              marginBottom: 14, flexWrap: "wrap",
            }}>
              <span style={{ fontSize: 11, color: "#B0A898" }}>
                发现 <b style={{ color: "#C27A5A" }}>{totalAmbig}</b> 处模糊
                {totalJumps > 0 && <> · <b style={{ color: "#A65A72" }}>{totalJumps}</b> 处跳层</>}
              </span>
              <span style={{ flex: 1 }} />
              <div style={{ display: "flex", gap: 1, background: "#E0DCD4", borderRadius: 4, padding: 1 }}>
                {[{ key: "abstraction", label: "抽象" }, { key: "speech_act", label: "话语" }].map(m => (
                  <button key={m.key} onClick={() => setLayerMode(m.key)} style={{
                    padding: "4px 12px", border: "none", borderRadius: 3, fontSize: 11,
                    background: layerMode === m.key ? "#FFFEFC" : "transparent",
                    color: layerMode === m.key ? "#2C2B28" : "#A8A298",
                    cursor: "pointer", fontFamily: "inherit",
                    fontWeight: layerMode === m.key ? 600 : 400,
                  }}>{m.label}</button>
                ))}
              </div>
              <button className="tq-pill" onClick={() => setXray(!xray)} style={{
                padding: "4px 12px", borderRadius: 4, fontSize: 11,
                border: `1px solid ${xray ? "#A65A7266" : "#DDD8CE"}`,
                background: xray ? "#A65A7212" : "#F0EDE6",
                color: xray ? "#A65A72" : "#8A8478",
                cursor: "pointer", fontFamily: "inherit",
                fontWeight: xray ? 600 : 400,
              }}>X 光模式</button>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
              {Object.entries(LAYERS[layerMode]).map(([k, l]) => (
                <span key={k} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: 10, color: "#8A8478",
                }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: 3,
                    background: l.color + "22", border: `1px solid ${l.color}44`,
                  }} />
                  {l.label}
                </span>
              ))}
            </div>

            {/* Reading area */}
            <article style={{ fontSize: 20, lineHeight: 2.6, color: "#2C2B28" }}>
              {analysis.sentences.map((sent, si) => {
                const layerKey = layerMode === "abstraction" ? sent.abstraction_layer : sent.speech_act_layer;
                const layer = LAYERS[layerMode][layerKey];
                const transition = analysis.layer_transitions?.find(t => t.to_idx === si);
                const logicKind = sent.logic_to_prev && sent.logic_to_prev !== "none" ? sent.logic_to_prev : null;
                const isHeroLogic = logicKind && ["contrast", "cause", "condition"].includes(logicKind);

                return (
                  <span key={si}>
                    {/* Hero logic shape (always visible for 3 key relations) */}
                    {si > 0 && isHeroLogic && <LogicShape kind={logicKind} />}

                    {/* Jump marker (X-ray only) */}
                    {xray && transition && (
                      <JumpMarker
                        transition={transition}
                        expanded={expandedJump === si}
                        onToggle={() => setExpandedJump(expandedJump === si ? null : si)}
                      />
                    )}
                    {/* Minor logic label (X-ray only, non-hero relations) */}
                    {xray && si > 0 && logicKind && !isHeroLogic && (
                      <span style={{
                        display: "inline-block",
                        verticalAlign: "middle",
                        margin: "0 6px",
                        padding: "1px 8px",
                        fontSize: 10,
                        color: "#B0A898",
                        background: "#F0EDE6",
                        borderRadius: 2,
                      }}>{LOGIC_LABELS[logicKind]}</span>
                    )}

                    <SentenceBlock
                      sent={sent}
                      sentIdx={si}
                      layerColor={layer?.color || "#C8C0B4"}
                      picked={picked}
                      onWordEnter={openWheel}
                      onWordLeave={scheduleHide}
                      onClearPick={clearPick}
                    />
                  </span>
                );
              })}
            </article>
          </div>
        )}

        {!analysis && !loading && !inputText && (
          <div style={{ textAlign: "center", padding: "64px 0", animation: "fadeIn .6s" }}>
            <div style={{ fontSize: 48, color: "#D8D4CC", marginBottom: 14, letterSpacing: 6, fontWeight: 300 }}>推敲</div>
            <p style={{ fontSize: 13, color: "#B8B0A4", lineHeight: 2.2, maxWidth: 320, margin: "0 auto", fontWeight: 300 }}>
              粘贴一段文字<br />
              语义模糊处会放大并虚化<br />
              悬停看清，点击候选确定含义
            </p>
          </div>
        )}
      </main>

      {wheelTarget && analysis && (
        <WordWheel
          target={wheelTarget}
          sentence={analysis.sentences[wheelTarget.sentIdx]}
          onEnter={cancelHide}
          onLeave={scheduleHide}
          onPick={(mi) => pickMeaning(wheelTarget.sentIdx, wheelTarget.wordIdx, mi)}
        />
      )}
    </div>
  );
}

/* ── Sentence block with background tint ── */
function SentenceBlock({ sent, sentIdx, layerColor, picked, onWordEnter, onWordLeave, onClearPick }) {
  const text = sent.text;
  const words = sent.ambiguous || [];

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

  // find any picked word to collect followup questions
  const pickedEntries = highlights
    .map(h => ({ h, mi: picked[`${sentIdx}-${h.wordIdx}`] }))
    .filter(p => p.mi != null);

  const parts = [];
  let last = 0;
  for (const h of highlights) {
    if (h.start > last) parts.push(<span key={`t${last}`}>{text.slice(last, h.start)}</span>);
    const pickedKey = `${sentIdx}-${h.wordIdx}`;
    const mi = picked[pickedKey];
    const w = words[h.wordIdx];
    parts.push(
      <AmbiguousWord
        key={`w${h.start}`}
        original={text.slice(h.start, h.end)}
        displayRewrite={mi != null ? w.possible_meanings?.[mi]?.rewrite : null}
        severity={h.severity}
        onEnter={(rect) => onWordEnter(sentIdx, h.wordIdx, rect)}
        onLeave={onWordLeave}
        onClearPick={mi != null ? () => onClearPick(sentIdx, h.wordIdx) : null}
      />
    );
    last = h.end;
  }
  if (last < text.length) parts.push(<span key="tend">{text.slice(last)}</span>);

  return (
    <>
      <span style={{
        background: layerColor + "12",    // ~7% opacity tint
        padding: "3px 8px",
        margin: "0 1px",
        borderRadius: 4,
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
        transition: "background .2s",
      }}>
        {parts}
        {!/[。？！，,.?!;；]$/.test(text) && <span>。</span>}
      </span>

      {pickedEntries.map(({ h }) => {
        const w = words[h.wordIdx];
        if (!w?.followup_question) return null;
        return (
          <div key={`fq-${h.wordIdx}`} style={{
            fontSize: 13,
            color: "#8A7860",
            fontStyle: "italic",
            marginTop: 4,
            marginBottom: 6,
            paddingLeft: 14,
            borderLeft: "2px solid #C27A5A40",
            animation: "fadeIn .25s",
            lineHeight: 1.8,
          }}>
            <span style={{ color: "#C27A5A", fontWeight: 600, fontStyle: "normal", marginRight: 8, fontSize: 11 }}>追问</span>
            {w.followup_question}
          </div>
        );
      })}
    </>
  );
}

/* ── Ambiguous word span — bigger + blurred, clarifies on hover ── */
function AmbiguousWord({ original, displayRewrite, severity, onEnter, onLeave, onClearPick }) {
  const [hovering, setHovering] = useState(false);
  const picked = displayRewrite != null;

  // severity → visual intensity
  const sev = Math.max(1, Math.min(3, severity || 2));
  const scale = sev === 3 ? 1.32 : sev === 2 ? 1.18 : 1.08;
  const blur  = sev === 3 ? 1.3  : sev === 2 ? 0.75 : 0.4;

  const foggy = !picked && !hovering;

  return (
    <span
      className="tq-word"
      onMouseEnter={e => {
        setHovering(true);
        const rect = e.currentTarget.getBoundingClientRect();
        onEnter(rect);
      }}
      onMouseLeave={() => {
        setHovering(false);
        onLeave();
      }}
      onClick={e => {
        if (picked && onClearPick) {
          e.stopPropagation();
          onClearPick();
        }
      }}
      style={{
        display: "inline-block",
        verticalAlign: "baseline",
        cursor: picked ? "pointer" : "help",
        fontSize: picked ? "1em" : `${scale}em`,
        fontWeight: picked ? 500 : 600,
        letterSpacing: picked ? 0 : "0.02em",
        color: picked ? "#6A5A48" : "#2C2B28",
        background: picked ? "#F0EAE0" : "transparent",
        padding: picked ? "0 5px" : "0 2px",
        margin: "0 1px",
        borderRadius: picked ? 3 : 2,
        filter: foggy ? `blur(${blur}px)` : "none",
        transition: "filter .22s, font-size .2s, background .15s",
        position: "relative",
      }}
      title={picked ? "点击还原" : undefined}
    >
      {picked ? (
        <>
          <span style={{ color: "#C8C0B4", textDecoration: "line-through", marginRight: 6, fontSize: "0.88em", fontWeight: 400 }}>{original}</span>
          {displayRewrite}
        </>
      ) : original}
    </span>
  );
}

/* ── Logic shape — 3 hero relations get a distinctive glyph ── */
function LogicShape({ kind }) {
  if (kind === "contrast") {
    // U-shape bubble folding back — echoes the WeChat-bubble idea
    const color = "#A65A72";
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        verticalAlign: "middle", margin: "0 10px",
        color, fontSize: 12, fontWeight: 500, letterSpacing: "0.04em",
      }}>
        <svg width="40" height="22" viewBox="0 0 40 22" fill="none" aria-hidden="true">
          <path d="M 5 20 C 5 4, 35 4, 35 20" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M 30 15 L 35 20 L 40 15" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="5" cy="20" r="1.6" fill={color} />
        </svg>
        <span>但</span>
      </span>
    );
  }
  if (kind === "cause") {
    // Downward thick arrow — "所以 / 因此"
    const color = "#5A8FA6";
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        verticalAlign: "middle", margin: "0 10px",
        color, fontSize: 12, fontWeight: 500, letterSpacing: "0.04em",
      }}>
        <svg width="16" height="22" viewBox="0 0 16 22" fill="none" aria-hidden="true">
          <line x1="8" y1="3" x2="8" y2="15" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M 3 13 L 8 19 L 13 13" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <span>所以</span>
      </span>
    );
  }
  if (kind === "condition") {
    // Y-fork — "若 … 则"
    const color = "#7E5EA6";
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        verticalAlign: "middle", margin: "0 10px",
        color, fontSize: 12, fontWeight: 500, letterSpacing: "0.04em",
      }}>
        <span style={{ opacity: 0.85 }}>若</span>
        <svg width="22" height="18" viewBox="0 0 22 18" fill="none" aria-hidden="true">
          <line x1="11" y1="2" x2="11" y2="8"  stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          <line x1="11" y1="8" x2="4"  y2="16" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          <line x1="11" y1="8" x2="18" y2="16" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span>则</span>
      </span>
    );
  }
  return null;
}

/* ── Jump marker (X-ray mode) ── */
function JumpMarker({ transition, expanded, onToggle }) {
  return (
    <span style={{ display: "inline-block", verticalAlign: "middle", margin: "0 4px" }}>
      <button onClick={onToggle} style={{
        border: "1px dashed #A65A7255",
        background: expanded ? "#A65A7212" : "#FFFEFC",
        color: "#A65A72",
        fontSize: 11,
        padding: "1px 7px",
        borderRadius: 3,
        cursor: "pointer",
        fontFamily: "inherit",
      }}>
        ⚡{expanded ? "" : " 跳层"}
      </button>
      {expanded && (
        <span style={{
          marginLeft: 6,
          fontSize: 12,
          color: "#A65A72",
          fontStyle: "italic",
          animation: "fadeIn .2s",
        }}>
          {transition.description}
        </span>
      )}
    </span>
  );
}

/* ── Wheel picker ── */
function WordWheel({ target, sentence, onEnter, onLeave, onPick }) {
  const word = sentence?.ambiguous?.[target.wordIdx];
  const [hoverIdx, setHoverIdx] = useState(null);
  if (!word) return null;

  const candidates = (word.possible_meanings || []).slice(0, 6);
  const n = candidates.length;
  if (n === 0) return null;

  const { rect } = target;
  const radius = 72;
  // arrange in arc above word: -140° to -40° (degrees, CSS y-down)
  const startDeg = n === 1 ? -90 : -140;
  const endDeg   = n === 1 ? -90 : -40;
  const step = n > 1 ? (endDeg - startDeg) / (n - 1) : 0;

  const cx = rect.left + rect.width / 2;
  const cy = rect.top;

  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        position: "fixed",
        left: cx,
        top: cy,
        width: 1, height: 1,
        zIndex: 200,
        pointerEvents: "none",
      }}
    >
      {/* Invisible bridge so hovering from word → arc doesn't drop */}
      <div style={{
        position: "absolute",
        left: -110, top: -radius - 30,
        width: 220, height: radius + 30,
        pointerEvents: "auto",
      }} />

      {candidates.map((c, i) => {
        const deg = startDeg + i * step;
        const rad = deg * Math.PI / 180;
        const x = Math.cos(rad) * radius;
        const y = Math.sin(rad) * radius;
        const hovered = hoverIdx === i;
        return (
          <button
            key={i}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            onClick={() => onPick(i)}
            style={{
              position: "absolute",
              left: x, top: y,
              transform: "translate(-50%, -50%)",
              padding: "5px 12px",
              minWidth: 52,
              background: hovered ? "#2C2B28" : "#FFFEFC",
              color: hovered ? "#F8F6F2" : "#4A4A45",
              border: `1px solid ${hovered ? "#2C2B28" : "#E0D8CC"}`,
              borderRadius: 16,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: hovered ? "0 4px 14px rgba(0,0,0,0.18)" : "0 2px 8px rgba(0,0,0,0.08)",
              fontFamily: "inherit",
              transition: "all .12s",
              pointerEvents: "auto",
              animation: `wheelIn .18s ${i * 0.03}s both`,
            }}
          >
            {c.rewrite}
          </button>
        );
      })}

      {/* Hovered interpretation */}
      {hoverIdx != null && candidates[hoverIdx]?.interpretation && (
        <div style={{
          position: "absolute",
          left: 0, top: -radius - 46,
          transform: "translateX(-50%)",
          maxWidth: 280,
          padding: "6px 12px",
          background: "#3A3835",
          color: "#F0EDE6",
          fontSize: 12,
          lineHeight: 1.6,
          borderRadius: 5,
          textAlign: "center",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          boxShadow: "0 3px 12px rgba(0,0,0,0.18)",
        }}>
          {candidates[hoverIdx].interpretation}
        </div>
      )}
    </div>
  );
}
