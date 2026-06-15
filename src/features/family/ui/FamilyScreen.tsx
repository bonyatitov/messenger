import { useState, useEffect, useCallback, useRef } from "react";
import Icon from "@/shared/ui/icon";
import Avatar from "@/shared/ui/Avatar";
import { getChatUsers, createDirect, addFamilyMember, removeFamilyMember, searchUsers, FamilyUser } from "@/shared/api";
import { useAuth } from "@/shared/lib/AuthContext";
import UserProfileModal, { ProfileUser } from "@/shared/ui/UserProfileModal";

function Badge({ text, color }: { text?: string; color?: string }) {
  if (!text) return null;
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0" style={{ background: color || "hsl(210,90%,92%)", color: "hsl(0,0%,25%)", fontWeight: 700 }}>
      {text}
    </span>
  );
}

const bgColors = [
  "hsl(35,45%,90%)", "hsl(340,55%,90%)", "hsl(200,50%,88%)",
  "hsl(140,35%,87%)", "hsl(270,35%,88%)", "hsl(50,60%,88%)", "hsl(22,65%,88%)",
];

type Props = { onOpenDirectChat?: (chatId: number) => void };

export default function FamilyScreen({ onOpenDirectChat }: Props) {
  const { user } = useAuth();
  const [members, setMembers] = useState<FamilyUser[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [writingTo, setWritingTo] = useState<number | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);

  const toProfileUser = (m: FamilyUser): ProfileUser => ({
    id: m.id, displayName: m.displayName, avatar: m.avatar,
    role: m.role, onlineStatus: m.onlineStatus,
    badgeText: m.badgeText, badgeColor: m.badgeColor,
    age: m.age, city: m.city,
  });

  // Поиск
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FamilyUser[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getChatUsers()
      .then(({ users, isAdmin: admin }) => {
        setMembers(users);
        setIsAdmin(admin);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (showSearch) setTimeout(() => searchRef.current?.focus(), 100);
    else { setSearchQuery(""); setSearchResults([]); }
  }, [showSearch]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      searchUsers(searchQuery.trim())
        .then(setSearchResults)
        .finally(() => setSearching(false));
    }, 350);
  }, [searchQuery]);

  const handleWrite = async (memberId: number) => {
    setWritingTo(memberId);
    try {
      const chatId = await createDirect(memberId);
      onOpenDirectChat?.(chatId);
    } catch { /* silent */ }
    finally { setWritingTo(null); }
  };

  const handleToggleFamily = async (m: FamilyUser, fromSearch = false) => {
    setToggling(m.id);
    try {
      if (m.inFamily) {
        await removeFamilyMember(m.id);
      } else {
        await addFamilyMember(m.id);
      }
      // Обновляем локально в обоих списках
      const updated = (u: FamilyUser) => u.id === m.id ? { ...u, inFamily: !u.inFamily } : u;
      setMembers(prev => {
        const exists = prev.find(u => u.id === m.id);
        if (!exists && !m.inFamily) return [...prev, { ...m, inFamily: true }];
        if (exists && m.inFamily) return prev.filter(u => u.id !== m.id);
        return prev.map(updated);
      });
      setSearchResults(prev => prev.map(updated));
    } catch { /* silent */ }
    finally { setToggling(null); }
  };

  const visibleMembers = isAdmin ? members : members.filter(m => m.inFamily);

  return (
    <div className="flex flex-col h-full">
      {/* Шапка */}
      <div className="px-4 pt-5 pb-3 bg-white flex-shrink-0" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        {showSearch ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSearch(false)} className="p-1.5 rounded-full hover:bg-muted transition-colors flex-shrink-0">
              <Icon name="ArrowLeft" size={20} style={{ color: "hsl(22,85%,58%)" }} />
            </button>
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-2xl" style={{ background: "hsl(35,30%,95%)" }}>
              <Icon name="Search" size={16} style={{ color: "hsl(25,15%,55%)" }} />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Имя или @username..."
                className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
              />
              {searching && <Icon name="Loader2" size={14} className="animate-spin" style={{ color: "hsl(25,15%,55%)" }} />}
              {searchQuery && !searching && (
                <button onClick={() => setSearchQuery("")}>
                  <Icon name="X" size={14} style={{ color: "hsl(25,15%,55%)" }} />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl text-foreground" style={{ fontWeight: 800 }}>Семья</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {loading ? "Загрузка..." : `${visibleMembers.length + 1} участников`}
              </p>
            </div>
            <button
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-sm transition-colors"
              style={{ background: "hsl(22,85%,60%)", color: "white", fontWeight: 600 }}
            >
              <Icon name="UserPlus" size={15} />
              Добавить
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 space-y-3">
        {/* Режим поиска */}
        {showSearch ? (
          searchQuery.trim().length < 2 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-60">
              <Icon name="Search" size={36} style={{ color: "hsl(25,15%,65%)" }} />
              <p className="text-sm text-muted-foreground text-center">Введите имя или @username<br />для поиска</p>
            </div>
          ) : searchResults.length === 0 && !searching ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-60">
              <span className="text-4xl">🔍</span>
              <p className="text-sm text-muted-foreground">Никого не найдено</p>
            </div>
          ) : searchResults.map((m, i) => (
            <div
              key={m.id}
              className="bg-white rounded-3xl p-4 flex items-center gap-4"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
            >
              <button className="flex-shrink-0" onClick={() => setProfileUser(toProfileUser(m))}>
                <Avatar
                  avatar={m.avatar}
                  size={52}
                  className="rounded-2xl"
                  style={{ background: bgColors[i % bgColors.length] }}
                  onlineStatus={m.onlineStatus}
                />
              </button>
              <button className="flex-1 min-w-0 text-left" onClick={() => setProfileUser(toProfileUser(m))}>
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <p className="text-foreground text-[15px]" style={{ fontWeight: 700 }}>{m.displayName}</p>
                  {m.role === "admin" && <Icon name="ShieldCheck" size={13} style={{ color: "hsl(210,90%,50%)", flexShrink: 0 }} />}
                  <Badge text={m.badgeText} color={m.badgeColor} />
                </div>
                {m.city && <p className="text-xs text-muted-foreground" style={{ fontWeight: 500 }}>{m.city}</p>}
              </button>
              <button
                onClick={() => handleToggleFamily(m, true)}
                disabled={toggling === m.id}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors flex-shrink-0"
                style={m.inFamily
                  ? { background: "hsl(0,70%,95%)", color: "hsl(0,70%,55%)" }
                  : { background: "hsl(142,60%,92%)", color: "hsl(142,70%,35%)" }
                }
              >
                {toggling === m.id
                  ? <Icon name="Loader2" size={14} className="animate-spin" />
                  : m.inFamily
                    ? <><Icon name="UserMinus" size={14} />Убрать</>
                    : <><Icon name="UserPlus" size={14} />В семью</>
                }
              </button>
            </div>
          ))
        ) : (
          <>
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <Icon name="Loader2" size={28} className="animate-spin" style={{ color: "hsl(22,85%,62%)" }} />
              </div>
            ) : (
              <>
                {/* Карточка текущего пользователя */}
                {user && (
                  <div
                    className="bg-white rounded-3xl p-4 flex items-center gap-4 animate-slide-up"
                    style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "2px solid hsl(22,85%,90%)" }}
                  >
                    <Avatar
                      avatar={user.avatar}
                      size={56}
                      className="rounded-2xl"
                      style={{ background: "linear-gradient(135deg, hsl(22,85%,62%), hsl(340,60%,68%))" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <p className="text-foreground text-[15px]" style={{ fontWeight: 700 }}>{user.displayName}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "hsl(22,85%,92%)", color: "hsl(22,85%,45%)", fontWeight: 700 }}>Я</span>
                        {user.role === "admin" && (
                          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "hsl(210,90%,92%)", color: "hsl(210,90%,40%)", fontWeight: 700 }}>
                            <Icon name="ShieldCheck" size={10} />Admin
                          </span>
                        )}
                        <Badge text={user.badgeText} color={user.badgeColor} />
                      </div>
                      <p className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>
                        @{user.username}{user.city ? ` · ${user.city}` : ""}
                      </p>
                    </div>
                  </div>
                )}

                {/* Список участников */}
                {visibleMembers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4 opacity-70">
                    <span className="text-5xl">👨‍👩‍👧‍👦</span>
                    <p className="text-sm text-muted-foreground text-center leading-relaxed">
                      Семья пока пуста.<br />Нажмите <b>Добавить</b> чтобы найти и добавить участников.
                    </p>
                  </div>
                ) : visibleMembers.map((m, i) => (
                  <div
                    key={m.id}
                    className={`bg-white rounded-3xl p-4 flex items-center gap-4 animate-slide-up stagger-${Math.min(i + 2, 6)}`}
                    style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
                  >
                    <button className="flex-shrink-0" onClick={() => setProfileUser(toProfileUser(m))}>
                      <Avatar
                        avatar={m.avatar}
                        size={56}
                        className="rounded-2xl"
                        style={{ background: bgColors[i % bgColors.length] }}
                        onlineStatus={m.onlineStatus}
                      />
                    </button>
                    <button className="flex-1 min-w-0 text-left" onClick={() => setProfileUser(toProfileUser(m))}>
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <p className="text-foreground text-[15px]" style={{ fontWeight: 700 }}>{m.displayName}</p>
                        {m.role === "admin" && (
                          <Icon name="ShieldCheck" size={14} style={{ color: "hsl(210,90%,50%)", flexShrink: 0 }} />
                        )}
                        <Badge text={m.badgeText} color={m.badgeColor} />
                      </div>
                      {m.onlineStatus && m.onlineStatus !== "online"
                        ? <p className="text-xs" style={{ color: "hsl(25,15%,60%)", fontWeight: 500 }}>{m.onlineStatus}</p>
                        : m.onlineStatus === "online"
                          ? <p className="text-xs" style={{ color: "hsl(142,70%,40%)", fontWeight: 600 }}>в сети</p>
                          : m.city && <p className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{m.city}</p>
                      }
                    </button>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {m.inFamily && (
                        <button
                          onClick={() => handleWrite(m.id)}
                          disabled={writingTo === m.id}
                          className="p-2 rounded-full hover:bg-muted transition-colors"
                        >
                          {writingTo === m.id
                            ? <Icon name="Loader2" size={18} className="animate-spin" style={{ color: "hsl(22,85%,58%)" }} />
                            : <Icon name="MessageCircle" size={18} style={{ color: "hsl(22,85%,58%)" }} />}
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleFamily(m)}
                        disabled={toggling === m.id}
                        className="p-2 rounded-full hover:bg-muted transition-colors"
                        title={m.inFamily ? "Убрать из семьи" : "Добавить в семью"}
                      >
                        {toggling === m.id
                          ? <Icon name="Loader2" size={18} className="animate-spin" style={{ color: "hsl(25,15%,55%)" }} />
                          : m.inFamily
                            ? <Icon name="UserMinus" size={18} style={{ color: "hsl(0,70%,60%)" }} />
                            : <Icon name="UserPlus" size={18} style={{ color: "hsl(142,70%,45%)" }} />
                        }
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {profileUser && (
        <UserProfileModal
          user={profileUser}
          onClose={() => setProfileUser(null)}
          onWriteMessage={() => {
            const id = profileUser.id;
            setProfileUser(null);
            handleWrite(id);
          }}
        />
      )}
    </div>
  );
}