import { CourseInstance, Page } from "../shared-module/bindings"

interface PageStateLoading {
  state: "loading"
  pageData: null
  instance: null
  error: null
}

interface PageStateReady {
  state: "ready"
  pageData: Page
  instance: CourseInstance | null
  error: null
}

interface PageStateError {
  state: "error"
  pageData: null
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
  payload: { pageData: Page; instance: CourseInstance | null }
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
      const { instance, pageData } = action.payload
      return { ...prev, state: "ready", instance, pageData, error: null }
    }
    case "setError":
      return { ...prev, state: "error", error: action.payload, instance: null, pageData: null }
    case "setLoading":
      return { ...prev, state: "loading", error: null, instance: null, pageData: null }
  }
}
