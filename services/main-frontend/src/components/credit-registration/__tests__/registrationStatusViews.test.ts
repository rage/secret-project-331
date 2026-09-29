import { ALL_REGISTRATION_STATUSES } from "../creditRegistrationCopy"
import type { RegistrationStatusView } from "../registrationStatusViews"
import { registrationStatusesOf } from "../registrationStatusViews"

// The segments `CourseCreditRegistrationSummaryPanel` sums a module's `registration_count` from.
// The other views (`everyone`, `needs_attention`, `needs_student_number`) cut across these on
// purpose and are excluded here.
const PARTITION_VIEWS: RegistrationStatusView[] = [
  "registered",
  "in_progress",
  "waiting_on_student",
  "failed",
  "not_registering",
]

describe("registrationStatusesOf", () => {
  test("every status falls in exactly one partition view, matching the backend's own counts", () => {
    for (const status of ALL_REGISTRATION_STATUSES) {
      const covering = PARTITION_VIEWS.filter((view) =>
        registrationStatusesOf(view).includes(status),
      )
      expect(covering).toHaveLength(1)
    }
  })

  test("groups a course-setup block with not_registering, as the summary panel's count does", () => {
    expect(registrationStatusesOf("not_registering")).toContain("waiting_for_course_setup")
  })
})
