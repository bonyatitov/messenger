import { Router } from "express";
import webpush from "web-push";
import { query } from "../db.js";
import { env } from "../env.js";
import { requireAuth } from "../middleware/auth.js";

const VAPID_EMAIL = "mailto:support@semejka.app";

if (env.vapidPublicKey && env.vapidPrivateKey) {
  webpush.setVapidDetails(VAPID_EMAIL, env.vapidPublicKey, env.vapidPrivateKey);
}

export async function notifyChatMembers(
  chatId: number,
  callerId: number,
  title: string,
  message: string,
): Promise<{ sent: number; failed: number }> {
  const result = await query<{ endpoint: string; p256dh: string; auth: string }>(
    `SELECT ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN chat_members cm ON cm.user_id = ps.user_id
     WHERE cm.chat_id = $1 AND ps.user_id != $2`,
    [chatId, callerId],
  );

  if (!result.rows.length) return { sent: 0, failed: 0 };

  const payload = JSON.stringify({ title, body: message, chatId });
  let sent = 0;
  let failed = 0;

  for (const row of result.rows) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        payload,
      );
      sent++;
    } catch {
      failed++;
    }
  }

  return { sent, failed };
}

export const pushRouter = Router();

pushRouter.get("/vapid-key", (_req, res) => {
  res.json({ publicKey: env.vapidPublicKey });
});

pushRouter.post("/subscriptions", requireAuth, async (req, res) => {
  const { endpoint, p256dh, auth } = req.body as { endpoint?: string; p256dh?: string; auth?: string };
  if (!endpoint || !p256dh || !auth) {
    res.status(400).json({ error: "Нет данных подписки" });
    return;
  }
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [req.user!.id, endpoint, p256dh, auth],
  );
  res.json({ ok: true });
});

pushRouter.delete("/subscriptions", requireAuth, async (req, res) => {
  const endpoint = (req.body as { endpoint?: string })?.endpoint;
  if (endpoint) {
    await query("DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2", [req.user!.id, endpoint]);
  }
  res.json({ ok: true });
});
