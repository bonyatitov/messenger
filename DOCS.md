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
| Бэкенд | Python 3.11, Cloud Functions (serverless) |
| База данных | PostgreSQL (psycopg2, Simple Query Protocol) |
| Хранилище файлов | S3-совместимое (bucket.poehali.dev), CDN |
| Аутентификация | Сессионные токены в localStorage (`fc_session`) |

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

backend/
├── auth/index.py                    # Авторизация, профиль, управление пользователями
├── messages/index.py                # Чаты, сообщения, документы, семья
└── push-notifications/index.py     # Web Push уведомления

db_migrations/                      # SQL-миграции (только вперёд, без откатов)
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

### Шаг 1 — Бэкенд: `backend/messages/index.py`

Добавь новый блок **перед** финальным `return 404`:

```python
# my_action — описание
if action == "my_action":
    # GET: параметры из queryStringParameters
    param = (event.get("queryStringParameters") or {}).get("param", "")
    # POST: параметры из body
    param = body.get("param", "")

    cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE id = %s", (caller_id,))
    row = cur.fetchone()
    conn.close()
    return {"statusCode": 200, "headers": _CORS, "body": json.dumps({"id": row[0]})}
```

**Обязательно:** `conn.close()` перед каждым `return`, `_CORS` в заголовках, `%s` для SQL-параметров.

### Шаг 2 — Фронтенд: `src/shared/api/index.ts`

```ts
// GET
export async function getMyData(id: number): Promise<MyType> {
  const { data } = await msgCall("GET", "my_action", { id: String(id) });
  return data.result as MyType;
}

// POST
export async function saveMyData(payload: { name: string }): Promise<void> {
  const { status, data } = await msgCall("POST", "my_action", payload);
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка");
}
```

Для `auth/index.py` — используй `call(...)` вместо `msgCall(...)`.

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

Только через миграции в `db_migrations/`:

```sql
-- db_migrations/V7__add_my_column.sql
ALTER TABLE t_p3482084_react_native_family_.users
ADD COLUMN IF NOT EXISTS my_field TEXT;
```

Схема БД: `t_p3482084_react_native_family_` (константа `SCHEMA` в бэкенде).

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

```python
session_token = (event.get("headers") or {}).get("x-session-id", "")
caller = get_user_by_session(cur, session_token)
if not caller:
    conn.close()
    return {"statusCode": 401, "headers": _CORS, "body": json.dumps({"error": "Не авторизован"})}

caller_id    = caller[0]   # int
display_name = caller[2]   # str
role         = caller[3]   # "admin" | "member"
avatar       = caller[4]   # str

# Проверка прав admin:
if role != "admin":
    conn.close()
    return {"statusCode": 403, "headers": _CORS, "body": json.dumps({"error": "Нет доступа"})}
```

---

## Загрузка файлов в S3

```python
import boto3, os, base64, secrets

file_data = base64.b64decode(body.get("fileBase64"))
s3 = boto3.client(
    "s3",
    endpoint_url="https://bucket.poehali.dev",
    aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
)
key = f"folder/{secrets.token_hex(8)}.jpg"
s3.put_object(Bucket="files", Key=key, Body=file_data, ContentType="image/jpeg")
cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
```

- Bucket всегда `"files"`, endpoint всегда `https://bucket.poehali.dev`
- CDN-путь строится через `AWS_ACCESS_KEY_ID`

---

## Справочник бэкенд-экшенов

### `auth`

| Экшен | Метод | Доступ | Описание |
|---|---|---|---|
| `login` | POST | Все | Вход по username + password |
| `logout` | POST | Авториз. | Завершение сессии |
| `me` | GET | Авториз. | Данные текущего пользователя |
| `create_user` | POST | admin | Создание пользователя |
| `list_users` | GET | admin | Список всех пользователей |
| `delete_user` | POST | admin | Удаление пользователя |
| `change_password` | POST | Авториз. | Смена своего пароля |
| `update_profile` | POST | Авториз. | Изменение имени и возраста |
| `update_avatar` | POST | Авториз. | Смена аватара (emoji или фото) |
| `update_badge` | POST | admin | Установка бейджа пользователю |
| `reset_password_admin` | POST | admin | Сброс пароля любому пользователю |

### `messages`

| Экшен | Метод | Описание |
|---|---|---|
| `list_chats` | GET | Список чатов с последним сообщением |
| `get_messages` | GET | Сообщения чата (с документами) |
| `send_message` | POST | Отправить текстовое сообщение |
| `send_photo` | POST | Отправить фото (base64) |
| `send_document` | POST | Отправить документ PDF/Word/Excel (удаляется через 24ч) |
| `get_documents` | GET | Активные документы чата |
| `create_direct` | POST | Создать личный чат |
| `create_chat` | POST | Создать групповой чат |
| `delete_chat` | POST | Удалить чат |
| `get_users` | GET | Участники семьи |
| `get_user_profile` | GET | Полный профиль пользователя |
| `search_users` | POST | Поиск по имени / @username |
| `add_family` | POST | Добавить в семью |
| `remove_family` | POST | Убрать из семьи |
| `get_chat_members` | GET | Участники группового чата |
| `add_chat_member` | POST | Добавить участника |
| `remove_chat_member` | POST | Удалить участника |

### `push-notifications`

| Экшен | Метод | Описание |
|---|---|---|
| `get_vapid_public_key` | GET | VAPID-ключ для Web Push |
| `subscribe` | POST | Подписаться на уведомления |
| `unsubscribe` | POST | Отписаться |
| `send_push` | POST | Отправить уведомление участникам чата |

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

## Секреты (только для бэкенда)

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | Строка подключения к PostgreSQL |
| `AWS_ACCESS_KEY_ID` | Ключ S3-хранилища и часть CDN-пути |
| `AWS_SECRET_ACCESS_KEY` | Секрет S3-хранилища |

---

## Деплой

**Фронтенд** — билд автоматически при сохранении. Домен: **Опубликовать → Привязать свой домен**.

**Бэкенд** — после изменений в `backend/` вызвать `sync_backend`. Деплоятся только изменённые функции.

**Миграции БД** — создать `db_migrations/V{N}__name.sql`, вызвать `migrate_db`, проверить `get_db_info`.

**Скачать код** — **Скачать → Скачать код** (исходники) или **Скачать билд** (HTML+JS+CSS).
