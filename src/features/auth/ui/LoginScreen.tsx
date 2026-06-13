import { useState } from "react";
import Icon from "@/shared/ui/icon";
import { login, LoginLockedError } from "@/shared/api";
import { useAuth } from "@/shared/lib/AuthContext";

export default function LoginScreen() {
  const { setUser } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Введите логин и пароль");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const user = await login(username.trim(), password);
      setUser(user);
    } catch (err: unknown) {
      if (err instanceof LoginLockedError) {
        setLocked(true);
      }
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto overflow-hidden relative">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, hsl(35,60%,96%) 0%, hsl(22,40%,93%) 50%, hsl(340,40%,94%) 100%)",
        }}
      />
      <div
        className="absolute top-0 right-0 w-80 h-80 rounded-full pointer-events-none opacity-30"
        style={{
          background: "radial-gradient(circle, hsl(22,85%,75%), transparent 65%)",
          transform: "translate(35%,-35%)",
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-64 h-64 rounded-full pointer-events-none opacity-20"
        style={{
          background: "radial-gradient(circle, hsl(340,60%,75%), transparent 65%)",
          transform: "translate(-30%,30%)",
        }}
      />

      <div className="relative flex flex-col h-full px-6 py-8 justify-between">
        <div className="flex flex-col items-center pt-10 animate-slide-up">
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl mb-5"
            style={{
              background: "linear-gradient(135deg, hsl(22,85%,62%) 0%, hsl(340,60%,68%) 100%)",
              boxShadow: "0 12px 32px hsla(22,85%,62%,0.4)",
            }}
          >
            👨‍👩‍👧‍👦
          </div>
          <h1 className="text-3xl text-foreground mb-1" style={{ fontWeight: 800 }}>
            Семейка
          </h1>
          <p className="text-muted-foreground text-center text-sm">Наш семейный мессенджер</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4 animate-slide-up stagger-2">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block" style={{ fontWeight: 600 }}>
              Логин
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Icon name="User" size={18} style={{ color: "hsl(22,85%,58%)" }} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ваш логин"
                autoComplete="username"
                className="w-full bg-white rounded-2xl pl-11 pr-4 py-3.5 text-sm outline-none text-foreground placeholder:text-muted-foreground transition-all"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "2px solid transparent" }}
                onFocus={(e) => (e.target.style.borderColor = "hsl(22,85%,62%)")}
                onBlur={(e) => (e.target.style.borderColor = "transparent")}
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block" style={{ fontWeight: 600 }}>
              Пароль
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Icon name="Lock" size={18} style={{ color: "hsl(22,85%,58%)" }} />
              </div>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ваш пароль"
                autoComplete="current-password"
                className="w-full bg-white rounded-2xl pl-11 pr-12 py-3.5 text-sm outline-none text-foreground placeholder:text-muted-foreground transition-all"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "2px solid transparent" }}
                onFocus={(e) => (e.target.style.borderColor = "hsl(22,85%,62%)")}
                onBlur={(e) => (e.target.style.borderColor = "transparent")}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
              >
                <Icon name={showPass ? "EyeOff" : "Eye"} size={18} style={{ color: "hsl(25,15%,60%)" }} />
              </button>
            </div>
          </div>

          {locked ? (
            <div
              className="flex flex-col gap-1.5 px-4 py-3.5 rounded-2xl animate-fade-in"
              style={{ background: "hsl(0,70%,95%)" }}
            >
              <div className="flex items-center gap-2">
                <Icon name="LockKeyhole" size={16} style={{ color: "hsl(0,65%,55%)" }} />
                <span className="text-sm" style={{ color: "hsl(0,65%,40%)", fontWeight: 700 }}>Доступ заблокирован</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "hsl(0,55%,48%)" }}>
                Превышено количество попыток входа. Пожалуйста, свяжитесь с администратором для восстановления доступа.
              </p>
            </div>
          ) : error ? (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-2xl animate-fade-in"
              style={{ background: "hsl(0,70%,95%)" }}
            >
              <Icon name="AlertCircle" size={16} style={{ color: "hsl(0,65%,55%)" }} />
              <span className="text-sm" style={{ color: "hsl(0,65%,45%)", fontWeight: 600 }}>{error}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || locked}
            className="w-full py-4 rounded-2xl text-white text-base transition-all duration-200 active:scale-98 mt-2"
            style={{
              background: (loading || locked)
                ? "hsl(22,40%,75%)"
                : "linear-gradient(135deg, hsl(22,85%,62%) 0%, hsl(340,60%,68%) 100%)",
              fontWeight: 700,
              boxShadow: loading ? "none" : "0 8px 20px hsla(22,85%,62%,0.4)",
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Icon name="Loader2" size={18} style={{ color: "white" }} className="animate-spin" />
                Входим...
              </span>
            ) : "Войти"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground animate-fade-in pb-2">
          Нет аккаунта? Обратитесь к администратору семьи
        </p>
      </div>
    </div>
  );
}