# Семейка — Документация для разработчика

Приватный мессенджер для семьи: личные и групповые чаты, фото, документы, управление участниками, профили.

---

## Стек

| Слой | Технология |
|---|---|
| Фронтенд | React 18 + TypeScript + Vite |
| Стили | Tailwind CSS + CSS-переменные |
| UI-компоненты | shadcn/ui (Radix UI) — `src/components/ui/` |
| Иконки | lucide-react через `<Icon name="..." />` |
| Роутинг | React Router v6 |
| Бэкенд | Node.js + Express + TypeScript (`server/`) |
| База данных | PostgreSQL (пакет `pg`) |
| Хранилище файлов | Локальный диск (`server/uploads`, отдаётся через `express.static`) — интерфейс `StorageProvider` позволяет позже подключить S3 без изменения роутов |
| Push-уведомления | Web Push (`web-push`, VAPID) |
| Аутентификация | Сессионные токены в localStorage (`fc_session`), заголовок `X-Session-Id` |

---

## Архитектура: Feature-Sliced Design (FSD)

Проект следует FSD — каждый слой отвечает за свою зону ответственности.  
**Правило импортов:** слои могут импортировать только из нижестоящих слоёв:  
`pages` → `widgets` → `features` → `shared` → `components/ui`

```
src/
├── pages/                           # Слой: страницы-роуты
│   ├── Index.tsx                    # Главная: навигация + переключение вкладок
│   └── NotFound.tsx
│
├── widgets/                         # Слой: составные блоки, независимые от фич
│   └── BottomNav/
│       └── ui/
│           ├── BottomNav.tsx        # Нижняя навигация (мобиль)
│           └── SideNav.tsx          # Боковая навигация (десктоп)
│
├── features/                        # Слой: бизнес-фичи (один модуль = один экран)
│   ├── auth/
│   │   └── ui/
│   │       ├── LoginScreen.tsx         # Экран входа
│   │       ├── AdminPanel.tsx          # Управление участниками (только admin)
│   │       ├── ChangePasswordModal.tsx # Смена пароля
│   │       ├── ChangeAvatarModal.tsx   # Смена аватара (emoji / фото)
│   │       └── EditProfileModal.tsx    # Редактирование имени и возраста
│   ├── chat/
│   │   └── ui/
│   │       ├── ChatsScreen.tsx         # Список чатов
│   │       ├── ChatView.tsx            # Экран переписки
│   │       ├── ChatMessageBubble.tsx   # Пузырёк сообщения
│   │       ├── DocumentBubble.tsx      # Карточка документа в чате
│   │       ├── GroupInfoModal.tsx      # Участники группового чата
│   │       └── NewChatModal.tsx        # Создание личного / группового чата
│   ├── family/
│   │   └── ui/
│   │       └── FamilyScreen.tsx        # Список участников семьи
│   ├── gallery/
│   │   └── ui/
│   │       └── GalleryScreen.tsx       # Галерея фотографий
│   ├── files/
│   │   └── ui/
│   │       └── FilesScreen.tsx         # Файлы
│   └── profile/
│       └── ui/
│           └── ProfileScreen.tsx       # Профиль текущего пользователя
│
├── shared/                          # Слой: переиспользуемый код без привязки к фичам
│   ├── api/
│   │   └── index.ts                 # ВСЕ запросы к бэкенду (единая точка)
│   ├── lib/
│   │   ├── AuthContext.tsx          # React Context: текущий пользователь + logout
│   │   ├── push.ts                  # Web Push подписка / отписка
│   │   ├── utils.ts                 # cn() — хелпер для Tailwind классов
│   │   ├── use-toast.ts             # Хук useToast для уведомлений
│   │   └── use-mobile.tsx           # Хук useIsMobile (breakpoint 768px)
│   └── ui/
│       ├── Avatar.tsx               # Аватар с индикатором онлайн
│       ├── ModalSheet.tsx           # Универсальная обёртка модалок (sheet / dialog)
│       ├── UserProfileModal.tsx     # Модалка профиля любого пользователя
│       ├── OnlineStatus.tsx         # Индикатор онлайн-статуса
│       ├── icon.tsx                 # Обёртка над lucide-react (<Icon name="..." />)
│       ├── toaster.tsx              # Реэкспорт Toaster из components/ui
│       ├── sonner.tsx               # Реэкспорт Sonner из components/ui
│       └── tooltip.tsx              # Реэкспорт TooltipProvider
│
└── components/                      # shadcn/ui примитивы — НЕ редактировать вручную
    └── ui/                          # Button, Input, Dialog, Sheet, Toast и др.

server/                              # Express-бэкенд (TypeScript, отдельный npm-пакет)
├── migrations/                      # SQL-миграции (только вперёд, без откатов)
│   └── 0001_init.sql
├── uploads/                         # локальное хранилище файлов (gitignored)
└── src/
    ├── index.ts                     # создание app, express.listen
    ├── env.ts                       # чтение переменных окружения
    ├── db.ts                        # pg.Pool
    ├── migrate.ts                   # раннер миграций (npm run migrate)
    ├── lib/
    │   ├── password.ts              # хэширование/проверка пароля
    │   ├── time.ts                  # форматирование дат (МСК, "онлайн N назад")
    │   └── storage.ts               # StorageProvider (сейчас — локальный диск)
    ├── middleware/auth.ts           # requireAuth / requireAdmin
    └── routes/
        ├── auth.ts                  # /api/auth/*
        ├── chats.ts                 # /api/chats/*, /api/family/*, /api/users/*
        └── push.ts                  # /api/push/*
```

---

## Что было убрано при рефакторинге (FSD-миграция)

В проекте существовали две параллельные структуры. Устаревшие дубликаты удалены:

| Удалённый файл | Актуальная замена |
|---|---|
| `src/components/LoginScreen.tsx` | `src/features/auth/ui/LoginScreen.tsx` |
| `src/components/ProfileScreen.tsx` | `src/features/profile/ui/ProfileScreen.tsx` |
| `src/components/AdminPanel.tsx` | `src/features/auth/ui/AdminPanel.tsx` |
| `src/components/ChangePasswordModal.tsx` | `src/features/auth/ui/ChangePasswordModal.tsx` |
| `src/components/ChangeAvatarModal.tsx` | `src/features/auth/ui/ChangeAvatarModal.tsx` |
| `src/components/ChatsScreen.tsx` | `src/features/chat/ui/ChatsScreen.tsx` |
| `src/components/FamilyScreen.tsx` | `src/features/family/ui/FamilyScreen.tsx` |
| `src/components/GalleryScreen.tsx` | `src/features/gallery/ui/GalleryScreen.tsx` |
| `src/components/FilesScreen.tsx` | `src/features/files/ui/FilesScreen.tsx` |
| `src/components/chat/ChatView.tsx` | `src/features/chat/ui/ChatView.tsx` |
| `src/components/chat/ChatMessageBubble.tsx` | `src/features/chat/ui/ChatMessageBubble.tsx` |
| `src/components/chat/NewChatModal.tsx` | `src/features/chat/ui/NewChatModal.tsx` |
| `src/lib/api.ts` | `src/shared/api/index.ts` |
| `src/lib/AuthContext.tsx` | `src/shared/lib/AuthContext.tsx` |

> `src/lib/utils.ts` и `src/hooks/` — файлы платформы (readonly), не удаляются.  
> Их импорты в `components/ui/sidebar.tsx` и `components/ui/toaster.tsx` переключены на `@/shared/lib/`.

---

## Добавить новый экран

### 1. Создать компонент

```tsx
// src/features/my-feature/ui/MyScreen.tsx
export default function MyScreen() {
  return <div className="p-4">Мой экран</div>;
}
```

### 2. Добавить вкладку в навигацию

**Мобиль** — `src/widgets/BottomNav/ui/BottomNav.tsx`  
**Десктоп** — `src/widgets/BottomNav/ui/SideNav.tsx`

```tsx
export type Tab = "chats" | "family" | "gallery" | "files" | "profile" | "my-feature";
// добавить в массив tabs:
{ id: "my-feature", icon: "Star", label: "Моё" }
```

### 3. Подключить в Index.tsx

```tsx
import MyScreen from "@/features/my-feature/ui/MyScreen";

{activeTab === "my-feature" && <MyScreen />}
```

---

## Добавить новый API-метод

### Шаг 1 — Бэкенд: `server/src/routes/chats.ts` (или `auth.ts` / `push.ts`)

```ts
chatsRouter.get("/my-data/:id", async (req, res) => {
  const id = Number(req.params.id);
  const result = await query<{ id: number }>("SELECT id FROM users WHERE id = $1", [id]);
  res.json({ id: result.rows[0]?.id });
});
```

Роутер уже навешан на `requireAuth` (см. `chatsRouter.use(requireAuth)`), поэтому `req.user` доступен во всех хендлерах. Для admin-только роутов добавляй `requireAdmin` после `requireAuth`. Async-ошибки сами долетают до общего error-handler в `index.ts` (патч от `express-async-errors`) — try/catch не нужен для обычных исключений.

### Шаг 2 — Фронтенд: `src/shared/api/index.ts`

```ts
export async function getMyData(id: number): Promise<MyType> {
  const { data } = await apiFetch(`/chats/my-data/${id}`, "GET");
  return data as MyType;
}

export async function saveMyData(payload: { name: string }): Promise<void> {
  const { status, data } = await apiFetch("/chats/my-data", "POST", payload);
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка");
}
```

---

## Добавить компонент UI

Переиспользуемые компоненты — в `src/shared/ui/`.  
Компоненты конкретного экрана — рядом с ним в `features/{name}/ui/`.

```tsx
// src/shared/ui/InfoCard.tsx
type Props = { title: string; children: React.ReactNode };

export default function InfoCard({ title, children }: Props) {
  return (
    <div className="bg-white rounded-3xl p-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
      <p className="text-sm text-foreground mb-2" style={{ fontWeight: 700 }}>{title}</p>
      {children}
    </div>
  );
}
```

### Модалки

Все модалки оборачиваются в `<ModalSheet onClose={onClose}>`:

```tsx
import ModalSheet from "@/shared/ui/ModalSheet";

export default function MyModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalSheet onClose={onClose}>
      <div className="px-4 pt-5 pb-6">
        {/* содержимое */}
      </div>
    </ModalSheet>
  );
}
```

- **Мобиль:** выезжает снизу  
- **Десктоп:** диалог по центру, закрывается по `Escape` или клику на фон

### Дизайн-соглашения

| Элемент | Значение |
|---|---|
| Скругление карточки | `rounded-3xl` |
| Скругление кнопки | `rounded-2xl` |
| Тень карточки | `0 2px 12px rgba(0,0,0,0.06)` |
| Акцентная тень | `0 8px 24px hsla(22,85%,62%,0.35)` |
| Основной цвет (оранжевый) | `hsl(22,85%,62%)` |
| Вторичный цвет (розовый) | `hsl(340,60%,68%)` |
| Градиент кнопок | `linear-gradient(135deg, hsl(22,85%,62%), hsl(340,60%,68%))` |
| Мутный текст | `text-muted-foreground` |
| Иконки | `<Icon name="Home" size={20} />` — только через `@/shared/ui/icon` |

---

## Изменить базу данных

Только через миграции в `server/migrations/` (простой раннер, без ORM):

```sql
-- server/migrations/0002_add_my_column.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS my_field TEXT;
```

Таблицы не квалифицируются именем схемы — она задаётся один раз через `DB_SCHEMA` в `.env` (по умолчанию `public`) и применяется через `search_path`. Применить миграции: `npm run server:migrate` из корня (или `npm run migrate` из `server/`).

| Таблица | Содержимое |
|---|---|
| `users` | Логин, хэш пароля, роль, аватар, display_name, city, age, badge |
| `sessions` | Токены сессий (30 дней) |
| `chats` | Чаты (личные и групповые) |
| `chat_members` | Связь чат ↔ участник |
| `messages` | Сообщения (текст + image_url + reply_to_id) |
| `chat_documents` | Документы в чатах (удаляются через 24ч) |
| `family_members` | Связь пользователь ↔ член семьи |
| `push_subscriptions` | Web Push подписки |
| `login_attempts` | Попытки входа (блокировка после 3 неудач) |

---

## Авторизация

### Фронтенд

```tsx
import { useAuth } from "@/shared/lib/AuthContext";

const { user, logout, setUser } = useAuth();
// user.id, user.role ("admin" | "member"), user.displayName
// user.username, user.avatar, user.city, user.age, user.bio
// user.badgeText, user.badgeColor
```

### Бэкенд

```ts
import { requireAuth, requireAdmin } from "../middleware/auth.js";

router.get("/something", requireAuth, async (req, res) => {
  const caller = req.user!; // { id, username, displayName, role, avatar, bio, city, age, badgeText, badgeColor }
  res.json({ ok: true });
});

router.post("/admin-only", requireAuth, requireAdmin, async (req, res) => {
  // req.user.role === "admin" гарантирован requireAdmin
});
```

---

## Загрузка файлов

```ts
import { storage, extFromContentType } from "../lib/storage.js";

const buffer = Buffer.from(req.body.fileBase64, "base64");
const { key, url } = await storage.save(buffer, "my-folder", extFromContentType(req.body.fileType), req.body.fileType);
// url — абсолютный адрес вида `${PUBLIC_BASE_URL}/uploads/my-folder/<hash>.<ext>`
// key — относительный путь, нужен для storage.delete(key)
```

Сейчас `storage` — `LocalStorageProvider` (пишет в `server/uploads/`, отдаёт через `express.static`). Когда появится внешнее хранилище — реализовать `S3StorageProvider` с тем же интерфейсом `StorageProvider` (`server/src/lib/storage.ts`) и подменить экспортируемый `storage`; роуты (`auth.ts`, `chats.ts`) не меняются.

---

## Справочник REST-роутов

### `/api/auth`

| Роут | Метод | Доступ | Описание |
|---|---|---|---|
| `/login` | POST | Все | Вход по username + password |
| `/logout` | POST | Авториз. | Завершение сессии |
| `/me` | GET | Авториз. | Данные текущего пользователя |
| `/users` | GET | admin | Список всех пользователей |
| `/users` | POST | admin | Создание пользователя |
| `/users/:id` | DELETE | admin | Удаление пользователя |
| `/users/:id/reset-password` | POST | admin | Сброс пароля любому пользователю |
| `/users/:id/badge` | PATCH | admin | Установка бейджа пользователю |
| `/me/password` | PATCH | Авториз. | Смена своего пароля |
| `/me/avatar` | PATCH | Авториз. | Смена аватара (emoji или фото) |
| `/me/profile` | PATCH | Авториз. | Изменение имени и возраста |

### `/api/chats`, `/api/family`, `/api/users` (все — авторизованные)

| Роут | Метод | Описание |
|---|---|---|
| `/chats` | GET | Список чатов с последним сообщением |
| `/chats/direct` | POST | Создать личный чат |
| `/chats/group` | POST | Создать групповой чат |
| `/chats/:chatId` | DELETE | Удалить чат |
| `/chats/:chatId/messages` | GET | Сообщения чата (`?since=` для поллинга), с документами |
| `/chats/:chatId/messages` | POST | Отправить текстовое сообщение |
| `/chats/:chatId/photos` | POST | Отправить фото (base64) |
| `/chats/:chatId/documents` | POST | Отправить документ (удаляется через 24ч) |
| `/chats/:chatId/documents` | GET | Активные документы чата |
| `/chats/:chatId/members` | GET | Участники группового чата |
| `/chats/:chatId/members` | POST | Добавить участника |
| `/chats/:chatId/members/:userId` | DELETE | Удалить участника |
| `/chats/:chatId/notify` | POST | Отправить push участникам чата |
| `/family` | GET | Участники семьи |
| `/family/:userId` | POST | Добавить в семью |
| `/family/:userId` | DELETE | Убрать из семьи |
| `/users/search?q=` | GET | Поиск по имени / @username |
| `/users/:userId` | GET | Полный профиль пользователя |

### `/api/push`

| Роут | Метод | Доступ | Описание |
|---|---|---|---|
| `/vapid-key` | GET | Все | VAPID-ключ для Web Push |
| `/subscriptions` | POST | Авториз. | Подписаться на уведомления |
| `/subscriptions` | DELETE | Авториз. | Отписаться |

---

## TypeScript-типы (`src/shared/api/index.ts`)

```ts
type User = {
  id: number; username: string; displayName: string;
  role: "admin" | "member"; avatar: string;
  bio: string; city: string; age: number | null;
  badgeText?: string; badgeColor?: string;
};

type Chat = {
  id: number; name: string; avatar: string; isGroup: boolean;
  lastText: string; lastAuthor: string; lastAt: string;
  unread: number; onlineStatus?: string | null;
};

type Message = {
  id: number; text: string; imageUrl?: string | null;
  time: string; date: string; userId: number;
  displayName: string; avatar: string; isMe: boolean;
  replyTo?: ReplyTo | null;
  document?: DocumentAttachment | null;
};

type DocumentAttachment = {
  id: number; fileName: string; fileSize: number;
  fileType: string; url: string; expiresAt: string | null;
};

type FamilyUser = {
  id: number; displayName: string; avatar: string;
  city: string; age?: number | null; onlineStatus?: string | null;
  role: string; inFamily: boolean;
  badgeText?: string; badgeColor?: string;
};
```

---

## Переменные окружения

Бэкенд (`server/.env`, см. `server/.env.example`):

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | Строка подключения к PostgreSQL |
| `DB_SCHEMA` | Схема БД (по умолчанию `public`) |
| `PORT` | Порт Express (по умолчанию 3001) |
| `PUBLIC_BASE_URL` | Публичный адрес бэкенда — используется для построения ссылок на загруженные файлы |
| `FRONTEND_ORIGIN` | Origin фронтенда для CORS |
| `UPLOAD_DIR` | Папка для локального хранилища файлов |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Ключи для Web Push (генерируются через `npx web-push generate-vapid-keys`) |

Фронтенд (корневой `.env`, см. `.env.example`): `VITE_API_BASE_URL` (в dev не нужен — Vite проксирует `/api` на `localhost:3001`).

---

## Локальный запуск

```bash
# 1. Поднять Postgres (или укажи свой DATABASE_URL)
docker compose up -d

# 2. Бэкенд
cd server
cp .env.example .env   # заполнить DATABASE_URL/VAPID-ключи при необходимости
npm install
npm run migrate        # создаёт таблицы + сидового admin/admin123
npm run dev             # http://localhost:3001

# 3. Фронтенд (в отдельном терминале, из корня)
npm install
npm run dev             # http://localhost:5173, /api проксируется на бэкенд
```

Либо из корня одной командой: `npm run dev:all` (поднимает и фронт, и бэк через `concurrently`; Postgres и `npm run server:migrate` нужно подготовить заранее).

## Деплой в прод

- Собрать фронтенд: `npm run build` → статика в `dist/`, раздать через любой веб-сервер/CDN.
- Собрать бэкенд: `npm run server:build` (или `cd server && npm run build`) → `server/dist/`, запускать `node dist/index.js` (понадобится свой процесс-менеджер — pm2/systemd/Docker — и реальный `DATABASE_URL`/VAPID-ключи/`PUBLIC_BASE_URL`).
- Применить миграции на проде: `DATABASE_URL=... npm run migrate` из `server/`.
