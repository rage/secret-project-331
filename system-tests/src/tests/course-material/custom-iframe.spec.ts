import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("test", async ({ page, headless }, testInfo) => {
  // Mock response from example.com so that the test does not actually make a request there
  await page.route("https://example.com/iframe", (route) =>
    route.fulfill({
      status: 200,
      body: `<body><style> body { background-color: black; color: white; font-family: "Arial"; } </style><h1>Example domain</h1><p>This is a mocked response from example.com.</p></body>`,
    }),
  )
  await page.goto("http://project-331.local/")
  await page
    .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
    .click()
  await page.getByRole("link", { name: "Manage course 'Permission management'" }).click()
  await page.getByRole("tab", { name: "Pages" }).click()
  await page.getByRole("button", { name: "New page" }).nth(1).click()
  await page.getByLabel("Title  *").click()
  await page.getByLabel("Title  *").fill("Iframe Page")
  await page.getByRole("button", { name: "Create" }).click()
  await page
    .getByRole("row", { name: "Iframe Page /chapter-1/iframe-page Edit page Dropdown menu" })
    .getByRole("button", { name: "Edit page" })
    .click()
  await page.getByRole("button", { name: "Add block" }).click()
  await page.getByPlaceholder("Search").fill("iframe")
  await page.getByRole("option", { name: "Iframe" }).click()
  await page.getByLabel("URL / source").click()
  await page
    .getByLabel("URL / source")
    .fill(
      '<br /><iframe src="https://example.com/iframe"></frame><script src="https://example.com/script.js"></script>',
    )
  await page.getByRole("button", { name: "Parse" }).click()

  await page.getByRole("button", { name: "Edit" }).waitFor()
  await page.getByText("https://example.com/iframe").waitFor()
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await page.getByText("Operation successful!").waitFor()
  await page.goto(
    "http://project-331.local/org/uh-cs/courses/permission-management/chapter-1/iframe-page",
  )
  await selectCourseInstanceIfPrompted(page)
  const iFrameHeadingLocator = page
    .frameLocator('iframe[title="iframe"]')
    .getByRole("heading", { name: "Example Domain" })
  await expectScreenshotsToMatchSnapshots({
    headless,
    testInfo,
    screenshotTarget: page,
    snapshotName: "custom-iframe",
    waitForTheseToBeVisibleAndStable: [iFrameHeadingLocator],
    // The arial font used in the iframe has small differences on different machines
    screenshotOptions: { maxDiffPixelRatio: 0.05 },
  })
})
