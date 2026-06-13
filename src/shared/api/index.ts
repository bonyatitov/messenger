const AUTH_URL = "https://functions.poehali.dev/edf73421-b68d-45e4-b213-33d088c52f8c";
const MSG_URL = "https://functions.poehali.dev/2d67e06c-c5a9-42e8-b7f8-8b7345619100";

export type Chat = {
  id: number;
  name: string;
  avatar: string;
  isGroup: boolean;
  lastText: string;
  lastAuthor: string;
  lastAt: string;
  unread: number;
  onlineStatus?: string | null;
};

export type Message = {
  id: number;
  text: string;
  imageUrl?: string | null;
  time: string;
  userId: number;
  displayName: string;
  avatar: string;
  isMe: boolean;
};

export type User = {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "member";
  avatar: string;
  bio: string;
  city: string;
  age: number | null;
  badgeText?: string;
  badgeColor?: string;
};

function getToken() {
  return localStorage.getItem("fc_session") || "";
}

async function call(method: string, action: string, body?: object) {
  const isGet = method === "GET";
  const url = isGet ? `${AUTH_URL}?action=${action}` : AUTH_URL;
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-Session-Id": token } : {}),
      },
      ...(isGet ? {} : { body: JSON.stringify({ action, ...body }) }),
    });
  } catch {
    throw new Error("Нет соединения с сервером. Проверьте интернет.");
  }
  const text = await res.text();
  let data: unknown;
  try {
    const parsed = JSON.parse(text);
    data = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
  } catch { data = {}; }
  return { status: res.status, data: data as Record<string, unknown> };
}

async function msgCall(method: string, action: string, body?: object) {
  const isGet = method === "GET";
  const token = getToken();
  const params = new URLSearchParams({ action, ...(isGet && body ? body as Record<string, string> : {}) });
  const url = isGet ? `${MSG_URL}?${params}` : MSG_URL;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-Session-Id": token } : {}),
      },
      ...(isGet ? {} : { body: JSON.stringify({ action, ...body }) }),
    });
  } catch {
    throw new Error("Нет соединения с сервером. Проверьте интернет.");
  }
  const text = await res.text();
  let data: unknown;
  try {
    const parsed = JSON.parse(text);
    data = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
  } catch { data = {}; }
  return { status: res.status, data: data as Record<string, unknown> };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export class LoginLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoginLockedError";
  }
}

export async function login(username: string, password: string) {
  const { status, data } = await call("POST", "login", { username, password });
  if (status === 423 || data?.locked) throw new LoginLockedError((data?.error as string) || "Доступ заблокирован");
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка входа");
  localStorage.setItem("fc_session", data.token as string);
  return data.user as User;
}

export async function resetPasswordAdmin(userId: number, newPassword: string): Promise<void> {
  const { status, data } = await call("POST", "reset_password_admin", { userId, newPassword });
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка сброса пароля");
}

export async function getMe(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;
  const { status, data } = await call("GET", "me");
  if (status !== 200) {
    localStorage.removeItem("fc_session");
    return null;
  }
  return data.user as User;
}

export async function logout() {
  await call("POST", "logout");
  localStorage.removeItem("fc_session");
}

export async function listUsers(): Promise<User[]> {
  const { status, data } = await call("GET", "list_users");
  if (status !== 200) throw new Error((data?.error as string) || "Нет доступа");
  return data.users as User[];
}

export async function createUser(user: {
  username: string;
  displayName: string;
  password: string;
  role: string;
  avatar: string;
  city: string;
  age: number | null;
  bio: string;
}) {
  const { status, data } = await call("POST", "create_user", user);
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка создания");
  return data;
}

export async function deleteUser(userId: number) {
  const { status, data } = await call("POST", "delete_user", { userId });
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка удаления");
  return data;
}

export async function changePassword(oldPassword: string, newPassword: string) {
  const { status, data } = await call("POST", "change_password", { oldPassword, newPassword });
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка смены пароля");
  return data;
}

export async function updateAvatar(payload: { emoji?: string; imageBase64?: string; imageType?: string }): Promise<string> {
  const { status, data } = await call("POST", "update_avatar", payload);
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка обновления аватара");
  return data.avatar as string;
}

export async function updateBadge(userId: number, badgeText: string, badgeColor: string): Promise<void> {
  const { status, data } = await call("POST", "update_badge", { userId, badgeText, badgeColor });
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка обновления бейджика");
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function listChats(): Promise<Chat[]> {
  const { data } = await msgCall("GET", "list_chats");
  return (data.chats as Chat[]) || [];
}

export async function getMessages(chatId: number, since?: number): Promise<Message[]> {
  const body: Record<string, string> = { chatId: String(chatId) };
  if (since) body.since = String(since);
  const { data } = await msgCall("GET", "get_messages", body);
  return (data.messages as Message[]) || [];
}

export async function sendMessage(chatId: number, text: string): Promise<Message> {
  const { status, data } = await msgCall("POST", "send_message", { chatId, text });
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка отправки");
  return data.message as Message;
}

export async function sendPhoto(chatId: number, imageBase64: string, imageType: string, caption?: string): Promise<Message> {
  const { status, data } = await msgCall("POST", "send_photo", { chatId, imageBase64, imageType, caption });
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка отправки фото");
  return data.message as Message;
}

export async function createDirect(targetUserId: number): Promise<number> {
  const { data } = await msgCall("POST", "create_direct", { targetUserId });
  return data.chatId as number;
}

export async function deleteChat(chatId: number): Promise<void> {
  const { status, data } = await msgCall("POST", "delete_chat", { chatId });
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка удаления чата");
}

export async function createGroupChat(name: string, avatar: string, memberIds: number[]): Promise<number> {
  const { data } = await msgCall("POST", "create_chat", { name, avatar, memberIds });
  return data.chatId as number;
}

export type FamilyUser = {
  id: number;
  displayName: string;
  avatar: string;
  city: string;
  onlineStatus?: string | null;
  role: string;
  inFamily: boolean;
  badgeText?: string;
  badgeColor?: string;
};

export async function getChatUsers(): Promise<{ isAdmin: boolean; users: FamilyUser[] }> {
  const { data } = await msgCall("GET", "get_users");
  return { isAdmin: data.isAdmin as boolean, users: (data.users as FamilyUser[]) || [] };
}

export async function addFamilyMember(memberId: number): Promise<void> {
  await msgCall("POST", "add_family", { memberId });
}

export async function removeFamilyMember(memberId: number): Promise<void> {
  await msgCall("POST", "remove_family", { memberId });
}

export async function searchUsers(query: string): Promise<FamilyUser[]> {
  const { data } = await msgCall("POST", "search_users", { query });
  return (data.users as FamilyUser[]) || [];
}