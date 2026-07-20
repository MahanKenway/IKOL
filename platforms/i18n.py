"""Internationalization and Persian language support for IKOL."""

from __future__ import annotations

import re
from datetime import datetime, timezone, timedelta


# Persian digits mapping
PERSIAN_DIGITS = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")
ENGLISH_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")

# Jalali month names
JALALI_MONTHS = [
    "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
]

JALALI_MONTHS_EN = [
    "Farvardin", "Ordibehesht", "Khordad", "Tir", "Mordad", "Shahrivar",
    "Mehr", "Aban", "Azar", "Dey", "Bahman", "Esfand"
]

# Jalali month days (non-leap year)
JALALI_MONTH_DAYS = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29]

# Persian translations
TRANSLATIONS = {
    "en": {
        "welcome": "Hello {name}! I'm IKOL (Intelligent Knowledge & Operations Layer).",
        "help_title": "IKOL Commands",
        "help_start": "/start - Welcome message",
        "help_help": "/help - Show help",
        "help_run": "/run <goal> - Run agent on a goal",
        "help_status": "/status - Show current status",
        "help_skills": "/skills - List installed skills",
        "help_memory": "/memory - View agent memory",
        "help_clear": "/clear - Clear memory",
        "help_lang": "/lang - Change language",
        "help_time": "/time - Show current time",
        "help_date": "/date - Show current date",
        "help_calc": "/calc <expression> - Calculator",
        "help_translate": "/translate <text> - Translate text",
        "help_poetry": "/poetry - Get a Persian poem",
        "help_quote": "/quote - Get an inspirational quote",
        "status_title": "IKOL Status",
        "status_platform": "Platform",
        "status_memory": "Memory entries",
        "status_skills": "Installed skills",
        "status_provider": "Provider",
        "status_uptime": "Uptime",
        "error_unknown": "Unknown command: /{command}\nUse /help to see available commands.",
        "error_no_goal": "Usage: /run <goal>\n\nExample: /run Create a Python script to count words",
        "running": "Running agent on: {goal}\n\nThis may take a moment...",
        "result": "Result:\n\n{result}",
        "error": "Error: {error}",
        "memory_empty": "Memory is empty.",
        "memory_title": "Memory ({total} total, showing last 5):",
        "memory_cleared": "Memory cleared.",
        "skills_none": "No skills installed yet.",
        "skills_title": "Installed Skills:",
        "language_changed": "Language changed to English.",
        "current_time": "Current time: {time}",
        "current_date": "Current date: {date}",
        "calculator_result": "Result: {result}",
        "translate_result": "Translation:\n\n{original}\n\n→ {translated}",
        "poetry_title": "Persian Poetry",
        "quote_title": "Inspirational Quote",
    },
    "fa": {
        "welcome": "سلام {name}! من IKOL هستم (لایه دانش و عملیات هوشمند).",
        "help_title": "دستورات IKOL",
        "help_start": "/start - پیام خوش‌آمدگویی",
        "help_help": "/help - نمایش راهنما",
        "help_run": "/run <هدف> - اجرای عامل روی یک هدف",
        "help_status": "/status - نمایش وضعیت",
        "help_skills": "/skills - لیست مهارت‌های نصب شده",
        "help_memory": "/memory - مشاهده حافظه عامل",
        "help_clear": "/clear - پاک کردن حافظه",
        "help_lang": "/lang - تغییر زبان",
        "help_time": "/time - نمایش زمان فعلی",
        "help_date": "/date - نمایش تاریخ فعلی",
        "help_calc": "/calc <عبارت> - ماشین حساب",
        "help_translate": "/translate <متن> - ترجمه متن",
        "help_poetry": "/poetry - دریافت یک شعر فارسی",
        "help_quote": "/quote - دریافت یک جمله الهام‌بخش",
        "status_title": "وضعیت IKOL",
        "status_platform": "پلتفرم",
        "status_memory": "تعداد حافظه",
        "status_skills": "مهارت‌های نصب شده",
        "status_provider": "ارائه‌دهنده",
        "status_uptime": "زمان فعالیت",
        "error_unknown": "دستور ناشناخته: /{command}\nاز /help برای مشاهده دستورات موجود استفاده کنید.",
        "error_no_goal": "استفاده: /run <هدف>\n\nمثال: /run یک اسکریپت پایتون برای شمارش کلمات بنویس",
        "running": "در حال اجرای عامل روی: {goal}\n\nلطفاً صبر کنید...",
        "result": "نتیجه:\n\n{result}",
        "error": "خطا: {error}",
        "memory_empty": "حافظه خالی است.",
        "memory_title": "حافظه ({total} مورد، نمایش ۵ مورد اخیر):",
        "memory_cleared": "حافظه پاک شد.",
        "skills_none": "هنوز مهارتی نصب نشده است.",
        "skills_title": "مهارت‌های نصب شده:",
        "language_changed": "زبان به فارسی تغییر کرد.",
        "current_time": "زمان فعلی: {time}",
        "current_date": "تاریخ فعلی: {date}",
        "calculator_result": "نتیجه: {result}",
        "translate_result": "ترجمه:\n\n{original}\n\n→ {translated}",
        "poetry_title": "شعر فارسی",
        "quote_title": "جمله الهام‌بخش",
    },
}


def to_persian_digits(text: str | int | float) -> str:
    """Convert Western Arabic digits to Persian digits."""
    return str(text).translate(PERSIAN_DIGITS)


def to_english_digits(text: str) -> str:
    """Convert Persian digits to Western Arabic digits."""
    return str(text).translate(ENGLISH_DIGITS)


def gregorian_to_jalali(year: int, month: int, day: int) -> tuple[int, int, int]:
    """Convert Gregorian date to Jalali (Solar Hijri) date.

    Uses the standard algorithm for Jalali calendar conversion.
    """
    gy = year
    gm = month
    gd = day

    # Determine if Gregorian year is leap
    g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    if gm > 2:
        gy2 = gy + 1
    else:
        gy2 = gy

    days = 355666 + (365 * gy) + ((gy2 + 3) // 4) - ((gy2 + 99) // 100) + ((gy2 + 399) // 400) + gd + g_d_m[gm - 1]

    jy = -1595 + (33 * (days // 12053))
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
        days = (days - 1) % 365

    if days < 186:
        jm = 1 + (days // 31)
        jd = 1 + (days % 31)
    else:
        jm = 7 + ((days - 186) // 30)
        jd = 1 + ((days - 186) % 30)

    return jy, jm, jd


def jalali_to_gregorian(year: int, month: int, day: int) -> tuple[int, int, int]:
    """Convert Jalali date to Gregorian date."""
    jy = year - 979
    jm = month - 1
    jd = day - 1

    j_day_count = ((jy - 1) * 1029983) // 366206 + (((jy - 1) * 1029983) % 366206) // 366207 + jd

    for i in range(jm):
        j_day_count += JALALI_MONTH_DAYS[i] if i < 12 else 29

    if j_day_count > 2299160:
        a = j_day_count + 10631
        b = a // 10631
        a = a % 10631
        g_day_count = 365 * b + ((b + 3) // 4) - ((b + 99) // 100) + ((b + 399) // 400)
    else:
        g_day_count = 365 * jy + ((jy + 3) // 4) - ((jy + 99) // 100) + ((jy + 399) // 400)

    g_day_count += j_day_count + 1

    gy = 1600 + 400 * (g_day_count // 146097)
    g_day_count %= 146097

    if g_day_count > 36524:
        g_day_count -= 1
        gy += 100 * (g_day_count // 36524)
        g_day_count %= 36524
        if g_day_count >= 365:
            g_day_count += 1

    gd = g_day_count + 1

    g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    gm = 1
    while gm < 13 and gd > g_d_m[gm - 1]:
        gm += 1

    if gm > 1:
        gd -= g_d_m[gm - 2]

    return gy, gm, gd


def format_jalali_date(year: int, month: int, day: int, persian_digits: bool = True) -> str:
    """Format Jalali date as string."""
    month_name = JALALI_MONTHS[month - 1] if 1 <= month <= 12 else "?"
    if persian_digits:
        return f"{to_persian_digits(day)} {month_name} {to_persian_digits(year)}"
    return f"{day} {month_name} {year}"


def format_jalali_datetime(dt: datetime | None = None, persian_digits: bool = True) -> str:
    """Format datetime as Jalali date string."""
    if dt is None:
        dt = datetime.now(timezone(timedelta(hours=3, minutes=30)))

    jy, jm, jd = gregorian_to_jalali(dt.year, dt.month, dt.day)
    return format_jalali_date(jy, jm, jd, persian_digits)


def format_time(dt: datetime | None = None, persian_digits: bool = True) -> str:
    """Format time as string."""
    if dt is None:
        dt = datetime.now(timezone(timedelta(hours=3, minutes=30)))

    time_str = dt.strftime("%H:%M:%S")
    if persian_digits:
        return to_persian_digits(time_str)
    return time_str


def is_jalali_leap_year(year: int) -> bool:
    """Check if a Jalali year is a leap year."""
    remainder = year % 2820
    years = [1, 5, 9, 13, 17, 22, 26, 30, 34, 38, 43, 47, 51, 55, 59, 64, 68, 72, 76, 80, 85, 89, 93, 97, 101, 106, 110, 114, 118, 122, 126, 131, 135, 139, 143, 147, 152, 156, 160, 164, 168, 172, 177, 181, 185, 189, 193, 198, 202, 206, 210, 214, 218, 223, 227, 231, 235, 239, 244, 248, 252, 256, 260, 264, 269, 273, 277, 281, 285, 289, 294, 298, 302, 306, 310, 314, 319, 323, 327, 331, 335, 339, 344, 348, 352, 356, 360, 364, 369, 373, 377, 381, 385, 389, 394, 398, 402, 406, 410, 414, 419, 423, 427, 431, 435, 439, 444, 448, 452, 456, 460, 464, 469, 473, 477, 481, 485, 489, 494, 498, 502, 506, 510, 514, 519, 523, 527, 531, 535, 539, 544, 548, 552, 556, 560, 564, 569, 573, 577, 581, 585, 589, 594, 598, 602, 606, 610, 614, 619, 623, 627, 631, 635, 639, 644, 648, 652, 656, 660, 664, 669, 673, 677, 681, 685, 689, 694, 698, 702, 706, 710, 714, 719, 723, 727, 731, 735, 739, 744, 748, 752, 756, 760, 764, 769, 773, 777, 781, 785, 789, 794, 798, 802, 806, 810, 814, 819, 823, 827, 831, 835, 839, 844, 848, 852, 856, 860, 864, 869, 873, 877, 881, 885, 889, 894, 898, 902, 906, 910, 914, 919, 923, 927, 931, 935, 939, 944, 948, 952, 956, 960, 964, 969, 973, 977, 981, 985, 989, 994, 998, 1002, 1006, 1010, 1014, 1019, 1023, 1027, 1031, 1035, 1039, 1044, 1048, 1052, 1056, 1060, 1064, 1069, 1073, 1077, 1081, 1085, 1089, 1094, 1098, 1102, 1106, 1110, 1114, 1119, 1123, 1127, 1131, 1135, 1139, 1144, 1148, 1152, 1156, 1160, 1164, 1169, 1173, 1177, 1181, 1185, 1189, 1194, 1198, 1202, 1206, 1210, 1214, 1219, 1223, 1227, 1231, 1235, 1239, 1244, 1248, 1252, 1256, 1260, 1264, 1269, 1273, 1277, 1281, 1285, 1289, 1294, 1298, 1302, 1306, 1310, 1314, 1319, 1323, 1327, 1331, 1335, 1339, 1344, 1348, 1352, 1356, 1360, 1364, 1369, 1373, 1377, 1381, 1385, 1389, 1394, 1398, 1402, 1406, 1410, 1414, 1419, 1423, 1427, 1431, 1435, 1439, 1444, 1448, 1452, 1456, 1460, 1464, 1469, 1473, 1477, 1481, 1485, 1489, 1494, 1498, 1502, 1506, 1510, 1514, 1519, 1523, 1527, 1531, 1535, 1539, 1544, 1548, 1552, 1556, 1560, 1564, 1569, 1573, 1577, 1581, 1585, 1589, 1594, 1598, 1602, 1606, 1610, 1614, 1619, 1623, 1627, 1631, 1635, 1639, 1644, 1648, 1652, 1656, 1660, 1664, 1669, 1673, 1677, 1681, 1685, 1689, 1694, 1698, 1702, 1706, 1710, 1714, 1719, 1723, 1727, 1731, 1735, 1739, 1744, 1748, 1752, 1756, 1760, 1764, 1769, 1773, 1777, 1781, 1785, 1789, 1794, 1798, 1802, 1806, 1810, 1814, 1819, 1823, 1827, 1831, 1835, 1839, 1844, 1848, 1852, 1856, 1860, 1864, 1869, 1873, 1877, 1881, 1885, 1889, 1894, 1898, 1902, 1906, 1910, 1914, 1919, 1923, 1927, 1931, 1935, 1939, 1944, 1948, 1952, 1956, 1960, 1964, 1969, 1973, 1977, 1981, 1985, 1989, 1994, 1998, 2002, 2006, 2010, 2014, 2019, 2023, 2027, 2031, 2035, 2039, 2044, 2048, 2052, 2056, 2060, 2064, 2069, 2073, 2077, 2081, 2085, 2089, 2094, 2098, 2102, 2106, 2110, 2114, 2119, 2123, 2127, 2131, 2135, 2139, 2144, 2148, 2152, 2156, 2160, 2164, 2169, 2173, 2177, 2181, 2185, 2189, 2194, 2198, 2202, 2206, 2210, 2214, 2219, 2223, 2227, 2231, 2235, 2239, 2244, 2248, 2252, 2256, 2260, 2264, 2269, 2273, 2277, 2281, 2285, 2289, 2294, 2298, 2302, 2306, 2310, 2314, 2319, 2323, 2327, 2331, 2335, 2339, 2344, 2348, 2352, 2356, 2360, 2364, 2369, 2373, 2377, 2381, 2385, 2389, 2394, 2398, 2402, 2406, 2410, 2414, 2419, 2423, 2427, 2431, 2435, 2439, 2444, 2448, 2452, 2456, 2460, 2464, 2469, 2473, 2477, 2481, 2485, 2489, 2494, 2498, 2502, 2506, 2510, 2514, 2519, 2523, 2527, 2531, 2535, 2539, 2544, 2548, 2552, 2556, 2560, 2564, 2569, 2573, 2577, 2581, 2585, 2589, 2594, 2598, 2602, 2606, 2610, 2614, 2619, 2623, 2627, 2631, 2635, 2639, 2644, 2648, 2652, 2656, 2660, 2664, 2669, 2673, 2677, 2681, 2685, 2689, 2694, 2698, 2702, 2706, 2710, 2714, 2719, 2723, 2727, 2731, 2735, 2739, 2744, 2748, 2752, 2756, 2760, 2764, 2769, 2773, 2777, 2781, 2785, 2789, 2794, 2798, 2802, 2806, 2810, 2814, 2819, 2823]
    return remainder in years


def get_jalali_month_days(year: int, month: int) -> int:
    """Get number of days in a Jalali month."""
    if month < 1 or month > 12:
        return 0
    if month == 12 and is_jalali_leap_year(year):
        return 30
    return JALALI_MONTH_DAYS[month - 1]


# Persian poetry samples
PERSIAN_POETRY = [
    {"poet": "حافظ", "verse": "الا یا ایها الساقی ادر کاسا و ناولها / که عشق آسان نمود اول ولی افتاد مشکلها"},
    {"poet": "سعدی", "verse": "بنی آدم اعضای یکدیگرند / که در آفرینش ز یک گوهرند"},
    {"poet": "مولوی", "verse": "بشنو از نی چون حکایت می‌کند / از جدایی‌ها شکایت می‌کند"},
    {"poet": "فerdowsi", "verse": "سخن عاقل را چو شیر پاک است / که پاکتر از گفت عاقل نیست"},
    {"poet": "خیام", "verse": "یک چند به کودکی به استاد شدیم / تا بود آنچه بودیم آن آموزدیم"},
    {"poet": "حافظ", "verse": "دل می‌رود ز دستم صاحبدلان خدا را / دردا که راز پنهان خواهد شد آشکارا"},
    {"poet": "سعدی", "verse": "گلستان دراز است و دیر آید باغبان / زود باش که سحر از کف بیشه ببرند طویسیان"},
    {"poet": "مولوی", "verse": "ما ز بالاییم و بالا می‌رویم / ما ز دریاییم و دریا می‌رویم"},
]

# Inspirational quotes
PERSIAN_QUOTES = [
    {"text": "هر روزی که نمی‌میری، روزی است که زنده‌ای.", "author": "ناشناس"},
    {"text": "دانش قدرت است.", "author": "فرانسیس بیکن"},
    {"text": "صبر تلخ است ولی ثمرش شیرین است.", "author": "ناشناس"},
    {"text": "کسی که صبر می‌کند، به هر چیزی که بخواهد می‌رسد.", "author": "ناشناس"},
    {"text": "هر آغازی پایانی دارد، اما هر پایانی آغازی است.", "author": "ناشناس"},
    {"text": "زندگی مانند رانندگی در تاریکی است؛ فقط نور چراغ جلو را می‌بینی ولی با همین نور می‌توانی کل مسیر را طی کنی.", "author": "الیور وندل هلمز"},
    {"text": "هر کسی که می‌خواهد دنیا را تغییر دهد، اول باید خودش را تغییر دهد.", "author": "گاندی"},
    {"text": "موفقیت نهایی نیست، شکست کشنده نیست؛ شجاعت ادامه دادن است.", "author": "ونستون چرچیل"},
]


def get_random_poetry() -> dict[str, str]:
    """Get a random Persian poem."""
    import random
    return random.choice(PERSIAN_POETRY)


def get_random_quote() -> dict[str, str]:
    """Get a random inspirational quote."""
    import random
    return random.choice(PERSIAN_QUOTES)


def detect_language(text: str) -> str:
    """Detect if text is primarily Persian or English."""
    persian_chars = len(re.findall(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]', text))
    english_chars = len(re.findall(r'[a-zA-Z]', text))

    if persian_chars > english_chars:
        return "fa"
    return "en"


def get_user_lang(user_data: dict) -> str:
    """Get user's preferred language."""
    return user_data.get("language", "en")
