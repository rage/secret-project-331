"use client"

import React from "react"

import type { AnswerRequiringAttentionWithTasks } from "@/generated/api/types.generated"
import Centered from "@/shared-module/common/components/Centering/Centered"
import DebugModal from "@/shared-module/common/components/DebugModal"

import AnswersRequiringAttentionItem from "./AnswersRequiringAttentionItem"
import ExerciseAssignmentPreview from "./ExerciseAssignmentPreview"

interface Props {
  answersRequiringAttention: AnswerRequiringAttentionWithTasks[]
  exercise_max_points: number
  courseId: string | null
  refetch: () => void
}

const AnswersRequiringAttentionList: React.FC<Props> = ({
  answersRequiringAttention,
  exercise_max_points,
  courseId,
  refetch,
}) => {
  return (
    <>
      <Centered variant="narrow">
        {answersRequiringAttention[0] && (
          <ExerciseAssignmentPreview tasks={answersRequiringAttention[0].tasks} />
        )}
        {answersRequiringAttention.map((answerRequiringAttention) => (
          <AnswersRequiringAttentionItem
            key={answerRequiringAttention.id}
            answerRequiringAttention={answerRequiringAttention}
            exerciseMaxPoints={exercise_max_points}
            courseId={courseId}
            refetch={refetch}
          />
        ))}
      </Centered>
      <DebugModal data={answersRequiringAttention} />
    </>
  )
}

export default AnswersRequiringAttentionList
