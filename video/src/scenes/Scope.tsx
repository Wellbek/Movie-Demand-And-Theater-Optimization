import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../constants";
import { INTER } from "../fonts";
import { Backdrop, Kicker, useEnter } from "../ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const cols = [
  { h: "Must have", c: COLORS.green, items: ["One venue, one week, booked films", "Film × hall × show time, one film per hall-time", "Min / max shows, runtime + cleaning fits", "Baseline side by side; advisory only"] },
  { h: "Should have", c: COLORS.amber, items: ["Caution on untried combinations", "Optimality certificate", "Reasons and runner-up per cell", "Clear messages when rules cannot be met"] },
  { h: "Won't have now", c: COLORS.accent, items: ["Film booking and distributor terms", "Pricing and concessions", "Several venues, mid-week changes", "Social buzz, weather, holidays"] },
];

export const Scope: React.FC = () => {
  const frame = useCurrentFrame();
  const head = useEnter(4);
  const box = useEnter(20);
  const out = interpolate(frame, [280, 300], [1, 0], clamp);
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ opacity: out, justifyContent: "center", padding: "0 140px" }}>
        <div style={head}>
          <Kicker>Scope</Kicker>
          <div style={{ fontFamily: INTER, fontSize: 56, fontWeight: 800, color: COLORS.white, marginTop: 14 }}>
            A narrower first step that still makes the real decision.
          </div>
        </div>
        <div style={{ ...box, marginTop: 40, padding: "26px 34px", border: `1px solid ${COLORS.accentDim}`, background: "rgba(229,9,20,0.08)", borderRadius: 12, fontFamily: INTER, fontSize: 28, color: COLORS.offWhite, lineHeight: 1.45 }}>
          Demand estimated from purchase records, hall seats and the film list, <b style={{ color: COLORS.white }}>before next week's schedule is published</b>, decide{" "}
          <b style={{ color: COLORS.white }}>which film plays in which hall at each show time</b>, to <b style={{ color: COLORS.white }}>increase expected admissions</b> without breaking show commitments.
        </div>
        <div style={{ display: "flex", gap: 30, marginTop: 40 }}>
          {cols.map((c, i) => {
            const e = useEnter(60 + i * 25);
            return (
              <div key={c.h} style={{ ...e, flex: 1, padding: "28px 32px", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderTop: `4px solid ${c.c}`, borderRadius: 12 }}>
                <div style={{ fontFamily: INTER, fontSize: 30, fontWeight: 800, color: c.c }}>{c.h}</div>
                {c.items.map((it) => (
                  <div key={it} style={{ fontFamily: INTER, fontSize: 23, color: COLORS.offWhite, marginTop: 14 }}>{it}</div>
                ))}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
