import type { CSSProperties } from 'react';
import type { NodeProps } from 'reactflow';

import { getContrastingTextColor, hexToRgb, mixRgb, rgbToCss, rgbaToCss } from '@/components/canvas/laneColors';
import type { DiagramOrientation } from '@/lib/diagram/types';

interface LaneHeaderNodeData {
  id: string;
  title: string;
  color: string;
  width: number;
  height: number;
  orientation: DiagramOrientation;
  isSelected: boolean;
}

export const LaneHeaderNode = ({ data }: NodeProps<LaneHeaderNodeData>) => {
  const { id, title, color, width, height, orientation, isSelected } = data;
  const baseColor = hexToRgb(color);
  const headerBackground = mixRgb(baseColor, { r: 255, g: 255, b: 255 }, 0.72);
  const borderTint = mixRgb(baseColor, { r: 15, g: 23, b: 42 }, 0.15);
  const headerTextColor = getContrastingTextColor(headerBackground);
  const isHorizontal = orientation === 'horizontal';

  const headerStyle: CSSProperties = {
    position: 'relative',
    backgroundColor: rgbToCss(headerBackground),
    zIndex: 1,
    transition: 'box-shadow 0.15s ease-out',
    borderTopLeftRadius: 16,
    borderTopRightRadius: isHorizontal ? 0 : 16,
    borderBottomLeftRadius: isHorizontal ? 16 : 0,
    borderBottomRightRadius: 0,
    borderBottom: isHorizontal ? undefined : `1px solid ${rgbaToCss(borderTint, 0.45)}`,
    borderRight: isHorizontal ? `1px solid ${rgbaToCss(borderTint, 0.45)}` : undefined,
    height: isHorizontal ? height : undefined,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const normalizeNewlines = (text: string): string => {
    return text.replace(/\\n/g, '\n').replace(/\\r\\n/g, '\r\n').replace(/\\r/g, '\r');
  };

  const renderTitle = () => {
    if (!isHorizontal) {
      return <span style={{ color: headerTextColor }}>{title}</span>;
    }

    const normalizedTitle = normalizeNewlines(title);

    return (
      <div
        style={{
          transform: 'rotate(-90deg)',
          whiteSpace: 'pre',
          color: headerTextColor,
          fontSize: '18px',
          fontWeight: 600,
          lineHeight: 1.4,
          textAlign: 'center',
        }}
      >
        {normalizedTitle}
      </div>
    );
  };

  return (
    <div className="pointer-events-none" style={{ width, height: isHorizontal ? height : undefined }}>
      <div
        data-lane-header="true"
        data-lane-header-lane={id}
        className={`pointer-events-auto px-4 py-3 ${isHorizontal ? '' : 'text-sm font-semibold'} ${isHorizontal ? 'rounded-l-2xl' : 'rounded-t-2xl'
          } ${isSelected ? 'ring-2 ring-blue-500/70' : ''}`}
        style={headerStyle}
      >
        {renderTitle()}
      </div>
    </div>
  );
};
