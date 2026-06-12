import { useState, useEffect } from "react";
import Icon from "@/shared/ui/icon";
import Avatar from "@/shared/ui/Avatar";
import { getChatUsers, createDirect, createGroupChat } from "@/shared/api";

type Props = { onClose: () => void; onCreate: (chatId: number) => void };

export default function NewChatModal({ onClose, onCreate }: Props) {
  const [users, setUsers] = useState<{ id: number; displayName: string; avatar: string; city: string }[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const isGroup = selected.length > 1;

  useEffect(() => {
    getChatUsers().then(({ users }) => { setUsers(users); setLoading(false); });
  }, []);

  const toggle = (id: number) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleCreate = async () => {
    if (selected.length === 0) return;
    setCreating(true);
    try {
      const chatId = isGroup
        ? await createGroupChat(groupName || "Групповой чат", "👨‍👩‍👧‍👦", selected)
        : await createDirect(selected[0]);
      onCreate(chatId);
    } catch { setCreating(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md bg-white rounded-t-3xl animate-slide-up max-h-[80vh] flex flex-col"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.15)" }}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
          <p className="text-base text-foreground" style={{ fontWeight: 700 }}>Новый чат</p>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted">
            <Icon name="X" size={18} style={{ color: "hsl(25,15%,55%)" }} />
          </button>
        </div>

        {isGroup && (
          <div className="px-4 py-3 border-b border-border flex-shrink-0">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Название группы..."
              className="w-full bg-muted rounded-2xl px-4 py-2.5 text-sm outline-none"
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Icon name="Loader2" size={24} className="animate-spin" style={{ color: "hsl(22,85%,62%)" }} />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Нет других участников</p>
          ) : users.map((u) => {
            const isSelected = selected.includes(u.id);
            return (
              <button
                key={u.id}
                onClick={() => toggle(u.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl mb-1.5 transition-all"
                style={{ background: isSelected ? "hsl(22,85%,95%)" : "hsl(35,40%,96%)" }}
              >
                <Avatar
                  avatar={u.avatar}
                  size={40}
                  className="rounded-full"
                  style={{ background: "hsl(35,45%,90%)" }}
                />
                <div className="flex-1 text-left">
                  <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>{u.displayName}</p>
                  {u.city && <p className="text-xs text-muted-foreground">{u.city}</p>}
                </div>
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                  style={{ borderColor: isSelected ? "hsl(22,85%,62%)" : "hsl(35,25%,75%)", background: isSelected ? "hsl(22,85%,62%)" : "transparent" }}
                >
                  {isSelected && <Icon name="Check" size={11} style={{ color: "white" }} />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-4 py-4 border-t border-border flex-shrink-0">
          <button
            onClick={handleCreate}
            disabled={selected.length === 0 || creating}
            className="w-full py-3.5 rounded-2xl text-white text-sm transition-all"
            style={{
              background: selected.length > 0 ? "linear-gradient(135deg, hsl(22,85%,62%), hsl(340,60%,68%))" : "hsl(35,25%,85%)",
              fontWeight: 700,
            }}
          >
            {creating ? "Создаём..."
              : isGroup ? `Создать группу (${selected.length})`
              : selected.length === 1 ? "Написать сообщение"
              : "Выберите участника"}
          </button>
        </div>
      </div>
    </div>
  );
}