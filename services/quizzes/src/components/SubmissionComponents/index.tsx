import { ModelSolutionQuizItem, PublicQuizItem, QuizItemAnswer } from "../../../types/types"
import { EssayItemAnswerFeedback, ItemAnswerFeedback } from "../../pages/api/grade"

export interface QuizItemSubmissionComponentProps {
  public_quiz_item: PublicQuizItem
  quiz_item_model_solution: ModelSolutionQuizItem | null
  quiz_item_feedback: ItemAnswerFeedback | EssayItemAnswerFeedback | null
  user_quiz_item_answer: QuizItemAnswer
}
