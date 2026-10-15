"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { DefaultValues } from "react-hook-form"
import { FormProvider, useForm } from "react-hook-form"

import type { ClosingSuccessorCandidate } from "../closingSuccessorCandidates"
import CourseClosingFields, { type CourseClosingFormValues } from "../CourseClosingFields"

const FROZEN_NOW = new Date(2026, 0, 15, 10, 30, 0)

const candidate = (
  overrides: Partial<ClosingSuccessorCandidate> & { id: string },
): ClosingSuccessorCandidate => ({
  name: overrides.id,
  slug: overrides.id,
  languageCode: "en-US",
  isDraft: false,
  isUnlisted: false,
  isClosed: false,
  organizationId: "org",
  organizationName: "Org",
  ...overrides,
})

const CANDIDATES = [
  candidate({ id: "self", name: "Self course" }),
  candidate({ id: "open", name: "Open successor" }),
  candidate({ id: "closed", name: "Closed successor", isClosed: true }),
  candidate({ id: "draft", name: "Draft successor", isDraft: true }),
  candidate({ id: "finnish", name: "Finnish successor", languageCode: "fi-FI" }),
]

function Harness({
  onSubmit,
  defaultValues,
}: {
  onSubmit: (data: CourseClosingFormValues) => void
  defaultValues: DefaultValues<CourseClosingFormValues>
}) {
  const methods = useForm<CourseClosingFormValues>({ defaultValues })
  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <CourseClosingFields
          candidates={CANDIDATES}
          currentCourseId="self"
          currentOrganizationId="org"
          currentLanguageCode="en-US"
        />
        <button type="submit">submit</button>
      </form>
    </FormProvider>
  )
}

const openSuccessorList = () => {
  fireEvent.click(screen.getByTestId("closed-successor-field"))
  return screen.getByRole("listbox")
}

describe("CourseClosingFields", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] }).setSystemTime(FROZEN_NOW)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("leaves the closing time empty when the switch is turned on", async () => {
    const onSubmit = jest.fn()
    render(
      <Harness
        onSubmit={onSubmit}
        defaultValues={{ set_course_closed_at: false, closed_at: null }}
      />,
    )

    expect(screen.queryByTestId("closed-at-field")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("switch", { name: "course-closing-switch-label" }))
    expect(screen.getByTestId("closed-at-field")).toBeInTheDocument()
    expect(screen.queryByTestId("course-closing-status")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "submit" }))
    await waitFor(() =>
      expect(screen.getByText("course-closing-time-required")).toBeInTheDocument(),
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("says the course is open until a future closing time", () => {
    render(
      <Harness
        onSubmit={jest.fn()}
        defaultValues={{ set_course_closed_at: true, closed_at: "2026-02-01T12:00" }}
      />,
    )
    expect(screen.getByTestId("course-closing-status")).toHaveTextContent(
      "course-closing-status-open",
    )
  })

  it("says the course is closed once the closing time has passed", () => {
    render(
      <Harness
        onSubmit={jest.fn()}
        defaultValues={{ set_course_closed_at: true, closed_at: "2026-01-01T12:00" }}
      />,
    )
    expect(screen.getByTestId("course-closing-status")).toHaveTextContent(
      "course-closing-status-closed",
    )
  })

  it("leaves out the course itself and disables closed courses in the successor list", () => {
    render(
      <Harness
        onSubmit={jest.fn()}
        defaultValues={{ set_course_closed_at: true, closed_at: "2026-02-01T12:00" }}
      />,
    )
    const listbox = openSuccessorList()

    expect(listbox).not.toHaveTextContent("Self course")
    expect(listbox).toHaveTextContent("Open successor")
    expect(screen.getByRole("option", { name: /Closed successor/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    )
    expect(screen.getByRole("option", { name: /Open successor/ })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    )
  })

  it("warns when the chosen successor is a draft", () => {
    render(
      <Harness
        onSubmit={jest.fn()}
        defaultValues={{
          set_course_closed_at: true,
          closed_at: "2026-02-01T12:00",
          closed_course_successor_id: "draft",
        }}
      />,
    )
    expect(screen.getByText("course-closing-successor-draft-warning")).toBeInTheDocument()
  })

  it("keeps the successor and note when the switch is turned off", async () => {
    const onSubmit = jest.fn()
    render(
      <Harness
        onSubmit={onSubmit}
        defaultValues={{
          set_course_closed_at: true,
          closed_at: "2026-02-01T12:00",
          closed_course_successor_id: "open",
          closed_additional_message: "Moved",
        }}
      />,
    )

    fireEvent.click(screen.getByRole("switch", { name: "course-closing-switch-label" }))
    fireEvent.click(screen.getByRole("button", { name: "submit" }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      set_course_closed_at: false,
      closed_at: "2026-02-01T12:00",
      closed_course_successor_id: "open",
      closed_additional_message: "Moved",
    })
  })
})
