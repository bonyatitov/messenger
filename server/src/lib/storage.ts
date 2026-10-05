import { mkdirSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { env } from "../env.js";

export interface SavedFile {
  key: string;
  url: string;
}

export interface StorageProvider {
  save(buffer: Buffer, keyPrefix: string, ext: string, contentType: string): Promise<SavedFile>;
  delete(key: string): Promise<void>;
}

/**
 * Хранит файлы на диске сервера, отдаёт их через express.static на /uploads.
 * Когда появится внешнее хранилище (S3/R2/MinIO) — добавить S3StorageProvider
 * с тем же интерфейсом и подменить экспортируемый `storage`, роуты не меняются.
 */
class LocalStorageProvider implements StorageProvider {
  async save(buffer: Buffer, keyPrefix: string, ext: string, _contentType: string): Promise<SavedFile> {
    const dir = join(env.uploadDir, keyPrefix);
    mkdirSync(dir, { recursive: true });
    const filename = `${randomBytes(8).toString("hex")}.${ext}`;
    writeFileSync(join(dir, filename), buffer);
    const key = `${keyPrefix}/${filename}`;
    return { key, url: `${env.publicBaseUrl}/uploads/${key}` };
  }

  async delete(key: string): Promise<void> {
    try {
      unlinkSync(join(env.uploadDir, key));
    } catch {
      // файла может уже не быть — не критично
    }
  }
}

export const storage: StorageProvider = new LocalStorageProvider();

export function extFromContentType(contentType: string, fallback = "bin"): string {
  if (contentType.includes("jpeg")) return "jpg";
  const parts = contentType.split("/");
  return parts[1] || fallback;
}

export function extFromFileName(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "bin" : fileName.slice(idx + 1).toLowerCase();
}
