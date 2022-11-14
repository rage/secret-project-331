import { PrivateSpecQuizItem } from "../../../../types/quizTypes"

import CheckboxEditor from "./checkbox"
import ClosedEndedQuestionEditor from "./closed-ended-question"
import EssayEditor from "./essay"
import MatrixEditor from "./matrix"
import MultipleChoiceEditor from "./multiple-choice"
import ScaleEditor from "./scale"
import TimelineEditor from "./timeline"
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
    case "closed-ended-question":
      return <ClosedEndedQuestionEditor quizItem={quizItem} />
    case "matrix":
      return <MatrixEditor quizItem={quizItem} />
    case "timeline":
      return <TimelineEditor quizItem={quizItem} />
    default:
      return <UnsupportedExercise />
  }
}

export default QuizEditor
