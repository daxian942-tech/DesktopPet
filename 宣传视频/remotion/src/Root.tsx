import React from 'react';
import { Composition, Audio, staticFile } from 'remotion';
import { MainVideo } from './MainVideo';
import { DURATION, FPS } from './data';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="DesktopPetPromo"
    component={MainVideo}
    durationInFrames={DURATION}
    fps={FPS}
    width={1080}
    height={1920}
    defaultProps={{}}
  />
);
