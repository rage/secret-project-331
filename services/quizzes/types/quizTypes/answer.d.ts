export interface UserAnswer {
  id: string
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
  id: string
  type: "multiple-choice"
  /** Whether or not the provided answer can be submitted. */
  valid: boolean
  quizItemId: string
  selectedOptionIds: string[]
}

export interface UserItemAnswerEssay {
  id: string
  type: "essay"
  /** Whether or not the provided answer can be submitted. */
  valid: boolean
  quizItemId: string
  textData: string
}

export interface UserItemAnswerScale {
  id: string
  type: "scale"
  /** Whether or not the provided answer can be submitted. */
  valid: boolean
  quizItemId: string
  intData: number
  optionAnswers: string[] | null
}

export interface UserItemAnswerCheckbox {
  id: string
  type: "checkbox"
  /** Whether or not the provided answer can be submitted. */
  valid: boolean
  quizItemId: string
  checked: boolean
}

export interface UserItemAnswerClosedEndedQuestion {
  id: string
  type: "closed-ended-question"
  /** Whether or not the provided answer can be submitted. */
  valid: boolean
  quizItemId: string
  textData: string
}

export interface UserItemAnswerMatrix {
  id: string
  type: "matrix"
  /** Whether or not the provided answer can be submitted. */
  valid: boolean
  quizItemId: string
  matrix: string[][]
}

export interface TimelineChoice {
  /** We use timelineItem id to match for answers so that this is resilient to typo fixes in the year */
  timelineItemId: string
  /** We use a generated id to match the choices to options to make this resilient to typo fixes event name. */
  chosenEventId: string
}

export interface UserItemAnswerTimeline {
  id: string
  type: "timeline"
  /** Whether or not the provided answer can be submitted. */
  valid: boolean
  quizItemId: string
  timelineChoices: TimelineChoice[]
}

export interface UserItemAnswerChooseN {
  id: string
  type: "choose-n"
  /** Whether or not the provided answer can be submitted. */
  valid: boolean
  quizItemId: string
  selectedOptionIds: string[]
}

export interface UserItemAnswerMultiplechoiceDropdown {
  id: string
  type: "multiple-choice-dropdown"
  /** Whether or not the provided answer can be submitted. */
  valid: boolean
  quizItemId: string
  selectedOptionIds: string[]
}
