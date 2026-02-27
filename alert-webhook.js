import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // optional security
  const secret = req.headers["x-webhook-secret"];
  if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).send("Unauthorized");
  }

  const payload = req.body;
  const alert = payload.record ?? payload;

  const title = alert.title ?? "System Alert";
  const body = alert.message ?? "New alert received.";
  const url = process.env.ALERT_CLICK_URL ?? "/";

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth");

  if (error) return res.status(500).json({ error: error.message });
  if (!subs?.length) return res.status(200).json({ ok: true, sent: 0 });

  await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title, body, url })
      )
    )
  );

  res.status(200).json({ ok: true, sent: subs.length });
}
