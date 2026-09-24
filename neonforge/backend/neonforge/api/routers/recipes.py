from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import or_, select

from ... import credits
from ...db import PresetTemplate, Recipe
from ...errors import not_found
from ...jobs import check_plan, get_owned_file
from ...recipes import PLANNED_OPS, SUPPORTED_OPS, RecipeBody, estimate_credits
from ..deps import DB, CurrentUser

router = APIRouter(tags=["recipes"])


class RecipeIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    body: RecipeBody


def _recipe_dict(r: Recipe) -> dict:
    return {"id": r.id, "name": r.name, "body": r.body, "system": r.user_id is None, "created_at": r.created_at}


@router.get("/ops")
def list_ops() -> dict:
    """Ops this build supports, plus the ones planned for later milestones (for greyed-out UI)."""
    return {"supported": sorted(SUPPORTED_OPS), "planned": sorted(PLANNED_OPS)}


@router.get("/recipes")
def list_recipes(user: CurrentUser, db: DB) -> dict:
    rows = db.scalars(select(Recipe).where(or_(Recipe.user_id == user.id, Recipe.user_id.is_(None)))
                      .order_by(Recipe.created_at.desc())).all()
    return {"items": [_recipe_dict(r) for r in rows]}


@router.post("/recipes", status_code=201)
def create_recipe(body: RecipeIn, user: CurrentUser, db: DB) -> dict:
    r = Recipe(user_id=user.id, name=body.name, body=body.body.model_dump(mode="json"))
    db.add(r)
    db.commit()
    return _recipe_dict(r)


@router.put("/recipes/{recipe_id}")
def update_recipe(recipe_id: str, body: RecipeIn, user: CurrentUser, db: DB) -> dict:
    r = db.get(Recipe, recipe_id)
    if r is None or r.user_id != user.id:
        raise not_found("recipe")
    r.name, r.body = body.name, body.body.model_dump(mode="json")
    db.commit()
    return _recipe_dict(r)


@router.delete("/recipes/{recipe_id}", status_code=204)
def delete_recipe(recipe_id: str, user: CurrentUser, db: DB) -> None:
    r = db.get(Recipe, recipe_id)
    if r is None or r.user_id != user.id:
        raise not_found("recipe")
    db.delete(r)
    db.commit()


class EstimateIn(BaseModel):
    recipe: RecipeBody
    file_ids: list[str] = Field(..., min_length=1, max_length=1000)


@router.post("/recipes/estimate")
def estimate(body: EstimateIn, user: CurrentUser, db: DB) -> dict:
    check_plan(body.recipe, user.plan)
    per_file = []
    for fid in body.file_ids:
        f = get_owned_file(db, user.id, fid)
        per_file.append({"file_id": f.id, "kind": f.kind,
                         "credits": estimate_credits(body.recipe, f.kind, f.duration_ms)})
    total = sum(p["credits"] for p in per_file)
    bal = credits.balance(db, user.id)
    return {"total_credits": total, "balance": bal, "affordable": bal >= total, "files": per_file}


@router.get("/presets")
def presets(db: DB, category: Literal["lut", "background", "outfit", "expression"] | None = None) -> dict:
    q = select(PresetTemplate)
    if category:
        q = q.where(PresetTemplate.category == category)
    rows = db.scalars(q.order_by(PresetTemplate.category, PresetTemplate.sort_order)).all()
    return {"items": [{"id": p.id, "category": p.category, "subcategory": p.subcategory, "name": p.name,
                       "payload": p.payload, "tier": p.tier} for p in rows]}
