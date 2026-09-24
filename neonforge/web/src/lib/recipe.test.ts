import { describe, expect, it } from "vitest";
import { appliesTo, buildRecipe, cleanStep, newStep, QUICK_ACTIONS, resolutionAllowed, summarize } from "./recipe";

describe("recipe helpers", () => {
  it("newStep copies defaults so edits don't leak between steps", () => {
    const a = newStep("enhance");
    const b = newStep("enhance");
    a.params.strength = 5;
    expect(b.params.strength).toBe(70);
  });

  it("cleanStep drops unknown and null params the API would reject", () => {
    const s = cleanStep({ op: "background", params: { mode: "remove", image_file_id: null, bogus: 1 } });
    expect(s.params).toEqual({ mode: "remove" });
  });

  it("buildRecipe keeps order and output", () => {
    const r = buildRecipe([newStep("hdr"), newStep("upscale")], { image_format: "png" });
    expect(r.steps.map((s) => s.op)).toEqual(["hdr", "upscale"]);
    expect(r.output).toEqual({ image_format: "png" });
  });

  it("stabilize only applies to moving media", () => {
    expect(appliesTo("stabilize", "image")).toBe(false);
    expect(appliesTo("stabilize", "video")).toBe(true);
    expect(appliesTo("enhance", "gif")).toBe(true);
  });

  it("plan resolution caps", () => {
    expect(resolutionAllowed("4k", "fhd")).toBe(false);
    expect(resolutionAllowed("hd", "fhd")).toBe(true);
    expect(resolutionAllowed("original", "sd")).toBe(true);
  });

  it("quick actions seed the exact step", () => {
    expect(QUICK_ACTIONS.remove_bg.step.params.mode).toBe("remove");
    expect(QUICK_ACTIONS.upscale4.step.params.scale).toBe(4);
    expect(summarize(QUICK_ACTIONS.upscale4.step)).toBe("Upscale 4x");
  });
});
