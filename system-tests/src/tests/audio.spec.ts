import { expect, test } from "@playwright/test"

import { ChapterSelector } from "../utils/components/ChapterSelector"
import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"

import accessibilityCheck from "@/utils/accessibilityCheck"
import { selectOrganization } from "@/utils/organizationUtils"
test.use({
  storageState: "src/states/teacher@example.com.json",
})

test.describe("Audio player accessibility", () => {
  test("Can upload audio files to pages", async ({ page }) => {
    await page.goto("http://project-331.local/")
    await page.getByRole("link", { name: "All organizations" }).click()
    await selectOrganization(
      page,
      "University of Helsinki, Department of Mathematics and Statistics",
    )
    await page.getByLabel("Manage course 'Audio course'").click()
    await page.getByRole("tab", { name: "Pages" }).click()
    await page
      .getByRole("row", { name: "The Basics /chapter-1 Edit" })
      .getByLabel("Dropdown menu")
      .click()
    await page.getByRole("button", { name: "Upload audio file" }).click()
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.locator("#audioFile").click(),
    ])
    await fileChooser.setFiles("src/fixtures/media/audio.ogg")
    await page.getByRole("button", { name: "Upload" }).click()
    await page.getByText("Success").first().waitFor()
    await page.getByText("audio/ogg").waitFor()

    // Test that the player is there
    await page.goto("http://project-331.local/org/uh-mathstat/courses/audio-course")
    await selectCourseInstanceIfPrompted(page)
    const chapterSelector = new ChapterSelector(page)
    await chapterSelector.clickChapter(1)
    await page.getByRole("button", { name: "Listen" }).click()
    await page.getByText("00:00").first().waitFor()
  })

  test("Audio player accessibility - focus management and accessible names", async ({ page }) => {
    await page.goto("http://project-331.local/org/uh-mathstat/courses/audio-course")
    await selectCourseInstanceIfPrompted(page)
    const chapterSelector = new ChapterSelector(page)
    await chapterSelector.clickChapter(1)

    const listenButton = page.getByRole("button", { name: "Listen" })
    await listenButton.waitFor()

    await test.step("Focus moves to play button when dialog opens", async () => {
      await listenButton.focus()
      await expect(listenButton).toBeFocused()
      await listenButton.click()

      const dialog = page.getByRole("dialog", { name: "Audio player" })
      await dialog.waitFor()
      const toolbar = dialog.getByRole("toolbar", { name: "Audio player" })
      const playButton = toolbar.getByRole("button", { name: "Play", exact: true })
      await playButton.waitFor()
      await expect(playButton).toBeFocused()
    })

    const dialog = page.getByRole("dialog", { name: "Audio player" })
    await dialog.waitFor()
    const toolbar = dialog.getByRole("toolbar", { name: "Audio player" })

    await test.step("All controls have accessible names", async () => {
      await expect(dialog).toBeVisible()

      const rewindButton = toolbar.getByRole("button", { name: "Rewind 15 seconds", exact: true })
      await expect(rewindButton).toBeVisible()

      const playPauseButton = toolbar.getByRole("button", { name: "Play", exact: true })
      await expect(playPauseButton).toBeVisible()

      const fastForwardButton = toolbar.getByRole("button", {
        name: "Fast forward 15 seconds",
        exact: true,
      })
      await expect(fastForwardButton).toBeVisible()

      const muteButton = dialog.getByRole("button", { name: "Mute audio", exact: true })
      await expect(muteButton).toBeVisible()

      const volumeSlider = dialog.getByRole("slider", { name: "Volume", exact: true })
      await expect(volumeSlider).toBeVisible()

      const closeButton = dialog.getByRole("button", { name: "Close audio player", exact: true })
      await expect(closeButton).toBeVisible()
    })

    await test.step("Play/pause button accessible name changes with state", async () => {
      const playPauseButton = toolbar.getByRole("button", { name: "Play", exact: true })
      await expect(playPauseButton).toHaveAttribute("aria-label", "Play")

      await playPauseButton.click()
      const pauseButton = toolbar.getByRole("button", { name: "Pause", exact: true })
      await expect(pauseButton).toHaveAttribute("aria-label", "Pause")

      await pauseButton.click()
      const playButtonAgain = toolbar.getByRole("button", { name: "Play", exact: true })
      await expect(playButtonAgain).toHaveAttribute("aria-label", "Play")
    })

    await test.step("Mute button accessible name changes with state", async () => {
      const muteButton = dialog.getByRole("button", { name: "Mute audio", exact: true })
      await expect(muteButton).toHaveAttribute("aria-label", "Mute audio")

      await muteButton.click()
      const unmuteButton = dialog.getByRole("button", { name: "Unmute audio", exact: true })
      await expect(unmuteButton).toHaveAttribute("aria-label", "Unmute audio")

      await unmuteButton.click()
      const muteButtonAgain = dialog.getByRole("button", { name: "Mute audio", exact: true })
      await expect(muteButtonAgain).toHaveAttribute("aria-label", "Mute audio")
    })

    await test.step("Progress bar has accessible name", async () => {
      const progressBar = dialog.getByRole("slider", {
        name: "Seek playback position",
        exact: true,
      })
      await expect(progressBar).toBeVisible()
      await expect(progressBar).toHaveAttribute("aria-label", "Seek playback position")
    })

    await test.step("Toolbar has accessible label", async () => {
      await expect(toolbar).toBeVisible()
    })

    await test.step("Keyboard navigation through controls", async () => {
      const playButton = toolbar.getByRole("button", { name: "Play", exact: true })
      await playButton.focus()
      await expect(playButton).toBeFocused()

      await page.keyboard.press("Shift+Tab")
      const rewindButton = toolbar.getByRole("button", { name: "Rewind 15 seconds", exact: true })
      await expect(rewindButton).toBeFocused()

      await page.keyboard.press("Tab")
      await expect(playButton).toBeFocused()

      await page.keyboard.press("Tab")
      const fastForwardButton = toolbar.getByRole("button", {
        name: "Fast forward 15 seconds",
        exact: true,
      })
      await expect(fastForwardButton).toBeFocused()

      await page.keyboard.press("Tab")
      const muteButton = dialog.getByRole("button", { name: "Mute audio", exact: true })
      await expect(muteButton).toBeFocused()

      await page.keyboard.press("Tab")
      const volumeSlider = dialog.getByRole("slider", { name: "Volume", exact: true })
      await expect(volumeSlider).toBeFocused()

      await page.keyboard.press("Tab")
      const closeButton = dialog.getByRole("button", { name: "Close audio player", exact: true })
      await expect(closeButton).toBeFocused()
    })

    await accessibilityCheck(page, "Audio player dialog")
  })
})
