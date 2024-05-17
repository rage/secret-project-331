import { ExerciseServiceIframeRenderingInfo } from "../../../shared-module/common/bindings"

import ExerciseServiceList from "./ExerciseServiceList"

interface Props {
  onChooseItem: (task: ExerciseServiceIframeRenderingInfo) => void
}

const ChooseExerciseTaskType: React.FC<React.PropsWithChildren<Props>> = ({ onChooseItem }) => {
  return <ExerciseServiceList onChooseItem={onChooseItem} />
}

export default ChooseExerciseTaskType
