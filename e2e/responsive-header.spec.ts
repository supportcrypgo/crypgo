import { expect, test as base } from "@playwright/test";

const test = base.extend<{ runtimeErrors: string[] }>({
  runtimeErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.addInitScript(() => {
      const ids = ["bitcoin", "ethereum", "litecoin", "solana", "dogecoin"];
      const data = ids.map((id) => ({
        id,
        name: id,
        symbol: id.slice(0, 3),
        image: "/images/icons/icon-bitcoin.svg",
        current_price: 100,
        price_change_percentage_24h: 1,
        market_cap: 1000,
        total_volume: 100,
        sparkline_in_7d: { price: [] },
      }));
      localStorage.setItem(
        "crypto_market_cache",
        JSON.stringify({ data, timestamp: Date.now() }),
      );
    });
    await use(errors);
    expect(errors, "browser runtime and console errors").toEqual([]);
  },
});

test("responsive header fits the viewport and exposes the right navigation", async ({ page }) => {
  await page.goto("/");
  const viewportWidth = page.viewportSize()?.width ?? 0;

  await expect(page.locator("header")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);

  if (viewportWidth < 1024) {
    await expect(page.getByRole("button", { name: "Toggle mobile menu" })).toBeVisible();
    await expect(page.locator("header nav").first()).toBeHidden();
  } else {
    await expect(page.getByRole("button", { name: "Toggle mobile menu" })).toBeHidden();
    await expect(page.locator("header nav").first()).toBeVisible();
  }
});

test("mobile section navigation closes the menu and restores scrolling", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1024, "mobile navigation behavior");
  await page.goto("/");

  const toggle = page.getByRole("button", { name: "Toggle mobile menu" });
  const menu = page.locator("#mobile-navigation");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  await menu.getByRole("link", { name: "Portfolio" }).click();
  await expect(page).toHaveURL(/#portfolio$/);
  await expect(menu).toHaveAttribute("aria-hidden", "true");
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");

  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test("mobile backdrop closes the menu and releases the scroll lock", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1024, "mobile navigation behavior");
  await page.goto("/");

  const toggle = page.getByRole("button", { name: "Toggle mobile menu" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Dismiss mobile navigation" }).click({
    position: { x: 20, y: 300 },
  });

  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});

test("header uses its scrolled surface when loading at a section anchor", async ({ page }) => {
  await page.goto("/#portfolio");
  await page.waitForFunction(() => window.scrollY >= 80);
  await expect
    .poll(() => page.locator("header").getAttribute("class"))
    .toContain("bg-darkmode");
});

test("sign-in query still opens the authentication modal", async ({ page }) => {
  await page.goto("/?signin=1");
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
});

test("closing sign-in after opening it from the mobile menu restores scrolling", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1024, "mobile navigation behavior");
  await page.goto("/");

  await page.getByRole("button", { name: "Toggle mobile menu" }).click();
  await page.locator("#mobile-navigation").getByRole("link", { name: "Sign In" }).click();
  await expect(page.getByRole("button", { name: "Close Sign In Modal" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  await page.getByRole("button", { name: "Close Sign In Modal" }).click();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});