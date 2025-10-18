// Utility functions to capture screenshots from canvas and SVG

/**
 * Creates a camera flash effect overlay
 */
export function showScreenshotFlash() {
  const flash = document.createElement('div');
  flash.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: white;
    z-index: 999999;
    pointer-events: none;
    animation: cameraFlash 0.4s ease-out;
  `;
  
  // Add keyframes if not already present
  if (!document.getElementById('screenshot-flash-keyframes')) {
    const style = document.createElement('style');
    style.id = 'screenshot-flash-keyframes';
    style.textContent = `
      @keyframes cameraFlash {
        0% { opacity: 0.8; }
        100% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(flash);
  
  // Remove after animation
  setTimeout(() => {
    document.body.removeChild(flash);
  }, 400);
}

function downloadDataUrl(dataUrl, filename = 'screenshot.png') {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function timestampFilename(prefix = 'screenshot', ext = 'png') {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${ts}.${ext}`;
}

export function downloadCanvas(canvas, filename, onSuccess) {
  if (!canvas) return;
  try {
    showScreenshotFlash();
    const dataUrl = canvas.toDataURL('image/png');
    downloadDataUrl(dataUrl, filename || timestampFilename('canvas'));
    if (onSuccess) onSuccess(filename || timestampFilename('canvas'));
  } catch (e) {
    console.error('Failed to capture canvas screenshot', e);
  }
}

// Serialize an SVG element to a data URL
function svgElementToDataUrl(svgEl) {
  const clone = svgEl.cloneNode(true);
  // Ensure width/height are set to avoid 0x0 exports
  if (!clone.getAttribute('width') || !clone.getAttribute('height')) {
    const bbox = svgEl.getBoundingClientRect();
    clone.setAttribute('width', String(Math.ceil(bbox.width || 800)));
    clone.setAttribute('height', String(Math.ceil(bbox.height || 600)));
    // Keep viewBox if present
    if (svgEl.getAttribute('viewBox')) {
      clone.setAttribute('viewBox', svgEl.getAttribute('viewBox'));
    }
  }

  // Inline styles: copy computed styles for top-level only (good enough for our simple charts)
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const encoded = encodeURIComponent(svgString)
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

export async function downloadSvgAsPng(svgEl, filename, background = '#0a1929', onSuccess) {
  if (!svgEl) return;
  showScreenshotFlash();
  const dataUrl = svgElementToDataUrl(svgEl);

  const img = new Image();
  // Allow rendering without taint; same-origin assumed
  img.crossOrigin = 'anonymous';

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = dataUrl;
  }).catch((e) => {
    console.error('Failed to load SVG image for export', e);
  });

  // Determine size from SVG bbox or attributes
  const bbox = svgEl.getBoundingClientRect();
  const width = Math.ceil(bbox.width || parseInt(svgEl.getAttribute('width') || '900', 10));
  const height = Math.ceil(bbox.height || parseInt(svgEl.getAttribute('height') || '600', 10));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  // Background
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);
  const pngUrl = canvas.toDataURL('image/png');
  downloadDataUrl(pngUrl, filename || timestampFilename('chart'));
  if (onSuccess) onSuccess(filename || timestampFilename('chart'));
}
