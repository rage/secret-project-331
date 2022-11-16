import { ModelSolutionQuizItem, PublicQuizItem, QuizItemAnswer } from "../../../types/types"
import { ItemAnswerFeedback } from "../../pages/api/grade"
import { UserInformation } from "../../shared-module/exercise-service-protocol-types"
import { FlexDirection } from "../../shared-module/utils/css-sanitization"

export interface QuizItemSubmissionComponentProps {
  public_quiz_item: PublicQuizItem
  quiz_direction: FlexDirection
  quiz_item_model_solution: ModelSolutionQuizItem | null
  quiz_item_feedback: ItemAnswerFeedback | null
  user_quiz_item_answer: QuizItemAnswer
  user_information: UserInformation
}
