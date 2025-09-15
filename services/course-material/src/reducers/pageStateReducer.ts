import {
  Course,
  CourseInstance,
  ExamData,
  Organization,
  Page,
  UserCourseSettings,
} from "@/shared-module/common/bindings"

interface PageStateLoading {
  state: "loading"
  pageData: null
  organization: null
  settings: null
  instance: null
  exam: null
  course: null
  isTest: boolean
  error: null

  refetchPage?: () => Promise<void>
}

interface PageStateReady {
  state: "ready"
  pageData: Page
  organization: Organization
  settings: UserCourseSettings | null
  instance: CourseInstance | null
  exam: ExamData | null
  course: Course | null
  isTest: boolean
  error: null

  refetchPage?: () => Promise<void>
}

interface PageStateError {
  state: "error"
  pageData: null
  organization: null
  settings: null
  instance: null
  exam: null
  course: null
  isTest: boolean
  error: unknown
  refetchPage?: () => Promise<void>
}

export type PageState = PageStateLoading | PageStateReady | PageStateError

interface RawSetStateAction {
  type: "rawSetState"
  payload: PageState
}

interface SetDataAction {
  type: "setData"
  payload: {
    pageData: Page
    instance: CourseInstance | null
    settings: UserCourseSettings | null
    exam: ExamData | null
    course: Course | null
    isTest: boolean
  }
}

interface SetErrorAction {
  type: "setError"
  payload: unknown
}

interface SetLoadingAction {
  type: "setLoading"
}

export type PageStateAction = RawSetStateAction | SetDataAction | SetErrorAction | SetLoadingAction

export default function pageStateReducer(prev: PageState, action: PageStateAction): PageState {
  if (action === null || action === undefined) {
    return prev
  }
  switch (action.type) {
    case "rawSetState":
      return action.payload
    case "setData": {
      const { instance, pageData, settings, exam, course, isTest, organization } = action.payload

      return {
        ...prev,
        state: "ready",
        instance,
        pageData,
        organization,
        settings,
        exam,
        course,
        isTest,
        error: null,
      }
    }
    case "setError":
      return {
        ...prev,

        state: "error",
        error: action.payload,
        instance: null,
        pageData: null,
        organization: null,
        settings: null,
        exam: null,
        course: null,
        isTest: false,
      }
    case "setLoading":
      return {
        ...prev,

        state: "loading",
        error: null,
        instance: null,
        pageData: null,
        organization: null,
        settings: null,
        exam: null,
        course: null,
        isTest: false,
      }
  }
}
