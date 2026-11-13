import { useTranslation } from "react-i18next"

import type { ViewSubmissionState } from "@/util/stateInterfaces"

import SourceFiles from "./SourceFiles"

interface Props {
  state: ViewSubmissionState
}

const ViewSubmission: React.FC<React.PropsWithChildren<Props>> = ({ state }) => {
  const { t } = useTranslation()
  return (
    <>
      <SourceFiles
        files={state.submitted_files}
        studentFilePaths={state.public_spec.student_file_paths}
      />
      {state.submitted_archive_url !== null && (
        <div>
          {t("submission-archive-download-label")}:{" "}
          <a href={state.submitted_archive_url}>{t("download-button")}</a>
        </div>
      )}
    </>
  )
}

export default ViewSubmission
