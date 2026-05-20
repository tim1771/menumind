// Scheduled Netlify function (runs daily at 14:00 UTC = 10:00 EDT / 09:00 EST).
// Walks every audit-lead and sends the next drip email if they've reached
// the right day-since-signup.
//
// Schedule is set in netlify.toml.
//
// Required env vars: RESEND_API_KEY, DRIP_FROM_EMAIL
//
// The drip is intentionally short and high-signal — 4 messages after the
// welcome, then a soft demo invite. Anything more dilutes.

const { getStore } = require("@netlify/blobs");
const { escapeHtml } = require("./_util");

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.DRIP_FROM_EMAIL;

const DRIP = [
  {
    day: 3,
    subject: "The math on Uber Eats is worse than you think",
    bodyHtml: `<p>Quick one.</p>
<p>If you run any volume through Uber Eats, DoorDash, or Skip, our marketplace calculator will show you the monthly $ figure those platforms are pulling out — including the part most operators forget to account for (the customer-pricing markup that suppresses your direct-order channel).</p>
<p><a href="https://menumindx.netlify.app/marketplace-calculator.html" style="color:#d97706;font-weight:600">Run the calculator →</a> (60 seconds, no signup)</p>
<p>The number surprises almost everyone. Hit reply if you want to talk through what to do with it.</p>`,
    bodyText: `Quick one.\n\nIf you run any volume through Uber Eats, DoorDash, or Skip, our marketplace calculator will show you the monthly $ figure those platforms are pulling — including the part most operators forget (the customer-pricing markup that suppresses your direct-order channel).\n\nRun the calculator: https://menumindx.netlify.app/marketplace-calculator.html\n\nThe number surprises almost everyone.`,
  },
  {
    day: 7,
    subject: "The single highest-leverage menu change",
    bodyHtml: `<p>If you only do one thing from your MenuMind audit, do this:</p>
<p>Take your three best-margin items (the "Stars" in your report) and rewrite their descriptions. Not the prices. Just the words.</p>
<p>That alone moves average check size by 6-12% in most restaurants we've worked with. The price changes come later, after you've tested the description.</p>
<p>Full writeup here: <a href="https://menumindx.netlify.app/blog/" style="color:#d97706;font-weight:600">menumindx.netlify.app/blog</a></p>`,
    bodyText: `If you only do one thing from your MenuMind audit, do this:\n\nTake your three best-margin items (the "Stars" in your report) and rewrite their descriptions. Not the prices. Just the words.\n\nThat alone moves average check size by 6-12% in most restaurants we've worked with. The price changes come later.\n\nFull writeup at https://menumindx.netlify.app/blog/`,
  },
  {
    day: 14,
    subject: "Most AI tools fail in restaurants. Here's why.",
    bodyHtml: `<p>Almost every "AI for restaurants" pilot dies for the same reason: the kitchen team doesn't trust it.</p>
<p>We've trained hundreds of small businesses on AI adoption. The technology is 20% of the work. Getting your team to actually use it is the other 80%.</p>
<p>Here's the change-management approach that works in real kitchens: <a href="https://menumindx.netlify.app/blog/restaurant-staff-ai-adoption.html" style="color:#d97706;font-weight:600">read the playbook →</a></p>`,
    bodyText: `Almost every "AI for restaurants" pilot dies for the same reason: the kitchen team doesn't trust it.\n\nWe've trained hundreds of small businesses on AI adoption. The technology is 20% of the work. Getting your team to actually use it is the other 80%.\n\nHere's the change-management approach that works: https://menumindx.netlify.app/blog/restaurant-staff-ai-adoption.html`,
  },
  {
    day: 21,
    subject: "Open invite: 20-minute call to talk through your audit",
    bodyHtml: `<p>You ran a MenuMind audit three weeks ago. If you want a second pair of eyes on it — or you want to see what an actual AI rollout would look like for your specific operation — I'd be happy to do a quick walkthrough.</p>
<p><a href="https://worklocal.ca/demo" style="color:#d97706;font-weight:600">Book a demo →</a></p>
<p>Or just reply to this email with a question. Either works.</p>
<p>This is the last email in the sequence — no more after this unless you ask.</p>`,
    bodyText: `You ran a MenuMind audit three weeks ago. If you want a second pair of eyes on it — or you want to see what an actual AI rollout would look like for your specific operation — I'd be happy to do a quick walkthrough.\n\nBook a demo: https://worklocal.ca/demo\n\nOr just reply with a question. Either works.\n\nThis is the last email in the sequence — no more after this unless you ask.`,
  },
];

function daysSince(iso) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

async function sendOne(email, name, msg) {
  // Escape the stored name before HTML interpolation — even though it's
  // sanitized at write time, an attacker could have crafted it at signup.
  const greetingHtml = name ? `Hi ${escapeHtml(name)},` : "Hi there,";
  const greetingText = name ? `Hi ${name},` : "Hi there,";
  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.55">
<p style="font-size:22px;font-weight:800;color:#0f1117;margin:0 0 8px"><span style="color:#0f1117">Menu</span><span style="color:#d97706">Mind</span></p>
<p>${greetingHtml}</p>
${msg.bodyHtml}
<p style="margin-top:32px">— The MenuMind team<br><span style="color:#666;font-size:13px">by menu.ca · <a href="https://worklocal.ca" style="color:#d97706">worklocal.ca</a></span></p>
<hr style="border:none;border-top:1px solid #eee;margin:32px 0">
<p style="font-size:12px;color:#888">You're getting this because you saved an audit on MenuMind. Reply "stop" to opt out.</p>
</body></html>`;
  const text = `${greetingText}\n\n${msg.bodyText}\n\n— The MenuMind team\nby menu.ca · https://worklocal.ca\n\n---\nReply "stop" to opt out.`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: email,
      subject: msg.subject,
      html,
      text,
      tags: [{ name: "type", value: "drip" }, { name: "day", value: String(msg.day) }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[send-drip] Resend error for ${email}:`, res.status, errText);
    return false;
  }
  return true;
}

exports.handler = async () => {
  if (!RESEND_API_KEY || !FROM_EMAIL) {
    console.warn("[send-drip] RESEND_API_KEY or DRIP_FROM_EMAIL not set — exiting");
    return { statusCode: 200, body: JSON.stringify({ ok: false, reason: "env-missing" }) };
  }

  const store = getStore("audit-leads");
  const list = await store.list();
  let sent = 0;
  let skipped = 0;

  for (const item of list.blobs || []) {
    const record = await store.get(item.key, { type: "json" });
    if (!record || record.unsubscribed) { skipped++; continue; }

    const days = daysSince(record.signupAt);
    // Find the next eligible drip message.
    const next = DRIP.find(d => d.day <= days && d.day > (record.lastSentDay ?? -1));
    if (!next) { skipped++; continue; }

    const ok = await sendOne(record.email, record.name, next);
    if (ok) {
      record.lastSentDay = next.day;
      await store.setJSON(item.key, record);
      sent++;
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, sent, skipped, total: (list.blobs || []).length }),
  };
};
