import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const SAMPLES = process.env.E2E_SAMPLES_DIR ?? path.resolve("e2e/fixtures");
const SHOTS = process.env.E2E_SCREENSHOTS_DIR;

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${test.info().project.name}-${name}.png`) });
}

async function signIn(page: Page, plan = "pro") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(`e2e-${plan}-${Date.now()}@example.com`);
  await page.getByRole("radio", { name: plan[0].toUpperCase() + plan.slice(1) }).click();
  await shot(page, "01-login");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("single-edit")).toBeVisible();
}

test("single edit: upload, live preview, retouch, background, export", async ({ page }) => {
  await signIn(page);
  await shot(page, "02-home-empty");
  await page.getByTestId("single-edit").click();
  await page.getByTestId("file-input").setInputFiles(path.join(SAMPLES, "lena.jpg"));
  await expect(page.getByRole("heading", { name: "lena.jpg" })).toBeVisible();

  await page.getByTestId("add-enhance").click();
  await expect(page.getByTestId("preview-image")).toBeVisible();
  await shot(page, "03-editor-enhance");

  await page.getByRole("tab", { name: "Face", exact: true }).click();
  await page.getByTestId("add-face_retouch").click();
  await page.getByRole("tab", { name: "Background" }).click();
  await page.getByTestId("add-background").click();
  await expect(page.getByTestId("preview-status")).toBeVisible();
  await expect(page.getByTestId("preview-status")).toBeHidden();
  await shot(page, "04-editor-background-blur");

  await page.getByRole("tab", { name: "Face Swap" }).click();
  await expect(page.getByText("coming in milestone M4")).toBeVisible();
  await shot(page, "05-editor-faceswap-planned");

  const before = Number(await page.getByTestId("credits").first().innerText());
  await page.getByTestId("export").click();
  await page.getByRole("radio", { name: "WEBP" }).click();
  await shot(page, "06-export-dialog");
  await page.getByTestId("start-export").click();
  const dl = page.getByTestId("download");
  await expect(dl).toBeVisible();
  await shot(page, "07-export-done");
  const href = await dl.getAttribute("href");
  const res = await page.request.get(href!);
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["content-type"]).toContain("image/webp");
  await expect(page.getByTestId("credits").first()).toHaveText(String(before - 3));
});

test("batch edit: multi upload, recipe, live progress, zip", async ({ page }) => {
  await signIn(page, "free");
  await page.getByTestId("batch-edit").click();
  const files = ["lena.jpg", "messi5.jpg", "baboon.jpg", "butterfly.jpg"].map((f) => path.join(SAMPLES, f));
  await page.getByTestId("file-input").setInputFiles(files);
  await expect(page.getByRole("button", { name: /Build recipe for 4 files/ })).toBeEnabled();
  await shot(page, "08-batch-upload");
  await page.getByRole("button", { name: /Build recipe for 4 files/ }).click();

  await page.getByRole("button", { name: "Color Grade" }).click();
  await expect(page.getByTestId("batch-estimate")).toHaveText("4");
  await shot(page, "09-recipe-builder");
  await page.getByTestId("start-batch").click();

  await expect(page.getByTestId("batch-row")).toHaveCount(4);
  await shot(page, "10-batch-running");
  await expect(page.getByTestId("batch-progress")).toHaveText("4/4");
  await expect(page.locator(".pill.completed")).toBeVisible();
  await shot(page, "11-batch-done");

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-zip").click()]);
  const p = await download.path();
  expect(fs.statSync(p!).size).toBeGreaterThan(10_000);
});

test("settings persist @mobile", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings");
  await page.getByRole("radio", { name: "Max quality" }).click();
  await page.getByLabel("Language").selectOption("hi");
  await page.reload();
  await expect(page.getByRole("radio", { name: "Max quality" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Language")).toHaveValue("hi");
  await shot(page, "12-settings");
  await page.goto("/");
  await shot(page, "13-home");
});
