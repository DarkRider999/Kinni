from __future__ import annotations

import time
from typing import Annotated

import jwt
from fastapi import Depends, Header, Query
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import User, get_db
from ..errors import ApiError

DB = Annotated[Session, Depends(get_db)]


def issue_token(user_id: str) -> str:
    s = get_settings()
    now = int(time.time())
    return jwt.encode({"sub": user_id, "iat": now, "exp": now + s.jwt_ttl_minutes * 60}, s.jwt_secret,
                      algorithm="HS256")


def user_from_token(db: Session, token: str) -> User:
    try:
        claims = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as e:
        raise ApiError(401, "UNAUTHORIZED", "invalid or expired token") from e
    user = db.get(User, claims.get("sub"))
    if user is None or user.status != "active":
        raise ApiError(401, "UNAUTHORIZED", "account not active")
    return user


def current_user(db: DB, authorization: Annotated[str | None, Header()] = None,
                 token: Annotated[str | None, Query(include_in_schema=False)] = None) -> User:
    raw = token
    if authorization and authorization.lower().startswith("bearer "):
        raw = authorization[7:]
    if not raw:
        raise ApiError(401, "UNAUTHORIZED", "missing bearer token")
    return user_from_token(db, raw)


CurrentUser = Annotated[User, Depends(current_user)]
