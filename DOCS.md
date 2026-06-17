# Семейка — Документация для разработчика

Приватный мессенджер для семьи: личные и групповые чаты, фото, управление участниками, профили.

---

## Стек

| Слой | Технология |
|---|---|
| Фронтенд | React 18 + TypeScript + Vite |
| Стили | Tailwind CSS + CSS-переменные |
| UI-компоненты | shadcn/ui (Radix UI) |
| Иконки | lucide-react через `<Icon name="..." />` |
| Роутинг | React Router v6 |
| Бэкенд | Python 3.11, Cloud Functions (serverless) |
| База данных | PostgreSQL (psycopg2, Simple Query Protocol) |
| Хранилище файлов | S3-совместимое (bucket.poehali.dev), CDN |
| Аутентификация | Сессионные токены в localStorage (`fc_session`) |

---

## Структура проекта

```
src/
├── pages/
│   ├── Index.tsx                    # Главная: навбар + переключение вкладок
│   └── NotFound.tsx
│
├── widgets/
│   └── BottomNav/ui/BottomNav.tsx   # Нижняя навигация (5 вкладок)
│
├── features/                        # Один модуль = один экран
│   ├── auth/ui/
│   │   ├── LoginScreen.tsx
│   │   ├── AdminPanel.tsx           # Управление участниками (только admin)
│   │   ├── ChangePasswordModal.tsx
│   │   ├── ChangeAvatarModal.tsx
│   │   └── EditProfileModal.tsx     # Смена имени и возраста
│   ├── chat/ui/
│   │   ├── ChatsScreen.tsx          # Список чатов
│   │   ├── ChatView.tsx             # Экран переписки
│   │   ├── ChatMessageBubble.tsx    # Пузырёк сообщения
│   │   ├── GroupInfoModal.tsx       # Участники группового чата
│   │   └── NewChatModal.tsx         # Создание чата
│   ├── family/ui/FamilyScreen.tsx   # Список участников семьи
│   ├── gallery/ui/GalleryScreen.tsx
│   ├── files/ui/FilesScreen.tsx
│   └── profile/ui/ProfileScreen.tsx # Профиль текущего пользователя
│
├── shared/
│   ├── api/index.ts         # ВСЕ запросы к бэкенду (единая точка)
│   ├── lib/
│   │   ├── AuthContext.tsx  # useAuth() — текущий пользователь + logout
│   │   └── push.ts          # Web Push подписка
│   └── ui/
│       ├── Avatar.tsx            # Аватар с индикатором онлайн
│       ├── UserProfileModal.tsx  # Модалка профиля любого пользователя
│       └── icon.tsx              # Обёртка над lucide-react

backend/
├── auth/index.py                 # Авторизация, профиль, управление пользователями
├── messages/index.py             # Чаты, сообщения, семья, профили
└── push-notifications/index.py  # Web Push уведомления

db_migrations/                   # SQL-миграции (только вперёд, без откатов)
```

> **Правило импортов:** фичи импортируют только из `shared/`. Фичи не импортируют друг друга напрямую.

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

Открой `src/widgets/BottomNav/ui/BottomNav.tsx`.

Найди тип `Tab` и массив вкладок, добавь новый элемент:

```tsx
// Добавить в тип Tab:
export type Tab = "chats" | "family" | "gallery" | "files" | "profile" | "my-feature";

// Добавить в массив вкладок:
{ id: "my-feature", icon: "Star", label: "Моё" }
```

### 3. Подключить в Index.tsx

```tsx
// src/pages/Index.tsx
import MyScreen from "@/features/my-feature/ui/MyScreen";

// В JSX, рядом с остальными вкладками:
{activeTab === "my-feature" && <MyScreen />}
```

---

## Добавить новый API-метод

### Шаг 1 — Бэкенд

Добавь новый блок в `backend/messages/index.py` **перед** финальным `return` (401/404) в конце файла:

```python
# my_action — что делает этот экшен
if action == "my_action":
    # Для GET — параметры из queryStringParameters:
    user_id = int((event.get("queryStringParameters") or {}).get("userId", 0))
    # Для POST — параметры из body (уже dict):
    name = body.get("name", "").strip()

    if not name:
        conn.close()
        return {"statusCode": 400, "headers": _CORS, "body": json.dumps({"error": "Нужно имя"})}

    cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE id = %s", (caller_id,))
    row = cur.fetchone()
    conn.close()

    return {"statusCode": 200, "headers": _CORS, "body": json.dumps({"ok": True, "id": row[0]})}
```

**Правила бэкенда — обязательно:**
- `conn.close()` перед каждым `return`
- `_CORS` в `headers` каждого ответа
- SQL-параметры только через `%s` — никогда не вставлять данные в f-string
- Авторизацию проверять через `caller = get_user_by_session(cur, session_token)` в начале обработчика
- `caller[0]` = id, `caller[1]` = username, `caller[2]` = display_name, `caller[3]` = role

### Шаг 2 — Фронтенд

Добавь функцию в `src/shared/api/index.ts`:

```ts
// GET-запрос (все параметры передаются строками)
export async function getMyData(userId: number): Promise<MyType> {
  const { data } = await msgCall("GET", "my_action", { userId: String(userId) });
  return data.result as MyType;
}

// POST-запрос
export async function saveMyData(payload: { name: string }): Promise<void> {
  const { status, data } = await msgCall("POST", "my_action", payload);
  if (status !== 200) throw new Error((data?.error as string) || "Ошибка");
}
```

Если экшен в `auth/index.py` — используй `call(...)` вместо `msgCall(...)`.

### Шаг 3 — Вызов в компоненте

```tsx
import { saveMyData } from "@/shared/api";

const handleSave = async () => {
  try {
    await saveMyData({ name: "Иван" });
  } catch (err) {
    console.error(err);
  }
};
```

---

## Добавить новый компонент UI

Переиспользуемые компоненты — в `src/shared/ui/`. Компоненты конкретного экрана — рядом с ним в `features/`.

```tsx
// src/shared/ui/InfoCard.tsx
type Props = {
  title: string;
  children: React.ReactNode;
};

export default function InfoCard({ title, children }: Props) {
  return (
    <div
      className="bg-white rounded-3xl p-4"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
    >
      <p className="text-sm text-foreground mb-2" style={{ fontWeight: 700 }}>
        {title}
      </p>
      {children}
    </div>
  );
}
```

**Дизайн-соглашения:**

| Элемент | Значение |
|---------|---------|
| Скругление карточки | `rounded-3xl` |
| Скругление кнопки | `rounded-2xl` |
| Тень карточки | `0 2px 12px rgba(0,0,0,0.06)` |
| Акцентная тень | `0 8px 24px hsla(22,85%,62%,0.35)` |
| Основной цвет (оранжевый) | `hsl(22,85%,62%)` |
| Вторичный цвет (розовый) | `hsl(340,60%,68%)` |
| Градиент кнопок | `linear-gradient(135deg, hsl(22,85%,62%), hsl(340,60%,68%))` |
| Мутный текст | `text-muted-foreground` |
| Иконки | `<Icon name="Home" size={20} />` — только через `@/shared/ui/icon` |

> Иконки — только через компонент `<Icon>`. Не импортировать из lucide-react напрямую — иначе ошибки при неверном имени.

---

## Изменить базу данных

Изменения схемы — только через миграции. Уже применённый файл нельзя менять.

```sql
-- db_migrations/V5__add_notes_column.sql
ALTER TABLE t_p3482084_react_native_family_.users
ADD COLUMN IF NOT EXISTS notes TEXT;
```

- Схема БД: `t_p3482084_react_native_family_` (константа `SCHEMA` в каждом бэкенд-файле)
- Нумерация: `V5__` — следующая после последней существующей
- Применить: инструмент `migrate_db`, затем проверить через `get_db_info`

| Таблица | Содержимое |
|---------|-----------|
| `users` | Логин, хэш пароля, роль, аватар, display_name, city, age, badge |
| `sessions` | Токены сессий (30 дней) |
| `chats` | Чаты (личные и групповые) |
| `chat_members` | Связь чат ↔ участник |
| `messages` | Сообщения (текст + image_url + reply_to_id) |
| `family_members` | Связь пользователь ↔ член семьи |
| `push_subscriptions` | Web Push подписки |

---

## Авторизация

### На фронтенде

```tsx
import { useAuth } from "@/shared/lib/AuthContext";

const { user, logout, setUser } = useAuth();

// user содержит:
// user.id, user.role ("admin" | "member")
// user.displayName, user.username, user.avatar
// user.city, user.age, user.bio
// user.badgeText, user.badgeColor
```

### На бэкенде

```python
session_token = (event.get("headers") or {}).get("x-session-id", "")
caller = get_user_by_session(cur, session_token)
if not caller:
    conn.close()
    return {"statusCode": 401, "headers": _CORS, "body": json.dumps({"error": "Не авторизован"})}

caller_id    = caller[0]  # int — id пользователя
display_name = caller[2]  # str
role         = caller[3]  # "admin" | "member"

# Проверка прав admin:
if role != "admin":
    conn.close()
    return {"statusCode": 403, "headers": _CORS, "body": json.dumps({"error": "Нет доступа"})}
```

---

## Загрузка файлов в S3

Файлы передаются через бэкенд в base64 внутри JSON-тела запроса.

```python
import boto3, os, base64, secrets

image_data = base64.b64decode(body.get("imageBase64"))
image_type = body.get("imageType", "image/jpeg")
ext = "jpg" if "jpeg" in image_type else image_type.split("/")[-1]

s3 = boto3.client(
    "s3",
    endpoint_url="https://bucket.poehali.dev",   # только этот endpoint
    aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
)

key = f"photos/img_{secrets.token_hex(8)}.{ext}"
s3.put_object(Bucket="files", Key=key, Body=image_data, ContentType=image_type)

cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
```

- Bucket всегда `"files"`
- Endpoint всегда `https://bucket.poehali.dev`
- CDN-путь строится через `AWS_ACCESS_KEY_ID`, не PROJECT_ID

---

## Справочник всех бэкенд-экшенов

### `auth` — авторизация и профиль

| Экшен | Метод | Доступ | Описание |
|-------|-------|--------|----------|
| `login` | POST | Все | Вход по username + password |
| `logout` | POST | Все | Завершение сессии |
| `me` | GET | Авториз. | Данные текущего пользователя |
| `create_user` | POST | admin | Создание пользователя |
| `list_users` | GET | admin | Список всех пользователей |
| `delete_user` | POST | admin | Удаление пользователя |
| `change_password` | POST | Авториз. | Смена своего пароля |
| `update_profile` | POST | Авториз. | Изменение имени и возраста |
| `update_avatar` | POST | Авториз. | Смена аватара (emoji или фото) |
| `update_badge` | POST | admin | Установка бейджа пользователю |
| `reset_password_admin` | POST | admin | Сброс пароля любому пользователю |

### `messages` — чаты, семья, профили

| Экшен | Метод | Описание |
|-------|-------|----------|
| `list_chats` | GET | Список чатов с последним сообщением |
| `get_messages` | GET | Сообщения чата (`chatId`, `since?`) |
| `send_message` | POST | Отправить текстовое сообщение |
| `send_photo` | POST | Отправить фото (base64) в чат |
| `create_direct` | POST | Создать личный чат с пользователем |
| `create_chat` | POST | Создать групповой чат |
| `delete_chat` | POST | Удалить чат |
| `get_users` | GET | Список участников семьи |
| `get_user_profile` | GET | Полный профиль пользователя по `userId` |
| `search_users` | POST | Поиск по имени / @username |
| `add_family` | POST | Добавить пользователя в семью |
| `remove_family` | POST | Убрать пользователя из семьи |
| `get_chat_members` | GET | Участники группового чата |
| `add_chat_member` | POST | Добавить участника в групповой чат |
| `remove_chat_member` | POST | Удалить участника из группового чата |

### `push-notifications` — уведомления

| Экшен | Метод | Описание |
|-------|-------|----------|
| `get_vapid_public_key` | GET | VAPID-ключ для Web Push |
| `subscribe` | POST | Подписаться на push-уведомления |
| `unsubscribe` | POST | Отписаться |
| `send_push` | POST | Отправить уведомление участникам чата |

---

## TypeScript-типы (src/shared/api/index.ts)

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

Добавить новый секрет: инструмент `put_secret` → пользователь вводит значение в UI → бэкенд читает через `os.environ["MY_SECRET"]`.

---

## Деплой

### Фронтенд
Билд запускается автоматически при сохранении. Статус — кнопка **«Опубликовать»**.
Подключить домен: **Опубликовать → Привязать свой домен** (SSL автоматически).

### Бэкенд
После изменений в `backend/` — вызвать `sync_backend`. Деплоятся только изменённые функции.

### Миграции БД
1. Написать SQL в `db_migrations/V{N}__name.sql`
2. Вызвать `migrate_db`
3. Проверить через `get_db_info`

### Скачать код
- **Скачать → Скачать код** — исходники
- **Скачать → Скачать билд** — готовый HTML+JS+CSS
- **Скачать → Подключить GitHub** — синхронизация в репозиторий
