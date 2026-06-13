"""Push-уведомления для мессенджера Семейка — подписка и отправка"""
import json
import os
import psycopg2
from pywebpush import webpush, WebPushException

SCHEMA = "t_p3482084_react_native_family_"

# Кэшируем константы — вычисляются один раз при старте контейнера
_CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Id",
}
_VAPID_PUBLIC_KEY = None   # будет прочитан при первом вызове
_VAPID_PRIVATE_KEY = None
_VAPID_EMAIL = "mailto:support@semejka.app"

def cors():
    return _CORS

def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def get_vapid_keys():
    global _VAPID_PUBLIC_KEY, _VAPID_PRIVATE_KEY
    if _VAPID_PRIVATE_KEY is None:
        _VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
        _VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
    return _VAPID_PUBLIC_KEY, _VAPID_PRIVATE_KEY

def get_caller(cur, event):
    headers = event.get("headers") or {}
    token = headers.get("X-Session-Id") or headers.get("x-session-id")
    if not token:
        return None
    cur.execute(f"""
        SELECT u.id FROM {SCHEMA}.sessions s
        JOIN {SCHEMA}.users u ON u.id = s.user_id
        WHERE s.token = %s AND s.expires_at > NOW()
    """, (token,))
    row = cur.fetchone()
    return row[0] if row else None

def handler(event: dict, context) -> dict:
    """Управление push-подписками и отправка уведомлений"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": _CORS, "body": ""}

    body = {}
    raw = event.get("body")
    if raw:
        try:
            body = json.loads(raw)
        except Exception:
            body = {}

    action = body.get("action") or (event.get("queryStringParameters") or {}).get("action")

    # Получить публичный VAPID ключ (без авторизации)
    if action == "get_vapid_public_key":
        pub, _ = get_vapid_keys()
        return {"statusCode": 200, "headers": _CORS, "body": json.dumps({"publicKey": pub})}

    conn = get_db()
    cur = conn.cursor()
    caller_id = get_caller(cur, event)

    if not caller_id:
        conn.close()
        return {"statusCode": 401, "headers": _CORS, "body": json.dumps({"error": "Не авторизован"})}

    # Сохранить подписку
    if action == "subscribe":
        endpoint = body.get("endpoint")
        p256dh = body.get("p256dh")
        auth = body.get("auth")
        if not endpoint or not p256dh or not auth:
            conn.close()
            return {"statusCode": 400, "headers": _CORS, "body": json.dumps({"error": "Нет данных подписки"})}
        cur.execute(f"""
            INSERT INTO {SCHEMA}.push_subscriptions (user_id, endpoint, p256dh, auth)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
        """, (caller_id, endpoint, p256dh, auth))
        conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": _CORS, "body": json.dumps({"ok": True})}

    # Удалить подписку при выходе из аккаунта
    if action == "unsubscribe":
        endpoint = body.get("endpoint")
        if endpoint:
            cur.execute(
                f"DELETE FROM {SCHEMA}.push_subscriptions WHERE user_id = %s AND endpoint = %s",
                (caller_id, endpoint)
            )
            conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": _CORS, "body": json.dumps({"ok": True})}

    # Отправить push всем участникам чата (кроме отправителя)
    if action == "send_push":
        chat_id = body.get("chatId")
        title = body.get("title", "Семейка")
        message = body.get("message", "Новое сообщение")

        if not chat_id:
            conn.close()
            return {"statusCode": 400, "headers": _CORS, "body": json.dumps({"error": "Нет chatId"})}

        cur.execute(f"""
            SELECT ps.endpoint, ps.p256dh, ps.auth
            FROM {SCHEMA}.push_subscriptions ps
            JOIN {SCHEMA}.chat_members cm ON cm.user_id = ps.user_id
            WHERE cm.chat_id = %s AND ps.user_id != %s
        """, (chat_id, caller_id))
        rows = cur.fetchall()
        conn.close()

        if not rows:
            return {"statusCode": 200, "headers": _CORS, "body": json.dumps({"sent": 0, "failed": 0})}

        _, vapid_private = get_vapid_keys()
        payload = json.dumps({"title": title, "body": message, "chatId": chat_id})
        vapid_claims = {"sub": _VAPID_EMAIL}
        sent = 0
        failed = 0

        for endpoint, p256dh, auth_key in rows:
            try:
                webpush(
                    subscription_info={"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth_key}},
                    data=payload,
                    vapid_private_key=vapid_private,
                    vapid_claims=vapid_claims,
                )
                sent += 1
            except WebPushException:
                failed += 1

        return {"statusCode": 200, "headers": _CORS, "body": json.dumps({"sent": sent, "failed": failed})}

    conn.close()
    return {"statusCode": 400, "headers": _CORS, "body": json.dumps({"error": "Неизвестное действие"})}
