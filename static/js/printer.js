// ESC/POS Thermal Printer support
// Supports Bluetooth (Web Bluetooth API) and USB (Web Serial API)

const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;
const HT  = 0x09;

const CMD = {
  INIT:          [ESC, 0x40],
  ALIGN_LEFT:    [ESC, 0x61, 0x00],
  ALIGN_CENTER:  [ESC, 0x61, 0x01],
  ALIGN_RIGHT:   [ESC, 0x61, 0x02],
  BOLD_ON:       [ESC, 0x45, 0x01],
  BOLD_OFF:      [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  NORMAL_SIZE:   [ESC, 0x21, 0x00],
  CUT:           [GS,  0x56, 0x00],
  FEED_LINES:    n  => [ESC, 0x64, n],
};

let btDevice = null;
let btChar   = null;
let serialPort = null;
let serialWriter = null;

// ── Bluetooth ──────────────────────────────────────────────────────────────

async function connectBluetooth() {
  try {
    btDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb',
                         '0000ff00-0000-1000-8000-00805f9b34fb',
                         '0000ffe0-0000-1000-8000-00805f9b34fb'],
    });
    const server = await btDevice.gatt.connect();
    // Try common printer service UUIDs
    const serviceUUIDs = [
      '000018f0-0000-1000-8000-00805f9b34fb',
      '0000ff00-0000-1000-8000-00805f9b34fb',
      '0000ffe0-0000-1000-8000-00805f9b34fb',
    ];
    for (const uuid of serviceUUIDs) {
      try {
        const svc = await server.getPrimaryService(uuid);
        const chars = await svc.getCharacteristics();
        for (const c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            btChar = c;
            return { success: true, name: btDevice.name };
          }
        }
      } catch (_) {}
    }
    throw new Error('No writable characteristic found');
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function disconnectBluetooth() {
  if (btDevice && btDevice.gatt.connected) {
    btDevice.gatt.disconnect();
    btDevice = null;
    btChar = null;
  }
}

// ── USB/Serial ─────────────────────────────────────────────────────────────

async function connectUSB() {
  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 9600 });
    serialWriter = serialPort.writable.getWriter();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Send raw bytes ─────────────────────────────────────────────────────────

async function sendBytes(bytes) {
  const data = new Uint8Array(bytes.flat());
  if (btChar) {
    // BT max write ~512 bytes, chunk if larger
    const CHUNK = 512;
    for (let i = 0; i < data.length; i += CHUNK) {
      await btChar.writeValueWithoutResponse(data.slice(i, i + CHUNK));
    }
  } else if (serialWriter) {
    await serialWriter.write(data);
  } else {
    throw new Error('No printer connected');
  }
}

// ── Receipt builder ────────────────────────────────────────────────────────

function textToBytes(text) {
  return Array.from(new TextEncoder().encode(text));
}

function pad(str, len, right = false) {
  str = String(str);
  if (str.length >= len) return str.substring(0, len);
  const spaces = ' '.repeat(len - str.length);
  return right ? spaces + str : str + spaces;
}

function buildReceiptBytes(sale, paperWidth) {
  const cols = paperWidth === '58' ? 32 : 48;
  const bytes = [];

  const line = s => bytes.push(...CMD.ALIGN_LEFT, ...textToBytes(s + '\n'));
  const center = s => bytes.push(...CMD.ALIGN_CENTER, ...textToBytes(s + '\n'));
  const divider = () => line('-'.repeat(cols));

  bytes.push(...CMD.INIT);

  // Header
  bytes.push(...CMD.ALIGN_CENTER, ...CMD.BOLD_ON, ...CMD.DOUBLE_HEIGHT);
  bytes.push(...textToBytes(sale.store.name + '\n'));
  bytes.push(...CMD.NORMAL_SIZE, ...CMD.BOLD_OFF);
  center(sale.store.address);
  center('Ph: ' + sale.store.phone);
  divider();

  // Invoice info
  bytes.push(...CMD.ALIGN_LEFT);
  line('Invoice : ' + sale.invoice_no);
  line('Date    : ' + sale.sale_date);
  line('Customer: ' + sale.customer);
  divider();

  // Column headers
  const nameW = cols - 18;
  bytes.push(...CMD.BOLD_ON);
  line(pad('Item', nameW) + pad('Qty', 5, true) + pad('Rate', 7, true) + pad('Amt', 6, true));
  bytes.push(...CMD.BOLD_OFF);
  divider();

  // Items
  for (const item of sale.items) {
    const name = pad(item.name, nameW);
    const qty  = pad(item.quantity, 5, true);
    const rate = pad(parseFloat(item.unit_price).toFixed(0), 7, true);
    const amt  = pad(parseFloat(item.total).toFixed(0), 6, true);
    line(name + qty + rate + amt);
  }
  divider();

  // Totals
  const rCol = cols - 14;
  bytes.push(...CMD.ALIGN_LEFT);
  line(pad('Subtotal:', rCol) + pad(parseFloat(sale.subtotal).toFixed(2), 14, true));
  if (parseFloat(sale.discount) > 0) {
    line(pad('Discount:', rCol) + pad(parseFloat(sale.discount).toFixed(2), 14, true));
  }
  line(pad(`GST (${sale.gst_percent}%):`, rCol) + pad(parseFloat(sale.gst_amount).toFixed(2), 14, true));
  divider();
  bytes.push(...CMD.BOLD_ON, ...CMD.DOUBLE_HEIGHT);
  line(pad('NET AMOUNT:', rCol) + pad(parseFloat(sale.total).toFixed(2), 14, true));
  bytes.push(...CMD.NORMAL_SIZE, ...CMD.BOLD_OFF);
  divider();

  // Payment
  line('Payment : ' + sale.payment_mode);
  if (sale.change_amount && parseFloat(sale.change_amount) > 0) {
    line('Change  : ₹' + parseFloat(sale.change_amount).toFixed(2));
  }
  divider();

  // Footer
  center(sale.store.footer || 'Thank You! Visit Again Soon');
  bytes.push(...CMD.FEED_LINES(4));
  bytes.push(...CMD.CUT);

  return bytes;
}

// ── Public API ─────────────────────────────────────────────────────────────

async function printReceipt(sale, paperWidth = '80') {
  const bytes = buildReceiptBytes(sale, paperWidth);
  await sendBytes(bytes);
  return { success: true };
}

async function printTestPage(paperWidth = '80') {
  const testSale = {
    invoice_no: 'TEST-0001',
    sale_date: new Date().toLocaleString('en-IN'),
    customer: 'Test Customer',
    items: [{ name: 'Sample Item', quantity: 1, unit_price: '100.00', total: '100.00' }],
    subtotal: '100.00',
    discount: '0.00',
    gst_percent: '5',
    gst_amount: '5.00',
    total: '105.00',
    payment_mode: 'CASH',
    store: {
      name: 'JAY NARAYAN BAKERY',
      address: 'Main Market, Rajkot',
      phone: '+91 7984178801',
      footer: 'Thank You! Visit Again Soon',
    },
  };
  return printReceipt(testSale, paperWidth);
}

// Generate printable HTML for print preview / PDF
function generateReceiptHTML(sale, paperWidth = '80') {
  const widthPx = paperWidth === '58' ? '220px' : '302px';
  const items = sale.items.map(item => `
    <tr>
      <td>${item.name}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">₹${parseFloat(item.unit_price).toFixed(2)}</td>
      <td style="text-align:right">₹${parseFloat(item.total).toFixed(2)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', monospace; font-size: 11px; width: ${widthPx}; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .big { font-size: 14px; font-weight: bold; }
  hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 1px 2px; }
  th { font-weight: bold; border-bottom: 1px solid #000; }
  .total-row td { font-weight: bold; font-size: 13px; border-top: 1px dashed #000; }
  .footer { margin-top: 8px; text-align: center; }
</style>
</head>
<body>
  <div class="center big">${sale.store.name}</div>
  <div class="center">${sale.store.address}</div>
  <div class="center">Ph: ${sale.store.phone}</div>
  <hr>
  <div>Invoice: <b>${sale.invoice_no}</b></div>
  <div>Date: ${sale.sale_date}</div>
  <div>Customer: ${sale.customer}</div>
  <hr>
  <table>
    <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amt</th></tr></thead>
    <tbody>${items}</tbody>
  </table>
  <hr>
  <table>
    <tr><td>Subtotal</td><td></td><td></td><td style="text-align:right">₹${parseFloat(sale.subtotal).toFixed(2)}</td></tr>
    ${parseFloat(sale.discount)>0 ? `<tr><td>Discount</td><td></td><td></td><td style="text-align:right">-₹${parseFloat(sale.discount).toFixed(2)}</td></tr>` : ''}
    <tr><td>GST (${sale.gst_percent}%)</td><td></td><td></td><td style="text-align:right">₹${parseFloat(sale.gst_amount).toFixed(2)}</td></tr>
    <tr class="total-row"><td colspan="3">NET AMOUNT</td><td style="text-align:right">₹${parseFloat(sale.total).toFixed(2)}</td></tr>
  </table>
  <hr>
  <div>Payment: <b>${sale.payment_mode}</b></div>
  ${sale.change_amount && parseFloat(sale.change_amount)>0 ? `<div>Change: ₹${parseFloat(sale.change_amount).toFixed(2)}</div>` : ''}
  <div class="footer">${sale.store.footer || 'Thank You! Visit Again Soon'}</div>
</body>
</html>`;
}

function printReceiptBrowser(sale, paperWidth = '80') {
  const html = generateReceiptHTML(sale, paperWidth);
  const w = window.open('', '_blank', 'width=400,height=600');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 500);
}

async function shareOnWhatsApp(sale) {
  const lines = [
    `*${sale.store.name}*`,
    sale.store.address,
    `Ph: ${sale.store.phone}`,
    '',
    `Invoice: ${sale.invoice_no}`,
    `Date: ${sale.sale_date}`,
    `Customer: ${sale.customer}`,
    '',
    ...sale.items.map(i => `${i.name} x${i.quantity} = ₹${parseFloat(i.total).toFixed(2)}`),
    '',
    `Subtotal: ₹${parseFloat(sale.subtotal).toFixed(2)}`,
    parseFloat(sale.discount) > 0 ? `Discount: -₹${parseFloat(sale.discount).toFixed(2)}` : null,
    `GST: ₹${parseFloat(sale.gst_amount).toFixed(2)}`,
    `*Total: ₹${parseFloat(sale.total).toFixed(2)}*`,
    '',
    `Payment: ${sale.payment_mode}`,
    '',
    sale.store.footer || 'Thank You! Visit Again Soon',
  ].filter(l => l !== null).join('\n');

  const phone = sale.customer_phone ? sale.customer_phone.replace(/\D/g, '') : '';
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines)}`;
  window.open(url, '_blank');
}

window.Printer = {
  connectBluetooth,
  disconnectBluetooth,
  connectUSB,
  printReceipt,
  printTestPage,
  generateReceiptHTML,
  printReceiptBrowser,
  shareOnWhatsApp,
  get isConnected() { return !!(btChar || serialWriter); },
};
