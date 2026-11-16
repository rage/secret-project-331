import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import type { ViewSubmissionState } from "@/util/stateInterfaces"

import SourceFiles from "./SourceFiles"

interface Props {
  state: ViewSubmissionState
}

/** The revealed model solution's student files and a link to its whole archive; nothing until revealed. */
const ModelSolution: React.FC<Props> = ({ state }) => {
  const { t } = useTranslation()
  if (state.model_solution_spec === null) {
    return null
  }
  return (
    <section
      className={css`
        margin-top: 1.5rem;
      `}
    >
      <h3>{t("model-solution")}</h3>
      <SourceFiles
        files={state.model_solution_files}
        studentFilePaths={state.public_spec.student_file_paths}
      />
      <div>
        {t("model-solution-download-label")}:{" "}
        <a href={state.model_solution_spec.solution_download_url}>{t("download-button")}</a>
      </div>
    </section>
  )
}

export default ModelSolution
