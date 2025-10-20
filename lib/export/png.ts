import { toPng } from 'html-to-image';

export const exportDiagramToPng = async (element: HTMLElement, filename = 'swimlane.png') => {
  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    cacheBust: true,
    style: {
      padding: '24px',
    },
  });

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
