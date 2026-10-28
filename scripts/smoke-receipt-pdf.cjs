const {app} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createReceiptPdf} = require('../electron/receiptPdf.cjs');

async function main() {
  const stampPath = path.join(__dirname, '..', 'src', 'assets', 'ubion-receipt-stamp.png');
  const stamp = await fs.readFile(stampPath);
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 0; }
    body { font-family: "Malgun Gothic", sans-serif; }
    img { width: 21mm; height: 21mm; }
  </style></head><body><h1>수납확인서 PDF 저장 점검</h1><img src="data:image/png;base64,${stamp.toString('base64')}"></body></html>`;

  const pdf = await createReceiptPdf(html);
  if (pdf.length < 1000 || pdf.subarray(0, 4).toString() !== '%PDF') {
    throw new Error(`Invalid PDF output (${pdf.length} bytes)`);
  }

  process.stdout.write(`receipt-pdf smoke test passed (${pdf.length} bytes)\n`);
}

app.whenReady()
  .then(main)
  .then(() => app.quit())
  .catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    app.exit(1);
  });
