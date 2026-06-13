import { useState, useEffect } from "react";
import Icon from "@/shared/ui/icon";
import { useAuth } from "@/shared/lib/AuthContext";
import AdminPanel from "@/features/auth/ui/AdminPanel";
import ChangePasswordModal from "@/features/auth/ui/ChangePasswordModal";
import ChangeAvatarModal from "@/features/auth/ui/ChangeAvatarModal";
import { subscribeToPush } from "@/shared/lib/push";

const settings = [
  { icon: "Palette", label: "Внешний вид", desc: "Тема и оформление", color: "hsl(270,40%,88%)" },
  { icon: "HelpCircle", label: "Помощь", desc: "FAQ и поддержка", color: "hsl(140,35%,87%)" },
];

function getNotifStatus(): "granted" | "denied" | "default" | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [notifStatus, setNotifStatus] = useState<"granted" | "denied" | "default" | "unsupported">("default");
  const [notifLoading, setNotifLoading] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => { setNotifStatus(getNotifStatus()); }, []);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showChangeAvatar, setShowChangeAvatar] = useState(false);

  if (showAdmin) return <AdminPanel onBack={() => setShowAdmin(false)} />;

  const avatarIsUrl = user?.avatar?.startsWith("http");

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-3 bg-white" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <h1 className="text-2xl text-foreground" style={{ fontWeight: 800 }}>Профиль</h1>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="mx-4 mt-4">
          <div
            className="rounded-3xl p-5 animate-slide-up"
            style={{
              background: "linear-gradient(135deg, hsl(22,85%,62%) 0%, hsl(340,60%,70%) 100%)",
              boxShadow: "0 8px 24px hsla(22,85%,62%,0.35)",
            }}
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <div
                  className="w-[72px] h-[72px] rounded-2xl bg-white/20 flex items-center justify-center border-2 border-white/40 overflow-hidden"
                  style={{ fontSize: avatarIsUrl ? undefined : "2.5rem" }}
                >
                  {avatarIsUrl
                    ? <img src={user?.avatar} alt="" className="w-full h-full object-cover" />
                    : (user?.avatar || "👤")}
                </div>
                <button
                  onClick={() => setShowChangeAvatar(true)}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
                >
                  <Icon name="Camera" size={13} style={{ color: "hsl(22,85%,58%)" }} />
                </button>
              </div>
              <div className="flex-1">
                <p className="text-white text-xl" style={{ fontWeight: 800 }}>{user?.displayName || "Гость"}</p>
                <p className="text-white/80 text-sm mt-0.5">@{user?.username || "—"}</p>
                <p className="text-white/70 text-xs mt-1">
                  {[user?.city, user?.age ? `${user.age} лет` : null].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
            </div>
            {user?.bio && (
              <div className="mt-4 bg-white/15 rounded-2xl px-3 py-2.5">
                <p className="text-white text-sm">{user.bio}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mx-4 mt-4 space-y-2.5 pb-6">
          <p className="text-sm text-muted-foreground px-1 mb-2" style={{ fontWeight: 600 }}>НАСТРОЙКИ</p>

          <div
            className="bg-white rounded-3xl px-4 py-3.5 flex items-center gap-3 animate-slide-up stagger-2"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
          >
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "hsl(340,55%,88%)" }}>
              <Icon name={notifStatus === "granted" ? "Bell" : "BellOff"} size={18} style={{ color: "hsl(340,55%,50%)" }} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Уведомления</p>
              <p className="text-xs text-muted-foreground">
                {notifStatus === "granted" && "Включены"}
                {notifStatus === "denied" && "Заблокированы в браузере"}
                {notifStatus === "default" && "Нажмите, чтобы включить"}
                {notifStatus === "unsupported" && "Не поддерживается"}
              </p>
            </div>
            {notifStatus === "denied" ? (
              <Icon name="Lock" size={16} style={{ color: "hsl(0,55%,65%)" }} />
            ) : notifStatus === "unsupported" ? (
              <Icon name="X" size={16} style={{ color: "hsl(25,15%,65%)" }} />
            ) : (
              <button
                onClick={async () => {
                  if (notifStatus === "granted") return;
                  setNotifLoading(true);
                  const ok = await subscribeToPush();
                  setNotifStatus(getNotifStatus());
                  setNotifLoading(false);
                  if (!ok && Notification.permission === "denied") setNotifStatus("denied");
                }}
                disabled={notifLoading || notifStatus === "granted"}
                className="w-12 h-7 rounded-full transition-all duration-300 relative flex-shrink-0"
                style={{ background: notifStatus === "granted" ? "hsl(22,85%,62%)" : "hsl(35,25%,82%)" }}
              >
                {notifLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Icon name="Loader2" size={14} className="animate-spin" style={{ color: "white" }} />
                  </div>
                ) : (
                  <div
                    className="absolute top-1 w-5 h-5 rounded-full bg-white transition-all duration-300"
                    style={{ left: notifStatus === "granted" ? "calc(100% - 24px)" : "4px", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}
                  />
                )}
              </button>
            )}
          </div>

          <button
            onClick={() => setShowChangePassword(true)}
            className="w-full bg-white rounded-3xl px-4 py-3.5 flex items-center gap-3 hover:bg-muted/30 transition-colors animate-slide-up stagger-3"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
          >
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "hsl(200,55%,87%)" }}>
              <Icon name="KeyRound" size={18} style={{ color: "hsl(200,65%,45%)" }} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Сменить пароль</p>
              <p className="text-xs text-muted-foreground">Изменить пароль для входа</p>
            </div>
            <Icon name="ChevronRight" size={16} style={{ color: "hsl(25,15%,65%)" }} />
          </button>

          {settings.map((s, i) => (
            <button
              key={s.label}
              className={`w-full bg-white rounded-3xl px-4 py-3.5 flex items-center gap-3 hover:bg-muted/30 transition-colors animate-slide-up stagger-${Math.min(i + 4, 6)}`}
              style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
            >
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: s.color }}>
                <Icon name={s.icon} size={18} style={{ color: "hsl(22,50%,45%)" }} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
              <Icon name="ChevronRight" size={16} style={{ color: "hsl(25,15%,65%)" }} />
            </button>
          ))}

          {user?.role === "admin" && (
            <button
              onClick={() => setShowAdmin(true)}
              className="w-full bg-white rounded-3xl px-4 py-3.5 flex items-center gap-3 hover:bg-muted/30 transition-colors animate-slide-up stagger-5"
              style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
            >
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "hsl(22,80%,90%)" }}>
                <Icon name="Shield" size={18} style={{ color: "hsl(22,85%,50%)" }} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Управление семьёй</p>
                <p className="text-xs text-muted-foreground">Добавить/удалить участника</p>
              </div>
              <Icon name="ChevronRight" size={16} style={{ color: "hsl(25,15%,65%)" }} />
            </button>
          )}

          <button
            onClick={logout}
            className="w-full bg-white rounded-3xl px-4 py-3.5 flex items-center gap-3 hover:bg-red-50 transition-colors mt-2 animate-slide-up stagger-6"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
          >
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "hsl(0,70%,93%)" }}>
              <Icon name="LogOut" size={18} style={{ color: "hsl(0,65%,55%)" }} />
            </div>
            <p className="text-sm flex-1 text-left" style={{ color: "hsl(0,65%,55%)", fontWeight: 600 }}>Выйти из аккаунта</p>
          </button>
        </div>
      </div>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {showChangeAvatar && <ChangeAvatarModal onClose={() => setShowChangeAvatar(false)} />}
    </div>
  );
}