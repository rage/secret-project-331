import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import { assertTopLevelPageNotInList } from "../../utils/flows/topLevelPages.flow"

import { selectOrganization } from "@/utils/organizationUtils"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("find hidden page", async ({ page }) => {
  await page.goto("http://project-331.local/organizations")

  await selectOrganization(page, "University of Helsinki, Department of Computer Science")

  await page.getByText("Introduction to everything").click()

  await selectCourseInstanceIfPrompted(page)

  await assertTopLevelPageNotInList(page, "Hidden Page")

  await page.goto("http://project-331.local/org/uh-cs/courses/introduction-to-everything/hidden")

  await expect(page.locator(`text="You found the secret of the project 331!"`)).toBeVisible()
})
