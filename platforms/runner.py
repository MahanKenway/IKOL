"""Multi-platform runner - runs Telegram and/or Bale bots simultaneously."""

from __future__ import annotations

import asyncio
import os
import sys
from typing import Any

from .base import Platform
from .telegram import TelegramPlatform
from .bale import BalePlatform
from .core import BotCore


class MultiPlatformRunner:
    """Runs multiple messaging platforms concurrently."""

    def __init__(self):
        self.platforms: list[Platform] = []
        self.core = BotCore()
        self._running = False

    def setup_platforms(self) -> list[str]:
        """Setup available platforms based on environment variables.

        Returns list of platform names that were configured.
        """
        configured = []

        # Telegram
        telegram_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
        if telegram_token:
            self.platforms.append(TelegramPlatform(telegram_token))
            configured.append("Telegram")
        else:
            print("[runner] Telegram: No token found (set TELEGRAM_BOT_TOKEN)")

        # Bale
        bale_token = os.getenv("BALE_BOT_TOKEN", "").strip()
        if bale_token:
            self.platforms.append(BalePlatform(bale_token))
            configured.append("Bale")
        else:
            print("[runner] Bale: No token found (set BALE_BOT_TOKEN)")

        if not configured:
            print("[runner] WARNING: No platforms configured!")
            print("[runner] Set TELEGRAM_BOT_TOKEN and/or BALE_BOT_TOKEN in .env")

        return configured

    async def _run_platform(self, platform: Platform) -> None:
        """Run polling loop for a single platform."""
        print(f"[{platform.name}] Starting polling...")

        try:
            bot_info = await platform.get_me()
            bot_name = bot_info.get("username", bot_info.get("first_name", "unknown"))
            print(f"[{platform.name}] Bot connected: @{bot_name}")
        except Exception as exc:
            print(f"[{platform.name}] Failed to connect: {exc}")
            return

        offset = None
        while self._running:
            try:
                updates = await platform.get_updates(offset=offset, timeout=30)
                for update in updates:
                    offset = update.update_id + 1
                    try:
                        await self.core.handle_update(platform, update)
                    except Exception as exc:
                        print(f"[{platform.name}] Error handling update: {exc}")
            except asyncio.CancelledError:
                break
            except Exception as exc:
                print(f"[{platform.name}] Polling error: {exc}")
                await asyncio.sleep(5)

        print(f"[{platform.name}] Stopped")

    async def run_all(self) -> None:
        """Run all configured platforms concurrently."""
        self._running = True

        if not self.platforms:
            print("[runner] No platforms to run!")
            return

        print(f"\n[runner] Starting {len(self.platforms)} platform(s)...")
        tasks = [self._run_platform(p) for p in self.platforms]

        try:
            await asyncio.gather(*tasks)
        except asyncio.CancelledError:
            pass
        finally:
            self._running = False

    def stop(self) -> None:
        """Stop all platforms."""
        self._running = False


def main():
    """Entry point for multi-platform runner."""
    print("=" * 50)
    print("IKOL Multi-Platform Bot Runner")
    print("=" * 50)

    runner = MultiPlatformRunner()
    configured = runner.setup_platforms()

    if configured:
        print(f"\n[runner] Configured platforms: {', '.join(configured)}")
    else:
        print("\n[runner] No platforms configured. Exiting.")
        sys.exit(1)

    try:
        asyncio.run(runner.run_all())
    except KeyboardInterrupt:
        print("\n[runner] Shutting down...")
        runner.stop()


if __name__ == "__main__":
    main()
