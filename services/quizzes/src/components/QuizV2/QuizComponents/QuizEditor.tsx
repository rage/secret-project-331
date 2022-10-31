import { PrivateSpecQuizItem } from "../../../../types/quizTypes"

import CheckboxEditor from "./checkbox"
import EssayEditor from "./essay"
import MultipleChoiceEditor from "./multiple-choice"
import ScaleEditor from "./scale"
import UnsupportedExercise from "./unsupported"

interface QuizEditor {
  quizItem: PrivateSpecQuizItem
}

const QuizEditor: React.FC<QuizEditor> = ({ quizItem }) => {
  switch (quizItem.type) {
    case "multiple-choice":
      return <MultipleChoiceEditor quizItem={quizItem} />
    case "scale":
      return <ScaleEditor quizItem={quizItem} />
    case "checkbox":
      return <CheckboxEditor quizItem={quizItem} />
    case "essay":
      return <EssayEditor quizItem={quizItem} />
    default:
      return <UnsupportedExercise />
  }
}

export default QuizEditor
