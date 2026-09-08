"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"

import { SISU_URL, TONE } from "@/components/credit-registration/constants"
import {
  bandedCardCss,
  monospaceCss,
  narrowPageCss,
  noteCss,
  pageTitleCss,
  sectionCss,
  sectionHeaderCss,
  stepsCss,
} from "@/components/credit-registration/styles"
import {
  CopyButton,
  Disclosure,
  Infobox,
  Link,
  Radio,
  RadioGroup,
} from "@/shared-module/components"

// The Open University only publishes this page in Finnish and English; other languages fall
// back to the English version.
const OPEN_UNIVERSITY_ENROLLMENT_INFO_URL_FI =
  "https://www.helsinki.fi/fi/hakeminen-ja-opetus/avoin-yliopisto/ilmoittautuminen-ja-opintomaksut"
const OPEN_UNIVERSITY_ENROLLMENT_INFO_URL_EN =
  "https://www.helsinki.fi/en/admissions-and-education/open-university/enrollment-and-study-fees"
const MY_STUDYINFO = "https://opintopolku.fi/oma-opintopolku/"

const STUDY_RIGHT_AT_UH = "study-right-at-uh"
const OPEN_UNIVERSITY_OR_NEITHER = "open-university-or-neither"
const STUDENT_TYPE_FIELD = "studentType"

const SEGMENTED = "segmented" as const

// oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- link content provided by <Trans> translation string
const myStudyInfoLink = <a href={MY_STUDYINFO} target="_blank" rel="noopener noreferrer" />

/** The address and its copy button sit on one line, and wrap together when the line runs out. */
const emailRowCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
`

const emailValueCss = cx(
  monospaceCss,
  css`
    font-weight: 600;
  `,
)

export interface RegisterCompletionProps {
  /** The address the completion was made under; registration matches on it and nothing else. */
  email: string
  courseName: string
  ectsCredits: number | null | undefined
  registrationFormUrl: string
}

interface StudentTypeForm {
  [STUDENT_TYPE_FIELD]: string
}

const RegisterCompletion: React.FC<RegisterCompletionProps> = ({
  email,
  courseName,
  ectsCredits,
  registrationFormUrl,
}) => {
  const { t, i18n } = useTranslation()
  const { control, watch } = useForm<StudentTypeForm>({
    defaultValues: { [STUDENT_TYPE_FIELD]: "" },
  })
  const studentType = watch(STUDENT_TYPE_FIELD)

  const openUniversityEnrollmentInfoUrl = /^fi(?:-|$)/.test(i18n.language)
    ? OPEN_UNIVERSITY_ENROLLMENT_INFO_URL_FI
    : OPEN_UNIVERSITY_ENROLLMENT_INFO_URL_EN
  const openUniversityInfoLink = (
    // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- link content provided by <Trans> translation string
    <a href={openUniversityEnrollmentInfoUrl} target="_blank" rel="noopener noreferrer" />
  )

  return (
    <div className={narrowPageCss}>
      <article className={bandedCardCss}>
        <header className={sectionHeaderCss}>
          <h1 className={pageTitleCss}>{t("register-completion")}</h1>
          <p>{t("label-course-with-name", { course: courseName })}</p>
          {typeof ectsCredits === "number" ? (
            <p className={noteCss}>
              {t("label-credits-with-amount", { credits: t("ects-n", { n: ectsCredits }) })}
            </p>
          ) : null}
        </header>

        <section className={sectionCss}>
          <RadioGroup
            name={STUDENT_TYPE_FIELD}
            control={control}
            variant={SEGMENTED}
            label={t("question-are-you-a-student-or-exchange-student-at-uh")}
            description={t("hint-not-sure-which-student-type")}
          >
            <Radio value={STUDY_RIGHT_AT_UH} label={t("yes")} />
            <Radio value={OPEN_UNIVERSITY_OR_NEITHER} label={t("no")} />
          </RadioGroup>
        </section>

        {studentType === STUDY_RIGHT_AT_UH ? (
          <section className={sectionCss}>
            <EmailToUse email={email} />
            <ol className={stepsCss}>
              <li>{t("enroll-through-sisu-to-register-credits")}</li>
              <li>{t("sisu-add-this-address-as-a-secondary-address")}</li>
            </ol>
            {/* A grid child otherwise stretches the button's own box to the section's full width. */}
            <div>
              <Link
                href={SISU_URL}
                target="_blank"
                rel="noopener noreferrer"
                styledAsButton
                variant="primary"
                size="medium"
              >
                {t("go-to-sisu")}
              </Link>
            </div>
            <p>{t("credits-appear-in-sisu-after-enrolling")}</p>
          </section>
        ) : null}

        {studentType === OPEN_UNIVERSITY_OR_NEITHER ? (
          <section className={sectionCss}>
            <EmailToUse email={email} />
            <p>
              <Trans
                t={t}
                i18nKey="open-university-credits-registered-through-ou-explanation"
                components={{ openUniversityInfoLink }}
              />
            </p>
            <div>
              <Link href={registrationFormUrl} styledAsButton variant="primary" size="medium">
                {t("to-the-registration-form")}
              </Link>
            </div>
            <p>
              <Trans
                t={t}
                i18nKey="credits-registered-within-few-days-and-my-studyinfo-pointer"
                components={{ myStudyInfoLink }}
              />
            </p>
          </section>
        ) : null}

        {studentType ? (
          <div>
            <ChangedEmailNote />
          </div>
        ) : null}
      </article>
    </div>
  )
}

const EmailToUse: React.FC<{ email: string }> = ({ email }) => {
  const { t } = useTranslation()
  return (
    <Infobox tone={TONE.INFO}>
      <div className={emailRowCss}>
        <span className={noteCss}>{t("label-the-email-address-to-use")}</span>
        <span className={emailValueCss}>{email}</span>
        <CopyButton value={email} label={t("copy-the-email-address")} />
      </div>
      <p>{t("registration-is-matched-to-you-by-this-address")}</p>
    </Infobox>
  )
}

const ChangedEmailNote: React.FC = () => {
  const { t } = useTranslation()
  return (
    <Disclosure title={t("changed-email-since-completing-course-disclosure-title")}>
      <p>{t("changed-email-since-completing-course-disclosure-body")}</p>
    </Disclosure>
  )
}

export default RegisterCompletion
