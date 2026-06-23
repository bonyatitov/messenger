import Icon from "@/shared/ui/icon";
import { DocumentAttachment } from "@/shared/api";

type Props = {
  doc: DocumentAttachment;
  isMe: boolean;
};

function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function getFileIcon(fileType: string, fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (fileType.includes("pdf") || ext === "pdf") return "FileText";
  if (fileType.includes("word") || ext === "doc" || ext === "docx") return "FileType";
  if (fileType.includes("excel") || fileType.includes("spreadsheet") || ext === "xls" || ext === "xlsx") return "Table";
  return "File";
}

function getFileColor(fileType: string, fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (fileType.includes("pdf") || ext === "pdf") return "hsl(0,75%,55%)";
  if (fileType.includes("word") || ext === "doc" || ext === "docx") return "hsl(210,85%,55%)";
  if (fileType.includes("excel") || fileType.includes("spreadsheet") || ext === "xls" || ext === "xlsx") return "hsl(142,65%,42%)";
  return "hsl(25,60%,55%)";
}

function getTimeLeft(expiresAt: string | null): string {
  if (!expiresAt) return "";
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "истёк";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  return `${minutes} мин`;
}

export default function DocumentBubble({ doc, isMe }: Props) {
  const iconName = getFileIcon(doc.fileType, doc.fileName);
  const iconColor = getFileColor(doc.fileType, doc.fileName);
  const timeLeft = getTimeLeft(doc.expiresAt);
  const isExpired = doc.expiresAt ? new Date(doc.expiresAt).getTime() < Date.now() : false;

  const handleDownload = () => {
    if (isExpired) return;
    const a = document.createElement("a");
    a.href = doc.url;
    a.download = doc.fileName;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isExpired}
      className="flex items-center gap-3 rounded-2xl p-3 transition-all text-left w-full"
      style={{
        background: isMe ? "rgba(255,255,255,0.18)" : "hsl(35,30%,96%)",
        border: `1px solid ${isMe ? "rgba(255,255,255,0.25)" : "hsl(35,25%,88%)"}`,
        opacity: isExpired ? 0.5 : 1,
        cursor: isExpired ? "not-allowed" : "pointer",
        minWidth: 200,
        maxWidth: 260,
      }}
    >
      {/* Иконка типа файла */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${iconColor}18` }}
      >
        <Icon name={iconName} size={20} style={{ color: iconColor }} />
      </div>

      {/* Имя и мета */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm truncate leading-tight"
          style={{
            fontWeight: 600,
            color: isMe ? "white" : "hsl(25,30%,20%)",
          }}
        >
          {doc.fileName}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {doc.fileSize > 0 && (
            <span className="text-[11px]" style={{ color: isMe ? "rgba(255,255,255,0.65)" : "hsl(25,15%,55%)" }}>
              {formatSize(doc.fileSize)}
            </span>
          )}
          {timeLeft && !isExpired && (
            <>
              <span style={{ color: isMe ? "rgba(255,255,255,0.4)" : "hsl(35,25%,75%)" }}>·</span>
              <span className="text-[11px]" style={{ color: isMe ? "rgba(255,255,255,0.55)" : "hsl(25,60%,55%)", fontWeight: 500 }}>
                ⏱ {timeLeft}
              </span>
            </>
          )}
          {isExpired && (
            <span className="text-[11px]" style={{ color: isMe ? "rgba(255,255,255,0.55)" : "hsl(0,65%,55%)" }}>
              Файл удалён
            </span>
          )}
        </div>
      </div>

      {/* Иконка скачать */}
      {!isExpired && (
        <Icon
          name="Download"
          size={16}
          style={{ color: isMe ? "rgba(255,255,255,0.7)" : "hsl(22,85%,58%)", flexShrink: 0 }}
        />
      )}
    </button>
  );
}
