"""Credit ledger (spec §8.4, §11). The balance is the sum of immutable ledger rows.

Lifecycle: ``grant`` (monthly/plan) → ``reserve`` (negative, at job creation) → on failure or cancel
a ``refund`` row returns the reservation. A successful job keeps its reservation as the spend.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .db import CreditLedger, User
from .errors import ApiError


def balance(db: Session, user_id: str) -> int:
    return int(db.scalar(select(func.coalesce(func.sum(CreditLedger.delta), 0)).where(
        CreditLedger.user_id == user_id)) or 0)


def grant(db: Session, user: User, amount: int, note: str) -> None:
    db.add(CreditLedger(user_id=user.id, delta=amount, kind="grant", note=note))


def reserve(db: Session, user_id: str, amount: int, *, job_id: str | None = None,
            batch_id: str | None = None) -> None:
    if amount <= 0:
        return
    have = balance(db, user_id)
    if have < amount:
        raise ApiError(402, "INSUFFICIENT_CREDITS", f"this edit needs {amount} credits, you have {have}",
                       {"required": amount, "balance": have})
    db.add(CreditLedger(user_id=user_id, delta=-amount, kind="reserve", job_id=job_id, batch_id=batch_id))


def refund(db: Session, user_id: str, amount: int, *, job_id: str | None = None, batch_id: str | None = None,
           note: str | None = None) -> None:
    if amount <= 0:
        return
    db.add(CreditLedger(user_id=user_id, delta=amount, kind="refund", job_id=job_id, batch_id=batch_id,
                        note=note))
