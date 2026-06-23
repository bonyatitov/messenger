/**
 * ModalSheet — универсальная обёртка для модальных окон.
 * Мобиль: выезжает снизу (sheet).
 * Десктоп (md+): появляется по центру экрана как диалог.
 */
import { useEffect } from "react";

type Props = {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
};

export default function ModalSheet({ onClose, children, maxWidth = 448 }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Мобиль: внизу */}
      <div
        className="md:hidden w-full mt-auto bg-white rounded-t-3xl animate-slide-up overflow-hidden"
        style={{ maxWidth, margin: "auto auto 0 auto", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>

      {/* Десктоп: по центру */}
      <div
        className="hidden md:block w-full bg-white rounded-3xl animate-fade-in overflow-hidden"
        style={{ maxWidth, margin: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.22)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
