import { PrivateSpecQuizItem } from "../../../../types/quizTypes"

import CheckboxEditor from "./checkbox"
import ChooseNEditor from "./choose-n"
import ClosedEndedQuestionEditor from "./closed-ended-question"
import EssayEditor from "./essay"
import MatrixEditor from "./matrix"
import MultipleChoiceEditor from "./multiple-choice"
import MultipleChoiceDropdownEditor from "./multiple-choice-dropdown"
import ScaleEditor from "./scale"
import TimelineEditor from "./timeline"
import UnsupportedExercise from "./unsupported"

interface QuizEditor {
  quizItem: PrivateSpecQuizItem
}

const QuizEditor: React.FC<QuizEditor> = ({ quizItem }) => {
  switch (quizItem.type) {
    case "multiple-choice":
      return <MultipleChoiceEditor quizItemId={quizItem.id} />
    case "multiple-choice-dropdown":
      return <MultipleChoiceDropdownEditor quizItem={quizItem} />
    case "choose-n":
      return <ChooseNEditor quizItem={quizItem} />
    case "scale":
      return <ScaleEditor quizItemId={quizItem.id} />
    case "checkbox":
      return <CheckboxEditor quizItemId={quizItem.id} />
    case "essay":
      return <EssayEditor quizItemId={quizItem.id} />
    case "closed-ended-question":
      return <ClosedEndedQuestionEditor quizItem={quizItem} />
    case "matrix":
      return <MatrixEditor quizItemId={quizItem.id} />
    case "timeline":
      return <TimelineEditor quizItem={quizItem} />
    default:
      return <UnsupportedExercise />
  }
}

export default QuizEditor
