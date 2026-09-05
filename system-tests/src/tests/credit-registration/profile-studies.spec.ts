import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import { PROFILE_STUDIES_URL } from "@/utils/creditRegistration"
import { expect, testThatCanFail as test } from "@/utils/nonBlockingTest"

const COURSE_URL = "http://project-331.local/org/uh-cs/courses/automatic-completions"
const COURSE_PAGE_URL = `${COURSE_URL}/chapter-1/page-1`
const COURSE_NAME = "Automatic Completions"

test.use({
  storageState: "src/states/student4@example.com.json",
})

test("profile studies tab shows the student's points and result, without a credit-registration tab", async ({
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

  const courseCard = page
    .getByTestId("profile-course-card")
    .filter({ hasText: COURSE_NAME })
    .first()
  await expect(courseCard.getByRole("heading", { level: 3, name: COURSE_NAME })).toBeVisible()

  // Nothing to open: the points and the result are on the card as it renders.
  await expect(courseCard.getByRole("meter", { name: "Points" })).toBeVisible()
  await expect(courseCard.getByText("Passed")).toBeVisible()
  await expect(courseCard.getByRole("link", { name: "Go to course" })).toBeVisible()
})
