import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { postUserResearchConsent } from "../../services/backend/users"
import Button from "../../shared-module/components/Button"
import Dialog from "../../shared-module/components/Dialog"
import RadioButton from "../../shared-module/components/InputFields/RadioButton"
import ClipboardIcon from "../../shared-module/img/clipboard-icon.svg"
import { baseTheme, fontWeights, headingFont } from "../../shared-module/styles"

interface ResearchOnCoursesFormProps {
  afterSubmit?: () => void
}

const ResearchOnCoursesForm: React.FC<React.PropsWithChildren<ResearchOnCoursesFormProps>> = ({
  afterSubmit,
}) => {
  const { t } = useTranslation()
  const [researchConsentFormOpen, setResearchConsentFormOpen] = useState(true)
  const [consent, setConsent] = useState<boolean>(false)
  const [optionSelected, setOptionSelected] = useState<boolean>(false)

  const consentQuery = useQuery({
    queryKey: [`users-user-research-consents`],
    queryFn: () => postUserResearchConsent(consent),
    enabled: false,
  })

  const handleOnSubmit = () => {
    setResearchConsentFormOpen(false)
    consentQuery.refetch()
    if (afterSubmit != undefined) {
      afterSubmit()
    }
    setConsent(false)
  }

  const handleConsentSelection = (value: boolean) => {
    setConsent(value)
    setOptionSelected(true)
  }

  return (
    <div>
      <Dialog open={researchConsentFormOpen} noPadding={true}>
        <div
          className={css`
            display: flex;
            padding: 24px;
            gap: 13px;
            line-height: 24px;
            align-items: center;
            color: ${baseTheme.colors.gray[700]};
          `}
        >
          <ClipboardIcon />
          <h2
            className={css`
              font-family: ${headingFont};
              font-weight: ${fontWeights.medium};
            `}
          >
            {t("research-consent-title")}
          </h2>
        </div>

        <div
          className={css`
            display: flex;
            flex-direction: column;
            padding: 24px;
            border: ${baseTheme.colors.clear[700]};
            border-style: solid;
            border-width: 1px 0px;
            line-height: 22px;
            font-family: ${headingFont};
            font-weight: ${fontWeights.medium};
            color: ${baseTheme.colors.gray[700]};
          `}
        >
          <div>{t("research-consent-educational-research-is-conducted-on-the-courses")}</div>
          <ol
            className={css`
              margin: 0px;
              padding-left: 24px;
            `}
          >
            <li>{t("research-consent-goals-develop-learning")}</li>
            <li>{t("research-consent-goals-advance-knowledge")}</li>
            <li>{t("research-consent-goals-provide-research-based-support")}</li>
          </ol>

          <p
            className={css`
              padding-top: 24px;
            `}
          >
            {t("research-consent-data-from-learning-process-is-used")}
          </p>
          <p
            className={css`
              padding-top: 16px;
              padding-bottom: 24px;
            `}
          >
            {t("research-consent-director-info", {
              "director-name": "Petri Ihantola",
            })}
            <a
              className={css`
                color: ${baseTheme.colors.blue[700]}!important;
              `}
              href="mooc@cs.helsinki.fi"
              // eslint-disable-next-line i18next/no-literal-string
            >
              mooc@cs.helsinki.fi
            </a>
            ,
          </p>

          <div>
            <RadioButton
              id="researchConsent"
              label={t("research-consent-i-want-to-participate-in-educational-research")}
              name="researchConsent"
              onChange={(_event) => handleConsentSelection(true)}
            />
            <RadioButton
              id="noResearchConsent"
              label={t("research-consent-i-do-not-want-participate-in-educational-research")}
              name="researchConsent"
              onChange={(_event) => handleConsentSelection(false)}
            />
          </div>
        </div>
        <div
          className={css`
            display: flex;
            flex-direction: row;
            justify-content: flex-end;
            padding: 16px 20px 16px 20px;
            height: 72px;
            font-family: ${headingFont};
          `}
        >
          <Button
            className={css`
              font-size: 14px;
            `}
            variant="tertiary"
            size="medium"
            type="submit"
            transform="capitalize"
            onClick={handleOnSubmit}
            value={t("button-text-save")}
            disabled={!optionSelected}
          >
            {t("button-text-save")}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

export default ResearchOnCoursesForm
