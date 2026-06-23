import { useState } from "react";
import Icon from "@/shared/ui/icon";
import { updateProfile } from "@/shared/api";
import { useAuth } from "@/shared/lib/AuthContext";
import ModalSheet from "@/shared/ui/ModalSheet";

type Props = { onClose: () => void };

export default function EditProfileModal({ onClose }: Props) {
  const { user, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [age, setAge] = useState(user?.age ? String(user.age) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = displayName.trim();
    if (!trimmed) { setError("Имя не может быть пустым"); return; }
    if (trimmed.length > 64) { setError("Имя слишком длинное"); return; }

    const ageNum = age.trim() ? parseInt(age.trim(), 10) : null;
    if (age.trim() && (isNaN(ageNum!) || ageNum! < 1 || ageNum! > 120)) {
      setError("Введите корректный возраст от 1 до 120");
      return;
    }

    setLoading(true);
    try {
      const result = await updateProfile({ displayName: trimmed, age: ageNum });
      if (user) setUser({ ...user, displayName: result.displayName, age: result.age ?? undefined });
      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalSheet onClose={onClose}>
      <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-border">
        <p className="text-base text-foreground" style={{ fontWeight: 700 }}>Редактировать профиль</p>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted">
          <Icon name="X" size={18} style={{ color: "hsl(25,15%,55%)" }} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>Имя и Фамилия</p>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Введите имя"
            maxLength={64}
            className="w-full bg-muted rounded-2xl px-4 py-3 text-sm outline-none text-foreground"
            style={{ border: "2px solid transparent" }}
            onFocus={(e) => (e.target.style.borderColor = "hsl(22,85%,62%)")}
            onBlur={(e) => (e.target.style.borderColor = "transparent")}
          />
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>Возраст</p>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="Не указан"
            min={1}
            max={120}
            className="w-full bg-muted rounded-2xl px-4 py-3 text-sm outline-none text-foreground"
            style={{ border: "2px solid transparent" }}
            onFocus={(e) => (e.target.style.borderColor = "hsl(22,85%,62%)")}
            onBlur={(e) => (e.target.style.borderColor = "transparent")}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl" style={{ background: "hsl(0,70%,95%)" }}>
            <Icon name="AlertCircle" size={15} style={{ color: "hsl(0,65%,55%)" }} />
            <span className="text-sm" style={{ color: "hsl(0,65%,45%)", fontWeight: 600 }}>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl" style={{ background: "hsl(140,50%,93%)" }}>
            <Icon name="CheckCircle2" size={15} style={{ color: "hsl(140,50%,40%)" }} />
            <span className="text-sm" style={{ color: "hsl(140,50%,35%)", fontWeight: 600 }}>Профиль обновлён!</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || success}
          className="w-full py-3.5 rounded-2xl text-white text-sm mt-1 transition-all active:scale-95"
          style={{
            background: loading || success ? "hsl(22,40%,75%)" : "linear-gradient(135deg, hsl(22,85%,62%), hsl(340,60%,68%))",
            fontWeight: 700,
            boxShadow: loading || success ? "none" : "0 6px 16px hsla(22,85%,62%,0.35)",
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Icon name="Loader2" size={16} className="animate-spin" style={{ color: "white" }} />
              Сохраняем...
            </span>
          ) : "Сохранить"}
        </button>
      </form>
      <div className="h-4" />
    </ModalSheet>
  );
}