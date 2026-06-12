import { useState, useRef } from "react";
import Icon from "@/shared/ui/icon";
import { updateAvatar } from "@/shared/api";
import { useAuth } from "@/shared/lib/AuthContext";

const EMOJI_LIST = [
  "👨", "👩", "👧", "👦", "👴", "👵", "🧒", "👶", "🧑",
  "🧔", "👱", "🧕", "👲", "🎅", "🧙", "🦸", "🧝", "🤴",
  "👸", "🤶", "🧑‍🍳", "🧑‍🎨", "🧑‍🚀", "🧑‍💻", "🦊", "🐱", "🐶",
  "🐻", "🐼", "🦁", "🐯", "🦝", "🐸", "🦋", "🌸", "⭐",
];

type Props = { onClose: () => void };

export default function ChangeAvatarModal({ onClose }: Props) {
  const { user, setUser } = useAuth();
  const [tab, setTab] = useState<"emoji" | "photo">("emoji");
  const [selectedEmoji, setSelectedEmoji] = useState(user?.avatar || "👤");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageType, setImageType] = useState("image/jpeg");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Файл слишком большой. Максимум 5 МБ");
      return;
    }
    setError("");
    const detectedType = file.type || (file.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
    setImageType(detectedType);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setPreviewUrl(result);
      setImageBase64(result.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      let newAvatar: string;
      if (tab === "emoji") {
        newAvatar = await updateAvatar({ emoji: selectedEmoji });
      } else {
        if (!imageBase64) { setError("Выберите фото"); setLoading(false); return; }
        newAvatar = await updateAvatar({ imageBase64, imageType });
      }
      if (user) setUser({ ...user, avatar: newAvatar });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const isPhotoEmoji = user?.avatar?.startsWith("http");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md bg-white rounded-t-3xl animate-slide-up"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
      >
        <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-border flex-shrink-0">
          <p className="text-base text-foreground" style={{ fontWeight: 700 }}>Изменить аватар</p>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted">
            <Icon name="X" size={18} style={{ color: "hsl(25,15%,55%)" }} />
          </button>
        </div>

        <div className="flex justify-center pt-4 pb-2 flex-shrink-0">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden" style={{ background: "hsl(35,45%,90%)" }}>
            {tab === "photo" && previewUrl ? (
              <img src={previewUrl} alt="" className="w-full h-full object-cover" />
            ) : tab === "emoji" ? (
              <span className="text-4xl">{selectedEmoji}</span>
            ) : isPhotoEmoji && user?.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl">{user?.avatar || "👤"}</span>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-4 pb-3 flex-shrink-0">
          {(["emoji", "photo"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-xl text-sm transition-all"
              style={{
                background: tab === t ? "hsl(22,85%,62%)" : "hsl(35,45%,92%)",
                color: tab === t ? "white" : "hsl(25,30%,40%)",
                fontWeight: 600,
              }}
            >
              {t === "emoji" ? "😊 Эмодзи" : "📷 Фото"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-2">
          {tab === "emoji" ? (
            <div className="grid grid-cols-7 gap-2">
              {EMOJI_LIST.map((em) => (
                <button
                  key={em}
                  onClick={() => setSelectedEmoji(em)}
                  className="w-full aspect-square rounded-2xl flex items-center justify-center text-2xl transition-all"
                  style={{
                    background: selectedEmoji === em ? "hsl(22,85%,62%)" : "hsl(35,40%,94%)",
                    transform: selectedEmoji === em ? "scale(1.1)" : "scale(1)",
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-4">
              {previewUrl ? (
                <div className="relative w-48 h-48 rounded-3xl overflow-hidden">
                  <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => { setPreviewUrl(null); setImageBase64(null); }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center"
                  >
                    <Icon name="X" size={13} style={{ color: "white" }} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-48 h-48 rounded-3xl flex flex-col items-center justify-center gap-3 border-2 border-dashed transition-all"
                  style={{ borderColor: "hsl(22,85%,70%)", background: "hsl(22,85%,97%)" }}
                >
                  <Icon name="Upload" size={28} style={{ color: "hsl(22,85%,62%)" }} />
                  <p className="text-sm text-center" style={{ color: "hsl(22,85%,55%)", fontWeight: 600 }}>
                    Нажмите чтобы<br />выбрать фото
                  </p>
                </button>
              )}
              <p className="text-xs text-muted-foreground">JPG, PNG до 5 МБ</p>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>
          )}
        </div>

        <div className="px-4 pb-6 pt-3 flex-shrink-0 border-t border-border">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl mb-3" style={{ background: "hsl(0,70%,95%)" }}>
              <Icon name="AlertCircle" size={14} style={{ color: "hsl(0,65%,55%)" }} />
              <span className="text-xs" style={{ color: "hsl(0,65%,45%)", fontWeight: 600 }}>{error}</span>
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl text-white text-sm transition-all active:scale-95"
            style={{
              background: loading ? "hsl(22,40%,75%)" : "linear-gradient(135deg, hsl(22,85%,62%), hsl(340,60%,68%))",
              fontWeight: 700,
              boxShadow: loading ? "none" : "0 6px 16px hsla(22,85%,62%,0.35)",
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Icon name="Loader2" size={16} className="animate-spin" style={{ color: "white" }} />
                Сохраняем...
              </span>
            ) : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}