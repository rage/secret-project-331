import { CourseInstance, CoursePage } from "../services/backend"

interface PageStateLoading {
  state: "loading"
  pageData: null
  instance: null
  error: null
}

interface PageStateReady {
  state: "ready"
  pageData: CoursePage
  instance: CourseInstance | null
  error: null
}

interface PageStateError {
  state: "error"
  pageData: null
  instance: null
  error: Error
}

export type CoursePageState = PageStateLoading | PageStateReady | PageStateError

interface RawSetStateAction {
  type: "rawSetState"
  payload: CoursePageState
}

interface SetDataAction {
  type: "setData"
  payload: { pageData: CoursePage; instance: CourseInstance | null }
}

interface SetErrorAction {
  type: "setError"
  payload: Error
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
    case "setData":
      return { ...prev, state: "ready", ...action.payload, error: null }
    case "setError":
      return { ...prev, state: "error", error: action.payload, instance: null, pageData: null }
    case "setLoading":
      return { ...prev, state: "loading", error: null, instance: null, pageData: null }
  }
}
