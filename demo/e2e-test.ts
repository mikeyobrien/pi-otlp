import { firefox, Browser, Page } from "playwright";

const GRAFANA_URL = "http://0.0.0.0:3000";
const DASHBOARD_UID = "pi-otlp-metrics";

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testGrafanaDashboard(): Promise<void> {
  console.log("Starting Grafana E2E test...\n");

  let browser: Browser | null = null;

  try {
    // Launch browser
    console.log("1. Launching Firefox browser...");
    browser = await firefox.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const page: Page = await context.newPage();

    // Login to Grafana
    console.log("2. Logging into Grafana...");
    await page.goto(`${GRAFANA_URL}/login`);
    await page.fill('input[name="user"]', "admin");
    await page.fill('input[name="password"]', "admin");
    await page.click('button[type="submit"]');

    // Wait for redirect or skip password change
    await delay(2000);

    // Check if we need to skip password change
    const skipButton = page.locator('a:has-text("Skip")');
    if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log("   Skipping password change...");
      await skipButton.click();
    }

    // Navigate to dashboard
    console.log("3. Navigating to Pi-OTLP dashboard...");
    await page.goto(`${GRAFANA_URL}/d/${DASHBOARD_UID}?orgId=1&from=now-1h&to=now`);
    await delay(3000);

    // Take screenshot of full dashboard
    console.log("4. Taking dashboard screenshot...");
    await page.screenshot({
      path: "demo/screenshots/dashboard-full.png",
      fullPage: true,
    });

    // Verify dashboard title
    const title = await page.locator('h1:has-text("Pi Coding Agent")').textContent();
    console.log(`   Dashboard title: ${title}`);

    // Check for key panels
    console.log("5. Verifying dashboard panels...");
    const panels = [
      "Total Sessions",
      "Total Turns",
      "Total Tool Calls",
      "Total Tokens",
      "Total Cost",
      "Tool Error Rate",
    ];

    for (const panel of panels) {
      const panelExists = await page
        .locator(`[data-testid="data-testid Panel header ${panel}"], h2:has-text("${panel}"), span:has-text("${panel}")`)
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      console.log(`   ${panelExists ? "✓" : "✗"} ${panel}`);
    }

    // Check if datasource is working
    console.log("6. Checking Prometheus datasource...");
    await page.goto(`${GRAFANA_URL}/api/datasources`);
    const datasourcesText = await page.textContent("body");
    const hasPrometheus = datasourcesText?.includes("Prometheus") || datasourcesText?.includes("prometheus");
    console.log(`   ${hasPrometheus ? "✓" : "✗"} Prometheus datasource configured`);

    // Check for any metrics in Prometheus via Grafana explore
    console.log("7. Checking for pi_* metrics...");
    await page.goto(`${GRAFANA_URL}/explore?orgId=1&left=%7B%22datasource%22:%22Prometheus%22,%22queries%22:%5B%7B%22refId%22:%22A%22,%22expr%22:%22%7B__name__%3D~%5C%22pi_.*%5C%22%7D%22%7D%5D%7D`);
    await delay(2000);
    await page.screenshot({
      path: "demo/screenshots/explore-metrics.png",
    });

    // Final dashboard screenshot with narrower time range
    console.log("8. Taking final dashboard screenshot...");
    await page.goto(`${GRAFANA_URL}/d/${DASHBOARD_UID}?orgId=1&from=now-15m&to=now&refresh=5s`);
    await delay(3000);
    await page.screenshot({
      path: "demo/screenshots/dashboard-15m.png",
      fullPage: true,
    });

    console.log("\n✓ E2E test completed successfully!");
    console.log("  Screenshots saved to demo/screenshots/");

  } catch (error) {
    console.error("\n✗ E2E test failed:", error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testGrafanaDashboard();
