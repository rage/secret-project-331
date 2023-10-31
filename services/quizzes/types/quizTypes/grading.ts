export type QuizzesGrading = QuizItemAnswerGrading[]

export interface OptionAnswerFeedback {
  option_id: string | null
  option_feedback: string | null
  this_option_was_correct: boolean | null
}

export interface TimelineItemFeedback {
  timeline_item_id: string | null
  what_was_chosen_was_correct: boolean
}

export interface ItemAnswerFeedback {
  quiz_item_id: string | null
  /** Custom feedback message to be shown under the quiz item. */
  quiz_item_feedback: string | null
  quiz_item_option_feedbacks: OptionAnswerFeedback[] | null
  timeline_item_feedbacks: TimelineItemFeedback[] | null
  /** The points for this quiz item will be multiplied with the correctness coefficient.
   *
   * For example, if this quiz item is worth 2 points and the correctness coefficient 0.75, the
   * user would get `2*0.75=1.5` points for this quiz item.
   *
   * * 0 will be regarded as an incorrect answer
   * * 0 < x < 1 will be regarded as a partially correct answer
   * * 1 will be regarded as a correct answer
   *
   */
  correctnessCoefficient: number
  score?: number
}

export interface QuizItemAnswerGrading {
  /** The points for this quiz item will be multiplied with the correctness coefficient.
   *
   * For example, if this quiz item is worth 2 points and the correctness coefficient 0.75, the
   * user would get `2*0.75=1.5` points for this quiz item.
   *
   * * 0 will be regarded as an incorrect answer
   * * 0 < x < 1 will be regarded as a partially correct answer
   * * 1 will be regarded as a correct answer
   *
   */
  correctnessCoefficient: number
  quizItemId: string
}
