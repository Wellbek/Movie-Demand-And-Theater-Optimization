import React from "react";
import { Composition, registerRoot } from "remotion";
import { MainVideo, TOTAL_FRAMES } from "./MainVideo";
import { FPS, H, W } from "./constants";

export const RemotionRoot: React.FC = () => (
  <Composition id="MainVideo" component={MainVideo} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
);

registerRoot(RemotionRoot);
