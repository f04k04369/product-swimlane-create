import type { CSSProperties } from 'react';
import type { NodeProps } from 'reactflow';

import { getContrastingTextColor, hexToRgb, mixRgb, rgbToCss, rgbaToCss } from '@/components/canvas/laneColors';

interface LaneHeaderNodeData {
  id: string;
  title: string;
  color: string;
  width: number;
  isSelected: boolean;
}

export const LaneHeaderNode = ({ data }: NodeProps<LaneHeaderNodeData>) => {
  const { id, title, color, width, isSelected } = data;
  const baseColor = hexToRgb(color);
  const headerBackground = mixRgb(baseColor, { r: 255, g: 255, b: 255 }, 0.72);
  const borderTint = mixRgb(baseColor, { r: 15, g: 23, b: 42 }, 0.15);
  const headerTextColor = getContrastingTextColor(headerBackground);

  const headerStyle: CSSProperties = {
    position: 'relative',
    backgroundColor: rgbToCss(headerBackground),
    borderBottom: `1px solid ${rgbaToCss(borderTint, 0.45)}`,
    zIndex: 1,
    transition: 'box-shadow 0.15s ease-out',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  };

  return (
    <div className="pointer-events-none" style={{ width }}>
      <div
        data-lane-header="true"
        data-lane-header-lane={id}
        className={`pointer-events-auto rounded-t-2xl px-4 py-3 text-sm font-semibold ${isSelected ? 'ring-2 ring-blue-500/70' : ''}`}
        style={headerStyle}
      >
        <span style={{ color: headerTextColor }}>{title}</span>
      </div>
    </div>
  );
};
