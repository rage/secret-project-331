"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"

import {
  cardCss,
  headingCss,
  monospaceCss,
  narrowPageCss,
  noteCss,
  pageTitleCss,
  sectionCss,
  sectionHeaderCss,
} from "@/components/credit-registration/styles"
import { CopyButton, Disclosure, Link, Radio, RadioGroup } from "@/shared-module/components"

const SISU_URL = "https://sisu.helsinki.fi/student/frontpage"
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

// oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- link content provided by <Trans> translation string
const myStudyInfoLink = <a href={MY_STUDYINFO} target="_blank" rel="noopener noreferrer" />

const emailBlockCss = cx(
  cardCss,
  css`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
  `,
)

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
      <div className={sectionHeaderCss}>
        <h1 className={pageTitleCss}>{t("register-completion")}</h1>
        <p className={noteCss}>
          {typeof ectsCredits === "number"
            ? t("course-name-and-ects", { course: courseName, ects: ectsCredits })
            : courseName}
        </p>
      </div>

      <RadioGroup
        name={STUDENT_TYPE_FIELD}
        control={control}
        label={t("how-do-you-study-at-the-university-of-helsinki")}
      >
        <Radio value={STUDY_RIGHT_AT_UH} label={t("option-degree-or-exchange-student-at-uh")} />
        <Radio value={OPEN_UNIVERSITY_OR_NEITHER} label={t("option-open-university-or-neither")} />
      </RadioGroup>

      {studentType === STUDY_RIGHT_AT_UH ? (
        <section className={sectionCss}>
          <h2 className={headingCss}>{t("heading-enrol-in-sisu")}</h2>
          <EmailToUse email={email} />
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
          <p>{t("enroll-through-sisu-to-register-credits")}</p>
          <p>{t("sisu-add-this-address-as-a-secondary-address")}</p>
          <ChangedEmailNote />
        </section>
      ) : null}

      {studentType === OPEN_UNIVERSITY_OR_NEITHER ? (
        <section className={sectionCss}>
          <h2 className={headingCss}>{t("heading-enrol-at-the-open-university")}</h2>
          <EmailToUse email={email} />
          <div>
            <Link href={registrationFormUrl} styledAsButton variant="primary" size="medium">
              {t("to-the-registration-form")}
            </Link>
          </div>
          <p>
            <Trans
              t={t}
              i18nKey="open-university-credits-registered-through-ou-explanation"
              components={{ openUniversityInfoLink }}
            />
          </p>
          <p>
            <Trans
              t={t}
              i18nKey="credits-registered-within-few-days-and-my-studyinfo-pointer"
              components={{ myStudyInfoLink }}
            />
          </p>
          <ChangedEmailNote />
        </section>
      ) : null}
    </div>
  )
}

const EmailToUse: React.FC<{ email: string }> = ({ email }) => {
  const { t } = useTranslation()
  return (
    <>
      <div className={emailBlockCss}>
        <span className={noteCss}>{t("label-the-email-address-to-use")}</span>
        <span className={emailValueCss}>{email}</span>
        <CopyButton value={email} label={t("copy-the-email-address")} />
      </div>
      <p>{t("registration-is-matched-to-you-by-this-address")}</p>
    </>
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
