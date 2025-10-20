import type { NodeProps } from 'reactflow';

interface LaneNodeData {
  title: string;
  color: string;
  height: number;
  width: number;
}

const hexToRgb = (hex: string | undefined) => {
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

const mixRgb = (
  base: { r: number; g: number; b: number },
  mix: { r: number; g: number; b: number },
  ratio: number
) => {
  const weight = Math.min(1, Math.max(0, ratio));
  const mixComponent = (component: 'r' | 'g' | 'b') =>
    Math.round(base[component] * (1 - weight) + mix[component] * weight);
  return {
    r: mixComponent('r'),
    g: mixComponent('g'),
    b: mixComponent('b'),
  };
};

const rgbToCss = ({ r, g, b }: { r: number; g: number; b: number }) => `rgb(${r}, ${g}, ${b})`;

const rgbaToCss = ({ r, g, b }: { r: number; g: number; b: number }, alpha: number) =>
  `rgba(${r}, ${g}, ${b}, ${alpha})`;

const getContrastingTextColor = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const toLinear = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.6 ? '#1f2937' : '#ffffff';
};

export const LaneNode = ({ data }: NodeProps<LaneNodeData>) => {
  const { title, color, height, width } = data;
  const baseColor = hexToRgb(color);
  const headerBackground = mixRgb(baseColor, { r: 255, g: 255, b: 255 }, 0.72);
  const borderTint = mixRgb(baseColor, { r: 15, g: 23, b: 42 }, 0.15);
  const headerTextColor = getContrastingTextColor(headerBackground);

  return (
    <div
      style={{
        borderColor: `${color}40`,
        height,
        width,
      }}
      className="pointer-events-none flex h-full w-full flex-col rounded-2xl border border-dashed border-slate-200 bg-white/70 shadow-inner"
    >
      <div
        className="px-4 py-3"
        style={{
          backgroundColor: rgbToCss(headerBackground),
          borderBottom: `1px solid ${rgbaToCss(borderTint, 0.45)}`,
        }}
      >
        <span className="text-sm font-semibold" style={{ color: headerTextColor }}>
          {title}
        </span>
      </div>
      <div className="flex-1" />
    </div>
  );
};
