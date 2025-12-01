import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"
import { waitForFooterTranslationsToLoad } from "../utils/waitingUtils"

import accessibilityCheck from "@/utils/accessibilityCheck"
import { selectOrganization } from "@/utils/organizationUtils"

test.use({
  storageState: "src/states/admin@example.com.json",
})

const SSD_DEFINITION =
  "A solid-state drive is a hard drive that's a few gigabytes in size, but a solid-state drive is one where data loads are big enough and fast enough that you can comfortably write to it over long distances. This is what drives do. You need to remember that a good solid-state drive has a lot of data: it stores files on disks and has a few data centers."

test("glossary test", async ({ page, headless }, testInfo) => {
  test.slow()

  await test.step("Open Organizations and select UH CS", async () => {
    await page.goto("http://project-331.local/organizations")
    await selectOrganization(page, "University of Helsinki, Department of Computer Science")
  })

  await test.step("Open Glossary course and ensure course instance", async () => {
    await page.getByText("Glossary course").click()
    await selectCourseInstanceIfPrompted(page)
  })

  await test.step("Navigate to Glossary page then back to Organizations and re-select org", async () => {
    await page.goto("http://project-331.local/org/uh-cs/courses/glossary-course/glossary")
    await page.goto("http://project-331.local/organizations")
    await selectOrganization(page, "University of Helsinki, Department of Computer Science")
  })

  await test.step("Open course manage menu and switch to Glossary tab", async () => {
    await page.locator("[aria-label=\"Manage course 'Glossary course'\"] svg").click()
    await page.getByRole("tab", { name: "Other" }).click()
    await page.getByRole("tab", { name: "Glossary" }).click()
  })

  await test.step("Quick edit cancel, then delete existing entry", async () => {
    await page.getByRole("button", { name: "Edit" }).first().click()
    await page.getByText("Cancel").click()

    await page.getByRole("button", { name: "Delete" }).first().click()
    await page.getByText("Deleted").first().waitFor()
  })

  await test.step("Create new glossary term and verify success", async () => {
    await page.getByPlaceholder("New term").fill("SSD")
    await page.getByPlaceholder("New definition").fill(SSD_DEFINITION)

    await page.getByRole("button", { name: "Save", exact: true }).click()
    await page.getByText("Operation successful!").waitFor()

    // Reload to stabilize screenshot later.
    await page.reload()
    await page.getByText(SSD_DEFINITION).waitFor()
    await waitForFooterTranslationsToLoad(page)
  })

  await test.step("Edit the newly added term and definition, then save", async () => {
    await page.getByRole("button", { name: "Edit" }).first().click()

    await page.getByPlaceholder("Updated term").fill("SSD")
    await page.getByPlaceholder("Updated definition").fill(SSD_DEFINITION)

    await page.locator(':nth-match(:text("Save"), 2)').click()
    await page.getByText("Operation successful!").waitFor()
  })

  await test.step("Return to Glossary page and snapshot", async () => {
    await page.goto("http://project-331.local/org/uh-cs/courses/glossary-course/glossary")
    await page.getByText("Give feedback").waitFor()

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "final-glossary-page",
      waitForTheseToBeVisibleAndStable: [page.getByRole("heading", { name: "Glossary" })],
      clearNotifications: true,
    })
  })

  await test.step("Glossary popup is accessible", async () => {
    await page.goto("http://project-331.local/org/uh-cs/courses/glossary-course/chapter-1/page-1")
    const glossaryButton = page.getByRole("button", { name: "SSD" }).first()
    await expect(glossaryButton).toBeVisible()

    await accessibilityCheck(page, "Glossary tooltip closed view")

    // For reliability we move the mouse to a consitent position before hovering.
    await page.mouse.move(0, 0)
    await glossaryButton.hover()

    await expect(
      page.getByRole("tooltip", {
        name: SSD_DEFINITION,
      }),
    ).toBeVisible()
    await accessibilityCheck(page, "Glossary tooltip open view")
    await page.keyboard.press("Escape")
    await expect(
      page.getByRole("tooltip", {
        name: SSD_DEFINITION,
      }),
    ).toBeHidden()

    await glossaryButton.click()
    const popover = page.getByRole("dialog", { name: "Definition" })
    await expect(popover).toBeVisible()
    await expect(popover).toBeFocused()
    await accessibilityCheck(page, "Glossary popover open view")
    await page.keyboard.press("Escape")
    await expect(popover).toBeHidden()

    await glossaryButton.focus()
    await expect(glossaryButton).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(popover).toBeVisible()
    await expect(popover).toBeFocused()
    await page.keyboard.press("Escape")
    await expect(popover).toBeHidden()

    await expect(page.locator("#content")).toMatchAriaSnapshot(`
      - paragraph:
        - text: This course uses many TLAs. Why? Because why use one word when three letters will do? It's like a secret code, but everyone knows it. You'll encounter CS, HDD,
        - button "KB"
        - text: Press to view definition , and many more. When shopping for a new computer, you might hear someone say that an
        - button "SSD"
        - text: Press to view definition makes everything faster, but don't worry if you're not sure what that means yet. By the end of this course, you'll be fluent in the language of three-letter abbreviations.
    `)
  })

  await test.step("Glossary tooltip screenshot", async () => {
    await page.goto("http://project-331.local/org/uh-cs/courses/glossary-course/chapter-1/page-1")
    await selectCourseInstanceIfPrompted(page)

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "glossary-tooltips",
      beforeScreenshot: async () => {
        await page.getByRole("button", { name: "SSD" }).first().hover()
      },
    })
  })
})
