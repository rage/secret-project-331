import { test } from "@playwright/test"

import expectScreenshotsToMatchSnapshots from "../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Configuring certificates works", async ({ page, headless }, testInfo) => {
  // go to config page
  await page.goto("http://project-331.local/organizations")
  await page
    .getByRole("link", { name: "University of Helsinki, Department of Computer Science" })
    .click()
  await page.getByRole("link", { name: "Manage course 'Certificates'" }).click()
  await page.getByRole("tab", { name: "Course instances" }).click()
  await page.getByRole("link", { name: "Manage certificates (Default)" }).click()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "management-page",
  })

  // create certificate with cancel and confirm on save
  await page
    .getByRole("listitem")
    .filter({
      hasText: "Module: Another module",
    })
    .getByRole("button", { name: "Create certificate configuration" })
    .click()
  await page.getByRole("button", { name: "Cancel" }).click()
  await page
    .getByRole("listitem")
    .filter({
      hasText: "Module: Another module",
    })
    .getByRole("button", { name: "Create certificate configuration" })
    .click()
  await page.locator("input[name=backgroundSvg]").setInputFiles({
    name: "background.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg version="1.1" width="300" height="200" xmlns="http://www.w3.org/2000/svg"> <text x="150" y="125" font-size="60" text-anchor="middle" fill="white">SVG</text> </svg>',
    ),
  })
  await page.getByRole("button", { name: "Save" }).click()

  // disable/enable generating certs with confirmation dialog
  page.once("dialog", (dialog) => {
    dialog.accept()
  })
  await page
    .getByRole("listitem")
    .filter({
      hasText: "Module: Another module",
    })
    .getByRole("button", { name: "Enable generating certificates" })
    .click()
  page.once("dialog", (dialog) => {
    dialog.accept()
  })
  await page
    .getByRole("listitem")
    .filter({
      hasText: "Module: Another module",
    })
    .getByRole("button", { name: "Disable generating certificates" })
    .click()

  // edit with cancel and save
  await page
    .getByRole("listitem")
    .filter({
      hasText: "Module: Another module",
    })
    .getByRole("button", { name: "Edit" })
    .click()
  await expectScreenshotsToMatchSnapshots({
    screenshotTarget: page,
    headless,
    testInfo,
    snapshotName: "editing-config",
    scrollToYCoordinate: 800,
    // wait for the Cancel button to be visible to ensure the form has rendered completely
    waitForTheseToBeVisibleAndStable: [page.getByText("Cancel")],
    clearNotifications: true,
  })
  await page
    .getByRole("listitem")
    .filter({
      hasText: "Module: Another module",
    })
    .getByRole("button", { name: "Save" })
    .click()

  // delete with confirm
  page.once("dialog", (dialog) => {
    dialog.accept()
  })
  await page
    .getByRole("listitem")
    .filter({
      hasText: "Module: Another module",
    })
    .getByRole("button", { name: "Delete" })
    .click()
})
