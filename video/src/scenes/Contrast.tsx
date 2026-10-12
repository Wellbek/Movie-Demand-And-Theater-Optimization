import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS, N } from "../constants";
import { INTER, MONO } from "../fonts";
import { Backdrop, Kicker, useEnter } from "../ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Side: React.FC<{ label: string; title: string; value: string; lines: string[]; color: string; style: React.CSSProperties }> = ({
  label, title, value, lines, color, style,
}) => (
  <div style={{ ...style, width: 700, padding: "48px 56px", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderTop: `4px solid ${color}`, borderRadius: 14 }}>
    <Kicker color={color}>{label}</Kicker>
    <div style={{ fontFamily: INTER, fontSize: 40, fontWeight: 800, color: COLORS.white, marginTop: 14 }}>{title}</div>
    <div style={{ fontFamily: INTER, fontSize: 120, fontWeight: 900, color, marginTop: 18, letterSpacing: -3 }}>{value}</div>
    <div style={{ fontFamily: INTER, fontSize: 22, color: COLORS.muted, marginTop: -6 }}>expected tickets, one week</div>
    <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 12 }}>
      {lines.map((l) => (
        <div key={l} style={{ fontFamily: INTER, fontSize: 26, color: COLORS.offWhite }}>{l}</div>
      ))}
    </div>
  </div>
);

export const Contrast: React.FC = () => {
  const frame = useCurrentFrame();
  const left = useEnter(8);
  const right = useEnter(48);
  const bottom = useEnter(120);
  const divider = interpolate(frame, [36, 56], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 60 }}>
          <Side style={left} color={COLORS.grey} label="Rule of thumb" title="Greedy baseline" value={N.base}
            lines={["Best film, biggest hall, best time first", "One cell at a time, never revisited", "14 bets on combinations never tried"]} />
          <div style={{ fontFamily: INTER, fontSize: 40, fontWeight: 800, color: COLORS.muted, opacity: divider }}>vs</div>
          <Side style={right} color={COLORS.accent} label="Theater Optimization" title="Optimised week" value={N.prop}
            lines={["Every cell of the week decided at once", "Films matched to times and hall sizes", "0 untried bets, 0 rule violations"]} />
        </div>
        <div style={{ ...bottom, marginTop: 56, display: "flex", alignItems: "baseline", gap: 24 }}>
          <span style={{ fontFamily: INTER, fontSize: 64, fontWeight: 900, color: COLORS.green }}>{N.gain}</span>
          <span style={{ fontFamily: INTER, fontSize: 34, color: COLORS.white }}>from the same films, halls and hours</span>
        </div>
        <div style={{ ...bottom, fontFamily: MONO, fontSize: 16, letterSpacing: 2, color: COLORS.muted, marginTop: 18 }}>
          DEMO WEEK · TOOL'S OWN ESTIMATE · FICTIONAL DATA
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
