/* ============================================================
   SUMMAZ ESCAPE — Booking API (Vercel Serverless Function)
   POST /api/register
   ============================================================
   Environment variables — set these in Vercel dashboard:
     RESEND_API_KEY   → resend.com API key
     ZELLE_HANDLE     → email or phone registered with Zelle
     VENMO_HANDLE     → @handle on Venmo
     GAS_URL          → Google Apps Script URL (keeps Sheets updated)
============================================================ */

const ZELLE_HANDLE  = process.env.ZELLE_HANDLE  || 'anel@summazescape.com';
const VENMO_HANDLE  = process.env.VENMO_HANDLE  || '@summaz-escape';
const ZELLE_QR_URL  = 'https://res.cloudinary.com/dko76z0df/image/upload/v1782858825/summaz/zelle-qr.jpg';
const VENMO_QR_URL  = 'https://res.cloudinary.com/dko76z0df/image/upload/v1782858823/summaz/venmo-qr.png';
const VENMO_URL     = 'https://account.venmo.com/u/summaz-escape';
const GAS_URL       = process.env.GAS_URL        || '';
const RESEND_KEY    = process.env.RESEND_API_KEY;

const BRAND         = 'Summaz Escape';
const FROM          = `${BRAND} <team@booking.summazescape.com>`;
const TEAM_FROM     = `${BRAND} <notifications@booking.summazescape.com>`;
const REPLY_TO      = 'booking@summazescape.com';
const TEAM_INBOX    = 'booking@summazescape.com';
const SUPPORT_PHONE = '+1 (242) 817-5387';
const SUPPORT_EMAIL = 'booking@summazescape.com';
const LOGO_URL      = 'https://res.cloudinary.com/dko76z0df/image/upload/v1782304824/summaz/logo.png';
const ADULT_PRICE   = 180;
const CHILD_PRICE   = 115;

/* ── Disposable email domain blocklist ───────────────────── */
const BLOCKED_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','tempmail.com','yopmail.com','throwam.com',
  'sharklasers.com','guerrillamailblock.com','grr.la','dispostable.com',
  'maildrop.cc','trashmail.com','fakeinbox.com','spamgourmet.com','discard.email',
  'mailnull.com','mailnesia.com','trbvm.com','spam4.me','trashmail.me',
  'tempinbox.com','throwaway.email','getairmail.com','filzmail.com',
  'spamfree24.org','spam.la','temp-mail.org','guerrillamail.info',
  'guerrillamail.biz','guerrillamail.de','guerrillamail.net','guerrillamail.org',
]);

/* ── Fake-success for rejected spam (no emails, no Sheets) ─ */
function spamOk(res) {
  const ref = 'SE-' + Math.floor(100000 + Math.random() * 900000);
  return res.json({ success: true, reference: ref, total: 0 });
}

/* ── Handler ─────────────────────────────────────────────── */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  /* 1. Honeypot */
  if (body.honeypot) return spamOk(res);

  /* 2. Timing — under 20s = bot, under 3s = direct API hit */
  const elapsed = Number(body.elapsed) || 0;
  if (elapsed < 3000 || elapsed < 20000) return spamOk(res);

  const {
    adults        = 1,
    children      = 0,
    date          = '',
    name          = '',
    email         = '',
    phone         = '',
    addons        = '',
    notes         = '',
    paymentMethod = 'card',
  } = body;

  /* 3. Required fields */
  const emailClean = String(email).trim().toLowerCase();
  const phoneDigs  = String(phone).replace(/\D/g, '');
  if (!name.trim() || !emailClean || !date || !paymentMethod ||
      (Number(adults) + Number(children) < 1)) {
    return spamOk(res);
  }

  /* 4. Phone sanity */
  if (phoneDigs.length < 7) return spamOk(res);

  /* 5. Disposable email — blocklist first, then API */
  const domain = emailClean.split('@')[1] || '';
  if (BLOCKED_DOMAINS.has(domain)) return spamOk(res);

  let spamFlag = '';
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 4000);
    const mc = await fetch(`https://api.mailcheck.ai/domain/${encodeURIComponent(domain)}`, { signal: ctrl.signal });
    if (mc.ok) {
      const mcData = await mc.json();
      if (mcData.disposable) return spamOk(res);
    }
  } catch (_) {
    spamFlag = 'API_FAIL';
  }

  /* ── Passed all checks — process real booking ─────────── */
  const reference = 'SE-' + Math.floor(100000 + Math.random() * 900000);
  const total     = (Number(adults) * ADULT_PRICE) + (Number(children) * CHILD_PRICE);
  const booking   = { adults, children, date, name, email: emailClean, phone, addons, notes, paymentMethod, reference, total, spamFlag };

  const [emailResult, gasResult] = await Promise.allSettled([
    sendBookingEmails(booking),
    GAS_URL
      ? fetch(GAS_URL, { method: 'POST', body: JSON.stringify(booking) })
      : Promise.resolve(),
  ]);

  if (gasResult.status === 'rejected') {
    console.error('[GAS forward failed]', gasResult.reason?.message);
  }

  if (emailResult.status === 'rejected') {
    console.error('[Email send failed]', emailResult.reason?.message);
    return res.status(500).json({
      success: false,
      error: 'We could not send your confirmation email. Please try again or reach us on WhatsApp.',
    });
  }

  return res.json({ success: true, reference, total });
};

/* ══════════════════════════════════════════════════════════
   RESEND HELPER
   ══════════════════════════════════════════════════════════ */
async function resend(payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  console.log('[Email sent]', String(payload.to), '|', payload.subject);
  return data;
}

async function sendBookingEmails(b) {
  const { name, email, paymentMethod, reference } = b;
  const firstName   = h(name).split(' ')[0];
  const label       = methodName(paymentMethod);

  const guestSubject = paymentMethod === 'arrival'
    ? `Booking received, ${firstName}. Your spot is held. | ${reference}`
    : `Booking received, ${firstName}. Send your ${label} payment to lock in your spot. | ${reference}`;

  const teamSubject = `New Booking (${label}) | ${reference} | ${name}`;

  await Promise.all([
    resend({ from: FROM,      to: [email],     reply_to: REPLY_TO, subject: guestSubject, html: guestEmail(b) }),
    resend({ from: TEAM_FROM, to: [TEAM_INBOX],                    subject: teamSubject,  html: teamEmail(b)  }),
  ]);
}

/* ── Shared helpers ─────────────────────────────────────── */
function h(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function methodName(pm) {
  return { zelle: 'Zelle', venmo: 'Venmo', arrival: 'On-Site Card' }[pm] || 'On-Site Card';
}

function fmtDate(dateStr) {
  if (!dateStr) return 'To be confirmed';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function fmtGroup(adults, children) {
  const a = `${adults} adult${adults !== 1 ? 's' : ''}`;
  const c = children > 0 ? `, ${children} child${children !== 1 ? 'ren' : ''}` : '';
  return a + c;
}

/* ══════════════════════════════════════════════════════════
   EMAIL SHELL
   ══════════════════════════════════════════════════════════ */
function shell(rows) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Summaz Escape</title>
</head>
<body style="margin:0;padding:0;background:#ECF3FC;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#ECF3FC;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="max-width:580px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #D6E4F5;">

      <!-- Header -->
      <tr><td style="background:#ffffff;padding:26px 36px;text-align:center;">
        <img src="${LOGO_URL}" alt="Summaz Escape" height="110"
             style="height:110px;width:auto;display:inline-block;" />
      </td></tr>

      ${rows}

      <!-- Footer -->
      <tr><td style="background:#F4F7FA;padding:20px 36px;border-top:1px solid #DDE8F5;">
        <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;line-height:1.8;">
          ${BRAND} &nbsp;·&nbsp; Arawak Cay, Nassau, Bahamas<br>
          <a href="tel:+12428175387" style="color:#9CA3AF;text-decoration:none;">${SUPPORT_PHONE}</a>
          &nbsp;&nbsp;
          <a href="mailto:${SUPPORT_EMAIL}" style="color:#9CA3AF;text-decoration:none;">${SUPPORT_EMAIL}</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/* ══════════════════════════════════════════════════════════
   GUEST EMAIL  (Zelle / Venmo / Card in one function)
   ══════════════════════════════════════════════════════════ */
function guestEmail(b) {
  const { name, adults, children, date, addons, paymentMethod, reference, total } = b;

  const firstName     = h(name).split(' ')[0];
  const dateDisplay   = fmtDate(date);
  const groupDisplay  = fmtGroup(Number(adults), Number(children));
  const addonsDisplay = addons || 'None';
  const totalDisplay  = '$' + Number(total).toLocaleString();

  const summaryRows = `
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#6B7280;width:38%;">Reference</td>
      <td style="padding:6px 0;font-size:14px;font-weight:700;color:#111827;">${h(reference)}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#6B7280;">Date</td>
      <td style="padding:6px 0;font-size:14px;color:#111827;">${dateDisplay}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#6B7280;">Group</td>
      <td style="padding:6px 0;font-size:14px;color:#111827;">${groupDisplay}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#6B7280;">Package</td>
      <td style="padding:6px 0;font-size:14px;color:#111827;">Classic Package</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#6B7280;">Add-ons</td>
      <td style="padding:6px 0;font-size:14px;color:#111827;">${h(addonsDisplay)}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#6B7280;font-weight:700;">Total</td>
      <td style="padding:6px 0;font-size:15px;font-weight:800;color:#031D2F;">${totalDisplay}</td>
    </tr>`;

  let payBlock;

  const payInstructions = (steps) => `
          <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
            <tr>
              <td style="vertical-align:top;padding-right:8px;font-size:13px;color:#0077B6;font-weight:700;width:18px;">1.</td>
              <td style="font-size:13px;color:#374151;line-height:1.6;padding-bottom:10px;">
                Reply to this email with your screenshot attached. In the message body write:<br>
                <strong style="color:#111827;">Payment for ${h(reference)}</strong>
              </td>
            </tr>
            <tr>
              <td style="vertical-align:top;padding-right:8px;font-size:13px;color:#0077B6;font-weight:700;width:18px;">2.</td>
              <td style="font-size:13px;color:#374151;line-height:1.6;">
                Or send a new email to
                <a href="mailto:${SUPPORT_EMAIL}" style="color:#0077B6;text-decoration:none;">${SUPPORT_EMAIL}</a>
                with subject <strong style="color:#111827;">Payment for ${h(reference)}</strong>
                and your screenshot attached.
              </td>
            </tr>
          </table>`;

  const zelleBlock = `
    <tr><td style="padding:0 36px 32px;">
      <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#111827;">How to pay</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#F0F7FF;border:2px solid #0077B6;border-radius:10px;padding:22px;">
        <tr><td>
          <p style="margin:0 0 5px;font-size:13px;color:#6B7280;">Open Zelle and send <strong style="color:#111827;">${totalDisplay}</strong> to:</p>
          <p style="margin:0 0 16px;font-size:22px;font-weight:800;color:#031D2F;letter-spacing:-0.3px;">${h(ZELLE_HANDLE)}</p>
          <p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.6;">
            Or scan the QR code below in your bank's app to send the payment directly into our Zelle:
          </p>
          <p style="margin:0 0 20px;text-align:center;">
            <img src="${ZELLE_QR_URL}" alt="Zelle QR code" width="180" style="border-radius:8px;border:1px solid #E5E7EB;display:inline-block;">
          </p>
          <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#111827;">
            Then send us your payment screenshot:
          </p>
          ${payInstructions()}
        </td></tr>
      </table>
      <p style="margin:14px 0 0;font-size:14px;color:#6B7280;line-height:1.7;">
        Your spot holds for 24 hours. Once we receive your screenshot, we will confirm your booking right away.
      </p>
    </td></tr>`;

  const venmoBlock = `
    <tr><td style="padding:0 36px 32px;">
      <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#111827;">How to pay</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#F0F7FF;border:2px solid #0077B6;border-radius:10px;padding:22px;">
        <tr><td>
          <p style="margin:0 0 5px;font-size:13px;color:#6B7280;">Send <strong style="color:#111827;">${totalDisplay}</strong> to <strong style="color:#031D2F;">${h(VENMO_HANDLE)}</strong> on Venmo. Or open Venmo directly:</p>
          <p style="margin:0 0 16px;">
            <a href="${VENMO_URL}" style="color:#0077B6;font-size:14px;text-decoration:none;">${VENMO_URL}</a>
          </p>
          <p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.6;">
            Or scan the QR code below to pay:
          </p>
          <p style="margin:0 0 20px;text-align:center;">
            <img src="${VENMO_QR_URL}" alt="Venmo QR code" width="180" style="border-radius:8px;border:1px solid #E5E7EB;display:inline-block;">
          </p>
          <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#111827;">
            Then send us your payment screenshot:
          </p>
          ${payInstructions()}
        </td></tr>
      </table>
      <p style="margin:14px 0 0;font-size:14px;color:#6B7280;line-height:1.7;">
        Your spot holds for 24 hours. Once we receive your screenshot, we will confirm your booking right away.
      </p>
    </td></tr>`;

  if (paymentMethod === 'zelle') {
    payBlock = zelleBlock;
  } else if (paymentMethod === 'venmo') {
    payBlock = venmoBlock;
  } else {
    payBlock = `
    <tr><td style="padding:0 36px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#F0FCF8;border:2px solid #00C4A1;border-radius:10px;padding:22px;">
        <tr><td>
          <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#111827;">
            No payment needed right now.
          </p>
          <p style="margin:0 0 18px;font-size:14px;color:#6B7280;line-height:1.7;">
            Your spot is reserved. Bring your card on the day and pay on-site when you arrive.
          </p>
          <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#111827;">
            To confirm your place:
          </p>
          <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
            <tr>
              <td style="vertical-align:top;padding-right:8px;font-size:13px;color:#00A37A;font-weight:700;width:18px;">1.</td>
              <td style="font-size:13px;color:#374151;line-height:1.6;padding-bottom:10px;">
                Reply to this email with <strong style="color:#111827;">Confirmed ${h(reference)}</strong> in the message body.
              </td>
            </tr>
            <tr>
              <td style="vertical-align:top;padding-right:8px;font-size:13px;color:#00A37A;font-weight:700;width:18px;">2.</td>
              <td style="font-size:13px;color:#374151;line-height:1.6;">
                Or send an email to
                <a href="mailto:${SUPPORT_EMAIL}" style="color:#0077B6;text-decoration:none;">${SUPPORT_EMAIL}</a>
                with subject <strong style="color:#111827;">Confirmed ${h(reference)}</strong>.
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td></tr>`;
  }

  const intro = paymentMethod === 'arrival'
    ? 'Your spot is reserved. No payment is needed until you arrive.'
    : 'We got your request. Your spot is held. Send the payment to lock it in.';

  const rows = `
  <tr><td style="padding:34px 36px 24px;">
    <p style="margin:0 0 6px;font-size:23px;font-weight:800;color:#111827;letter-spacing:-0.4px;">
      Hey ${firstName}, your booking is in.
    </p>
    <p style="margin:0;font-size:15px;color:#6B7280;line-height:1.65;">${intro}</p>
  </td></tr>

  <tr><td style="padding:0 36px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="background:#F4F7FA;border-radius:10px;padding:22px;">
      <tr><td>
        <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#9CA3AF;
                  text-transform:uppercase;letter-spacing:0.8px;">Booking Summary</p>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          ${summaryRows}
        </table>
      </td></tr>
    </table>
  </td></tr>

  ${payBlock}

  <tr><td style="padding:0 36px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="border-top:1px solid #E5E9EF;padding-top:22px;">
      <tr><td style="font-size:13px;color:#6B7280;line-height:1.8;">
        Questions before your visit? We are here.<br>
        <a href="tel:+12428175387" style="color:#0077B6;text-decoration:none;font-weight:600;">${SUPPORT_PHONE}</a>
        &nbsp;&nbsp;
        <a href="mailto:${SUPPORT_EMAIL}" style="color:#0077B6;text-decoration:none;font-weight:600;">${SUPPORT_EMAIL}</a>
      </td></tr>
    </table>
  </td></tr>`;

  return shell(rows);
}

/* ══════════════════════════════════════════════════════════
   TEAM NOTIFICATION EMAIL  (all 3 methods)
   ══════════════════════════════════════════════════════════ */
function teamEmail(b) {
  const { name, email, phone, adults, children, date, addons, notes, paymentMethod, reference, total } = b;

  const dateDisplay   = fmtDate(date);
  const groupDisplay  = fmtGroup(Number(adults), Number(children));
  const label         = methodName(paymentMethod);
  const addonsDisplay = addons || 'None';
  const totalDisplay  = '$' + Number(total).toLocaleString();
  const badgeColor    = paymentMethod === 'arrival' ? '#00C4A1' : '#0077B6';

  const actionBox = paymentMethod === 'arrival'
    ? `<tr><td colspan="2" style="padding-top:18px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background:#FFF8E1;border:1px solid #F4A340;border-radius:8px;padding:14px 16px;">
          <tr><td style="font-size:13px;color:#92400E;line-height:1.75;">
            <strong>Action needed:</strong> Guest pays on-site by card. Call or message them to confirm the reservation before their visit date.<br><br>
            If the guest does not reply to the confirmation email or send an email to <strong>${SUPPORT_EMAIL}</strong> with a confirmed message within 24 hours, call them directly to confirm.
          </td></tr>
        </table>
      </td></tr>`
    : `<tr><td colspan="2" style="padding-top:18px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background:#FFF8E1;border:1px solid #F4A340;border-radius:8px;padding:14px 16px;">
          <tr><td style="font-size:13px;color:#92400E;line-height:1.75;">
            <strong>Action needed:</strong> Watch for a payment screenshot at <strong>${SUPPORT_EMAIL}</strong>. Match it to ref <strong>${h(reference)}</strong> and confirm the booking once received.<br><br>
            If the guest does not reply with a screenshot or send an email to <strong>${SUPPORT_EMAIL}</strong> with their payment proof within 24 hours, call them directly to follow up.
          </td></tr>
        </table>
      </td></tr>`;

  const rows = `
  <tr><td style="padding:26px 36px 20px;">
    <table cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="background:${badgeColor};border-radius:4px;padding:5px 14px;vertical-align:middle;">
          <span style="font-size:11px;font-weight:700;color:#ffffff;
                text-transform:uppercase;letter-spacing:0.6px;">${h(label)}</span>
        </td>
        <td style="padding-left:14px;vertical-align:middle;">
          <span style="font-size:19px;font-weight:800;color:#111827;">${h(reference)}</span>
        </td>
      </tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 36px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="background:#F4F7FA;border-radius:10px;padding:22px;">
      <tr><td>
        <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#9CA3AF;
                  text-transform:uppercase;letter-spacing:0.8px;">Guest Details</p>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="padding:5px 0;font-size:14px;color:#6B7280;width:38%;">Name</td>
            <td style="padding:5px 0;font-size:14px;font-weight:700;color:#111827;">${h(name)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:14px;color:#6B7280;">Email</td>
            <td style="padding:5px 0;font-size:14px;">
              <a href="mailto:${h(email)}" style="color:#0077B6;text-decoration:none;">${h(email)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:14px;color:#6B7280;">Phone</td>
            <td style="padding:5px 0;font-size:14px;">
              <a href="tel:${h(phone)}" style="color:#0077B6;text-decoration:none;">${h(phone)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:14px;color:#6B7280;">Date</td>
            <td style="padding:5px 0;font-size:14px;color:#111827;">${dateDisplay}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:14px;color:#6B7280;">Group</td>
            <td style="padding:5px 0;font-size:14px;color:#111827;">${groupDisplay}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:14px;color:#6B7280;">Package</td>
            <td style="padding:5px 0;font-size:14px;color:#111827;">Classic Package</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:14px;color:#6B7280;">Add-ons</td>
            <td style="padding:5px 0;font-size:14px;color:#111827;">${h(addonsDisplay)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:14px;color:#6B7280;">Payment</td>
            <td style="padding:5px 0;font-size:14px;font-weight:700;color:#111827;">${h(label)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;font-size:14px;color:#6B7280;font-weight:700;">Total</td>
            <td style="padding:5px 0;font-size:15px;font-weight:800;color:#031D2F;">${totalDisplay}</td>
          </tr>
          ${notes ? `<tr>
            <td style="padding:5px 0;font-size:14px;color:#6B7280;vertical-align:top;">Notes</td>
            <td style="padding:5px 0;font-size:14px;color:#111827;line-height:1.55;">${h(notes)}</td>
          </tr>` : ''}
          ${actionBox}
        </table>
      </td></tr>
    </table>
  </td></tr>`;

  return shell(rows);
}
