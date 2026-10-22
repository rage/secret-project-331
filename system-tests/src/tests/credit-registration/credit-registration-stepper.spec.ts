import { expect, type Page, test } from "@playwright/test"

/**
 * The student registration stepper, driven through the demo page: its fake server keeps every
 * answer in the browser, so no seeded (account, course) pair is needed and nothing is written.
 */
const DEMO_URL = "/completion-registration/demo"

test.use({ storageState: "src/states/student1@example.com.json" })

const openDemo = async (page: Page) => {
  await page.goto(DEMO_URL)
  await page.getByRole("button", { name: "Show the demo" }).click()
}

const chooseSituation = async (page: Page, situation: string) => {
  await page.getByRole("button", { name: /Situation/ }).click()
  await page.getByRole("option", { name: situation, exact: true }).click()
}

test("A student without a linked number is walked through all three steps", async ({ page }) => {
  await openDemo(page)

  await test.step("The overview names the linking step before it comes", async () => {
    await expect(page.getByText("Link your student number")).toBeVisible()
    await page.getByRole("button", { name: "Start" }).click()
    await expect(page.getByText("Step 1 of 3")).toBeVisible()
  })

  await test.step("The answer decides the instructions, and Back returns to the questions", async () => {
    await page.getByRole("radio", { name: "Yes", exact: true }).click()
    await page.getByRole("button", { name: "Continue for instructions" }).click()
    await expect(page.getByRole("heading", { name: "Enrol in Sisu" })).toBeVisible()
    await page.goBack()
    await expect(page.getByRole("radio", { name: "Yes", exact: true })).toBeChecked()
    await page.getByRole("button", { name: "Continue for instructions" }).click()
  })

  await test.step("Not yet keeps them on the instructions", async () => {
    await page.getByRole("button", { name: "I have enrolled" }).click()
    await page.getByRole("button", { name: "Not yet" }).click()
    await expect(page.getByRole("heading", { name: "Enrol in Sisu" })).toBeVisible()
  })

  await test.step("Saying they enrolled leads to linking, and can be taken back", async () => {
    await page.getByRole("button", { name: "I have enrolled" }).click()
    await page.getByRole("button", { name: "Yes, I have enrolled" }).click()
    await expect(page.getByRole("heading", { name: "Link your student number" })).toBeVisible()
    await expect(page.getByText("Step 3 of 3")).toBeVisible()
    await page.getByRole("button", { name: "Go back to enrolment" }).click()
    await expect(page.getByRole("heading", { name: "Enrol in Sisu" })).toBeVisible()
  })
})

test("A student who took the certificate lands on it, and can change their mind", async ({
  page,
}) => {
  await openDemo(page)
  await chooseSituation(page, "Chose the certificate")
  await expect(page.getByRole("heading", { name: "You chose the certificate" })).toBeVisible()

  await page.getByRole("button", { name: "Change your choice" }).click()
  const need = page.getByRole("radiogroup", { name: "Which do you need?" })
  await expect(need).toBeVisible()
  await expect(need.getByRole("radio", { name: "A certificate of completion" })).not.toBeChecked()
})

test("A registration on its way lists every step to registered", async ({ page }) => {
  await openDemo(page)
  await chooseSituation(page, "Waiting for Sisu")

  await expect(page.getByRole("heading", { name: "Registering your completion" })).toBeVisible()
  const progress = page.getByRole("list", { name: "Progress" })
  for (const step of [
    "Enrolment found",
    "Completion sent to Sisu",
    "Sisu accepted your completion",
    "Partially registered in Sisu",
    "Fully registered in Sisu",
  ]) {
    await expect(progress.getByText(step)).toBeVisible()
  }
  await expect(progress.getByText("Registering it usually takes a few days.")).toBeVisible()
})
