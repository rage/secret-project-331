import type { EnrolmentCheckGroup } from "@/generated/api/types.generated"

/** A row only ever moves to a later group, so this is also the reading order for a group column. */
export const ENROLMENT_CHECK_GROUP_ORDER: readonly EnrolmentCheckGroup[] = [
  "completed",
  "visited",
  "check_requested",
]

/** `None` sorts last: it means the ladder ran out, which reads as further along than any step. */
export const byGroupThenStep = <T extends { enrolment_check_group: EnrolmentCheckGroup }>(
  step: (row: T) => number | null | undefined,
) => {
  return (a: T, b: T): number => {
    const groupOrder =
      ENROLMENT_CHECK_GROUP_ORDER.indexOf(a.enrolment_check_group) -
      ENROLMENT_CHECK_GROUP_ORDER.indexOf(b.enrolment_check_group)
    if (groupOrder !== 0) {
      return groupOrder
    }
    const stepA = step(a)
    const stepB = step(b)
    if (stepA === null || stepA === undefined) {
      return stepB === null || stepB === undefined ? 0 : 1
    }
    if (stepB === null || stepB === undefined) {
      return -1
    }
    return stepA - stepB
  }
}
