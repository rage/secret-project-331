import { CourseInstance, ExamData, Page, UserCourseSettings } from "@/shared-module/common/bindings"

interface PageStateLoading {
  state: "loading"
  pageData: null
  settings: null
  instance: null
  exam: null
  isTest: boolean
  error: null
  refetchPage?: () => Promise<void>
}

interface PageStateReady {
  state: "ready"
  pageData: Page
  settings: UserCourseSettings | null
  instance: CourseInstance | null
  exam: ExamData | null
  isTest: boolean
  error: null
  refetchPage?: () => Promise<void>
}

interface PageStateError {
  state: "error"
  pageData: null
  settings: null
  instance: null
  exam: null
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
      const { instance, pageData, settings, exam, isTest } = action.payload
      // eslint-disable-next-line i18next/no-literal-string
      return { ...prev, state: "ready", instance, pageData, settings, exam, isTest, error: null }
    }
    case "setError":
      return {
        ...prev,
        // eslint-disable-next-line i18next/no-literal-string
        state: "error",
        error: action.payload,
        instance: null,
        pageData: null,
        settings: null,
        exam: null,
        isTest: false,
      }
    case "setLoading":
      return {
        ...prev,
        // eslint-disable-next-line i18next/no-literal-string
        state: "loading",
        error: null,
        instance: null,
        pageData: null,
        settings: null,
        exam: null,
        isTest: false,
      }
  }
}
