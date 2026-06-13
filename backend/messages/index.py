"""Чаты и сообщения семейного мессенджера Семейка"""
import json
import os
import base64
import secrets
import boto3
import psycopg2
from datetime import datetime, timezone, timedelta

MSK = timezone(timedelta(hours=3))

def to_msk(dt):
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc).astimezone(MSK)

SCHEMA = "t_p3482084_react_native_family_"

def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def cors():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Session-Id",
    }

def format_online(last_seen):
    """Возвращает 'online' если был < 3 мин назад, иначе строку 'был(а) N назад'"""
    if not last_seen:
        return None
    now = datetime.utcnow()
    delta = now - last_seen.replace(tzinfo=None)
    seconds = int(delta.total_seconds())
    if seconds < 180:
        return "online"
    if seconds < 3600:
        m = seconds // 60
        return f"был(а) {m} мин назад"
    if seconds < 86400:
        h = seconds // 3600
        return f"был(а) {h} ч назад"
    if delta.days == 1:
        return "был(а) вчера"
    if delta.days < 7:
        return f"был(а) {delta.days} дн назад"
    return f"был(а) {last_seen.strftime('%d.%m')}"

def format_time(last_at):
    if not last_at:
        return ""
    now = datetime.utcnow()
    delta = now - last_at.replace(tzinfo=None)
    if delta.days == 0:
        return last_at.strftime("%H:%M")
    if delta.days == 1:
        return "Вчера"
    if delta.days < 7:
        return ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"][last_at.weekday()]
    return last_at.strftime("%d.%m")

def get_user_by_session(cur, token):
    cur.execute(f"""
        SELECT u.id, u.username, u.display_name, u.role, u.avatar
        FROM {SCHEMA}.sessions s
        JOIN {SCHEMA}.users u ON u.id = s.user_id
        WHERE s.token = %s AND s.expires_at > NOW()
    """, (token,))
    return cur.fetchone()

def handler(event: dict, context) -> dict:
    """Управление чатами и сообщениями: list_chats, get_messages, send_message, create_chat, create_direct"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors(), "body": ""}

    method = event.get("httpMethod", "GET")
    body = {}
    if event.get("body"):
        try:
            raw = json.loads(event["body"])
            body = json.loads(raw) if isinstance(raw, str) else raw
        except Exception:
            pass

    headers = event.get("headers", {}) or {}
    token = headers.get("X-Session-Id") or (event.get("queryStringParameters") or {}).get("session")
    action = body.get("action") or (event.get("queryStringParameters") or {}).get("action", "")

    if not token:
        return {"statusCode": 401, "headers": cors(), "body": json.dumps({"error": "Не авторизован"})}

    conn = get_db()
    cur = conn.cursor()
    caller = get_user_by_session(cur, token)
    if not caller:
        conn.close()
        return {"statusCode": 401, "headers": cors(), "body": json.dumps({"error": "Сессия истекла"})}

    caller_id = caller[0]

    # list_chats — список чатов пользователя
    if action == "list_chats":
        # Обновляем last_seen только при открытии чатов (не на каждый запрос)
        cur.execute(f"UPDATE {SCHEMA}.users SET last_seen = NOW() WHERE id = %s", (caller_id,))

        cur.execute(f"""
            SELECT
                c.id, c.name, c.is_group, c.avatar,
                m.text AS last_text,
                mu.display_name AS last_author,
                m.created_at AS last_at,
                (
                    SELECT COUNT(*) FROM {SCHEMA}.messages m2
                    WHERE m2.chat_id = c.id
                    AND m2.user_id != %s
                    AND m2.created_at > COALESCE(
                        (SELECT MAX(m3.created_at) FROM {SCHEMA}.messages m3
                         WHERE m3.chat_id = c.id AND m3.user_id = %s), '2000-01-01'
                    )
                ) AS unread,
                ou.display_name AS other_name,
                ou.avatar AS other_avatar,
                ou.last_seen AS other_last_seen
            FROM {SCHEMA}.chats c
            JOIN {SCHEMA}.chat_members cm ON cm.chat_id = c.id AND cm.user_id = %s
            LEFT JOIN LATERAL (
                SELECT text, user_id, created_at FROM {SCHEMA}.messages
                WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1
            ) m ON TRUE
            LEFT JOIN {SCHEMA}.users mu ON mu.id = m.user_id
            LEFT JOIN LATERAL (
                SELECT u.display_name, u.avatar, u.last_seen
                FROM {SCHEMA}.chat_members cm2
                JOIN {SCHEMA}.users u ON u.id = cm2.user_id
                WHERE cm2.chat_id = c.id AND cm2.user_id != %s AND c.is_group = FALSE
                LIMIT 1
            ) ou ON TRUE
            ORDER BY COALESCE(m.created_at, c.created_at) DESC
        """, (caller_id, caller_id, caller_id, caller_id))
        rows = cur.fetchall()
        conn.commit()
        conn.close()

        chats = []
        for row in rows:
            chat_id, name, is_group, avatar, last_text, last_author, last_at, unread, \
                other_name, other_avatar, other_last_seen = row

            if not is_group and other_name:
                display_name = other_name
                display_avatar = other_avatar or "👤"
                online_status = format_online(other_last_seen)
            else:
                display_name = name
                display_avatar = avatar
                online_status = None

            chats.append({
                "id": chat_id,
                "name": display_name,
                "avatar": display_avatar,
                "isGroup": is_group,
                "lastText": last_text or "",
                "lastAuthor": last_author or "",
                "lastAt": format_time(last_at),
                "unread": int(unread or 0),
                "onlineStatus": online_status,
            })

        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"chats": chats})}

    # get_messages — сообщения чата
    if action == "get_messages":
        chat_id = body.get("chatId") or (event.get("queryStringParameters") or {}).get("chatId")
        if not chat_id:
            conn.close()
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Нет chatId"})}

        cur.execute(f"SELECT 1 FROM {SCHEMA}.chat_members WHERE chat_id = %s AND user_id = %s", (chat_id, caller_id))
        if not cur.fetchone():
            conn.close()
            return {"statusCode": 403, "headers": cors(), "body": json.dumps({"error": "Нет доступа к чату"})}

        since = body.get("since") or (event.get("queryStringParameters") or {}).get("since")
        if since:
            cur.execute(f"""
                SELECT m.id, m.text, m.image_url, m.created_at, u.id, u.display_name, u.avatar,
                       m.reply_to_id, ru.display_name, rm.text, rm.image_url
                FROM {SCHEMA}.messages m
                JOIN {SCHEMA}.users u ON u.id = m.user_id
                LEFT JOIN {SCHEMA}.messages rm ON rm.id = m.reply_to_id
                LEFT JOIN {SCHEMA}.users ru ON ru.id = rm.user_id
                WHERE m.chat_id = %s AND m.id > %s
                ORDER BY m.created_at ASC
            """, (chat_id, int(since)))
        else:
            cur.execute(f"""
                SELECT m.id, m.text, m.image_url, m.created_at, u.id, u.display_name, u.avatar,
                       m.reply_to_id, ru.display_name, rm.text, rm.image_url
                FROM {SCHEMA}.messages m
                JOIN {SCHEMA}.users u ON u.id = m.user_id
                LEFT JOIN {SCHEMA}.messages rm ON rm.id = m.reply_to_id
                LEFT JOIN {SCHEMA}.users ru ON ru.id = rm.user_id
                WHERE m.chat_id = %s
                ORDER BY m.created_at ASC
                LIMIT 100
            """, (chat_id,))

        rows = cur.fetchall()
        conn.close()
        messages = [{
            "id": r[0],
            "text": r[1],
            "imageUrl": r[2],
            "time": to_msk(r[3]).strftime("%H:%M") if r[3] else "",
            "date": to_msk(r[3]).strftime("%Y-%m-%d") if r[3] else "",
            "userId": r[4],
            "displayName": r[5],
            "avatar": r[6] or "👤",
            "isMe": r[4] == caller_id,
            "replyTo": {"id": r[7], "authorName": r[8] or "?", "text": r[9] or "", "imageUrl": r[10]} if r[7] else None,
        } for r in rows]
        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"messages": messages})}

    # send_message
    if action == "send_message":
        chat_id = body.get("chatId")
        text = (body.get("text") or "").strip()
        if not chat_id or not text:
            conn.close()
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Нет chatId или текста"})}

        cur.execute(f"SELECT 1 FROM {SCHEMA}.chat_members WHERE chat_id = %s AND user_id = %s", (chat_id, caller_id))
        if not cur.fetchone():
            conn.close()
            return {"statusCode": 403, "headers": cors(), "body": json.dumps({"error": "Нет доступа к чату"})}

        reply_to_id = body.get("replyToId") or None
        if reply_to_id:
            reply_to_id = int(reply_to_id)

        cur.execute(
            f"INSERT INTO {SCHEMA}.messages (chat_id, user_id, text, reply_to_id) VALUES (%s, %s, %s, %s) RETURNING id, created_at",
            (chat_id, caller_id, text, reply_to_id)
        )
        msg_id, created_at = cur.fetchone()

        reply_to_data = None
        if reply_to_id:
            cur.execute(f"""
                SELECT rm.text, rm.image_url, u.display_name FROM {SCHEMA}.messages rm
                JOIN {SCHEMA}.users u ON u.id = rm.user_id WHERE rm.id = %s
            """, (reply_to_id,))
            rr = cur.fetchone()
            if rr:
                reply_to_data = {"id": reply_to_id, "authorName": rr[2], "text": rr[0] or "", "imageUrl": rr[1]}

        conn.commit()
        conn.close()
        msk_dt = to_msk(created_at)
        return {
            "statusCode": 200,
            "headers": cors(),
            "body": json.dumps({
                "message": {
                    "id": msg_id,
                    "text": text,
                    "imageUrl": None,
                    "time": msk_dt.strftime("%H:%M"),
                    "date": msk_dt.strftime("%Y-%m-%d"),
                    "userId": caller_id,
                    "displayName": caller[2],
                    "avatar": caller[4] or "👤",
                    "isMe": True,
                    "replyTo": reply_to_data,
                }
            })
        }

    # send_photo
    if action == "send_photo":
        chat_id = body.get("chatId")
        image_b64 = body.get("imageBase64")
        image_type = body.get("imageType", "image/jpeg")
        caption = (body.get("caption") or "").strip()

        if not chat_id or not image_b64:
            conn.close()
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Нет chatId или фото"})}

        cur.execute(f"SELECT 1 FROM {SCHEMA}.chat_members WHERE chat_id = %s AND user_id = %s", (chat_id, caller_id))
        if not cur.fetchone():
            conn.close()
            return {"statusCode": 403, "headers": cors(), "body": json.dumps({"error": "Нет доступа к чату"})}

        image_data = base64.b64decode(image_b64)
        ext = "jpg" if "jpeg" in image_type else image_type.split("/")[-1]
        key = f"chat_photos/chat_{chat_id}_{secrets.token_hex(8)}.{ext}"

        s3 = boto3.client(
            "s3",
            endpoint_url="https://bucket.poehali.dev",
            aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
        )
        s3.put_object(Bucket="files", Key=key, Body=image_data, ContentType=image_type)
        image_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

        text = caption or "📷 Фото"
        reply_to_id = body.get("replyToId") or None
        if reply_to_id:
            reply_to_id = int(reply_to_id)

        cur.execute(
            f"INSERT INTO {SCHEMA}.messages (chat_id, user_id, text, image_url, reply_to_id) VALUES (%s, %s, %s, %s, %s) RETURNING id, created_at",
            (chat_id, caller_id, text, image_url, reply_to_id)
        )
        msg_id, created_at = cur.fetchone()

        reply_to_data = None
        if reply_to_id:
            cur.execute(f"""
                SELECT rm.text, rm.image_url, u.display_name FROM {SCHEMA}.messages rm
                JOIN {SCHEMA}.users u ON u.id = rm.user_id WHERE rm.id = %s
            """, (reply_to_id,))
            rr = cur.fetchone()
            if rr:
                reply_to_data = {"id": reply_to_id, "authorName": rr[2], "text": rr[0] or "", "imageUrl": rr[1]}

        conn.commit()
        conn.close()
        msk_dt = to_msk(created_at)
        return {
            "statusCode": 200,
            "headers": cors(),
            "body": json.dumps({
                "message": {
                    "id": msg_id,
                    "text": text,
                    "imageUrl": image_url,
                    "time": msk_dt.strftime("%H:%M"),
                    "date": msk_dt.strftime("%Y-%m-%d"),
                    "userId": caller_id,
                    "displayName": caller[2],
                    "avatar": caller[4] or "👤",
                    "isMe": True,
                    "replyTo": reply_to_data,
                }
            })
        }

    # create_chat — создать групповой чат
    if action == "create_chat":
        name = (body.get("name") or "").strip()
        avatar = body.get("avatar", "💬")
        member_ids = body.get("memberIds", [])
        if not name:
            conn.close()
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Нет названия чата"})}

        cur.execute(
            f"INSERT INTO {SCHEMA}.chats (name, is_group, avatar, created_by) VALUES (%s, TRUE, %s, %s) RETURNING id",
            (name, avatar, caller_id)
        )
        chat_id = cur.fetchone()[0]
        all_members = list(set([caller_id] + [int(m) for m in member_ids]))
        for uid in all_members:
            cur.execute(f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (chat_id, uid))
        conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True, "chatId": chat_id})}

    # create_direct — создать личный чат
    if action == "create_direct":
        target_id = body.get("targetUserId")
        if not target_id:
            conn.close()
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Нет targetUserId"})}

        cur.execute(f"""
            SELECT c.id FROM {SCHEMA}.chats c
            JOIN {SCHEMA}.chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = %s
            JOIN {SCHEMA}.chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = %s
            WHERE c.is_group = FALSE
            LIMIT 1
        """, (caller_id, int(target_id)))
        existing = cur.fetchone()
        if existing:
            conn.close()
            return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True, "chatId": existing[0]})}

        cur.execute(
            f"INSERT INTO {SCHEMA}.chats (name, is_group, avatar, created_by) VALUES (%s, FALSE, %s, %s) RETURNING id",
            ("", "💬", caller_id)
        )
        chat_id = cur.fetchone()[0]
        cur.execute(f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id) VALUES (%s, %s)", (chat_id, caller_id))
        cur.execute(f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id) VALUES (%s, %s)", (chat_id, int(target_id)))
        conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True, "chatId": chat_id})}

    # delete_chat
    if action == "delete_chat":
        chat_id = body.get("chatId")
        if not chat_id:
            conn.close()
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Нет chatId"})}

        cur.execute(f"SELECT 1 FROM {SCHEMA}.chat_members WHERE chat_id = %s AND user_id = %s", (int(chat_id), caller_id))
        if not cur.fetchone():
            conn.close()
            return {"statusCode": 403, "headers": cors(), "body": json.dumps({"error": "Нет доступа к чату"})}

        cur.execute(f"DELETE FROM {SCHEMA}.messages WHERE chat_id = %s", (int(chat_id),))
        cur.execute(f"DELETE FROM {SCHEMA}.chat_members WHERE chat_id = %s", (int(chat_id),))
        cur.execute(f"DELETE FROM {SCHEMA}.chats WHERE id = %s", (int(chat_id),))
        conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True})}

    # get_users — роль берём из caller, лишний SELECT убран
    if action == "get_users":
        is_admin = caller[3] == "admin"

        if is_admin:
            cur.execute(f"""
                SELECT u.id, u.display_name, u.avatar, u.city, u.last_seen, u.role,
                    EXISTS(SELECT 1 FROM {SCHEMA}.family_members fm WHERE fm.user_id = %s AND fm.member_id = u.id) as in_family,
                    u.badge_text, u.badge_color
                FROM {SCHEMA}.users u WHERE u.id != %s ORDER BY u.display_name
            """, (caller_id, caller_id))
        else:
            cur.execute(f"""
                SELECT u.id, u.display_name, u.avatar, u.city, u.last_seen, u.role, true as in_family,
                    u.badge_text, u.badge_color
                FROM {SCHEMA}.users u
                JOIN {SCHEMA}.family_members fm ON fm.member_id = u.id AND fm.user_id = %s
                WHERE u.id != %s ORDER BY u.display_name
            """, (caller_id, caller_id))

        rows = cur.fetchall()
        conn.close()
        users = [{
            "id": r[0], "displayName": r[1], "avatar": r[2] or "👤",
            "city": r[3] or "", "onlineStatus": format_online(r[4]),
            "role": r[5] or "member", "inFamily": r[6],
            "badgeText": r[7] or "", "badgeColor": r[8] or ""
        } for r in rows]
        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"users": users, "isAdmin": is_admin})}

    # search_users
    if action == "search_users":
        query = (body.get("query") or (event.get("queryStringParameters") or {}).get("query") or "").strip().lower()
        if len(query) < 2:
            conn.close()
            return {"statusCode": 200, "headers": cors(), "body": json.dumps({"users": []})}
        cur.execute(f"""
            SELECT u.id, u.display_name, u.avatar, u.city, u.last_seen, u.role,
                EXISTS(SELECT 1 FROM {SCHEMA}.family_members fm WHERE fm.user_id = %s AND fm.member_id = u.id) as in_family,
                u.badge_text, u.badge_color
            FROM {SCHEMA}.users u
            WHERE u.id != %s AND (LOWER(u.display_name) LIKE %s OR LOWER(u.username) LIKE %s)
            ORDER BY u.display_name LIMIT 20
        """, (caller_id, caller_id, f"%{query}%", f"%{query}%"))
        rows = cur.fetchall()
        conn.close()
        users = [{
            "id": r[0], "displayName": r[1], "avatar": r[2] or "👤",
            "city": r[3] or "", "onlineStatus": format_online(r[4]),
            "role": r[5] or "member", "inFamily": r[6],
            "badgeText": r[7] or "", "badgeColor": r[8] or ""
        } for r in rows]
        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"users": users})}

    # add_family
    if action == "add_family":
        member_id = int(body.get("memberId", 0))
        if not member_id:
            conn.close()
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "memberId required"})}
        cur.execute(f"""
            INSERT INTO {SCHEMA}.family_members (user_id, member_id)
            VALUES (%s, %s) ON CONFLICT DO NOTHING
        """, (caller_id, member_id))
        conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True})}

    # remove_family
    if action == "remove_family":
        member_id = int(body.get("memberId", 0))
        if not member_id:
            conn.close()
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "memberId required"})}
        cur.execute(f"DELETE FROM {SCHEMA}.family_members WHERE user_id = %s AND member_id = %s", (caller_id, member_id))
        conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True})}

    # get_chat_members — участники группового чата
    if action == "get_chat_members":
        chat_id = int(body.get("chatId") or (event.get("queryStringParameters") or {}).get("chatId") or 0)
        if not chat_id:
            conn.close()
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Нет chatId"})}
        cur.execute(f"SELECT 1 FROM {SCHEMA}.chat_members WHERE chat_id = %s AND user_id = %s", (chat_id, caller_id))
        if not cur.fetchone():
            conn.close()
            return {"statusCode": 403, "headers": cors(), "body": json.dumps({"error": "Нет доступа"})}
        cur.execute(f"""
            SELECT u.id, u.display_name, u.avatar, u.last_seen
            FROM {SCHEMA}.users u
            JOIN {SCHEMA}.chat_members cm ON cm.user_id = u.id
            WHERE cm.chat_id = %s
            ORDER BY u.display_name
        """, (chat_id,))
        rows = cur.fetchall()
        cur.execute(f"SELECT created_by FROM {SCHEMA}.chats WHERE id = %s", (chat_id,))
        chat_row = cur.fetchone()
        creator_id = chat_row[0] if chat_row else None
        conn.close()
        members = [{"id": r[0], "displayName": r[1], "avatar": r[2] or "👤", "onlineStatus": format_online(r[3]), "isCreator": r[0] == creator_id} for r in rows]
        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"members": members, "creatorId": creator_id, "callerId": caller_id})}

    # add_chat_member — добавить участника в групповой чат
    if action == "add_chat_member":
        chat_id = int(body.get("chatId") or 0)
        user_id = int(body.get("userId") or 0)
        if not chat_id or not user_id:
            conn.close()
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Нет chatId или userId"})}
        cur.execute(f"SELECT is_group, created_by FROM {SCHEMA}.chats WHERE id = %s", (chat_id,))
        chat_row = cur.fetchone()
        if not chat_row or not chat_row[0]:
            conn.close()
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Чат не найден или не групповой"})}
        cur.execute(f"SELECT 1 FROM {SCHEMA}.chat_members WHERE chat_id = %s AND user_id = %s", (chat_id, caller_id))
        if not cur.fetchone():
            conn.close()
            return {"statusCode": 403, "headers": cors(), "body": json.dumps({"error": "Нет доступа"})}
        cur.execute(f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (chat_id, user_id))
        conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True})}

    # remove_chat_member — удалить участника из группового чата
    if action == "remove_chat_member":
        chat_id = int(body.get("chatId") or 0)
        user_id = int(body.get("userId") or 0)
        if not chat_id or not user_id:
            conn.close()
            return {"statusCode": 400, "headers": cors(), "body": json.dumps({"error": "Нет chatId или userId"})}
        cur.execute(f"SELECT created_by FROM {SCHEMA}.chats WHERE id = %s", (chat_id,))
        chat_row = cur.fetchone()
        creator_id = chat_row[0] if chat_row else None
        # Удалять может создатель чата или сам себя
        if caller_id != creator_id and caller_id != user_id:
            conn.close()
            return {"statusCode": 403, "headers": cors(), "body": json.dumps({"error": "Только создатель может удалять участников"})}
        cur.execute(f"DELETE FROM {SCHEMA}.chat_members WHERE chat_id = %s AND user_id = %s", (chat_id, user_id))
        conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": cors(), "body": json.dumps({"ok": True})}

    conn.close()
    return {"statusCode": 404, "headers": cors(), "body": json.dumps({"error": "Unknown action"})}