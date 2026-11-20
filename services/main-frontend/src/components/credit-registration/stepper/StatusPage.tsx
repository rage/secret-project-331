"use client"

import { css, cx } from "@emotion/css"
import { Clock } from "@vectopus/atlas-icons-react"
import React from "react"
import { Trans, useTranslation } from "react-i18next"

import type {
  MyCreditRegistration,
  StudentFacingCreditRegistrationStatus,
  StudentRegistrationProgress,
  StudentRegistrationProgressStep,
} from "@/generated/api/types.generated"
import { DescriptionList, RelativeTime, Spinner, TransLink } from "@/shared-module/components"
import { CheckIcon } from "@/shared-module/components/components/primitives/CheckIcon"

import {
  CREDIT_REGISTRATION_NS,
  OMA_OPINTOPOLKU_URL,
  SISU_URL,
  TIME_DATE,
  TIME_IN_TITLE,
} from "../constants"
import {
  registrationExplanation,
  registrationGradeLabel,
  registrationStatusLabel,
} from "../creditRegistrationCopy"
import { NotificationEmailLine } from "../EmailStatusLine"
import { RegistrationActions } from "../RegistrationStatusCard"
import {
  RECHECK_ENROLMENT_ACTION_KEY,
  useStudentRegistrationActions,
} from "../studentRegistrationActions"
import { StudentRegistrationExplanation } from "../StudentRegistrationExplanation"
import {
  captionCss,
  pageCss,
  pageHeadingCss,
  statusHeadCss,
  statusMarkDoneCss,
  statusMarkWaitingCss,
} from "./stepperStyles"
import type { StatusPage as StatusPageKind } from "./stepperView"

const ICON_SIZE = 22

export const sisuLink = <TransLink href={SISU_URL} target="_blank" rel="noopener noreferrer" />
export const omaOpintopolkuLink = (
  <TransLink href={OMA_OPINTOPOLKU_URL} target="_blank" rel="noopener noreferrer" />
)

const progressListCss = css`
  margin: var(--space-3) 0 0;
  padding: 0;
  list-style: none;
`

const progressRowCss = css`
  position: relative;
  display: grid;
  grid-template-columns: 22px 1fr;
  column-gap: var(--space-3-5);
  padding-bottom: var(--space-4);

  &:last-child {
    padding-bottom: 0;
  }

  &::before {
    content: "";
    position: absolute;
    top: 24px;
    bottom: 2px;
    left: 10px;
    width: 2px;
    background: var(--color-clear-300);
  }

  &:last-child::before {
    display: none;
  }
`

const doneRowCss = css`
  &::before {
    background: var(--color-green-600);
  }
`

const dotCss = css`
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 2px solid var(--color-clear-400);
  border-radius: 50%;
  background: var(--color-clear-50);
  color: var(--color-clear-50);
  font-size: 13px;
`

const doneDotCss = css`
  border-color: var(--color-green-600);
  background: var(--color-green-600);
`

const rowTitleCss = css`
  font-weight: 500;
  line-height: 22px;
`

const nextRowTitleCss = css`
  color: var(--color-gray-500);
`

const reachedAtCss = css`
  margin-left: 10px;
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
  font-weight: 400;
`

/** A step a registration passes, and the hint shown while it is the current one. */
const PROGRESS_STEP_KEYS = {
  enrolment_found: ["credit-registration-progress-enrolment-found", null],
  sent_to_sisu: ["credit-registration-progress-sent-to-sisu", null],
  accepted_by_sisu: [
    "credit-registration-progress-accepted-by-sisu",
    "credit-registration-progress-accepted-by-sisu-hint",
  ],
  partially_registered: [
    "credit-registration-progress-partially-registered",
    "credit-registration-progress-partially-registered-hint",
  ],
} as const satisfies Record<StudentRegistrationProgressStep, readonly [string, string | null]>

/** The last row, which is the registered page's own state rather than a step of progress. */
const REGISTERED_ROW_KEY = "registered"

const PROGRESS_STEPS = Object.keys(PROGRESS_STEP_KEYS) as StudentRegistrationProgressStep[]

/** Every step to registered: what is done and when, what is happening now, what is still to come. */
const ProgressList: React.FC<{ progress: StudentRegistrationProgress }> = ({ progress }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const reachedAt = new Map(
    progress.completed_steps.map((completed) => [completed.step, completed.reached_at]),
  )
  const rows = [
    ...PROGRESS_STEPS.map((step) => {
      const [titleKey, hintKey] = PROGRESS_STEP_KEYS[step]
      return {
        key: step,
        title: t(titleKey),
        hint: hintKey ? t(hintKey) : null,
        isDone: reachedAt.has(step),
        reachedAt: reachedAt.get(step) ?? null,
        isCurrent: progress.current_step === step,
      }
    }),
    {
      key: REGISTERED_ROW_KEY,
      title: t("credit-registration-progress-fully-registered"),
      hint: null,
      isDone: false,
      reachedAt: null,
      isCurrent: false,
    },
  ]
  return (
    <ol className={progressListCss} aria-label={t("credit-registration-progress-label")}>
      {rows.map((row) => (
        <li key={row.key} className={cx(progressRowCss, row.isDone && doneRowCss)}>
          <span className={cx(dotCss, row.isDone && doneDotCss)} aria-hidden="true">
            {row.isDone ? <CheckIcon /> : null}
          </span>
          <div>
            <div className={cx(rowTitleCss, !row.isDone && !row.isCurrent && nextRowTitleCss)}>
              {row.title}
              {row.reachedAt ? (
                <span className={reachedAtCss}>
                  <RelativeTime at={row.reachedAt} absoluteTime={TIME_IN_TITLE} />
                </span>
              ) : null}
            </div>
            {row.isCurrent && row.hint ? <div className={captionCss}>{row.hint}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

export const LastChecked: React.FC<{ checkedAt: string }> = ({ checkedAt }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <p className={captionCss}>
      {t("credit-registration-last-checked")}{" "}
      <RelativeTime at={checkedAt} absoluteTime={TIME_IN_TITLE} />.{" "}
      {t("credit-registration-checks-again-automatically")}
    </p>
  )
}

/** The transcript facts: what was registered, and under which number. */
const RegistrationFacts: React.FC<{
  registration: MyCreditRegistration
  moduleEctsCredits: number | null | undefined
}> = ({ registration, moduleEctsCredits }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const credits = registration.credits ?? moduleEctsCredits
  if (!registration.registered_at) {
    return null
  }
  const items = [
    {
      label: t("label-registered-at"),
      value: <RelativeTime at={registration.registered_at} absoluteTime={TIME_DATE} />,
    },
    {
      label: t("label-grade"),
      value: registrationGradeLabel(t, registration.grade_id, registration.grade_scale_id),
    },
    ...(typeof credits === "number"
      ? [{ label: t("label-credits"), value: t("ects-n", { n: credits }) }]
      : []),
    ...(registration.student_number
      ? [{ label: t("label-student-number"), value: registration.student_number }]
      : []),
  ]
  const wasRegisteredAtAnotherAmount =
    typeof registration.credits === "number" &&
    typeof moduleEctsCredits === "number" &&
    registration.credits !== moduleEctsCredits
  return (
    <>
      <DescriptionList items={items} />
      {wasRegisteredAtAnotherAmount ? (
        <p className={captionCss}>
          {registration.course_module_name
            ? t("credit-registration-module-credits-differ-from-current", {
                current: moduleEctsCredits,
              })
            : t("credit-registration-course-credits-differ-from-current", {
                current: moduleEctsCredits,
              })}
        </p>
      ) : null}
    </>
  )
}

const StatusHeading: React.FC<{ mark: React.ReactNode; children: React.ReactNode }> = ({
  mark,
  children,
}) => (
  <div className={statusHeadCss}>
    {mark}
    <h2 className={pageHeadingCss} tabIndex={-1}>
      {children}
    </h2>
  </div>
)

export interface StatusPageProps {
  kind: StatusPageKind
  registration: MyCreditRegistration | null
  statusBeforeRegistration: StudentFacingCreditRegistrationStatus
  /** The number the completion goes to: the linked one, or the one on the registration. */
  studentNumber: string | null
  /** Registered in Sisu, so seen there at once, rather than only in Oma Opintopolku. */
  isDegreeStudent: boolean
  moduleEctsCredits: number | null | undefined
  checkedAt: string | null
  /** Rendered under the explanation: the enrolment check box and the way back while waiting. */
  children?: React.ReactNode
}

/** Where the registration stands once the student has nothing left to answer. */
export const StatusPage: React.FC<StatusPageProps> = ({
  kind,
  registration,
  statusBeforeRegistration,
  studentNumber,
  isDegreeStudent,
  moduleEctsCredits,
  checkedAt,
  children,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)

  if (kind === "waiting") {
    return (
      <div className={pageCss}>
        <StatusHeading
          mark={
            <span className={statusMarkWaitingCss} aria-hidden="true">
              <Clock size={ICON_SIZE} />
            </span>
          }
        >
          {t("credit-registration-waiting-heading")}
        </StatusHeading>
        <p>{t("credit-registration-waiting-body", { studentNumber })}</p>
        <p className={captionCss}>{t("credit-registration-waiting-for-enrolment-timing")}</p>
        {registration ? <RecheckLever registration={registration} /> : null}
        {children}
        <p className={captionCss}>{t("credit-registration-link-not-your-number-active")}</p>
      </div>
    )
  }

  if (registration === null || kind === "not-registering" || kind === "course-setup") {
    const status = registration?.student_facing_status ?? statusBeforeRegistration
    return (
      <div className={pageCss}>
        <StatusHeading mark={null}>{registrationStatusLabel(t, status)}</StatusHeading>
        <p>{registrationExplanation(t, status)}</p>
        {children}
      </div>
    )
  }

  return (
    <RegistrationStatus
      kind={kind}
      registration={registration}
      studentNumber={studentNumber}
      isDegreeStudent={isDegreeStudent}
      moduleEctsCredits={moduleEctsCredits}
      checkedAt={checkedAt}
    >
      {children}
    </RegistrationStatus>
  )
}

const RegistrationStatus: React.FC<
  Omit<StatusPageProps, "registration" | "statusBeforeRegistration"> & {
    registration: MyCreditRegistration
  }
> = ({
  kind,
  registration,
  studentNumber,
  isDegreeStudent,
  moduleEctsCredits,
  checkedAt,
  children,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const { primaryAction, secondaryActions } = useStudentRegistrationActions(registration)
  const notYourNumber =
    kind === "failed"
      ? t("credit-registration-link-not-your-number")
      : t("credit-registration-link-not-your-number-active")

  if (kind === "registering") {
    return (
      <div className={pageCss}>
        <StatusHeading mark={<Spinner size="md" />}>
          {t("credit-registration-registering-heading")}
        </StatusHeading>
        <p>
          {studentNumber
            ? t("credit-registration-registering-body", { studentNumber })
            : t("credit-registration-registering-body-without-number")}
        </p>
        {registration.progress ? <ProgressList progress={registration.progress} /> : null}
        <NotificationEmailLine notificationEmail={registration.notification_email} />
        {registration.status_is_moving && checkedAt ? <LastChecked checkedAt={checkedAt} /> : null}
        {children}
        {studentNumber ? <p className={captionCss}>{notYourNumber}</p> : null}
      </div>
    )
  }

  if (kind === "registered") {
    return (
      <div className={pageCss}>
        <StatusHeading
          mark={
            <span className={statusMarkDoneCss} aria-hidden="true">
              <CheckIcon />
            </span>
          }
        >
          {t("credit-registration-registered-heading")}
        </StatusHeading>
        <p>
          {isDegreeStudent ? (
            <Trans
              t={t}
              i18nKey="credit-registration-registered-see-it-in-sisu"
              components={{ sisuLink }}
            />
          ) : (
            <Trans
              t={t}
              i18nKey="credit-registration-registered-see-it-in-oma-opintopolku"
              components={{ omaOpintopolkuLink }}
            />
          )}
        </p>
        {registration.registry_already_held_equal_or_better ? (
          <p>{t("credit-registration-explanation-not-improved")}</p>
        ) : null}
        <RegistrationFacts registration={registration} moduleEctsCredits={moduleEctsCredits} />
        <NotificationEmailLine notificationEmail={registration.notification_email} />
        {children}
      </div>
    )
  }

  return (
    <div className={pageCss}>
      <StatusHeading mark={null}>
        {registrationStatusLabel(t, registration.student_facing_status)}
      </StatusHeading>
      <StudentRegistrationExplanation registration={registration} />
      <RegistrationActions primaryAction={primaryAction} secondaryActions={secondaryActions} />
      <RegistrationFacts registration={registration} moduleEctsCredits={moduleEctsCredits} />
      {registration.status_is_moving && checkedAt ? <LastChecked checkedAt={checkedAt} /> : null}
      {children}
      {studentNumber ? <p className={captionCss}>{notYourNumber}</p> : null}
    </div>
  )
}

/**
 * The enrolment wait's one lever, and when we last looked. Not the enrol lever: it would contradict
 * the student's own word that they enrolled.
 */
export const RecheckLever: React.FC<{ registration: MyCreditRegistration }> = ({
  registration,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const { primaryAction, secondaryActions } = useStudentRegistrationActions(registration)
  const recheckAction =
    [primaryAction, ...secondaryActions].find(
      (action) => action?.key === RECHECK_ENROLMENT_ACTION_KEY,
    ) ?? null
  return (
    <>
      <RegistrationActions primaryAction={recheckAction} />
      {registration.enrolment_checked_at ? (
        <p className={captionCss}>
          {t("credit-registration-last-checked")}{" "}
          <RelativeTime at={registration.enrolment_checked_at} absoluteTime={TIME_IN_TITLE} />
        </p>
      ) : null}
    </>
  )
}
