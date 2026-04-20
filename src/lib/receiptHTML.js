const METHOD_LABELS = {
  gpay: 'Google Pay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
};

export function buildReceiptHTML({ txnId, amount, method, paidAt, tenantName, propertyName, unitNumber }) {
  const formattedAmount = `₹${Number(amount).toLocaleString('en-IN')}`;
  const formattedDate = new Date(paidAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const formattedTime = new Date(paidAt).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const receiptNo = `RCPT-${txnId}`;
  const methodLabel = METHOD_LABELS[method] ?? method;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Payment Receipt</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f5f5;
      color: #1a1a2e;
    }
    .page {
      max-width: 600px;
      margin: 32px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
    }
    .header {
      background: #002045;
      padding: 32px 36px 28px;
    }
    .brand {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .brand-sub {
      font-size: 11px;
      color: rgba(255,255,255,0.5);
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .header-right {
      text-align: right;
      margin-top: -44px;
    }
    .receipt-label {
      font-size: 11px;
      color: rgba(255,255,255,0.7);
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .receipt-no {
      font-size: 15px;
      color: #68dba9;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .status-banner {
      background: #68dba9;
      padding: 10px 36px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #002045;
      display: inline-block;
      margin-right: 8px;
    }
    .status-text {
      font-size: 13px;
      font-weight: 800;
      color: #002045;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .body { padding: 32px 36px; }
    .amount-section {
      text-align: center;
      padding: 24px 0 28px;
      border-bottom: 1px solid #f0f0f0;
      margin-bottom: 28px;
    }
    .amount-label {
      font-size: 11px;
      color: #555;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .amount-value {
      font-size: 52px;
      font-weight: 900;
      color: #002045;
      letter-spacing: -1px;
    }
    .details-table { width: 100%; border-collapse: collapse; }
    .details-table tr { border-bottom: 1px solid #f4f4f4; }
    .details-table tr:last-child { border-bottom: none; }
    .details-table td {
      padding: 12px 0;
      font-size: 13px;
      vertical-align: top;
    }
    .detail-key { color: #333; font-weight: 600; width: 44%; }
    .detail-value { color: #111; font-weight: 700; text-align: right; }
    .detail-value.highlight { color: #002045; font-weight: 800; }
    .footer {
      background: #f9f9f9;
      border-top: 1px solid #ececec;
      padding: 20px 36px;
      text-align: center;
    }
    .footer-line { font-size: 11px; color: #666; line-height: 1.6; }
    .footer-brand {
      font-size: 12px;
      color: #002045;
      font-weight: 700;
      letter-spacing: 1px;
      margin-top: 8px;
      opacity: 0.75;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="brand">EstateLogic</div>
      <div class="brand-sub">Property Management</div>
      <div class="header-right">
        <div class="receipt-label">Receipt No.</div>
        <div class="receipt-no">${receiptNo}</div>
      </div>
    </div>
    <div class="status-banner">
      <span class="status-dot"></span>
      <span class="status-text">Payment Confirmed</span>
    </div>
    <div class="body">
      <div class="amount-section">
        <div class="amount-label">Amount Paid</div>
        <div class="amount-value">${formattedAmount}</div>
      </div>
      <table class="details-table">
        <tr>
          <td class="detail-key">Tenant</td>
          <td class="detail-value">${tenantName}</td>
        </tr>
        <tr>
          <td class="detail-key">Property</td>
          <td class="detail-value">${propertyName}</td>
        </tr>
        <tr>
          <td class="detail-key">Unit</td>
          <td class="detail-value">${unitNumber}</td>
        </tr>
        <tr>
          <td class="detail-key">Payment Method</td>
          <td class="detail-value">UPI · ${methodLabel}</td>
        </tr>
        <tr>
          <td class="detail-key">Date</td>
          <td class="detail-value">${formattedDate}</td>
        </tr>
        <tr>
          <td class="detail-key">Time</td>
          <td class="detail-value">${formattedTime}</td>
        </tr>
        <tr>
          <td class="detail-key">Transaction ID</td>
          <td class="detail-value highlight">${txnId}</td>
        </tr>
        <tr>
          <td class="detail-key">Status</td>
          <td class="detail-value" style="color:#1a8a5a; font-weight:700;">&#10003; Paid</td>
        </tr>
      </table>
    </div>
    <div class="footer">
      <div class="footer-line">This is a computer-generated receipt and does not require a physical signature.</div>
      <div class="footer-line">For queries, contact your property manager via the EstateLogic app.</div>
      <div class="footer-brand">ESTATELOGIC &nbsp;·&nbsp; Secure Property Management</div>
    </div>
  </div>
</body>
</html>`;
}
