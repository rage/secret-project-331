import { useTranslation } from "react-i18next"

import { ViewSubmissionState } from "../util/stateInterfaces"

interface Props {
  state: ViewSubmissionState
}

const ViewSubmission: React.FC<React.PropsWithChildren<Props>> = ({ state }) => {
  const { t } = useTranslation()

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
    return (
      <div>
        {t("submission-archive-download-label")}:{" "}
        <a href={state.submission.archive_download_url}>{t("download-submission-button")}</a>
      </div>
    )
  } else {
    throw new Error("unreachable")
  }
}

export default ViewSubmission
