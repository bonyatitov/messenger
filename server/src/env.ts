import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Переменная окружения ${name} не задана`);
  return value;
}

const dbSchema = process.env.DB_SCHEMA || "public";
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbSchema)) {
  throw new Error(`DB_SCHEMA="${dbSchema}" содержит недопустимые символы`);
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  dbSchema,
  port: Number(process.env.PORT || 3001),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "http://localhost:3001",
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || "",
};
