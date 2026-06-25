// Barcode scanning via jsQR (loaded from CDN in the page)
// Falls back to camera input if jsQR not available

let scannerStream = null;
let scannerAnimFrame = null;
let onScanCallback = null;

async function openBarcodeScanner(callback) {
  onScanCallback = callback;
  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    const video = document.getElementById('barcode-video');
    if (!video) { stopBarcodeScanner(); return; }
    video.srcObject = scannerStream;
    video.setAttribute('playsinline', true);
    await video.play();

    // Show modal
    const modal = document.getElementById('barcodeModal');
    if (modal) {
      if (window.bootstrap) {
        new bootstrap.Modal(modal).show();
      } else {
        modal.style.display = 'flex';
      }
    }

    scanFrame(video);
  } catch (err) {
    console.warn('Camera not available:', err);
    // Fallback: prompt barcode via text input
    const code = prompt('Enter barcode manually:');
    if (code && onScanCallback) onScanCallback(code.trim());
  }
}

function scanFrame(video) {
  if (!video.videoWidth) {
    scannerAnimFrame = requestAnimationFrame(() => scanFrame(video));
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Use jsQR if available
  if (window.jsQR) {
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
    if (code && code.data) {
      stopBarcodeScanner();
      if (onScanCallback) onScanCallback(code.data);
      return;
    }
  }

  scannerAnimFrame = requestAnimationFrame(() => scanFrame(video));
}

function stopBarcodeScanner() {
  if (scannerAnimFrame) cancelAnimationFrame(scannerAnimFrame);
  if (scannerStream) {
    scannerStream.getTracks().forEach(t => t.stop());
    scannerStream = null;
  }
  const video = document.getElementById('barcode-video');
  if (video) { video.srcObject = null; }

  // Hide modal
  const modal = document.getElementById('barcodeModal');
  if (modal && window.bootstrap) {
    const m = bootstrap.Modal.getInstance(modal);
    if (m) m.hide();
  }
}

window.BarcodeScanner = { open: openBarcodeScanner, stop: stopBarcodeScanner };
