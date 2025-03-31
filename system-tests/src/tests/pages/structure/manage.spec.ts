import { expect, Page, test } from "@playwright/test"

import { hideToasts } from "@/utils/notificationUtils"
import expectScreenshotsToMatchSnapshots from "@/utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})

const chapterOrderingText = "Do you want to save the changes to the chapter ordering?"
const pageOrderingText = "Do you want to save the changes to the page ordering?"

async function verifyDialogState(page: Page, chapterVisible: boolean, pageVisible: boolean) {
  await test.step("Verify dialog state", async () => {
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (chapterVisible) {
      await expect(page.getByText(chapterOrderingText)).toBeVisible()
    } else {
      // Checking that the wrong text is not in the dom at all, that way we can be sure that it's not under another dialog
      await expect(page.getByText(chapterOrderingText)).toHaveCount(0)
    }

    // eslint-disable-next-line playwright/no-conditional-in-test
    if (pageVisible) {
      await expect(page.getByText(pageOrderingText)).toBeVisible()
    } else {
      // Checking that the wrong text is not in the dom at all, that way we can be sure that it's not under another dialog
      await expect(page.getByText(pageOrderingText)).toHaveCount(0)
    }
  })
}

async function moveChapter(page: Page, chapterHeading: string, direction: "up" | "down") {
  await test.step(`Move chapter "${chapterHeading}" ${direction}`, async () => {
    await page
      .getByRole("heading", { name: new RegExp(chapterHeading) })
      .getByRole("button", { name: "Dropdown menu" })
      .click()
    await page.getByRole("button", { name: `Move ${direction}` }).click()
    await verifyDialogState(page, true, false)
  })
}

async function movePage(page: Page, pageText: string, direction: "up" | "down") {
  await test.step(`Move page "${pageText}" ${direction}`, async () => {
    const pageRow = page.getByRole("row").filter({ hasText: pageText })
    await pageRow.getByLabel("Dropdown menu").click()
    await page.getByRole("button", { name: `Move ${direction}` }).click()
    await verifyDialogState(page, false, true)
  })
}

async function deletePage(page: Page, pageText: string) {
  await test.step(`Delete page "${pageText}"`, async () => {
    const pageRow = page.getByRole("row").filter({ hasText: pageText })
    await pageRow.getByLabel("Dropdown menu").click()

    page.once("dialog", (dialog) => {
      dialog.accept()
    })

    await hideToasts(page)
    await page.getByRole("button", { name: "Delete" }).click()
    await expect(page.getByText("Successfully deleted")).toBeVisible()
    await verifyDialogState(page, false, true)
  })
}

async function saveChanges(page: Page) {
  await test.step("Save changes", async () => {
    await hideToasts(page)
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("Operation successful!")).toBeVisible()
    await verifyDialogState(page, false, false)
  })
}

async function verifyElementOrder(page: Page, firstElement: string, secondElement: string) {
  await test.step(`Verify element order: "${firstElement}" before "${secondElement}"`, async () => {
    await expect(page.getByText(firstElement)).toBeVisible()
    await expect(page.getByText(secondElement)).toBeVisible()

    const firstPosition = await page
      .getByText(firstElement)
      .evaluate((el) => el.getBoundingClientRect().top)
    const secondPosition = await page
      .getByText(secondElement)
      .evaluate((el) => el.getBoundingClientRect().top)

    expect(firstPosition).toBeLessThan(secondPosition)
  })
}

test("manage course structure works", async ({ page, headless }, testInfo) => {
  await test.step("Navigate to course structure page", async () => {
    await page.goto("http://project-331.local/organizations")
    await page.getByText("University of Helsinki, Department of Computer Science").click()
    await page.getByLabel("Manage course 'Course Structure'").click()
    await page.getByText("Pages").click()

    await expect(page).toHaveURL(
      "http://project-331.local/manage/courses/86cbc198-601c-42f4-8e0f-3e6cce49bbfc/pages",
    )
    await verifyDialogState(page, false, false)
  })

  await test.step("Test chapter ordering", async () => {
    await verifyElementOrder(page, "Chapter 1: The Basics", "Chapter 2: The intermediaries")

    await moveChapter(page, "Chapter 1: The Basics", "down")

    await expect(page.getByRole("heading", { name: /Chapter 2: The Basics/ })).toBeVisible()
    await expect(page.getByRole("heading", { name: /Chapter 1: The intermediaries/ })).toBeVisible()

    await saveChanges(page)

    await moveChapter(page, "Chapter 2: The Basics", "up")
    await saveChanges(page)

    await expect(page.getByRole("heading", { name: /Chapter 1: The Basics/ })).toBeVisible()
    await expect(page.getByRole("heading", { name: /Chapter 2: The intermediaries/ })).toBeVisible()
  })

  await test.step("Test page ordering", async () => {
    await movePage(page, "Page One", "down")
    await movePage(page, "Page 6", "up")
    await saveChanges(page)

    await verifyElementOrder(page, "Page 2", "Page One")
    await verifyElementOrder(page, "Page 6", "Page 5")
  })

  await test.step("Test page deletion", async () => {
    await deletePage(page, "Page 4")
    await saveChanges(page)
    await page.reload()
    await verifyDialogState(page, false, false)
  })

  await test.step("Test chapter editing", async () => {
    await page
      .getByRole("heading", { name: /Chapter 2: The intermediaries/ })
      .getByRole("button", { name: "Dropdown menu" })
      .click()
    await page.getByRole("button", { name: "Edit", exact: true }).click()

    await page.getByLabel("Name").first().fill("The intermediaries TEST change")
    await page.getByLabel("Set Deadline").first().check()
    await page.getByLabel("Deadline", { exact: true }).first().fill("2050-01-01T23:59:13")

    await hideToasts(page)
    await page.getByRole("button", { name: "Update" }).click()
    await expect(page.getByText("Operation successful!")).toBeVisible()
    await expect(page.getByText("The intermediaries TEST change")).toBeVisible()
  })

  await test.step("Test more page deletion", async () => {
    await deletePage(page, "Page 3")
    await page.reload()
    await saveChanges(page)
    await verifyDialogState(page, false, false)
  })

  await test.step("Test final chapter reordering", async () => {
    await moveChapter(page, "Chapter 1: The Basics", "down")
    await saveChanges(page)

    await expect(
      page.getByRole("heading", { name: /Chapter 1: The intermediaries TEST change/ }),
    ).toBeVisible()
    await expect(page.getByRole("heading", { name: /Chapter 2: The Basics/ })).toBeVisible()
  })

  await test.step("Take screenshots", async () => {
    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "manage-course-structure-middle-of-the-page",
      clearNotifications: true,
    })

    await page.evaluate(() => {
      window.scrollTo(0, 0)
    })

    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "manage-course-structure-top-of-the-page",
      clearNotifications: true,
    })
  })
})
