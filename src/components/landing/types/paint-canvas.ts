export type RGB = { r: number; g: number; b: number };

export type Bristle = {
  offset: number;
  width: number;
  alpha: number;
};

export type Point = { x: number; y: number; t: number };

export type Drip = {
  x: number;
  y: number;
  vy: number;
  width: number;
  alpha: number;
  color: RGB;
  life: number;
  maxLife: number;
};
