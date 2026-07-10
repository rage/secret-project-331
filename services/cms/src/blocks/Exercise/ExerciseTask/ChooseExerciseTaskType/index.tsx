"use client"

import ExerciseServiceList from "./ExerciseServiceList"

import type { ExerciseServiceIframeRenderingInfo } from "@/generated/api"

interface Props {
  onChooseItem: (task: ExerciseServiceIframeRenderingInfo) => void
}

const ChooseExerciseTaskType: React.FC<React.PropsWithChildren<Props>> = ({ onChooseItem }) => {
  return <ExerciseServiceList onChooseItem={onChooseItem} />
}

export default ChooseExerciseTaskType
