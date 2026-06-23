import { useState } from "react";
import Icon from "@/shared/ui/icon";
import { changePassword } from "@/shared/api";
import ModalSheet from "@/shared/ui/ModalSheet";

type Props = { onClose: () => void };

export default function ChangePasswordModal({ onClose }: Props) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError("Заполните все поля");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Новые пароли не совпадают");
      return;
    }
    if (newPassword.length < 4) {
      setError("Пароль должен быть не короче 4 символов");
      return;
    }
    setLoading(true);
    try {
      await changePassword(oldPassword, newPassword);
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalSheet onClose={onClose}>
      <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-border">
        <p className="text-base text-foreground" style={{ fontWeight: 700 }}>Смена пароля</p>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted">
          <Icon name="X" size={18} style={{ color: "hsl(25,15%,55%)" }} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-3">
        <PasswordField label="Текущий пароль" value={oldPassword} onChange={setOldPassword} show={showOld} onToggle={() => setShowOld(!showOld)} />
        <PasswordField label="Новый пароль" value={newPassword} onChange={setNewPassword} show={showNew} onToggle={() => setShowNew(!showNew)} />
        <PasswordField label="Повторите новый пароль" value={confirmPassword} onChange={setConfirmPassword} show={showNew} onToggle={() => setShowNew(!showNew)} />

        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl" style={{ background: "hsl(0,70%,95%)" }}>
            <Icon name="AlertCircle" size={15} style={{ color: "hsl(0,65%,55%)" }} />
            <span className="text-sm" style={{ color: "hsl(0,65%,45%)", fontWeight: 600 }}>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl" style={{ background: "hsl(140,50%,93%)" }}>
            <Icon name="CheckCircle2" size={15} style={{ color: "hsl(140,50%,40%)" }} />
            <span className="text-sm" style={{ color: "hsl(140,50%,35%)", fontWeight: 600 }}>Пароль успешно изменён!</span>
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
          ) : "Сохранить пароль"}
        </button>
      </form>
      <div className="h-4" />
    </ModalSheet>
  );
}

function PasswordField({
  label, value, onChange, show, onToggle,
}: {
  label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>{label}</p>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-muted rounded-2xl px-4 py-3 pr-10 text-sm outline-none text-foreground"
          style={{ border: "2px solid transparent" }}
          onFocus={(e) => (e.target.style.borderColor = "hsl(22,85%,62%)")}
          onBlur={(e) => (e.target.style.borderColor = "transparent")}
        />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2">
          <Icon name={show ? "EyeOff" : "Eye"} size={16} style={{ color: "hsl(25,15%,60%)" }} />
        </button>
      </div>
    </div>
  );
}