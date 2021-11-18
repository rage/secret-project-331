import { SetStateMessage } from "../shared-module/iframe-protocol-types"

export type PostThisStateToIFrameState = Omit<SetStateMessage, "message">

export interface ExerciseDownloadedAction {
  type: "exerciseDownloaded"
  payload: Omit<SetStateMessage, "message">
}

export interface SubmissionGradedAction {
  type: "submissionGraded"
  payload: Omit<SetStateMessage, "message">
}

export interface ShowExercise {
  type: "showExercise"
  payload: Omit<SetStateMessage, "message">
}

export type PostThisStateToIFrameAction =
  | ExerciseDownloadedAction
  | SubmissionGradedAction
  | ShowExercise

export default function exerciseBlockPostThisStateToIFrameReducer(
  prev: PostThisStateToIFrameState,
  action: PostThisStateToIFrameAction,
): PostThisStateToIFrameState {
  switch (action.type) {
    case "exerciseDownloaded":
      if (prev.view_type === "view-submission") {
        return prev
      }
      return action.payload
    case "submissionGraded": {
      return action.payload
    }
    case "showExercise": {
      return action.payload
    }
  }
}
