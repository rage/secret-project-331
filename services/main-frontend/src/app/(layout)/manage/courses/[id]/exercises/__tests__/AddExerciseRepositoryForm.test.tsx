"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import AddExerciseRepositoryForm from "../AddExerciseRepositoryForm"

const mockCreateExerciseRepository = jest.fn().mockResolvedValue({})

jest.mock("@/generated/api/sdk.generated", () => ({
  createExerciseRepository: (...args: unknown[]) => mockCreateExerciseRepository(...args),
}))

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onSuccess = jest.fn()
  const onCancel = jest.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <AddExerciseRepositoryForm
        courseId="course-1"
        examId={null}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </QueryClientProvider>,
  )
  return { onSuccess, onCancel }
}

describe("AddExerciseRepositoryForm", () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it("submits the git url when the add button is clicked", async () => {
    const { onSuccess } = renderForm()

    fireEvent.change(document.querySelector('input[name="gitUrl"]') as HTMLInputElement, {
      target: { value: "git@example.com:course/repo.git" },
    })

    const addButton = screen.getByRole("button", { name: "add" })
    await waitFor(() => expect(addButton).not.toBeDisabled())
    fireEvent.click(addButton)

    await waitFor(() => expect(mockCreateExerciseRepository).toHaveBeenCalledTimes(1))
    const body = mockCreateExerciseRepository.mock.calls[0][0].body
    expect(body.git_url).toBe("git@example.com:course/repo.git")
    expect(body.course_id).toBe("course-1")
    expect(body.public_key).toBeNull()
    expect(body.deploy_key).toBeNull()
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  })
})
