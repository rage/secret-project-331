import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"

const COURSE_URL = "http://project-331.local/org/uh-cs/courses/automatic-completions"
const COURSE_PAGE_URL = `${COURSE_URL}/chapter-1/page-1`
const PROFILE_STUDIES_URL = "http://project-331.local/profile/studies"
const COURSE_NAME = "Automatic Completions"

test.use({
  storageState: "src/states/student4@example.com.json",
})

test("profile studies tab shows the student's progress and completions, without a credit-registration tab", async ({
  page,
}) => {
  test.slow()

  // The default module of this course completes after one attempted exercise worth one point.
  await page.goto(COURSE_URL)
  await selectCourseInstanceIfPrompted(page)
  await page.goto(COURSE_PAGE_URL)
  await page.frameLocator("iframe").getByText("b").click()
  await page.getByRole("button", { name: "Submit" }).click()
  await expect(page.getByText("Good job!")).toBeVisible()

  await page.goto(PROFILE_STUDIES_URL)

  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Studies" })).toBeVisible()
  // Registered in the shell, but hidden until some course offers credit registration.
  await expect(page.getByRole("tab", { name: "Credit registration" })).toHaveCount(0)

  await expect(page.getByText("ECTS earned")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Your courses" })).toBeVisible()

  const courseCard = page
    .getByTestId("profile-course-card")
    .filter({ hasText: COURSE_NAME })
    .first()
  await expect(courseCard).toBeVisible()
  await courseCard.getByRole("button").first().click()

  await expect(courseCard.getByRole("heading", { name: "Your progress" })).toBeVisible()
  await expect(courseCard.getByText("Total points").first()).toBeVisible()
  await expect(courseCard.getByText("Exercises attempted").first()).toBeVisible()

  // The default module's completion row is labelled with the course name.
  await expect(courseCard.getByRole("heading", { name: "Completions", exact: true })).toBeVisible()
  const completionsTable = courseCard.getByRole("table")
  await expect(completionsTable.getByRole("columnheader", { name: "Grade" })).toBeVisible()
  await expect(
    completionsTable.getByRole("row").filter({ hasText: COURSE_NAME }).getByText("Passed"),
  ).toBeVisible()

  await expect(courseCard.getByRole("link", { name: "Go to course" })).toBeVisible()
})
