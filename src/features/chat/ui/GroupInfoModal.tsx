import { useState, useEffect } from "react";
import Icon from "@/shared/ui/icon";
import Avatar from "@/shared/ui/Avatar";
import { getChatMembers, getChatUsers, addChatMember, removeChatMember, ChatMember, FamilyUser } from "@/shared/api";

type Props = { chatId: number; chatName: string; onClose: () => void };

export default function GroupInfoModal({ chatId, chatName, onClose }: Props) {
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [creatorId, setCreatorId] = useState<number>(0);
  const [callerId, setCallerId] = useState<number>(0);
  const [allUsers, setAllUsers] = useState<FamilyUser[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = async () => {
    const [membersData, usersData] = await Promise.all([
      getChatMembers(chatId),
      getChatUsers(),
    ]);
    setMembers(membersData.members);
    setCreatorId(membersData.creatorId);
    setCallerId(membersData.callerId);
    setAllUsers(usersData.users);
    setLoading(false);
  };

  useEffect(() => { load(); }, [chatId]);

  const memberIds = new Set(members.map((m) => m.id));
  const notInChat = allUsers.filter((u) => !memberIds.has(u.id));
  const isCreator = callerId === creatorId;

  const handleAdd = async (userId: number) => {
    setBusy(userId);
    try {
      await addChatMember(chatId, userId);
      await load();
      setShowAdd(false);
    } finally { setBusy(null); }
  };

  const handleRemove = async (userId: number) => {
    setBusy(userId);
    try {
      await removeChatMember(chatId, userId);
      await load();
    } finally { setBusy(null); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md bg-white rounded-t-3xl max-h-[80vh] flex flex-col animate-slide-up"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.15)" }}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
          <p className="text-base text-foreground" style={{ fontWeight: 700 }}>
            {showAdd ? "Добавить участника" : chatName}
          </p>
          <button onClick={showAdd ? () => setShowAdd(false) : onClose} className="p-1.5 rounded-full hover:bg-muted">
            <Icon name={showAdd ? "ArrowLeft" : "X"} size={18} style={{ color: "hsl(25,15%,55%)" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Icon name="Loader2" size={24} className="animate-spin" style={{ color: "hsl(22,85%,58%)" }} />
            </div>
          ) : showAdd ? (
            notInChat.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Все уже в чате</p>
            ) : (
              <div className="py-2">
                {notInChat.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleAdd(u.id)}
                    disabled={busy === u.id}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <Avatar avatar={u.avatar} size={42} className="rounded-full flex-shrink-0" />
                    <div className="flex-1 text-left">
                      <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>{u.displayName}</p>
                      {u.city && <p className="text-xs text-muted-foreground">{u.city}</p>}
                    </div>
                    {busy === u.id
                      ? <Icon name="Loader2" size={18} className="animate-spin" style={{ color: "hsl(22,85%,58%)" }} />
                      : <Icon name="UserPlus" size={18} style={{ color: "hsl(22,85%,58%)" }} />
                    }
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="py-2">
              <p className="text-xs text-muted-foreground px-4 py-2" style={{ fontWeight: 600 }}>
                УЧАСТНИКИ · {members.length}
              </p>
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar avatar={m.avatar} size={42} className="rounded-full flex-shrink-0" onlineStatus={m.onlineStatus} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>{m.displayName}</p>
                      {m.isCreator && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "hsl(22,85%,93%)", color: "hsl(22,85%,45%)", fontWeight: 700 }}>
                          создатель
                        </span>
                      )}
                    </div>
                    {m.onlineStatus && (
                      <p className="text-xs truncate" style={{ color: m.onlineStatus === "online" ? "hsl(142,70%,40%)" : "hsl(25,15%,60%)" }}>
                        {m.onlineStatus}
                      </p>
                    )}
                  </div>
                  {isCreator && m.id !== callerId && !m.isCreator && (
                    <button
                      onClick={() => handleRemove(m.id)}
                      disabled={busy === m.id}
                      className="p-2 rounded-full hover:bg-red-50 transition-colors flex-shrink-0"
                    >
                      {busy === m.id
                        ? <Icon name="Loader2" size={16} className="animate-spin" style={{ color: "hsl(0,60%,60%)" }} />
                        : <Icon name="UserMinus" size={16} style={{ color: "hsl(0,60%,60%)" }} />
                      }
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {!showAdd && !loading && (
          <div className="px-4 py-3 border-t border-border flex-shrink-0">
            <button
              onClick={() => setShowAdd(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm transition-colors"
              style={{ background: "hsl(22,85%,58%)", color: "white", fontWeight: 600 }}
            >
              <Icon name="UserPlus" size={18} />
              Добавить участника
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
