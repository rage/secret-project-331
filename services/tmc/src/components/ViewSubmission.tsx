/* eslint-disable i18next/no-literal-string */
import { ViewSubmissionState } from "../util/stateInterfaces"

interface Props {
  state: ViewSubmissionState
}

const ViewSubmission: React.FC<React.PropsWithChildren<Props>> = ({ state }) => {
  if (state.userAnswer.type === "browser") {
    return <code>{state.userAnswer.fileContents}</code>
  } else if (state.userAnswer.type === "editor") {
    return (
      <>
        {state.userAnswer.answerFiles.map((f) => (
          <>
            <div>{f.filepath}</div>
            <code>{f.contents}</code>
          </>
        ))}
      </>
    )
  } else {
    throw "unreachable"
  }
}

export default ViewSubmission
