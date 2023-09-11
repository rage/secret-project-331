import { expect, test } from "@playwright/test"
import { mkdtemp, readdir, readFile, stat } from "fs/promises"
import { tmpdir } from "os"
import path from "path"
import tar from "tar-fs"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("Test course export", async ({ page }) => {
  await test.step("Upload an image to be backed up", async () => {
    await page.goto("http://project-331.local/")
    await page
      .getByLabel("University of Helsinki, Department of Mathematics and Statistics")
      .click()
    await page.getByLabel("Manage course 'Change path'").click()
    await page.getByRole("tab", { name: "Pages" }).click()
    await page
      .getByRole("row", { name: "Page 4 /chapter-1/page-4 Edit page Dropdown menu" })
      .getByRole("button")
      .first()
      .click()
    await page.getByLabel("Add block").click()
    await page.getByRole("option", { name: "Image" }).click()
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: "Upload" }).click(),
    ])
    await fileChooser.setFiles("src/fixtures/media/welcome_exercise_decorations.png")
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await page.getByText("Operation successful").waitFor()
  })

  await test.step("Export the course", async () => {
    await page.goto("http://project-331.local/")
    await page
      .getByLabel("University of Helsinki, Department of Mathematics and Statistics")
      .click()
    await page.getByLabel("Manage course 'Change path'").click()
    await page.goto(
      "http://project-331.local/cms/courses/c783777b-426e-4cfd-9a5f-4a36b2da503a/export",
    )
    await page.getByRole("heading", { name: "Export" }).waitFor()
    const downloadPromise = page.waitForEvent("download")
    await page.getByRole("button", { name: "Export all pages" }).click()
    const download = await downloadPromise
    const readStream = await download.createReadStream()
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (readStream === null) {
      throw new Error("Could not download file")
    }
    const tempDir = await mkdtemp(path.join(tmpdir(), `test-page-export-`))
    const stream = readStream.pipe(tar.extract(tempDir))
    await new Promise((resolve, reject) => {
      stream.on("finish", resolve)
      stream.on("error", reject)
    })
    const allFiles = []
    const toVisit = [tempDir]
    while (toVisit.length > 0) {
      const current = toVisit.pop()
      // eslint-disable-next-line playwright/no-conditional-in-test
      if (current === undefined) {
        break
      }
      const files = await readdir(current)
      for (const file of files) {
        const fullPath = path.join(current, file)
        const stats = await stat(fullPath)
        // eslint-disable-next-line playwright/no-conditional-in-test
        if (stats.isDirectory()) {
          toVisit.push(fullPath)
        } else {
          allFiles.push(fullPath.replace(`${tempDir}/`, ""))
        }
      }
    }

    const expectedFiles = [
      "pages/chapter-1.json",
      "pages/chapter-2.json",
      "pages/chapter-3.json",
      "pages/chapter-4.json",
      "pages/chapter-5.json",
      "pages/chapter-6.json",
      "pages/chapter-7.json",
      "pages/chapter-8.json",
      "pages/glossary.json",
      "pages/hidden.json",
      "pages/index.json",
      "pages/welcome.json",
      "pages/chapter-2/intro.json",
      "pages/chapter-1/complicated-exercise.json",
      "pages/chapter-1/complicated-quizzes-exercise.json",
      "pages/chapter-1/page-1.json",
      "pages/chapter-1/page-2.json",
      "pages/chapter-1/page-3.json",
      "pages/chapter-1/page-4.json",
      "pages/chapter-1/page-5.json",
      "pages/chapter-1/page-6.json",
      "pages/chapter-1/scale.json",
      "pages/chapter-1/the-multiple-choice-with-feedback.json",
      "pages/chapter-1/the-timeline.json",
      "pages/chapter-1/vector.json",
    ]
    // should contain all files
    expect(allFiles).toStrictEqual(expect.arrayContaining(expectedFiles))
    // Validate one of the files
    const chapter6 = await readFile(`${tempDir}/pages/chapter-6.json`, "utf-8")
    const chapter6Json = JSON.parse(chapter6)
    expect(chapter6Json).toBeInstanceOf(Array)
    for (const item of chapter6Json) {
      expect(item).toHaveProperty("name")
    }

    // The png that we updloaded at the beginning of the test should be there, too
    const pngFile = allFiles.find((file) => file.endsWith(".png"))
    // validate that the image is really png on the disk
    const pngFileContent = await readFile(`${tempDir}/${pngFile}`)
    expect(pngFileContent[0]).toBe(0x89)
  })
})
