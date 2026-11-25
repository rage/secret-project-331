import { v4 } from "uuid"

import { adminSaveExternalCreditTargetCodes } from "@/generated/api/sdk.generated"
import type {
  AdminExternalCreditTargetCodePayload,
  ExternalCreditTargetCode,
  ExternalGrading,
} from "@/generated/api/types.generated"

/** The prerequisite select's value for a code without one. */
export const NO_PREREQUISITE = "none"

/** One Sisu course row of the dialog. */
export interface CodeFields {
  /** The code's id: a saved code's, or a new one under which the save adds the code. */
  id: string
  name: string
  uh_course_code: string
  minimum_tier: number | null
  ects_credits: number | null
  grading: ExternalGrading
  enrolment_link: string
  /** The `id` of another row, or `NO_PREREQUISITE`. */
  prerequisite_code_id: string
  equivalent_course_codes: string[]
  equivalent_draft: string
}

export const emptyCodeFields = (): CodeFields => ({
  id: v4(),
  name: "",
  uh_course_code: "",
  minimum_tier: null,
  ects_credits: null,
  grading: "pass_fail",
  enrolment_link: "",
  prerequisite_code_id: NO_PREREQUISITE,
  equivalent_course_codes: [],
  equivalent_draft: "",
})

export const codeFieldsFrom = (code: ExternalCreditTargetCode): CodeFields => ({
  id: code.id,
  name: code.name,
  uh_course_code: code.uh_course_code,
  minimum_tier: code.minimum_tier ?? null,
  ects_credits: code.ects_credits,
  grading: code.grading,
  enrolment_link: code.enrolment_link ?? "",
  prerequisite_code_id: code.prerequisite_code_id ?? NO_PREREQUISITE,
  equivalent_course_codes: code.equivalent_course_codes,
  equivalent_draft: "",
})

/** `row`'s equivalent codes with its unsaved draft added, unless it is blank or already listed. */
export const withDraftEquivalent = (row: CodeFields): string[] => {
  const draft = row.equivalent_draft.trim()
  return draft === "" || row.equivalent_course_codes.includes(draft)
    ? row.equivalent_course_codes
    : [...row.equivalent_course_codes, draft]
}

const toPayload = (row: CodeFields): AdminExternalCreditTargetCodePayload => {
  const enrolmentLink = row.enrolment_link.trim()
  return {
    id: row.id,
    name: row.name,
    uh_course_code: row.uh_course_code.trim(),
    minimum_tier: row.minimum_tier,
    ects_credits: row.ects_credits ?? 0,
    grading: row.grading,
    enrolment_link: enrolmentLink === "" ? null : enrolmentLink,
    equivalent_course_codes: withDraftEquivalent(row),
    prerequisite_code_id:
      row.prerequisite_code_id === NO_PREREQUISITE ? null : row.prerequisite_code_id,
  }
}

/** Saves the rows as the target's codes in one request; a saved code without a row is deleted. */
export const saveTargetCodes = async (
  targetId: string,
  rows: readonly CodeFields[],
  reason: string,
): Promise<void> => {
  await adminSaveExternalCreditTargetCodes({
    path: { external_credit_target_id: targetId },
    body: { codes: rows.map((row) => toPayload(row)), reason },
  })
}
