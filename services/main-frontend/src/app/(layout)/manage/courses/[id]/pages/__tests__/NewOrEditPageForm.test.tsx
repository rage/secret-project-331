"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import NewOrEditPageForm from "../NewOrEditPageForm"

const mockCreatePage = jest.fn().mockResolvedValue({})

jest.mock("@/generated/api/sdk.generated", () => ({
  createPage: (...args: unknown[]) => mockCreatePage(...args),
  updatePageDetails: jest.fn().mockResolvedValue({}),
}))

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <NewOrEditPageForm
        courseId="course-1"
        onSubmitForm={jest.fn()}
        isUpdate={false}
        open
        onClose={jest.fn()}
      />
    </QueryClientProvider>,
  )
}

describe("NewOrEditPageForm", () => {
  afterEach(() => jest.clearAllMocks())

  it("shows an error and focuses the first invalid field when Create is pressed empty", async () => {
    renderForm()

    fireEvent.click(screen.getByRole("button", { name: "button-text-create" }))

    await waitFor(() => expect(screen.getAllByText("required-field").length).toBeGreaterThan(0))
    expect(document.activeElement).toBe(document.querySelector('input[name="title"]'))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(mockCreatePage).not.toHaveBeenCalled()
  })

  it("submits the form through the Create button once both fields are filled", async () => {
    renderForm()

    fireEvent.change(document.querySelector('input[name="title"]') as HTMLInputElement, {
      target: { value: "Intro" },
    })
    fireEvent.click(screen.getByRole("button", { name: "button-text-create" }))

    await waitFor(() => expect(mockCreatePage).toHaveBeenCalledTimes(1))
    expect(mockCreatePage.mock.calls[0][0].body).toEqual(
      expect.objectContaining({ title: "Intro", url_path: "/intro" }),
    )
  })

  it("clears the fields after a page is created", async () => {
    renderForm()
    const titleInput = document.querySelector('input[name="title"]') as HTMLInputElement
    fireEvent.change(titleInput, { target: { value: "Intro" } })
    fireEvent.click(screen.getByRole("button", { name: "button-text-create" }))

    await waitFor(() => expect(mockCreatePage).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(titleInput.value).toBe(""))
  })

  it("is a form, so Enter in a field submits it", () => {
    renderForm()

    const form = document.querySelector('input[name="title"]')?.closest("form")
    expect(form).not.toBeNull()
    expect(document.querySelector('button[type="submit"]')).toHaveAttribute("form", form?.id)
  })
})
