"use client"

import "@testing-library/jest-dom"
import { resetLocalTimeZone, setLocalTimeZone } from "@internationalized/date"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { ReactNode } from "react"

import { updateGeneratedCertificate } from "@/generated/api/sdk.generated"

import { CertificatesTabContent } from "../CertificatesTab"

// Stable t() to avoid an infinite render loop from the global i18next mock's unstable identity.
jest.mock("react-i18next", () => {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- must live inside the mock factory
  const t = (key: string) => key
  return { useTranslation: () => ({ t, i18n: { changeLanguage: () => Promise.resolve() } }) }
})

jest.mock("@/generated/api/sdk.generated", () => ({
  updateGeneratedCertificate: jest.fn(() => Promise.resolve({})),
}))

jest.mock("../StudentPillCell", () => ({
  StudentPillCell: ({ userId }: { userId: string }) => <span>{userId}</span>,
  studentPillText: () => "",
  STUDENT_PILL_CHROME_PX: 0,
}))

jest.mock("../../StudentsContext", () => ({
  useStudentsContext: () => ({ courseId: "course-1" }),
  useStudentsListParams: () => ({}),
  useStudentsSorting: () => ({ sorting: [], onSortingChange: () => undefined }),
}))

const USER_ID = "user-1"
const CERTIFICATE_ID = "cert-1"
const VERIFICATION_ID = "verification-1"

jest.mock("../../studentsQueries", () => ({
  DETAIL_SORT_COLUMNS: [],
  formatStudentName: () => "Lovelace, Ada",
  useCourseStudentsIdentity: () => ({
    data: {
      data: [{ user_id: USER_ID, first_name: "Ada", last_name: "Lovelace", email: "a@b.c" }],
    },
    isError: false,
    isPending: false,
    isLoading: false,
  }),
  useCourseStudentsCertificatesDetail: () => ({
    data: [
      {
        user_id: USER_ID,
        name_on_certificate: "Ada Lovelace",
        date_issued: "2026-01-05T00:00:00Z",
        verification_id: VERIFICATION_ID,
        certificate_id: CERTIFICATE_ID,
      },
    ],
    isError: false,
    isLoading: false,
  }),
}))

const renderWithClient = (ui: ReactNode) => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe("CertificatesTabContent edit dialog", () => {
  it("prefills the date field from the certificate's current issue date", () => {
    renderWithClient(<CertificatesTabContent />)

    fireEvent.click(screen.getByRole("button", { name: "edit_certificate" }))

    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByRole("group", { name: "date-issued" })).toBeInTheDocument()
    expect(dialog.querySelector('input[type="hidden"]')).toHaveValue("2026-01-05")
  })

  it("submits the edited issue date as an ISO string", async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2026-03-13T12:00:00Z"))
    setLocalTimeZone("UTC")

    try {
      renderWithClient(<CertificatesTabContent />)

      fireEvent.click(screen.getByRole("button", { name: "edit_certificate" }))

      const dateGroup = screen.getByRole("group", { name: "date-issued" })
      fireEvent.click(within(dateGroup).getByRole("button"))
      // The mocked react-i18next here is stable but still returns keys, not strings, so the
      // DateField calendar's quick-action button reads as its i18n key.
      fireEvent.click(screen.getByRole("button", { name: "datePicker.today" }))

      fireEvent.click(screen.getByRole("button", { name: "button-text-update" }))

      await waitFor(() => expect(updateGeneratedCertificate).toHaveBeenCalledTimes(1))
      const [callArgs] = (updateGeneratedCertificate as jest.Mock).mock.calls[0]
      expect(callArgs.path).toEqual({ certificate_id: CERTIFICATE_ID })
      expect(callArgs.body).toEqual({
        date_issued: new Date("2026-03-13").toISOString(),
        name_on_certificate: "Ada Lovelace",
      })
    } finally {
      resetLocalTimeZone()
      jest.useRealTimers()
    }
  })
})
