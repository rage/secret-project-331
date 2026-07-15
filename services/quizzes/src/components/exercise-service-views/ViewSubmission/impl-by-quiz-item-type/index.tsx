import type { UserInformation } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import type { FlexDirection } from "@/util/css-sanitization"

import type { UserItemAnswer } from "../../../../../types/quizTypes/answer"
import type { ItemAnswerFeedback } from "../../../../../types/quizTypes/grading"
import type { ModelSolutionQuizItem } from "../../../../../types/quizTypes/modelSolutionSpec"
import type { PublicSpecQuizItem } from "../../../../../types/quizTypes/publicSpec"

export interface QuizItemSubmissionComponentProps<
  T extends PublicSpecQuizItem,
  K extends UserItemAnswer,
> {
  public_quiz_item: T
  quiz_direction: FlexDirection
  quiz_item_model_solution: ModelSolutionQuizItem | null
  quiz_item_answer_feedback: ItemAnswerFeedback | null
  user_quiz_item_answer: K
  user_information: UserInformation
}
