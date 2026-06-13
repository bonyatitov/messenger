"""Авторизация пользователей семейного мессенджера"""
import json
import os
import hashlib
import secrets
import base64
import boto3
import psycopg2
from datetime import datetime, timedelta

SCHEMA = "t_p3482084_react_native_family_"
SESSION_DURATION_DAYS = 30

def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def hash_password(password: str) -> str:
    salt = hashlib.sha256(b"familychat_salt_2024").hexdigest()[:16]
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()

def check_password(password: str, stored_hash: str) -> bool:
    if stored_hash == hash_password(password):
        return True
    direct_hash = hashlib.sha256(password.encode()).hexdigest()
    if stored_hash.endswith(direct_hash):
        return True
    return False

def cors():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Authorization, X-Session-Id",
    }

def get_user_by_session(cur, token):
    cur.execute(f"""
        SELECT u.id, u.username, u.display_name, u.role, u.avatar, u.bio, u.city, u.age, u.badge_text, u.badge_color
        FROM {SCHEMA}.sessions s
        JOIN {SCHEMA}.users u ON u.id = s.user_id
        WHERE s.token = %s AND s.expires_at > NOW()
    """, (token,))
    return cur.fetchone()

def user_dict(row):
    return {
        "id": row[0], "username": row[1], "displayName": row[2],
        "role": row[3], "avatar": row[4] or "👤",
        "bio": row[5] or "", "city": row[6] or "", "age": row[7],
        "badgeText": row[8] or "", "badgeColor": row[9] or ""
    }

def handler(event: dict, context) -> dict:
    """Авторизация: вход, выход, проверка сессии, управление пользователями (action-based)"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors(), "body": ""}

    method = event.get("httpMethod", "GET")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    headers = event.get("headers", {}) or {}
    session_token = headers.get("X-Session-Id") or (event.get("queryStringParameters") or {}).get("session")
    action = body.get("action", "") or (event.get("queryStringParameters") or {}).get("action", "")

    # login
    if method == "POST" and action == "login":
        username = body.get("username", "").strip().lower()
        password = body.get("password", "")
        if not username or not password:
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Укажите логин и пароль"})}

        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            f"SELECT id, username, display_name, role, avatar, bio, city, age, password_hash FROM {SCHEMA}.users WHERE LOWER(username) = %s",
            (username,)
        )
        row = cur.fetchone()
        if not row or not check_password(password, row[8]):
            conn.close()
            return {"statusCode": 401, "headers": cors(), "body": json.dumps({"error": "Неверный логин или пароль"})}

        user_id = row[0]
        token = secrets.token_hex(32)
        expires = datetime.utcnow() + timedelta(days=SESSION_DURATION_DAYS)
        cur.execute(
            f"INSERT INTO {SCHEMA}.sessions (user_id, token, expires_at) VALUES (%s, %s, %s)",
            (user_id, token, expires)
        )
        cur.execute(f"UPDATE {SCHEMA}.users SET last_seen = NOW() WHERE id = %s", (user_id,))
        conn.commit()
        conn.close()
        return {
            "statusCode": 200,
            "headers": cors(),
            "body": json.dumps({
                "token": token,
                "user": {"id": row[0], "username": row[1], "displayName": row[2], "role": row[3],
                         "avatar": row[4] or "👤", "bio": row[5] or "", "city": row[6] or "", "age": row[7]}
            })
        }

    # me — проверка сессии
    if method == "GET" and action == "me":
        if not session_token:
            return {"statusCode": 401, "headers": cors(), "body": json.dumps({"error": "Не авторизован"})}
        conn = get_db()
        cur = conn.cursor()
        row = get_user_by_session(cur, session_token)
        if not row:
            conn.close()
            return {"statusCode": 401, "headers": cors(), "body": json.dumps({"error": "Сессия истекла"})}
        cur.execute(f"UPDATE {SCHEMA}.users SET last_seen = NOW() WHERE id = %s", (row[0],))
        conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"user": user_dict(row)})}

    # logout
    if method == "POST" and action == "logout":
        if session_token:
            conn = get_db()
            cur = conn.cursor()
            try:
                cur.execute(f"DELETE FROM {SCHEMA}.sessions WHERE token = %s", (session_token,))
                conn.commit()
            except Exception:
                conn.rollback()
            conn.close()
        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True})}

    # create_user — только admin
    if method == "POST" and action == "create_user":
        if not session_token:
            return {"statusCode": 401, "headers": cors(), "body": json.dumps({"error": "Не авторизован"})}
        conn = get_db()
        cur = conn.cursor()
        caller = get_user_by_session(cur, session_token)
        if not caller or caller[3] != "admin":
            conn.close()
            return {"statusCode": 403, "headers": cors(), "body": json.dumps({"error": "Нет доступа"})}

        username = body.get("username", "").strip().lower()
        display_name = body.get("displayName", "").strip()
        password = body.get("password", "").strip()
        role = body.get("role", "member")
        avatar = body.get("avatar", "👤")
        bio = body.get("bio", "")
        city = body.get("city", "")
        age = body.get("age")

        if not username or not display_name or not password:
            conn.close()
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Заполните все поля"})}

        try:
            cur.execute(
                f"INSERT INTO {SCHEMA}.users (username, display_name, password_hash, role, avatar, bio, city, age) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
                (username, display_name, hash_password(password), role, avatar, bio, city, age)
            )
            new_id = cur.fetchone()[0]
            conn.commit()
            conn.close()
            return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True, "id": new_id})}
        except Exception as e:
            conn.rollback()
            conn.close()
            if "unique" in str(e).lower():
                return {"statusCode": 409, "headers": cors(), "body": json.dumps({"error": "Такой логин уже существует"})}
            raise

    # list_users — только admin
    if method == "GET" and action == "list_users":
        if not session_token:
            return {"statusCode": 401, "headers": cors(), "body": json.dumps({"error": "Не авторизован"})}
        conn = get_db()
        cur = conn.cursor()
        caller = get_user_by_session(cur, session_token)
        if not caller or caller[3] != "admin":
            conn.close()
            return {"statusCode": 403, "headers": cors(), "body": json.dumps({"error": "Нет доступа"})}
        cur.execute(f"SELECT id, username, display_name, role, avatar, city, age, created_at, badge_text, badge_color FROM {SCHEMA}.users ORDER BY id")
        rows = cur.fetchall()
        conn.close()
        users = [
            {"id": r[0], "username": r[1], "displayName": r[2], "role": r[3],
             "avatar": r[4] or "👤", "city": r[5] or "", "age": r[6], "createdAt": str(r[7]),
             "badgeText": r[8] or "", "badgeColor": r[9] or ""}
            for r in rows
        ]
        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"users": users})}

    # delete_user — только admin
    if method == "POST" and action == "delete_user":
        if not session_token:
            return {"statusCode": 401, "headers": cors(), "body": json.dumps({"error": "Не авторизован"})}
        target_id = body.get("userId")
        if not target_id:
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Не указан userId"})}
        conn = get_db()
        cur = conn.cursor()
        caller = get_user_by_session(cur, session_token)
        if not caller or caller[3] != "admin":
            conn.close()
            return {"statusCode": 403, "headers": cors(), "body": json.dumps({"error": "Нет доступа"})}
        if caller[0] == target_id:
            conn.close()
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Нельзя удалить себя"})}
        cur.execute(f"DELETE FROM {SCHEMA}.sessions WHERE user_id = %s", (target_id,))
        cur.execute(f"DELETE FROM {SCHEMA}.messages WHERE user_id = %s", (target_id,))
        cur.execute(f"DELETE FROM {SCHEMA}.chat_members WHERE user_id = %s", (target_id,))
        cur.execute(f"DELETE FROM {SCHEMA}.users WHERE id = %s", (target_id,))
        conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True})}

    # change_password
    if method == "POST" and action == "change_password":
        if not session_token:
            return {"statusCode": 401, "headers": cors(), "body": json.dumps({"error": "Не авторизован"})}
        old_password = body.get("oldPassword", "")
        new_password = body.get("newPassword", "").strip()
        if not old_password or not new_password:
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Укажите старый и новый пароль"})}
        if len(new_password) < 4:
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Пароль должен быть не короче 4 символов"})}
        conn = get_db()
        cur = conn.cursor()
        caller = get_user_by_session(cur, session_token)
        if not caller:
            conn.close()
            return {"statusCode": 401, "headers": cors(), "body": json.dumps({"error": "Сессия истекла"})}
        cur.execute(f"SELECT password_hash FROM {SCHEMA}.users WHERE id = %s", (caller[0],))
        row = cur.fetchone()
        if not row or not check_password(old_password, row[0]):
            conn.close()
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Неверный текущий пароль"})}
        cur.execute(f"UPDATE {SCHEMA}.users SET password_hash = %s WHERE id = %s", (hash_password(new_password), caller[0]))
        conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True})}

    # update_avatar
    if method == "POST" and action == "update_avatar":
        if not session_token:
            return {"statusCode": 401, "headers": cors(), "body": json.dumps({"error": "Не авторизован"})}
        conn = get_db()
        cur = conn.cursor()
        caller = get_user_by_session(cur, session_token)
        if not caller:
            conn.close()
            return {"statusCode": 401, "headers": cors(), "body": json.dumps({"error": "Сессия истекла"})}

        emoji = body.get("emoji")
        image_b64 = body.get("imageBase64")
        image_type = body.get("imageType", "image/jpeg")

        if emoji:
            cur.execute(f"UPDATE {SCHEMA}.users SET avatar = %s WHERE id = %s", (emoji, caller[0]))
            conn.commit()
            conn.close()
            return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True, "avatar": emoji})}

        if image_b64:
            image_data = base64.b64decode(image_b64)
            ext = "jpg" if "jpeg" in image_type else image_type.split("/")[-1]
            key = f"avatars/user_{caller[0]}_{secrets.token_hex(6)}.{ext}"
            s3 = boto3.client(
                "s3",
                endpoint_url="https://bucket.poehali.dev",
                aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
                aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
            )
            s3.put_object(Bucket="files", Key=key, Body=image_data, ContentType=image_type)
            avatar_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
            cur.execute(f"UPDATE {SCHEMA}.users SET avatar = %s WHERE id = %s", (avatar_url, caller[0]))
            conn.commit()
            conn.close()
            return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True, "avatar": avatar_url})}

        conn.close()
        return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Нет данных для обновления"})}

    # update_badge — только admin
    if method == "POST" and action == "update_badge":
        if not session_token:
            return {"statusCode": 401, "headers": cors(), "body": json.dumps({"error": "Не авторизован"})}
        conn = get_db()
        cur = conn.cursor()
        caller = get_user_by_session(cur, session_token)
        if not caller or caller[3] != "admin":
            conn.close()
            return {"statusCode": 403, "headers": cors(), "body": json.dumps({"error": "Нет доступа"})}
        target_id = int(body.get("userId", 0))
        badge_text = (body.get("badgeText") or "").strip()[:32]
        badge_color = (body.get("badgeColor") or "").strip()[:32]
        if not target_id:
            conn.close()
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "userId required"})}
        cur.execute(
            f"UPDATE {SCHEMA}.users SET badge_text = %s, badge_color = %s WHERE id = %s",
            (badge_text or None, badge_color or None, target_id)
        )
        conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True})}

    return {"statusCode": 404, "headers": cors(), "body": json.dumps({"error": "Unknown action"})}
