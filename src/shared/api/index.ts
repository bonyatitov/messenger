const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api";

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

export type ReplyTo = {
  id: number;
  authorName: string;
  text: string;
  imageUrl?: string | null;
};

export type DocumentAttachment = {
  id: number;
  fileName: string;
  fileSize: number;
  fileType: string;
  url: string;
  expiresAt: string | null;
};

export type Message = {
  id: number;
  text: string;
  imageUrl?: string | null;
  time: string;
  date: string;
  userId: number;
  displayName: string;
  avatar: string;
  isMe: boolean;
  replyTo?: ReplyTo | null;
  document?: DocumentAttachment | null;
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

async function apiFetch(path: string, method: string, body?: object) {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-Session-Id": token } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error("Нет соединения с сервером. Проверьте интернет.");
  }
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
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
  const { status, data } = await apiFetch("/auth/login", "POST", { username, password });
  if (status === 423 || data?.locked) throw new LoginLockedError((data?.error as string) || "Доступ заблокирован");
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка входа");
  localStorage.setItem("fc_session", data.token as string);
  return data.user as User;
}

export async function resetPasswordAdmin(userId: number, newPassword: string): Promise<void> {
  const { status, data } = await apiFetch(`/auth/users/${userId}/reset-password`, "POST", { newPassword });
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка сброса пароля");
}

export async function getMe(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;
  const { status, data } = await apiFetch("/auth/me", "GET");
  if (status !== 200) {
    localStorage.removeItem("fc_session");
    return null;
  }
  return data.user as User;
}

export async function logout() {
  await apiFetch("/auth/logout", "POST");
  localStorage.removeItem("fc_session");
}

export async function listUsers(): Promise<User[]> {
  const { status, data } = await apiFetch("/auth/users", "GET");
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
  const { status, data } = await apiFetch("/auth/users", "POST", user);
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка создания");
  return data;
}

export async function deleteUser(userId: number) {
  const { status, data } = await apiFetch(`/auth/users/${userId}`, "DELETE");
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка удаления");
  return data;
}

export async function changePassword(oldPassword: string, newPassword: string) {
  const { status, data } = await apiFetch("/auth/me/password", "PATCH", { oldPassword, newPassword });
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка смены пароля");
  return data;
}

export async function updateProfile(payload: { displayName: string; age?: number | null }): Promise<{ displayName: string; age: number | null }> {
  const { status, data } = await apiFetch("/auth/me/profile", "PATCH", payload);
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка обновления профиля");
  return data as { displayName: string; age: number | null };
}

export async function updateAvatar(payload: { emoji?: string; imageBase64?: string; imageType?: string }): Promise<string> {
  const { status, data } = await apiFetch("/auth/me/avatar", "PATCH", payload);
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка обновления аватара");
  return data.avatar as string;
}

export async function updateBadge(userId: number, badgeText: string, badgeColor: string): Promise<void> {
  const { status, data } = await apiFetch(`/auth/users/${userId}/badge`, "PATCH", { badgeText, badgeColor });
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка обновления бейджика");
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function listChats(): Promise<Chat[]> {
  const { data } = await apiFetch("/chats", "GET");
  return (data.chats as Chat[]) || [];
}

export async function getMessages(chatId: number, since?: number): Promise<Message[]> {
  const qs = since ? `?since=${since}` : "";
  const { data } = await apiFetch(`/chats/${chatId}/messages${qs}`, "GET");
  return (data.messages as Message[]) || [];
}

export async function sendMessage(chatId: number, text: string, replyToId?: number): Promise<Message> {
  const { status, data } = await apiFetch(`/chats/${chatId}/messages`, "POST", { text, ...(replyToId ? { replyToId } : {}) });
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка отправки");
  return data.message as Message;
}

export async function sendPhoto(chatId: number, imageBase64: string, imageType: string, caption?: string, replyToId?: number): Promise<Message> {
  const { status, data } = await apiFetch(`/chats/${chatId}/photos`, "POST", { imageBase64, imageType, caption, ...(replyToId ? { replyToId } : {}) });
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка отправки фото");
  return data.message as Message;
}

export async function createDirect(targetUserId: number): Promise<number> {
  const { data } = await apiFetch("/chats/direct", "POST", { targetUserId });
  return data.chatId as number;
}

export async function deleteChat(chatId: number): Promise<void> {
  const { status, data } = await apiFetch(`/chats/${chatId}`, "DELETE");
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка удаления чата");
}

export async function createGroupChat(name: string, avatar: string, memberIds: number[]): Promise<number> {
  const { data } = await apiFetch("/chats/group", "POST", { name, avatar, memberIds });
  return data.chatId as number;
}

export type FamilyUser = {
  id: number;
  displayName: string;
  avatar: string;
  city: string;
  age?: number | null;
  onlineStatus?: string | null;
  role: string;
  inFamily: boolean;
  badgeText?: string;
  badgeColor?: string;
};

export async function getChatUsers(): Promise<{ isAdmin: boolean; users: FamilyUser[] }> {
  const { data } = await apiFetch("/family", "GET");
  return { isAdmin: data.isAdmin as boolean, users: (data.users as FamilyUser[]) || [] };
}

export async function addFamilyMember(memberId: number): Promise<void> {
  await apiFetch(`/family/${memberId}`, "POST");
}

export async function removeFamilyMember(memberId: number): Promise<void> {
  await apiFetch(`/family/${memberId}`, "DELETE");
}

export async function searchUsers(query: string): Promise<FamilyUser[]> {
  const { data } = await apiFetch(`/users/search?q=${encodeURIComponent(query)}`, "GET");
  return (data.users as FamilyUser[]) || [];
}

export async function getUserProfile(userId: number): Promise<FamilyUser | null> {
  const { status, data } = await apiFetch(`/users/${userId}`, "GET");
  if (status !== 200) return null;
  return data.user as FamilyUser;
}

export async function sendDocument(
  chatId: number,
  fileBase64: string,
  fileName: string,
  fileType: string,
  fileSize: number,
): Promise<Message> {
  const { status, data } = await apiFetch(`/chats/${chatId}/documents`, "POST", { fileBase64, fileName, fileType, fileSize });
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка отправки документа");
  return data.message as Message;
}

export type ChatMember = {
  id: number;
  displayName: string;
  avatar: string;
  onlineStatus?: string | null;
  isCreator: boolean;
};

export async function getChatMembers(chatId: number): Promise<{ members: ChatMember[]; creatorId: number; callerId: number }> {
  const { data } = await apiFetch(`/chats/${chatId}/members`, "GET");
  return { members: (data.members as ChatMember[]) || [], creatorId: data.creatorId as number, callerId: data.callerId as number };
}

export async function addChatMember(chatId: number, userId: number): Promise<void> {
  const { status, data } = await apiFetch(`/chats/${chatId}/members`, "POST", { userId });
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка добавления");
}

export async function removeChatMember(chatId: number, userId: number): Promise<void> {
  const { status, data } = await apiFetch(`/chats/${chatId}/members/${userId}`, "DELETE");
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка удаления");
}
