import type { MyCreditRegistration } from "@/generated/api/types.generated"

import type { CreditRegistrationTFunction } from "../constants"
import {
  NEED_A_NEW_LINK,
  registrationSupportMail,
  studentNumberLinkSupportMail,
} from "../studentSupportMail"

// Renders each key with its interpolations appended, so the values reaching the mail are visible.
const t = ((key: string, params?: Record<string, unknown>) =>
  Object.entries(params ?? {}).reduce(
    (text, [name, value]) => `${text} ${name}=${String(value)}`,
    key,
  )) as unknown as CreditRegistrationTFunction

const registration = (overrides: Partial<MyCreditRegistration> = {}): MyCreditRegistration =>
  ({
    id: "registration-1",
    course_name: "Introduction to Programming",
    course_module_name: "Part 2",
    student_facing_status: "failed",
    error_code: "misregistered",
    student_number: "900000901",
    ...overrides,
  }) as MyCreditRegistration

describe("registrationSupportMail", () => {
  test("carries what support needs to find the row without asking the student for it", () => {
    const mail = registrationSupportMail(t, registration())

    expect(mail.subject).toContain("course=Introduction to Programming")
    expect(mail.bodyLines.join("\n")).toContain("reference=registration-1")
    expect(mail.bodyLines.join("\n")).toContain("part=Part 2")
    expect(mail.bodyLines.join("\n")).toContain("studentNumber=900000901")
    expect(mail.reference).toBe("registration-1")
  })

  test("leaves out the lines it has no value for", () => {
    const mail = registrationSupportMail(
      t,
      registration({ course_module_name: null, student_number: null, error_code: null }),
    )
    const body = mail.bodyLines.join("\n")

    expect(body).not.toContain("support-mail-line-course-part")
    expect(body).not.toContain("support-mail-line-student-number")
    expect(body).not.toContain("support-mail-line-reason")
  })
})

describe("studentNumberLinkSupportMail", () => {
  test("asks for what the student is stuck on", () => {
    const mail = studentNumberLinkSupportMail(t, NEED_A_NEW_LINK)

    expect(mail.bodyLines).toContain("support-mail-line-need-a-new-confirmation-link")
    expect(mail.reference).toBeUndefined()
  })

  test("quotes the number when there is one to quote", () => {
    const mail = studentNumberLinkSupportMail(t, "linked_to_another_account", "900000101")

    expect(mail.bodyLines.join("\n")).toContain("studentNumber=900000101")
    expect(mail.reference).toBe("900000101")
  })
})
