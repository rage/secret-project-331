import { expect, test } from "@playwright/test"

test.use({
  storageState: "src/states/admin@example.com.json",
})

test("Status page displays Kubernetes information", async ({ page }) => {
  await test.step("Navigate to status page", async () => {
    await page.goto("http://project-331.local/status")
  })

  await test.step("Check that the page title is visible", async () => {
    await expect(page.getByRole("heading", { name: "Kubernetes Status" })).toBeVisible()
  })

  await test.step("Check that system health summary is displayed", async () => {
    await expect(page.getByText("System Health").first()).toBeVisible()
    // The health status should be one of: Healthy, Warning, or Error
    const healthStatus = page.locator("text=/Healthy|Warning|Error/").first()
    await expect(healthStatus).toBeVisible()
  })

  await test.step("Check that Pods section is displayed", async () => {
    await expect(page.getByRole("heading", { name: "Pods" })).toBeVisible()
    // Wait for the pods table to load (either data or "No pods found" message)
    await page
      .locator("text=/Name|Phase|Ready|No pods found/")
      .first()
      .waitFor({ state: "visible" })
  })

  await test.step("Check that Deployments section is displayed", async () => {
    await expect(page.getByRole("heading", { name: "Deployments" })).toBeVisible()
    // Wait for the deployments table to load
    await page
      .locator("text=/Name|Ready Replicas|Total Replicas|No deployments found/")
      .first()
      .waitFor({ state: "visible" })
  })

  await test.step("Check that CronJobs section is displayed", async () => {
    await expect(page.getByRole("heading", { name: "CronJobs" })).toBeVisible()
    // Wait for the cronjobs table to load
    await page
      .locator("text=/Name|Schedule|Last Schedule Time|No cron jobs found/")
      .first()
      .waitFor({ state: "visible" })
  })

  await test.step("Check that Jobs section is displayed", async () => {
    await expect(page.getByRole("heading", { name: "Jobs", exact: true })).toBeVisible()
    // Wait for the jobs table to load
    await page
      .locator("text=/Name|Succeeded|Failed|Active|No jobs found/")
      .first()
      .waitFor({ state: "visible" })
  })

  await test.step("Check that Services section is displayed", async () => {
    await expect(page.getByRole("heading", { name: "Services" })).toBeVisible()
    // Wait for the services table to load
    await page
      .locator("text=/Name|Cluster IP|Ports|No services found/")
      .first()
      .waitFor({ state: "visible" })
  })

  await test.step("Check that Events section is displayed", async () => {
    await expect(page.getByRole("heading", { name: "Events" })).toBeVisible()
    // Wait for the events filter or table to load
    await page
      .locator("text=/Filter|Type|Reason|Object|Message|No events found/")
      .first()
      .waitFor({ state: "visible" })
  })

  await test.step("Check that Ingresses section is displayed", async () => {
    await expect(page.getByRole("heading", { name: "Ingresses" })).toBeVisible()
    // Wait for the ingresses table to load
    await page
      .locator("text=/Name|Class|Hosts|Paths|No ingresses found/")
      .first()
      .waitFor({ state: "visible" })
  })
})
