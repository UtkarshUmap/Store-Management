// ============================================================================
// NEW FILE: web/src/components/BarcodeScanner.jsx
//
// A camera-based barcode scanner. Opens the phone's rear camera, decodes
// EAN-13/UPC barcodes, and calls onDetected(code) with the number.
//
// Requires the html5-qrcode package:
//   cd web && npm install html5-qrcode
//
// IMPORTANT: browsers only allow camera access over HTTPS (or localhost).
// With ngrok you get HTTPS automatically, so this works on the shopkeeper's
// phone through the ngrok URL.
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function BarcodeScanner({ onDetected, onClose }) {
  const containerId = 'barcode-reader';
  const scannerRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode(containerId, { verbose: false });
    scannerRef.current = scanner;

    const config = {
      fps: 10,
      qrbox: { width: 260, height: 160 }, // wide box suits 1D barcodes
      // Let the library decode common retail barcode symbologies + QR
      formatsToSupport: undefined, // undefined = all supported formats
      aspectRatio: 1.4,
    };

    Html5Qrcode.getCameras()
      .then((cameras) => {
        if (cancelled || !cameras || cameras.length === 0) {
          setError('No camera found on this device.');
          return;
        }
        // Prefer the rear camera on phones
        const rear =
          cameras.find((c) => /back|rear|environment/i.test(c.label)) || cameras[cameras.length - 1];
        return scanner.start(
          rear.id,
          config,
          (decodedText) => {
            // Got a barcode — hand it up and stop.
            onDetected(decodedText);
          },
          () => {
            /* per-frame decode failures are normal; ignore */
          }
        );
      })
      .catch((e) => {
        setError(
          e?.message?.includes('Permission')
            ? 'Camera permission denied. Allow camera access and retry.'
            : 'Could not start the camera. Make sure you are on HTTPS.'
        );
      });

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s && s.isScanning) {
        s.stop().then(() => s.clear()).catch(() => {});
      }
    };
  }, [onDetected]);

  return (
    <div className="scanner-overlay">
      <div className="scanner-modal">
        <div className="scanner-head">
          <h3>Scan a barcode</h3>
          <button type="button" className="btn-v2" onClick={onClose}>
            Close
          </button>
        </div>
        <div id={containerId} className="scanner-viewport" />
        {error ? (
          <p className="scanner-error">{error}</p>
        ) : (
          <p className="scanner-hint">Point the rear camera at the product barcode.</p>
        )}
      </div>
    </div>
  );
}
