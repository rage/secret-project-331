import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import ResearchOnCoursesForm from "../components/forms/ResearchOnCoursesForm"
import { getResearchConsentByUserId } from "../services/backend/users"
import Button from "../shared-module/components/Button"
import LoginStateContext from "../shared-module/contexts/LoginStateContext"

const UserSettings: React.FC<React.PropsWithChildren> = () => {
  const { t } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)
  const [openResearchForm, setOpenResearchForm] = useState<boolean>(false)

  const getUserConsent = useQuery({
    queryKey: [`users-get-user-research-consent`],
    queryFn: () => getResearchConsentByUserId(),
    enabled: loginStateContext.signedIn === true,
  })

  const handleResearchConsentButton = async () => {
    await getUserConsent.refetch()
    setOpenResearchForm(true)
  }

  const handleAfterSubmit = () => {
    setOpenResearchForm(false)
  }

  return (
    <div>
      {/* eslint-disable-next-line i18next/no-literal-string */}
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
        <Button
          id={"changeReseachConstent"}
          size="medium"
          variant="primary"
          onClick={handleResearchConsentButton}
        >
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
