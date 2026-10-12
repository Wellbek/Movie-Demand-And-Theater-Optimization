import React from "react";
import { AbsoluteFill, Img, Series, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../constants";
import { MONO } from "../fonts";
import { FloatingCallout, SceneFade, SourceLabel, Vignette } from "../ui";

export type Shot = {
  src: string;
  text: string;
  subtext?: string;
  callout: React.CSSProperties;
  focus?: [number, number]; // zoom origin in px of the 1920x1080 frame
  zoom?: number;
};

// One real capture with a slow push-in and a timed callout.
const ShotView: React.FC<{ shot: Shot; label: string; step: string }> = ({ shot, label, step }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const z = interpolate(frame, [0, durationInFrames], [1, shot.zoom ?? 1.06]);
  const [fx, fy] = shot.focus ?? [960, 540];
  return (
    <SceneFade out={10}>
      <AbsoluteFill style={{ background: COLORS.bg }}>
        <Img src={staticFile(shot.src)} style={{ width: 1920, height: 1080, transform: `scale(${z})`, transformOrigin: `${fx}px ${fy}px` }} />
        <Vignette />
        <AbsoluteFill style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.75) 0%, transparent 16%)" }} />
        <FloatingCallout at={18} text={shot.text} subtext={shot.subtext} style={shot.callout} />
        <SourceLabel>{label}</SourceLabel>
        <div style={{ position: "absolute", right: 60, bottom: 44, fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: 3, color: COLORS.muted }}>{step}</div>
      </AbsoluteFill>
    </SceneFade>
  );
};

export const Showcase: React.FC<{ shots: Shot[]; label: string; each: number }> = ({ shots, label, each }) => (
  <Series>
    {shots.map((s, i) => (
      <Series.Sequence key={s.src} durationInFrames={each}>
        <ShotView shot={s} label={label} step={`${String(i + 1).padStart(2, "0")} / ${String(shots.length).padStart(2, "0")}`} />
      </Series.Sequence>
    ))}
  </Series>
);

export const DEMO_SHOTS: Shot[] = [
  { src: "demo-hero.png", text: "Opens with the answer", subtext: "Double-click demo.html: the week is planned in the browser, no server, no network.", callout: { top: 150, right: 90 }, focus: [400, 400] },
  { src: "demo-settings.png", text: "1 · Your venue, your rules", subtext: "Halls and seats, show times, cleaning time, films with min / max shows, caution level.", callout: { bottom: 110, right: 90 }, focus: [700, 300] },
  { src: "demo-records.png", text: "2 · Six fields of purchase records", subtext: "14,165 generated rows, summed into 420 screenings. Sell-outs flagged, not trusted as demand.", callout: { bottom: 110, right: 90 }, focus: [480, 300] },
  { src: "demo-demand.png", text: "3 · Demand per film, time, day type", subtext: "Bayesian estimate: the pattern is the prior, each cell's own screenings are the evidence. Hatched = never tried.", callout: { top: 100, right: 90 }, focus: [960, 380] },
  { src: "demo-plan.png", text: "4 · Baseline vs optimised, cell by cell", subtext: "Same inputs, rules and scoring. Saturday: the right film in the right hall at the right time.", callout: { bottom: 100, right: 90 }, focus: [1300, 500] },
  { src: "demo-cell.png", text: "Every cell explains itself", subtext: "Ranked alternatives with demand and evidence. Pin a film or block a slot, and the week is re-solved.", callout: { top: 200, right: 90 }, focus: [700, 300] },
  { src: "demo-sim.png", text: "5 · Watch both weeks play out", subtext: "A cinema clock seats each screening's expected audience, baseline left, optimised right.", callout: { bottom: 110, right: 90 }, focus: [960, 250] },
  { src: "demo-kpis.png", text: "+916 expected tickets", subtext: "More seats filled on every day, fewer turned away at peak, 14 untried bets down to 0.", callout: { top: 90, right: 90 }, focus: [600, 600] },
  { src: "demo-how.png", text: "6 · How it works, animated live", subtext: "Each method from the course drawn step by step from the current run.", callout: { top: 110, right: 90 }, focus: [500, 500] },
  { src: "demo-checks.png", text: "7 · Test cases in the page", subtext: "Normal, boundary and failure cases. Impossible settings are explained, never planned.", callout: { top: 90, right: 90 }, focus: [900, 500] },
];
