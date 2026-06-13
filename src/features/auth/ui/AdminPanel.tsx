import { useState, useEffect } from "react";
import Icon from "@/shared/ui/icon";
import Avatar from "@/shared/ui/Avatar";
import { User, listUsers, createUser, deleteUser, updateBadge, resetPasswordAdmin } from "@/shared/api";

const BADGE_COLORS = [
  { label: "Синий",    bg: "hsl(210,90%,92%)", text: "hsl(210,90%,35%)" },
  { label: "Оранжевый", bg: "hsl(22,85%,92%)",  text: "hsl(22,85%,40%)"  },
  { label: "Зелёный",  bg: "hsl(142,55%,90%)", text: "hsl(142,60%,32%)" },
  { label: "Красный",  bg: "hsl(0,70%,92%)",   text: "hsl(0,70%,42%)"   },
  { label: "Фиолет.",  bg: "hsl(270,55%,92%)", text: "hsl(270,60%,40%)" },
  { label: "Розовый",  bg: "hsl(340,65%,92%)", text: "hsl(340,65%,40%)" },
  { label: "Жёлтый",  bg: "hsl(50,90%,88%)",  text: "hsl(40,80%,35%)"  },
  { label: "Серый",    bg: "hsl(0,0%,90%)",    text: "hsl(0,0%,38%)"    },
];

const AVATARS = ["👨", "👩", "👧", "👦", "👴", "👵", "🧑", "👶", "🧒"];
const ROLES = [
  { value: "member", label: "Участник" },
  { value: "admin", label: "Администратор" },
];

type BadgeModal = { user: User; text: string; color: typeof BADGE_COLORS[0] };
type ResetPassModal = { user: User; newPassword: string; saving: boolean };
type Props = { onBack: () => void };

export default function AdminPanel({ onBack }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [badgeModal, setBadgeModal] = useState<BadgeModal | null>(null);
  const [savingBadge, setSavingBadge] = useState(false);
  const [resetPassModal, setResetPassModal] = useState<ResetPassModal | null>(null);

  const [form, setForm] = useState({
    username: "", displayName: "", password: "", role: "member",
    avatar: "👤", city: "", age: "", bio: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const list = await listUsers();
      setUsers(list);
    } catch {
      setError("Не удалось загрузить пользователей");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.username || !form.displayName || !form.password) {
      setError("Заполните обязательные поля");
      return;
    }
    setSubmitting(true);
    try {
      await createUser({ ...form, age: form.age ? parseInt(form.age) : null });
      setSuccess(`Пользователь «${form.displayName}» создан!`);
      setForm({ username: "", displayName: "", password: "", role: "member", avatar: "👤", city: "", age: "", bio: "" });
      setShowForm(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Удалить пользователя «${user.displayName}»?`)) return;
    try {
      await deleteUser(user.id);
      setSuccess(`Пользователь «${user.displayName}» удалён`);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

  const openBadgeModal = (u: User) => {
    const existingColor = BADGE_COLORS.find(c => c.bg === u.badgeColor) || BADGE_COLORS[0];
    setBadgeModal({ user: u, text: u.badgeText || "", color: existingColor });
  };

  const handleSaveBadge = async () => {
    if (!badgeModal) return;
    setSavingBadge(true);
    try {
      await updateBadge(badgeModal.user.id, badgeModal.text, badgeModal.text ? badgeModal.color.bg : "");
      setUsers(prev => prev.map(u =>
        u.id === badgeModal.user.id
          ? { ...u, badgeText: badgeModal.text, badgeColor: badgeModal.text ? badgeModal.color.bg : "" }
          : u
      ));
      setSuccess(`Бейджик для «${badgeModal.user.displayName}» обновлён`);
      setBadgeModal(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSavingBadge(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPassModal) return;
    const { user, newPassword } = resetPassModal;
    if (!newPassword || newPassword.length < 4) {
      setError("Пароль должен быть не короче 4 символов");
      return;
    }
    setResetPassModal(m => m ? { ...m, saving: true } : null);
    try {
      await resetPasswordAdmin(user.id, newPassword);
      setSuccess(`Пароль для «${user.displayName}» изменён`);
      setResetPassModal(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка");
      setResetPassModal(m => m ? { ...m, saving: false } : null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-3 bg-white" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <div className="flex items-center gap-3 mb-1">
          <button onClick={onBack} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <Icon name="ArrowLeft" size={20} style={{ color: "hsl(22,85%,58%)" }} />
          </button>
          <div>
            <h1 className="text-xl text-foreground" style={{ fontWeight: 800 }}>Управление семьёй</h1>
            <p className="text-xs text-muted-foreground">Добавление и удаление участников</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4">
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-3 animate-fade-in" style={{ background: "hsl(0,70%,95%)" }}>
            <Icon name="AlertCircle" size={16} style={{ color: "hsl(0,65%,55%)" }} />
            <span className="text-sm" style={{ color: "hsl(0,65%,45%)", fontWeight: 600 }}>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-3 animate-fade-in" style={{ background: "hsl(140,50%,93%)" }}>
            <Icon name="CheckCircle2" size={16} style={{ color: "hsl(140,50%,40%)" }} />
            <span className="text-sm" style={{ color: "hsl(140,50%,35%)", fontWeight: 600 }}>{success}</span>
          </div>
        )}

        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setError(""); setSuccess(""); }}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white mb-4 transition-all active:scale-98"
            style={{ background: "linear-gradient(135deg, hsl(22,85%,62%) 0%, hsl(340,60%,68%) 100%)", fontWeight: 700, boxShadow: "0 6px 16px hsla(22,85%,62%,0.35)" }}
          >
            <Icon name="UserPlus" size={18} style={{ color: "white" }} />
            Добавить участника
          </button>
        )}

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-3xl p-4 mb-4 animate-slide-up" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-base text-foreground" style={{ fontWeight: 700 }}>Новый участник</p>
              <button type="button" onClick={() => setShowForm(false)}>
                <Icon name="X" size={18} style={{ color: "hsl(25,15%,60%)" }} />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>Аватар</p>
            <div className="flex gap-2 flex-wrap mb-4">
              {AVATARS.map((av) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, avatar: av }))}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl transition-all"
                  style={{ background: form.avatar === av ? "hsl(22,85%,62%)" : "hsl(35,45%,92%)", transform: form.avatar === av ? "scale(1.1)" : "scale(1)" }}
                >
                  {av}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <Field label="Имя *" value={form.displayName} onChange={(v) => setForm((f) => ({ ...f, displayName: v }))} placeholder="Например: Мама" />
              <Field label="Логин *" value={form.username} onChange={(v) => setForm((f) => ({ ...f, username: v }))} placeholder="mama" />
              <Field label="Пароль *" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} placeholder="Пароль для входа" type="password" />

              <div>
                <p className="text-xs text-muted-foreground mb-1" style={{ fontWeight: 600 }}>Роль</p>
                <div className="flex gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, role: r.value }))}
                      className="flex-1 py-2 rounded-xl text-sm transition-all"
                      style={{ background: form.role === r.value ? "hsl(22,85%,62%)" : "hsl(35,45%,92%)", color: form.role === r.value ? "white" : "hsl(25,30%,35%)", fontWeight: 600 }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Город" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} placeholder="Москва" />
                <Field label="Возраст" value={form.age} onChange={(v) => setForm((f) => ({ ...f, age: v }))} placeholder="30" type="number" />
              </div>
              <Field label="О себе" value={form.bio} onChange={(v) => setForm((f) => ({ ...f, bio: v }))} placeholder="Краткое описание" />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-4 py-3 rounded-2xl text-white text-sm transition-all"
              style={{ background: submitting ? "hsl(22,40%,75%)" : "hsl(22,85%,62%)", fontWeight: 700 }}
            >
              {submitting ? "Создаём..." : "Создать участника"}
            </button>
          </form>
        )}

        <p className="text-sm text-muted-foreground mb-3 px-1" style={{ fontWeight: 600 }}>
          УЧАСТНИКИ ({users.length})
        </p>
        {loading ? (
          <div className="flex justify-center py-8">
            <Icon name="Loader2" size={28} style={{ color: "hsl(22,85%,62%)" }} className="animate-spin" />
          </div>
        ) : (
          <div className="space-y-2.5">
            {users.map((u, i) => (
              <div
                key={u.id}
                className={`bg-white rounded-3xl px-4 py-3.5 flex items-center gap-3 animate-slide-up stagger-${Math.min(i + 1, 6)}`}
                style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
              >
                <Avatar
                  avatar={u.avatar}
                  size={44}
                  className="rounded-2xl"
                  style={{ background: "hsl(35,45%,90%)" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm text-foreground truncate" style={{ fontWeight: 700 }}>{u.displayName}</p>
                    {u.role === "admin" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0" style={{ background: "hsl(22,85%,92%)", color: "hsl(22,85%,45%)", fontWeight: 700 }}>
                        ADMIN
                      </span>
                    )}
                    {u.badgeText && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md flex-shrink-0" style={{ background: u.badgeColor || "hsl(210,90%,92%)", color: BADGE_COLORS.find(c => c.bg === u.badgeColor)?.text || "hsl(210,90%,35%)", fontWeight: 700 }}>
                        {u.badgeText}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">@{u.username}{u.city ? ` · ${u.city}` : ""}</p>
                </div>
                <button onClick={() => openBadgeModal(u)} className="p-2 rounded-xl hover:bg-muted transition-colors flex-shrink-0" title="Редактировать бейджик">
                  <Icon name="Tag" size={16} style={{ color: "hsl(210,70%,55%)" }} />
                </button>
                <button onClick={() => setResetPassModal({ user: u, newPassword: "", saving: false })} className="p-2 rounded-xl hover:bg-muted transition-colors flex-shrink-0" title="Сменить пароль">
                  <Icon name="KeyRound" size={16} style={{ color: "hsl(40,80%,50%)" }} />
                </button>
                <button onClick={() => handleDelete(u)} className="p-2 rounded-xl hover:bg-red-50 transition-colors flex-shrink-0">
                  <Icon name="Trash2" size={16} style={{ color: "hsl(0,65%,60%)" }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модалка редактирования бейджика */}
      {badgeModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setBadgeModal(null)}>
          <div
            className="w-full max-w-sm bg-white rounded-t-3xl px-5 pt-5 pb-8 animate-slide-up"
            style={{ boxShadow: "0 -8px 32px rgba(0,0,0,0.12)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-base text-foreground" style={{ fontWeight: 700 }}>
                Бейджик — {badgeModal.user.displayName}
              </p>
              <button onClick={() => setBadgeModal(null)}>
                <Icon name="X" size={18} style={{ color: "hsl(25,15%,60%)" }} />
              </button>
            </div>

            {/* Предпросмотр */}
            <div className="flex items-center justify-center py-3 mb-4 rounded-2xl" style={{ background: "hsl(35,30%,96%)" }}>
              {badgeModal.text ? (
                <span className="text-sm px-3 py-1 rounded-xl" style={{ background: badgeModal.color.bg, color: badgeModal.color.text, fontWeight: 700 }}>
                  {badgeModal.text}
                </span>
              ) : (
                <p className="text-xs text-muted-foreground">Бейджик не задан</p>
              )}
            </div>

            {/* Текст */}
            <p className="text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>Текст бейджика</p>
            <input
              value={badgeModal.text}
              onChange={e => setBadgeModal(m => m ? { ...m, text: e.target.value.slice(0, 32) } : m)}
              placeholder="Например: VIP, Модератор..."
              className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none text-foreground placeholder:text-muted-foreground mb-4"
            />

            {/* Палитра цветов */}
            <p className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>Цвет бейджика</p>
            <div className="grid grid-cols-4 gap-2 mb-5">
              {BADGE_COLORS.map(c => (
                <button
                  key={c.label}
                  onClick={() => setBadgeModal(m => m ? { ...m, color: c } : m)}
                  className="py-1.5 rounded-xl text-[11px] font-semibold transition-all"
                  style={{
                    background: c.bg,
                    color: c.text,
                    outline: badgeModal.color.bg === c.bg ? `2px solid ${c.text}` : "2px solid transparent",
                    outlineOffset: "2px",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              {badgeModal.text && (
                <button
                  onClick={() => setBadgeModal(m => m ? { ...m, text: "" } : m)}
                  className="flex-1 py-2.5 rounded-2xl text-sm transition-all"
                  style={{ background: "hsl(0,70%,94%)", color: "hsl(0,70%,50%)", fontWeight: 600 }}
                >
                  Удалить
                </button>
              )}
              <button
                onClick={handleSaveBadge}
                disabled={savingBadge}
                className="flex-1 py-2.5 rounded-2xl text-white text-sm transition-all"
                style={{ background: savingBadge ? "hsl(22,40%,75%)" : "hsl(22,85%,62%)", fontWeight: 700 }}
              >
                {savingBadge ? "Сохраняем..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка смены пароля */}
      {resetPassModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setResetPassModal(null)}>
          <div
            className="w-full max-w-sm bg-white rounded-t-3xl px-5 pt-5 pb-8 animate-slide-up"
            style={{ boxShadow: "0 -8px 32px rgba(0,0,0,0.12)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-base text-foreground" style={{ fontWeight: 700 }}>Сменить пароль</p>
                <p className="text-xs text-muted-foreground">{resetPassModal.user.displayName}</p>
              </div>
              <button onClick={() => setResetPassModal(null)}>
                <Icon name="X" size={18} style={{ color: "hsl(25,15%,60%)" }} />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>Новый пароль</p>
            <input
              type="text"
              value={resetPassModal.newPassword}
              onChange={e => setResetPassModal(m => m ? { ...m, newPassword: e.target.value } : null)}
              placeholder="Минимум 4 символа"
              className="w-full bg-muted rounded-2xl px-4 py-3 text-sm outline-none mb-4"
              autoFocus
            />

            <div className="flex gap-2">
              <button
                onClick={() => setResetPassModal(null)}
                className="flex-1 py-2.5 rounded-2xl text-sm transition-all"
                style={{ background: "hsl(35,30%,92%)", color: "hsl(25,20%,45%)", fontWeight: 600 }}
              >
                Отмена
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetPassModal.saving}
                className="flex-1 py-2.5 rounded-2xl text-white text-sm transition-all"
                style={{ background: resetPassModal.saving ? "hsl(22,40%,75%)" : "hsl(22,85%,62%)", fontWeight: 700 }}
              >
                {resetPassModal.saving ? "Сохраняем..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1" style={{ fontWeight: 600 }}>{label}</p>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none text-foreground placeholder:text-muted-foreground"
        style={{ border: "2px solid transparent" }}
        onFocus={(e) => (e.target.style.borderColor = "hsl(22,85%,62%)")}
        onBlur={(e) => (e.target.style.borderColor = "transparent")}
      />
    </div>
  );
}