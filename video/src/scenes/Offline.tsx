import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS, N } from "../constants";
import { INTER, MONO } from "../fonts";
import { Backdrop, Kicker, Separator, useEnter } from "../ui";

const files = [
  { name: "demo.html", size: "660 KB", what: "Interactive planner" },
  { name: "proposal.html", size: "467 KB", what: "12-slide proposal deck" },
  { name: "problem-definition.md", size: "62 KB", what: "Problem definition" },
];

const facts = [
  "No server, no install, no account",
  "No CDN: formulas pre-rendered, scripts inlined",
  "No data leaves the machine",
  `Network disabled in all ${N.checks} browser checks`,
  "The build fails on any external reference",
];

export const Offline: React.FC = () => {
  const head = useEnter(4);
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 120, padding: "0 140px" }}>
        <div style={{ ...head, width: 760 }}>
          <Kicker>Fully offline</Kicker>
          <div style={{ fontFamily: INTER, fontSize: 96, fontWeight: 900, color: COLORS.white, lineHeight: 1, marginTop: 18, letterSpacing: -2 }}>
            One file.
            <br />
            <span style={{ color: COLORS.accent }}>Double-click.</span>
          </div>
          <Separator width={620} style={{ margin: "40px 0" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {facts.map((f, i) => {
              const e = useEnter(40 + i * 16);
              return (
                <div key={f} style={{ ...e, display: "flex", gap: 18, alignItems: "center", fontFamily: INTER, fontSize: 30, color: COLORS.offWhite }}>
                  <span style={{ color: COLORS.green, fontWeight: 900 }}>✓</span> {f}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          {files.map((f, i) => {
            const e = useEnter(20 + i * 18);
            return (
              <div key={f.name} style={{ ...e, width: 560, padding: "26px 32px", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderLeft: `4px solid ${i === 0 ? COLORS.accent : COLORS.border}`, borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontFamily: MONO, fontSize: 30, fontWeight: 700, color: COLORS.white }}>{f.name}</span>
                  <span style={{ fontFamily: MONO, fontSize: 18, color: COLORS.muted }}>{f.size}</span>
                </div>
                <div style={{ fontFamily: INTER, fontSize: 22, color: COLORS.offWhite, marginTop: 8 }}>{f.what}</div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
