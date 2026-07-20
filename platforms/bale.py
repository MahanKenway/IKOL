"""Bale Messenger platform adapter using the Bale Bot API.

Bale is an Iranian messaging platform with a Bot API nearly identical to Telegram.
The main differences are:
- Different base URL: https://tapi.bale.ai
- E-wallet payment integration
- A few unique methods (inquireTransaction, askReview)
"""

from __future__ import annotations

import json
from typing import Any
from urllib import request
from urllib.error import HTTPError, URLError

from .base import (
    Platform, Message, Update, User, Chat, CallbackQuery,
    InlineKeyboard, KeyboardButton,
)


class BalePlatform(Platform):
    """Bale Messenger Bot API implementation.

    Bale's API is compatible with Telegram Bot API, with a different base URL.
    """

    API_BASE = "https://tapi.bale.ai"

    def __init__(self, token: str):
        self.token = token
        self.base_url = f"{self.API_BASE}/bot{token}"

    @property
    def name(self) -> str:
        return "bale"

    def _request(self, method: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
        """Make API request to Bale."""
        url = f"{self.base_url}/{method}"

        if data is not None:
            payload = json.dumps(data).encode("utf-8")
            req = request.Request(
                url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
        else:
            req = request.Request(url)

        try:
            with request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                if not result.get("ok"):
                    raise RuntimeError(f"Bale API error: {result.get('description', 'Unknown')}")
                return result.get("result", {})
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Bale HTTP {exc.code}: {body}") from exc
        except URLError as exc:
            raise RuntimeError(f"Bale connection error: {exc}") from exc

    async def send_message(
        self,
        chat_id: int,
        text: str,
        reply_markup: InlineKeyboard | None = None,
        parse_mode: str | None = None,
    ) -> Message:
        data: dict[str, Any] = {"chat_id": chat_id, "text": text}
        if parse_mode:
            data["parse_mode"] = parse_mode
        if reply_markup:
            data["reply_markup"] = self._serialize_keyboard(reply_markup)
        result = self._request("sendMessage", data)
        return self._parse_message(result)

    async def edit_message(
        self,
        chat_id: int,
        message_id: int,
        text: str,
        reply_markup: InlineKeyboard | None = None,
        parse_mode: str | None = None,
    ) -> Message:
        data: dict[str, Any] = {
            "chat_id": chat_id,
            "message_id": message_id,
            "text": text,
        }
        if parse_mode:
            data["parse_mode"] = parse_mode
        if reply_markup:
            data["reply_markup"] = self._serialize_keyboard(reply_markup)
        result = self._request("editMessageText", data)
        return self._parse_message(result)

    async def answer_callback(self, callback_query_id: str, text: str | None = None) -> bool:
        data: dict[str, Any] = {"callback_query_id": callback_query_id}
        if text:
            data["text"] = text
        self._request("answerCallbackQuery", data)
        return True

    async def send_photo(
        self,
        chat_id: int,
        photo: str,
        caption: str | None = None,
        parse_mode: str | None = None,
    ) -> Message:
        data: dict[str, Any] = {"chat_id": chat_id, "photo": photo}
        if caption:
            data["caption"] = caption
        if parse_mode:
            data["parse_mode"] = parse_mode
        result = self._request("sendPhoto", data)
        return self._parse_message(result)

    async def send_document(
        self,
        chat_id: int,
        document: str,
        caption: str | None = None,
    ) -> Message:
        data: dict[str, Any] = {"chat_id": chat_id, "document": document}
        if caption:
            data["caption"] = caption
        result = self._request("sendDocument", data)
        return self._parse_message(result)

    async def get_me(self) -> dict[str, Any]:
        return self._request("getMe")

    async def get_updates(self, offset: int | None = None, timeout: int = 30) -> list[Update]:
        params: dict[str, Any] = {"timeout": timeout}
        if offset is not None:
            params["offset"] = offset
        result = self._request("getUpdates", params)
        return [self.parse_update(update) for update in result]

    def parse_update(self, raw_data: dict[str, Any]) -> Update:
        """Parse raw Bale update into universal Update.

        Bale updates have the same format as Telegram updates.
        """
        update = Update(
            update_id=raw_data.get("update_id", 0),
            platform_data=raw_data,
        )

        if "message" in raw_data:
            update.message = self._parse_message(raw_data["message"])

        if "callback_query" in raw_data:
            cq = raw_data["callback_query"]
            update.callback_query = CallbackQuery(
                id=cq.get("id", ""),
                from_user=self._parse_user(cq.get("from")),
                message=self._parse_message(cq.get("message")) if "message" in cq else None,
                data=cq.get("data"),
            )

        return update

    def _parse_message(self, data: dict[str, Any]) -> Message:
        return Message(
            message_id=data.get("message_id", 0),
            from_user=self._parse_user(data.get("from")),
            chat=self._parse_chat(data.get("chat")),
            text=data.get("text"),
            date=data.get("date", 0),
            reply_to_message=self._parse_message(data["reply_to_message"]) if "reply_to_message" in data else None,
            caption=data.get("caption"),
            platform_data=data,
        )

    def _parse_user(self, data: dict[str, Any] | None) -> User | None:
        if not data:
            return None
        return User(
            id=data.get("id", 0),
            username=data.get("username"),
            first_name=data.get("first_name"),
            last_name=data.get("last_name"),
            language_code=data.get("language_code"),
        )

    def _parse_chat(self, data: dict[str, Any] | None) -> Chat | None:
        if not data:
            return None
        return Chat(
            id=data.get("id", 0),
            type=data.get("type", "private"),
            title=data.get("title"),
        )

    def _serialize_keyboard(self, keyboard: InlineKeyboard) -> dict[str, Any]:
        rows = []
        for row in keyboard.buttons:
            row_buttons = []
            for btn in row:
                button: dict[str, str] = {"text": btn.text}
                if btn.url:
                    button["url"] = btn.url
                if btn.callback_data:
                    button["callback_data"] = btn.callback_data
                row_buttons.append(button)
            rows.append(row_buttons)
        return {"inline_keyboard": rows}
