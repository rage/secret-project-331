import ExerciseServiceList, { ExerciseTaskTypes } from "./ExerciseServiceList"

interface Props {
  onChooseItem: (task: ExerciseTaskTypes) => void
}

const ChooseExerciseTaskType: React.FC<React.PropsWithChildren<Props>> = ({ onChooseItem }) => {
  return <ExerciseServiceList onChooseItem={onChooseItem} />
}

export default ChooseExerciseTaskType
