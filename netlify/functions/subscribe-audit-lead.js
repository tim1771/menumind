// Capture an email + restaurant name from the audit flow and store it in
// Netlify Blobs. Triggers an immediate welcome email via Resend, then the
// scheduled `send-drip` function delivers the rest of the sequence.
//
// Required env vars (set in Netlify dashboard):
//   RESEND_API_KEY  — from resend.com (free tier: 100/day, 3k/mo)
//   DRIP_FROM_EMAIL — e.g. "MenuMind <noreply@menu.ca>" (must be verified in Resend)
//
// Optional:
//   SITE_URL        — origin check; leave unset in dev, set in production

const { getStore } = require("@netlify/blobs");
const { escapeHtml } = require("./_util");

const MAX_EMAIL_LENGTH = 254; // RFC 5321
const MAX_NAME_LENGTH = 120;
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_ORIGIN = process.env.SITE_URL || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.DRIP_FROM_EMAIL;

function sanitize(s, max) {
  if (typeof s !== "string") return "";
  // Strip control chars + leading/trailing whitespace
  return s.replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, max);
}

async function sendWelcome({ email, name }) {
  if (!RESEND_API_KEY || !FROM_EMAIL) {
    console.warn("[subscribe-audit-lead] RESEND_API_KEY or DRIP_FROM_EMAIL not set — skipping send");
    return { skipped: true };
  }

  // HTML-escape any user-provided name before interpolating into the email
  // body — otherwise an attacker can submit a victim's address with a crafted
  // name and phish them through a DKIM-aligned MenuMind sender. Keep a
  // separate plaintext greeting for the text/plain alternative so the body
  // doesn't contain HTML entities.
  const greetingHtml = name ? `Hi ${escapeHtml(name)},` : "Hi there,";
  const greetingText = name ? `Hi ${name},` : "Hi there,";

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.55">
<p style="font-size:22px;font-weight:800;color:#0f1117;margin:0 0 8px"><span style="color:#0f1117">Menu</span><span style="color:#d97706">Mind</span></p>
<h1 style="font-size:22px;line-height:1.3;margin:24px 0 12px">Your audit is saved.</h1>
<p>${greetingHtml}</p>
<p>Thanks for running a MenuMind audit. Your report is saved and you can revisit it any time at <a href="https://menumindx.netlify.app/" style="color:#d97706">menumindx.netlify.app</a>.</p>
<p>Over the next three weeks I'll send a small handful of emails — one a week, no more — covering the highest-leverage things we see independent operators get wrong on menus and marketplaces. You can reply to any of them with questions.</p>
<p>First one lands in 3 days.</p>
<p style="margin-top:32px">— The MenuMind team<br><span style="color:#666;font-size:13px">by menu.ca · <a href="https://worklocal.ca" style="color:#d97706">worklocal.ca</a></span></p>
<hr style="border:none;border-top:1px solid #eee;margin:32px 0">
<p style="font-size:12px;color:#888">You're getting this because you saved an audit on MenuMind. Reply with "stop" and we won't email again.</p>
</body></html>`;

  const text = `${greetingText}\n\nThanks for running a MenuMind audit. Your report is saved and you can revisit it any time at https://menumindx.netlify.app/.\n\nOver the next three weeks I'll send a small handful of emails — one a week, no more — covering the highest-leverage things we see independent operators get wrong on menus and marketplaces.\n\nFirst one lands in 3 days.\n\n— The MenuMind team\nby menu.ca · https://worklocal.ca\n\n---\nYou're getting this because you saved an audit on MenuMind. Reply "stop" and we won't email again.`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: email,
      subject: "Your MenuMind audit is saved",
      html,
      text,
      tags: [{ name: "type", value: "welcome" }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[subscribe-audit-lead] Resend error:", res.status, errText);
    return { sent: false, status: res.status };
  }
  return { sent: true };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // When SITE_URL is configured (production), require a matching Origin header.
  // Missing-origin = reject — otherwise attackers could call the endpoint
  // directly from curl/scripts with arbitrary emails + names.
  if (ALLOWED_ORIGIN) {
    const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || "";
    if (!origin || !origin.startsWith(ALLOWED_ORIGIN)) {
      return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
    }
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const email = sanitize(body.email, MAX_EMAIL_LENGTH).toLowerCase();
  const name = sanitize(body.name, MAX_NAME_LENGTH);
  const source = sanitize(body.source, 40) || "audit-save";

  if (!EMAIL_RX.test(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid email" }) };
  }

  const store = getStore("audit-leads");
  const existing = await store.get(email, { type: "json" });

  // Don't double-send welcome if they re-submit.
  const isNew = !existing;
  const record = {
    email,
    name: name || (existing && existing.name) || "",
    source,
    signupAt: existing && existing.signupAt ? existing.signupAt : new Date().toISOString(),
    lastSentDay: existing && typeof existing.lastSentDay === "number" ? existing.lastSentDay : -1,
    unsubscribed: existing && existing.unsubscribed === true,
  };

  await store.setJSON(email, record);

  let sendResult = { sent: false };
  if (isNew && !record.unsubscribed) {
    try {
      sendResult = await sendWelcome({ email, name: record.name });
      if (sendResult.sent) {
        record.lastSentDay = 0;
        await store.setJSON(email, record);
      }
    } catch (e) {
      console.error("[subscribe-audit-lead] send failed:", e);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, new: isNew, sent: sendResult.sent || false }),
  };
};
