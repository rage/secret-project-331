/**
 * from: IFrame
 *
 * to: parent
 */
export interface CurrentStateMessage {
  message: "current-state"
  data: unknown
  valid: boolean
}

/**
 * from: IFrame
 *
 * to: parent
 */
export interface HeightChangedMessage {
  message: "height-changed"
  data: number
}

/**
 * from: IFrame
 *
 * to: parent
 */
export interface ReadyMessage {
  message: "ready"
}

export type ViewType = "exercise" | "view-submission" | "exercise-editor" | "playground-exercise"

/**
 * from: parent
 *
 * to: IFrame
 */
export interface SetStateMessage {
  message: "set-state"
  view_type: ViewType
  data: unknown
}
