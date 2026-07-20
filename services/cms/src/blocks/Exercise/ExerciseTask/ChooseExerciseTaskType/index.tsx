"use client"

import type { ExerciseServiceIframeRenderingInfo } from "@/generated/api"

import ExerciseServiceList from "./ExerciseServiceList"

interface Props {
  onChooseItem: (task: ExerciseServiceIframeRenderingInfo) => void
}

const ChooseExerciseTaskType: React.FC<React.PropsWithChildren<Props>> = ({ onChooseItem }) => {
  return <ExerciseServiceList onChooseItem={onChooseItem} />
}

export default ChooseExerciseTaskType
