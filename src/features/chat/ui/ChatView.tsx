import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/shared/ui/icon";
import Avatar from "@/shared/ui/Avatar";
import { Chat, Message, ReplyTo, getMessages, sendMessage, sendPhoto, sendDocument } from "@/shared/api";
import ChatMessageBubble from "@/features/chat/ui/ChatMessageBubble";
import { sendPushNotification } from "@/shared/lib/push";
import { useAuth } from "@/shared/lib/AuthContext";
import GroupInfoModal from "@/features/chat/ui/GroupInfoModal";
import UserProfileModal, { ProfileUser } from "@/shared/ui/UserProfileModal";

function formatDateSep(dateStr: string): string {
  if (!dateStr) return "";
  const todayMsk = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
  const todayStr = `${todayMsk.getFullYear()}-${String(todayMsk.getMonth() + 1).padStart(2, "0")}-${String(todayMsk.getDate()).padStart(2, "0")}`;
  const yesterdayMsk = new Date(todayMsk);
  yesterdayMsk.setDate(yesterdayMsk.getDate() - 1);
  const yesterdayStr = `${yesterdayMsk.getFullYear()}-${String(yesterdayMsk.getMonth() + 1).padStart(2, "0")}-${String(yesterdayMsk.getDate()).padStart(2, "0")}`;
  if (dateStr === todayStr) return "Сегодня";
  if (dateStr === yesterdayStr) return "Вчера";
  const [y, m, d] = dateStr.split("-");
  const months = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
  const mIdx = parseInt(m, 10) - 1;
  const yearSuffix = y !== String(todayMsk.getFullYear()) ? ` ${y}` : "";
  return `${parseInt(d, 10)} ${months[mIdx]}${yearSuffix}`;
}

type Props = { chat: Chat; onBack: () => void };

export default function ChatView({ chat, onBack }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [replyTo, setReplyTo] = useState<{ msg: Message; replyTo: ReplyTo } | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
  const [docWarning, setDocWarning] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = (smooth = false) =>
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });

  const addMessage = (msg: Message) => {
    setMessages((prev) => [...prev, msg]);
    lastIdRef.current = msg.id;
    setTimeout(() => scrollToBottom(true), 30);
  };

  const loadMessages = useCallback(async (initial = false) => {
    try {
      const since = initial ? undefined : (lastIdRef.current || undefined);
      const msgs = await getMessages(chat.id, since);
      if (initial) {
        setMessages(msgs);
        if (msgs.length > 0) lastIdRef.current = msgs[msgs.length - 1].id;
      } else {
        const newMsgs = msgs.filter((m) => m.id > lastIdRef.current);
        if (newMsgs.length > 0) {
          setMessages((prev) => [...prev, ...newMsgs]);
          lastIdRef.current = newMsgs[newMsgs.length - 1].id;
        }
      }
    } catch { /* silent */ }
    finally { if (initial) setLoading(false); }
  }, [chat.id]);

  useEffect(() => {
    loadMessages(true).then(() => setTimeout(() => scrollToBottom(false), 60));
    pollRef.current = setInterval(() => loadMessages(false), 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadMessages]);

  useEffect(() => {
    if (!loading) scrollToBottom(true);
  }, [messages.length, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const replyId = replyTo?.msg.id;
    setInput("");
    setReplyTo(null);
    setSending(true);
    try {
      const msg = await sendMessage(chat.id, text, replyId);
      addMessage(msg);
      sendPushNotification(chat.id, user?.displayName || "Семейка", text);
    } catch {
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  useEffect(() => { autoResize(); }, [input]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setSending(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const dataUrl = ev.target?.result as string;
        const base64 = dataUrl.split(",")[1];
        const replyId = replyTo?.msg.id;
        setReplyTo(null);
        const msg = await sendPhoto(chat.id, base64, file.type, undefined, replyId);
        addMessage(msg);
        sendPushNotification(chat.id, user?.displayName || "Семейка", "📷 Фото");
      } catch { /* silent */ }
      finally { setSending(false); }
    };
    reader.onerror = () => setSending(false);
    reader.readAsDataURL(file);
  };

  const ALLOWED_DOC_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];
  const MAX_DOC_SIZE = 20 * 1024 * 1024; // 20 МБ

  const handleDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!ALLOWED_DOC_TYPES.includes(file.type)) {
      setDocWarning("Поддерживаются только PDF, Word и Excel файлы");
      setTimeout(() => setDocWarning(null), 4000);
      return;
    }
    if (file.size > MAX_DOC_SIZE) {
      setDocWarning("Максимальный размер файла — 20 МБ");
      setTimeout(() => setDocWarning(null), 4000);
      return;
    }
    setSending(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const dataUrl = ev.target?.result as string;
        const base64 = dataUrl.split(",")[1];
        const msg = await sendDocument(chat.id, base64, file.name, file.type, file.size);
        addMessage(msg);
        sendPushNotification(chat.id, user?.displayName || "Семейка", `📎 ${file.name}`);
        setDocWarning(`⏱ Документ «${file.name}» будет автоматически удалён через 24 часа`);
        setTimeout(() => setDocWarning(null), 7000);
      } catch { /* silent */ }
      finally { setSending(false); }
    };
    reader.onerror = () => setSending(false);
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-border flex-shrink-0"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <Icon name="ArrowLeft" size={20} style={{ color: "hsl(22,85%,58%)" }} />
        </button>
        <button
          className="flex-shrink-0"
          disabled={chat.isGroup}
          onClick={() => {
            if (!chat.isGroup) {
              const other = messages.find(m => !m.isMe);
              setProfileUser({
                id: other?.userId ?? 0,
                displayName: chat.name,
                avatar: chat.avatar,
                role: "member",
                onlineStatus: chat.onlineStatus,
              });
            }
          }}
          style={{ cursor: chat.isGroup ? "default" : "pointer" }}
        >
          <Avatar
            avatar={chat.avatar}
            size={40}
            className="rounded-full"
            style={{ background: "hsl(35,45%,90%)" }}
            onlineStatus={!chat.isGroup ? chat.onlineStatus : null}
          />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-foreground truncate text-[15px]" style={{ fontWeight: 700 }}>{chat.name}</p>
          <p className="text-xs" style={{ fontWeight: 500,
            color: !chat.isGroup && chat.onlineStatus === "online" ? "hsl(142,70%,40%)" : "hsl(25,15%,60%)" }}>
            {chat.isGroup
              ? "Групповой чат"
              : chat.onlineStatus === "online"
                ? "в сети"
                : chat.onlineStatus
                  ? chat.onlineStatus
                  : "Личные сообщения"}
          </p>
        </div>
        {chat.isGroup && (
          <button onClick={() => setShowGroupInfo(true)} className="p-1.5 rounded-full hover:bg-muted transition-colors flex-shrink-0">
            <Icon name="Users" size={20} style={{ color: "hsl(22,85%,58%)" }} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide" style={{ background: "hsl(36,33%,97%)" }}>
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Icon name="Loader2" size={28} className="animate-spin" style={{ color: "hsl(22,85%,62%)" }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-60">
            <span className="text-4xl">💬</span>
            <p className="text-sm text-muted-foreground">Начните переписку!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const showDateSep = !prev || prev.date !== msg.date;
              const showAvatar = !msg.isMe && (!prev || prev.userId !== msg.userId || prev.date !== msg.date);
              const showName = chat.isGroup && showAvatar;
              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="flex justify-center my-3">
                      <span className="text-xs text-muted-foreground bg-white px-3 py-1 rounded-full shadow-sm">
                        {formatDateSep(msg.date)}
                      </span>
                    </div>
                  )}
                  <ChatMessageBubble
                    msg={msg}
                    showAvatar={showAvatar}
                    showName={showName}
                    onImageClick={setLightboxUrl}
                    onReply={(m) => {
                      setReplyTo({ msg: m, replyTo: { id: m.id, authorName: m.displayName, text: m.text, imageUrl: m.imageUrl } });
                      textareaRef.current?.focus();
                    }}
                    onUserClick={setProfileUser}
                  />
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div className="bg-white border-t border-border px-4 py-2 flex items-center gap-2 flex-shrink-0">
          <div className="flex-1 border-l-2 pl-2.5 min-w-0" style={{ borderColor: "hsl(22,85%,60%)" }}>
            <p className="text-[11px] font-semibold truncate" style={{ color: "hsl(22,85%,55%)" }}>
              {replyTo.replyTo.authorName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {replyTo.replyTo.imageUrl && (!replyTo.replyTo.text || replyTo.replyTo.text === "📷 Фото") ? "📷 Фото" : replyTo.replyTo.text}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1 rounded-full hover:bg-muted flex-shrink-0">
            <Icon name="X" size={16} style={{ color: "hsl(25,15%,55%)" }} />
          </button>
        </div>
      )}

      <div className="bg-white border-t border-border px-3 py-3 flex items-end gap-2 flex-shrink-0">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={sending}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-muted"
          title="Прикрепить фото"
        >
          <Icon name="ImagePlus" size={20} style={{ color: sending ? "hsl(35,25%,75%)" : "hsl(22,85%,58%)" }} />
        </button>
        <button
          onClick={() => docRef.current?.click()}
          disabled={sending}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-muted"
          title="Прикрепить документ (PDF, Word, Excel)"
        >
          <Icon name="Paperclip" size={19} style={{ color: sending ? "hsl(35,25%,75%)" : "hsl(22,85%,58%)" }} />
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
        <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={handleDocSelect} />

        <div className="flex-1 bg-muted rounded-2xl px-4 py-2.5 flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Сообщение..."
            rows={1}
            className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground resize-none leading-relaxed"
            style={{ maxHeight: 120, overflowY: "auto" }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 active:scale-95"
          style={{
            background: input.trim() && !sending ? "linear-gradient(135deg, hsl(22,85%,62%), hsl(340,60%,68%))" : "hsl(35,25%,85%)",
            boxShadow: input.trim() ? "0 4px 12px hsla(22,85%,62%,0.4)" : "none",
          }}
        >
          {sending
            ? <Icon name="Loader2" size={16} className="animate-spin" style={{ color: "white" }} />
            : <Icon name="Send" size={16} style={{ color: input.trim() ? "white" : "hsl(25,15%,60%)" }} />}
        </button>
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.15)" }}
            onClick={() => setLightboxUrl(null)}
          >
            <Icon name="X" size={22} style={{ color: "white" }} />
          </button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-w-full max-h-full rounded-2xl object-contain animate-pop-in"
            style={{ maxHeight: "90vh", maxWidth: "90vw" }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      {showGroupInfo && (
        <GroupInfoModal chatId={chat.id} chatName={chat.name} onClose={() => setShowGroupInfo(false)} />
      )}
      {profileUser && (
        <UserProfileModal
          user={profileUser}
          onClose={() => setProfileUser(null)}
        />
      )}

      {/* Toast-баннер об удалении документа */}
      {docWarning && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-start gap-2 px-4 py-3 rounded-2xl text-sm animate-slide-up"
          style={{
            background: "hsl(22,85%,58%)",
            color: "white",
            boxShadow: "0 8px 24px hsla(22,85%,40%,0.4)",
            maxWidth: "calc(100% - 32px)",
            width: "max-content",
          }}
        >
          <Icon name="Clock" size={15} style={{ color: "rgba(255,255,255,0.9)", flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontWeight: 500, lineHeight: 1.4 }}>{docWarning}</span>
          <button onClick={() => setDocWarning(null)} className="ml-2 flex-shrink-0 opacity-70 hover:opacity-100">
            <Icon name="X" size={14} style={{ color: "white" }} />
          </button>
        </div>
      )}
    </div>
  );
}