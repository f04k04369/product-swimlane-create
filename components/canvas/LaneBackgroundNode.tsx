import type { NodeProps } from 'reactflow';

interface LaneBackgroundData {
  width: number;
  height: number;
}

export const LaneBackgroundNode = ({ data }: NodeProps<LaneBackgroundData>) => {
  const { width, height } = data;
  return (
    <div className="rounded-[40px] bg-slate-200/40" style={{ width, height }} aria-hidden />
  );
};
