import ExerciseServiceList, { ExerciseItemTypes } from "./ExerciseServiceList"

interface Props {
  onChooseItem: (item: ExerciseItemTypes) => void
}

const ChooseExerciseItemType: React.FC<Props> = ({ onChooseItem }) => {
  return <ExerciseServiceList onChooseItem={onChooseItem} />
}

export default ChooseExerciseItemType
