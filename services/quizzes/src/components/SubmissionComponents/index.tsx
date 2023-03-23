import { UserItemAnswer } from "../../../types/quizTypes/answer"
import { ModelSolutionQuizItem } from "../../../types/quizTypes/modelSolutionSpec"
import { PublicSpecQuizItem } from "../../../types/quizTypes/publicSpec"
import { ItemAnswerFeedback } from "../../pages/api/grade"
import { UserInformation } from "../../shared-module/exercise-service-protocol-types"
import { FlexDirection } from "../../shared-module/utils/css-sanitization"

export interface QuizItemSubmissionComponentProps<T extends PublicSpecQuizItem> {
  public_quiz_item: T
  quiz_direction: FlexDirection
  quiz_item_model_solution: ModelSolutionQuizItem | null
  quiz_item_feedback: ItemAnswerFeedback | null
  user_quiz_item_answer: UserItemAnswer
  user_information: UserInformation
}
