import { expect, test } from "@playwright/test"

import { scrollToLocatorsParentIframeAndClick, getExerciseTaskFrame } from "@/utils/iframeLocators"
import waitForSpinnersToDisappear from "@/utils/waitForSpinnersToDisappear"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("Exercise score updates gradually", async ({ page }) => {
  await page.goto(
    "http://project-331.local/org/uh-cs/courses/advanced-exercise-states/chapter-1/complicated-exercise",
  )
  await selectCourseInstanceIfPrompted(page)
  await page.getByText("First question.").waitFor()
  await page.getByText("Second question.").waitFor()
  await page.getByText("Third question.").waitFor()
  await expect(page.getByTestId("exercise-points")).toContainText("0/3")

  await scrollToLocatorsParentIframeAndClick(
    getExerciseTaskFrame(page, 1).getByRole("checkbox", { name: "Correct", exact: true }),
  )
  await scrollToLocatorsParentIframeAndClick(
    getExerciseTaskFrame(page, 2).getByRole("checkbox", { name: "Correct", exact: true }),
  )
  await scrollToLocatorsParentIframeAndClick(
    getExerciseTaskFrame(page, 3).getByRole("checkbox", { name: "Incorrect" }),
  )
  await page.getByRole("button", { name: "Submit" }).click()
  await waitForSpinnersToDisappear(page)
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
  await expect(page.getByTestId("exercise-points")).toContainText("2/3")

  await page.getByRole("button", { name: "Try again" }).click()
  await scrollToLocatorsParentIframeAndClick(
    getExerciseTaskFrame(page, 1).getByRole("checkbox", { name: "Incorrect" }),
  )
  await scrollToLocatorsParentIframeAndClick(
    getExerciseTaskFrame(page, 2).getByRole("checkbox", { name: "Incorrect" }),
  )
  await scrollToLocatorsParentIframeAndClick(
    getExerciseTaskFrame(page, 3).getByRole("checkbox", { name: "Correct", exact: true }),
  )
  await page.getByRole("button", { name: "Submit" }).click()
  await waitForSpinnersToDisappear(page)
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
  // Points should stay the same since previous answer was more correct
  await expect(page.getByTestId("exercise-points")).toContainText("2/3")

  await page.getByRole("button", { name: "Try again" }).click()
  await scrollToLocatorsParentIframeAndClick(
    getExerciseTaskFrame(page, 1).getByRole("checkbox", { name: "Correct", exact: true }),
  )
  await scrollToLocatorsParentIframeAndClick(
    getExerciseTaskFrame(page, 2).getByRole("checkbox", { name: "Correct", exact: true }),
  )
  await scrollToLocatorsParentIframeAndClick(
    getExerciseTaskFrame(page, 3).getByRole("checkbox", { name: "Correct", exact: true }),
  )
  await page.getByRole("button", { name: "Submit" }).click()
  await waitForSpinnersToDisappear(page)
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
  await expect(page.getByTestId("exercise-points")).toContainText("3/3")
})
