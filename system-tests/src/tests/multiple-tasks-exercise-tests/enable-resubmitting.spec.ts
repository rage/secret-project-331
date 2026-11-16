import { test } from "@playwright/test"

import { selectOrganization } from "@/utils/organizationUtils"
import { waitForLocatorToBeStable } from "@/utils/waitForLocatorToBeStable"
import waitForSpinnersToDisappear from "@/utils/waitForSpinnersToDisappear"

import { ChapterSelector } from "../../utils/components/ChapterSelector"
import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import {
  scrollLocatorsParentIframeToViewIfNeeded,
  getExerciseTaskIframe,
} from "../../utils/iframeLocators"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("quizzes, after wrong answer modify only the incorrect choice and resubmit", async ({
  page,
}) => {
  await page.goto("http://project-331.local/organizations")
  await selectOrganization(page, "University of Helsinki, Department of Computer Science")
  await page.getByRole("link", { name: "Advanced exercise states", exact: true }).click()
  await selectCourseInstanceIfPrompted(page)
  const chapterSelector = new ChapterSelector(page)
  await chapterSelector.clickChapter(1)
  await page.getByRole("link", { name: "12 Complicated quizzes exercise page" }).click()
  await page.locator(`text=First question.`).waitFor()
  await page.locator(`text=Second question.`).waitFor()
  await page.locator(`text=Third question.`).waitFor()

  await scrollLocatorsParentIframeToViewIfNeeded(
    getExerciseTaskIframe(page, 1).contentFrame().getByRole("button", { name: "Incorrect" }),
  )
  await getExerciseTaskIframe(page, 1)
    .contentFrame()
    .getByRole("button", { name: "Correct" })
    .first()
    .click()
  await getExerciseTaskIframe(page, 2)
    .contentFrame()
    .getByRole("button", { name: "Correct" })
    .first()
    .click()
  await scrollLocatorsParentIframeToViewIfNeeded(
    getExerciseTaskIframe(page, 3).contentFrame().getByRole("button", { name: "Incorrect" }),
  )
  await getExerciseTaskIframe(page, 3)
    .contentFrame()
    .getByRole("button", { name: "Incorrect" })
    .click()

  await page.getByRole("button", { name: "Submit" }).click()
  await waitForSpinnersToDisappear(page)
  await page.getByText("Try again").waitFor()
  await getExerciseTaskIframe(page, 1)
    .contentFrame()
    .getByText("Correct", { exact: true })
    .first()
    .waitFor({ state: "attached" })
  await getExerciseTaskIframe(page, 2)
    .contentFrame()
    .getByText("Correct", { exact: true })
    .first()
    .waitFor({ state: "attached" })
  await getExerciseTaskIframe(page, 3)
    .contentFrame()
    .getByText("Correct", { exact: true })
    .first()
    .waitFor({ state: "attached" })

  await page.locator(`text=First question.`).waitFor()
  await page.locator(`text=Second question.`).waitFor()
  await page.locator(`text=Third question.`).waitFor()

  const tryAgainButton = page.getByRole("button", { name: "try again" })
  // The quiz above is still re-rendering, which can shift the button mid-click. Wait for it to
  // stop moving (without scrolling) just before clicking.
  await waitForLocatorToBeStable(tryAgainButton)
  await tryAgainButton.click()
  await scrollLocatorsParentIframeToViewIfNeeded(
    getExerciseTaskIframe(page, 3).contentFrame().getByRole("button", { name: "Correct" }).nth(2),
  )
  await getExerciseTaskIframe(page, 3)
    .contentFrame()
    .getByRole("button", { name: "Correct" })
    .nth(2)
    .click()

  await page.locator(`text=First question.`).waitFor()
  await page.locator(`text=Second question.`).waitFor()
  await page.locator(`text=Third question.`).waitFor()

  await page.getByRole("button", { name: "Submit" }).click()
  await page.locator(`text=First question.`).waitFor()
  await page.locator(`text=Second question.`).waitFor()
  await page.locator(`text=Third question.`).waitFor()
})
