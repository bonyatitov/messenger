import { useState, useEffect } from "react";
import Icon from "@/shared/ui/icon";
import { getUserProfile } from "@/shared/api";

export type ProfileUser = {
  id: number;
  displayName: string;
  avatar: string;
  role: string;
  onlineStatus?: string | null;
  badgeText?: string;
  badgeColor?: string;
  age?: number | null;
  city?: string;
};

type Props = {
  user: ProfileUser;
  onClose: () => void;
  onWriteMessage?: () => void;
};

function avatarIsUrl(av: string) {
  return av?.startsWith("http");
}

export default function UserProfileModal({ user: initialUser, onClose, onWriteMessage }: Props) {
  const [avatarExpanded, setAvatarExpanded] = useState(false);
  const [user, setUser] = useState<ProfileUser>(initialUser);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initialUser.id) return;
    setLoading(true);
    getUserProfile(initialUser.id)
      .then((full) => { if (full) setUser({ ...initialUser, ...full }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [initialUser.id]);

  const isOnline = user.onlineStatus === "online";

  return (
    <>
      {/* Оверлей */}
      <div
        className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="w-full max-w-md bg-white rounded-t-3xl animate-slide-up overflow-hidden"
          style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}
        >
          {/* Шапка */}
          <div className="flex items-center justify-between px-4 pt-5 pb-3">
            <p className="text-base text-foreground" style={{ fontWeight: 700 }}>Профиль</p>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted">
              <Icon name="X" size={18} style={{ color: "hsl(25,15%,55%)" }} />
            </button>
          </div>

          {/* Аватарка + основные данные */}
          <div className="px-4 pb-4 flex items-start gap-4">
            <button onClick={() => setAvatarExpanded(true)} className="flex-shrink-0 relative">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden"
                style={{
                  background: avatarIsUrl(user.avatar) ? undefined : "linear-gradient(135deg, hsl(22,85%,62%), hsl(340,60%,68%))",
                  fontSize: "2.5rem",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.14)",
                }}
              >
                {avatarIsUrl(user.avatar)
                  ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                  : (user.avatar || "👤")}
              </div>
              {isOnline && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white"
                  style={{ background: "hsl(142,70%,45%)" }}
                />
              )}
              <div
                className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-black/30 flex items-center justify-center"
                style={{ backdropFilter: "blur(4px)" }}
              >
                <Icon name="Expand" size={11} style={{ color: "white" }} />
              </div>
            </button>

            <div className="flex-1 min-w-0 pt-1">
              <p className="text-lg text-foreground leading-tight" style={{ fontWeight: 800 }}>
                {user.displayName}
              </p>

              {/* Статус */}
              {loading ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <Icon name="Loader2" size={13} className="animate-spin" style={{ color: "hsl(25,15%,65%)" }} />
                  <span className="text-xs text-muted-foreground">Загрузка...</span>
                </div>
              ) : (
                <p className="text-sm mt-0.5" style={{
                  color: isOnline ? "hsl(142,70%,40%)" : "hsl(25,15%,58%)",
                  fontWeight: isOnline ? 600 : 400,
                }}>
                  {isOnline ? "В сети" : user.onlineStatus || "не в сети"}
                </p>
              )}

              {/* Роль + бейдж */}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {user.role === "admin" && (
                  <span
                    className="flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-lg"
                    style={{ background: "hsl(210,90%,92%)", color: "hsl(210,90%,40%)", fontWeight: 700 }}
                  >
                    <Icon name="ShieldCheck" size={11} />
                    Admin
                  </span>
                )}
                {user.badgeText && (
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-lg"
                    style={{ background: user.badgeColor || "hsl(210,90%,92%)", color: "hsl(0,0%,20%)", fontWeight: 700 }}
                  >
                    {user.badgeText}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Детали: город и возраст */}
          {!loading && (user.city || user.age) && (
            <div className="px-4 pb-2">
              <div className="rounded-2xl px-4 py-3 flex gap-4" style={{ background: "hsl(35,30%,96%)" }}>
                {user.city && (
                  <div className="flex items-center gap-2">
                    <Icon name="MapPin" size={15} style={{ color: "hsl(22,85%,58%)" }} />
                    <span className="text-sm text-foreground" style={{ fontWeight: 500 }}>{user.city}</span>
                  </div>
                )}
                {user.age && (
                  <div className="flex items-center gap-2">
                    <Icon name="Calendar" size={15} style={{ color: "hsl(22,85%,58%)" }} />
                    <span className="text-sm text-foreground" style={{ fontWeight: 500 }}>{user.age} лет</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Кнопка написать */}
          {onWriteMessage ? (
            <div className="px-4 pb-6 pt-2">
              <button
                onClick={() => { onClose(); onWriteMessage(); }}
                className="w-full py-3.5 rounded-2xl text-white text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{
                  background: "linear-gradient(135deg, hsl(22,85%,62%), hsl(340,60%,68%))",
                  fontWeight: 700,
                  boxShadow: "0 6px 16px hsla(22,85%,62%,0.35)",
                }}
              >
                <Icon name="MessageCircle" size={17} style={{ color: "white" }} />
                Написать сообщение
              </button>
            </div>
          ) : (
            <div className="h-6" />
          )}
        </div>
      </div>

      {/* Полноэкранный просмотр аватара */}
      {avatarExpanded && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.88)" }}
          onClick={() => setAvatarExpanded(false)}
        >
          <button
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/15 flex items-center justify-center"
            onClick={() => setAvatarExpanded(false)}
          >
            <Icon name="X" size={20} style={{ color: "white" }} />
          </button>
          <div className="w-72 h-72 rounded-3xl overflow-hidden" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
            {avatarIsUrl(user.avatar)
              ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              : (
                <div className="w-full h-full flex items-center justify-center" style={{ fontSize: "8rem", background: "hsl(35,30%,18%)" }}>
                  {user.avatar || "👤"}
                </div>
              )}
          </div>
        </div>
      )}
    </>
  );
}
