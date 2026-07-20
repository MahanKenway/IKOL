"""Abstract platform interface for messaging services."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class User:
    """Universal user representation."""
    id: int
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    language_code: str | None = None


@dataclass
class Chat:
    """Universal chat representation."""
    id: int
    type: str = "private"  # private, group, supergroup, channel
    title: str | None = None


@dataclass
class Message:
    """Universal message representation."""
    message_id: int
    from_user: User | None = None
    chat: Chat | None = None
    text: str | None = None
    date: int = 0
    reply_to_message: Message | None = None
    caption: str | None = None
    document: Any = None
    photo: Any = None
    audio: Any = None
    video: Any = None
    voice: Any = None
    callback_query: Any = None
    platform_data: dict[str, Any] = field(default_factory=dict)


@dataclass
class CallbackQuery:
    """Universal callback query representation."""
    id: str
    from_user: User | None = None
    message: Message | None = None
    data: str | None = None


@dataclass
class Update:
    """Universal update representation."""
    update_id: int
    message: Message | None = None
    callback_query: CallbackQuery | None = None
    platform_data: dict[str, Any] = field(default_factory=dict)


@dataclass
class KeyboardButton:
    """Universal inline keyboard button."""
    text: str
    url: str | None = None
    callback_data: str | None = None


@dataclass
class InlineKeyboard:
    """Universal inline keyboard."""
    buttons: list[list[KeyboardButton]] = field(default_factory=list)


class Platform(ABC):
    """Abstract base class for messaging platforms."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Platform name (e.g., 'telegram', 'bale')."""
        ...

    @abstractmethod
    async def send_message(
        self,
        chat_id: int,
        text: str,
        reply_markup: InlineKeyboard | None = None,
        parse_mode: str | None = None,
    ) -> Message:
        """Send a text message."""
        ...

    @abstractmethod
    async def edit_message(
        self,
        chat_id: int,
        message_id: int,
        text: str,
        reply_markup: InlineKeyboard | None = None,
        parse_mode: str | None = None,
    ) -> Message:
        """Edit an existing message."""
        ...

    @abstractmethod
    async def answer_callback(self, callback_query_id: str, text: str | None = None) -> bool:
        """Answer a callback query."""
        ...

    @abstractmethod
    async def send_photo(
        self,
        chat_id: int,
        photo: str,
        caption: str | None = None,
        parse_mode: str | None = None,
    ) -> Message:
        """Send a photo."""
        ...

    @abstractmethod
    async def send_document(
        self,
        chat_id: int,
        document: str,
        caption: str | None = None,
    ) -> Message:
        """Send a document/file."""
        ...

    @abstractmethod
    async def get_me(self) -> dict[str, Any]:
        """Get bot information."""
        ...

    @abstractmethod
    async def get_updates(self, offset: int | None = None, timeout: int = 30) -> list[Update]:
        """Get updates via long polling."""
        ...

    @abstractmethod
    def parse_update(self, raw_data: dict[str, Any]) -> Update:
        """Parse raw platform update into universal Update."""
        ...

    def build_keyboard(self, buttons: list[list[tuple[str, str]]]) -> InlineKeyboard:
        """Build inline keyboard from simple format.

        Args:
            buttons: List of rows, each row is list of (text, callback_data) tuples.

        Example:
            buttons = [
                [("Button 1", "btn1"), ("Button 2", "btn2")],
                [("Button 3", "btn3")],
            ]
        """
        keyboard = InlineKeyboard()
        for row in buttons:
            keyboard_row = []
            for text, callback_data in row:
                keyboard_row.append(KeyboardButton(text=text, callback_data=callback_data))
            keyboard.buttons.append(keyboard_row)
        return keyboard
