"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import NewCourseForm from ".."

const mockCreateCourse = jest.fn().mockResolvedValue({ id: "course-1" })
const mockGetOrganizationDuplicatableCourses = jest.fn().mockResolvedValue([])

jest.mock("@/generated/api/sdk.generated", () => ({
  createCourse: (...args: unknown[]) => mockCreateCourse(...args),
  getOrganizationDuplicatableCourses: (...args: unknown[]) =>
    mockGetOrganizationDuplicatableCourses(...args),
}))

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <NewCourseForm organizationId="org-1" />
    </QueryClientProvider>,
  )
}

describe("NewCourseForm", () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it("submits an empty description when the field is left untouched", async () => {
    renderForm()

    fireEvent.change(document.querySelector('input[name="name"]') as HTMLInputElement, {
      target: { value: "Advanced Topics" },
    })
    fireEvent.change(
      document.querySelector('input[name="teacher_in_charge_name"]') as HTMLInputElement,
      { target: { value: "Ada Lovelace" } },
    )
    fireEvent.change(
      document.querySelector('input[name="teacher_in_charge_email"]') as HTMLInputElement,
      { target: { value: "ada@example.com" } },
    )

    const createButton = screen.getByRole("button", { name: "button-text-create" })
    fireEvent.click(createButton)

    await waitFor(() => expect(mockCreateCourse).toHaveBeenCalledTimes(1))
    const body = mockCreateCourse.mock.calls[0][0].body
    expect(body.name).toBe("Advanced Topics")
    expect(body.description).toBe("")
  })
})
