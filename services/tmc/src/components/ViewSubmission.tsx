import { useTranslation } from "react-i18next"

import type { ViewSubmissionState } from "@/util/stateInterfaces"

interface Props {
  state: ViewSubmissionState
}

const ViewSubmission: React.FC<React.PropsWithChildren<Props>> = ({ state }) => {
  const { t } = useTranslation()
  const studentPaths = new Set(state.public_spec.student_file_paths ?? [])
  const filesToShow =
    studentPaths.size > 0
      ? state.submitted_files.filter((f) => studentPaths.has(f.filepath))
      : state.submitted_files

  return (
    <>
      {filesToShow.map((f) => (
        <div key={f.filepath}>
          <div>{f.filepath}</div>
          <code>{f.contents}</code>
        </div>
      ))}
      {state.submitted_archive_url !== null && (
        <div>
          {t("submission-archive-download-label")}:{" "}
          <a href={state.submitted_archive_url}>{t("download-submission-button")}</a>
        </div>
      )}
    </>
  )
}

export default ViewSubmission
