import { expect, test } from "@playwright/test"

import { DateTimeLocalField } from "@/utils/components/DateTimeLocalField"
import { Select } from "@/utils/components/Select"
import { Switch } from "@/utils/components/Switch"
import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import { waitForSuccessNotification } from "@/utils/notificationUtils"
import { selectOrganization } from "@/utils/organizationUtils"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

const SELF_REVIEW_COURSE_ID = "3cbaac48-59c4-4e31-9d7e-1f51c017390d"
const ADDITIONAL_MESSAGE = "THIS COURSE HAS CLOSED UNTIL FURTHER NOTICE"

test("Can close courses and shows warning dialog", async ({ page }) => {
  await page.goto("http://project-331.local/")
  await page.getByRole("link", { name: "All organizations" }).click()
  await selectOrganization(page, "University of Helsinki, Department of Mathematics and Statistics")
  await page.getByRole("link", { name: "Manage course 'Closed course'" }).click()
  await page.getByRole("button", { name: "Edit" }).click()
  await Switch.labelled(page, "Close the course automatically").setChecked(true)
  await new DateTimeLocalField(page, "closed-at-field").setValue("2025-01-01T13:15")
  await page.getByRole("textbox", { name: "Note for students" }).fill(ADDITIONAL_MESSAGE)
  await new Select(page, page.getByTestId("closed-successor-field"), {
    name: "Newer version",
  }).chooseOptionByValue(SELF_REVIEW_COURSE_ID)
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Update" }).click()
  })
  await page.getByRole("link", { name: "Open course front page" }).click()
  await selectCourseInstanceIfPrompted(page)
  await page.getByText("This course has been closed").waitFor()
  await page.getByText("Additional information").waitFor()
  await page.getByText(ADDITIONAL_MESSAGE).waitFor()
  await page.getByText("New version of the course").click()
  await expect(page).toHaveURL("http://project-331.local/org/uh-mathstat/courses/self-review")
})
