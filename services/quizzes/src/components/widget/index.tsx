import { PublicQuiz } from "../../types/types"
import HeightTrackingContainer from "../HeightTrackingComponent"

import MultipleChoice from "./MultipleChoice"
import Unsupported from "./Unsupported"

interface WidgetProps {
  quiz: PublicQuiz[]
  port: MessagePort
  maxWidth: number | null
}

type QuizItemType =
  | "essay"
  | "multiple-choice"
  | "scale"
  | "checkbox"
  | "open"
  | "custom-frontend-accept-data"

const componentsByTypeNames = (typeName: QuizItemType) => {
  const mapTypeToComponent = {
    essay: Unsupported,
    "multiple-choice": MultipleChoice,
    scale: Unsupported,
    checkbox: Unsupported,
    open: Unsupported,
    "custom-frontend-accept-data": Unsupported,
    "multiple-choice-dropdown": Unsupported,
    "clickable-multiple-choice": Unsupported,
  }

  return mapTypeToComponent[typeName]
}

const Widget: React.FC<WidgetProps> = ({ quiz, port }) => {
  return (
    <div>
      <HeightTrackingContainer port={port}>
        {quiz[0].items
          .sort((i1, i2) => i1.order - i2.order)
          .map((i) => {
            const Component = componentsByTypeNames(i.type as QuizItemType)
            return <Component key={i.id} />
          })}
      </HeightTrackingContainer>
    </div>
  )
}

export default Widget
