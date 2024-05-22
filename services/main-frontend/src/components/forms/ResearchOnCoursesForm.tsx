import { css } from "@emotion/css"
import { LinesClipboard } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { postUserResearchConsent } from "../../services/backend/users"

import Button from "@/shared-module/common/components/Button"
import Dialog from "@/shared-module/common/components/Dialog"
import RadioButton from "@/shared-module/common/components/InputFields/RadioButton"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, fontWeights, headingFont } from "@/shared-module/common/styles"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

interface ResearchOnCoursesFormProps {
  afterSubmit?: () => void
  initialConsentValue?: boolean
}

const ResearchOnCoursesForm: React.FC<React.PropsWithChildren<ResearchOnCoursesFormProps>> = ({
  afterSubmit,
  initialConsentValue,
}) => {
  const { t } = useTranslation()
  const [researchConsentFormOpen, setResearchConsentFormOpen] = useState(true)
  const [consent, setConsent] = useState<boolean | undefined>(initialConsentValue)
  const [optionSelected, setOptionSelected] = useState<boolean>(true)

  if (consent === undefined && optionSelected) {
    setOptionSelected(false)
  }

  const consentQuery = useToastMutation(
    () => postUserResearchConsent(assertNotNullOrUndefined(consent)),
    {
      notify: true,
      method: "POST",
    },
  )

  const handleConsentSelection = (value: boolean) => {
    setConsent(value)
    setOptionSelected(true)
  }

  const handleOnSubmit = () => {
    setResearchConsentFormOpen(false)
    consentQuery.mutate()
    if (afterSubmit != undefined) {
      afterSubmit()
    }
  }

  return (
    <div>
      <Dialog open={researchConsentFormOpen} noPadding={true} closeable={false}>
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
          <LinesClipboard size={21} />
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
            font-size: 16px;
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
            {t("research-consent-responsible")}
            <a
              className={css`
                color: ${baseTheme.colors.blue[700]} !important;
                text-decoration: underline !important;
              `}
              href="mooc@cs.helsinki.fi"
              // eslint-disable-next-line i18next/no-literal-string
            >
              mooc@cs.helsinki.fi
            </a>
            .
          </p>

          <div>
            <RadioButton
              id="researchConsent"
              label={t("research-consent-i-want-to-participate-in-educational-research")}
              // eslint-disable-next-line i18next/no-literal-string
              name="researchConsent"
              onClick={() => handleConsentSelection(true)}
              checked={consent === true}
            />
            <RadioButton
              id="noResearchConsent"
              label={t("research-consent-i-do-not-want-participate-in-educational-research")}
              // eslint-disable-next-line i18next/no-literal-string
              name="researchConsent"
              onClick={() => handleConsentSelection(false)}
              checked={consent === false}
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
