import React from "react"

import { AnswerRequiringAttentionWithTasks } from "../../../../../../shared-module/bindings"
import Centered from "../../../../../../shared-module/components/Centering/Centered"
import DebugModal from "../../../../../../shared-module/components/DebugModal"

import AnswersRequiringAttentionItem from "./AnswersRequiringAttentionItem"

interface Props {
  answersRequiringAttention: AnswerRequiringAttentionWithTasks[]
  exercise_max_points: number
  refetch: () => void
}

const AnswersRequiringAttentionList: React.FC<Props> = ({
  answersRequiringAttention,
  exercise_max_points,
  refetch,
}) => {
  return (
    <>
      <Centered variant="narrow">
        {answersRequiringAttention.map((answerRequiringAttention) => (
          <AnswersRequiringAttentionItem
            key={answerRequiringAttention.id}
            answerRequiringAttention={answerRequiringAttention}
            exerciseMaxPoints={exercise_max_points}
            refetch={refetch}
          />
        ))}
      </Centered>
      <DebugModal data={answersRequiringAttention} />
    </>
  )
}

export default AnswersRequiringAttentionList
