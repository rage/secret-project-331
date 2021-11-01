import { CourseInstance, Page, UserCourseSettings } from "../shared-module/bindings"

interface PageStateLoading {
  state: "loading"
  pageData: null
  settings: null
  instance: null
  error: null
}

interface PageStateReady {
  state: "ready"
  pageData: Page
  settings: UserCourseSettings | null
  instance: CourseInstance | null
  error: null
}

interface PageStateError {
  state: "error"
  pageData: null
  settings: null
  instance: null
  error: unknown
}

export type CoursePageState = PageStateLoading | PageStateReady | PageStateError

interface RawSetStateAction {
  type: "rawSetState"
  payload: CoursePageState
}

interface SetDataAction {
  type: "setData"
  payload: { pageData: Page; instance: CourseInstance | null; settings: UserCourseSettings | null }
}

interface SetErrorAction {
  type: "setError"
  payload: unknown
}

interface SetLoadingAction {
  type: "setLoading"
}

export type CoursePageStateAction =
  | RawSetStateAction
  | SetDataAction
  | SetErrorAction
  | SetLoadingAction

export default function pageStateReducer(
  prev: CoursePageState,
  action: CoursePageStateAction,
): CoursePageState {
  switch (action.type) {
    case "rawSetState":
      return action.payload
    case "setData": {
      const { instance, pageData, settings } = action.payload
      // eslint-disable-next-line i18next/no-literal-string
      return { ...prev, state: "ready", instance, pageData, settings, error: null }
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
      }
  }
}
