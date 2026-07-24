import { expect, test } from "@playwright/test"

import { waitForSuccessNotification } from "@/utils/notificationUtils"
import waitForSpinnersToDisappear from "@/utils/waitForSpinnersToDisappear"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test.describe("Course metadata generation", () => {
  test.describe("Course description generation", () => {
    test("Teacher tries to generate description without default module course code", async ({
      page,
    }) => {
      await page.goto("http://project-331.local/")
      await page.getByRole("link", { name: "Manage course 'Introduction to everything'" }).click()
      await expect(page.getByText("You need to set the default")).toBeVisible()
      await expect(page.getByText("Generate metadata for the")).toBeVisible()
      await expect(page.getByRole("button", { name: "Suggest metadata" })).toBeDisabled()
    })

    test("Teacher generates description and replaces original description", async ({ page }) => {
      await page.goto("http://project-331.local/")
      await page.getByRole("link", { name: "Manage course 'Description" }).click()
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await expect(page.getByRole("textbox", { name: "AI generated description" })).toBeVisible()
      const ai_text = await page
        .getByRole("textbox", { name: "AI generated description" })
        .inputValue()
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Replace metadata" }).click()
      })
      const replaced_description = await page.getByText("Description: Introductory").innerText()
      expect("Description: ".concat(ai_text)).toStrictEqual(replaced_description)
    })

    test("Teacher tries to generate description with only another module having course code", async ({
      page,
    }) => {
      await page.goto("http://project-331.local/")
      await page.getByRole("link", { name: "Manage course 'Introduction to codes'" }).click()
      await expect(page.getByText("You need to set the default")).toBeVisible()
      await expect(page.getByRole("button", { name: "Suggest metadata" })).toBeDisabled()
      await page.getByRole("tab", { name: "Modules" }).click()

      await page
        .locator("form")
        .filter({ hasText: "1. Another module." })
        .getByLabel("Edit")
        .click()
      await expect(
        page
          .locator("form")
          .filter({ hasText: "Edit module" })
          .getByPlaceholder("University of Helsinki course"),
      ).toHaveValue("TEST002")
      await page.locator("form").filter({ hasText: "Default module." }).getByLabel("Edit").click()
      await expect(
        page
          .locator("form")
          .filter({ hasText: "Default" })
          .getByPlaceholder("University of Helsinki course"),
      ).toHaveValue("")
    })

    test("Teacher can generate description after filling default module course code", async ({
      page,
    }) => {
      await page.goto("http://project-331.local/")
      await page.getByRole("link", { name: "Manage course 'Introduction to codes'" }).click()
      await expect(page.getByText("You need to set the default")).toBeVisible()
      await expect(page.getByRole("button", { name: "Suggest metadata" })).toBeDisabled()
      await page.getByRole("tab", { name: "Modules" }).click()

      await page.locator("form").filter({ hasText: "Default module." }).getByLabel("Edit").click()
      await page
        .locator("form")
        .filter({ hasText: "Default" })
        .getByPlaceholder("University of Helsinki course")
        .fill("TEST001")
      await page.locator("form").filter({ hasText: "Default" }).getByLabel("Confirm").click()

      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Save changes" }).click()
      })

      await page.getByRole("tab", { name: "Overview" }).click()

      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await expect(page.getByRole("textbox", { name: "AI generated description" })).toBeVisible()
      const ai_text = await page
        .getByRole("textbox", { name: "AI generated description" })
        .inputValue()
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Replace metadata" }).click()
      })
      const replaced_description = await page.getByText("Description: Introductory").innerText()
      expect("Description: ".concat(ai_text)).toStrictEqual(replaced_description)
    })

    test("Teacher cannot generate description with invalid course code", async ({ page }) => {
      await page.goto("http://project-331.local/")
      await page.getByRole("link", { name: "Manage course 'Automatic Completions'" }).click()
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await page.getByRole("heading", { name: "Could not generate description" }).waitFor()
      await expect(
        page.getByText(
          "Make sure that the given University of Helsinki course codes in modules are valid.",
        ),
      ).toBeVisible()
      await expect(page.getByRole("button", { name: "Replace metadata" })).toBeDisabled()
    })

    test("Description not replaced if use suggested box unticked", async ({ page }) => {
      await page.goto("http://project-331.local/")
      await page.getByRole("link", { name: "Manage course 'Description" }).click()
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await page.getByRole("textbox", { name: "AI generated description" }).click()
      await page.getByRole("textbox", { name: "AI generated description" }).press("ControlOrMeta+a")
      await page.getByTestId("container-suggested-description").getByRole("checkbox").click()
      await page
        .getByRole("textbox", { name: "AI generated description" })
        .fill("should not be visible")
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Replace metadata" }).click()
      })
      await expect(page.getByText("should not be visible")).toHaveCount(0)
    })
  })

  test.describe("Course prerequisites generation", () => {
    test("Teacher can generate and add suggested prerequisites", async ({ page }) => {
      await page.goto(
        "http://project-331.local/manage/courses/84d392c8-3d44-4109-bff1-938fec5cd642/overview",
      )
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Replace metadata" }).click()
      })
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await waitForSpinnersToDisappear(page)
      await expect(
        page.getByRole("listitem").filter({ hasText: "No hard prerequisites" }),
      ).toBeVisible()
      await expect(
        page
          .getByRole("listitem")
          .filter({ hasText: "Linux operating systems and web development experience are useful" }),
      ).toBeVisible()
    })

    test("Teacher can add new prerequisite", async ({ page }) => {
      await page.goto(
        "http://project-331.local/manage/courses/84d392c8-3d44-4109-bff1-938fec5cd642/overview",
      )
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await page.getByRole("button", { name: "Add new prerequisite" }).click()
      await page.getByRole("textbox", { name: "Prerequisite 3" }).fill("this should be visible")
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Replace metadata" }).click()
      })
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await page.getByRole("heading", { name: "Suggested metadata" }).waitFor()
      await waitForSpinnersToDisappear(page)
      await expect(page.getByText("this should be visible")).toBeVisible()
    })

    test("Teacher can remove suggested prerequisite", async ({ page }) => {
      await page.goto(
        "http://project-331.local/manage/courses/84d392c8-3d44-4109-bff1-938fec5cd642/overview",
      )
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await page
        .getByRole("textbox", { name: "Prerequisite 2" })
        .fill("this should be not be visible")
      await page.getByRole("button", { name: "Remove" }).nth(1).click()
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Replace metadata" }).click()
      })
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await expect(page.getByText("this should be not be visible")).toHaveCount(0)
    })

    test("No duplicate prerequisites added", async ({ page }) => {
      await page.goto(
        "http://project-331.local/manage/courses/84d392c8-3d44-4109-bff1-938fec5cd642/overview",
      )
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Replace metadata" }).click()
      })
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Replace metadata" }).click()
      })
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await waitForSpinnersToDisappear(page)
      await expect(page.getByText("No hard prerequisites")).toHaveCount(1)
    })

    test("Prerequisites not added if use suggested unticked", async ({ page }) => {
      await page.goto(
        "http://project-331.local/manage/courses/84d392c8-3d44-4109-bff1-938fec5cd642/overview",
      )
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await page.getByRole("textbox", { name: "Prerequisite 1" }).click()
      await page.getByRole("textbox", { name: "Prerequisite 1" }).fill("should not be added")
      await page.getByRole("textbox", { name: "Prerequisite 2" }).click()
      await page.getByRole("textbox", { name: "Prerequisite 2" }).press("ControlOrMeta+a")
      await page.getByRole("textbox", { name: "Prerequisite 2" }).fill("you dont see me")
      await page.getByTestId("container-suggested-prerequisites").getByRole("checkbox").click()
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Replace metadata" }).click()
      })
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await waitForSpinnersToDisappear(page)
      await expect(page.getByText("should not be added")).toHaveCount(0)
      await expect(page.getByText("you dont see me")).toHaveCount(0)
    })

    test("Old prerequisites are replaced", async ({ page }) => {
      await page.goto(
        "http://project-331.local/manage/courses/84d392c8-3d44-4109-bff1-938fec5cd642/overview",
      )
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Replace metadata" }).click()
      })
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await page.getByRole("textbox", { name: "Prerequisite 1" }).click()
      await page.getByRole("textbox", { name: "Prerequisite 1" }).press("ControlOrMeta+a")
      await page.getByRole("textbox", { name: "Prerequisite 1" }).fill("this replaces")
      await page.getByRole("textbox", { name: "Prerequisite 2" }).click()
      await page.getByRole("textbox", { name: "Prerequisite 2" }).press("ControlOrMeta+a")
      await page.getByRole("textbox", { name: "Prerequisite 2" }).fill("test")
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Replace metadata" }).click()
      })
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await waitForSpinnersToDisappear(page)
      await expect(page.getByText("No hard prerequisites")).toHaveCount(0)
      await expect(
        page.getByText("Linux operating systems and web development experience are useful"),
      ).toHaveCount(0)
      await expect(page.getByText("this replaces")).toBeVisible()
      await expect(page.getByText("test")).toBeVisible()
    })
  })

  test.describe("Course audience generation", () => {
    test("Teacher can generate and add suggested audiences", async ({ page }) => {
      await page.goto(
        "http://project-331.local/manage/courses/84d392c8-3d44-4109-bff1-938fec5cd642/overview",
      )
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Replace metadata" }).click()
      })
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await waitForSpinnersToDisappear(page)
      await expect(page.getByRole("listitem").filter({ hasText: "everyone" })).toBeVisible()
    })

    test("Teacher can add new audience", async ({ page }) => {
      await page.goto(
        "http://project-331.local/manage/courses/84d392c8-3d44-4109-bff1-938fec5cd642/overview",
      )
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await page.getByRole("button", { name: "Add new audience" }).click()
      await page.getByRole("textbox", { name: "Audience 2" }).fill("this should be visible")
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Replace metadata" }).click()
      })
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await page.getByRole("heading", { name: "Suggested metadata" }).waitFor()
      await waitForSpinnersToDisappear(page)
      await expect(page.getByText("this should be visible")).toBeVisible()
    })

    test("Teacher can remove suggested audience", async ({ page }) => {
      await page.goto(
        "http://project-331.local/manage/courses/84d392c8-3d44-4109-bff1-938fec5cd642/overview",
      )
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await page.getByRole("textbox", { name: "Audience 1" }).fill("this should be not be visible")
      await page.getByRole("button", { name: "Remove" }).nth(2).click()
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Replace metadata" }).click()
      })
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await waitForSpinnersToDisappear(page)
      await expect(
        page.getByRole("listitem").filter({ hasText: "this should be not be visible" }),
      ).toHaveCount(0)
    })

    test("No duplicate audiences added", async ({ page }) => {
      await page.goto(
        "http://project-331.local/manage/courses/84d392c8-3d44-4109-bff1-938fec5cd642/overview",
      )
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Replace metadata" }).click()
      })
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Replace metadata" }).click()
      })
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await waitForSpinnersToDisappear(page)
      await expect(page.getByRole("listitem").filter({ hasText: "everyone" })).toHaveCount(1)
    })

    test("Audiences not added if use suggested unticked", async ({ page }) => {
      await page.goto(
        "http://project-331.local/manage/courses/84d392c8-3d44-4109-bff1-938fec5cd642/overview",
      )
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await page.getByRole("textbox", { name: "Audience" }).click()
      await page.getByRole("textbox", { name: "Audience" }).fill("not here")
      await page.getByRole("button", { name: "Add new audience" }).click()
      await page.getByRole("textbox", { name: "Audience 2" }).click()
      await page.getByRole("textbox", { name: "Audience 2" }).fill("not visible")
      await page.getByTestId("container-suggested-audiences").getByRole("checkbox").click()
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Replace metadata" }).click()
      })
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await waitForSpinnersToDisappear(page)
      await expect(page.getByText("not here")).toHaveCount(0)
      await expect(page.getByText("not visible")).toHaveCount(0)
    })

    test("Old audiences are replaced", async ({ page }) => {
      await page.goto(
        "http://project-331.local/manage/courses/84d392c8-3d44-4109-bff1-938fec5cd642/overview",
      )
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Replace metadata" }).click()
      })
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await page.getByRole("textbox", { name: "Audience 1" }).click()
      await page.getByRole("textbox", { name: "Audience 1" }).press("ControlOrMeta+a")
      await page.getByRole("textbox", { name: "Audience 1" }).fill("this replaces")
      await waitForSuccessNotification(page, async () => {
        await page.getByRole("button", { name: "Replace metadata" }).click()
      })
      await page.getByRole("button", { name: "Suggest metadata" }).click()
      await waitForSpinnersToDisappear(page)
      await expect(page.getByRole("listitem").filter({ hasText: "everyone" })).toHaveCount(0)
      await expect(page.getByText("this replaces")).toBeVisible()
    })
  })
})
