"use client"

import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useContext } from "react"
import { useController } from "react-hook-form"

import type {
  ResearchForm,
  ResearchFormQuestion,
} from "@/generated/course-material-api/types.generated"

import SelectResearchConsentForm from "../SelectResearchConsentForm"

const mockGetQuestions = jest.fn()
const mockPostAnswer = jest.fn().mockResolvedValue({})

jest.mock("@/generated/course-material-api/sdk.generated", () => ({
  getCourseMaterialResearchConsentFormQuestions: (...args: unknown[]) => mockGetQuestions(...args),
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

// Mimics the real block renderer's Checkbox binding via bare useController, skipping the rest of
// the Gutenberg content-renderer machinery.
jest.mock("@/components/course-material/ContentRenderer", () => {
  const { CheckboxContext } =
    require("@/contexts/course-material/CheckboxContext") as typeof import("@/contexts/course-material/CheckboxContext")
  const QuestionCheckbox = ({ name, control }: { name: string; control: unknown }) => {
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
  return {
    __esModule: true,
    default: ({ data }: { data: { clientId: string }[] }) => {
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
    },
  }
})

const QUESTIONS: ResearchFormQuestion[] = [
  {
    id: "question-1",
    course_id: "course-1",
    research_consent_form_id: "form-1",
    question: "May we use your data?",
    created_at: "2020-01-01T00:00:00.000Z",
    updated_at: "2020-01-01T00:00:00.000Z",
  },
  {
    id: "question-2",
    course_id: "course-1",
    research_consent_form_id: "form-1",
    question: "May we contact you?",
    created_at: "2020-01-01T00:00:00.000Z",
    updated_at: "2020-01-01T00:00:00.000Z",
  },
]

const RESEARCH_FORM: ResearchForm = {
  id: "form-1",
  course_id: "course-1",
  content: [{ clientId: "question-1" }, { clientId: "question-2" }],
  created_at: "2020-01-01T00:00:00.000Z",
  updated_at: "2020-01-01T00:00:00.000Z",
}

function renderForm() {
  mockGetQuestions.mockResolvedValue(QUESTIONS)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <SelectResearchConsentForm
        onClose={jest.fn()}
        editForm={false}
        shouldAnswerResearchForm={true}
        researchForm={RESEARCH_FORM}
      />
    </QueryClientProvider>,
  )
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
})
