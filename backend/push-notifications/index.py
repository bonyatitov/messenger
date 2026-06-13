"""Push-уведомления для мессенджера Семейка — подписка и отправка"""
import json
import os
import psycopg2
from pywebpush import webpush, WebPushException

SCHEMA = "t_p3482084_react_native_family_"

def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def cors():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Authorization, X-User-Id, X-Auth-Token, X-Session-Id",
    }

def get_caller(event, conn):
    headers = event.get("headers") or {}
    token = headers.get("X-Auth-Token") or headers.get("x-auth-token")
    user_id = headers.get("X-User-Id") or headers.get("x-user-id")
    if not token or not user_id:
        return None
    cur = conn.cursor()
    cur.execute(
        f"SELECT id FROM {SCHEMA}.users WHERE id = %s AND auth_token = %s",
        (int(user_id), token)
    )
    row = cur.fetchone()
    return row[0] if row else None

def handler(event: dict, context) -> dict:
    """Управление push-подписками и отправка уведомлений"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors(), "body": ""}

    body = {}
    if event.get("body"):
        body = json.loads(event["body"])

    action = body.get("action") or (event.get("queryStringParameters") or {}).get("action")

    # Сгенерировать VAPID ключи (одноразовый вызов)
    if action == "generate_vapid":
        from py_vapid import Vapid
        import base64
        v = Vapid()
        v.generate_keys()
        priv_pem = v.private_pem().decode()
        from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
        pub_bytes = v.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
        pub_b64 = base64.urlsafe_b64encode(pub_bytes).rstrip(b"=").decode()
        return {
            "statusCode": 200,
            "headers": cors(),
            "body": json.dumps({"privateKey": priv_pem, "publicKey": pub_b64})
        }

    # Получить публичный VAPID ключ (открытый, доступен без авторизации)
    if action == "get_vapid_public_key":
        return {
            "statusCode": 200,
            "headers": cors(),
            "body": json.dumps({"publicKey": os.environ.get("VAPID_PUBLIC_KEY", "")})
        }

    conn = get_db()
    caller_id = get_caller(event, conn)
    if not caller_id:
        conn.close()
        return {"statusCode": 401, "headers": cors(), "body": json.dumps({"error": "Не авторизован"})}

    cur = conn.cursor()

    # Сохранить подписку
    if action == "subscribe":
        endpoint = body.get("endpoint")
        p256dh = body.get("p256dh")
        auth = body.get("auth")
        if not endpoint or not p256dh or not auth:
            conn.close()
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Нет данных подписки"})}

        cur.execute(f"""
            INSERT INTO {SCHEMA}.push_subscriptions (user_id, endpoint, p256dh, auth)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
        """, (caller_id, endpoint, p256dh, auth))
        conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True})}

    # Удалить подписку (при выходе)
    if action == "unsubscribe":
        endpoint = body.get("endpoint")
        if endpoint:
            cur.execute(
                f"UPDATE {SCHEMA}.push_subscriptions SET endpoint = endpoint WHERE user_id = %s AND endpoint = %s",
                (caller_id, endpoint)
            )
        conn.close()
        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True})}

    # Отправить push всем получателям сообщения в чате
    if action == "send_push":
        chat_id = body.get("chatId")
        title = body.get("title", "Новое сообщение")
        message = body.get("message", "")
        sender_id = body.get("senderId") or caller_id

        if not chat_id:
            conn.close()
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Нет chatId"})}

        # Получаем подписки всех участников чата, кроме отправителя
        cur.execute(f"""
            SELECT ps.endpoint, ps.p256dh, ps.auth
            FROM {SCHEMA}.push_subscriptions ps
            JOIN {SCHEMA}.chat_members cm ON cm.user_id = ps.user_id
            WHERE cm.chat_id = %s AND ps.user_id != %s
        """, (chat_id, sender_id))

        rows = cur.fetchall()
        conn.close()

        vapid_private = os.environ.get("VAPID_PRIVATE_KEY", "")
        vapid_email = os.environ.get("VAPID_EMAIL", "mailto:app@semejka.app")
        sent = 0
        failed = 0

        payload = json.dumps({"title": title, "body": message, "chatId": chat_id})

        for endpoint, p256dh, auth in rows:
            try:
                webpush(
                    subscription_info={"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}},
                    data=payload,
                    vapid_private_key=vapid_private,
                    vapid_claims={"sub": vapid_email},
                )
                sent += 1
            except WebPushException:
                failed += 1

        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"sent": sent, "failed": failed})}

    conn.close()
    return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Неизвестное действие"})}