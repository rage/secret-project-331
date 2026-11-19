"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useContext } from "react"
import { useController } from "react-hook-form"

import { CheckboxContext } from "@/contexts/course-material/CheckboxContext"
import type { ResearchFormQuestionAnswer } from "@/generated/course-material-api/types.generated"

import SelectResearchConsentForm from "../SelectResearchConsentForm"

const mockPostAnswer = jest.fn().mockResolvedValue({})

jest.mock("@/generated/course-material-api/sdk.generated", () => ({
  postCourseMaterialResearchConsentFormAnswer: (...args: unknown[]) => mockPostAnswer(...args),
}))

jest.mock("@/shared-module/common/hooks/useUserInfo", () => ({
  __esModule: true,
  default: () => ({ data: { user_id: "user-1" } }),
}))

jest.mock("@/state/course-material/selectors", () => ({
  currentCourseIdAtom: "mock-current-course-id-atom",
  materialCourseAtom: "mock-material-course-atom",
}))

jest.mock("jotai", () => ({
  useAtomValue: (atom: string) => (atom === "mock-current-course-id-atom" ? "course-1" : null),
}))

// Function declarations so both names are fully hoisted: jest.mock() below is itself hoisted
// above this file's other statements, and runs as soon as SelectResearchConsentForm is
// imported, before a `const` arrow function here would be initialized.
function QuestionCheckbox({ name, control }: { name: string; control: unknown }) {
  // oxlint-disable-next-line typescript/no-explicit-any -- test double, real type is Control<Record<string, boolean>>
  const { field } = useController({ name, control: control as any })
  return (
    <label>
      {name}
      <input
        type="checkbox"
        checked={Boolean(field.value)}
        onChange={(e) => field.onChange(e.target.checked)}
      />
    </label>
  )
}

// Mimics the real block renderer's Checkbox binding via bare useController, skipping the rest of
// the Gutenberg content-renderer machinery.
function MockContentRenderer({ data }: { data: { clientId: string }[] }) {
  const { control } = useContext(CheckboxContext)
  if (!control) {
    return null
  }
  return (
    <>
      {data.map((block) => (
        <QuestionCheckbox key={block.clientId} name={block.clientId} control={control} />
      ))}
    </>
  )
}

jest.mock("@/components/course-material/ContentRenderer", () => ({
  __esModule: true,
  default: MockContentRenderer,
}))

const CONTENT = [
  { name: "moocfi/research-consent-question", clientId: "question-1" },
  { name: "moocfi/research-consent-question", clientId: "question-2" },
]

function renderForm(usersInitialAnswers?: ResearchFormQuestionAnswer[]) {
  const onClose = jest.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <SelectResearchConsentForm
        onClose={onClose}
        editForm={false}
        shouldAnswerResearchForm={true}
        content={CONTENT}
        {...(usersInitialAnswers ? { usersInitialAnswers } : {})}
      />
    </QueryClientProvider>,
  )
  return { onClose }
}

describe("SelectResearchConsentForm", () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it("records false, not undefined, for a question the user never touches", async () => {
    renderForm()

    await screen.findByLabelText("question-1")
    await screen.findByLabelText("question-2")

    fireEvent.click(screen.getByRole("button", { name: "save" }))

    await waitFor(() => expect(mockPostAnswer).toHaveBeenCalledTimes(2))
    const answers = mockPostAnswer.mock.calls.map((call) => call[0].body.research_consent)
    expect(answers).toEqual([false, false])
  })

  it("skips answers to questions removed from the form and closes once saved", async () => {
    const { onClose } = renderForm([
      {
        id: "answer-1",
        user_id: "user-1",
        course_id: "course-1",
        research_form_question_id: "removed-question",
        research_consent: true,
        created_at: "2020-01-01T00:00:00.000Z",
        updated_at: "2020-01-01T00:00:00.000Z",
      },
    ])

    await screen.findByLabelText("question-1")
    fireEvent.click(screen.getByRole("button", { name: "save" }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const questionIds = mockPostAnswer.mock.calls.map(
      (call) => call[0].body.research_form_question_id,
    )
    expect(questionIds).toEqual(["question-1", "question-2"])
  })
})
