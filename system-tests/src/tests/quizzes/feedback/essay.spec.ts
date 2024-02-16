import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../../utils/courseMaterialActions"
import { getLocatorForNthExerciseServiceIframe } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("quizzes essay feedback", async ({ page, headless }, testInfo) => {
  await page.goto("http://project-331.local/organizations")

  await Promise.all([
    await page.getByText("University of Helsinki, Department of Computer Science").click(),
  ])
  await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

  await page.click(`[aria-label="Navigate to course 'Introduction to everything'"]`)

  await selectCourseInstanceIfPrompted(page)

  await page.getByText("The Basics").click()
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1",
  )

  await page.locator(`a:has-text("Page 3")`).waitFor()
  await page.click(`a:has-text("Page 3")`)
  await expect(page).toHaveURL(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/page-3",
  )

  // page has a frame that pushes all the content down after loading, so let's wait for it to load first
  const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await frame.getByText("write an essay").waitFor()

  await frame.locator("textarea")
    .fill(`Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin quis orci nec augue bibendum lobortis. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Sed venenatis, purus in venenatis rutrum, turpis velit fermentum libero, eu eleifend elit purus id arcu. Sed sodales velit id mauris auctor, at tempor urna maximus. Aenean vulputate pellentesque mollis. In lacinia malesuada orci, ac tincidunt metus tempor ac. Morbi porta posuere nisi, in fringilla lacus ultricies pulvinar.

  Suspendisse vitae feugiat est. Nulla ex tortor, feugiat et ipsum vel, dapibus congue quam. Ut justo augue, dignissim id diam vel, tincidunt bibendum libero. Nam dignissim nibh in purus finibus porta. Aliquam egestas risus non vulputate egestas. Nam vel posuere neque. Nunc ut commodo orci, et rutrum risus. Pellentesque eleifend consequat ultricies. Integer nulla massa, pharetra non augue sit amet, pulvinar finibus orci. Suspendisse gravida sagittis lacinia.

  Mauris sed volutpat est. Sed pharetra a turpis at hendrerit. Donec nibh enim, tincidunt eu porta id, placerat a orci. Proin porttitor tristique mattis. Curabitur facilisis sapien sed lorem dignissim pulvinar. Mauris egestas, lacus ac mattis pretium, purus sapien posuere turpis, nec tristique lectus leo non risus. Aliquam erat volutpat. Proin ac tempus sem, id facilisis augue. Vivamus vel elit ultrices magna pretium finibus sed in quam. Curabitur urna arcu, porta ut interdum id, ullamcorper non arcu. Proin in mauris ante. Maecenas lobortis maximus dolor, nec lacinia tellus.`)

  await page.click(`button:text-is("Submit")`)

  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "essay-feedback",
    waitForTheseToBeVisibleAndStable: [
      page.locator(`text=This is an extra submit message from the teacher.`),
      frame,
    ],
  })
})
