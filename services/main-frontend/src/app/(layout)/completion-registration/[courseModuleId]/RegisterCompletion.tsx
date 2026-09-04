"use client"

import { css } from "@emotion/css"
import Link from "next/link"
import React, { useState } from "react"
import { Trans, useTranslation } from "react-i18next"

import type { UserCompletionInformation } from "@/generated/api/types.generated"
import { typography } from "@/shared-module/common/styles"
import { Button, Disclosure, Infobox } from "@/shared-module/components"

const SISU_URL = "https://sisu.helsinki.fi/student/frontpage"
const OPEN_UNIVERSITY_ENROLLMENT_INFO_URL =
  "https://www.helsinki.fi/en/admissions-and-education/open-university/enrollment-and-study-fees"
const MY_STUDYINFO = "https://opintopolku.fi/oma-opintopolku/"

export interface RegisterCompletionProps {
  data: UserCompletionInformation
  registrationFormUrl: string
}

type StudentTypeAnswer = "yes" | "no" | null

const RegisterCompletion: React.FC<React.PropsWithChildren<RegisterCompletionProps>> = ({
  data,
  registrationFormUrl,
}) => {
  const { t } = useTranslation()
  const [answer, setAnswer] = useState<StudentTypeAnswer>(null)

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
            <Trans t={t} i18nKey="sisu-email-matching-explanation">
              Your credits are matched to you by email address, so your Sisu profile must include{" "}
              <strong>{{ email: data.email }}</strong>, the address you used on this course. If it
              is not your primary address in Sisu, add it as a secondary email address in your Sisu
              settings.
            </Trans>
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
            <Trans t={t} i18nKey="use-this-email-on-enrollment-form-or-credits-wont-register">
              Use this email address on the enrollment form:{" "}
              <strong>{{ email: data.email }}</strong>. If you use a different address, we cannot
              match your enrollment to your completion and your credits will not be registered.
            </Trans>
          </Infobox>
          <p
            className={css`
              margin: 1.5rem 0;
            `}
          >
            <Trans t={t} i18nKey="open-university-credits-registered-through-ou-explanation">
              Credits for this course are registered through the Open University of the University
              of Helsinki. Fill in the Open University enrollment form. Use{" "}
              <strong>{{ email: data.email }}</strong> as your email address there. Enrollment
              requires strong authentication, see the{" "}
              <a href={OPEN_UNIVERSITY_ENROLLMENT_INFO_URL}>
                {t("open-university-enrollment-page-link-text")}
              </a>{" "}
              for details.
            </Trans>
          </p>
          <p>
            <Trans t={t} i18nKey="credits-registered-within-few-days-and-my-studyinfo-pointer">
              Your credits will be registered in the University of Helsinki&apos;s study register
              within a few days. After your completion has been registered, you can view it in the{" "}
              <strong>My StudyInfo</strong> service:{" "}
              <a href={MY_STUDYINFO}>{{ url: MY_STUDYINFO }}</a> Note that there is some delay
              before a registered completion becomes visible in My StudyInfo.
            </Trans>
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
            <Trans t={t} i18nKey="changed-email-since-completing-course-disclosure-body">
              The email address shown on this page, <strong>{{ email: data.email }}</strong>, is the
              one you were using on the platform when you completed this course. Registration only
              recognizes that address. Even if you have since changed your email address here, you
              must use <strong>{{ email: data.email }}</strong> for this registration. If you use a
              different address, you will not get your credits.
            </Trans>
          </Disclosure>
        </div>
      )}
    </div>
  )
}

export default RegisterCompletion
