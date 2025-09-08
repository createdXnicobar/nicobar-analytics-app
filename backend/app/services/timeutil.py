# app/services/timeutil.py
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

def to_utc(dt: datetime) -> datetime:
    """Coerce any datetime to UTC. If naive, assume it's IST and attach IST tz first."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST)
    return dt.astimezone(timezone.utc)

def ist_day_bounds(date_str: str) -> tuple[datetime, datetime]:
    """
    For a local calendar date like '2025-08-13' (IST), return UTC start/end datetimes that
    bound that IST day.
    """
    day_ist = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=IST)
    start_ist = day_ist
    end_ist = day_ist + timedelta(days=1)
    return start_ist.astimezone(timezone.utc), end_ist.astimezone(timezone.utc)

def to_ist_string(dt_utc: datetime) -> str:
    """Format a UTC datetime as 'YYYY-MM-DD HH:MM:SS' in IST, for responses/logs."""
    return dt_utc.astimezone(IST).strftime("%Y-%m-%d %H:%M:%S")

def day_bounds_utc(d: datetime):
    d_utc = d.astimezone(timezone.utc)
    start = datetime(d_utc.year, d_utc.month, d_utc.day, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    return start, end
