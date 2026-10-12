import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { COLORS, N } from "../constants";
import { INTER, MONO } from "../fonts";
import { Backdrop, FloatingCallout, Kicker, SourceLabel, Tag, Vignette, useEnter } from "../ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Verbatim excerpts of `node --test` and `python tools/verify.py` (run 2026-10-12).
const lines: { t: string; c?: string }[] = [
  { t: "$ cd src && node --test", c: COLORS.muted },
  { t: "✔ brute-force check exported for the demo agrees on every comparable instance" },
  { t: "✔ rule costs come from re-solving, and the repeat-last-week reference keeps every rule" },
  { t: "✔ a film that was available but never scheduled is cautioned like an untried combination" },
  { t: "✔ robustness sweep: 80 random configurations against the rule of thumb" },
  { t: "ℹ tests 18   ℹ pass 18   ℹ fail 0", c: COLORS.green },
  { t: "" },
  { t: "$ python tools/verify.py        # Chromium, offline=True", c: COLORS.muted },
  { t: "PASS demo: all 7 test cases pass in the page" },
  { t: "PASS demo: clicking a plan cell opens ranked alternatives" },
  { t: "PASS demo: pinning a film re-runs and keeps a certified plan" },
  { t: "PASS demo: infeasible settings show the explanation and mark results stale" },
  { t: "PASS definition quotes objective = 6,552.2 as computed by the engine" },
  { t: "ALL CHECKS PASSED", c: COLORS.green },
];

const Terminal: React.FC = () => {
  const frame = useCurrentFrame();
  const shown = Math.floor(interpolate(frame, [20, 170], [0, lines.length], clamp));
  return (
    <div style={{ width: 1500, background: "#050505", border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
      <div style={{ display: "flex", gap: 10, padding: "16px 20px", background: "#111", borderBottom: `1px solid ${COLORS.border}` }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />)}
      </div>
      <div style={{ padding: "28px 34px", minHeight: 560 }}>
        {lines.slice(0, shown).map((l, i) => (
          <div key={i} style={{ fontFamily: MONO, fontSize: 23, lineHeight: 1.6, color: l.c ?? COLORS.offWhite, whiteSpace: "pre" }}>
            {l.t || " "}
          </div>
        ))}
      </div>
    </div>
  );
};

const Stat: React.FC<{ at: number; value: string; label: string; mock?: boolean }> = ({ at, value, label, mock }) => {
  const e = useEnter(at);
  return (
    <div style={{ ...e, flex: 1, padding: "34px 36px", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12 }}>
      <div style={{ fontFamily: INTER, fontSize: 60, fontWeight: 900, color: COLORS.white, letterSpacing: -1, whiteSpace: "nowrap" }}>{value}</div>
      <div style={{ fontFamily: INTER, fontSize: 24, color: COLORS.offWhite, marginTop: 10, lineHeight: 1.35 }}>{label}</div>
      {mock && <div style={{ marginTop: 16 }}><Tag>MOCK</Tag></div>}
    </div>
  );
};

export const Proof: React.FC = () => {
  const frame = useCurrentFrame();
  const head = useEnter(4);
  const t = interpolate(frame, [0, 12, 235, 255], [0, 1, 1, 0], clamp);
  const s = interpolate(frame, [250, 270, 420, 440], [0, 1, 1, 0], clamp);
  const c = interpolate(frame, [432, 450], [0, 1], clamp);
  const z = interpolate(frame, [432, 600], [1, 1.05], clamp);
  return (
    <AbsoluteFill>
      <Backdrop glow={false} />
      <AbsoluteFill style={{ opacity: t, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 36 }}>
        <div style={{ ...head, display: "flex", gap: 24, alignItems: "center" }}>
          <Kicker>Proof</Kicker>
          <Tag color={COLORS.green}>REAL TERMINAL OUTPUT</Tag>
        </div>
        <Terminal />
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: s, justifyContent: "center", padding: "0 140px" }}>
        <Kicker>What is established</Kicker>
        <div style={{ fontFamily: INTER, fontSize: 56, fontWeight: 800, color: COLORS.white, marginTop: 14, marginBottom: 56 }}>
          Optimal for the stated model, never below the baseline.
        </div>
        <div style={{ display: "flex", gap: 30 }}>
          <Stat at={270} value={`${N.primal} = ${N.dual}`} label="Planning value equals the dual bound: the optimality certificate." />
          <Stat at={290} value={N.sweep} label="Random venues where the plan beats the baseline on hidden demand." mock />
          <Stat at={310} value="99.4%" label="Of the best possible week, scored against the generator's true demand." mock />
        </div>
        <div style={{ fontFamily: INTER, fontSize: 24, color: COLORS.muted, marginTop: 40 }}>
          Not established: any effect on real admissions. That needs the audit, the replay and a trial.
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: c }}>
        <Img src={staticFile("demo-sweep.png")} style={{ width: 1920, height: 1080, transform: `scale(${z})`, transformOrigin: "900px 200px" }} />
        <Vignette />
        <FloatingCallout at={450} text="300 random configurations, in the demo" subtext="Planning value never below the baseline: 300 / 300. Losses on hidden demand are reported, not hidden." style={{ bottom: 120, right: 90 }} />
        <SourceLabel>REAL PRODUCT · DEMO.HTML · COMPARE</SourceLabel>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
