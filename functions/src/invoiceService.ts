import * as admin from 'firebase-admin';

import { createTransporter, isEmailConfigured } from './emailservice';

const SUPPLIER = {
  tin:     'YOUR_TIN_NUMBER',               
  name:    'IronHide Fitness (Pvt) Ltd',
  address: '114C Negombo Rd, Wattala, Sri Lanka',
  phone:   '+94 70 322 2211',
  branchCode: 'HQ01',                       
};

const VAT_RATE = 0.18;


export interface InvoiceInput {
  uid:            string;
  memberEmail:    string;
  memberName:     string;
  memberTIN?:     string;
  memberPhone?:   string;
  memberAddress?: string;
  plan:           string;         
  amount:         number;          
  paymentMethod:  string;          
  stripeSessionId?: string;
  deliveryDate?:  Date;            
  placeOfSupply?: string;          
}

export interface InvoiceData extends InvoiceInput {
  invoiceSerialNumber: string;
  invoiceDate:         string;     
  deliveryDateFmt:     string;     
  vatAmount:           number;
  totalAmount:         number;
  totalAmountWords:    string;
  createdAt:           admin.firestore.FieldValue;
  status:              'issued';
}


export async function generateAndSendInvoice(input: InvoiceInput): Promise<string> {
  const db = admin.firestore();

  // 1. Generate compliant serial number
  const serialNumber = await generateInvoiceSerialNumber(db, SUPPLIER.branchCode);

  // 2. Calculate VAT figures (amounts must be whole rupees, no cents)
  const vatAmount   = Math.round(input.amount * VAT_RATE);
  const totalAmount = input.amount + vatAmount;

  // 3. Format dates MM/DD/YYYY as required by gazette spec §4.1(b,d)
  const now         = new Date();
  const delivery    = input.deliveryDate ?? now;
  const invoiceDateFmt  = formatDate(now);
  const deliveryDateFmt = formatDate(delivery);

  // 4. Total in words (gazette spec §4.1(g)(iv))
  const totalAmountWords = numberToWords(totalAmount) + ' Sri Lankan Rupees Only';

  const invoiceData: InvoiceData = {
    ...input,
    invoiceSerialNumber: serialNumber,
    invoiceDate:         invoiceDateFmt,
    deliveryDateFmt,
    vatAmount,
    totalAmount,
    totalAmountWords,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'issued',
  };

  // 5. Write to Firestore (two locations for flexibility)
  const memberInvoiceRef = db
    .collection('members').doc(input.uid)
    .collection('invoices').doc();

  const globalInvoiceRef = db
    .collection('invoices').doc(memberInvoiceRef.id);

  const batch = db.batch();
  batch.set(memberInvoiceRef, invoiceData);
  batch.set(globalInvoiceRef, { ...invoiceData, memberId: input.uid });
  await batch.commit();

  console.log(`[Invoice] Stored invoice ${serialNumber} for member ${input.uid}`);

  // 6. Send email with HTML invoice
  await sendInvoiceEmail(invoiceData);

  return serialNumber;
}

// Invoice serial number generator 

async function generateInvoiceSerialNumber(
  db: admin.firestore.Firestore,
  branchCode: string,
): Promise<string> {
  const now    = new Date();
  const yy     = String(now.getFullYear()).slice(-2);                   
  const mmm    = now.toLocaleString('en-US', { month: 'short' })
                    .toUpperCase();                                     
  const prefix = `${yy}${mmm}_${branchCode}`;                         

  const counterRef = db
    .collection('invoiceMeta')
    .doc('serialCounters')
    .collection('counters')
    .doc(prefix);

  // Atomic increment to avoid duplicate serial numbers under concurrent requests
  const newCount = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const current: number = snap.exists ? (snap.data()!.count as number) : 0;
    const next = current + 1;
    tx.set(counterRef, { count: next, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return next;
  });

  // Full serial: 26JUN_HQ01_1  (max 40 chars, no spaces per spec)
  return `${prefix}_${newCount}`;
}

//  Date formatter: MM/DD/YYYY 
function formatDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

//  Number → words (for totals in words field) 
function numberToWords(n: number): string {
  if (n === 0) return 'Zero';
  const ones = ['', 'One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
                 'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
                 'Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

  function helper(num: number): string {
    if (num < 20)  return ones[num];
    if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? ' ' + ones[num%10] : '');
    if (num < 1000) return ones[Math.floor(num/100)] + ' Hundred' + (num%100 ? ' ' + helper(num%100) : '');
    if (num < 100000) return helper(Math.floor(num/1000)) + ' Thousand' + (num%1000 ? ' ' + helper(num%1000) : '');
    if (num < 10000000) return helper(Math.floor(num/100000)) + ' Lakh' + (num%100000 ? ' ' + helper(num%100000) : '');
    return helper(Math.floor(num/10000000)) + ' Crore' + (num%10000000 ? ' ' + helper(num%10000000) : '');
  }
  return helper(Math.round(n));
}

//  Email sender 

async function sendInvoiceEmail(inv: InvoiceData): Promise<void> {
   console.log('[Invoice] isEmailConfigured:', isEmailConfigured());
  console.log('[Invoice] GMAIL_USER:', process.env.GMAIL_USER);
  console.log('[Invoice] memberEmail:', inv.memberEmail);
  if (!isEmailConfigured()) {
    console.warn('[Invoice] Gmail not configured — skipping email');
    return;
  }

  const transporter = createTransporter();
  const html = buildInvoiceHtml(inv);

  try {
    await transporter.verify();
    await transporter.sendMail({
      from: `IronHide Fitness <${process.env.GMAIL_USER || ''}>`,
      to: inv.memberEmail,
      subject: `Tax Invoice ${inv.invoiceSerialNumber} — IronHide Fitness`,
      html,
    });

    console.log(`[Invoice] Email sent to ${inv.memberEmail} for invoice ${inv.invoiceSerialNumber}`);
  } catch (err) {
    console.error('[Invoice] Failed to send invoice email:', err);
    throw err;
  }
}

//  HTML invoice builder
// Layout matches the gazette Annexure I sample (§8)

function buildInvoiceHtml(inv: InvoiceData): string {
  const fmt = (n: number) =>
    'LKR ' + n.toLocaleString('en-LK', { maximumFractionDigits: 0 });

  const paymentLabel: Record<string, string> = {
    card:          'Credit/Debit Card',
    bank_transfer: 'Bank Transfer',
    cash:          'Cash',
    mobile:        'Mobile Payment',
    online:        'Online Payment',
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tax Invoice ${inv.invoiceSerialNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background: #f5f5f5;
      color: #222;
      font-size: 13px;
    }
    .wrapper { max-width: 700px; margin: 24px auto; background: #fff; border: 1px solid #ccc; }

    /* ── Header ── */
    .title-bar {
      text-align: center;
      padding: 14px 0 10px;
      border-bottom: 2px solid #222;
    }
    .title-bar h1 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #cc0000;
    }
    .title-bar h2 {
      font-size: 13px;
      font-weight: 400;
      letter-spacing: 1px;
      color: #555;
      margin-top: 2px;
    }

    /* ── Invoice meta row ── */
    .meta-row {
      display: flex;
      border-bottom: 1px solid #ccc;
    }
    .meta-cell {
      flex: 1;
      padding: 8px 12px;
      font-size: 12px;
    }
    .meta-cell:first-child { border-right: 1px solid #ccc; }
    .meta-cell .label { color: #666; font-size: 11px; margin-bottom: 2px; }
    .meta-cell .value { font-weight: 600; }

    /* ── Supplier / Purchaser block ── */
    .parties {
      display: flex;
      border-bottom: 1px solid #ccc;
    }
    .party {
      flex: 1;
      padding: 10px 12px;
      font-size: 12px;
      line-height: 1.7;
    }
    .party:first-child { border-right: 1px solid #ccc; }
    .party-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #cc0000;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    /* ── Delivery / Place row ── */
    .delivery-row {
      display: flex;
      border-bottom: 1px solid #ccc;
    }
    .delivery-cell {
      flex: 1;
      padding: 8px 12px;
      font-size: 12px;
    }
    .delivery-cell:first-child { border-right: 1px solid #ccc; }
    .delivery-cell .label { color: #666; font-size: 11px; margin-bottom: 2px; }

    /* ── Additional info ── */
    .additional {
      padding: 8px 12px;
      font-size: 12px;
      border-bottom: 1px solid #ccc;
      min-height: 36px;
    }
    .additional .label { color: #666; font-size: 11px; margin-bottom: 2px; }

    /* ── Line-items table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    thead tr { background: #f0f0f0; }
    th {
      padding: 8px 10px;
      text-align: left;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      border-bottom: 2px solid #ccc;
    }
    th.right, td.right { text-align: right; }
    td { padding: 8px 10px; border-bottom: 1px solid #eee; vertical-align: top; }

    /* ── Totals block ── */
    .totals-section { 
      border-top: 2px solid #ccc;
      display: flex;
      justify-content: flex-end;
      margin: 0;
    }
    .totals-wrapper {
      width: 50%;
      min-width: 280px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 7px 12px;
      font-size: 12px;
      border-bottom: 1px solid #eee;
    }
    .total-row.grand {
      background: #f9f9f9;
      font-weight: 700;
      font-size: 14px;
      color: #cc0000;
      border-bottom: 2px solid #ccc;
    }

    /* ── Words / payment row ── */
    .words-row, .payment-row {
      padding: 8px 12px;
      font-size: 12px;
      border-bottom: 1px solid #eee;
    }
    .words-row .label, .payment-row .label {
      color: #666; font-size: 11px; margin-bottom: 2px;
    }

    /* ── Footer ── */
    .footer {
    width: 100%;
  box-sizing: border-box;
      background: #222;
  color: #fff;
  text-align: center;
  padding: 10px;
  font-size: 11px;
  letter-spacing: 0.5px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
    }
    .footer a { color: #ff9999; text-decoration: none; }

    /* ── Validity note ── */
    .validity {
      padding: 8px 12px;
      font-size: 10px;
      color: #888;
      border-top: 1px solid #eee;
      text-align: center;
    }
  </style>
</head>
<body>
<div class="wrapper">

  <!-- Title bar -->
  <div class="title-bar">
    <h1>IRONHIDE FITNESS</h1>
    <h2>TAX INVOICE</h2>
  </div>

  <!-- Date + Invoice Number -->
  <div class="meta-row">
    <div class="meta-cell">
      <div class="label">Date of Invoice</div>
      <div class="value">${inv.invoiceDate}</div>
    </div>
    <div class="meta-cell">
      <div class="label">Tax Invoice No.</div>
      <div class="value">${inv.invoiceSerialNumber}</div>
    </div>
  </div>

  <!-- Supplier (left) + Purchaser (right) -->
  <div class="parties">
    <div class="party">
      <div class="party-title">Supplier Details</div>
      <div><strong>TIN:</strong> ${SUPPLIER.tin}</div>
      <div><strong>Name:</strong> ${SUPPLIER.name}</div>
      <div><strong>Address:</strong> ${SUPPLIER.address}</div>
      <div><strong>Tel:</strong> ${SUPPLIER.phone}</div>
    </div>
    <div class="party">
      <div class="party-title">Purchaser Details</div>
      <div><strong>TIN:</strong> ${inv.memberTIN || '—'}</div>
      <div><strong>Name:</strong> ${inv.memberName}</div>
      <div><strong>Address:</strong> ${inv.memberAddress || '—'}</div>
      <div><strong>Tel:</strong> ${inv.memberPhone || '—'}</div>
    </div>
  </div>

  <!-- Delivery date + Place of supply -->
  <div class="delivery-row">
    <div class="delivery-cell">
      <div class="label">Date of Delivery</div>
      <div>${inv.deliveryDateFmt}</div>
    </div>
    <div class="delivery-cell">
      <div class="label">Place of Supply</div>
      <div>${inv.placeOfSupply || SUPPLIER.address}</div>
    </div>
  </div>

  <!-- Additional information -->
  <div class="additional">
    <div class="label">Additional Information</div>
    <div>${inv.stripeSessionId ? 'Stripe Session: ' + inv.stripeSessionId : '—'}</div>
  </div>

  <!-- Line-items table -->
  <table>
    <thead>
      <tr>
        <th style="width:10%">Ref</th>
        <th>Description of Goods or Services</th>
        <th style="width:8%" class="right">Qty</th>
        <th style="width:15%" class="right">Unit Price (LKR)</th>
        <th style="width:17%" class="right">Amount Excl. VAT (LKR)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>001</td>
        <td>IronHide Fitness — ${inv.plan} Membership<br>
          <span style="color:#888; font-size:11px;">Gym access per membership plan</span>
        </td>
        <td class="right">1</td>
        <td class="right">${inv.amount.toLocaleString('en-LK', { maximumFractionDigits: 0 })}</td>
        <td class="right">${inv.amount.toLocaleString('en-LK', { maximumFractionDigits: 0 })}</td>
      </tr>
    </tbody>
  </table>

  <!-- Totals -->
  <table style="width:100%; border-collapse:collapse;">
  <tbody>
    <tr>
      <td colspan="4" style="text-align:left; padding-top:10px; border-top:2px solid #ccc; color:#666; font-size:11px;">Total Value of Supply (Excl. VAT)</td>
      <td class="right" style="border-top:2px solid #ccc; padding-top:10px;">${fmt(inv.amount)}</td>
    </tr>
    <tr>
      <td colspan="4" style="text-align:left; color:#666; font-size:11px;">VAT Amount (18%)</td>
      <td class="right">${fmt(inv.vatAmount)}</td>
    </tr>
    <tr style="background:#f9f9f9; font-weight:700; font-size:13px; color:#cc0000; border-top:2px solid #ccc; border-bottom:2px solid #ccc;">
      <td colspan="4" style="text-align:left; padding:8px 10px;">Total Amount Including VAT</td>
      <td class="right" style="padding:8px 10px;">${fmt(inv.totalAmount)}</td>
    </tr>
  </tbody>
</table>

  <!-- Total in words -->
  <div class="words-row">
    <div class="label">Total Amount in Words</div>
    <div>${inv.totalAmountWords}</div>
  </div>

  <!-- Mode of payment -->
  <div class="payment-row">
    <div class="label">Mode of Payment</div>
    <div>${paymentLabel[inv.paymentMethod] || inv.paymentMethod}</div>
  </div>

  <!-- Validity note -->
  <div class="validity">
    This is a computer-generated Tax Invoice issued in accordance with Gazette Extraordinary No. 2463/05
    (Value Added Tax Act, No. 14 of 2002). Please retain this invoice for a minimum of five (5) years.
  </div>

  <!-- Footer -->
  <div class="footer">
    IronHide Fitness &nbsp;|&nbsp; 114C Negombo Rd, Wattala &nbsp;|&nbsp;
    +94 70 322 2211 &nbsp;|&nbsp;
    <a href="mailto:support@ironhidefitness.lk">support@ironhidefitness.lk</a>
  </div>

</div>
</body>
</html>`;
}