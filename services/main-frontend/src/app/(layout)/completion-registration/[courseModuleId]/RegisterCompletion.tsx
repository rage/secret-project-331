"use client"

import { css } from "@emotion/css"
import Link from "next/link"
import React, { useState } from "react"
import { Trans, useTranslation } from "react-i18next"

import type { UserCompletionInformation } from "@/generated/api/types.generated"
import { typography } from "@/shared-module/common/styles"
import { Button, Disclosure, Infobox } from "@/shared-module/components"

const SISU_URL = "https://sisu.helsinki.fi/student/frontpage"
// The Open University only publishes this page in Finnish and English; other languages fall
// back to the English version.
const OPEN_UNIVERSITY_ENROLLMENT_INFO_URL_FI =
  "https://www.helsinki.fi/fi/hakeminen-ja-opetus/avoin-yliopisto/ilmoittautuminen-ja-opintomaksut"
const OPEN_UNIVERSITY_ENROLLMENT_INFO_URL_EN =
  "https://www.helsinki.fi/en/admissions-and-education/open-university/enrollment-and-study-fees"
const MY_STUDYINFO = "https://opintopolku.fi/oma-opintopolku/"

// oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- link content provided by <Trans> translation string
const myStudyInfoLink = <a href={MY_STUDYINFO} target="_blank" rel="noopener noreferrer" />

export interface RegisterCompletionProps {
  data: UserCompletionInformation
  registrationFormUrl: string
}

type StudentTypeAnswer = "yes" | "no" | null

const RegisterCompletion: React.FC<React.PropsWithChildren<RegisterCompletionProps>> = ({
  data,
  registrationFormUrl,
}) => {
  const { t, i18n } = useTranslation()
  const [answer, setAnswer] = useState<StudentTypeAnswer>(null)

  const openUniversityEnrollmentInfoUrl = /^fi(?:-|$)/.test(i18n.language)
    ? OPEN_UNIVERSITY_ENROLLMENT_INFO_URL_FI
    : OPEN_UNIVERSITY_ENROLLMENT_INFO_URL_EN
  const openUniversityInfoLink = (
    // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- link content provided by <Trans> translation string
    <a href={openUniversityEnrollmentInfoUrl} target="_blank" rel="noopener noreferrer" />
  )

  return (
    <div>
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
        {data.ects_credits && <p>{t("credits-n-ects", { n: data.ects_credits })}</p>}
      </div>

      <div
        className={css`
          text-align: center;
          margin: 1.5rem 0;
        `}
      >
        <p>{t("are-you-a-student-or-exchange-student-at-uh")}</p>
        <p
          className={css`
            color: #666;
            margin-bottom: 1rem;
          `}
        >
          {t("open-university-students-and-everyone-else-select-no")}
        </p>
        <div
          className={css`
            display: flex;
            justify-content: center;
            gap: 1rem;
          `}
        >
          <Button
            variant={answer === "yes" ? "primary" : "secondary"}
            size="medium"
            // oxlint-disable-next-line i18next/no-literal-string
            onClick={() => setAnswer("yes")}
          >
            {t("yes")}
          </Button>
          <Button
            variant={answer === "no" ? "primary" : "secondary"}
            size="medium"
            // oxlint-disable-next-line i18next/no-literal-string
            onClick={() => setAnswer("no")}
          >
            {t("no")}
          </Button>
        </div>
      </div>

      {answer === "yes" && (
        <div>
          <p>{t("enroll-through-sisu-to-register-credits")}</p>
          <Infobox>
            <Trans t={t} i18nKey="sisu-email-matching-explanation" values={{ email: data.email }} />
          </Infobox>
          <div
            className={css`
              display: flex;
              justify-content: center;
              margin: 1.5rem 0;
            `}
          >
            <Link href={SISU_URL}>
              <Button variant="primary" size="large">
                {t("go-to-sisu")}
              </Button>
            </Link>
          </div>
        </div>
      )}

      {answer === "no" && (
        <div>
          <Infobox>
            <Trans
              t={t}
              i18nKey="use-this-email-on-enrollment-form-or-credits-wont-register"
              values={{ email: data.email }}
            />
          </Infobox>
          <p
            className={css`
              margin: 1.5rem 0;
            `}
          >
            <Trans
              t={t}
              i18nKey="open-university-credits-registered-through-ou-explanation"
              values={{ email: data.email }}
              components={{ openUniversityInfoLink }}
            />
          </p>
          <p>
            <Trans
              t={t}
              i18nKey="credits-registered-within-few-days-and-my-studyinfo-pointer"
              values={{ url: MY_STUDYINFO }}
              components={{ myStudyInfoLink }}
            />
          </p>
          <div
            className={css`
              display: flex;
              justify-content: center;
              margin: 1.5rem 0;
            `}
          >
            <Link href={registrationFormUrl}>
              <Button variant="primary" size="large">
                {t("to-the-registration-form")}
              </Button>
            </Link>
          </div>
        </div>
      )}

      {answer !== null && (
        <div
          className={css`
            margin-top: 2rem;
          `}
        >
          <Disclosure title={t("changed-email-since-completing-course-disclosure-title")}>
            <Trans
              t={t}
              i18nKey="changed-email-since-completing-course-disclosure-body"
              values={{ email: data.email }}
            />
          </Disclosure>
        </div>
      )}
    </div>
  )
}

export default RegisterCompletion
