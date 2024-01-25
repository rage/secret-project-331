import React from "react"

import { AnswerRequiringAttentionWithTasks } from "../../../../../../shared-module/common/bindings"
import Centered from "../../../../../../shared-module/common/components/Centering/Centered"
import DebugModal from "../../../../../../shared-module/common/components/DebugModal"

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
