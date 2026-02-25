"use client"

import { useTranslation } from "react-i18next"

import { UserAnswer, ViewSubmissionState } from "@/util/stateInterfaces"

/** Unwrap submission if stored as { private_spec: UserAnswer } (same as grade API). */
export function normalizeSubmission(submission: ViewSubmissionState["submission"]): UserAnswer {
  if (submission.type === "browser" || submission.type === "editor") {
    return submission
  }
  const raw = submission as unknown as { private_spec?: UserAnswer }
  if (
    raw?.private_spec &&
    (raw.private_spec.type === "browser" || raw.private_spec.type === "editor")
  ) {
    return raw.private_spec
  }
  return submission
}

interface Props {
  state: ViewSubmissionState
}

const ViewSubmission: React.FC<React.PropsWithChildren<Props>> = ({ state }) => {
  const { t } = useTranslation()
  const submission = normalizeSubmission(state.submission)

  if (submission.type === "browser") {
    const studentPaths = new Set(state.public_spec.student_file_paths ?? [])
    const filesToShow =
      studentPaths.size > 0
        ? submission.files.filter((f) => studentPaths.has(f.filepath))
        : submission.files
    return (
      <>
        {filesToShow.map((f) => (
          <div key={f.filepath}>
            <div>{f.filepath}</div>
            <code>{f.contents}</code>
          </div>
        ))}
      </>
    )
  }
  if (submission.type === "editor") {
    return (
      <div>
        {t("submission-archive-download-label")}:{" "}
        <a href={submission.archive_download_url}>{t("download-submission-button")}</a>
      </div>
    )
  }
  return null
}

export default ViewSubmission
