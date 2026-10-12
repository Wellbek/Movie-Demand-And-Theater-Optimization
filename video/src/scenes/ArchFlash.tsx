import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../constants";
import { INTER, MONO } from "../fonts";
import { Backdrop, Kicker, useEnter } from "../ui";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const steps = [
  { n: "1", name: "Screenings", desc: "Sum tickets per film, date, time. Full hall = sold out." },
  { n: "2", name: "Pattern", desc: "Film strength × time of day × weekday, maximum likelihood." },
  { n: "3", name: "Bayes update", desc: "Pattern as prior, own screenings as evidence." },
  { n: "4", name: "Value", desc: "Expected tickets per hall, negative binomial. Caution on untried cells." },
  { n: "5", name: "Weekly LP", desc: "Best week under the rules, certified by duality." },
];

const Step: React.FC<{ i: number }> = ({ i }) => {
  const e = useEnter(30 + i * 22);
  const s = steps[i];
  return (
    <div style={{ ...e, width: 276, height: 310, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderTop: `4px solid ${COLORS.accent}`, borderRadius: 12, padding: 28 }}>
      <div style={{ fontFamily: INTER, fontSize: 54, fontWeight: 900, color: COLORS.accent }}>{s.n}</div>
      <div style={{ fontFamily: INTER, fontSize: 32, fontWeight: 800, color: COLORS.white, marginTop: 6 }}>{s.name}</div>
      <div style={{ fontFamily: INTER, fontSize: 21, color: COLORS.offWhite, marginTop: 14, lineHeight: 1.4 }}>{s.desc}</div>
    </div>
  );
};

export const ArchFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const title = useEnter(4);
  const io = interpolate(frame, [150, 175], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ padding: "0 70px", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...title, textAlign: "center" }}>
          <Kicker>How it works</Kicker>
          <div style={{ fontFamily: INTER, fontSize: 54, fontWeight: 800, color: COLORS.white, marginTop: 14 }}>
            From purchase rows to a week that can be defended.
          </div>
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 70, alignItems: "center" }}>
          {steps.map((_, i) => (
            <React.Fragment key={i}>
              <Step i={i} />
              {i < steps.length - 1 && <div style={{ fontFamily: INTER, fontSize: 36, color: COLORS.accent, opacity: interpolate(frame, [40 + i * 22, 55 + i * 22], [0, 1], clamp) }}>→</div>}
            </React.Fragment>
          ))}
        </div>
        <div style={{ display: "flex", gap: 80, marginTop: 70, opacity: io }}>
          <div style={{ fontFamily: MONO, fontSize: 20, color: COLORS.muted }}>
            IN <span style={{ color: COLORS.offWhite }}>six-field purchase rows + weekly settings</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 20, color: COLORS.muted }}>
            OUT <span style={{ color: COLORS.offWhite }}>week grid, reasons and runner-up per cell, baseline beside it</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
