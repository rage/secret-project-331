import { ViewSubmissionState } from "../util/stateInterfaces"

interface Props {
  state: ViewSubmissionState
}

const ViewSubmission: React.FC<React.PropsWithChildren<Props>> = ({ state }) => {
  if (state.submission.type === "browser") {
    return (
      <>
        {state.submission.files.map((f) => {
          return (
            <>
              <div>{f.filepath}</div>
              <code key={f.filepath}>{f.contents}</code>
            </>
          )
        })}
      </>
    )
  } else if (state.submission.type === "editor") {
    return <div>{state.submission.archiveDownloadUrl}</div>
  } else {
    throw new Error("unreachable")
  }
}

export default ViewSubmission
