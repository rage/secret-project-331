import { randomUUID } from "crypto"

import type { Locator, Page } from "@playwright/test"

import accessibilityCheck from "@/utils/accessibilityCheck"
import { Select } from "@/utils/components/Select"
import { ORIGIN } from "@/utils/creditRegistration"
import {
  ADMIN_EXTERNAL_CREDIT_TARGETS_URL,
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

/** Not the rows' "Name shown to students". */
const TARGET_NAME_LABEL = /^Name(?! shown)/

/** The cutoff the form is given, typed into its year segment onwards: 2025-01-01 02:00 in Helsinki. */
const CUTOFF_SEGMENTS = "202501010200"

interface TargetFields {
  moocfiCourseId: string
  name: string
}

interface SisuCourseFields {
  name: string
  courseCode: string
  minimumTier: number
}

const coursesTable = (page: Page): Locator => page.getByRole("table", { name: COURSES_TABLE })

/** Every row of the target, one per Sisu course code. */
const targetRows = (page: Page, name: string): Locator =>
  coursesTable(page)
    .getByRole("row")
    .filter({ hasText: `mooc.fi: ${name}` })

const courseCodeRow = (page: Page, name: string, courseCode: string): Locator =>
  targetRows(page, name).filter({ hasText: courseCode })

const sisuCourseRows = (dialog: Locator): Locator =>
  dialog.getByRole("group").filter({ has: dialog.getByRole("button", { name: "Remove course" }) })

const fillSisuCourse = async (
  dialog: Locator,
  index: number,
  fields: SisuCourseFields,
): Promise<void> => {
  const row = sisuCourseRows(dialog).nth(index)
  await row
    .getByRole("textbox", { name: "University of Helsinki course code" })
    .fill(fields.courseCode)
  await row.getByRole("textbox", { name: "Name shown to students" }).fill(fields.name)
  await row.getByRole("textbox", { name: "Minimum tier" }).fill(String(fields.minimumTier))
  await row.getByRole("textbox", { name: "ECTS credits" }).fill("5")
}

const openAddDialog = async (page: Page, fields: TargetFields): Promise<Locator> => {
  await page.getByRole("button", { name: "Add mooc.fi course" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("textbox", { name: "mooc.fi course id" }).fill(fields.moocfiCourseId)
  await dialog.getByRole("textbox", { name: "mooc.fi course slug" }).fill("system-test-course")
  await dialog.getByRole("textbox", { name: TARGET_NAME_LABEL }).fill(fields.name)
  await dialog.getByRole("textbox", { name: "Language code" }).fill("fi-FI")
  // Every target of one mooc.fi course must share the cutoff, so the form's default of now will not do.
  // Focused, not clicked: a click opens the calendar, which then takes the typing.
  await dialog.getByRole("spinbutton", { name: "year, Cutoff (Helsinki time)" }).focus()
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
  await targetRows(page, name)
    .first()
    .getByRole("button", { name: `Actions for mooc.fi: ${name}` })
    .click()
  await page.getByRole("menuitem", { name: action }).click()
}

test("A mooc.fi course and its Sisu courses are added, edited, paused, resumed and deleted on the Courses tab", async ({
  page,
}) => {
  const moocfiCourseId = randomUUID()
  const suffix = moocfiCourseId.slice(0, 8)
  const targetName = `System test course ${suffix}`
  const intermediate: SisuCourseFields = {
    name: `System test intermediate ${suffix}`,
    courseCode: `CRS-SYSTEST-${suffix}`,
    minimumTier: 2,
  }
  const advanced: SisuCourseFields = {
    name: `System test advanced ${suffix}`,
    courseCode: `CRS-SYSTEST-${suffix}-ADV`,
    minimumTier: 3,
  }
  const extra: SisuCourseFields = {
    name: `System test extra ${suffix}`,
    courseCode: `CRS-SYSTEST-${suffix}-EXTRA`,
    minimumTier: 4,
  }
  const olderEquivalent = `AY-SYSTEST-${suffix}`

  await page.goto(COURSES_URL)
  await expect(coursesTable(page)).toBeVisible()

  await test.step("Adding a target with two Sisu courses puts a row for each in the table, off until enabled", async () => {
    const dialog = await openAddDialog(page, { moocfiCourseId, name: targetName })
    await fillSisuCourse(dialog, 0, intermediate)
    await dialog.getByRole("button", { name: "Add a Sisu course" }).click()
    await fillSisuCourse(dialog, 1, advanced)
    await Select.labelled(page, "Requires", sisuCourseRows(dialog).nth(1)).chooseOption(
      `${intermediate.courseCode}, ${intermediate.name}`,
    )
    await accessibilityCheck(page, "Add mooc.fi course dialog")
    await dialog.getByRole("button", { name: "Save" }).click()
    await expect(dialog).toHaveCount(0)

    await expect(targetRows(page, targetName)).toHaveCount(2)
    const intermediateRow = courseCodeRow(page, targetName, intermediate.courseCode)
    await expect(intermediateRow.getByText("From tier 2", { exact: true })).toBeVisible()
    await expect(intermediateRow.getByText("Off", { exact: true })).toBeVisible()
    await expect(
      courseCodeRow(page, targetName, advanced.courseCode).getByText(
        `From tier 3, requires ${intermediate.courseCode}`,
      ),
    ).toBeVisible()
  })

  await test.step("A course code used twice is a field error, and fixing it saves", async () => {
    await openRowAction(page, targetName, "Edit")
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: "Add a Sisu course" }).click()
    await fillSisuCourse(dialog, 2, { ...extra, courseCode: intermediate.courseCode })
    await dialog.getByRole("textbox", { name: "Reason" }).fill(REASON)
    await dialog.getByRole("button", { name: "Save" }).click()
    await expect(
      dialog.getByText("This mooc.fi course already has a target with this course code.").first(),
    ).toBeVisible()

    await sisuCourseRows(dialog)
      .nth(2)
      .getByRole("textbox", { name: "University of Helsinki course code" })
      .fill(extra.courseCode)
    await dialog.getByRole("button", { name: "Save" }).click()
    await expect(dialog).toHaveCount(0)
    await expect(targetRows(page, targetName)).toHaveCount(3)
  })

  await test.step("An older equivalent code is added as a chip and kept", async () => {
    await openRowAction(page, targetName, "Edit")
    const dialog = page.getByRole("dialog")
    const row = sisuCourseRows(dialog).nth(0)
    await row.getByRole("textbox", { name: "Add a code" }).fill(olderEquivalent)
    await row.getByRole("button", { name: "Add", exact: true }).click()
    await expect(row.getByRole("button", { name: `Remove ${olderEquivalent}` })).toBeVisible()
    await dialog.getByRole("textbox", { name: "Reason" }).fill(REASON)
    await dialog.getByRole("button", { name: "Save" }).click()
    await expect(dialog).toHaveCount(0)

    await openRowAction(page, targetName, "Edit")
    await expect(
      page.getByRole("dialog").getByRole("button", { name: `Remove ${olderEquivalent}` }),
    ).toBeVisible()
    await page.keyboard.press("Escape")
  })

  await test.step("Removing a Sisu course takes its row out of the table", async () => {
    await openRowAction(page, targetName, "Edit")
    const dialog = page.getByRole("dialog")
    await sisuCourseRows(dialog).nth(2).getByRole("button", { name: "Remove course" }).click()
    await dialog.getByRole("textbox", { name: "Reason" }).fill(REASON)
    await dialog.getByRole("button", { name: "Save" }).click()
    await expect(dialog).toHaveCount(0)
    await expect(targetRows(page, targetName)).toHaveCount(2)
    await expect(courseCodeRow(page, targetName, extra.courseCode)).toHaveCount(0)
  })

  const renamed = `${targetName} renamed`

  await test.step("Editing saves the new configuration", async () => {
    await openRowAction(page, targetName, "Edit")
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("textbox", { name: TARGET_NAME_LABEL }).fill(renamed)
    await dialog.getByRole("textbox", { name: "Reason" }).fill(REASON)
    await dialog.getByRole("button", { name: "Save" }).click()
    await expect(dialog).toHaveCount(0)
    await expect(targetRows(page, renamed)).toHaveCount(2)
  })

  await test.step("Pausing and resuming show on the rows", async () => {
    await openRowAction(page, renamed, "Pause")
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("textbox", { name: "Reason" }).fill(REASON)
    await dialog.getByRole("button", { name: "Pause" }).click()
    await expect(
      courseCodeRow(page, renamed, intermediate.courseCode).getByText("Paused", { exact: true }),
    ).toBeVisible()

    await openRowAction(page, renamed, "Resume")
    await page.getByRole("button", { name: "Yes" }).click()
    await expect(
      courseCodeRow(page, renamed, intermediate.courseCode).getByText("Paused", { exact: true }),
    ).toHaveCount(0)
  })

  await test.step("Deleting takes the target out of the table", async () => {
    await openRowAction(page, renamed, "Delete")
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("textbox", { name: "Reason" }).fill(REASON)
    await dialog.getByRole("button", { name: "Delete" }).click()
    await expect(targetRows(page, renamed)).toHaveCount(0)
  })
})

test("A mooc.fi course with no Sisu courses stays in the table so some can be added", async ({
  page,
}) => {
  const suffix = randomUUID().slice(0, 8)
  const name = `System test empty course ${suffix}`
  const created = await page.request.post(ADMIN_EXTERNAL_CREDIT_TARGETS_URL, {
    data: {
      moocfi_course_id: randomUUID(),
      moocfi_course_slug: "system-test-empty-course",
      name,
      language_code: "fi-FI",
      delegated_at: "2025-01-01T00:00:00Z",
      enabled: false,
      reason: REASON,
    },
  })
  expect(created.ok()).toBe(true)

  await page.goto(COURSES_URL)
  const row = targetRows(page, name)
  await expect(row).toHaveCount(1)
  await expect(row.getByText("Add a Sisu course to this course in the edit dialog.")).toBeVisible()

  await openRowAction(page, name, "Edit")
  const dialog = page.getByRole("dialog")
  await expect(sisuCourseRows(dialog)).toHaveCount(0)
  await page.keyboard.press("Escape")

  await openRowAction(page, name, "Delete")
  await page.getByRole("dialog").getByRole("textbox", { name: "Reason" }).fill(REASON)
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click()
  await expect(targetRows(page, name)).toHaveCount(0)
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
