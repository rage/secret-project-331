import { expect, test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
import waitForFunction from "../../../utils/waitForFunction"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("test quizzes essay feedback", async ({ headless, page }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(),
    await page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  expect(page.url()).toBe("http://project-331.local/org/uh-cs")

  await Promise.all([
    page.waitForNavigation(),
    page.click(`[aria-label="Navigate to course 'Introduction to everything'"]`),
  ])

  await selectCourseInstanceIfPrompted(page)

  await Promise.all([page.waitForNavigation(), page.click("text=The Basics")])
  expect(page.url()).toBe(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1",
  )

  await Promise.all([page.waitForNavigation(), page.click("text=Page 3")])
  expect(page.url()).toBe(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/page-3",
  )

  // page has a frame that pushes all the content down after loafing, so let's wait for it to load first
  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe")
    }),
  )

  if (!frame) {
    throw new Error("Could not find frame")
  }

  await frame.waitForSelector("text=write an essay")

  await frame.fill(
    `textarea:below(:text("Min words"))`,
    `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin quis orci nec augue bibendum lobortis. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Sed venenatis, purus in venenatis rutrum, turpis velit fermentum libero, eu eleifend elit purus id arcu. Sed sodales velit id mauris auctor, at tempor urna maximus. Aenean vulputate pellentesque mollis. In lacinia malesuada orci, ac tincidunt metus tempor ac. Morbi porta posuere nisi, in fringilla lacus ultricies pulvinar.

    Suspendisse vitae feugiat est. Nulla ex tortor, feugiat et ipsum vel, dapibus congue quam. Ut justo augue, dignissim id diam vel, tincidunt bibendum libero. Nam dignissim nibh in purus finibus porta. Aliquam egestas risus non vulputate egestas. Nam vel posuere neque. Nunc ut commodo orci, et rutrum risus. Pellentesque eleifend consequat ultricies. Integer nulla massa, pharetra non augue sit amet, pulvinar finibus orci. Suspendisse gravida sagittis lacinia.

    Mauris sed volutpat est. Sed pharetra a turpis at hendrerit. Donec nibh enim, tincidunt eu porta id, placerat a orci. Proin porttitor tristique mattis. Curabitur facilisis sapien sed lorem dignissim pulvinar. Mauris egestas, lacus ac mattis pretium, purus sapien posuere turpis, nec tristique lectus leo non risus. Aliquam erat volutpat. Proin ac tempus sem, id facilisis augue. Vivamus vel elit ultrices magna pretium finibus sed in quam. Curabitur urna arcu, porta ut interdum id, ullamcorper non arcu. Proin in mauris ante. Maecenas lobortis maximus dolor, nec lacinia tellus.`,
  )

  await page.click(`button:text-is("Submit")`)

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "essay-feedback",
    waitForThisToBeVisibleAndStable: `text=This is an extra submit message from the teacher.`,
    beforeScreenshot: async () => {
      await (await frame.frameElement()).scrollIntoViewIfNeeded()
    },
    toMatchSnapshotOptions: { threshold: 0.4 },
  })
})
