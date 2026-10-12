import { randomUUID } from "crypto"

import type { Locator, Page } from "@playwright/test"

import accessibilityCheck from "@/utils/accessibilityCheck"
import { ORIGIN } from "@/utils/creditRegistration"
import {
  type AdminExternalCreditTarget,
  adminExternalCreditTargetUrl,
  creditRegistrationCourseStats,
  externalCreditTargetPayload,
} from "@/utils/creditRegistrationAdmin"
import {
  MOOCFI_PAUSED_COMPLETION_ID,
  MOOCFI_PAUSED_RAW_GRADE,
  MOOCFI_PAUSED_REGISTRATION_ID,
  MOOCFI_PAUSED_TARGET_ID,
  MOOCFI_PAUSED_TARGET_NAME,
  MOOCFI_STUDENT_3,
} from "@/utils/mockMoocfi"
import { ADMIN_STORAGE_STATE, expect, testThatCanFail as test } from "@/utils/nonBlockingTest"

/**
 * Creates its own targets on a fresh mooc.fi course id per run, and only reads the seeded paused
 * target, whose pending row `moocfi-student-page.spec.ts` reads too.
 */
test.use({ storageState: ADMIN_STORAGE_STATE })

const DASHBOARD_URL = `${ORIGIN}/manage/credit-registration`
const COURSES_URL = `${DASHBOARD_URL}/courses`
const REGISTRATIONS_URL = `${DASHBOARD_URL}/registrations`

const COURSES_TABLE = "Modules with credit registration on"
const REASON = "System test"

/** The cutoff the form is given, typed into its year segment onwards: 2025-01-01 02:00 in Helsinki. */
const CUTOFF_SEGMENTS = "202501010200"

interface TargetFields {
  moocfiCourseId: string
  name: string
  courseCode: string
  lowestTier: number
  highestTier: number
}

const coursesTable = (page: Page): Locator => page.getByRole("table", { name: COURSES_TABLE })

const targetRow = (page: Page, name: string): Locator =>
  coursesTable(page)
    .getByRole("row")
    .filter({ hasText: `mooc.fi: ${name}` })

const openAddDialog = async (page: Page, fields: TargetFields): Promise<Locator> => {
  await page.getByRole("button", { name: "Add mooc.fi course" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("textbox", { name: "mooc.fi course id" }).fill(fields.moocfiCourseId)
  await dialog.getByRole("textbox", { name: "mooc.fi course slug" }).fill("system-test-course")
  await dialog.getByRole("textbox", { name: "Name" }).fill(fields.name)
  await dialog.getByRole("textbox", { name: "Language code" }).fill("fi-FI")
  await dialog
    .getByRole("textbox", { name: "University of Helsinki course code" })
    .fill(fields.courseCode)
  await dialog.getByRole("spinbutton", { name: "ECTS credits" }).fill("5")
  await dialog.getByRole("spinbutton", { name: "Lowest tier" }).fill(String(fields.lowestTier))
  await dialog.getByRole("spinbutton", { name: "Highest tier" }).fill(String(fields.highestTier))
  // Every target of one mooc.fi course must share the cutoff, so the form's default of now will not do.
  await dialog.getByRole("spinbutton", { name: "year, Cutoff (Helsinki time)" }).click()
  await page.keyboard.type(CUTOFF_SEGMENTS)
  await dialog.getByRole("textbox", { name: "Reason" }).fill(REASON)
  return dialog
}

const pausedTarget = async (page: Page): Promise<AdminExternalCreditTarget> => {
  const target = (await creditRegistrationCourseStats(page.request)).credit_units.find(
    (unit) => unit.external_credit_target?.id === MOOCFI_PAUSED_TARGET_ID,
  )?.external_credit_target
  if (!target) {
    throw new Error("The seeded paused target is missing from the Courses tab.")
  }
  return target
}

const openRowAction = async (page: Page, name: string, action: string): Promise<void> => {
  await targetRow(page, name)
    .getByRole("button", { name: `Actions for mooc.fi: ${name}` })
    .click()
  await page.getByRole("menuitem", { name: action }).click()
}

test("A mooc.fi course is added, edited, paused, resumed and deleted on the Courses tab", async ({
  page,
}) => {
  const moocfiCourseId = randomUUID()
  const suffix = moocfiCourseId.slice(0, 8)
  const intermediate = `System test intermediate ${suffix}`
  const advanced = `System test advanced ${suffix}`
  const courseCode = `CRS-SYSTEST-${suffix}`

  await page.goto(COURSES_URL)
  await expect(coursesTable(page)).toBeVisible()

  await test.step("Adding a target puts it in the table, off until enabled", async () => {
    const dialog = await openAddDialog(page, {
      moocfiCourseId,
      name: intermediate,
      courseCode,
      lowestTier: 2,
      highestTier: 2,
    })
    await accessibilityCheck(page, "Add mooc.fi course dialog")
    await dialog.getByRole("button", { name: "Save" }).click()
    await expect(dialog).toHaveCount(0)
    await expect(targetRow(page, intermediate)).toBeVisible()
    await expect(targetRow(page, intermediate).getByText("Off", { exact: true })).toBeVisible()
  })

  await test.step("Overlapping tiers are a field error, and fixing them saves", async () => {
    const dialog = await openAddDialog(page, {
      moocfiCourseId,
      name: advanced,
      courseCode: `${courseCode}-ADV`,
      lowestTier: 2,
      highestTier: 3,
    })
    await dialog.getByRole("button", { name: "Save" }).click()
    await expect(
      dialog.getByText("These tiers overlap another target of the same mooc.fi course."),
    ).toBeVisible()

    await dialog.getByRole("spinbutton", { name: "Lowest tier" }).fill("3")
    await dialog.getByRole("button", { name: "Save" }).click()
    await expect(dialog).toHaveCount(0)
    await expect(targetRow(page, advanced)).toBeVisible()
  })

  await test.step("A course code the mooc.fi course already registers is a field error", async () => {
    const dialog = await openAddDialog(page, {
      moocfiCourseId,
      name: `System test duplicate ${suffix}`,
      courseCode,
      lowestTier: 4,
      highestTier: 4,
    })
    await dialog.getByRole("button", { name: "Save" }).click()
    await expect(
      dialog.getByText("This mooc.fi course already has a target with this course code."),
    ).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(dialog).toHaveCount(0)
  })

  const renamed = `${intermediate} renamed`

  await test.step("Editing saves the new configuration", async () => {
    await openRowAction(page, intermediate, "Edit")
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("textbox", { name: "Name" }).fill(renamed)
    await dialog.getByRole("textbox", { name: "Reason" }).fill(REASON)
    await dialog.getByRole("button", { name: "Save" }).click()
    await expect(dialog).toHaveCount(0)
    await expect(targetRow(page, renamed)).toBeVisible()
  })

  await test.step("Pausing and resuming show on the row", async () => {
    await openRowAction(page, renamed, "Pause")
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("textbox", { name: "Reason" }).fill(REASON)
    await dialog.getByRole("button", { name: "Pause" }).click()
    await expect(targetRow(page, renamed).getByText("Paused", { exact: true })).toBeVisible()

    await openRowAction(page, renamed, "Resume")
    await page.getByRole("button", { name: "Yes" }).click()
    await expect(targetRow(page, renamed).getByText("Paused", { exact: true })).toHaveCount(0)
  })

  await test.step("Deleting takes the target out of the table", async () => {
    await openRowAction(page, advanced, "Delete")
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("textbox", { name: "Reason" }).fill(REASON)
    await dialog.getByRole("button", { name: "Delete" }).click()
    await expect(targetRow(page, advanced)).toHaveCount(0)
    await expect(targetRow(page, renamed)).toBeVisible()
  })
})

test("The cutoff of a target with registrations cannot change", async ({ page }) => {
  await page.goto(COURSES_URL)
  await openRowAction(page, MOOCFI_PAUSED_TARGET_NAME, "Edit")
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("Fixed: the course already has registrations.")).toBeVisible()
  await page.keyboard.press("Escape")

  const target = await pausedTarget(page)
  const movedCutoff = new Date(Date.parse(target.delegated_at) + 60 * 60 * 1000).toISOString()
  const refused = await page.request.put(adminExternalCreditTargetUrl(target.id), {
    data: { ...externalCreditTargetPayload(target, REASON), delegated_at: movedCutoff },
  })
  expect(refused.status()).toBe(422)
  expect(await refused.text()).toContain(
    "The cutoff cannot change once the target has registrations.",
  )

  expect((await pausedTarget(page)).delegated_at).toBe(target.delegated_at)
})

test("A mooc.fi registration is listed in the Registrations tab and its detail shows the mooc.fi completion", async ({
  page,
}) => {
  await page.goto(
    `${REGISTRATIONS_URL}?course_id=${MOOCFI_PAUSED_TARGET_ID}&include_not_started=true`,
  )
  const row = page
    .getByRole("table", { name: "Registrations" })
    .getByRole("row")
    .filter({ hasText: MOOCFI_STUDENT_3.email })
  await expect(row).toBeVisible()
  await expect(row.getByText(`mooc.fi: ${MOOCFI_PAUSED_TARGET_NAME}`)).toBeVisible()

  await page.goto(`${REGISTRATIONS_URL}/${MOOCFI_PAUSED_REGISTRATION_ID}`)
  const block = page.getByRole("region", { name: "mooc.fi completion" })
  await expect(block).toBeVisible()
  await expect(block.getByText(MOOCFI_PAUSED_COMPLETION_ID)).toBeVisible()
  await expect(block.getByText(MOOCFI_PAUSED_RAW_GRADE)).toBeVisible()
  await expect(block.getByText("Last read from mooc.fi")).toBeVisible()
  await expect(block.getByText("Not yet")).toBeVisible()
  await accessibilityCheck(page, "Credit registration admin mooc.fi detail")
})
