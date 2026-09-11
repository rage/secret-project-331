"use client"

import React from "react"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"

import {
  SEGMENTED,
  SISU_URL,
  TONE,
  openUniversityEnrolmentInfoUrl,
} from "@/components/credit-registration/constants"
import {
  bandCss,
  bandedCardCss,
  cardTitleBandCss,
  narrowPageCss,
  noteCss,
  pageTitleCss,
  subheadingCss,
} from "@/components/credit-registration/styles"
import { Disclosure, Infobox, Link, Radio, RadioGroup } from "@/shared-module/components"

const MY_STUDYINFO = "https://opintopolku.fi/oma-opintopolku/"

const STUDY_RIGHT_AT_UH = "study-right-at-uh"
const OPEN_UNIVERSITY_OR_NEITHER = "open-university-or-neither"
const STUDENT_TYPE_FIELD = "studentType"

// oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- link content provided by <Trans> translation string
const myStudyInfoLink = <a href={MY_STUDYINFO} target="_blank" rel="noopener noreferrer" />

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

  const openUniversityInfoLink = (
    // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- link content provided by <Trans> translation string
    <a
      href={openUniversityEnrolmentInfoUrl(i18n.language)}
      target="_blank"
      rel="noopener noreferrer"
    />
  )

  return (
    <div className={narrowPageCss}>
      <article className={bandedCardCss}>
        <header className={cardTitleBandCss}>
          <h1 className={pageTitleCss}>{t("register-completion")}</h1>
          <p className={subheadingCss}>
            {t("course")}: {courseName}
          </p>
          {typeof ectsCredits === "number" ? (
            <p className={noteCss}>{t("credits-n-ects", { n: ectsCredits })}</p>
          ) : null}
        </header>

        <section className={bandCss}>
          <RadioGroup
            name={STUDENT_TYPE_FIELD}
            control={control}
            variant={SEGMENTED}
            label={t("are-you-a-student-or-exchange-student-at-uh")}
            description={t("open-university-students-and-everyone-else-select-no")}
          >
            <Radio value={STUDY_RIGHT_AT_UH} label={t("yes")} />
            <Radio value={OPEN_UNIVERSITY_OR_NEITHER} label={t("no")} />
          </RadioGroup>
        </section>

        {studentType === STUDY_RIGHT_AT_UH ? (
          <section className={bandCss}>
            <p>{t("enroll-through-sisu-to-register-credits")}</p>
            <Infobox tone={TONE.INFO}>
              <Trans t={t} i18nKey="sisu-email-matching-explanation" values={{ email }} />
            </Infobox>
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
          </section>
        ) : null}

        {studentType === OPEN_UNIVERSITY_OR_NEITHER ? (
          <section className={bandCss}>
            <Infobox tone={TONE.INFO}>
              <Trans
                t={t}
                i18nKey="use-this-email-on-enrollment-form-or-credits-wont-register"
                values={{ email }}
              />
            </Infobox>
            <p>
              <Trans
                t={t}
                i18nKey="open-university-credits-registered-through-ou-explanation"
                values={{ email }}
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
                values={{ url: MY_STUDYINFO }}
                components={{ myStudyInfoLink }}
              />
            </p>
          </section>
        ) : null}

        {studentType ? (
          <div>
            <ChangedEmailNote email={email} />
          </div>
        ) : null}
      </article>
    </div>
  )
}

const ChangedEmailNote: React.FC<{ email: string }> = ({ email }) => {
  const { t } = useTranslation()
  return (
    <Disclosure title={t("changed-email-since-completing-course-disclosure-title")}>
      <p>
        <Trans
          t={t}
          i18nKey="changed-email-since-completing-course-disclosure-body"
          values={{ email }}
        />
      </p>
    </Disclosure>
  )
}

export default RegisterCompletion
