"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

import type { ExerciseRepository } from "@/generated/api/types.generated"
import { DialogProvider } from "@/shared-module/components"

import EditExerciseRepositoryForm from "../EditExerciseRepositoryForm"

const mockUpdateExerciseRepository = jest.fn().mockResolvedValue(true)

jest.mock("@/generated/api/sdk.generated", () => ({
  updateExerciseRepository: (...args: unknown[]) => mockUpdateExerciseRepository(...args),
}))

const repository: ExerciseRepository = {
  id: "repository-1",
  url: "git@example.com:course/repo.git",
  course_id: "course-1",
  exam_id: null,
  status: "Success",
  error_message: null,
  branch: "main",
  public_key: "ssh-ed25519 AAAA",
  has_deploy_key: true,
  sync_attempts: 0,
  last_synced_at: null,
  last_sync_report: null,
  exercise_task_count: 3,
}

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onDelete = jest.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <DialogProvider>
        <EditExerciseRepositoryForm
          exerciseRepository={repository}
          onSuccess={jest.fn()}
          onCancel={jest.fn()}
          onDelete={onDelete}
        />
      </DialogProvider>
    </QueryClientProvider>,
  )
  return { onDelete }
}

describe("EditExerciseRepositoryForm", () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it("keeps the stored deploy key unless a new one is entered", async () => {
    renderForm()

    const saveButton = screen.getByRole("button", { name: "button-text-save" })
    await waitFor(() => expect(saveButton).not.toBeDisabled())
    fireEvent.click(saveButton)

    await waitFor(() => expect(mockUpdateExerciseRepository).toHaveBeenCalledTimes(1))
    const body = mockUpdateExerciseRepository.mock.calls[0][0].body
    expect(body.url).toBe(repository.url)
    expect(body.branch).toBe("main")
    expect(body.deploy_key).toBeNull()
    expect(body.public_key).toBeNull()
  })

  it("deletes only after the teacher confirms", async () => {
    const { onDelete } = renderForm()

    fireEvent.click(screen.getByRole("button", { name: "button-text-delete" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("exercise-repositories-delete-confirm-in-use")
    expect(onDelete).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole("button", { name: "button-text-delete" }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1))
  })
})
