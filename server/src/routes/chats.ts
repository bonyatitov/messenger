import { Router } from "express";
import { randomBytes } from "crypto";
import { query } from "../db.js";
import { formatChatTime, formatMskDate, formatMskTime, formatOnline } from "../lib/time.js";
import { extFromContentType, extFromFileName, storage } from "../lib/storage.js";
import { requireAuth } from "../middleware/auth.js";
import { notifyChatMembers } from "./push.js";

const LAST_SEEN_THROTTLE_SEC = 60;

type ReplyTo = { id: number; authorName: string; text: string; imageUrl: string | null } | null;

async function loadReplyTo(replyToId: number | null): Promise<ReplyTo> {
  if (!replyToId) return null;
  const result = await query<{ text: string; image_url: string | null; display_name: string }>(
    `SELECT rm.text, rm.image_url, u.display_name FROM messages rm
     JOIN users u ON u.id = rm.user_id WHERE rm.id = $1`,
    [replyToId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { id: replyToId, authorName: row.display_name, text: row.text || "", imageUrl: row.image_url };
}

async function assertChatMember(chatId: number, userId: number): Promise<boolean> {
  const result = await query("SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2", [chatId, userId]);
  return result.rows.length > 0;
}

// ── /api/chats ──────────────────────────────────────────────────────────────

export const chatsRouter = Router();
chatsRouter.use(requireAuth);

chatsRouter.get("/", async (req, res) => {
  const callerId = req.user!.id;
  const now = new Date();

  await query(
    `UPDATE users SET last_seen = NOW() WHERE id = $1 AND (last_seen IS NULL OR last_seen < NOW() - INTERVAL '${LAST_SEEN_THROTTLE_SEC} seconds')`,
    [callerId],
  );

  const result = await query<{
    id: number;
    name: string | null;
    is_group: boolean;
    avatar: string | null;
    last_text: string | null;
    last_author: string | null;
    last_at: Date | null;
    unread: string;
    other_name: string | null;
    other_avatar: string | null;
    other_last_seen: Date | null;
  }>(
    `SELECT
        c.id, c.name, c.is_group, c.avatar,
        m.text AS last_text,
        mu.display_name AS last_author,
        m.created_at AS last_at,
        (
            SELECT COUNT(*) FROM messages m2
            WHERE m2.chat_id = c.id
            AND m2.user_id != $1
            AND m2.created_at > COALESCE(
                (SELECT MAX(m3.created_at) FROM messages m3
                 WHERE m3.chat_id = c.id AND m3.user_id = $1), '2000-01-01'
            )
        ) AS unread,
        ou.display_name AS other_name,
        ou.avatar AS other_avatar,
        ou.last_seen AS other_last_seen
    FROM chats c
    JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = $1
    LEFT JOIN LATERAL (
        SELECT text, user_id, created_at FROM messages
        WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1
    ) m ON TRUE
    LEFT JOIN users mu ON mu.id = m.user_id
    LEFT JOIN LATERAL (
        SELECT u.display_name, u.avatar, u.last_seen
        FROM chat_members cm2
        JOIN users u ON u.id = cm2.user_id
        WHERE cm2.chat_id = c.id AND cm2.user_id != $1 AND c.is_group = FALSE
        LIMIT 1
    ) ou ON TRUE
    ORDER BY COALESCE(m.created_at, c.created_at) DESC`,
    [callerId],
  );

  const chats = result.rows.map((row) => {
    const isDirectWithOther = !row.is_group && row.other_name;
    return {
      id: row.id,
      name: isDirectWithOther ? row.other_name : row.name,
      avatar: isDirectWithOther ? row.other_avatar || "👤" : row.avatar,
      isGroup: row.is_group,
      lastText: row.last_text || "",
      lastAuthor: row.last_author || "",
      lastAt: formatChatTime(row.last_at, now),
      unread: Number(row.unread || 0),
      onlineStatus: isDirectWithOther ? formatOnline(row.other_last_seen, now) : null,
    };
  });

  res.json({ chats });
});

chatsRouter.post("/direct", async (req, res) => {
  const callerId = req.user!.id;
  const targetId = Number(req.body.targetUserId);
  if (!targetId) {
    res.status(400).json({ error: "Нет targetUserId" });
    return;
  }

  const existing = await query<{ id: number }>(
    `SELECT c.id FROM chats c
     JOIN chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = $1
     JOIN chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = $2
     WHERE c.is_group = FALSE
     LIMIT 1`,
    [callerId, targetId],
  );
  if (existing.rows[0]) {
    res.json({ ok: true, chatId: existing.rows[0].id });
    return;
  }

  const created = await query<{ id: number }>(
    "INSERT INTO chats (name, is_group, avatar, created_by) VALUES ($1, FALSE, $2, $3) RETURNING id",
    ["", "💬", callerId],
  );
  const chatId = created.rows[0].id;
  await query("INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2)", [chatId, callerId]);
  await query("INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2)", [chatId, targetId]);
  res.json({ ok: true, chatId });
});

chatsRouter.post("/group", async (req, res) => {
  const callerId = req.user!.id;
  const name = String(req.body.name || "").trim();
  const avatar = req.body.avatar || "💬";
  const memberIds: number[] = req.body.memberIds || [];
  if (!name) {
    res.status(400).json({ error: "Нет названия чата" });
    return;
  }

  const created = await query<{ id: number }>(
    "INSERT INTO chats (name, is_group, avatar, created_by) VALUES ($1, TRUE, $2, $3) RETURNING id",
    [name, avatar, callerId],
  );
  const chatId = created.rows[0].id;
  const allMembers = Array.from(new Set([callerId, ...memberIds.map(Number)]));
  for (const uid of allMembers) {
    await query("INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [chatId, uid]);
  }
  res.json({ ok: true, chatId });
});

chatsRouter.delete("/:chatId", async (req, res) => {
  const callerId = req.user!.id;
  const chatId = Number(req.params.chatId);
  if (!(await assertChatMember(chatId, callerId))) {
    res.status(403).json({ error: "Нет доступа к чату" });
    return;
  }
  await query("DELETE FROM messages WHERE chat_id = $1", [chatId]);
  await query("DELETE FROM chat_members WHERE chat_id = $1", [chatId]);
  await query("DELETE FROM chats WHERE id = $1", [chatId]);
  res.json({ ok: true });
});

chatsRouter.get("/:chatId/messages", async (req, res) => {
  const callerId = req.user!.id;
  const chatId = Number(req.params.chatId);
  if (!(await assertChatMember(chatId, callerId))) {
    res.status(403).json({ error: "Нет доступа к чату" });
    return;
  }

  const since = req.query.since ? Number(req.query.since) : null;
  const baseSelect = `
    SELECT m.id, m.text, m.image_url, m.created_at, u.id AS user_id, u.display_name, u.avatar,
           m.reply_to_id, ru.display_name AS reply_author, rm.text AS reply_text, rm.image_url AS reply_image_url,
           d.id AS doc_id, d.file_name, d.file_size, d.file_type, d.cdn_url, d.expires_at
    FROM messages m
    JOIN users u ON u.id = m.user_id
    LEFT JOIN messages rm ON rm.id = m.reply_to_id
    LEFT JOIN users ru ON ru.id = rm.user_id
    LEFT JOIN chat_documents d ON d.message_id = m.id
  `;

  const result = since
    ? await query(`${baseSelect} WHERE m.chat_id = $1 AND m.id > $2 ORDER BY m.created_at ASC`, [chatId, since])
    : await query(`${baseSelect} WHERE m.chat_id = $1 ORDER BY m.created_at ASC LIMIT 100`, [chatId]);

  const messages = (result.rows as Record<string, unknown>[]).map((r) => ({
    id: r.id,
    text: r.text,
    imageUrl: r.image_url,
    time: r.created_at ? formatMskTime(r.created_at as Date) : "",
    date: r.created_at ? formatMskDate(r.created_at as Date) : "",
    userId: r.user_id,
    displayName: r.display_name,
    avatar: r.avatar || "👤",
    isMe: r.user_id === callerId,
    replyTo: r.reply_to_id
      ? { id: r.reply_to_id, authorName: r.reply_author || "?", text: r.reply_text || "", imageUrl: r.reply_image_url }
      : null,
    document: r.doc_id
      ? {
          id: r.doc_id,
          fileName: r.file_name,
          fileSize: r.file_size,
          fileType: r.file_type,
          url: r.cdn_url,
          expiresAt: r.expires_at ? (r.expires_at as Date).toISOString() : null,
        }
      : null,
  }));

  res.json({ messages });
});

chatsRouter.post("/:chatId/messages", async (req, res) => {
  const caller = req.user!;
  const chatId = Number(req.params.chatId);
  const text = String(req.body.text || "").trim();
  if (!text) {
    res.status(400).json({ error: "Нет chatId или текста" });
    return;
  }
  if (!(await assertChatMember(chatId, caller.id))) {
    res.status(403).json({ error: "Нет доступа к чату" });
    return;
  }

  const replyToId = req.body.replyToId ? Number(req.body.replyToId) : null;
  const inserted = await query<{ id: number; created_at: Date }>(
    "INSERT INTO messages (chat_id, user_id, text, reply_to_id) VALUES ($1, $2, $3, $4) RETURNING id, created_at",
    [chatId, caller.id, text, replyToId],
  );
  const { id: msgId, created_at: createdAt } = inserted.rows[0];
  const replyTo = await loadReplyTo(replyToId);

  res.json({
    message: {
      id: msgId,
      text,
      imageUrl: null,
      time: formatMskTime(createdAt),
      date: formatMskDate(createdAt),
      userId: caller.id,
      displayName: caller.displayName,
      avatar: caller.avatar,
      isMe: true,
      replyTo,
    },
  });
});

chatsRouter.post("/:chatId/photos", async (req, res) => {
  const caller = req.user!;
  const chatId = Number(req.params.chatId);
  const imageBase64 = req.body.imageBase64 as string | undefined;
  const imageType = (req.body.imageType as string) || "image/jpeg";
  const caption = String(req.body.caption || "").trim();

  if (!imageBase64) {
    res.status(400).json({ error: "Нет chatId или фото" });
    return;
  }
  if (!(await assertChatMember(chatId, caller.id))) {
    res.status(403).json({ error: "Нет доступа к чату" });
    return;
  }

  const buffer = Buffer.from(imageBase64, "base64");
  const { url: imageUrl } = await storage.save(buffer, `chat_photos/${chatId}`, extFromContentType(imageType), imageType);
  const text = caption || "📷 Фото";
  const replyToId = req.body.replyToId ? Number(req.body.replyToId) : null;

  const inserted = await query<{ id: number; created_at: Date }>(
    "INSERT INTO messages (chat_id, user_id, text, image_url, reply_to_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at",
    [chatId, caller.id, text, imageUrl, replyToId],
  );
  const { id: msgId, created_at: createdAt } = inserted.rows[0];
  const replyTo = await loadReplyTo(replyToId);

  res.json({
    message: {
      id: msgId,
      text,
      imageUrl,
      time: formatMskTime(createdAt),
      date: formatMskDate(createdAt),
      userId: caller.id,
      displayName: caller.displayName,
      avatar: caller.avatar,
      isMe: true,
      replyTo,
    },
  });
});

chatsRouter.post("/:chatId/documents", async (req, res) => {
  const caller = req.user!;
  const chatId = Number(req.params.chatId);
  const fileBase64 = String(req.body.fileBase64 || "");
  const fileName = String(req.body.fileName || "document").trim();
  const fileType = String(req.body.fileType || "application/octet-stream").trim();
  const fileSize = Number(req.body.fileSize || 0);

  if (!fileBase64) {
    res.status(400).json({ error: "chatId и fileBase64 обязательны" });
    return;
  }
  if (!(await assertChatMember(chatId, caller.id))) {
    res.status(403).json({ error: "Нет доступа к чату" });
    return;
  }

  // Чистим просроченные документы при каждом вызове
  const expired = await query<{ s3_key: string }>("SELECT s3_key FROM chat_documents WHERE expires_at < NOW()");
  for (const row of expired.rows) {
    await storage.delete(row.s3_key);
  }
  if (expired.rows.length) await query("DELETE FROM chat_documents WHERE expires_at < NOW()");

  const buffer = Buffer.from(fileBase64, "base64");
  const { key, url: cdnUrl } = await storage.save(buffer, `documents/${chatId}`, extFromFileName(fileName), fileType);

  const msgText = `📎 ${fileName}`;
  const msgInsert = await query<{ id: number }>(
    "INSERT INTO messages (chat_id, user_id, text) VALUES ($1, $2, $3) RETURNING id",
    [chatId, caller.id, msgText],
  );
  const msgId = msgInsert.rows[0].id;

  const docInsert = await query<{ id: number; expires_at: Date }>(
    `INSERT INTO chat_documents (chat_id, message_id, user_id, file_name, file_size, file_type, s3_key, cdn_url, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() + INTERVAL '24 hours')
     RETURNING id, expires_at`,
    [chatId, msgId, caller.id, fileName, fileSize, fileType, key, cdnUrl],
  );
  const { id: docId, expires_at: expiresAt } = docInsert.rows[0];
  await query("UPDATE chats SET last_message_at = NOW() WHERE id = $1", [chatId]);

  const now = new Date();
  res.json({
    message: {
      id: msgId,
      text: msgText,
      time: formatMskTime(now),
      date: formatMskDate(now),
      userId: caller.id,
      displayName: caller.displayName,
      avatar: caller.avatar,
      isMe: true,
      imageUrl: null,
      replyTo: null,
      document: {
        id: docId,
        fileName,
        fileSize,
        fileType,
        url: cdnUrl,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
      },
    },
  });
});

chatsRouter.get("/:chatId/documents", async (req, res) => {
  const caller = req.user!;
  const chatId = Number(req.params.chatId);
  if (!(await assertChatMember(chatId, caller.id))) {
    res.status(403).json({ error: "Нет доступа" });
    return;
  }
  const result = await query<{
    id: number;
    message_id: number;
    file_name: string;
    file_size: number;
    file_type: string;
    cdn_url: string;
    expires_at: Date;
  }>(
    `SELECT id, message_id, file_name, file_size, file_type, cdn_url, expires_at
     FROM chat_documents WHERE chat_id = $1 AND expires_at > NOW() ORDER BY created_at DESC`,
    [chatId],
  );
  res.json({
    documents: result.rows.map((r) => ({
      id: r.id,
      messageId: r.message_id,
      fileName: r.file_name,
      fileSize: r.file_size,
      fileType: r.file_type,
      url: r.cdn_url,
      expiresAt: r.expires_at ? r.expires_at.toISOString() : null,
    })),
  });
});

chatsRouter.get("/:chatId/members", async (req, res) => {
  const caller = req.user!;
  const chatId = Number(req.params.chatId);
  if (!(await assertChatMember(chatId, caller.id))) {
    res.status(403).json({ error: "Нет доступа" });
    return;
  }
  const members = await query<{ id: number; display_name: string; avatar: string | null; last_seen: Date | null }>(
    `SELECT u.id, u.display_name, u.avatar, u.last_seen
     FROM users u JOIN chat_members cm ON cm.user_id = u.id
     WHERE cm.chat_id = $1 ORDER BY u.display_name`,
    [chatId],
  );
  const chatRow = await query<{ created_by: number | null }>("SELECT created_by FROM chats WHERE id = $1", [chatId]);
  const creatorId = chatRow.rows[0]?.created_by ?? null;
  const now = new Date();
  res.json({
    members: members.rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      avatar: r.avatar || "👤",
      onlineStatus: formatOnline(r.last_seen, now),
      isCreator: r.id === creatorId,
    })),
    creatorId,
    callerId: caller.id,
  });
});

chatsRouter.post("/:chatId/members", async (req, res) => {
  const caller = req.user!;
  const chatId = Number(req.params.chatId);
  const userId = Number(req.body.userId || 0);
  if (!chatId || !userId) {
    res.status(400).json({ error: "Нет chatId или userId" });
    return;
  }
  const chatRow = await query<{ is_group: boolean }>("SELECT is_group FROM chats WHERE id = $1", [chatId]);
  if (!chatRow.rows[0] || !chatRow.rows[0].is_group) {
    res.status(400).json({ error: "Чат не найден или не групповой" });
    return;
  }
  if (!(await assertChatMember(chatId, caller.id))) {
    res.status(403).json({ error: "Нет доступа" });
    return;
  }
  await query("INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [chatId, userId]);
  res.json({ ok: true });
});

chatsRouter.delete("/:chatId/members/:userId", async (req, res) => {
  const caller = req.user!;
  const chatId = Number(req.params.chatId);
  const userId = Number(req.params.userId);
  const chatRow = await query<{ created_by: number | null }>("SELECT created_by FROM chats WHERE id = $1", [chatId]);
  const creatorId = chatRow.rows[0]?.created_by ?? null;
  if (caller.id !== creatorId && caller.id !== userId) {
    res.status(403).json({ error: "Только создатель может удалять участников" });
    return;
  }
  await query("DELETE FROM chat_members WHERE chat_id = $1 AND user_id = $2", [chatId, userId]);
  res.json({ ok: true });
});

chatsRouter.post("/:chatId/notify", async (req, res) => {
  const caller = req.user!;
  const chatId = Number(req.params.chatId);
  const title = String(req.body.title || "Семейка");
  const message = String(req.body.message || "Новое сообщение");
  const result = await notifyChatMembers(chatId, caller.id, title, message);
  res.json(result);
});

// ── /api/family ──────────────────────────────────────────────────────────────

export const familyRouter = Router();
familyRouter.use(requireAuth);

type FamilyRow = {
  id: number;
  display_name: string;
  avatar: string | null;
  city: string | null;
  last_seen: Date | null;
  role: string | null;
  in_family: boolean;
  badge_text: string | null;
  badge_color: string | null;
};

familyRouter.get("/", async (req, res) => {
  const caller = req.user!;
  const isAdmin = caller.role === "admin";
  const now = new Date();

  const result = isAdmin
    ? await query<FamilyRow>(
        `SELECT u.id, u.display_name, u.avatar, u.city, u.last_seen, u.role,
            EXISTS(SELECT 1 FROM family_members fm WHERE fm.user_id = $1 AND fm.member_id = u.id) as in_family,
            u.badge_text, u.badge_color
         FROM users u WHERE u.id != $1 ORDER BY u.display_name`,
        [caller.id],
      )
    : await query<FamilyRow>(
        `SELECT u.id, u.display_name, u.avatar, u.city, u.last_seen, u.role, true as in_family,
            u.badge_text, u.badge_color
         FROM users u
         JOIN family_members fm ON fm.member_id = u.id AND fm.user_id = $1
         WHERE u.id != $1 ORDER BY u.display_name`,
        [caller.id],
      );

  res.json({
    isAdmin,
    users: result.rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      avatar: r.avatar || "👤",
      city: r.city || "",
      onlineStatus: formatOnline(r.last_seen, now),
      role: r.role || "member",
      inFamily: r.in_family,
      badgeText: r.badge_text || "",
      badgeColor: r.badge_color || "",
    })),
  });
});

familyRouter.post("/:memberId", async (req, res) => {
  const caller = req.user!;
  const memberId = Number(req.params.memberId);
  await query("INSERT INTO family_members (user_id, member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
    caller.id,
    memberId,
  ]);
  res.json({ ok: true });
});

familyRouter.delete("/:memberId", async (req, res) => {
  const caller = req.user!;
  const memberId = Number(req.params.memberId);
  await query("DELETE FROM family_members WHERE user_id = $1 AND member_id = $2", [caller.id, memberId]);
  res.json({ ok: true });
});

// ── /api/users ────────────────────────────────────────────────────────────────

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get("/search", async (req, res) => {
  const caller = req.user!;
  const q = String(req.query.q || "").trim().toLowerCase();
  if (q.length < 2) {
    res.json({ users: [] });
    return;
  }
  const now = new Date();
  const result = await query<{
    id: number;
    display_name: string;
    avatar: string | null;
    city: string | null;
    last_seen: Date | null;
    role: string | null;
    in_family: boolean;
    badge_text: string | null;
    badge_color: string | null;
  }>(
    `SELECT u.id, u.display_name, u.avatar, u.city, u.last_seen, u.role,
        EXISTS(SELECT 1 FROM family_members fm WHERE fm.user_id = $1 AND fm.member_id = u.id) as in_family,
        u.badge_text, u.badge_color
     FROM users u
     WHERE u.id != $1 AND (LOWER(u.display_name) LIKE $2 OR LOWER(u.username) LIKE $2)
     ORDER BY u.display_name LIMIT 20`,
    [caller.id, `%${q}%`],
  );
  res.json({
    users: result.rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      avatar: r.avatar || "👤",
      city: r.city || "",
      onlineStatus: formatOnline(r.last_seen, now),
      role: r.role || "member",
      inFamily: r.in_family,
      badgeText: r.badge_text || "",
      badgeColor: r.badge_color || "",
    })),
  });
});

usersRouter.get("/:userId", async (req, res) => {
  const targetId = Number(req.params.userId);
  const now = new Date();
  const result = await query<{
    id: number;
    display_name: string;
    avatar: string | null;
    city: string | null;
    age: number | null;
    last_seen: Date | null;
    role: string | null;
    badge_text: string | null;
    badge_color: string | null;
  }>(
    `SELECT u.id, u.display_name, u.avatar, u.city, u.age, u.last_seen, u.role, u.badge_text, u.badge_color
     FROM users u WHERE u.id = $1`,
    [targetId],
  );
  const row = result.rows[0];
  if (!row) {
    res.status(404).json({ error: "Пользователь не найден" });
    return;
  }
  res.json({
    user: {
      id: row.id,
      displayName: row.display_name,
      avatar: row.avatar || "👤",
      city: row.city || "",
      age: row.age,
      onlineStatus: formatOnline(row.last_seen, now),
      role: row.role || "member",
      badgeText: row.badge_text || "",
      badgeColor: row.badge_color || "",
    },
  });
});
