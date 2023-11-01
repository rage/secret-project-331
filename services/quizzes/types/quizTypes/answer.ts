export interface UserAnswer {
  version: string
  itemAnswers: UserItemAnswer[]
}

export type UserItemAnswer =
  | UserItemAnswerMultiplechoice
  | UserItemAnswerEssay
  | UserItemAnswerScale
  | UserItemAnswerCheckbox
  | UserItemAnswerClosedEndedQuestion
  | UserItemAnswerMatrix
  | UserItemAnswerTimeline
  | UserItemAnswerChooseN
  | UserItemAnswerMultiplechoiceDropdown

export interface UserItemAnswerMultiplechoice {
  type: "multiple-choice"
  /** Whether or not the provided answer can be submitted. */
  valid: boolean
  quizItemId: string
  selectedOptionIds: string[]
}

export interface UserItemAnswerEssay {
  type: "essay"
  /** Whether or not the provided answer can be submitted. */
  valid: boolean
  quizItemId: string
  textData: string
}

export interface UserItemAnswerScale {
  type: "scale"
  /** Whether or not the provided answer can be submitted. */
  valid: boolean
  quizItemId: string
  /** The number that was selected */
  intData: number
}

export interface UserItemAnswerCheckbox {
  type: "checkbox"
  /** Whether or not the provided answer can be submitted. */
  valid: boolean
  quizItemId: string
  checked: boolean
}

export interface UserItemAnswerClosedEndedQuestion {
  type: "closed-ended-question"
  /** Whether or not the provided answer can be submitted. */
  valid: boolean
  quizItemId: string
  textData: string
}

export interface UserItemAnswerMatrix {
  type: "matrix"
  /** Whether or not the provided answer can be submitted. */
  valid: boolean
  quizItemId: string
  matrix: string[][]
}
/**
 * @see {@link PrivateSpecQuizItemTimelineItem}
 */
export interface TimelineChoice {
  /** We use timelineItem id to match for answers so that this is resilient to typo fixes in the year. This is matched to PrivateSpecQuizItemTimelineItem.id. */
  timelineItemId: string
  /** We use a generated id to match the choices to options to make this resilient to typo fixes event name. This is matched to PrivateSpecQuizItemTimelineItem.correctEventId */
  chosenEventId: string
}

export interface UserItemAnswerTimeline {
  type: "timeline"
  /** Whether or not the provided answer can be submitted. */
  valid: boolean
  quizItemId: string
  timelineChoices: TimelineChoice[]
}

export interface UserItemAnswerChooseN {
  type: "choose-n"
  /** Whether or not the provided answer can be submitted. */
  valid: boolean
  quizItemId: string
  selectedOptionIds: string[]
}

export interface UserItemAnswerMultiplechoiceDropdown {
  type: "multiple-choice-dropdown"
  /** Whether or not the provided answer can be submitted. */
  valid: boolean
  quizItemId: string
  selectedOptionIds: string[]
}
