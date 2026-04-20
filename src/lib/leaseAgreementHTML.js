export function buildLeaseAgreementHTML({
  landlordName,
  tenantName,
  propertyName,
  propertyAddress,
  unitNumber,
  monthlyRent,
  startDate,
  endDate,
  securityDeposit,
  agreementDate,
}) {
  const fmt = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const formattedRent = `₹${Number(monthlyRent).toLocaleString('en-IN')}`;
  const formattedDeposit = securityDeposit
    ? `₹${Number(securityDeposit).toLocaleString('en-IN')}`
    : 'As per agreement';
  const formattedStart = fmt(startDate);
  const formattedEnd = fmt(endDate);
  const formattedDate = fmt(agreementDate || new Date());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Rental Agreement</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f5f5;
      color: #1a1a2e;
      font-size: 13px;
      line-height: 1.6;
    }
    .page {
      max-width: 680px;
      margin: 32px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
    }
    .header {
      background: #002045;
      padding: 32px 40px 28px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand { font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: 0.5px; margin-bottom: 4px; }
    .brand-sub { font-size: 11px; color: rgba(255,255,255,0.5); letter-spacing: 2px; text-transform: uppercase; }
    .doc-meta { text-align: right; }
    .doc-type { font-size: 11px; color: rgba(255,255,255,0.6); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
    .doc-date { font-size: 13px; color: rgba(255,255,255,0.85); font-weight: 600; }
    .accent-bar { background: #68dba9; height: 4px; }
    .body { padding: 36px 40px; }
    h1.title {
      font-size: 20px;
      font-weight: 800;
      color: #002045;
      text-align: center;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 28px;
      padding-bottom: 16px;
      border-bottom: 2px solid #002045;
    }
    .intro {
      margin-bottom: 24px;
      color: #333;
      line-height: 1.8;
    }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      color: #002045;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin: 24px 0 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e8e8e8;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      margin-bottom: 8px;
    }
    .detail-item { padding: 10px 0; border-bottom: 1px solid #f4f4f4; }
    .detail-item:nth-child(odd) { padding-right: 20px; }
    .detail-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px; }
    .detail-value { font-size: 14px; font-weight: 700; color: #1a1a2e; }
    .detail-value.accent { color: #002045; }
    .clause { margin-bottom: 16px; }
    .clause-num { font-weight: 700; color: #002045; }
    .clause-text { color: #444; line-height: 1.7; }
    .signatures {
      margin-top: 40px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
    }
    .sig-block { }
    .sig-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 40px; }
    .sig-line { border-top: 1px solid #333; padding-top: 8px; }
    .sig-name { font-weight: 700; color: #1a1a2e; font-size: 14px; }
    .sig-role { font-size: 11px; color: #888; margin-top: 2px; }
    .footer {
      background: #f9f9f9;
      border-top: 1px solid #ececec;
      padding: 16px 40px;
      text-align: center;
    }
    .footer-line { font-size: 11px; color: #888; line-height: 1.6; }
    .footer-brand { font-size: 12px; color: #002045; font-weight: 700; letter-spacing: 1px; margin-top: 6px; opacity: 0.7; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand">EstateLogic</div>
      <div class="brand-sub">Property Management</div>
    </div>
    <div class="doc-meta">
      <div class="doc-type">Agreement Date</div>
      <div class="doc-date">${formattedDate}</div>
    </div>
  </div>
  <div class="accent-bar"></div>

  <div class="body">
    <h1 class="title">Rental Agreement</h1>

    <p class="intro">
      This Rental Agreement ("Agreement") is entered into on <strong>${formattedDate}</strong>, between
      <strong>${landlordName}</strong> (hereinafter referred to as the "Landlord") and
      <strong>${tenantName}</strong> (hereinafter referred to as the "Tenant"), collectively referred to
      as the "Parties."
    </p>

    <div class="section-title">Property Details</div>
    <div class="detail-grid">
      <div class="detail-item">
        <div class="detail-label">Property Name</div>
        <div class="detail-value accent">${propertyName}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Unit Number</div>
        <div class="detail-value accent">${unitNumber}</div>
      </div>
      <div class="detail-item" style="grid-column: span 2;">
        <div class="detail-label">Address</div>
        <div class="detail-value">${propertyAddress}</div>
      </div>
    </div>

    <div class="section-title">Lease Terms</div>
    <div class="detail-grid">
      <div class="detail-item">
        <div class="detail-label">Lease Start Date</div>
        <div class="detail-value">${formattedStart}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Lease End Date</div>
        <div class="detail-value">${formattedEnd}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Monthly Rent</div>
        <div class="detail-value accent">${formattedRent}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Security Deposit</div>
        <div class="detail-value">${formattedDeposit}</div>
      </div>
    </div>

    <div class="section-title">Terms &amp; Conditions</div>

    <div class="clause">
      <span class="clause-num">1. Rent Payment.</span>
      <span class="clause-text"> The Tenant agrees to pay a monthly rent of <strong>${formattedRent}</strong>, due on or before the 5th day of each calendar month. Payments made after the 10th day of the month shall attract a late fee of 2% of the monthly rent.</span>
    </div>

    <div class="clause">
      <span class="clause-num">2. Security Deposit.</span>
      <span class="clause-text"> The security deposit of <strong>${formattedDeposit}</strong> shall be refunded within 30 days of vacating the premises, subject to deductions for any damages beyond normal wear and tear or unpaid dues.</span>
    </div>

    <div class="clause">
      <span class="clause-num">3. Lock-in Period.</span>
      <span class="clause-text"> Either party wishing to terminate this Agreement before the expiry date must give a minimum written notice of 60 days. Early termination without notice shall forfeit the security deposit.</span>
    </div>

    <div class="clause">
      <span class="clause-num">4. Maintenance &amp; Repairs.</span>
      <span class="clause-text"> The Tenant shall maintain the premises in good condition and promptly report any damage to the Landlord. Minor day-to-day maintenance shall be the Tenant's responsibility. Major structural repairs shall be borne by the Landlord.</span>
    </div>

    <div class="clause">
      <span class="clause-num">5. Subletting.</span>
      <span class="clause-text"> The Tenant shall not sublet, assign, or transfer the tenancy or any part thereof without the prior written consent of the Landlord.</span>
    </div>

    <div class="clause">
      <span class="clause-num">6. Use of Premises.</span>
      <span class="clause-text"> The premises shall be used solely for residential purposes. The Tenant shall not carry on any trade, business, or illegal activity from the premises and shall comply with all applicable laws, regulations, and society bye-laws.</span>
    </div>

    <div class="clause">
      <span class="clause-num">7. Utilities.</span>
      <span class="clause-text"> The Tenant shall be responsible for payment of all utility charges, including electricity, water, gas, and internet, consumed during the tenancy period.</span>
    </div>

    <div class="clause">
      <span class="clause-num">8. Alterations.</span>
      <span class="clause-text"> The Tenant shall not make any structural alterations, additions, or modifications to the premises without the prior written consent of the Landlord. All permitted fixtures installed by the Tenant shall be removed and the premises restored to original condition at the time of vacating.</span>
    </div>

    <div class="clause">
      <span class="clause-num">9. Inspection.</span>
      <span class="clause-text"> The Landlord reserves the right to inspect the premises at a mutually agreed time with a minimum notice of 24 hours, except in the case of emergency.</span>
    </div>

    <div class="clause">
      <span class="clause-num">10. Governing Law.</span>
      <span class="clause-text"> This Agreement shall be governed by and construed in accordance with the laws of India, and any disputes arising shall be subject to the jurisdiction of local courts.</span>
    </div>

    <div class="signatures">
      <div class="sig-block">
        <div class="sig-label">Landlord's Signature</div>
        <div class="sig-line">
          <div class="sig-name">${landlordName}</div>
          <div class="sig-role">Landlord / Owner</div>
        </div>
      </div>
      <div class="sig-block">
        <div class="sig-label">Tenant's Signature</div>
        <div class="sig-line">
          <div class="sig-name">${tenantName}</div>
          <div class="sig-role">Tenant</div>
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="footer-line">This is a computer-generated rental agreement document managed via EstateLogic.</div>
    <div class="footer-line">For queries or amendments, contact your property manager through the EstateLogic app.</div>
    <div class="footer-brand">ESTATELOGIC &nbsp;·&nbsp; Secure Property Management</div>
  </div>
</div>
</body>
</html>`;
}
