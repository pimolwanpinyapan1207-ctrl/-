// Vercel serverless function: GET /api/track?barcode=EF123456789TH
// Asks Thailand Post's Track & Trace API for a parcel's history and returns who received it and when.
// The Thailand Post API key lives only in the Vercel environment variable THPOST_API_KEY, never in the page.
// Only people signed in to the tracker (a valid Supabase session) may call it.

const SUPABASE_URL = "https://urqkmzqtmvwkmezadnke.supabase.co";
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVycWttenF0bXZ3a21lemFkbmtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3OTMwMTMsImV4cCI6MjEwNzM2OTAxM30.AWyx6WE6_uA_z6XLpbz-sxSltdbBMnFiUykXLkbCU4w";
const TP = "https://trackapi.thailandpost.co.th/post/api/v1";

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

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const send = (code, body) => res.status(code).json(body);
  try {
    if (!process.env.THPOST_API_KEY) return send(503, { error: "not_configured", message: "ยังไม่ได้ใส่ THPOST_API_KEY ใน Vercel" });

    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) return send(401, { error: "signin", message: "ต้องเข้าสู่ระบบก่อน" });
    const who = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: { apikey: SUPABASE_ANON, Authorization: auth } });
    if (!who.ok) return send(401, { error: "signin", message: "ต้องเข้าสู่ระบบก่อน" });

    const barcode = String(req.query.barcode || "").replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(barcode)) return send(400, { error: "barcode", message: "เลขพัสดุไม่ถูกต้อง" });

    const r = await fetch(TP + "/track", {
      method: "POST",
      headers: { Authorization: "Token " + (await thpostToken()), "Content-Type": "application/json" },
      body: JSON.stringify({ status: "all", language: "TH", barcode: [barcode] }),
    });
    if (!r.ok) return send(502, { error: "thpost_" + r.status, message: "ไปรษณีย์ไทยไม่ตอบกลับ ลองใหม่อีกครั้ง" });
    const j = await r.json();
    const items = (j.response && j.response.items && j.response.items[barcode]) || [];
    const events = items.map((e) => ({
      status: e.status, text: e.status_description || "", location: e.location || "",
      ...splitDate(e.status_date), receiver: e.receiver_name || "", delivery: e.delivery_status || "",
    }));
    // 501 = นำจ่ายสำเร็จ (delivered); delivery_status "S" marks a successful hand-over
    const done = [...events].reverse().find((e) => e.status === "501" || e.delivery === "S");
    const last = events[events.length - 1] || null;
    return send(200, {
      barcode, found: events.length > 0, delivered: !!done,
      receiver: done ? done.receiver : "", date: done ? done.date : "", time: done ? done.time : "",
      latest: last, events,
    });
  } catch (err) {
    return send(err.status || 500, { error: "server", message: "เช็คสถานะไม่สำเร็จ ลองใหม่อีกครั้ง" });
  }
};
