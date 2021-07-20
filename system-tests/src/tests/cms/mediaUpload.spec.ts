import {
  expect,
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  test,
} from "@playwright/test"

test.describe("Uploading media as admin", async () => {
  // As Admin
  test.use({
    storageState: "src/states/admin@example.com.json",
  })

  test.beforeEach(
    async ({
      page,
    }: PlaywrightTestArgs &
      PlaywrightTestOptions &
      PlaywrightWorkerArgs &
      PlaywrightWorkerOptions) => {
      // Executed before each test
      await page.goto("http://project-331.local")
    },
  )

  test("test", async ({ page }) => {
    await page.click("text=University of Helsinki, Department of Computer Science")
    expect(page.url().startsWith("http://project-331.local/organizations/")).toBe(true)

    await page.click("text=Manage")
    expect(page.url().startsWith("http://project-331.local/manage/courses/")).toBe(true)

    await Promise.all([
      page.waitForNavigation(/*{ url: 'http://project-331.local/cms/courses/912d7b3c-816c-43e3-bce6-488f06c10869/manage-pages' }*/),
      page.click("text=Manage pages"),
    ])

    await page.click("text=Welcome to Introduction to Everything")
    expect(page.url().startsWith("http://project-331.local/cms/pages/")).toBe(true)

    // Click text=Type / to choose a block and type /image
    await page.type("text=Type / to choose a block", "/image")
    // Click :nth-match(:text("Image"), 2)
    await page.click(':nth-match(:text("Image"), 2)')

    // Upload file with fileChooser
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.click('button:has-text("Upload")'),
    ])
    await fileChooser.setFiles("src/fixtures/media/welcome_exercise_decorations.png")

    // This is needed so we get another Gutenberg popup "disabled".
    await page.click('img[alt="Add alt"]')
    await page.click("text=Replace")

    // Click on the anchor with following class that has a child svg[role=img]
    // This will probably fail in the future if the anchor classes change in Gutenberg
    const [newPage] = await Promise.all([
      page.waitForEvent("popup"),
      page.click(
        "a[class='components-external-link block-editor-link-control__search-item-title'] >> svg[role=img]",
      ),
    ])
    const screenshot = await newPage.screenshot()
    expect(screenshot).toMatchSnapshot(`uploadMediaPicture.png`, { threshold: 0.2 })
  })
})
