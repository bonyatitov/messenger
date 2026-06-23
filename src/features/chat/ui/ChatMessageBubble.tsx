import { useRef } from "react";
import Icon from "@/shared/ui/icon";
import { Message } from "@/shared/api";
import { ProfileUser } from "@/shared/ui/UserProfileModal";
import DocumentBubble from "@/features/chat/ui/DocumentBubble";

type Props = {
  msg: Message;
  showAvatar: boolean;
  showName: boolean;
  onImageClick: (url: string) => void;
  onReply: (msg: Message) => void;
  onUserClick?: (user: ProfileUser) => void;
};

function avatarIsUrl(av: string) {
  return av?.startsWith("http");
}

export default function ChatMessageBubble({ msg, showAvatar, showName, onImageClick, onReply, onUserClick }: Props) {
  const hasImage = !!msg.imageUrl;
  const hasDocument = !!msg.document;
  const isTextOnly = !hasImage && !hasDocument;
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const swiping = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swiping.current = false;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (dx > 48 && dy < 40 && !swiping.current) {
      onReply(msg);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (dy > 10) swiping.current = true;
  };

  return (
    <div
      className="flex items-end gap-2 group"
      style={{ justifyContent: msg.isMe ? "flex-end" : "flex-start", marginBottom: 2 }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {!msg.isMe && (
        <button
          className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0 mb-0.5 overflow-hidden"
          style={{
            background: "hsl(35,45%,90%)",
            visibility: showAvatar ? "visible" : "hidden",
            pointerEvents: showAvatar ? "auto" : "none",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onUserClick?.({ id: msg.userId, displayName: msg.displayName, avatar: msg.avatar, role: "member" });
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            onUserClick?.({ id: msg.userId, displayName: msg.displayName, avatar: msg.avatar, role: "member" });
          }}
        >
          {avatarIsUrl(msg.avatar)
            ? <img src={msg.avatar} className="w-full h-full object-cover" alt="" />
            : msg.avatar}
        </button>
      )}

      {/* Кнопка ответа — слева от своего, справа от чужого (десктоп) */}
      {msg.isMe && (
        <button
          onClick={() => onReply(msg)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full flex-shrink-0 self-center"
          style={{ background: "hsl(35,25%,90%)" }}
        >
          <Icon name="Reply" size={14} style={{ color: "hsl(22,85%,55%)" }} />
        </button>
      )}

      <div className="max-w-[72%]">
        {showName && (
          <button
            className="text-[10px] mb-1 ml-1 text-left"
            style={{ color: "hsl(22,85%,55%)", fontWeight: 700 }}
            onClick={(e) => {
              e.stopPropagation();
              onUserClick?.({ id: msg.userId, displayName: msg.displayName, avatar: msg.avatar, role: "member" });
            }}
          >
            {msg.displayName}
          </button>
        )}

        {hasImage ? (
          <div
            className={`overflow-hidden ${msg.isMe ? "rounded-[18px_18px_4px_18px]" : "rounded-[18px_18px_18px_4px]"}`}
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
          >
            {msg.replyTo && (
              <ReplyBadge replyTo={msg.replyTo} isMe={msg.isMe} inline />
            )}
            <button onClick={() => onImageClick(msg.imageUrl!)}>
              <img src={msg.imageUrl!} alt="фото" className="block max-w-[220px] w-full object-cover" style={{ maxHeight: 260 }} />
            </button>
            {msg.text && msg.text !== "📷 Фото" && (
              <div className={msg.isMe ? "bubble-me" : "bubble-them"} style={{ padding: "6px 12px", borderRadius: 0 }}>
                <p className="text-sm leading-relaxed">{msg.text}</p>
              </div>
            )}
            <div
              className={`px-3 py-1 flex items-center justify-end gap-1 ${msg.isMe ? "bubble-me" : "bubble-them"}`}
              style={{ borderRadius: 0, padding: "2px 10px 6px" }}
            >
              <span className="text-[10px]" style={{ color: msg.isMe ? "rgba(255,255,255,0.7)" : "hsl(25,15%,60%)" }}>
                {msg.time}
              </span>
              {msg.isMe && <Icon name="CheckCheck" size={12} style={{ color: "rgba(255,255,255,0.8)" }} />}
            </div>
          </div>
        ) : hasDocument ? (
          <div className={msg.isMe ? "bubble-me" : "bubble-them"} style={{ padding: "8px 10px" }}>
            {msg.replyTo && <ReplyBadge replyTo={msg.replyTo} isMe={msg.isMe} />}
            <DocumentBubble doc={msg.document!} isMe={msg.isMe} />
            <p className="text-[10px] mt-1.5 text-right flex items-center justify-end gap-1"
              style={{ color: msg.isMe ? "rgba(255,255,255,0.7)" : "hsl(25,15%,60%)" }}>
              {msg.time}
              {msg.isMe && <Icon name="CheckCheck" size={12} style={{ color: "rgba(255,255,255,0.8)" }} />}
            </p>
          </div>
        ) : (
          <div className={msg.isMe ? "bubble-me" : "bubble-them"} style={{ padding: "8px 14px" }}>
            {msg.replyTo && <ReplyBadge replyTo={msg.replyTo} isMe={msg.isMe} />}
            {isTextOnly && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
            <p className="text-[10px] mt-1 text-right flex items-center justify-end gap-1"
              style={{ color: msg.isMe ? "rgba(255,255,255,0.7)" : "hsl(25,15%,60%)" }}>
              {msg.time}
              {msg.isMe && <Icon name="CheckCheck" size={12} style={{ color: "rgba(255,255,255,0.8)" }} />}
            </p>
          </div>
        )}
      </div>

      {!msg.isMe && (
        <button
          onClick={() => onReply(msg)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full flex-shrink-0 self-center"
          style={{ background: "hsl(35,25%,90%)" }}
        >
          <Icon name="Reply" size={14} style={{ color: "hsl(22,85%,55%)" }} />
        </button>
      )}
    </div>
  );
}

function ReplyBadge({ replyTo, isMe, inline }: { replyTo: NonNullable<Message["replyTo"]>; isMe: boolean; inline?: boolean }) {
  const previewText = replyTo.imageUrl && (!replyTo.text || replyTo.text === "📷 Фото") ? "📷 Фото" : replyTo.text;
  return (
    <div
      className={`flex items-start gap-1.5 mb-1.5 ${inline ? "" : "rounded-xl px-2.5 py-1.5"}`}
      style={inline ? {
        background: isMe ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.06)",
        padding: "6px 10px",
      } : {
        background: isMe ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.05)",
        borderLeft: `3px solid ${isMe ? "rgba(255,255,255,0.6)" : "hsl(22,85%,60%)"}`,
        padding: "4px 8px",
        borderRadius: 8,
      }}
    >
      {replyTo.imageUrl && (
        <img src={replyTo.imageUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-[10px] truncate" style={{ color: isMe ? "rgba(255,255,255,0.8)" : "hsl(22,85%,55%)", fontWeight: 700 }}>
          {replyTo.authorName}
        </p>
        <p className="text-[11px] truncate" style={{ color: isMe ? "rgba(255,255,255,0.65)" : "hsl(25,15%,50%)" }}>
          {previewText}
        </p>
      </div>
    </div>
  );
}