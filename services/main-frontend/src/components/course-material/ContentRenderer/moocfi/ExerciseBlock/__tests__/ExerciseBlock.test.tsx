"use client"

import "@testing-library/jest-dom"
import { announce } from "@react-aria/live-announcer"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"

import type {
  CourseMaterialExercise,
  CourseMaterialExerciseTask,
  StudentExerciseSlideSubmissionResult,
} from "@/generated/course-material-api/types.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { DialogProvider } from "@/shared-module/components"
import type { IframeConnectionState } from "@/shared-module/exercise-iframe-host/MessageChannelIFrame"
import type { ExerciseIframeState } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

import ExerciseBlock from ".."

interface FakeIframeProps {
  postThisStateToIFrame: ExerciseIframeState
  onMessageFromIframe: (message: unknown, port: MessagePort) => Promise<void> | void
  onConnectionStateChange?: (state: IframeConnectionState) => void
  onReloadRequested?: () => void
  getAnswerDraft?: () => unknown
  detectLoadFailure?: boolean
  onReady?: () => void
  ref?: React.Ref<{ focusFirstInvalid: () => void }>
  title: string
}

const mockIframeProps = new Map<string, FakeIframeProps>()
const mockFocusFirstInvalid = jest.fn<void, [string]>()
const mockReleaseLoadSlot = jest.fn<void, [string]>()
const mockFetchExercise = jest.fn<Promise<CourseMaterialExercise>, []>()
const mockFetchLocks = jest.fn<Promise<unknown[]>, []>()
const mockPostSubmission = jest.fn()

jest.mock("@react-aria/live-announcer", () => ({ announce: jest.fn() }))

jest.mock("next/navigation", () => ({
  usePathname: () => "/org/uh-cs/courses/course/chapter-1/page-1",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
}))

jest.mock("jotai", () => ({
  ...jest.requireActual("jotai"),
  useAtomValue: () => ({
    status: "ready",
    error: null,
    page: { id: "page-1" },
    course: { id: "course-1", chapter_locking_enabled: false },
    instance: { id: "instance-1" },
    settings: {
      current_course_instance_id: "instance-1",
      current_course_id: "course-1",
      user_id: "user-1",
    },
    organization: null,
    examData: null,
  }),
}))

// The real modules pull in jotai-tanstack-query, which Jest can't load as ESM.
jest.mock("@/state/course-material", () => ({ courseMaterialAtom: {} }))
jest.mock("@/components/course-material/notifications/UserOnWrongCourseNotification", () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock("@/hooks/course-material/useCourseMaterialExerciseQuery", () => {
  const { useQuery } = jest.requireActual("@tanstack/react-query")
  return {
    __esModule: true,
    default: function useCourseMaterialExerciseQuery(exerciseId: string) {
      return useQuery({ queryKey: ["exercise", exerciseId], queryFn: () => mockFetchExercise() })
    },
  }
})

jest.mock("@/hooks/course-material/useUserChapterLocks", () => {
  const { useQuery } = jest.requireActual("@tanstack/react-query")
  return {
    useUserChapterLocks: function useUserChapterLocks(courseId: string | null) {
      return useQuery({ queryKey: ["locks", courseId], queryFn: () => mockFetchLocks() })
    },
  }
})

jest.mock("@/generated/course-material-api/sdk.generated", () => ({
  postSubmission: (...args: unknown[]) => mockPostSubmission(...args),
  postStartPeerOrSelfReview: jest.fn(),
}))

jest.mock("@/components/course-material/ContentRenderer", () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock("@/shared-module/common/components/ThrottledChildRenderer", () => ({
  ThrottledChildRenderer: ({
    id,
    children,
  }: {
    id: string
    children: React.ReactNode | ((onReady: () => void) => React.ReactNode)
  }) => (typeof children === "function" ? children(() => mockReleaseLoadSlot(id)) : children),
}))

jest.mock("@/shared-module/exercise-iframe-host/MessageChannelIFrame", () => {
  const { createElement, useImperativeHandle } = jest.requireActual("react")
  const FakeMessageChannelIFrame = (props: FakeIframeProps) => {
    const taskId = props.postThisStateToIFrame.exercise_task_id
    mockIframeProps.set(taskId, props)
    useImperativeHandle(props.ref, () => ({
      focusFirstInvalid: () => mockFocusFirstInvalid(taskId),
    }))
    return createElement("div", { "data-testid": `iframe-${taskId}` })
  }
  return { __esModule: true, default: FakeMessageChannelIFrame }
})

const EXERCISE_ID = "exercise-1"

const makeTask = (
  id: string,
  orderNumber: number,
  previousSubmission: CourseMaterialExerciseTask["previous_submission"] = null,
): CourseMaterialExerciseTask =>
  ({
    id,
    order_number: orderNumber,
    exercise_slide_id: "slide-1",
    exercise_iframe_url: "https://plugin.example/iframe",
    exercise_service_slug: "survey",
    assignment: [],
    public_spec: { id },
    pseudonumous_user_id: "pseudonymous-1",
    previous_submission: previousSubmission,
    previous_submission_grading: null,
  }) as CourseMaterialExerciseTask

const makeStoredSubmission = (submissionId: string, taskId: string, dataJson: unknown) =>
  ({
    id: submissionId,
    exercise_task_id: taskId,
    answer_kind: "json",
    data_json: dataJson,
    created_at: "2026-11-01T00:00:00Z",
  }) as unknown as NonNullable<CourseMaterialExerciseTask["previous_submission"]>

const makeExercise = (
  tasks: CourseMaterialExerciseTask[],
  overrides: Partial<CourseMaterialExercise> = {},
): CourseMaterialExercise =>
  ({
    exercise: {
      id: EXERCISE_ID,
      name: "Alusta-arkuus",
      chapter_id: null,
      exam_id: null,
      deadline: null,
      score_maximum: 1,
      max_tries_per_slide: null,
      limit_number_of_tries: false,
      needs_peer_review: false,
      needs_self_review: false,
      order_number: 0,
      teacher_reviews_answer_after_locking: false,
    },
    current_exercise_slide: { id: "slide-1", exercise_tasks: tasks },
    exercise_slide_submission_counts: {},
    can_post_submission: true,
    exercise_status: { score_given: null, reviewing_stage: "NotStarted" },
    user_course_instance_exercise_service_variables: [],
    previous_exercise_slide_submission: null,
    peer_or_self_review_config: null,
    should_show_reset_message: null,
    teacher_grading_decision: null,
    ...overrides,
  }) as unknown as CourseMaterialExercise

const withSubmission = (submissionId: string) =>
  makeExercise([
    makeTask("task-1", 0, makeStoredSubmission(submissionId, "task-1", { a: submissionId })),
    makeTask("task-2", 1),
  ])

const createDeferred = <T,>() => {
  const deferred = {} as { promise: Promise<T>; resolve: (value: T) => void }
  deferred.promise = new Promise<T>((resolve) => {
    deferred.resolve = resolve
  })
  return deferred
}

let queryClient: QueryClient

const ExerciseBlockUnderTest = ({ signedIn = true }: { signedIn?: boolean }) => (
  <QueryClientProvider client={queryClient}>
    <LoginStateContext.Provider
      value={{ isLoading: false, signedIn, refresh: () => Promise.resolve() }}
    >
      <DialogProvider>
        <ExerciseBlock
          data={{
            name: "moocfi/exercise",
            clientId: "block-1",
            isValid: true,
            attributes: { id: EXERCISE_ID },
            innerBlocks: [],
          }}
          id="block-1"
          isExam={false}
          dontAllowBlockToBeWiderThanContainerWidth={false}
        />
      </DialogProvider>
    </LoginStateContext.Provider>
  </QueryClientProvider>
)

const renderExerciseBlock = async (exercise: CourseMaterialExercise) => {
  mockFetchExercise.mockResolvedValue(exercise)
  const utils = render(<ExerciseBlockUnderTest />)
  for (const task of exercise.current_exercise_slide.exercise_tasks) {
    await waitFor(() => expect(mockIframeProps.get(task.id)).toBeDefined())
  }
  return utils
}

const iframeOf = (taskId: string): FakeIframeProps => {
  const props = mockIframeProps.get(taskId)
  if (!props) {
    throw new Error(`No iframe rendered for task ${taskId}`)
  }
  return props
}

const reportConnection = (
  taskId: string,
  status: IframeConnectionState["status"],
  details: Partial<IframeConnectionState> = {},
) => {
  act(() => {
    iframeOf(taskId).onConnectionStateChange?.({
      status,
      stage: status === "connected" ? "ready-received" : "mounted",
      elapsedMs: 0,
      reloadCount: 0,
      ...details,
    })
  })
}

const reportAnswer = async (
  taskId: string,
  answer: { data: unknown; valid: boolean; validityMessages?: string[] },
) => {
  reportConnection(taskId, "connected")
  await act(async () => {
    await iframeOf(taskId).onMessageFromIframe(
      { message: "current-state", ...answer },
      {} as unknown as MessagePort,
    )
  })
}

// React Query notifies observers in a `setTimeout(0)` batch.
const flushQueryNotifications = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

const refetchQueries = () =>
  act(async () => {
    await queryClient.invalidateQueries()
    await flushQueryNotifications()
  })

const mockFetch = jest.fn((_url: string, _init: RequestInit) =>
  Promise.resolve({ ok: true, status: 204 } as Response),
)

const sentFailureReports = () =>
  mockFetch.mock.calls.map(([url, init]) => {
    expect(url).toBe("/api/v0/errors")
    return JSON.parse(init.body as string)
  })

const submitButton = () => screen.getByRole("button", { name: "submit-button" })

const expectSubmittable = () => expect(submitButton()).toHaveAttribute("aria-disabled", "false")

const expectBlockedBy = (...messages: string[]) => {
  expect(submitButton()).toHaveAttribute("aria-disabled", "true")
  expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(messages)
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  mockIframeProps.clear()
  mockFocusFirstInvalid.mockReset()
  mockReleaseLoadSlot.mockReset()
  mockFetchExercise.mockReset()
  mockFetchLocks.mockReset().mockResolvedValue([])
  mockPostSubmission.mockReset()
  mockFetch.mockClear()
  global.fetch = mockFetch as unknown as typeof fetch
  jest.mocked(announce).mockClear()
})

afterEach(() => {
  queryClient.clear()
})

describe("ExerciseBlock answers", () => {
  it("enables submit once every task reports a valid answer", async () => {
    await renderExerciseBlock(makeExercise([makeTask("task-1", 0), makeTask("task-2", 1)]))

    await reportAnswer("task-1", { data: { a: 1 }, valid: true })
    expectBlockedBy("submission-blocked-task-loading")

    await reportAnswer("task-2", { data: { b: 2 }, valid: true })
    expectSubmittable()
  })

  it("counts a previous submission as a valid answer", async () => {
    await renderExerciseBlock(
      makeExercise([
        makeTask("task-1", 0, makeStoredSubmission("sub-1", "task-1", { a: 1 })),
        makeTask("task-2", 1),
      ]),
    )

    await reportAnswer("task-2", { data: { b: 2 }, valid: true })
    expectSubmittable()
  })

  it("keeps captured answers when the exercise is refetched", async () => {
    const exercise = makeExercise([makeTask("task-1", 0), makeTask("task-2", 1)])
    await renderExerciseBlock(exercise)
    await reportAnswer("task-1", { data: { a: 1 }, valid: true })
    await reportAnswer("task-2", { data: { b: 2 }, valid: true })

    mockFetchExercise.mockResolvedValue(
      makeExercise([makeTask("task-1", 0), makeTask("task-2", 1)], {
        exercise_slide_submission_counts: { "other-slide": 1 },
      }),
    )
    await refetchQueries()

    expect(mockFetchExercise).toHaveBeenCalledTimes(2)
    expectSubmittable()
  })

  it("keeps captured answers when the chapter locks arrive later", async () => {
    const locks = createDeferred<unknown[]>()
    mockFetchLocks.mockReset().mockReturnValue(locks.promise)
    await renderExerciseBlock(makeExercise([makeTask("task-1", 0)]))
    await reportAnswer("task-1", { data: { a: 1 }, valid: true })

    await act(async () => {
      locks.resolve([])
      await flushQueryNotifications()
    })

    expectSubmittable()
  })

  it("keeps captured answers when the login state changes", async () => {
    const { rerender } = await renderExerciseBlock(makeExercise([makeTask("task-1", 0)]))
    await reportAnswer("task-1", { data: { a: 1 }, valid: true })

    rerender(<ExerciseBlockUnderTest signedIn={false} />)
    rerender(<ExerciseBlockUnderTest signedIn={true} />)

    expectSubmittable()
  })

  it("replaces a captured answer only when the task's previous submission changes", async () => {
    await renderExerciseBlock(withSubmission("sub-1"))
    await reportAnswer("task-1", { data: {}, valid: false })
    await reportAnswer("task-2", { data: { b: 2 }, valid: true })

    mockFetchExercise.mockResolvedValue(withSubmission("sub-1"))
    await refetchQueries()
    expectBlockedBy("answer-the-exercise-before-submitting")

    mockFetchExercise.mockResolvedValue(withSubmission("sub-2"))
    await refetchQueries()
    expectSubmittable()
  })

  it("submits the captured answers", async () => {
    await renderExerciseBlock(makeExercise([makeTask("task-1", 0), makeTask("task-2", 1)]))
    await reportAnswer("task-1", { data: { a: 1 }, valid: true })
    await reportAnswer("task-2", { data: { b: 2 }, valid: true })
    mockPostSubmission.mockReturnValue(new Promise(() => {}))

    fireEvent.click(submitButton())

    await waitFor(() =>
      expect(mockPostSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            exercise_slide_id: "slide-1",
            exercise_task_submissions: [
              { exercise_task_id: "task-1", answer_kind: "json", data_json: { a: 1 } },
              { exercise_task_id: "task-2", answer_kind: "json", data_json: { b: 2 } },
            ],
          },
        }),
      ),
    )
  })
})

describe("ExerciseBlock blockers", () => {
  it("says a task is loading until its iframe connects", async () => {
    await renderExerciseBlock(makeExercise([makeTask("task-1", 0)]))
    expectBlockedBy("submission-blocked-task-loading")

    reportConnection("task-1", "loading")
    expectBlockedBy("submission-blocked-task-loading")

    reportConnection("task-1", "connected")
    expectBlockedBy("answer-the-exercise-before-submitting")
  })

  it("says a part did not load when a task never connects", async () => {
    await renderExerciseBlock(makeExercise([makeTask("task-1", 0), makeTask("task-2", 1)]))
    await reportAnswer("task-1", { data: { a: 1 }, valid: true })

    reportConnection("task-2", "failed")

    expectBlockedBy("submission-blocked-task-not-loaded")
  })

  it("shows an invalid task's validity messages", async () => {
    await renderExerciseBlock(makeExercise([makeTask("task-1", 0), makeTask("task-2", 1)]))
    await reportAnswer("task-1", {
      data: {},
      valid: false,
      validityMessages: ["Answer question 3.", "Answer question 5."],
    })
    await reportAnswer("task-2", { data: { b: 2 }, valid: true })

    expectBlockedBy("Answer question 3.", "Answer question 5.")
  })

  it("asks for an answer when an invalid task gives no reason", async () => {
    await renderExerciseBlock(makeExercise([makeTask("task-1", 0)]))
    await reportAnswer("task-1", { data: {}, valid: false })

    expectBlockedBy("answer-the-exercise-before-submitting")
  })

  it("shows each blocker once", async () => {
    await renderExerciseBlock(makeExercise([makeTask("task-1", 0), makeTask("task-2", 1)]))
    reportConnection("task-1", "failed")
    reportConnection("task-2", "failed")

    expectBlockedBy("submission-blocked-task-not-loaded")
  })
})

describe("ExerciseBlock iframe wiring", () => {
  it("enables load failure detection for exercise tasks", async () => {
    await renderExerciseBlock(makeExercise([makeTask("task-1", 0)]))

    expect(iframeOf("task-1").detectLoadFailure).toBe(true)
  })

  it("frees the load slot of a task whose iframe failed", async () => {
    await renderExerciseBlock(makeExercise([makeTask("task-1", 0)]))
    reportConnection("task-1", "loading")
    expect(mockReleaseLoadSlot).not.toHaveBeenCalled()

    reportConnection("task-1", "failed")

    expect(mockReleaseLoadSlot).toHaveBeenCalledWith("exercise-iframe-task-1")
  })

  it("offers the last captured answer as the draft after a reload", async () => {
    await renderExerciseBlock(makeExercise([makeTask("task-1", 0), makeTask("task-2", 1)]))
    expect(iframeOf("task-1").getAnswerDraft?.()).toBeUndefined()

    await reportAnswer("task-1", { data: { a: 1 }, valid: false })
    await reportAnswer("task-1", { data: { a: 2 }, valid: true })

    expect(iframeOf("task-1").getAnswerDraft?.()).toEqual({ a: 2 })
    expect(iframeOf("task-2").getAnswerDraft?.()).toBeUndefined()
  })
})

describe("ExerciseBlock jumping to the problem", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = jest.fn()
  })

  it("focuses the first failing task on a blocked submit and announces why", async () => {
    jest.useFakeTimers()
    try {
      await renderExerciseBlock(
        makeExercise([makeTask("task-1", 0), makeTask("task-2", 1), makeTask("task-3", 2)]),
      )
      await reportAnswer("task-1", { data: { a: 1 }, valid: true })
      await reportAnswer("task-2", { data: {}, valid: false, validityMessages: ["Answer 3."] })
      reportConnection("task-3", "failed")

      fireEvent.click(submitButton())

      expect(mockFocusFirstInvalid).toHaveBeenCalledTimes(1)
      expect(mockFocusFirstInvalid).toHaveBeenCalledWith("task-2")
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
      expect(mockPostSubmission).not.toHaveBeenCalled()
      act(() => {
        jest.runOnlyPendingTimers()
      })
      expect(announce).toHaveBeenCalledWith(
        "Answer 3. submission-blocked-task-not-loaded",
        "polite",
      )
    } finally {
      jest.useRealTimers()
    }
  })

  it("focuses the task a blocker message belongs to when it is clicked", async () => {
    await renderExerciseBlock(makeExercise([makeTask("task-1", 0), makeTask("task-2", 1)]))
    await reportAnswer("task-1", { data: { a: 1 }, valid: true })
    reportConnection("task-2", "failed")

    fireEvent.click(screen.getByRole("button", { name: "submission-blocked-task-not-loaded" }))

    expect(mockFocusFirstInvalid).toHaveBeenCalledWith("task-2")
  })

  it("keeps the blocked submit button focusable", async () => {
    await renderExerciseBlock(makeExercise([makeTask("task-1", 0)]))

    expect(submitButton()).not.toBeDisabled()
    expect(submitButton()).toHaveAttribute("aria-disabled", "true")
  })
})

describe("ExerciseBlock try again", () => {
  it("returns to answering with the submitted answers still counted", async () => {
    await renderExerciseBlock(makeExercise([makeTask("task-1", 0)]))
    await reportAnswer("task-1", { data: { a: 1 }, valid: true })

    const submission = makeStoredSubmission("sub-1", "task-1", { a: 1 })
    const submissionResult = {
      exercise_status: { score_given: 1, reviewing_stage: "NotStarted" },
      exercise_task_submission_results: [
        {
          submission,
          grading: null,
          model_solution_spec: null,
          exercise_task_exercise_service_slug: "survey",
        },
      ],
      user_course_instance_exercise_service_variables: [],
    } as unknown as StudentExerciseSlideSubmissionResult
    mockPostSubmission.mockResolvedValue(submissionResult)
    mockFetchExercise.mockResolvedValue(
      makeExercise([makeTask("task-1", 0, submission)], {
        exercise_slide_submission_counts: { "slide-1": 1 },
      }),
    )

    fireEvent.click(submitButton())
    const tryAgain = await screen.findByRole("button", { name: "try-again" })
    expect(iframeOf("task-1").postThisStateToIFrame.view_type).toBe("view-submission")

    fireEvent.click(tryAgain)

    await waitFor(() =>
      expect(iframeOf("task-1").postThisStateToIFrame.view_type).toBe("answer-exercise"),
    )
    expect(iframeOf("task-1").postThisStateToIFrame.data).toMatchObject({
      previous_submission: { a: 1 },
    })
    expectSubmittable()
  })
})

describe("ExerciseBlock iframe failure reporting", () => {
  const SECRET_ANSWER = "secret-answer-text"

  it("sends exactly one event with the load context and no answer data", async () => {
    await renderExerciseBlock(makeExercise([makeTask("task-1", 0)]))
    await reportAnswer("task-1", { data: { a: SECRET_ANSWER }, valid: true })

    reportConnection("task-1", "loading")
    reportConnection("task-1", "failed", {
      stage: "document-loaded",
      elapsedMs: 10000,
      reloadCount: 1,
    })

    const reports = sentFailureReports()
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({
      error_source: "frontend",
      message: "Exercise iframe failed to load (survey)",
      details: {
        kind: "exercise-iframe-failure",
        failure: "load-failed",
        exercise_service_slug: "survey",
        iframe_origin: "https://plugin.example",
        view_type: "answer-exercise",
        stage: "document-loaded",
        elapsed_ms: 10000,
        reload_count: 1,
        user_agent: navigator.userAgent,
        course_id: "course-1",
        page_id: "page-1",
        exam_id: null,
        exercise_task_id: "task-1",
      },
    })
    const body = mockFetch.mock.calls[0]![1].body as string // safe: one call asserted above
    expect(body).not.toContain(SECRET_ANSWER)
    expect(body).not.toContain("public_spec")
  })

  it("sends nothing for an iframe that connects", async () => {
    await renderExerciseBlock(makeExercise([makeTask("task-1", 0)]))
    reportConnection("task-1", "loading")
    reportConnection("task-1", "connected", { elapsedMs: 800 })
    reportConnection("task-1", "loading", { reloadCount: 1 })
    reportConnection("task-1", "connected", { reloadCount: 1 })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("does not duplicate the event across reloads and re-renders", async () => {
    await renderExerciseBlock(makeExercise([makeTask("task-1", 0)]))
    reportConnection("task-1", "failed", { elapsedMs: 10000 })
    reportConnection("task-1", "loading", { reloadCount: 1 })
    reportConnection("task-1", "failed", {
      stage: "document-loaded",
      elapsedMs: 10000,
      reloadCount: 1,
    })

    mockFetchExercise.mockResolvedValue(
      makeExercise([makeTask("task-1", 0)], {
        exercise: { ...makeExercise([]).exercise, name: "Renamed" },
      }),
    )
    await refetchQueries()
    reportConnection("task-1", "failed", { elapsedMs: 10000, reloadCount: 2 })

    expect(mockFetchExercise).toHaveBeenCalledTimes(2)
    expect(sentFailureReports()).toHaveLength(1)
  })

  it("reports again once the task points to another url", async () => {
    await renderExerciseBlock(makeExercise([makeTask("task-1", 0)]))
    reportConnection("task-1", "failed", { elapsedMs: 10000 })

    mockFetchExercise.mockResolvedValue(
      makeExercise([
        { ...makeTask("task-1", 0), exercise_iframe_url: "https://other.example/iframe" },
      ]),
    )
    await refetchQueries()
    reportConnection("task-1", "failed", { elapsedMs: 10000 })

    expect(sentFailureReports().map((report) => report.details.iframe_origin)).toEqual([
      "https://plugin.example",
      "https://other.example",
    ])
  })

  it("reports a plugin's reload request once, with the last connection state", async () => {
    await renderExerciseBlock(makeExercise([makeTask("task-1", 0)]))
    reportConnection("task-1", "connected", { stage: "state-sent", elapsedMs: 900 })
    act(() => {
      iframeOf("task-1").onReloadRequested?.()
      iframeOf("task-1").onReloadRequested?.()
    })

    const reports = sentFailureReports()
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({
      message: "Exercise iframe requested a reload (survey)",
      details: { failure: "reload-requested", stage: "state-sent", elapsed_ms: 900 },
    })
  })
})
