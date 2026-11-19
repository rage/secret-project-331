import { test } from "@playwright/test"

import { coursePageActionsMenu, createCoursePage } from "@/utils/manageCoursePages"
import { waitForSuccessNotification } from "@/utils/notificationUtils"
import { selectOrganization } from "@/utils/organizationUtils"
import waitForSpinnersToDisappear from "@/utils/waitForSpinnersToDisappear"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Chaning page path works and redirects correctly", async ({ page }) => {
  await page.goto("http://project-331.local/organizations")

  await selectOrganization(page, "University of Helsinki, Department of Mathematics and Statistics")
  await page.getByLabel("Manage course 'Change Path'").click()
  await page.getByRole("tab", { name: "Pages" }).click()
  await waitForSpinnersToDisappear(page)
  await createCoursePage(page, { chapterNumber: 1 }, "page with wrong path")
  await page.getByRole("cell", { name: "/chapter-1/page-with-wrong-path" }).waitFor()
  await coursePageActionsMenu(page, "page with wrong path", { chapterNumber: 1 }).chooseItem(
    "Edit page details",
  )
  await page.getByLabel("Title", { exact: true }).fill("page-with-right-path")
  await page.getByLabel("Path", { exact: true }).fill("page-with-right-path-yeah")
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Update" }).click()
  })
  await page.getByRole("cell", { name: "/chapter-1/page-with-right-path-yeah" }).waitFor()
  // go to the old url to see if the redirect works
  await page.goto(
    `http://project-331.local/org/uh-mathstat/courses/change-path/chapter-1/page-with-wrong-path`,
  )
  await page.waitForURL(
    `http://project-331.local/org/uh-mathstat/courses/change-path/chapter-1/page-with-right-path-yeah`,
  )
})
