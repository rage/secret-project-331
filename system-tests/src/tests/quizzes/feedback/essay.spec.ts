import { expect, test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
import waitForFunction from "../../../utils/waitForFunction"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("test", async ({ headless, page }) => {
  // Go to http://project-331.local/
  await page.goto("http://project-331.local/")

  // Click text=University of Helsinki, Department of Computer Science
  await Promise.all([
    page.waitForNavigation(),
    await page.click("text=University of Helsinki, Department of Computer Science"),
  ])
  expect(page.url()).toBe("http://project-331.local/org/uh-cs")

  await Promise.all([page.waitForNavigation(), page.click("text=Introduction to everything")])

  await page.click('label:has-text("default")')

  // Click button:has-text("Continue")
  await page.click('button:has-text("Continue")')

  await Promise.all([page.waitForNavigation(), await page.click("text=The Basics")])
  expect(page.url()).toBe(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1",
  )

  await Promise.all([page.waitForNavigation(), await page.click("text=Page 3")])
  expect(page.url()).toBe(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/page-3",
  )

  // page has a frame that pushes all the content down after loafing, so let's wait for it to load first
  const frame = await waitForFunction(page, () =>
    page.frames().find((f) => {
      return f.url().startsWith("http://project-331.local/quizzes/iframe")
    }),
  )

  await frame.waitForSelector("text=write an essay")

  await frame.fill(
    `textarea:below(:text("Word count"))`,
    `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Laoreet sit amet cursus sit amet dictum sit. Et tortor consequat id porta nibh. Nibh sit amet commodo nulla facilisi nullam vehicula ipsum. Maecenas ultricies mi eget mauris pharetra et ultrices neque ornare. Ultrices in iaculis nunc sed augue lacus viverra vitae congue. Egestas maecenas pharetra convallis posuere morbi leo urna. Tortor at auctor urna nunc id cursus metus aliquam eleifend. Vel eros donec ac odio tempor orci dapibus ultrices in. Ut diam quam nulla porttitor massa id neque aliquam. Egestas pretium aenean pharetra magna ac placerat vestibulum. Eu lobortis elementum nibh tellus molestie nunc non blandit. Euismod in pellentesque massa placerat duis. Non odio euismod lacinia at quis. Gravida quis blandit turpis cursus in hac. Odio facilisis mauris sit amet massa vitae tortor condimentum. In mollis nunc sed id semper risus in hendrerit gravida. Nunc sed blandit libero volutpat sed cras ornare. Augue mauris augue neque gravida in fermentum et sollicitudin ac.

  Elit at imperdiet dui accumsan. Sit amet nisl suscipit adipiscing bibendum est ultricies. Mauris rhoncus aenean vel elit. Consequat ac felis donec et odio. Tortor pretium viverra suspendisse potenti nullam ac. Aenean pharetra magna ac placerat vestibulum. Vel quam elementum pulvinar etiam non quam lacus suspendisse faucibus. Ut sem nulla pharetra diam sit amet. Amet cursus sit amet dictum sit amet justo donec enim. Massa eget egestas purus viverra. Mattis vulputate enim nulla aliquet porttitor lacus luctus. Nunc mi ipsum faucibus vitae aliquet nec. Risus sed vulputate odio ut enim blandit volutpat. Sodales ut eu sem integer vitae justo eget magna fermentum. Ut morbi tincidunt augue interdum velit euismod in pellentesque. Diam donec adipiscing tristique risus nec feugiat in fermentum posuere.

  Malesuada fames ac turpis egestas sed tempus. Enim tortor at auctor urna nunc id. Consectetur a erat nam at lectus. Nec nam aliquam sem et tortor consequat id porta. Suspendisse faucibus interdum posuere lorem ipsum dolor. Mauris augue neque gravida in fermentum et sollicitudin. Quam viverra orci sagittis eu. Scelerisque eleifend donec pretium vulputate sapien nec. Enim nec dui nunc mattis enim ut. Neque egestas congue quisque egestas. Eget nunc lobortis mattis aliquam faucibus purus. Pellentesque sit amet porttitor eget dolor morbi. Dictum varius duis at consectetur lorem donec.

  Morbi tristique senectus et netus et malesuada fames ac turpis. Sollicitudin ac orci phasellus egestas tellus rutrum tellus. Facilisis volutpat est velit egestas dui id ornare. Nisl nisi scelerisque eu ultrices vitae auctor eu augue. Elementum facilisis leo vel fringilla est ullamcorper eget nulla. Scelerisque purus semper eget duis at tellus at urna condimentum. Gravida dictum fusce ut placerat orci nulla pellentesque. Curabitur vitae nunc sed velit dignissim sodales. Magna fermentum iaculis eu non. Tincidunt id aliquet risus feugiat in ante metus dictum at. Augue eget arcu dictum varius. Aliquet eget sit amet tellus cras adipiscing enim eu turpis.`,
  )

  await expectScreenshotsToMatchSnapshots({
    frame,
    headless,
    snapshotName: "essay-feedback",
    waitForThisToBeVisibleAndStable: `text=write an essay`,
    toMatchSnapshotOptions: { threshold: 0.4 },
  })
})
