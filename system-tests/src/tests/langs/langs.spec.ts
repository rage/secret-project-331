import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"

test.use({
  storageState: "src/states/langs@example.com.json",
})

test("get course instances", async ({ page, request }) => {
  // not enrolled to any course instance yet
  const initialResponse = await request.get(`/api/v0/langs/course-instances`, {
    headers: { Authorization: "Bearer langs@example.com" },
  })
  expect(await initialResponse.json()).toStrictEqual([])

  // enroll
  await page.goto("http://project-331.local/")
  await page
    .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
    .click()
  await page
    .getByRole("link", { name: "Navigate to course 'Introduction to Computer Science'" })
    .click()
  await selectCourseInstanceIfPrompted(page)

  // not enrolled to any course instance yet
  const response = await request.get(`/api/v0/langs/course-instances`, {
    headers: { Authorization: "Bearer langs@example.com" },
  })
  expect(await response.json()).toStrictEqual([
    {
      course_description: "An example course.",
      course_id: "06a7ccbd-8958-4834-918f-ad7b24e583fd",
      id: "48399008-6523-43c5-8fd6-59ecc731a426",
      course_name: "Introduction to Computer Science",
      course_slug: "introduction-to-computer-science",
      instance_description: null,
      instance_name: null,
    },
  ])
})
