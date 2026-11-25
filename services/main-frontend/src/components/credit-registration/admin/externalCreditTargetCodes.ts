import {
  adminCreateExternalCreditTargetCode,
  adminDeleteExternalCreditTargetCode,
  adminUpdateExternalCreditTargetCode,
} from "@/generated/api/sdk.generated"
import type {
  AdminExternalCreditTargetCodePayload,
  ExternalCreditTargetCode,
  ExternalGrading,
} from "@/generated/api/types.generated"

export const NO_PREREQUISITE = "none"

/** Thrown when the rows' prerequisites lead round in a circle, so no save order exists. */
export class CircularPrerequisitesError extends Error {}

/** One Sisu course row of the dialog. */
export interface CodeFields {
  /** Identifies the row among its siblings before it has an id: the code's id once saved. */
  key: string
  savedId: string | null
  name: string
  uh_course_code: string
  minimum_tier: number | null
  ects_credits: number | null
  grading: ExternalGrading
  enrolment_link: string
  /** The `key` of another row, or `NO_PREREQUISITE`. */
  prerequisite_key: string
  equivalent_course_codes: string[]
  equivalent_draft: string
}

export const emptyCodeFields = (): CodeFields => ({
  key: crypto.randomUUID(),
  savedId: null,
  name: "",
  uh_course_code: "",
  minimum_tier: null,
  ects_credits: null,
  grading: "pass_fail",
  enrolment_link: "",
  prerequisite_key: NO_PREREQUISITE,
  equivalent_course_codes: [],
  equivalent_draft: "",
})

export const codeFieldsFrom = (code: ExternalCreditTargetCode): CodeFields => ({
  key: code.id,
  savedId: code.id,
  name: code.name,
  uh_course_code: code.uh_course_code,
  minimum_tier: code.minimum_tier ?? null,
  ects_credits: code.ects_credits,
  grading: code.grading,
  enrolment_link: code.enrolment_link ?? "",
  prerequisite_key: code.prerequisite_code_id ?? NO_PREREQUISITE,
  equivalent_course_codes: code.equivalent_course_codes,
  equivalent_draft: "",
})

const toPayload = (
  row: CodeFields,
  prerequisiteCodeId: string | null,
  reason: string,
): AdminExternalCreditTargetCodePayload => {
  const draft = row.equivalent_draft.trim()
  const equivalents =
    draft === "" || row.equivalent_course_codes.includes(draft)
      ? row.equivalent_course_codes
      : [...row.equivalent_course_codes, draft]
  return {
    name: row.name,
    uh_course_code: row.uh_course_code.trim(),
    minimum_tier: row.minimum_tier,
    ects_credits: row.ects_credits ?? 0,
    grading: row.grading,
    enrolment_link: row.enrolment_link.trim() === "" ? null : row.enrolment_link.trim(),
    equivalent_course_codes: equivalents,
    prerequisite_code_id: prerequisiteCodeId,
    reason,
  }
}

interface SaveCodesArgs {
  targetId: string
  rows: readonly CodeFields[]
  removedIds: readonly string[]
  reason: string
  onCreated: (key: string, id: string) => void
  onDeleted: (id: string) => void
}

/**
 * Brings the target's codes in line with the rows, one request per change.
 *
 * Saved rows go first with only the prerequisites that already exist, so a code that loses a
 * dependent can then be deleted. New rows follow in prerequisite order, and a saved row that
 * requires a new row is updated last.
 */
export const saveTargetCodes = async ({
  targetId,
  rows,
  removedIds,
  reason,
  onCreated,
  onDeleted,
}: SaveCodesArgs): Promise<void> => {
  const idByKey = new Map<string, string>()
  for (const row of rows) {
    if (row.savedId) {
      idByKey.set(row.key, row.savedId)
    }
  }
  const prerequisiteId = (row: CodeFields): string | null =>
    idByKey.get(row.prerequisite_key) ?? null
  const updateRow = (row: CodeFields, prerequisiteCodeId: string | null) =>
    adminUpdateExternalCreditTargetCode({
      path: {
        external_credit_target_id: targetId,
        external_credit_target_code_id: row.savedId as string,
      },
      body: toPayload(row, prerequisiteCodeId, reason),
    })

  const savedRows = rows.filter((row) => row.savedId)
  const deferred = savedRows.filter(
    (row) => row.prerequisite_key !== NO_PREREQUISITE && prerequisiteId(row) === null,
  )
  for (const row of savedRows) {
    await updateRow(row, prerequisiteId(row))
  }

  for (const id of removedIds) {
    await adminDeleteExternalCreditTargetCode({
      path: {
        external_credit_target_id: targetId,
        external_credit_target_code_id: id,
      },
      body: { reason },
    })
    onDeleted(id)
  }

  let pending = rows.filter((row) => !row.savedId)
  while (pending.length > 0) {
    const ready = pending.filter(
      (row) => row.prerequisite_key === NO_PREREQUISITE || idByKey.has(row.prerequisite_key),
    )
    if (ready.length === 0) {
      throw new CircularPrerequisitesError()
    }
    for (const row of ready) {
      const id = await adminCreateExternalCreditTargetCode({
        path: { external_credit_target_id: targetId },
        body: toPayload(row, prerequisiteId(row), reason),
      })
      idByKey.set(row.key, id)
      onCreated(row.key, id)
    }
    pending = pending.filter((row) => !idByKey.has(row.key))
  }

  for (const row of deferred) {
    await updateRow(row, prerequisiteId(row))
  }
}
