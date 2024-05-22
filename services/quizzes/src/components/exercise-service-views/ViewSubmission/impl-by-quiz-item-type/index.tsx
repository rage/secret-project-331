import { UserItemAnswer } from "../../../../../types/quizTypes/answer"
import { ItemAnswerFeedback } from "../../../../../types/quizTypes/grading"
import { ModelSolutionQuizItem } from "../../../../../types/quizTypes/modelSolutionSpec"
import { PublicSpecQuizItem } from "../../../../../types/quizTypes/publicSpec"
import { FlexDirection } from "../../../../util/css-sanitization"

import { UserInformation } from "@/shared-module/common/exercise-service-protocol-types"

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
