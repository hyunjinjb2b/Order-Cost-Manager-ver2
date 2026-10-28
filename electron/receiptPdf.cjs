const {BrowserWindow} = require('electron');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

async function waitForPrintableAssets(printWindow) {
  await printWindow.webContents.executeJavaScript(`
    Promise.all([
      document.fonts?.ready,
      ...Array.from(document.images).map((image) => image.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            image.addEventListener('load', resolve, {once: true});
            image.addEventListener('error', resolve, {once: true});
          }))
    ])
  `);
}

async function createReceiptPdf(html) {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'order-cost-receipt-'));
  const tempHtmlPath = path.join(tempDirectory, 'receipt.html');

  try {
    // Receipts contain an inline stamp image. A data URL can exceed Chromium's
    // URL-size limit even though iframe.srcDoc renders the same HTML in preview.
    await fs.writeFile(tempHtmlPath, String(html || ''), 'utf8');
    await printWindow.loadFile(tempHtmlPath);
    await waitForPrintableAssets(printWindow);

    return await printWindow.webContents.printToPDF({
      pageSize: 'A4',
      landscape: true,
      printBackground: true,
      margins: {top: 0, bottom: 0, left: 0, right: 0},
    });
  } finally {
    printWindow.destroy();
    await fs.unlink(tempHtmlPath).catch(() => {});
    await fs.rmdir(tempDirectory).catch(() => {});
  }
}

module.exports = {createReceiptPdf};
