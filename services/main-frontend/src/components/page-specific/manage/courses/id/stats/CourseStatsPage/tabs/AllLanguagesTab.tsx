import React from "react"
import { useTranslation } from "react-i18next"

import AllLanguageCompletionsChart from "../../visualizations/all-languages/AllLanguageCompletionsChart"
import AllLanguageStartingUsersChart from "../../visualizations/all-languages/AllLanguageStartingUsersChart"
import AllLanguageTotalStats from "../../visualizations/all-languages/AllLanguageTotalStats"
import { InstructionBox } from "../styles"

interface AllLanguagesTabProps {
  courseId: string
}

const AllLanguagesTab: React.FC<AllLanguagesTabProps> = ({ courseId }) => {
  const { t } = useTranslation()

  return (
    <div>
      <InstructionBox>{t("all-language-versions-stats-description")}</InstructionBox>
      <AllLanguageTotalStats courseId={courseId} />
      <AllLanguageStartingUsersChart courseId={courseId} />
      <AllLanguageCompletionsChart courseId={courseId} />
    </div>
  )
}

export default AllLanguagesTab
