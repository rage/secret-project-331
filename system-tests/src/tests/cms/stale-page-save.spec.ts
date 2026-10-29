import { expect, type Page, test } from "@playwright/test"

import { respondToConfirmDialog } from "@/utils/dialogs"
import {
  coursePageActionsMenu,
  createCoursePage,
  openCoursePageInEditor,
} from "@/utils/manageCoursePages"
import { waitForSuccessNotification } from "@/utils/notificationUtils"
import { selectOrganization } from "@/utils/organizationUtils"
import waitForSpinnersToDisappear from "@/utils/waitForSpinnersToDisappear"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

const save = (editor: Page) => editor.getByRole("button", { name: "Save", exact: true })
const title = (editor: Page) => editor.getByLabel("Title", { exact: true })

test("saving a page someone else changed asks whether to overwrite or discard", async ({
  page,
  context,
}) => {
  const pageName = `stale save ${Date.now()}`
  await page.goto("http://project-331.local/organizations")
  await selectOrganization(page, "University of Helsinki, Department of Mathematics and Statistics")
  await page.getByLabel("Manage course 'Change Path'").click()
  await page.getByRole("tab", { name: "Pages" }).click()
  await waitForSpinnersToDisappear(page)
  await createCoursePage(page, { chapterNumber: 1 }, pageName)
  const coursePagesUrl = page.url()

  const otherPage = await context.newPage()
  await otherPage.goto(coursePagesUrl)
  await waitForSpinnersToDisappear(otherPage)

  await openCoursePageInEditor(page, pageName, { chapterNumber: 1 })
  await openCoursePageInEditor(otherPage, pageName, { chapterNumber: 1 })

  await test.step("The first save goes through", async () => {
    await title(page).fill(`${pageName} first`)
    await waitForSuccessNotification(page, async () => {
      await save(page).click()
    })
  })

  await test.step("Discarding reloads the latest version", async () => {
    await title(otherPage).fill(`${pageName} discarded`)
    await save(otherPage).click()
    await respondToConfirmDialog(otherPage, false, undefined, "Someone else changed this")
    await expect(title(otherPage)).toHaveValue(`${pageName} first`)
  })

  await test.step("Overwriting saves over the other change", async () => {
    await title(page).fill(`${pageName} second`)
    await waitForSuccessNotification(page, async () => {
      await save(page).click()
    })
    await title(otherPage).fill(`${pageName} overwritten`)
    await save(otherPage).click()
    await waitForSuccessNotification(otherPage, async () => {
      await respondToConfirmDialog(otherPage, true, undefined, "Someone else changed this")
    })
    await expect(title(otherPage)).toHaveValue(`${pageName} overwritten`)
  })
})

test("saving a page renamed in the course's page list asks whether to overwrite or discard", async ({
  page,
  context,
}) => {
  const pageName = `stale rename ${Date.now()}`
  await page.goto("http://project-331.local/organizations")
  await selectOrganization(page, "University of Helsinki, Department of Mathematics and Statistics")
  await page.getByLabel("Manage course 'Change Path'").click()
  await page.getByRole("tab", { name: "Pages" }).click()
  await waitForSpinnersToDisappear(page)
  await createCoursePage(page, { chapterNumber: 1 }, pageName)
  const coursePagesUrl = page.url()

  const otherPage = await context.newPage()
  await otherPage.goto(coursePagesUrl)
  await waitForSpinnersToDisappear(otherPage)

  await openCoursePageInEditor(page, pageName, { chapterNumber: 1 })

  await test.step("Rename the page in the page list", async () => {
    await coursePageActionsMenu(otherPage, pageName, { chapterNumber: 1 }).chooseItem(
      "Edit page details",
    )
    await title(otherPage).fill(`${pageName} renamed`)
    await waitForSuccessNotification(otherPage, async () => {
      await otherPage.getByRole("button", { name: "Update" }).click()
    })
  })

  await test.step("Saving in the editor does not undo the rename", async () => {
    await title(page).fill(`${pageName} edited`)
    await save(page).click()
    await respondToConfirmDialog(page, false, undefined, "Someone else changed this")
    await expect(title(page)).toHaveValue(`${pageName} renamed`)
  })
})
