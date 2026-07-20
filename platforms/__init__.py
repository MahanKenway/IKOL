"""IKOL Multi-Platform Support - Telegram and Bale Messenger."""

from .base import Platform, Message, Update, User, Chat
from .telegram import TelegramPlatform
from .bale import BalePlatform
from .core import BotCore

__all__ = [
    "Platform",
    "Message",
    "Update",
    "User",
    "Chat",
    "TelegramPlatform",
    "BalePlatform",
    "BotCore",
]
