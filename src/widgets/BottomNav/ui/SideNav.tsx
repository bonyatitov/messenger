import Icon from "@/shared/ui/icon";
import { useAuth } from "@/shared/lib/AuthContext";
import { Tab } from "./BottomNav";

const tabs: { id: Tab; icon: string; label: string }[] = [
  { id: "chats", icon: "MessageCircle", label: "Чаты" },
  { id: "family", icon: "Users", label: "Семья" },
  { id: "gallery", icon: "Image", label: "Галерея" },
  { id: "files", icon: "FolderOpen", label: "Файлы" },
  { id: "profile", icon: "User", label: "Профиль" },
];

type Props = {
  active: Tab;
  onChange: (tab: Tab) => void;
};

export default function SideNav({ active, onChange }: Props) {
  const { user } = useAuth();

  return (
    <aside
      className="flex flex-col h-screen bg-white border-r border-border flex-shrink-0"
      style={{ width: 220, boxShadow: "2px 0 16px rgba(0,0,0,0.05)" }}
    >
      {/* Логотип */}
      <div className="px-5 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">👨‍👩‍👧‍👦</span>
          <div>
            <p className="text-base text-foreground leading-tight" style={{ fontWeight: 800 }}>Семейка</p>
            <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 500 }}>мессенджер</p>
          </div>
        </div>
      </div>

      <div className="px-3 mb-2 flex-shrink-0">
        <div className="h-px bg-border" />
      </div>

      {/* Навигация */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-200 text-left"
              style={isActive
                ? { background: "hsla(22,85%,65%,0.12)", color: "hsl(22,85%,52%)" }
                : { color: "hsl(25,15%,45%)" }
              }
            >
              <Icon
                name={tab.icon}
                size={20}
                style={{ color: isActive ? "hsl(22,85%,55%)" : "hsl(25,15%,55%)", flexShrink: 0 }}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span className="text-sm" style={{ fontWeight: isActive ? 700 : 500 }}>
                {tab.label}
              </span>
              {isActive && (
                <div className="ml-auto w-1.5 h-5 rounded-full" style={{ background: "hsl(22,85%,62%)" }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Текущий пользователь */}
      {user && (
        <div className="px-3 py-3 flex-shrink-0 border-t border-border">
          <button
            onClick={() => onChange("profile")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-muted transition-colors text-left"
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 text-sm"
              style={{ background: user.avatar?.startsWith("http") ? undefined : "linear-gradient(135deg, hsl(22,85%,62%), hsl(340,60%,68%))" }}
            >
              {user.avatar?.startsWith("http")
                ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                : (user.avatar || "👤")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate" style={{ fontWeight: 700 }}>{user.displayName}</p>
              <p className="text-[11px] text-muted-foreground truncate">@{user.username}</p>
            </div>
          </button>
        </div>
      )}
    </aside>
  );
}
