import { Router } from "express";
import { randomBytes } from "crypto";
import { query } from "../db.js";
import { checkPassword, hashPassword } from "../lib/password.js";
import { extFromContentType, storage } from "../lib/storage.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();

const SESSION_DURATION_DAYS = 30;
const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 30;

async function getAttemptCount(username: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM login_attempts WHERE username = $1 AND attempted_at > NOW() - INTERVAL '${LOCKOUT_MINUTES} minutes'`,
    [username],
  );
  return Number(result.rows[0].count);
}

async function recordAttempt(username: string, ip: string): Promise<void> {
  await query("INSERT INTO login_attempts (username, ip) VALUES ($1, $2)", [username, ip]);
}

async function clearAttempts(username: string): Promise<void> {
  await query("DELETE FROM login_attempts WHERE username = $1", [username]);
}

router.post("/login", async (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!username || !password) {
    res.status(400).json({ error: "Укажите логин и пароль" });
    return;
  }

  const ip = req.ip || "";
  const attemptsBefore = await getAttemptCount(username);
  if (attemptsBefore >= MAX_LOGIN_ATTEMPTS) {
    res.status(423).json({
      error: "Превышено количество попыток входа. Пожалуйста, свяжитесь с администратором для восстановления доступа.",
      locked: true,
    });
    return;
  }

  const result = await query<{
    id: number;
    username: string;
    display_name: string;
    role: "admin" | "member";
    avatar: string | null;
    bio: string | null;
    city: string | null;
    age: number | null;
    password_hash: string;
  }>(
    "SELECT id, username, display_name, role, avatar, bio, city, age, password_hash FROM users WHERE LOWER(username) = $1",
    [username],
  );
  const row = result.rows[0];

  if (!row || !checkPassword(password, row.password_hash)) {
    await recordAttempt(username, ip);
    const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - attemptsBefore - 1);
    if (remaining === 0) {
      res.status(423).json({
        error: "Превышено количество попыток входа. Пожалуйста, свяжитесь с администратором для восстановления доступа.",
        locked: true,
      });
      return;
    }
    res.status(401).json({
      error: `Неверный логин или пароль. Осталось попыток: ${remaining}`,
      attemptsLeft: remaining,
    });
    return;
  }

  await clearAttempts(username);
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 86400 * 1000);
  await query("INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)", [row.id, token, expiresAt]);
  await query("UPDATE users SET last_seen = NOW() WHERE id = $1", [row.id]);

  res.json({
    token,
    user: {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
      avatar: row.avatar || "👤",
      bio: row.bio || "",
      city: row.city || "",
      age: row.age,
    },
  });
});

router.post("/logout", async (req, res) => {
  const token = req.header("X-Session-Id");
  if (token) await query("DELETE FROM sessions WHERE token = $1", [token]);
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  await query("UPDATE users SET last_seen = NOW() WHERE id = $1", [req.user!.id]);
  res.json({ user: req.user });
});

router.get("/users", requireAuth, requireAdmin, async (_req, res) => {
  const result = await query<{
    id: number;
    username: string;
    display_name: string;
    role: string;
    avatar: string | null;
    city: string | null;
    age: number | null;
    created_at: Date;
    badge_text: string | null;
    badge_color: string | null;
  }>(
    "SELECT id, username, display_name, role, avatar, city, age, created_at, badge_text, badge_color FROM users ORDER BY id",
  );
  res.json({
    users: result.rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      role: r.role,
      avatar: r.avatar || "👤",
      city: r.city || "",
      age: r.age,
      createdAt: r.created_at,
      badgeText: r.badge_text || "",
      badgeColor: r.badge_color || "",
    })),
  });
});

router.post("/users", requireAuth, requireAdmin, async (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const displayName = String(req.body.displayName || "").trim();
  const password = String(req.body.password || "").trim();
  const role = req.body.role || "member";
  const avatar = req.body.avatar || "👤";
  const bio = req.body.bio || "";
  const city = req.body.city || "";
  const age = req.body.age ?? null;

  if (!username || !displayName || !password) {
    res.status(400).json({ error: "Заполните все поля" });
    return;
  }

  try {
    const result = await query<{ id: number }>(
      "INSERT INTO users (username, display_name, password_hash, role, avatar, bio, city, age) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
      [username, displayName, hashPassword(password), role, avatar, bio, city, age],
    );
    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("unique")) {
      res.status(409).json({ error: "Такой логин уже существует" });
      return;
    }
    throw err;
  }
});

router.delete("/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const targetId = Number(req.params.id);
  if (req.user!.id === targetId) {
    res.status(400).json({ error: "Нельзя удалить себя" });
    return;
  }
  await query("DELETE FROM sessions WHERE user_id = $1", [targetId]);
  await query("DELETE FROM messages WHERE user_id = $1", [targetId]);
  await query("DELETE FROM chat_members WHERE user_id = $1", [targetId]);
  await query("DELETE FROM users WHERE id = $1", [targetId]);
  res.json({ ok: true });
});

router.patch("/me/password", requireAuth, async (req, res) => {
  const oldPassword = String(req.body.oldPassword || "");
  const newPassword = String(req.body.newPassword || "").trim();
  if (!oldPassword || !newPassword) {
    res.status(400).json({ error: "Укажите старый и новый пароль" });
    return;
  }
  if (newPassword.length < 4) {
    res.status(400).json({ error: "Пароль должен быть не короче 4 символов" });
    return;
  }
  const result = await query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [req.user!.id]);
  const row = result.rows[0];
  if (!row || !checkPassword(oldPassword, row.password_hash)) {
    res.status(400).json({ error: "Неверный текущий пароль" });
    return;
  }
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [hashPassword(newPassword), req.user!.id]);
  res.json({ ok: true });
});

router.patch("/me/avatar", requireAuth, async (req, res) => {
  const emoji = req.body.emoji as string | undefined;
  const imageBase64 = req.body.imageBase64 as string | undefined;
  const imageType = (req.body.imageType as string) || "image/jpeg";

  if (emoji) {
    await query("UPDATE users SET avatar = $1 WHERE id = $2", [emoji, req.user!.id]);
    res.json({ ok: true, avatar: emoji });
    return;
  }

  if (imageBase64) {
    const buffer = Buffer.from(imageBase64, "base64");
    const { url } = await storage.save(buffer, "avatars", extFromContentType(imageType), imageType);
    await query("UPDATE users SET avatar = $1 WHERE id = $2", [url, req.user!.id]);
    res.json({ ok: true, avatar: url });
    return;
  }

  res.status(400).json({ error: "Нет данных для обновления" });
});

router.patch("/users/:id/badge", requireAuth, requireAdmin, async (req, res) => {
  const targetId = Number(req.params.id);
  const badgeText = String(req.body.badgeText || "").trim().slice(0, 32);
  const badgeColor = String(req.body.badgeColor || "").trim().slice(0, 32);
  if (!targetId) {
    res.status(400).json({ error: "userId required" });
    return;
  }
  await query("UPDATE users SET badge_text = $1, badge_color = $2 WHERE id = $3", [
    badgeText || null,
    badgeColor || null,
    targetId,
  ]);
  res.json({ ok: true });
});

router.post("/users/:id/reset-password", requireAuth, requireAdmin, async (req, res) => {
  const targetId = Number(req.params.id);
  const newPassword = String(req.body.newPassword || "").trim();
  if (!targetId || !newPassword) {
    res.status(400).json({ error: "Укажите userId и newPassword" });
    return;
  }
  if (newPassword.length < 4) {
    res.status(400).json({ error: "Пароль должен быть не короче 4 символов" });
    return;
  }
  const target = await query<{ username: string }>("SELECT username FROM users WHERE id = $1", [targetId]);
  if (!target.rows[0]) {
    res.status(404).json({ error: "Пользователь не найден" });
    return;
  }
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [hashPassword(newPassword), targetId]);
  await clearAttempts(target.rows[0].username);
  await query("DELETE FROM sessions WHERE user_id = $1", [targetId]);
  res.json({ ok: true });
});

router.patch("/me/profile", requireAuth, async (req, res) => {
  const displayName = String(req.body.displayName || "").trim();
  let age = req.body.age;

  if (!displayName) {
    res.status(400).json({ error: "Имя не может быть пустым" });
    return;
  }
  if (displayName.length > 64) {
    res.status(400).json({ error: "Имя слишком длинное" });
    return;
  }
  if (age !== null && age !== undefined) {
    age = Number(age);
    if (!Number.isInteger(age) || age < 1 || age > 120) {
      res.status(400).json({ error: "Некорректный возраст" });
      return;
    }
  } else {
    age = null;
  }

  await query("UPDATE users SET display_name = $1, age = $2 WHERE id = $3", [displayName, age, req.user!.id]);
  res.json({ ok: true, displayName, age });
});

export default router;
