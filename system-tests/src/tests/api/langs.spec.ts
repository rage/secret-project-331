import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"

test.use({
  storageState: "src/states/langs@example.com.json",
})

test("get course instances with tmc exercises", async ({ page, request }) => {
  // langs user is enrolled to one course with tmc exercises in the seed
  const initialResponse = await request.get(`/api/v0/langs/course-instances`, {
    headers: { Authorization: "Bearer langs@example.com" },
  })
  const expectedCourseInstances = [
    {
      course_description: "The definitive introduction to course material.",
      course_id: "d6b52ddc-6c34-4a59-9a59-7e8594441007",
      course_name: "Introduction to Course Material",
      course_slug: "introduction-to-course-material",
      id: "8e6c35cd-43f2-4982-943b-11e3ffb1b2f8",
      instance_description: null,
      instance_name: null,
    },
  ]
  expect(await initialResponse.json()).toStrictEqual(expectedCourseInstances)

  // enroll to a course with no tmc exercises
  await page.goto("http://project-331.local/organizations")
  await page
    .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
    .click()
  await page
    .getByRole("link", { name: "Navigate to course 'Introduction to Computer Science'" })
    .click()
  await selectCourseInstanceIfPrompted(page)

  const response = await request.get(`/api/v0/langs/course-instances`, {
    headers: { Authorization: "Bearer langs@example.com" },
  })
  // the new course instance is not displayed on the list because it has no tmc exercises
  expect(await response.json()).toStrictEqual(expectedCourseInstances)
})
