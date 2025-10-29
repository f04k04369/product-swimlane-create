import { toPng, toSvg } from 'html-to-image';

const LANE_BOUNDS_SELECTORS = [
  '.react-flow__node',
  '.react-flow__edge',
  '.react-flow__connection',
  '[data-lane-header="true"]',
  '[data-phase-overlay="true"]',
];
const CONTENT_BOUNDS_SELECTORS = [
  '.react-flow__node-step',
  '[data-lane-inline-header="true"]',
  '.react-flow__edge-path',
  '.react-flow__edge',
  '.export-lane-header-clone',
  '.react-flow__node-phaseLabel',
  '[data-phase-overlay="true"]',
];

const DEFAULT_PIXEL_RATIO = 2;

export interface DiagramContentBounds {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export interface DiagramCaptureOptions {
  pixelRatio?: number;
  contentBoundsOverride?: DiagramContentBounds | null;
}

export interface DiagramCaptureResult<T = string> {
  data: T;
  exportWidth: number;
  exportHeight: number;
  pixelRatio: number;
  contentBounds: DiagramContentBounds | null;
  baseContentBounds: DiagramContentBounds | null;
}

export interface DiagramSelectionArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ViewportTransform {
  translateX: number;
  translateY: number;
  scale: number;
}

const parseViewportTransform = (value: string): ViewportTransform => {
  if (!value || value === 'none') {
    return { translateX: 0, translateY: 0, scale: 1 };
  }

  const matrixMatch = value.match(/matrix\(([^)]+)\)/);
  if (matrixMatch) {
    const parts = matrixMatch[1].split(',').map((part) => Number.parseFloat(part.trim()));
    if (parts.length >= 6 && parts.every((part) => Number.isFinite(part))) {
      const [a, b, , , e, f] = parts;
      const scale = Math.sqrt(a * a + b * b) || 1;
      return { translateX: e, translateY: f, scale };
    }
  }

  const translateMatch = value.match(/translate(?:3d)?\(([-0-9.]+)px[, ]+([-0-9.]+)px/i);
  const scaleMatch = value.match(/scale(?:3d)?\(([-0-9.]+)/i);

  const translateX = translateMatch ? Number.parseFloat(translateMatch[1]) : 0;
  const translateY = translateMatch ? Number.parseFloat(translateMatch[2]) : 0;
  const scale = scaleMatch ? Number.parseFloat(scaleMatch[1]) : 1;

  return {
    translateX: Number.isFinite(translateX) ? translateX : 0,
    translateY: Number.isFinite(translateY) ? translateY : 0,
    scale: Number.isFinite(scale) && scale !== 0 ? scale : 1,
  };
};

const collectDiagramBounds = (container: HTMLElement, selectors: string[] = LANE_BOUNDS_SELECTORS) => {
  const containerRect = container.getBoundingClientRect();
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let found = false;

  selectors.forEach((selector) => {
    container.querySelectorAll(selector).forEach((element) => {
      const rect = element.getBoundingClientRect();
      const left = rect.left - containerRect.left;
      const top = rect.top - containerRect.top;
      const right = left + rect.width;
      const bottom = top + rect.height;
      if (!Number.isFinite(left) || !Number.isFinite(top)) return;
      found = true;
      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
    });
  });

  if (!found) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

const waitForNextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });

const downloadPngDataUrl = (dataUrl: string, filename: string) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const loadImage = (dataUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('PNGプレビューの読み込みに失敗しました'));
    image.src = dataUrl;
  });

type DiagramRenderer<T> = (element: HTMLElement, options: { pixelRatio: number }) => Promise<T>;

const captureDiagram = async <T>(
  element: HTMLElement,
  renderer: DiagramRenderer<T>,
  { pixelRatio = DEFAULT_PIXEL_RATIO, contentBoundsOverride = null }: DiagramCaptureOptions = {}
): Promise<DiagramCaptureResult<T>> => {
  const viewport = element.querySelector<HTMLElement>('.react-flow__viewport');
  const reactFlowElement = element.querySelector<HTMLElement>('.react-flow');

  const cleanup: Array<() => void> = [];

  const overlayHeaders = Array.from(element.querySelectorAll<HTMLElement>('[data-lane-header="true"]'));
  const inlineHeaders = Array.from(element.querySelectorAll<HTMLElement>('[data-lane-inline-header="true"]'));
  const panelsToHide = Array.from(
    element.querySelectorAll<HTMLElement>(
      '.react-flow__controls, .react-flow__minimap, .react-flow__attribution, [data-testid="react-flow-minimap"]'
    )
  );

  const overlayRestorers = overlayHeaders.map((header) => {
    const previousVisibility = header.style.visibility;
    const previousOpacity = header.style.opacity;
    const previousDisplay = header.style.display;
    header.style.visibility = 'hidden';
    header.style.opacity = '0';
    header.style.display = 'none';
    return () => {
      header.style.visibility = previousVisibility;
      header.style.opacity = previousOpacity;
      header.style.display = previousDisplay;
    };
  });

  const inlineRestorers = inlineHeaders.map((header) => {
    const previousOpacity = header.style.opacity;
    const previousPointerEvents = header.style.pointerEvents;
    const previousVisibility = header.style.visibility;
    header.style.opacity = '1';
    header.style.pointerEvents = 'auto';
    header.style.visibility = 'visible';
    const text = header.querySelector<HTMLElement>('[data-inline-header-text]');
    const previousTextDisplay = text?.style.display;
    if (text) {
      text.style.display = 'inline';
    }
    return () => {
      header.style.opacity = previousOpacity;
      header.style.pointerEvents = previousPointerEvents;
      header.style.visibility = previousVisibility;
      if (text) {
        text.style.display = previousTextDisplay ?? '';
      }
    };
  });

  const panelRestorers = panelsToHide.map((panel) => {
    const previousDisplay = panel.style.display;
    panel.style.display = 'none';
    return () => {
      panel.style.display = previousDisplay;
    };
  });

  cleanup.push(() => {
    overlayRestorers.forEach((restore) => restore());
    inlineRestorers.forEach((restore) => restore());
    panelRestorers.forEach((restore) => restore());
  });

  const laneBoundsFromDom = collectDiagramBounds(element);
  const contentBoundsFromDom = collectDiagramBounds(element, CONTENT_BOUNDS_SELECTORS) ?? laneBoundsFromDom;
  const baseBounds = contentBoundsOverride ?? contentBoundsFromDom;
  const horizontalPadding = 48;
  const verticalPadding = 48;
  let exportWidth = element.clientWidth;
  let exportHeight = element.clientHeight;
  let translatedContentBounds: DiagramContentBounds | null = null;
  const phaseOverlays = Array.from(element.querySelectorAll<HTMLElement>('[data-phase-overlay="true"]'));

  if (viewport && baseBounds) {
    const computedTransform = window.getComputedStyle(viewport).transform;
    const { translateX, translateY, scale } = parseViewportTransform(computedTransform);
    const contentWidth = Math.max(1, Math.ceil(baseBounds.width));
    const targetCenterX = (contentWidth + horizontalPadding * 2) / 2;
    const currentCenterX = baseBounds.minX + baseBounds.width / 2;
    const shiftX = targetCenterX - currentCenterX;
    const shiftY = verticalPadding - baseBounds.minY;
    const originalTransform = viewport.style.transform;
    const originalTransition = viewport.style.transition;

    viewport.style.transition = 'none';
    viewport.style.transform = `translate(${translateX + shiftX}px, ${translateY + shiftY}px) scale(${scale})`;

    const phaseOverlayRestorers = phaseOverlays.map((overlay) => {
      const previousTransform = overlay.style.transform;
      const overlayComputed = window.getComputedStyle(overlay).transform;
      const { translateX: overlayX, translateY: overlayY, scale: overlayScale } = parseViewportTransform(overlayComputed);
      overlay.style.transform = `translate(${overlayX + shiftX}px, ${overlayY + shiftY}px) scale(${overlayScale})`;
      return () => {
        overlay.style.transform = previousTransform;
      };
    });

    cleanup.push(() => {
      viewport.style.transform = originalTransform;
      viewport.style.transition = originalTransition;
      phaseOverlayRestorers.forEach((restore) => restore());
    });

    translatedContentBounds = {
      minX: horizontalPadding,
      minY: verticalPadding,
      width: baseBounds.width,
      height: baseBounds.height,
    };
  }

  if (baseBounds) {
    const contentWidth = Math.max(1, Math.ceil(baseBounds.width));
    const contentHeight = Math.max(1, Math.ceil(baseBounds.height));
    exportWidth = contentWidth + horizontalPadding * 2;
    exportHeight = contentHeight + verticalPadding * 2;

    const originalContainerWidth = element.style.width;
    const originalContainerHeight = element.style.height;
    const originalContainerOverflow = element.style.overflow;
    element.style.width = `${exportWidth}px`;
    element.style.height = `${exportHeight}px`;
    element.style.overflow = 'hidden';

    cleanup.push(() => {
      element.style.width = originalContainerWidth;
      element.style.height = originalContainerHeight;
      element.style.overflow = originalContainerOverflow;
    });

    if (reactFlowElement) {
      const originalRfWidth = reactFlowElement.style.width;
      const originalRfHeight = reactFlowElement.style.height;
      reactFlowElement.style.width = `${exportWidth}px`;
      reactFlowElement.style.height = `${exportHeight}px`;
      cleanup.push(() => {
        reactFlowElement.style.width = originalRfWidth;
        reactFlowElement.style.height = originalRfHeight;
      });
    }
  }

  await waitForNextFrame();
  await waitForNextFrame();
  await wait(50);

  let data: T;

  try {
    data = await renderer(element, { pixelRatio });
  } finally {
    cleanup.forEach((restore) => {
      try {
        restore();
      } catch (error) {
        console.error('Failed to restore export styles', error);
      }
    });
  }

  if (exportWidth <= 0 || exportHeight <= 0) {
    const rect = element.getBoundingClientRect();
    exportWidth = Math.max(1, Math.round(rect.width));
    exportHeight = Math.max(1, Math.round(rect.height));
  }

  if (!translatedContentBounds && baseBounds) {
    translatedContentBounds = {
      minX: baseBounds.minX,
      minY: baseBounds.minY,
      width: baseBounds.width,
      height: baseBounds.height,
    };
  }

  return {
    data,
    exportWidth,
    exportHeight,
    pixelRatio,
    contentBounds: translatedContentBounds ?? baseBounds ?? null,
    baseContentBounds: baseBounds ? { ...baseBounds } : null,
  };
};

export const captureDiagramPreview = async (
  element: HTMLElement,
  options?: DiagramCaptureOptions
): Promise<DiagramCaptureResult<string>> =>
  captureDiagram(
    element,
    (target, { pixelRatio }) =>
      toPng(target, {
        pixelRatio,
        backgroundColor: '#ffffff',
        cacheBust: true,
      }),
    options
  );

export const cropCapturedDiagram = async (
  capture: DiagramCaptureResult<string>,
  selection: DiagramSelectionArea
): Promise<string> => {
  const clampedX = Math.max(0, Math.min(selection.x, capture.exportWidth));
  const clampedY = Math.max(0, Math.min(selection.y, capture.exportHeight));
  const maxWidth = capture.exportWidth - clampedX;
  const maxHeight = capture.exportHeight - clampedY;
  const width = Math.max(1, Math.min(selection.width, maxWidth));
  const height = Math.max(1, Math.min(selection.height, maxHeight));

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('有効な選択範囲を指定してください');
  }

  const image = await loadImage(capture.data);
  const canvas = document.createElement('canvas');
  const pixelWidth = Math.max(1, Math.round(width * capture.pixelRatio));
  const pixelHeight = Math.max(1, Math.round(height * capture.pixelRatio));
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('キャンバスコンテキストを取得できませんでした');
  }

  const sourceX = Math.round(clampedX * capture.pixelRatio);
  const sourceY = Math.round(clampedY * capture.pixelRatio);
  const sourceWidth = Math.round(width * capture.pixelRatio);
  const sourceHeight = Math.round(height * capture.pixelRatio);

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, pixelWidth, pixelHeight);

  return canvas.toDataURL('image/png');
};

export const exportCroppedDiagramToPng = async (
  capture: DiagramCaptureResult<string>,
  selection: DiagramSelectionArea,
  filename: string
) => {
  const croppedDataUrl = await cropCapturedDiagram(capture, selection);
  downloadPngDataUrl(croppedDataUrl, filename);
};

export const exportDiagramToPng = async (
  element: HTMLElement,
  filename = 'swimlane.png',
  options?: DiagramCaptureOptions
) => {
  const capture = await captureDiagram(
    element,
    (target, { pixelRatio }) =>
      toPng(target, {
        pixelRatio,
        backgroundColor: '#ffffff',
        cacheBust: true,
      }),
    {
      pixelRatio: options?.pixelRatio ?? DEFAULT_PIXEL_RATIO,
      contentBoundsOverride: options?.contentBoundsOverride ?? null,
    }
  );
  const bounds = capture.contentBounds ?? options?.contentBoundsOverride ?? null;
  if (!bounds) {
    downloadPngDataUrl(capture.data, filename);
    return;
  }

  const margin = 32;
  const selectionX = Math.max(0, bounds.minX - margin);
  const selectionY = Math.max(0, bounds.minY - margin);
  const maxWidth = capture.exportWidth - selectionX;
  const maxHeight = capture.exportHeight - selectionY;
  const selection: DiagramSelectionArea = {
    x: selectionX,
    y: selectionY,
    width: Math.min(maxWidth, bounds.width + margin * 2),
    height: Math.min(maxHeight, bounds.height + margin * 2),
  };

  await exportCroppedDiagramToPng(capture, selection, filename);
};

export const exportDiagramToSvg = async (
  element: HTMLElement,
  filename = 'swimlane.svg',
  options?: DiagramCaptureOptions
) => {
  const capture = await captureDiagram(
    element,
    (target) => toSvg(target, { cacheBust: true }),
    {
      pixelRatio: options?.pixelRatio ?? 1,
      contentBoundsOverride: options?.contentBoundsOverride ?? null,
    }
  );
  const svgContent = capture.data;
  const trimmed = svgContent.trim();
  const downloadName = filename.toLowerCase().endsWith('.svg') ? filename : `${filename}.svg`;
  let url = trimmed;
  let needsRevoke = false;

  if (!trimmed.startsWith('data:image/svg+xml')) {
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    url = URL.createObjectURL(blob);
    needsRevoke = true;
  }

  const link = document.createElement('a');
  link.href = url;
  link.download = downloadName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (needsRevoke) {
    URL.revokeObjectURL(url);
  }
};
