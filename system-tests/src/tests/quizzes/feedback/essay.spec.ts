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
    `very hard essay about big data, by the guy who runs the NSA:

    There's also the whole myth that the Pentagon is more or less listening in on all sorts of communications, the things that are really important to US national security. What's so hard about this? It's because this is the very heart of US national security at the moment. A US president can no longer stand the kind of military, intelligence, financial muscle that was used to send US citizens to war zones. If we don't do something about it, then we have one of the world's worst privacy problems. It is also one of the very least-privileged parts of our society. The other problem that makes things difficult is the fact that there doesn't seem to be a big effort in Washington or at the NSA to solve the problem.

    To put the Pentagon in the context of the Pentagon on steroids: "The Pentagon is the most militarized bureaucracy in the history of the planet." The National Security Council and the intelligence community should not make things more difficult for their citizens. To quote,

    It has come to light that at least 75% of the staff is out of job. The US government has an astounding 75%, a total of 75%. The vast majority of US military personnel are not considered at all active members of the Army or Navy. That is not to say that the Navy is not also in conflict. The vast majority of their personnel have served in combat. There are more`,
  )

  await page.click("text=Submit")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "essay-feedback",
    waitForThisToBeVisibleAndStable: `text=your submit has been answered`,
    toMatchSnapshotOptions: { threshold: 0.4 },
  })
})
