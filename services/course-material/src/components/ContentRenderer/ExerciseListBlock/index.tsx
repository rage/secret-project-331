import { useContext } from "react"
import { BlockRendererProps } from ".."
import PageContext from "../../../contexts/PageContext"
import { normalWidthCenteredComponentStyles } from "../../../styles/componentStyles"
import GenericLoading from "../../GenericLoading"
import ExerciseList from "./ExerciseList"

const ExerciseListBlock: React.FC<BlockRendererProps<unknown>> = () => {
  const chapterId = useContext(PageContext)?.chapter_id

  if (chapterId) {
    return (
      <div className={normalWidthCenteredComponentStyles}>
        <ExerciseList chapterId={chapterId} />
      </div>
    )
  }
  return <GenericLoading />
}

export default ExerciseListBlock
