import { ExerciseService } from "../../../shared-module/bindings"

import ExerciseServiceList from "./ExerciseServiceList"

interface Props {
  onChooseItem: (task: ExerciseService) => void
}

const ChooseExerciseTaskType: React.FC<React.PropsWithChildren<Props>> = ({ onChooseItem }) => {
  return <ExerciseServiceList onChooseItem={onChooseItem} />
}

export default ChooseExerciseTaskType
