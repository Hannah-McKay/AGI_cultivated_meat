import { useState, useCallback, useMemo } from "react";

// ============================================================
// CULTIVATED MEAT × AI: WHAT DOES AI ACTUALLY CHANGE?
// v6 — Two-phase input (baseline + AI), meta-slider architecture,
// sensitivity-weighted mapping, presets, full assumption docs.
// ============================================================

const C = {
  bg: "#FAFAF7", card: "#FFFFFF", border: "#E8E6E1", text: "#2C2C2C",
  muted: "#6B6966", light: "#9B9894", accent: "#3D6B5E", accentBg: "#EBF2EF",
  accentMid: "#A8CCBF", track: "#DDD9D3",
  baseline: "#B4B2A9", ai: "#1D9E75", aiLight: "#5DCAA5",
  warn: "#BA7517", warnBg: "#FAEEDA", warnLight: "#C4956A",
  stage2: "#5B8FA8", dropBg: "#F5F4F0",
  presetBg: "#F0EFEB", presetAct: "#3D6B5E", presetActTx: "#FFF",
};

const FONT_H = "'Source Serif 4', Georgia, serif";
const FONT_B = "'IBM Plex Sans', sans-serif";

// ============================================================
// BOTTLENECK DEFINITIONS
// Each bottleneck has a default baseline and sensitivity weights
// to each meta-slider. Sensitivities are 0-1 and determine how
// much a meta-slider value translates into AI contribution.
// ============================================================
const BOTTLENECKS = [
  { id: "cell_line", label: "Cell line development", stage: 1,
    defaultBaseline: 40, maxAI: 50,
    sensitivities: { science: 0.40, institutions: 0, consumer_beh: 0, industrial: 0.05 },
    baselineNote: "Multiple companies have proprietary lines for chicken, beef, pork. But food-grade, serum-free, suspension-adapted lines remain difficult and species-specific. Steady conventional progress.",
    aiNote: "ML-guided clone screening and immortalisation prediction can compress timelines from years to months. High sensitivity to scientific R&D capability.",
    sources: "GFI State of the Industry 2024; Nature Food TEA scoping review (2024)" },
  { id: "growth_factors", label: "Growth factor cost", stage: 1,
    defaultBaseline: 35, maxAI: 55,
    sensitivities: { science: 0.50, institutions: 0, consumer_beh: 0, industrial: 0.10 },
    baselineNote: "Costs have fallen from pharma-grade but remain far above food-grade targets ($50\u2013100/kg contribution). Startups working on cheaper alternatives. Recent TEAs more conservative than GFI 2021.",
    aiNote: "De novo protein design (RFdiffusion, ProteinMPNN) directly applicable. This is one of the most AI-tractable bottlenecks: the problem is well-defined and the design space is tractable for current ML.",
    sources: "CE Delft TEA (2021); Humbird TEA (2020); Nature Food scoping review (2024)" },
  { id: "bioprocess", label: "Bioprocess efficiency", stage: 1,
    defaultBaseline: 30, maxAI: 40,
    sensitivities: { science: 0.35, institutions: 0, consumer_beh: 0, industrial: 0.20 },
    baselineNote: "Scaling from bench to commercial remains fundamental. Biopharma provides transferable knowledge but cultivated meat needs larger volumes at much lower price points.",
    aiNote: "ML process control has shown 10\u201340% yield improvements in biopharma. Also benefits from industrial scaling (AI-driven automation, advanced bioreactor design).",
    sources: "Nature Food scoping review (2024); Unjournal cost model" },
  { id: "scaffolding", label: "Product structure (scaffolding)", stage: 1,
    defaultBaseline: 20, maxAI: 35,
    sensitivities: { science: 0.25, institutions: 0, consumer_beh: 0, industrial: 0.10 },
    baselineNote: "Most products are unstructured (mince, nuggets). Structured whole-cuts require edible scaffolding mimicking tissue architecture\u2014largely unsolved at commercial scale.",
    aiNote: "AI can assist with computational materials science and generative design, but the manufacturing challenge is primarily physical engineering, limiting AI\u2019s ceiling.",
    sources: "GFI State of the Industry 2024" },
  { id: "rd_efficiency", label: "R&D pipeline speed", stage: 1,
    defaultBaseline: 35, maxAI: 35,
    sensitivities: { science: 0.30, institutions: 0, consumer_beh: 0, industrial: 0.05 },
    baselineNote: "250+ researchers, 20+ UK universities with active groups, increasing public funding (Netherlands \u20ac65M, UK \u00a342M across hubs). But field less standardised than pharma.",
    aiNote: "General-purpose AI R&D acceleration: automated experiment design, literature synthesis, lab automation. Applies broadly across biotech, not cultivated-meat-specific.",
    sources: "Unjournal evaluation (Seinkmane 2025); GFI 2024; UKRI funding data" },
  { id: "regulatory", label: "Regulatory approval", stage: 2,
    defaultBaseline: 35, maxAI: 25,
    sensitivities: { science: 0.05, institutions: 0.30, consumer_beh: 0.05, industrial: 0 },
    baselineNote: "Five US products approved. UK FSA targeting evaluations by Feb 2027. But EU has no imminent approvals; Hungary, Romania, Italy, several US states have bans. Progress is real but uneven and politically driven.",
    aiNote: "AI could modestly accelerate dossier preparation and toxicology analysis. Institutional reshaping (AI transforming governance) is the main channel for larger impact. Scientific progress helps marginally via better safety data.",
    sources: "UK FSA thematic report (March 2026); FoodNavigator-USA (Feb 2026); Osborne Clarke (March 2026)" },
  { id: "consumer", label: "Consumer acceptance", stage: 2,
    defaultBaseline: 20, maxAI: 25,
    sensitivities: { science: 0.05, institutions: 0, consumer_beh: 0.35, industrial: 0 },
    baselineNote: "16\u201341% UK willingness to try. 85% report concerns (safety, unnaturalness, farmer impacts). Even price-competitive plant-based alternatives capture only 11\u201325% of real-world selections (Peacock 2026).",
    aiNote: "Consumer behaviour slider is the main channel. Science contributes marginally through product quality improvements. Core barriers (food neophobia, cultural identity) are not information problems.",
    sources: "UK FSA 2025 evidence review; Peacock (2026); Singapore purchase study" },
  { id: "capital", label: "Investment and funding", stage: 2,
    defaultBaseline: 30, maxAI: 30,
    sensitivities: { science: 0.15, institutions: 0.15, consumer_beh: 0.05, industrial: 0.15 },
    baselineNote: "Total funding >$3B but declining from 2021\u201322 peak. Public funding increasing. Climate depends on regulatory clarity and technical milestones. Believer Meats shut down Dec 2025.",
    aiNote: "Capital responds to all four AI channels: scientific progress makes the thesis credible, institutional progress de-risks regulation, consumer traction validates the market, and industrial scaling reduces capex.",
    sources: "GFI 2024; Unjournal evaluation (Seinkmane 2025)" },
  { id: "ecosystem", label: "Supply chain and infrastructure", stage: 2,
    defaultBaseline: 20, maxAI: 25,
    sensitivities: { science: 0.05, institutions: 0.10, consumer_beh: 0, industrial: 0.35 },
    baselineNote: "Commercial facilities face construction and commissioning challenges (Believer Meats delays). Supply chain for food-grade inputs is nascent. MicroHarvest secured 15,000t/yr site in Germany.",
    aiNote: "Industrial scaling is the main channel: AI-driven facility design, robotics, logistics. Institutional progress helps via regulatory clarity triggering investment. But the binding constraint is physical construction.",
    sources: "Believer Meats reporting; MicroHarvest (Feb 2026); GFI 2024" },
];

// ============================================================
// BASELINE META-SLIDERS
// ============================================================
const BASELINE_QUESTIONS = [
  { id: "bl_science", label: "How much progress do you expect on cultivated meat science and engineering over the next 10\u201315 years, through conventional biotech alone?",
    default: 50, maps: ["cell_line", "growth_factors", "bioprocess", "scaffolding", "rd_efficiency"],
    note: "Our default (50) reflects steady but slow progress: costs declining, cell lines improving, but fundamental scaling challenges remaining. Based on TEAs, GFI data, and Unjournal evaluations." },
  { id: "bl_regulatory", label: "How much regulatory progress do you expect, given current political trajectories?",
    default: 45, maps: ["regulatory"],
    note: "Our default (45) reflects real but uneven progress: US approvals exist, UK on track for 2027, but EU stalled and several jurisdictions actively banning. Net trajectory is positive but contested." },
  { id: "bl_consumer", label: "How much do you expect consumer attitudes toward cultivated meat to shift?",
    default: 30, maps: ["consumer"],
    note: "Our default (30) is deliberately low, reflecting Peacock (2026) finding that even competitive products capture only 11\u201325% of selections, and structural cultural barriers to food technology adoption." },
  { id: "bl_capital", label: "How much capital and infrastructure build-out do you expect, given current investment trends?",
    default: 40, maps: ["capital", "ecosystem"],
    note: "Our default (40) reflects that $3B+ has been invested but annual flows are declining. Public funding is increasing. Infrastructure build-out is constrained by capex and construction timelines." },
];

// How baseline meta-sliders map to individual bottleneck baselines
// Each bottleneck gets: defaultBaseline * (reader's baseline slider / default baseline slider)
// This scales proportionally while preserving relative differences between bottlenecks
function computeBaselines(blValues, useDefaults) {
  const result = {};
  BOTTLENECKS.forEach(b => {
    if (useDefaults[b.id]) {
      result[b.id] = b.defaultBaseline;
    } else {
      // Find which baseline question maps to this bottleneck
      const q = BASELINE_QUESTIONS.find(bq => bq.maps.includes(b.id));
      if (q) {
        const ratio = blValues[q.id] / q.default;
        result[b.id] = Math.max(0, Math.min(80, Math.round(b.defaultBaseline * ratio)));
      } else {
        result[b.id] = b.defaultBaseline;
      }
    }
  });
  return result;
}

// ============================================================
// AI META-SLIDERS
// ============================================================
const AI_QUESTIONS = [
  { id: "science", label: "How transformative will AI be for scientific R&D?",
    anchors: ["0 = marginal productivity tool", "100 = fully autonomous AI scientists"],
    default: 55,
    note: "Benchling 2026 survey: 76% adoption for literature review, 71% for protein structure prediction among biotech firms already using AI. But adoption \u2260 productivity gain, and cultivated meat R&D is less standardised than pharma." },
  { id: "institutions", label: "How much will AI reshape political and regulatory institutions?",
    anchors: ["0 = no meaningful effect on governance", "100 = AI fundamentally transforms how institutions operate"],
    default: 15,
    note: "We default low (15) because regulatory timelines for cultivated meat are driven by political will and legislative action, not processing speed. AI could modestly help regulators but cannot remove legislative bans." },
  { id: "consumer_beh", label: "How much will AI change consumer behaviour and food culture?",
    anchors: ["0 = negligible effect on food choices", "100 = AI-driven persuasion fundamentally shifts dietary preferences"],
    default: 12,
    note: "We default low (12) because core barriers to cultivated meat adoption\u2014food neophobia, cultural identity, trust\u2014are not primarily information or persuasion problems. AI marketing tools exist but their effect on deep-seated food preferences is speculative." },
  { id: "industrial", label: "How much will AI accelerate industrial scaling and manufacturing?",
    anchors: ["0 = no effect on physical infrastructure", "100 = AI-driven robotics and automation transform construction and manufacturing timelines"],
    default: 30,
    note: "We default moderate (30). AI-driven facility design, logistics optimisation, and process automation are real capabilities, but the binding constraint for cultivated meat infrastructure is capital expenditure and physical construction, which AI compresses modestly." },
];

// Compute AI contribution per bottleneck from meta-sliders
function computeAIContributions(aiValues) {
  const result = {};
  BOTTLENECKS.forEach(b => {
    let contribution = 0;
    for (const [metaId, sensitivity] of Object.entries(b.sensitivities)) {
      contribution += (aiValues[metaId] / 100) * sensitivity * b.maxAI;
    }
    result[b.id] = Math.round(Math.min(b.maxAI, contribution));
  });
  return result;
}

// ============================================================
// PRESETS — populate both baseline and AI values
// ============================================================
const PRESETS = [
  { id: "defaults", label: "Evidence-based defaults", short: "Our starting estimates for both baseline and AI",
    baseline: Object.fromEntries(BASELINE_QUESTIONS.map(q => [q.id, q.default])),
    ai: Object.fromEntries(AI_QUESTIONS.map(q => [q.id, q.default])) },
  { id: "ai_scientist", label: "AI as scientist, not policymaker", short: "AI transforms R&D but doesn\u2019t reshape institutions or culture",
    baseline: { bl_science: 50, bl_regulatory: 45, bl_consumer: 30, bl_capital: 40 },
    ai: { science: 80, institutions: 10, consumer_beh: 8, industrial: 35 } },
  { id: "intelligence_explosion", label: "Intelligence explosion", short: "Transformative AI across all domains by late 2020s",
    baseline: { bl_science: 50, bl_regulatory: 45, bl_consumer: 30, bl_capital: 40 },
    ai: { science: 95, institutions: 70, consumer_beh: 60, industrial: 80 } },
  { id: "hostile_world", label: "Research assistant in a hostile world", short: "Moderate AI help; regulatory backlash and consumer scepticism intensify",
    baseline: { bl_science: 40, bl_regulatory: 25, bl_consumer: 15, bl_capital: 25 },
    ai: { science: 40, institutions: 5, consumer_beh: 5, industrial: 20 } },
  { id: "business_as_usual", label: "Business as usual", short: "Default baselines; AI contributes minimally",
    baseline: { bl_science: 50, bl_regulatory: 45, bl_consumer: 30, bl_capital: 40 },
    ai: { science: 20, institutions: 5, consumer_beh: 5, industrial: 10 } },
  { id: "tech_good_politics", label: "Technical progress, favourable politics", short: "Strong AI for science; regulatory environment improves",
    baseline: { bl_science: 55, bl_regulatory: 60, bl_consumer: 35, bl_capital: 55 },
    ai: { science: 75, institutions: 25, consumer_beh: 15, industrial: 45 } },
];

// ============================================================
// COMPONENTS
// ============================================================

function MetaSlider({ q, value, onChange, showAnchors = true }) {
  const [showNote, setShowNote] = useState(false);
  const color = value >= 60 ? C.ai : value >= 30 ? C.stage2 : C.warnLight;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.4, marginBottom: 6, fontFamily: FONT_H, fontWeight: 600 }}>
        {q.label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="range" min={0} max={100} value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          style={{
            flex: 1, height: 5, WebkitAppearance: "none", appearance: "none", borderRadius: 3,
            background: `linear-gradient(to right, ${color} 0%, ${color} ${value}%, ${C.track} ${value}%, ${C.track} 100%)`,
            outline: "none", cursor: "pointer",
          }} />
        <span style={{ fontSize: 18, fontWeight: 700, color, fontFamily: FONT_H, minWidth: 40, textAlign: "right" }}>
          {value}
        </span>
      </div>
      {showAnchors && q.anchors && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
          {q.anchors.map((a, i) => (
            <span key={i} style={{ fontSize: 10, color: C.light, maxWidth: "48%" }}>{a}</span>
          ))}
        </div>
      )}
      <button onClick={() => setShowNote(!showNote)}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: C.accent, textDecoration: "underline", marginTop: 4 }}>
        {showNote ? "Hide reasoning \u25B4" : "Our reasoning \u25BE"}
      </button>
      {showNote && (
        <div style={{ marginTop: 4, padding: "6px 10px", background: C.dropBg, borderRadius: 4, fontSize: 12, color: C.muted, lineHeight: 1.5, borderLeft: `3px solid ${C.accentMid}` }}>
          {q.note}
        </div>
      )}
    </div>
  );
}

function BaselineSlider({ q, value, onChange, useDefault, onToggleDefault }) {
  const [showNote, setShowNote] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.4, marginBottom: 6, fontFamily: FONT_H, fontWeight: 600 }}>
        {q.label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 11, color: C.muted }}>
          <input type="checkbox" checked={useDefault} onChange={onToggleDefault}
            style={{ accentColor: C.baseline, width: 13, height: 13 }} />
          Use our default ({q.default})
        </label>
      </div>
      {!useDefault && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="range" min={0} max={100} value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            style={{
              flex: 1, height: 5, WebkitAppearance: "none", appearance: "none", borderRadius: 3,
              background: `linear-gradient(to right, ${C.baseline} 0%, ${C.baseline} ${value}%, ${C.track} ${value}%, ${C.track} 100%)`,
              outline: "none", cursor: "pointer",
            }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: C.muted, fontFamily: FONT_H, minWidth: 36, textAlign: "right" }}>
            {value}
          </span>
        </div>
      )}
      <button onClick={() => setShowNote(!showNote)}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: C.accent, textDecoration: "underline", marginTop: 4 }}>
        {showNote ? "Hide reasoning \u25B4" : "Our reasoning \u25BE"}
      </button>
      {showNote && (
        <div style={{ marginTop: 4, padding: "6px 10px", background: C.dropBg, borderRadius: 4, fontSize: 12, color: C.muted, lineHeight: 1.5, borderLeft: `3px solid ${C.accentMid}` }}>
          {q.note}
        </div>
      )}
    </div>
  );
}

function OutputPanel({ baselines, aiContribs }) {
  const items = BOTTLENECKS.map(b => ({
    ...b, bl: baselines[b.id], ai: aiContribs[b.id],
    total: Math.min(100, baselines[b.id] + aiContribs[b.id]),
  }));
  const s1 = items.filter(i => i.stage === 1);
  const s2 = items.filter(i => i.stage === 2);
  const avgAI1 = Math.round(s1.reduce((s, i) => s + i.ai, 0) / s1.length);
  const avgAI2 = Math.round(s2.reduce((s, i) => s + i.ai, 0) / s2.length);
  const binding = [...items].sort((a, b) => a.total - b.total)[0];
  const bigAI = [...items].sort((a, b) => b.ai - a.ai)[0];
  const smallAI = [...items].sort((a, b) => a.ai - b.ai)[0];

  const renderBars = (list, label) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{label}</div>
      {list.map(item => (
        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: C.muted, minWidth: 115, textAlign: "right", lineHeight: 1.2 }}>{item.label}</span>
          <div style={{ flex: 1, height: 16, background: C.track, borderRadius: 3, overflow: "hidden", display: "flex" }}>
            <div style={{ width: `${item.bl}%`, height: "100%", background: C.baseline, transition: "width 0.2s" }} />
            <div style={{ width: `${item.ai}%`, height: "100%", background: C.ai, transition: "width 0.2s" }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, minWidth: 30, color: item.id === binding.id ? C.warn : C.text }}>{item.total}%</span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "18px 20px", marginBottom: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: FONT_H, marginBottom: 12 }}>
        What your assumptions imply
      </div>

      {renderBars(s1, "Technical and economic bottlenecks")}
      {renderBars(s2, "Non-technical bottlenecks")}

      <div style={{ display: "flex", gap: 10, marginTop: 4, marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: C.muted, display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: C.baseline }} /> Baseline
        </span>
        <span style={{ fontSize: 10, color: C.accent, display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: C.ai }} /> AI contribution
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "14px 0" }}>
        <div style={{ padding: "10px 12px", background: C.accentBg, borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: C.accent, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>AI helps most with</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, fontFamily: FONT_H }}>{bigAI.label}</div>
          <div style={{ fontSize: 11, color: C.accent }}>+{bigAI.ai}pp AI contribution</div>
        </div>
        <div style={{ padding: "10px 12px", background: C.warnBg, borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: C.warn, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Weakest link</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.warn, fontFamily: FONT_H }}>{binding.label}</div>
          <div style={{ fontSize: 11, color: C.warn }}>{binding.total}% total (AI adds +{binding.ai}pp)</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, padding: "8px 12px", background: C.dropBg, borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: C.muted }}>Avg AI contribution, technical</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.accent, fontFamily: FONT_H }}>+{avgAI1}pp</div>
        </div>
        <div style={{ flex: 1, padding: "8px 12px", background: C.dropBg, borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: C.muted }}>Avg AI contribution, non-technical</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.stage2, fontFamily: FONT_H }}>+{avgAI2}pp</div>
        </div>
      </div>

      <div style={{ fontSize: 12, lineHeight: 1.55, color: C.muted, padding: "10px 14px", background: C.dropBg, borderRadius: 6, borderLeft: `3px solid ${C.warnLight}` }}>
        Under your assumptions, AI\u2019s largest contribution is to <strong style={{ color: C.text }}>{bigAI.label.toLowerCase()}</strong> (+{bigAI.ai}pp).
        AI\u2019s smallest contribution is to <strong style={{ color: C.text }}>{smallAI.label.toLowerCase()}</strong> (+{smallAI.ai}pp).
        {avgAI1 > avgAI2 * 1.5 && (
          <span> AI adds roughly {Math.round(avgAI1 / Math.max(1, avgAI2))}\u00d7 as much to technical bottlenecks as to non-technical ones. </span>
        )}
        The bottleneck with the least total progress is <strong style={{ color: C.text }}>{binding.label.toLowerCase()}</strong> at {binding.total}%
        {binding.ai <= 5 ? "\u2014and AI barely moves it" : ""}.
        {binding.stage === 2 && " Under your assumptions, the binding constraint on cultivated meat\u2019s trajectory is not technical, and additional AI capability would have diminishing returns for the overall outcome."}
        {binding.stage === 1 && " Under your assumptions, the binding constraint is still technical, and AI progress could meaningfully shift the overall trajectory."}
      </div>
    </div>
  );
}

function ScenarioComparison({ presets }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "18px 20px", marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: FONT_H, marginBottom: 4 }}>Scenario comparison</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>How the picture changes across different AI worldviews.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        {presets.map(p => {
          const useDefaults = Object.fromEntries(BOTTLENECKS.map(b => [b.id, true]));
          const bls = {};
          BOTTLENECKS.forEach(b => {
            const q = BASELINE_QUESTIONS.find(bq => bq.maps.includes(b.id));
            if (q) {
              bls[b.id] = Math.max(0, Math.min(80, Math.round(b.defaultBaseline * (p.baseline[q.id] / q.default))));
            } else { bls[b.id] = b.defaultBaseline; }
          });
          const ais = computeAIContributions(p.ai);
          const items = BOTTLENECKS.map(b => ({ label: b.label, total: Math.min(100, bls[b.id] + ais[b.id]), ai: ais[b.id] }));
          const binding = [...items].sort((a, b) => a.total - b.total)[0];
          const avgAI = Math.round(items.reduce((s, i) => s + i.ai, 0) / items.length);
          return (
            <div key={p.id} style={{ padding: "10px 12px", background: C.dropBg, borderRadius: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 3, lineHeight: 1.3 }}>{p.label}</div>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 6, lineHeight: 1.3 }}>{p.short}</div>
              <div style={{ fontSize: 11, color: C.muted }}>Avg AI: <strong>+{avgAI}pp</strong></div>
              <div style={{ fontSize: 11, color: C.warn, marginTop: 2 }}>Weakest: {binding.label} ({binding.total}%)</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Collapsible({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
      <button onClick={() => setOpen(!open)}
        style={{ width: "100%", padding: "12px 16px", background: C.card, border: "none", cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: FONT_H }}>{title}</span>
        <span style={{ fontSize: 13, color: C.muted }}>{open ? "\u25B4" : "\u25BE"}</span>
      </button>
      {open && <div style={{ padding: "0 16px 16px" }}>{children}</div>}
    </div>
  );
}

// ============================================================
// MAIN
// ============================================================
export default function App() {
  const [blValues, setBlValues] = useState(Object.fromEntries(BASELINE_QUESTIONS.map(q => [q.id, q.default])));
  const [blDefaults, setBlDefaults] = useState(Object.fromEntries(BASELINE_QUESTIONS.map(q => [q.id, true])));
  const [aiValues, setAiValues] = useState(Object.fromEntries(AI_QUESTIONS.map(q => [q.id, q.default])));
  const [activePreset, setActivePreset] = useState("defaults");

  const handlePreset = useCallback((p) => {
    setBlValues({ ...p.baseline });
    setAiValues({ ...p.ai });
    setBlDefaults(Object.fromEntries(BASELINE_QUESTIONS.map(q => [q.id, true])));
    setActivePreset(p.id);
  }, []);

  const baselines = useMemo(() => computeBaselines(blValues, Object.fromEntries(BOTTLENECKS.map(b => [b.id, blDefaults[BASELINE_QUESTIONS.find(q => q.maps.includes(b.id))?.id] ?? true]))), [blValues, blDefaults]);
  const aiContribs = useMemo(() => computeAIContributions(aiValues), [aiValues]);

  return (
    <div style={{ fontFamily: FONT_B, background: C.bg, minHeight: "100vh", padding: "20px 16px", maxWidth: 800, margin: "0 auto" }}>
      <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: C.accent, fontWeight: 700, marginBottom: 4 }}>Interactive scenario model</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: 0, lineHeight: 1.2, fontFamily: FONT_H }}>
          What does AI actually change for cultivated meat?
        </h1>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.55, maxWidth: 660 }}>
          First, set your expectations for the world without AI. Then set your beliefs about AI\u2019s capabilities. The model translates your high-level AI beliefs into bottleneck-specific impacts and shows where AI shifts the trajectory\u2014and where it doesn\u2019t.
        </p>
      </div>

      {/* Presets */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Preset scenarios</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => handlePreset(p)}
              style={{
                background: activePreset === p.id ? C.presetAct : C.presetBg,
                color: activePreset === p.id ? C.presetActTx : C.text,
                border: `1px solid ${activePreset === p.id ? C.presetAct : C.border}`,
                borderRadius: 5, padding: "6px 10px", cursor: "pointer", textAlign: "left",
              }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{p.label}</div>
              <div style={{ fontSize: 10, opacity: activePreset === p.id ? 0.85 : 0.55 }}>{p.short}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Output panel — positioned prominently */}
      <OutputPanel baselines={baselines} aiContribs={aiContribs} />
      <ScenarioComparison presets={PRESETS} />

      {/* Phase 1: Baseline */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 18px", marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: FONT_H, marginBottom: 2 }}>
          The world without AI
        </div>
        <p style={{ fontSize: 12, color: C.muted, margin: "0 0 14px 0", lineHeight: 1.5 }}>
          How much progress do you expect on cultivated meat over the next 10\u201315 years, through conventional means alone? Our defaults are based on published evidence. Uncheck to set your own.
        </p>
        {BASELINE_QUESTIONS.map(q => (
          <BaselineSlider key={q.id} q={q} value={blValues[q.id]}
            onChange={(v) => { setBlValues(prev => ({ ...prev, [q.id]: v })); setActivePreset(null); }}
            useDefault={blDefaults[q.id]}
            onToggleDefault={() => { setBlDefaults(prev => ({ ...prev, [q.id]: !prev[q.id] })); setActivePreset(null); }} />
        ))}
      </div>

      {/* Phase 2: AI */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 18px", marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: FONT_H, marginBottom: 2 }}>
          What AI adds
        </div>
        <p style={{ fontSize: 12, color: C.muted, margin: "0 0 14px 0", lineHeight: 1.5 }}>
          How transformative do you think AI will be across different domains? The model translates these beliefs into bottleneck-specific contributions using sensitivity weights documented below.
        </p>
        {AI_QUESTIONS.map(q => (
          <MetaSlider key={q.id} q={q} value={aiValues[q.id]}
            onChange={(v) => { setAiValues(prev => ({ ...prev, [q.id]: v })); setActivePreset(null); }} />
        ))}
      </div>

      {/* Documentation */}
      <div style={{ marginTop: 8 }}>
        <Collapsible title="How meta-sliders map to bottlenecks (sensitivity weights)">
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
            Each AI meta-slider feeds into specific bottlenecks with different sensitivities. A sensitivity of 0.50 means that slider has a large effect on that bottleneck; 0.05 means a marginal effect. The "max AI" column caps the total AI contribution regardless of slider values.
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", color: C.muted }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600, color: C.text }}>Bottleneck</th>
                  <th style={{ textAlign: "center", padding: "6px 4px", fontWeight: 600, color: C.text }}>Scientific R&D</th>
                  <th style={{ textAlign: "center", padding: "6px 4px", fontWeight: 600, color: C.text }}>Institutions</th>
                  <th style={{ textAlign: "center", padding: "6px 4px", fontWeight: 600, color: C.text }}>Consumer</th>
                  <th style={{ textAlign: "center", padding: "6px 4px", fontWeight: 600, color: C.text }}>Industrial</th>
                  <th style={{ textAlign: "center", padding: "6px 4px", fontWeight: 600, color: C.text }}>Max AI</th>
                </tr>
              </thead>
              <tbody>
                {BOTTLENECKS.map(b => (
                  <tr key={b.id} style={{ borderBottom: `1px solid ${C.dropBg}` }}>
                    <td style={{ padding: "5px 8px", fontWeight: 500, color: C.text }}>{b.label}</td>
                    <td style={{ textAlign: "center", padding: "5px 4px", color: b.sensitivities.science > 0.2 ? C.accent : C.light }}>{b.sensitivities.science.toFixed(2)}</td>
                    <td style={{ textAlign: "center", padding: "5px 4px", color: b.sensitivities.institutions > 0.2 ? C.accent : C.light }}>{b.sensitivities.institutions.toFixed(2)}</td>
                    <td style={{ textAlign: "center", padding: "5px 4px", color: b.sensitivities.consumer_beh > 0.2 ? C.accent : C.light }}>{b.sensitivities.consumer_beh.toFixed(2)}</td>
                    <td style={{ textAlign: "center", padding: "5px 4px", color: b.sensitivities.industrial > 0.2 ? C.accent : C.light }}>{b.sensitivities.industrial.toFixed(2)}</td>
                    <td style={{ textAlign: "center", padding: "5px 4px", fontWeight: 600 }}>{b.maxAI}pp</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Collapsible>

        <Collapsible title="Bottleneck details and sources">
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
            {BOTTLENECKS.map(b => (
              <div key={b.id} style={{ marginBottom: 12, padding: "8px 12px", background: C.dropBg, borderRadius: 5, borderLeft: `3px solid ${C.accentMid}` }}>
                <div style={{ fontWeight: 600, color: C.text, marginBottom: 3 }}>{b.label}</div>
                <div style={{ marginBottom: 4 }}><strong>Baseline reasoning:</strong> {b.baselineNote}</div>
                <div style={{ marginBottom: 4 }}><strong>How AI helps:</strong> {b.aiNote}</div>
                <div style={{ fontSize: 11, color: C.light, fontStyle: "italic" }}>Sources: {b.sources}</div>
              </div>
            ))}
          </div>
        </Collapsible>

        <Collapsible title="Detailed methodology">
          <div style={{ fontSize: 12, lineHeight: 1.6, color: C.muted }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: "0 0 4px 0", fontFamily: FONT_H }}>Two-phase structure</h3>
            <p style={{ margin: "0 0 10px 0" }}>The model separates two questions: "what happens to cultivated meat without AI?" (baseline) and "what does AI add?" (AI contribution). Readers set high-level beliefs about both, and the model translates these into bottleneck-specific progress values. This decomposition makes AI's marginal contribution visible and prevents readers from conflating baseline progress with AI-driven progress.</p>

            <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: "0 0 4px 0", fontFamily: FONT_H }}>Baseline computation</h3>
            <p style={{ margin: "0 0 10px 0" }}>Four baseline questions map to the nine bottlenecks. Each bottleneck has a default baseline value (our evidence-based estimate). When readers adjust a baseline meta-slider, the model scales the mapped bottleneck baselines proportionally: if the reader sets the science baseline to 60 (vs. our default of 50), all technical bottleneck baselines increase by a factor of 60/50 = 1.2. Readers can also leave the defaults checked, in which case our evidence-based values are used unchanged.</p>

            <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: "0 0 4px 0", fontFamily: FONT_H }}>AI contribution computation</h3>
            <p style={{ margin: "0 0 10px 0" }}>Four AI meta-sliders (scientific R&D, institutions, consumer behaviour, industrial scaling) feed into each bottleneck through sensitivity weights. The AI contribution for each bottleneck is: sum over all meta-sliders of (meta-slider value / 100) \u00d7 sensitivity \u00d7 max-AI-for-this-bottleneck. The contribution is capped at the max-AI value, which represents our estimate of the ceiling of AI's possible contribution to that bottleneck. All sensitivity weights are documented in the reference table above.</p>

            <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: "0 0 4px 0", fontFamily: FONT_H }}>Sensitivity weights</h3>
            <p style={{ margin: "0 0 10px 0" }}>The sensitivity weights encode our domain knowledge about which AI capabilities affect which bottlenecks. For example, scientific R&D capability has sensitivity 0.50 to growth factor cost (because protein design is a well-defined ML problem) but only 0.05 to regulatory approval (because regulatory timelines are primarily political). These are judgment calls, documented with reasoning for each bottleneck. Readers who disagree with the weights can inspect them in the reference table but cannot currently override them in the interface.</p>

            <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: "0 0 4px 0", fontFamily: FONT_H }}>Max AI caps</h3>
            <p style={{ margin: "0 0 10px 0" }}>Each bottleneck has a maximum AI contribution (in percentage points) that caps how much AI can add regardless of how high the meta-sliders are set. These are higher for technical bottlenecks (35\u201355pp) where AI has well-defined problems to solve, and lower for non-technical bottlenecks (25\u201330pp) where AI\u2019s causal pathway to impact is indirect. These caps are judgment calls and are documented per-bottleneck.</p>

            <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: "0 0 4px 0", fontFamily: FONT_H }}>What this model does not do</h3>
            <p style={{ margin: "0 0 10px 0" }}>The model does not produce a single probability of cultivated meat "succeeding" or a timeline for deployment. It does not estimate downstream effects on animal welfare. It does not model the time dimension or discontinuous scenarios (AGI, value lock-in, global catastrophes). It does not model correlations between bottlenecks beyond what is implicitly captured by shared sensitivity to the same meta-sliders (e.g. both capital and ecosystem respond to the industrial scaling slider). The model\u2019s purpose is to make visible the asymmetry in AI\u2019s contribution across different types of bottlenecks.</p>

            <div style={{ marginTop: 12, padding: "10px 14px", background: C.dropBg, borderRadius: 5, borderLeft: `3px solid ${C.border}` }}>
              <em style={{ fontSize: 11, color: C.muted }}>Rethink Priorities, 2026. Draft for discussion. All assumptions are documented and inspectable. This model should not be cited as a forecast.</em>
            </div>
          </div>
        </Collapsible>
      </div>
    </div>
  );
}
