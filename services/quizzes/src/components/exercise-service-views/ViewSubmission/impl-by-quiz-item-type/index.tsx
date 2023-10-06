import { UserItemAnswer } from "../../../../../types/quizTypes/answer"
import { ModelSolutionQuizItem } from "../../../../../types/quizTypes/modelSolutionSpec"
import { PublicSpecQuizItem } from "../../../../../types/quizTypes/publicSpec"
import { ItemAnswerFeedback } from "../../../../grading/feedback"
import { UserInformation } from "../../../../shared-module/exercise-service-protocol-types"
import { FlexDirection } from "../../../../util/css-sanitization"

export interface QuizItemSubmissionComponentProps<
  T extends PublicSpecQuizItem,
  K extends UserItemAnswer,
> {
  public_quiz_item: T
  quiz_direction: FlexDirection
  quiz_item_model_solution: ModelSolutionQuizItem | null
  quiz_item_feedback: ItemAnswerFeedback | null
  user_quiz_item_answer: K
  user_information: UserInformation
}
