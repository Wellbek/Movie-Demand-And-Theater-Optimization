//    0 –  360  (0:00 – 0:12)  Hook
//  360 –  630  (0:12 – 0:21)  Contrast
//  630 –  960  (0:21 – 0:32)  Product pitch
//  960 – 2610  (0:32 – 1:27)  Live demo (10 real captures)
// 2610 – 2940  (1:27 – 1:38)  Architecture
// 2940 – 3210  (1:38 – 1:47)  Offline
// 3210 – 3810  (1:47 – 2:07)  Proof
// 3810 – 4110  (2:07 – 2:17)  Scope
// 4110 – 4590  (2:17 – 2:33)  Close
import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { COLORS } from "./constants";
import { SceneFade } from "./ui";
import { Hook } from "./scenes/Hook";
import { Contrast } from "./scenes/Contrast";
import { Bridge } from "./scenes/Bridge";
import { DEMO_SHOTS, Showcase } from "./scenes/Showcase";
import { ArchFlash } from "./scenes/ArchFlash";
import { Offline } from "./scenes/Offline";
import { Proof } from "./scenes/Proof";
import { Scope } from "./scenes/Scope";
import { Close } from "./scenes/Close";

export const SHOT_FRAMES = 165;
export const SCENES: [React.FC, number][] = [
  [Hook, 360],
  [Contrast, 270],
  [Bridge, 330],
  [() => <Showcase shots={DEMO_SHOTS} label="REAL PRODUCT · DEMO.HTML · OFFLINE" each={SHOT_FRAMES} />, SHOT_FRAMES * DEMO_SHOTS.length],
  [ArchFlash, 330],
  [Offline, 270],
  [Proof, 600],
  [Scope, 300],
  [Close, 480],
];
export const TOTAL_FRAMES = SCENES.reduce((s, [, d]) => s + d, 0);

export const MainVideo: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.bg }}>
    <Series>
      {SCENES.map(([Scene, d], i) => (
        <Series.Sequence key={i} durationInFrames={d}>
          <SceneFade>
            <Scene />
          </SceneFade>
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
);
