export interface QRSpan {
  isDark: boolean;
  count: number;
}

export interface QRMatrixResult {
  rows: QRSpan[][];
  matrixSize: number;
  moduleSize: number;
  totalDimension: number;
}

/**
 * Pure cryptographic Galois Field / Reed-Solomon QR bitmatrix generator.
 * Free of DOM, Canvas, or native rendering dependencies.
 */
export function generateQrSpans(
  value: string,
  targetSize: number = 220,
  margin: number = 2
): QRMatrixResult {
  if (!value) {
    return { rows: [], matrixSize: 0, moduleSize: 0, totalDimension: targetSize };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const QRCodeCore = require('qrcode/lib/core/qrcode');
    const qr = QRCodeCore.create(value, { errorCorrectionLevel: 'M' });
    const matrixSize = qr.modules.size;
    const totalModules = matrixSize + margin * 2;
    const moduleSize = Math.max(1, Math.floor(targetSize / totalModules));
    const totalDimension = moduleSize * totalModules;

    const rows: QRSpan[][] = [];

    for (let r = 0; r < matrixSize; r++) {
      const rowSpans: QRSpan[] = [];
      let currentDark = qr.modules.get(r, 0) === 1;
      let count = 1;

      for (let c = 1; c < matrixSize; c++) {
        const isDark = qr.modules.get(r, c) === 1;
        if (isDark === currentDark) {
          count++;
        } else {
          rowSpans.push({ isDark: currentDark, count });
          currentDark = isDark;
          count = 1;
        }
      }
      rowSpans.push({ isDark: currentDark, count });
      rows.push(rowSpans);
    }

    return {
      rows,
      matrixSize,
      moduleSize,
      totalDimension,
    };
  } catch (err) {
    console.warn('[generateQrSpans] Failed to generate QR matrix:', err);
    return { rows: [], matrixSize: 0, moduleSize: 0, totalDimension: targetSize };
  }
}
