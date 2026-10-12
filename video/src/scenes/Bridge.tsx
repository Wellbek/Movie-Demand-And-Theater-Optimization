import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS } from "../constants";
import { INTER } from "../fonts";
import { Backdrop, Kicker, Separator, Wordmark, useEnter } from "../ui";

const props = [
  { label: "Learns", text: "Demand per film, time and day type", accent: "from six purchase fields." },
  { label: "Plans", text: "The whole week as one linear program,", accent: "certified optimal." },
  { label: "Runs offline", text: "One HTML file.", accent: "No server, no install, no network." },
];

const Prop: React.FC<{ i: number }> = ({ i }) => {
  const e = useEnter(40 + i * 75, 16, 140);
  const p = props[i];
  return (
    <div style={{ ...e, display: "flex", alignItems: "baseline", gap: 40 }}>
      <Kicker style={{ width: 260, textAlign: "right", fontSize: 20 }}>{p.label}</Kicker>
      <div style={{ fontFamily: INTER, fontSize: 42, fontWeight: 600, color: COLORS.offWhite }}>
        {p.text} <span style={{ color: COLORS.white, fontWeight: 800 }}>{p.accent}</span>
      </div>
    </div>
  );
};

export const Bridge: React.FC = () => {
  const title = useEnter(4);
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 160px" }}>
        <div style={title}>
          <Wordmark size={64} />
          <div style={{ fontFamily: INTER, fontSize: 36, color: COLORS.white, marginTop: 12, fontWeight: 600 }}>
            Decision support for the weekly cinema schedule.
          </div>
          <Separator width={900} style={{ marginTop: 40, marginBottom: 56 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
          {props.map((_, i) => <Prop key={i} i={i} />)}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
