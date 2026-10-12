import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "./constants";
import { INTER, MONO } from "./fonts";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Spring entrance from frame `at`: opacity, scale (from 0.93) and a small rise.
export function useEnter(at: number, damping = 18, stiffness = 150) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: { damping, stiffness } });
  return {
    opacity: interpolate(p, [0, 0.35], [0, 1], clamp),
    transform: `translateY(${interpolate(p, [0, 1], [18, 0])}px) scale(${interpolate(p, [0, 1], [0.93, 1])})`,
  };
}

// Fade the whole scene in and out so cuts never pop.
export const SceneFade: React.FC<{ children: React.ReactNode; out?: number }> = ({ children, out = 15 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(frame, [0, 12, durationInFrames - out, durationInFrames], [0, 1, 1, 0], clamp);
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const Backdrop: React.FC<{ glow?: boolean }> = ({ glow = true }) => (
  <AbsoluteFill
    style={{
      background: glow
        ? `radial-gradient(ellipse at 50% 38%, #2a0608 0%, ${COLORS.bg} 62%)`
        : COLORS.bg,
    }}
  />
);

export const Wordmark: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 30, style }) => (
  <div style={{ fontFamily: INTER, fontWeight: 900, fontSize: size, letterSpacing: -0.5, color: COLORS.accent, ...style }}>
    THEATER OPTIMIZATION
  </div>
);

export const Kicker: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color = COLORS.accent, style }) => (
  <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 16, letterSpacing: 5, color, textTransform: "uppercase", ...style }}>
    {children}
  </div>
);

export const Tag: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = COLORS.amber }) => (
  <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 14, letterSpacing: 2, color: "#000", background: color, padding: "4px 10px", borderRadius: 4 }}>
    {children}
  </span>
);

export const Separator: React.FC<{ width?: number; style?: React.CSSProperties }> = ({ width = 520, style }) => (
  <div style={{ width, height: 2, background: `linear-gradient(90deg, transparent, ${COLORS.accent}, transparent)`, ...style }} />
);

export const Vignette: React.FC = () => (
  <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.75) 100%)", pointerEvents: "none" }} />
);

export const FloatingCallout: React.FC<{
  text: string; subtext?: string; style?: React.CSSProperties; at: number; color?: string;
}> = ({ text, subtext, style, at, color = COLORS.accent }) => {
  const e = useEnter(at);
  return (
    <div
      style={{
        position: "absolute", ...e, background: "rgba(0,0,0,0.88)", border: `2px solid ${color}`,
        borderRadius: 12, padding: "16px 24px", maxWidth: 520, zIndex: 10, boxShadow: "0 18px 50px rgba(0,0,0,0.6)", ...style,
      }}
    >
      <div style={{ fontFamily: INTER, fontSize: 28, fontWeight: 800, color: COLORS.white }}>{text}</div>
      {subtext && <div style={{ fontFamily: INTER, fontSize: 20, color: COLORS.offWhite, marginTop: 6, lineHeight: 1.35 }}>{subtext}</div>}
    </div>
  );
};

// Bottom-left label for real captures, e.g. "REAL PRODUCT · DEMO.HTML".
export const SourceLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: "absolute", left: 60, bottom: 44, display: "flex", alignItems: "center", gap: 12, zIndex: 11 }}>
    <div style={{ width: 10, height: 10, borderRadius: 5, background: COLORS.accent }} />
    <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: 3, color: COLORS.offWhite }}>{children}</div>
  </div>
);
