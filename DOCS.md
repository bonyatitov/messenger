# Семейка — семейный мессенджер

Приватный мессенджер для семьи: личные и групповые чаты, фото, управление участниками.

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

## Архитектура: Feature-Sliced Design (FSD)

```
src/
├── pages/                # Страницы-роуты
│   ├── Index.tsx         # Главная: навбар + переключение вкладок
│   └── NotFound.tsx
│
├── widgets/              # Составные блоки UI, независимые от фич
│   └── BottomNav/
│       └── ui/BottomNav.tsx   # Нижняя навигация (5 вкладок)
│
├── features/             # Фичи — основная бизнес-логика
│   ├── auth/
│   │   └── ui/
│   │       ├── LoginScreen.tsx         # Экран входа
│   │       ├── AdminPanel.tsx          # Управление участниками (только admin)
│   │       ├── ChangePasswordModal.tsx # Модалка смены пароля
│   │       └── ChangeAvatarModal.tsx   # Модалка смены аватара
│   ├── chat/
│   │   └── ui/
│   │       ├── ChatsScreen.tsx         # Список чатов с поиском
│   │       ├── ChatView.tsx            # Экран переписки + отправка фото
│   │       ├── ChatMessageBubble.tsx   # Один пузырёк сообщения
│   │       └── NewChatModal.tsx        # Создание личного/группового чата
│   ├── family/
│   │   └── ui/FamilyScreen.tsx         # Список участников семьи
│   ├── gallery/
│   │   └── ui/GalleryScreen.tsx        # Галерея (заглушка)
│   ├── files/
│   │   └── ui/FilesScreen.tsx          # Файлы (заглушка)
│   └── profile/
│       └── ui/ProfileScreen.tsx        # Профиль, настройки, смена пароля/аватара
│
├── shared/               # Переиспользуемый код без привязки к фичам
│   ├── api/
│   │   └── index.ts      # ВСЕ запросы к бэкенду (auth + messages)
│   ├── lib/
│   │   ├── AuthContext.tsx  # React Context: текущий пользователь + logout
│   │   └── utils.ts         # cn() — хелпер для Tailwind классов
│   └── ui/
│       ├── icon.tsx      # Реэкспорт компонента Icon
│       ├── toaster.tsx
│       ├── sonner.tsx
│       └── tooltip.tsx
│
└── components/ui/        # shadcn/ui примитивы — не редактировать вручную
```

> **Правило импортов:** фичи импортируют только из `shared/`. Фичи не импортируют друг друга напрямую.

---

## Бэкенд

```
backend/
├── auth/
│   ├── index.py          # Все действия с пользователями
│   ├── requirements.txt
│   └── tests.json
└── messages/
    ├── index.py          # Чаты, сообщения, фото
    ├── requirements.txt
    └── tests.json
```

URL функций прописаны константами в `src/shared/api/index.ts` (`AUTH_URL`, `MSG_URL`).

### Действия auth (поле `action` в теле запроса)

| action | HTTP | описание |
|---|---|---|
| `login` | POST | Вход, возвращает токен |
| `me` | GET | Проверка сессии |
| `logout` | POST | Выход |
| `create_user` | POST | Создать участника (только admin) |
| `list_users` | GET | Список участников (только admin) |
| `delete_user` | POST | Удалить участника (только admin) |
| `change_password` | POST | Смена пароля |
| `update_avatar` | POST | Смена аватара (эмодзи или фото) |
| `update_badge` | POST | Установить/изменить бейджик участнику (только admin) |

### Действия messages

| action | HTTP | описание |
|---|---|---|
| `list_chats` | GET | Список чатов текущего пользователя |
| `get_messages` | GET | Сообщения чата (`chatId`, опционально `since`) |
| `send_message` | POST | Отправить текстовое сообщение |
| `send_photo` | POST | Загрузить фото и отправить в чат |
| `create_direct` | POST | Создать личный чат |
| `create_chat` | POST | Создать групповой чат |
| `get_users` | GET | Список других участников (включает `badgeText`, `badgeColor`) |
| `search_users` | GET | Поиск участников по имени / @username (включает `badgeText`, `badgeColor`) |

---

## База данных

Схема: `t_p3482084_react_native_family_`

Миграции: `db_migrations/V{N}__{name}.sql` — применяются через `migrate_db`, **вручную не редактировать**.

| Таблица | Назначение |
|---|---|
| `users` | Участники: логин, хеш пароля, роль, аватар, бейджик (`badge_text`, `badge_color`) |
| `sessions` | Активные сессии (токен + срок действия 30 дней) |
| `chats` | Чаты (личные и групповые) |
| `chat_members` | Участники чатов |
| `messages` | Сообщения (текст + опциональный `image_url`) |

---

## Где делать изменения

### Поменять цвета приложения
→ `tailwind.config.ts` и/или `src/index.css`

### Добавить новый экран / вкладку
1. Создать `src/features/{name}/ui/{Name}Screen.tsx`
2. Добавить вкладку в `src/widgets/BottomNav/ui/BottomNav.tsx`
3. Подключить в `src/pages/Index.tsx`

### Добавить новый API-метод
1. Добавить `action` в `backend/{function}/index.py`
2. Добавить функцию в `src/shared/api/index.ts`
3. Задеплоить бэкенд (`sync_backend`)

### Изменить профиль / аватар / пароль
→ `src/features/profile/ui/ProfileScreen.tsx`
→ `src/features/auth/ui/ChangePasswordModal.tsx`
→ `src/features/auth/ui/ChangeAvatarModal.tsx`

### Управление участниками
→ `src/features/auth/ui/AdminPanel.tsx` (только роль `admin`)

Бейджик участника (текст + цвет) редактируется через иконку 🏷️ рядом с каждым участником.
Кнопка открывает модалку с полем текста, палитрой из 8 цветов и предпросмотром.
Бейджик отображается в `FamilyScreen` у всех участников и в `AdminPanel` в списке.

### Чаты и сообщения
→ `src/features/chat/ui/ChatsScreen.tsx` — список
→ `src/features/chat/ui/ChatView.tsx` — переписка, фото
→ `src/features/chat/ui/ChatMessageBubble.tsx` — внешний вид пузырька
→ `src/features/chat/ui/NewChatModal.tsx` — создание чата

---

## Деплой

Проект хостится на **poehali.dev**.

### Фронтенд
Билд запускается автоматически при сохранении. Статус — кнопка **«Опубликовать»**.

Подключить домен: **Опубликовать → Привязать свой домен** (SSL автоматически).

### Бэкенд
После изменений в `backend/` — вызвать `sync_backend`. Деплоятся только изменённые функции.

### Миграции БД
1. Написать SQL
2. Вызвать `migrate_db`
3. Проверить через `get_db_info`

### Скачать код
- **Скачать → Скачать код** — исходники
- **Скачать → Скачать билд** — HTML+JS+CSS
- **Скачать → Подключить GitHub** — синхронизация в репозиторий

---

## Секреты (только для бэкенда)

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | Строка подключения к PostgreSQL |
| `AWS_ACCESS_KEY_ID` | Ключ S3-хранилища |
| `AWS_SECRET_ACCESS_KEY` | Секрет S3-хранилища |

CDN-путь: `https://cdn.poehali.dev/projects/{AWS_ACCESS_KEY_ID}/bucket/{key}`