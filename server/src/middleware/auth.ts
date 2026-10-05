import type { NextFunction, Request, Response } from "express";
import { query } from "../db.js";

export type AuthUser = {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "member";
  avatar: string;
  bio: string;
  city: string;
  age: number | null;
  badgeText: string;
  badgeColor: string;
};

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

function getToken(req: Request): string {
  const header = req.header("X-Session-Id");
  if (header) return header;
  return (req.query.session as string) || "";
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getToken(req);
  if (!token) {
    res.status(401).json({ error: "Не авторизован" });
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
    badge_text: string | null;
    badge_color: string | null;
  }>(
    `SELECT u.id, u.username, u.display_name, u.role, u.avatar, u.bio, u.city, u.age, u.badge_text, u.badge_color
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token],
  );
  const row = result.rows[0];
  if (!row) {
    res.status(401).json({ error: "Сессия истекла" });
    return;
  }
  req.user = {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    avatar: row.avatar || "👤",
    bio: row.bio || "",
    city: row.city || "",
    age: row.age,
    badgeText: row.badge_text || "",
    badgeColor: row.badge_color || "",
  };
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Нет доступа" });
    return;
  }
  next();
}
