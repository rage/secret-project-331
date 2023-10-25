import { DisplayDirection, multipleChoiceMultipleOptionsGradingPolicy } from "./privateSpec"

export interface PublicSpecQuiz {
  version: "2"
  items: PublicSpecQuizItem[]
  title: string | null
  body: string | null
  quizItemDisplayDirection: DisplayDirection
}

export type PublicSpecQuizItem =
  | PublicSpecQuizItemMultiplechoice
  | PublicSpecQuizItemEssay
  | PublicSpecQuizItemScale
  | PublicSpecQuizItemCheckbox
  | PublicSpecQuizItemClosedEndedQuestion
  | PublicSpecQuizItemMatrix
  | PublicSpecQuizItemTimeline
  | PublicSpecQuizItemChooseN
  | PublicSpecQuizItemMultiplechoiceDropdown

export interface PublicQuizItemOption {
  id: string
  order: number
  title: string | null
  body: string | null
}

export interface PublicSpecQuizItemMultiplechoice {
  type: "multiple-choice"
  shuffleOptions: boolean
  id: string
  order: number
  allowSelectingMultipleOptions: boolean
  options: PublicQuizItemOption[]
  title: string | null
  body: string | null
  optionDisplayDirection: DisplayDirection
  multipleChoiceMultipleOptionsGradingPolicy: multipleChoiceMultipleOptionsGradingPolicy
}

export interface PublicSpecQuizItemEssay {
  type: "essay"
  id: string
  order: number
  minWords: number | null
  maxWords: number | null
  title: string | null
  body: string | null
}

export interface PublicSpecQuizItemScale {
  type: "scale"
  id: string
  order: number
  maxValue: number | null
  minValue: number | null
  maxLabel: string | null
  minLabel: string | null
  optionAnswers: string[] | null
  title: string | null
  body: string | null
}

export interface PublicSpecQuizItemCheckbox {
  type: "checkbox"
  id: string
  order: number
  title: string | null
  body: string | null
}

export interface PublicSpecQuizItemClosedEndedQuestion {
  type: "closed-ended-question"
  id: string
  order: number
  formatRegex: string | null
  title: string | null
  body: string | null
}

export interface PublicSpecQuizItemMatrix {
  type: "matrix"
  id: string
  order: number
}

export interface PublicSpecQuizItemTimelineItem {
  itemId: string
  /** The year the student is supposed to match to an event. */
  year: string
}

export interface PublicTimelineEvent {
  eventId: string
  name: string
}

export interface PublicSpecQuizItemTimeline {
  type: "timeline"
  id: string
  order: number
  timelineItems: PublicSpecQuizItemTimelineItem[]
  events: PublicTimelineEvent[]
}

export interface PublicSpecQuizItemChooseN {
  type: "choose-n"
  id: string
  order: number
  n: number
  options: PublicQuizItemOption[]
  title: string | null
  body: string | null
}

export interface PublicSpecQuizItemMultiplechoiceDropdown {
  type: "multiple-choice-dropdown"
  id: string
  order: number
  options: PublicQuizItemOption[]
  title: string | null
  body: string | null
}
