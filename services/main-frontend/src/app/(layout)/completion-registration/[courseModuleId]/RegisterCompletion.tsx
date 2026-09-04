"use client"

import { css, keyframes } from "@emotion/css"
import React, { useId, useState } from "react"
import { Trans, useTranslation } from "react-i18next"

import type { UserCompletionInformation } from "@/generated/api/types.generated"
import { typography } from "@/shared-module/common/styles"
import { Button, Disclosure, Infobox, Link } from "@/shared-module/components"

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

const pageCss = css`
  max-width: 38rem;
  margin: 0 auto;
  padding: 2.5rem 0 4rem;
  display: flex;
  flex-direction: column;
  gap: 2.25rem;
`

const headerCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-3);

  h1 {
    margin: 0;
    font-size: ${typography.h4};
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.01em;
    color: var(--color-gray-700);
  }

  h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    line-height: 1.35;
    color: var(--color-gray-600);
  }

  p {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--color-gray-500);
  }
`

const questionCss = css`
  background: var(--color-green-75);
  border-radius: 10px;
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);

  @media (max-width: 40rem) {
    padding: var(--space-4);
  }
`

const questionTextCss = css`
  margin: 0;
  font-size: 1.375rem;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.005em;
  color: var(--color-gray-700);
`

const questionHintCss = css`
  margin: calc(var(--space-3) * -1) 0 0;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--color-gray-500);
`

const answersCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);

  button {
    min-width: 7rem;
  }
`

const reveal = keyframes`
  from {
    opacity: 0;
    transform: translateY(4px);
  }
`

const instructionsCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: ${reveal} 180ms ease-out;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  p {
    margin: 0;
    font-size: 1.0625rem;
    line-height: 1.65;
    color: var(--color-gray-600);
  }

  strong {
    font-weight: 600;
    color: var(--color-gray-700);
  }
`

/** The icon would otherwise float beside the middle of a paragraph that runs several lines. */
const infoboxCss = css`
  align-items: flex-start;
`

const callToActionCss = css`
  margin-top: var(--space-3);

  /* Long labels wrap on narrow screens, so the fixed control height has to give way. */
  a {
    height: auto;
    min-height: var(--control-height-lg);
    padding-top: var(--space-3);
    padding-bottom: var(--space-3);
    line-height: 1.3;
    text-align: center;
  }
`

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
  const questionId = useId()
  const hintId = useId()

  const openUniversityEnrollmentInfoUrl = /^fi(?:-|$)/.test(i18n.language)
    ? OPEN_UNIVERSITY_ENROLLMENT_INFO_URL_FI
    : OPEN_UNIVERSITY_ENROLLMENT_INFO_URL_EN
  const openUniversityInfoLink = (
    // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- link content provided by <Trans> translation string
    <a href={openUniversityEnrollmentInfoUrl} target="_blank" rel="noopener noreferrer" />
  )

  return (
    <div className={pageCss}>
      <div className={headerCss}>
        <h1>{t("register-completion")}</h1>
        <h2>
          {t("course")}: {data.course_name}
        </h2>
        {data.ects_credits && <p>{t("credits-n-ects", { n: data.ects_credits })}</p>}
      </div>

      <div className={questionCss} role="group" aria-labelledby={questionId}>
        <p className={questionTextCss} id={questionId}>
          {t("are-you-a-student-or-exchange-student-at-uh")}
        </p>
        <p className={questionHintCss} id={hintId}>
          {t("open-university-students-and-everyone-else-select-no")}
        </p>
        <div className={answersCss}>
          <Button
            variant={answer === "yes" ? "primary" : "tertiary"}
            size="medium"
            aria-describedby={hintId}
            domProps={{ "aria-pressed": answer === "yes" }}
            // oxlint-disable-next-line i18next/no-literal-string
            onClick={() => setAnswer("yes")}
          >
            {t("yes")}
          </Button>
          <Button
            variant={answer === "no" ? "primary" : "tertiary"}
            size="medium"
            aria-describedby={hintId}
            domProps={{ "aria-pressed": answer === "no" }}
            // oxlint-disable-next-line i18next/no-literal-string
            onClick={() => setAnswer("no")}
          >
            {t("no")}
          </Button>
        </div>
      </div>

      {answer === "yes" && (
        <div className={instructionsCss}>
          <p>{t("enroll-through-sisu-to-register-credits")}</p>
          <Infobox className={infoboxCss} announce>
            <Trans t={t} i18nKey="sisu-email-matching-explanation" values={{ email: data.email }} />
          </Infobox>
          <div className={callToActionCss}>
            <Link
              href={SISU_URL}
              target="_blank"
              rel="noopener noreferrer"
              styledAsButton
              variant="primary"
              size="large"
            >
              {t("go-to-sisu")}
            </Link>
          </div>
        </div>
      )}

      {answer === "no" && (
        <div className={instructionsCss}>
          <Infobox className={infoboxCss} announce>
            <Trans
              t={t}
              i18nKey="use-this-email-on-enrollment-form-or-credits-wont-register"
              values={{ email: data.email }}
            />
          </Infobox>
          <p>
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
          <div className={callToActionCss}>
            <Link href={registrationFormUrl} styledAsButton variant="primary" size="large">
              {t("to-the-registration-form")}
            </Link>
          </div>
        </div>
      )}

      {answer !== null && (
        <Disclosure title={t("changed-email-since-completing-course-disclosure-title")}>
          <Trans
            t={t}
            i18nKey="changed-email-since-completing-course-disclosure-body"
            values={{ email: data.email }}
          />
        </Disclosure>
      )}
    </div>
  )
}

export default RegisterCompletion
