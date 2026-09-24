import pytest
from pydantic import ValidationError

from neonforge.recipes import RecipeBody, estimate_credits


def test_defaults_are_filled_and_validated():
    r = RecipeBody.model_validate({"steps": [{"op": "enhance"}, {"op": "upscale", "params": {"scale": 4}}]})
    assert r.steps[0].params["strength"] == 70
    assert r.steps[1].params == {"scale": 4, "model": "auto"}
    assert r.output.image_format == "jpg"


@pytest.mark.parametrize("step", [
    {"op": "nope"},
    {"op": "upscale", "params": {"scale": 3}},
    {"op": "enhance", "params": {"strength": 101}},
    {"op": "enhance", "params": {"bogus": 1}},
    {"op": "background", "params": {}},
])
def test_invalid_steps_rejected(step):
    with pytest.raises(ValidationError):
        RecipeBody.model_validate({"steps": [step]})


@pytest.mark.parametrize("op", ["face_swap", "outfit_swap", "expression", "bg_generate"])
def test_planned_generative_ops_are_not_available(op):
    with pytest.raises(ValidationError, match="later milestone"):
        RecipeBody.model_validate({"steps": [{"op": op}]})


def test_branches_and_stabilize_only_for_video():
    r = RecipeBody.model_validate({
        "steps": [{"op": "enhance"}, {"op": "stabilize"}],
        "branches": {"video": [{"op": "color_grade"}]},
    })
    assert [s.op for s in r.steps_for("image")] == ["enhance"]
    assert [s.op for s in r.steps_for("video")] == ["enhance", "stabilize", "color_grade"]


def test_credit_estimates_follow_spec_table():
    r = RecipeBody.model_validate({"steps": [{"op": "enhance"}, {"op": "upscale", "params": {"scale": 4}}]})
    assert estimate_credits(r, "image", None) == 1 + 2
    # video: per started 10 s → 25 s is 3 units; enhance 5/unit + upscale4x 15/unit
    assert estimate_credits(r, "video", 25_000) == (5 + 15) * 3
    empty = RecipeBody.model_validate({"steps": [{"op": "color_grade"}]})
    assert estimate_credits(empty, "image", None) == 1  # minimum charge
