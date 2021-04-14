import ExerciseServiceList from "./ExerciseServiceList"

interface Props {
  onChooseItem: (item: any) => void
}

const ChooseExerciseItemType: React.FC<Props> = ({ onChooseItem }) => {
  return <ExerciseServiceList onChooseItem={onChooseItem} />
}

export default ChooseExerciseItemType
