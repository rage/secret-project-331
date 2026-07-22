import { test, expect } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import { waitForSuccessNotification } from "@/utils/notificationUtils"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test.describe("Course jsonLd generation", () => {
  test("Metadata jsonLd exist", async ({ page }) => {
    await page.goto("http://project-331.local/org/uh-mathstat/courses/metadata-course/")
    await selectCourseInstanceIfPrompted(page)
    const jsonLdLocator = page.locator("script[type='application/ld+json']")
    await expect(jsonLdLocator).toBeAttached()
  })

  test("Metadata has correct fields set fields", async ({ page }) => {
    await page.goto("http://project-331.local/org/uh-mathstat/courses/metadata-course/")
    await selectCourseInstanceIfPrompted(page)
    const jsonLdLocator = page.locator("script[type='application/ld+json']")
    const rawJSON = await jsonLdLocator.textContent()
    // oxlint-disable-next-line playwright/no-conditional-in-test
    if (!rawJSON) {
      throw new Error("Json metadata not found")
    }
    const metadata = JSON.parse(rawJSON)
    expect(metadata["@context"]).toBe("https://schema.org")
    expect(metadata["@type"]).toBe("Course")
    expect(metadata["name"]).toBe("Metadata course")
    expect(metadata["description"]).toBe("Course for testing jsonld metadata.")
    expect(metadata["courseCode"]).toBe("TEST001")
    expect(metadata["coursePrerequisites"]).toStrictEqual([])
    expect(metadata["audience"]).toStrictEqual([])
  })

  test("Teacher setting metadata suggestions changes jsonLd", async ({ page }) => {
    await page.goto(
      "http://project-331.local/manage/courses/6237f9a6-15d5-46f6-89fb-d9d59bdc7b65/overview",
    )
    await page.getByRole("button", { name: "Suggest metadata" }).click()
    await waitForSuccessNotification(page, async () => {
      await page.getByRole("button", { name: "Replace metadata" }).click()
    })
    await page.getByRole("button", { name: "Open course front page" }).click()
    await selectCourseInstanceIfPrompted(page)
    const jsonLdLocator = page.locator("script[type='application/ld+json']")
    const rawJSON = await jsonLdLocator.textContent()
    // oxlint-disable-next-line playwright/no-conditional-in-test
    if (!rawJSON) {
      throw new Error("Json metadata not found")
    }
    const metadata = JSON.parse(rawJSON)
    expect(metadata["description"]).toBe(
      "Introductory course to containers and containerization with Docker. Introduces containerization with Docker and relevant concepts such as image and volume. After completion, students are able to run containerized applications, containerize applications, utilize volumes to store data persistently outside containers, use port mapping to enable access via TCP to containerized applications, and share their own containers publicly.",
    )
    expect(metadata["coursePrerequisites"]).toStrictEqual([
      "No hard prerequisites",
      "Linux operating systems and web development experience are useful",
    ])
    expect(metadata["audience"]).toStrictEqual([
      { "@type": "EducationalAudience", educationalRole: "student", audienceType: "everyone" },
    ])
  })
})
