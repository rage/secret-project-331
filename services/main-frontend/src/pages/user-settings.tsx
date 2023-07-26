import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import ResearchOnCoursesForm from "../components/forms/ResearchOnCoursesForm"
import useUserResearchConsentQuery from "../hooks/useUserResearchConsentQuery"
import Button from "../shared-module/components/Button"

const UserSettings: React.FC<React.PropsWithChildren> = () => {
  const { t } = useTranslation()
  const [openResearchForm, setOpenResearchForm] = useState<boolean>(false)

  const getUserConsent = useUserResearchConsentQuery()

  const handleResearchConsentButton = async () => {
    await getUserConsent.refetch()
    setOpenResearchForm(true)
  }

  const handleAfterSubmit = () => {
    setOpenResearchForm(false)
  }

  return (
    <div>
      <h1>{t("user-settings")}</h1>

      <div
        className={css`
          display: flex;
          flex-direction: row;
          gap: 40px;
          padding-top: 30px;
          font-size: 22px;
          line-height: 22px;
          align-items: center;
        `}
      >
        <div>{t("research-consent-title")}:</div>
        <Button size="medium" variant="primary" onClick={handleResearchConsentButton}>
          {t("edit")}
        </Button>
        {openResearchForm && (
          <ResearchOnCoursesForm
            afterSubmit={handleAfterSubmit}
            initialConsentValue={getUserConsent.data?.research_consent}
          />
        )}
      </div>
    </div>
  )
}

export default UserSettings
