export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export const hexToRgb = (hex: string | undefined): RgbColor => {
  if (!hex) return { r: 148, g: 163, b: 184 };
  let normalized = hex.replace('#', '').trim();
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((char) => char + char)
      .join('');
  }
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const valid = (value: number) => (Number.isFinite(value) ? value : 148);
  return { r: valid(r), g: valid(g), b: valid(b) };
};

export const mixRgb = (base: RgbColor, mix: RgbColor, ratio: number): RgbColor => {
  const weight = Math.min(1, Math.max(0, ratio));
  const mixComponent = (component: keyof RgbColor) => Math.round(base[component] * (1 - weight) + mix[component] * weight);
  return {
    r: mixComponent('r'),
    g: mixComponent('g'),
    b: mixComponent('b'),
  };
};

export const rgbToCss = ({ r, g, b }: RgbColor) => `rgb(${r}, ${g}, ${b})`;

export const rgbaToCss = ({ r, g, b }: RgbColor, alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

export const getContrastingTextColor = ({ r, g, b }: RgbColor) => {
  const toLinear = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.6 ? '#1f2937' : '#ffffff';
};
