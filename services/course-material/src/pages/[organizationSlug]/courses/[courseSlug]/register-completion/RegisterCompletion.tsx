import { css } from "@emotion/css"
import React from "react"
import { Trans, useTranslation } from "react-i18next"

import { UserCompletionInformation } from "../../../../../shared-module/bindings"
import Button from "../../../../../shared-module/components/Button"
import GenericInfobox from "../../../../../shared-module/components/GenericInfobox"
import { baseTheme, typography } from "../../../../../shared-module/styles"

export interface RegisterCompletionProps {
  data: UserCompletionInformation
}

const RegisterCompletion: React.FC<RegisterCompletionProps> = ({ data }) => {
  const { t } = useTranslation()
  return (
    <>
      <div
        className={css`
          margin: 0 0 1.5rem;
          text-align: center;
        `}
      >
        <h1
          className={css`
            font-weight: 600;
            font-size: ${typography.h4};
            margin: 2em 0em 1em 0em;
            color: #333;
          `}
        >
          {t("register-completion")}
        </h1>
        <h2
          className={css`
            font-weight: 600;
            font-size: ${typography.h5};
            margin: 2em 0em 1em 0em;
            color: #333;
          `}
        >
          {t("course")}: {data.course_name}
        </h2>
        <p>{t("credit-n-ecrs", { n: 3 })}</p>
        <p>{t("requires-a-finnish-social-security-number")}</p>
      </div>
      <GenericInfobox>
        {t("use-this-email-address-on-the-registration-form")}: {data.email}
      </GenericInfobox>
      <p
        className={css`
          margin: 1.5rem 0;
        `}
      >
        <Trans t={t} i18nKey="open-university-credit-registration-responsibility-disclaimer">
          The Open University of the University of Helsinki is responsible for registering the
          credits. <strong>Registering the credits is free.</strong> Register to the Open University
          of the University of Helsinki, so that we can process your credits.
        </Trans>
      </p>
      <div
        className={css`
          border: 2px solid ${baseTheme.colors.green[500]};
          border-radius: 10px;
          padding: 1rem;
        `}
      >
        <p>{t("follow-these-instructions")}</p>
        <ol>
          <li>{t("fill-in-the-registration-form")}</li>
          <li>
            <Trans t={t} i18nKey="at-the-form-field-fill-in-your-email-address">
              At the form field &apos;Your email address on the MOOC course&apos;{" "}
              <strong>fill in: {{ email: data.email }}</strong>
            </Trans>
          </li>
          <li>{t("tick-the-box-if-you-want-email-after-credits-have-been-registered")}</li>
          <li>
            <Trans
              t={t}
              i18nKey="after-completion-has-been-registered-you-can-view-completed-credits-at-koski"
            >
              After your completion has been registered, you can view completed credits at{" "}
              <strong>Koski</strong>: <a href="/">opintopolku/oma-opintopolku</a> NB! There is some
              delay on registering a completion and the credits being visible at Koski.
            </Trans>
          </li>
        </ol>
        <p>{t("credit-will-be-registered-within-six-weeks")}</p>
      </div>
      <div
        className={css`
          display: flex;
          justify-content: center;
          margin: 1.5rem 0;
        `}
      >
        <Button variant="primary" size="large">
          {t("to-the-registration-form")}
        </Button>
      </div>
      <p>{t("bachelor-and-master-degree-students-from-university-of-helsinki-notice")}</p>
    </>
  )
}

export default RegisterCompletion
