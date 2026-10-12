import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../constants";
import { INTER, MONO } from "../fonts";
import { Backdrop, Kicker, Separator, Wordmark, useEnter } from "../ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const stages = [
  { n: "Stage 0", name: "Data audit", tag: "Approval required", c: COLORS.accent, gate: "Hall seats and show times confirmed, 8+ usable weeks" },
  { n: "Stage 1", name: "Offline replay", tag: "Approval required", c: COLORS.accent, gate: "Error 10% below film averages, over-promising under 10%" },
  { n: "Stage 2", name: "Advisory trial", tag: "Decided later", c: COLORS.amber, gate: "Randomised paired weeks; adopt only on the agreed margin" },
];

const corner = (op: number, extra: React.CSSProperties): React.CSSProperties => ({
  position: "absolute", width: 56, height: 56, opacity: op, borderColor: COLORS.accent, ...extra,
});

export const Close: React.FC = () => {
  const frame = useCurrentFrame();
  const p1 = interpolate(frame, [0, 12, 260, 290], [0, 1, 1, 0], clamp);
  const p2 = interpolate(frame, [285, 320], [0, 1], clamp);
  const head = useEnter(4);
  const cta = useEnter(300);
  const sub = useEnter(330);
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ opacity: p1, justifyContent: "center", padding: "0 140px" }}>
        <div style={head}>
          <Kicker>Next step</Kicker>
          <div style={{ fontFamily: INTER, fontSize: 56, fontWeight: 800, color: COLORS.white, marginTop: 14 }}>
            Three gated stages. Each must earn the next.
          </div>
        </div>
        <div style={{ display: "flex", gap: 30, marginTop: 56 }}>
          {stages.map((s, i) => {
            const e = useEnter(30 + i * 30);
            return (
              <div key={s.n} style={{ ...e, flex: 1, padding: "30px 34px", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderTop: `4px solid ${s.c}`, borderRadius: 12 }}>
                <div style={{ fontFamily: MONO, fontSize: 18, color: COLORS.muted, letterSpacing: 2 }}>{s.n.toUpperCase()}</div>
                <div style={{ fontFamily: INTER, fontSize: 40, fontWeight: 800, color: COLORS.white, marginTop: 8 }}>{s.name}</div>
                <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: s.c, letterSpacing: 2, marginTop: 12 }}>{s.tag.toUpperCase()}</div>
                <div style={{ fontFamily: INTER, fontSize: 24, color: COLORS.offWhite, marginTop: 18, lineHeight: 1.4 }}>{s.gate}</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontFamily: INTER, fontSize: 30, color: COLORS.white, marginTop: 50 }}>
          The ask: approve a <b style={{ color: COLORS.accent }}>data audit</b> and an <b style={{ color: COLORS.accent }}>offline replay</b> at one venue. Not adoption.
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: p2, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={corner(p2, { top: 50, left: 50, borderTop: "3px solid", borderLeft: "3px solid" })} />
        <div style={corner(p2, { top: 50, right: 50, borderTop: "3px solid", borderRight: "3px solid" })} />
        <div style={corner(p2, { bottom: 50, left: 50, borderBottom: "3px solid", borderLeft: "3px solid" })} />
        <div style={corner(p2, { bottom: 50, right: 50, borderBottom: "3px solid", borderRight: "3px solid" })} />
        <div style={cta}>
          <Wordmark size={96} />
          <div style={{ fontFamily: INTER, fontSize: 52, fontWeight: 800, color: COLORS.white, marginTop: 24 }}>Fill the right seats.</div>
        </div>
        <Separator width={760} style={{ margin: "48px 0" }} />
        <div style={sub}>
          <div style={{ fontFamily: MONO, fontSize: 30, color: COLORS.offWhite }}>
            open <span style={{ color: COLORS.white, fontWeight: 700 }}>demo.html</span> in any desktop browser. Works offline.
          </div>
          <div style={{ fontFamily: INTER, fontSize: 22, color: COLORS.muted, marginTop: 34 }}>
            Titles, venue, halls and purchases are invented; figures illustrate the mechanism, not a forecast.
          </div>
          <div style={{ fontFamily: INTER, fontSize: 22, color: COLORS.muted, marginTop: 12 }}>Louis Wellmeyer</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
