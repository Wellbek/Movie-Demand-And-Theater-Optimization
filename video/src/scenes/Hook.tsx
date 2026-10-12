import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../constants";
import { INTER, MONO } from "../fonts";
import { Backdrop, Kicker, useEnter } from "../ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// A hall drawn as seats; seats fill in one by one from `at`.
const Hall: React.FC<{ cols: number; rows: number; filled: number; color: string; at: number; seat?: number; turnedAway?: number }> = ({
  cols, rows, filled, color, at, seat = 22, turnedAway = 0,
}) => {
  const frame = useCurrentFrame();
  const shown = Math.round(interpolate(frame, [at, at + 60], [0, filled], clamp));
  const away = Math.round(interpolate(frame, [at + 60, at + 100], [0, turnedAway], clamp));
  const total = cols * rows;
  // Fill from the centre of the hall outwards, like an audience does.
  const order = Array.from({ length: total }, (_, i) => i).sort((a, b) => {
    const d = (i: number) => Math.hypot((i % cols) - (cols - 1) / 2, Math.floor(i / cols) - rows * 0.55);
    return d(a) - d(b);
  });
  const on = new Set(order.slice(0, shown));
  return (
    <div>
      <div style={{ width: cols * (seat + 6), height: 10, margin: "0 auto 26px", background: "linear-gradient(90deg, transparent, #ddd, transparent)", opacity: 0.55, borderRadius: 5 }} />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${seat}px)`, gap: 6 }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{ width: seat, height: seat, borderRadius: 5, background: on.has(i) ? color : "#26262a" }} />
        ))}
      </div>
      {turnedAway > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 30, flexWrap: "wrap", width: cols * (seat + 6) }}>
          {Array.from({ length: away }, (_, i) => (
            <div key={i} style={{ width: seat, height: seat, borderRadius: seat / 2, border: `2px dashed ${color}`, opacity: 0.8 }} />
          ))}
        </div>
      )}
    </div>
  );
};

const Phase: React.FC<{ opacity: number; children: React.ReactNode }> = ({ opacity, children }) => (
  <AbsoluteFill style={{ opacity, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 120, padding: "0 140px" }}>
    {children}
  </AbsoluteFill>
);

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const p1 = interpolate(frame, [0, 10, 120, 145], [0, 1, 1, 0], clamp);
  const p2 = interpolate(frame, [135, 160, 245, 270], [0, 1, 1, 0], clamp);
  const p3 = interpolate(frame, [255, 270], [0, 1], clamp);
  const t1 = useEnter(10);
  const t2 = useEnter(150);
  const a = useEnter(258);
  const b = useEnter(276);
  const c = useEnter(296);
  return (
    <AbsoluteFill>
      <Backdrop glow={false} />
      <Phase opacity={p1}>
        <Hall cols={20} rows={11} filled={19} color={COLORS.green} at={20} seat={24} />
        <div style={{ ...t1, width: 640 }}>
          <Kicker>Saturday · 22:00 · Hall 1</Kicker>
          <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 64, color: COLORS.white, lineHeight: 1.05, marginTop: 18 }}>
            A family film plays to 220 seats.
          </div>
          <div style={{ fontFamily: INTER, fontSize: 34, color: COLORS.muted, marginTop: 22 }}>19 tickets sold.</div>
        </div>
      </Phase>
      <Phase opacity={p2}>
        <div style={{ ...t2, width: 640 }}>
          <Kicker>Same night · Hall 3</Kicker>
          <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 64, color: COLORS.white, lineHeight: 1.05, marginTop: 18 }}>
            The sell-out film is in the smallest room.
          </div>
          <div style={{ fontFamily: INTER, fontSize: 34, color: COLORS.muted, marginTop: 22 }}>60 seats. The rest are turned away.</div>
        </div>
        <Hall cols={10} rows={6} filled={60} color={COLORS.accent} at={150} seat={34} turnedAway={18} />
      </Phase>
      <AbsoluteFill style={{ opacity: p3, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 72, color: COLORS.white, lineHeight: 1.15 }}>
          <div style={a}>Same films.</div>
          <div style={b}>Same halls. Same hours.</div>
        </div>
        <div style={{ ...c, fontFamily: INTER, fontWeight: 700, fontSize: 46, color: COLORS.accent, marginTop: 34 }}>
          The arrangement decides how many seats fill.
        </div>
        <div style={{ ...c, fontFamily: MONO, fontSize: 18, color: COLORS.muted, marginTop: 40, letterSpacing: 2 }}>
          ILLUSTRATION · FICTIONAL CINEMA
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
