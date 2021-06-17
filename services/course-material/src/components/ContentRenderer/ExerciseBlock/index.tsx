import { css } from "@emotion/css"
import { useQuery } from "react-query"
import ContentRenderer, { BlockRendererProps } from ".."
import { Block, fetchExerciseById } from "../../../services/backend"
import { normalWidthCenteredComponentStyles } from "../../../styles/componentStyles"
import GenericLoading from "../../GenericLoading"
import HelpIcon from "@material-ui/icons/Help"
import ExerciseTaskIframe from "./ExerciseTaskIframe"
import { defaultContainerWidth } from "../../../styles/constants"
import { useState } from "react"
import DebugModal from "../../DebugModal"
import { Button } from "@material-ui/core"

interface ExerciseBlockAttributes {
  id: string
}

const exericseTypeToIframeUrl: { [key: string]: string | undefined } = {
  example: "/example-exercise/exercise",
}

// Special care taken here to ensure exercise content can have full width of
// the page.
const ExerciseBlock: React.FC<BlockRendererProps<ExerciseBlockAttributes>> = (props) => {
  const id = props.data.attributes.id
  const { isLoading, error, data } = useQuery(`exercise-${id}`, () => fetchExerciseById(id))
  const [answer, setAnswer] = useState<unknown>(null)

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <GenericLoading />
  }

  const currentType = data.current_exercise_task.exercise_type
  const url = exericseTypeToIframeUrl[currentType]

  const currentExerciseTaskAssignment = data.current_exercise_task
    .assignment as unknown as Block<unknown>[]

  return (
    <div
      className={css`
        width: 100%;
        background: #f6f6f6;
        margin-bottom: 1rem;
        padding-top: 2rem;
      `}
      id={id}
    >
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
          display: flex;
          align-items: center;
          margin-bottom: 1.5rem;
        `}
      >
        <HelpIcon
          className={css`
            height: 5rem !important;
            width: 5rem !important;
            margin-right: 1rem;
          `}
        />
        <h2
          className={css`
            font-size: 2rem;
            font-weight: 400;
          `}
        >
          {data.exercise.name}
        </h2>
        <div
          className={css`
            flex: 1;
          `}
        />
        <div
          className={css`
            font-size: 1rem;
            text-align: center;
          `}
        >
          Points:
          <br />
          {data.exercise_status?.score_given ?? 0}/{data.exercise.score_maximum}
        </div>
      </div>
      {currentExerciseTaskAssignment && <ContentRenderer data={currentExerciseTaskAssignment} />}
      {url ? (
        <ExerciseTaskIframe
          public_spec={data.current_exercise_task.public_spec}
          url={`${url}?width=${defaultContainerWidth}`}
          setAnswer={setAnswer}
        />
      ) : (
        "Don't know how to render this assignment"
      )}
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
          button {
            margin-bottom: 0.5rem;
          }
        `}
      >
        <Button color="primary" variant="contained">
          Submit
        </Button>
        <br />
        <DebugModal data={data} />
      </div>
    </div>
  )
}

export default ExerciseBlock
