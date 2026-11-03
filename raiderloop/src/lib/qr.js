/**
 * QR codes, drawn by Flyer itself (qrcode-generator is pure JS; the
 * picture is plain SVG squares), so any camera can scan them.
 */
import qrcode from 'qrcode-generator';

/** A 2D array of booleans (true = dark module). */
export function qrMatrix(text, level = 'M') {
  const q = qrcode(0, level);
  q.addData(String(text || ''));
  q.make();
  const n = q.getModuleCount();
  const rows = [];
  for (let r = 0; r < n; r++) {
    const row = [];
    for (let c = 0; c < n; c++) row.push(q.isDark(r, c));
    rows.push(row);
  }
  return rows;
}

/** Merges dark modules into horizontal runs, so the SVG stays small. */
export function qrRuns(matrix) {
  const runs = [];
  matrix.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) { x++; continue; }
      let w = 1;
      while (x + w < row.length && row[x + w]) w++;
      runs.push({ x, y, w });
      x += w;
    }
  });
  return runs;
}
