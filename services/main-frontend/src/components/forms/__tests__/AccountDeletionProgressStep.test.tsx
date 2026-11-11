"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import type { ProgressByPlatform } from "@/generated/api/types.generated"

import AccountDeletionProgressStep from "../AccountDeletionProgressStep"

// Resolves the real English strings, so assertions read as the user would.
jest.mock("react-i18next", () => {
  const en: Record<string, string> = jest.requireActual(
    "@/shared-module/common/locales/en/main-frontend.json",
  )
  const t = (key: string, options: Record<string, string | number> = {}) => {
    const count = options.count
    const pluralKey =
      typeof count === "number" ? `${key}_${new Intl.PluralRules("en").select(count)}` : null
    const template = (pluralKey && en[pluralKey]) ?? en[key] ?? key
    return template.replaceAll(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options[name]))
  }
  return {
    useTranslation: () => ({
      t,
      i18n: { language: "en", changeLanguage: () => Promise.resolve() },
    }),
  }
})

const mockGetProgress = jest.fn<Promise<ProgressByPlatform>, [unknown]>()
jest.mock("@/generated/api/sdk.generated", () => ({
  getMyProgressByPlatform: (options: unknown) => mockGetProgress(options),
}))

const nothingFound: ProgressByPlatform = {
  courses_mooc_fi: [],
  mooc_fi_status: "loaded",
  mooc_fi: [],
  tmc_mooc_fi_status: "loaded",
  tmc_mooc_fi: [],
}

function renderStep(progress: ProgressByPlatform | Error) {
  if (progress instanceof Error) {
    mockGetProgress.mockRejectedValue(progress)
  } else {
    mockGetProgress.mockResolvedValue(progress)
  }
  const onAcknowledgedChange = jest.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AccountDeletionProgressStep onAcknowledgedChange={onAcknowledgedChange} />
    </QueryClientProvider>,
  )
  return onAcknowledgedChange
}

describe("AccountDeletionProgressStep", () => {
  it("lists every course once under its platform and names the count", async () => {
    const onAcknowledgedChange = renderStep({
      ...nothingFound,
      courses_mooc_fi: [
        {
          course_id: "c1",
          name: "Introduction to Programming",
          completed_modules: 1,
          total_modules: 3,
          points: 12.5,
          max_points: 40,
        },
      ],
      mooc_fi: [
        {
          course_id: "m1",
          name: "Java Programming I",
          completed: true,
          points: null,
          max_points: null,
          tmc_mooc_fi_courses: [{ name: "Java I", awarded_points: 5, submissions: 1 }],
        },
      ],
      tmc_mooc_fi: [{ name: "Data Structures", awarded_points: 1, submissions: 2 }],
    })

    expect(await screen.findByText("Introduction to Programming")).toBeInTheDocument()
    expect(screen.getByText("— 1/3 modules completed · 12.5/40 points")).toBeInTheDocument()
    expect(
      screen.getByText("— Completed · tmc.mooc.fi: 5 points, 1 submission"),
    ).toBeInTheDocument()
    expect(screen.getByText("— 1 point, 2 submissions")).toBeInTheDocument()

    const checkbox = screen.getByRole("checkbox", {
      name: "I understand I will permanently lose my progress on these 3 courses",
    })
    expect(onAcknowledgedChange).toHaveBeenLastCalledWith(false)
    fireEvent.click(checkbox)
    await waitFor(() => expect(onAcknowledgedChange).toHaveBeenLastCalledWith(true))
  })

  it("warns about platforms that could not be checked", async () => {
    renderStep({ ...nothingFound, tmc_mooc_fi_status: "unavailable" })

    expect(
      await screen.findByText(/We could not check your progress on tmc\.mooc\.fi/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/on mooc\.fi\./)).not.toBeInTheDocument()
  })

  it("warns about every platform when the progress could not be loaded", async () => {
    renderStep(new Error("Too many requests"))

    for (const platform of ["courses.mooc.fi", "mooc.fi", "tmc.mooc.fi"]) {
      expect(
        await screen.findByText(`We could not check your progress on ${platform}.`, {
          exact: false,
        }),
      ).toBeInTheDocument()
    }
  })

  it("asks for a plain confirmation when nothing was found", async () => {
    renderStep(nothingFound)

    expect(
      await screen.findByRole("checkbox", {
        name: "I understand that deleting my account is permanent",
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/The same account is used/)).not.toBeInTheDocument()
  })
})
