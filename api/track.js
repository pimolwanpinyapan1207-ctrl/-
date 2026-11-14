// Vercel serverless function: GET /api/track?barcode=EF123456789TH  (or several: ?barcode=EF1…TH,EQ2…TH, up to 100)
// Asks Thailand Post's Track & Trace API for a parcel's history and returns who received it, when, and the
// signature image when Thailand Post has one.
// The Thailand Post API key lives only in the Vercel environment variable THPOST_API_KEY, never in the page.
// The tracker has no sign-in, so anyone who opens the site may call it.

const TP = "https://trackapi.thailandpost.co.th/post/api/v1";
const BARCODE = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

let cached = { token: "", until: 0 }; // Thailand Post issues a short-lived token from the long-lived API key

async function thpostToken() {
  if (cached.token && Date.now() < cached.until) return cached.token;
  const r = await fetch(TP + "/authenticate/token", {
    method: "POST",
    headers: { Authorization: "Token " + process.env.THPOST_API_KEY, "Content-Type": "application/json" },
  });
  if (!r.ok) throw Object.assign(new Error("thpost_auth_" + r.status), { status: 502 });
  const j = await r.json();
  cached = { token: j.token, until: Date.now() + 50 * 60 * 1000 };
  return j.token;
}

// "19/07/2569 18:12:26+07:00" (Buddhist-era year) → { date: "2026-07-19", time: "18:12" }
function splitDate(s) {
  const m = String(s || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) return { date: "", time: "" };
  let y = +m[3]; if (y > 2400) y -= 543;
  return { date: y + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0"), time: m[4].padStart(2, "0") + ":" + m[5] };
}

// one parcel's events → what the tracker needs
function summarize(barcode, items) {
  const events = (items || []).map((e) => ({
    status: e.status, text: e.status_description || "", location: e.location || "",
    ...splitDate(e.status_date), receiver: e.receiver_name || "", delivery: e.delivery_status || "",
    deliveredAt: e.delivery_datetime ? splitDate(e.delivery_datetime) : null,
    signature: /^https?:\/\//.test(e.signature || "") ? e.signature : "",
  }));
  // 501 = นำจ่ายสำเร็จ (delivered); delivery_status "S" marks a successful hand-over
  const done = [...events].reverse().find((e) => e.status === "501" || e.delivery === "S");
  const last = events[events.length - 1] || null;
  const at = done && done.deliveredAt && done.deliveredAt.date ? done.deliveredAt : done;
  return {
    barcode, found: events.length > 0, delivered: !!done,
    receiver: done ? done.receiver : "", date: at ? at.date : "", time: at ? at.time : "",
    signature: done ? done.signature : "", location: done ? done.location : "",
    latest: last, events,
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const send = (code, body) => res.status(code).json(body);
  try {
    if (!process.env.THPOST_API_KEY) return send(503, { error: "not_configured", message: "ยังไม่ได้ใส่ THPOST_API_KEY ใน Vercel" });

    const list = [...new Set(String(req.query.barcode || "").toUpperCase().split(",").map((b) => b.replace(/\s+/g, "")).filter(Boolean))];
    if (!list.length || list.length > 100 || !list.every((b) => BARCODE.test(b))) return send(400, { error: "barcode", message: "เลขพัสดุไม่ถูกต้อง" });

    const r = await fetch(TP + "/track", {
      method: "POST",
      headers: { Authorization: "Token " + (await thpostToken()), "Content-Type": "application/json" },
      body: JSON.stringify({ status: "all", language: "TH", barcode: list }),
    });
    if (!r.ok) return send(502, { error: "thpost_" + r.status, message: "ไปรษณีย์ไทยไม่ตอบกลับ ลองใหม่อีกครั้ง" });
    const j = await r.json();
    const items = (j.response && j.response.items) || {};
    // one barcode: the parcel itself (as before); several: { results: { barcode: parcel } }
    if (list.length === 1) return send(200, summarize(list[0], items[list[0]]));
    return send(200, { results: Object.fromEntries(list.map((b) => [b, summarize(b, items[b])])) });
  } catch (err) {
    return send(err.status || 500, { error: "server", message: "เช็คสถานะไม่สำเร็จ ลองใหม่อีกครั้ง" });
  }
};
