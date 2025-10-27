import { toPng } from 'html-to-image';

const LANE_BOUNDS_SELECTORS = ['.react-flow__node', '.react-flow__edge', '.react-flow__connection', '[data-lane-header="true"]'];
const CONTENT_BOUNDS_SELECTORS = [
  '.react-flow__node-step',
  '[data-lane-inline-header="true"]',
  '.react-flow__edge-path',
  '.react-flow__edge',
  '.export-lane-header-clone',
];

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
      const [a, b, _c, d, e, f] = parts;
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

export const exportDiagramToPng = async (element: HTMLElement, filename = 'swimlane.png') => {
  const viewport = element.querySelector<HTMLElement>('.react-flow__viewport');
  const reactFlowElement = element.querySelector<HTMLElement>('.react-flow');

  const padding = 48;
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

  const laneBounds = collectDiagramBounds(element);
  const contentBounds = collectDiagramBounds(element, CONTENT_BOUNDS_SELECTORS) ?? laneBounds;
  const horizontalPadding = 200;
  const verticalPadding = 200;

  if (viewport && laneBounds && contentBounds) {
    const computedTransform = window.getComputedStyle(viewport).transform;
    const { translateX, translateY, scale } = parseViewportTransform(computedTransform);
    const contentWidth = Math.max(1, Math.ceil(contentBounds.width));
    const targetCenterX = (contentWidth + horizontalPadding * 2) / 2;
    const currentCenterX = contentBounds.minX + contentBounds.width / 2;
    const shiftX = targetCenterX - currentCenterX;
    const shiftY = verticalPadding - contentBounds.minY;
    const originalTransform = viewport.style.transform;
    const originalTransition = viewport.style.transition;

    viewport.style.transition = 'none';
    viewport.style.transform = `translate(${translateX + shiftX}px, ${translateY + shiftY}px) scale(${scale})`;

    cleanup.push(() => {
      viewport.style.transform = originalTransform;
      viewport.style.transition = originalTransition;
    });
  }

  if (contentBounds) {
    const contentWidth = Math.max(1, Math.ceil(contentBounds.width));
    const contentHeight = Math.max(1, Math.ceil(contentBounds.height));
    const exportWidth = contentWidth + horizontalPadding * 2;
    const exportHeight = contentHeight + verticalPadding * 2;

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

  let dataUrl: string;

  try {
    dataUrl = await toPng(element, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: true,
    });
  } finally {
    cleanup.forEach((restore) => {
      try {
        restore();
      } catch (error) {
        console.error('Failed to restore export styles', error);
      }
    });
  }

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
