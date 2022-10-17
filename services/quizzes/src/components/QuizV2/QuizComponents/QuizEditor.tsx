import { PrivateSpecQuizItem } from "../../../../types/quizTypes"

import MultipleChoiceEditor from "./multiple-choice"
import UnsupportedExercise from "./unsupported"

interface QuizEditor {
  quizItem: PrivateSpecQuizItem
}

const QuizEditor: React.FC<QuizEditor> = ({ quizItem }) => {
  switch (quizItem.type) {
    case "multiple-choice":
      return <MultipleChoiceEditor quizItem={quizItem} />
    default:
      return <UnsupportedExercise />
  }
}

export default QuizEditor
