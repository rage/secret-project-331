"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  getCourseCreditRegistrationModuleConfigsOptions,
  getCourseCreditRegistrationSummaryOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  CourseCreditRegistrationModuleSummary,
  CourseModuleCreditRegistrationConfig,
} from "@/generated/api/types.generated"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { manageCourseModulesRoute } from "@/shared-module/common/utils/routes"
import type { RegistrationStatusState } from "@/shared-module/components"
import {
  Badge,
  Button,
  Disclosure,
  Infobox,
  Link,
  QueryResult,
  RelativeTime,
  Table,
} from "@/shared-module/components"

import {
  ALIGN_END,
  BADGE_COMPACT,
  BUTTON_TERTIARY,
  DENSITY_COMPACT,
  PLAIN_DISCLOSURE,
  QUIET_REFRESH,
  TIME_COMPACT,
  TONE,
} from "./constants"
import CourseCreditRegistrationActionsPanel from "./CourseCreditRegistrationActionsPanel"
import CreditRegistrationConfigCallout from "./CreditRegistrationConfigCallout"
import type { FailureOwner, FailureRemedy } from "./registrationFailures"
import { FAILURE_OWNERS, failureOwnerHeading, failureRemedy } from "./registrationFailures"
import type { RegistrationStatusView } from "./registrationStatusViews"
import {
  DEFAULT_REGISTRATION_STATUS_VIEW,
  registrationStatusViewLabel,
} from "./registrationStatusViews"
import RetryFailedCreditRegistrationsBlock from "./RetryFailedCreditRegistrationsBlock"
import type { StatusBreakdownSegment } from "./StatusBreakdown"
import StatusBreakdown from "./StatusBreakdown"
import {
  dividedListCss,
  headingCss,
  noteCss,
  proseCss,
  sectionCss,
  sectionHeaderCss,
  sectionsCss,
  subheadingCss,
  subsectionCss,
} from "./styles"
import type { CreditRegistrationFailureReason } from "./teacherCreditRegistrations"
import { useCourseFailureReasons } from "./teacherCreditRegistrations"

/** Puts the roster under one of the named views. Without it the counts are plain numbers. */
export type SelectRegistrationStatusView = (view: RegistrationStatusView) => void

interface Props {
  courseId: string
  /**
   * Narrows every count to one instance, so the panel cannot contradict the roster it sits over.
   * `null` is the whole course.
   */
  courseInstanceId?: string | null
  /** Narrows the by-module rows to the module the roster below is filtered to. */
  moduleId?: string | null
  /** The roster's own status filter, so the panel can say when its counts cover more than it shows. */
  registrationView?: RegistrationStatusView
  onSelectView?: SelectRegistrationStatusView
}

const sumBy = (
  modules: CourseCreditRegistrationModuleSummary[],
  pick: (module: CourseCreditRegistrationModuleSummary) => number,
): number => modules.reduce((total, module) => total + pick(module), 0)

/**
 * One partition of one module's live registrations. `view` is what the roster's filter calls this
 * slice and is where its label comes from, so a count and the rows it opens cannot drift apart.
 */
interface StageSegment {
  view: RegistrationStatusView
  state: RegistrationStatusState
  count: (module: CourseCreditRegistrationModuleSummary) => number
}

const SEGMENTS = [
  {
    view: "registered",
    state: "done",
    count: (module) => module.registered_count,
  },
  {
    view: "in_progress",
    state: "current",
    count: (module) => module.in_progress_count,
  },
  {
    view: "waiting_on_student",
    state: "action-needed",
    count: (module) => module.waiting_on_student_count,
  },
  {
    view: "failed",
    state: "failed",
    count: (module) => module.failed_count,
  },
  {
    view: "not_registering",
    state: "upcoming",
    count: (module) => module.not_registering_count,
  },
] as const satisfies readonly StageSegment[]

/** The lint that guards user-facing strings rejects a bare one in JSX, so these are named. */
const COURSE_SETUP_OWNER: FailureOwner = "course_setup"
const REGISTRY_OWNER: FailureOwner = "registry"
const RETRY_REMEDY: FailureRemedy = "retry"
const STACKED_TABLE = "stack" as const
const FAILED_VIEW: RegistrationStatusView = "failed"

const headerRowCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
`

const strongLineCss = css`
  font-weight: 600;
  color: var(--color-gray-700);
`

/** The owner-group heading: lighter than the module name row it can otherwise be mistaken for. */
const groupHeadingCss = css`
  font-size: var(--font-size-1);
  font-weight: 500;
  color: var(--color-gray-500);
  letter-spacing: 0.02em;
  text-transform: uppercase;
`

const reasonListCss = css`
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
`

const reasonRowCss = css`
  display: grid;
  grid-template-columns: 2.5rem 1fr;
  column-gap: var(--space-2);
`

const reasonCountCss = css`
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
  font-variant-numeric: tabular-nums;
  text-align: right;
`

const supportNoteCss = css`
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
`

/** Module breakdown left, failures right once there is room; a cap so the panel never stretches
 * past what its content needs at very wide viewports. */
const breakdownGridCss = css`
  display: grid;
  gap: var(--space-5);

  ${respondToOrLarger.xl} {
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    align-items: start;
    max-width: 84rem;
  }
`

/** Why a paused module is paused, and that a teacher is not the one who lifts it. */
const PauseNotice: React.FC<{
  moduleName: string
  config: CourseModuleCreditRegistrationConfig
  /** False when the module's own row (with its "Paused" badge) is right below this notice. */
  showModuleName: boolean
}> = ({ moduleName, config, showModuleName }) => {
  const { t } = useTranslation()
  const hasReason = Boolean(
    config.credit_registration_paused_at || config.credit_registration_pause_reason,
  )
  return (
    <Infobox tone={TONE.WARNING}>
      {(showModuleName || !hasReason) && (
        <div>{t("credit-registration-module-paused-explanation", { module: moduleName })}</div>
      )}
      {config.credit_registration_paused_at && (
        <div className={noteCss}>
          {t("credit-registration-module-paused-since")}{" "}
          <RelativeTime at={config.credit_registration_paused_at} absoluteTime={TIME_COMPACT} />
        </div>
      )}
      {/* Support's own words, so the teacher is told it is a quotation rather than our sentence. */}
      {config.credit_registration_pause_reason && (
        <div className={noteCss}>
          {t("credit-registration-pause-reason-given")} {config.credit_registration_pause_reason}
        </div>
      )}
    </Infobox>
  )
}

/** Right-aligned tabular count in its own column, so a run of reasons stays scannable. */
const ReasonList: React.FC<{ reasons: CreditRegistrationFailureReason[] }> = ({ reasons }) => (
  <ul className={reasonListCss}>
    {reasons.map(({ errorCode, count, label }) => (
      <li key={errorCode} className={reasonRowCss}>
        <span className={reasonCountCss}>{count}</span>
        <span className={noteCss}>{label}</span>
      </li>
    ))}
  </ul>
)

/**
 * The course's failures grouped by who has to clear them, worst cause first inside each group.
 *
 * Grouped, not flatly listed, so a teacher's own three failures don't get buried among twenty of
 * Sisu's. The registry group is split further: a timeout needs a check, not a resend, so it cannot
 * share the retry button's count with the reasons a retry can actually clear.
 */
const FailuresByOwner: React.FC<{
  courseId: string
  reasons: CreditRegistrationFailureReason[]
  failedCount: number
  isCapped: boolean
  retryableCount: number
  isAnyModulePaused: boolean
  onSelectView: SelectRegistrationStatusView | undefined
}> = ({
  courseId,
  reasons,
  failedCount,
  isCapped,
  retryableCount,
  isAnyModulePaused,
  onSelectView,
}) => {
  const { t } = useTranslation()
  if (reasons.length === 0) {
    return null
  }

  return (
    <div className={subsectionCss}>
      <div className={sectionHeaderCss}>
        <h3 className={subheadingCss}>
          {t("credit-registration-heading-failures", { count: failedCount })}
        </h3>
        {isCapped && (
          <p className={noteCss}>{t("credit-registration-failures-by-reason-capped")}</p>
        )}
      </div>
      <ul className={dividedListCss}>
        {FAILURE_OWNERS.map((owner) => {
          const group = reasons.filter((reason) => reason.owner === owner)
          if (group.length === 0) {
            return null
          }
          const isRegistry = owner === REGISTRY_OWNER
          const retryable = isRegistry
            ? group.filter((reason) => failureRemedy(reason.errorCode) === RETRY_REMEDY)
            : group
          const awaitingCheck = isRegistry
            ? group.filter((reason) => failureRemedy(reason.errorCode) !== RETRY_REMEDY)
            : []
          return (
            <li key={owner} className={sectionCss}>
              <div className={headerRowCss}>
                <span className={groupHeadingCss}>{failureOwnerHeading(t, owner)}</span>
                {owner === COURSE_SETUP_OWNER && (
                  <Link href={manageCourseModulesRoute(courseId)}>
                    {t("credit-registration-open-module-settings")}
                  </Link>
                )}
              </div>
              <ReasonList reasons={retryable} />
              {isRegistry && (
                <RetryFailedCreditRegistrationsBlock
                  courseId={courseId}
                  retryableCount={retryableCount}
                  isAnyModulePaused={isAnyModulePaused}
                />
              )}
              {awaitingCheck.length > 0 && (
                <>
                  <span className={supportNoteCss}>
                    {t("credit-registration-owner-heading-awaiting-check")}
                  </span>
                  <ReasonList reasons={awaitingCheck} />
                </>
              )}
            </li>
          )
        })}
      </ul>
      {onSelectView && (
        <div>
          <Button
            variant={BUTTON_TERTIARY}
            size="small"
            type="button"
            onClick={() => onSelectView(FAILED_VIEW)}
          >
            {t("credit-registration-show-failed-in-roster")}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * How the course's credits are going: one partition per module of the registrations the roster
 * below lists, what is holding the failures up, and the one control that moves them.
 *
 * Belongs above the roster it describes. Every count here is a live registration — one per student
 * per module — and never a credit or an enrolled student, both of which count something else.
 */
const CourseCreditRegistrationSummaryPanel: React.FC<Props> = ({
  courseId,
  courseInstanceId,
  moduleId,
  registrationView,
  onSelectView,
}) => {
  const { t } = useTranslation()
  const summaryQuery = useQuery(
    getCourseCreditRegistrationSummaryOptions({
      path: { course_id: courseId },
      ...includeIf(courseInstanceId, { query: { course_instance_id: courseInstanceId ?? "" } }),
    }),
  )
  const configsQuery = useQuery(
    getCourseCreditRegistrationModuleConfigsOptions({ path: { course_id: courseId } }),
  )

  const shownModules = (summaryQuery.data?.modules ?? []).filter(
    (module) => module.enabled && (!moduleId || module.course_module_id === moduleId),
  )
  const failedCount = sumBy(shownModules, (module) => module.failed_count)
  const { reasons, retryableCount, isCapped } = useCourseFailureReasons(
    courseId,
    courseInstanceId ?? null,
    moduleId ?? null,
    failedCount > 0,
  )

  return (
    <QueryResult query={summaryQuery} refreshIndicator={QUIET_REFRESH}>
      {(summary) => {
        if (shownModules.length === 0) {
          return null
        }
        const configOf = (id: string) =>
          configsQuery.data?.modules.find((config) => config.course_module_id === id)
        const nameOf = (module: CourseCreditRegistrationModuleSummary) =>
          module.course_module_name ?? t("default-module")
        const isAnyModulePaused = shownModules.some((module) => module.paused)

        const segmentsOf = (
          module: CourseCreditRegistrationModuleSummary,
        ): StatusBreakdownSegment[] =>
          SEGMENTS.map(({ view, state, count }) => ({
            key: view,
            label: registrationStatusViewLabel(t, view),
            count: count(module),
            state,
            ...(onSelectView ? { onSelect: () => onSelectView(view) } : {}),
          }))

        return (
          <section className={sectionsCss}>
            <div className={sectionHeaderCss}>
              <h2 className={headingCss}>{t("heading-credit-registration")}</h2>
              <p className={noteCss}>
                {courseInstanceId
                  ? t("credit-registration-counts-this-instance-only")
                  : t("credit-registration-counts-across-the-course")}
              </p>
              {registrationView && registrationView !== DEFAULT_REGISTRATION_STATUS_VIEW && (
                <p className={noteCss}>
                  {t("credit-registration-roster-filtered-to", {
                    view: registrationStatusViewLabel(t, registrationView),
                  })}
                </p>
              )}
            </div>

            {shownModules.map((module) => {
              const config = configOf(module.course_module_id)
              return module.paused && config ? (
                <PauseNotice
                  key={module.course_module_id}
                  moduleName={nameOf(module)}
                  config={config}
                  showModuleName={shownModules.length > 1}
                />
              ) : null
            })}
            <CreditRegistrationConfigCallout
              configs={shownModules.map((module) => ({
                moduleName: nameOf(module),
                config: configOf(module.course_module_id),
              }))}
              fixHref={manageCourseModulesRoute(courseId)}
            />

            <div className={breakdownGridCss}>
              <ul className={dividedListCss}>
                {shownModules.map((module) => (
                  <li key={module.course_module_id} className={subsectionCss}>
                    <div className={headerRowCss}>
                      <span className={strongLineCss}>{nameOf(module)}</span>
                      <span className={noteCss}>
                        {t("credit-registration-registrations-count", {
                          count: module.registration_count,
                        })}
                      </span>
                      {module.paused && (
                        <Badge tone={TONE.NEUTRAL} size={BADGE_COMPACT}>
                          {t("credit-registration-module-paused")}
                        </Badge>
                      )}
                      {module.needs_admin_attention_count > 0 && (
                        <Badge tone={TONE.INFO} size={BADGE_COMPACT}>
                          {t("credit-registration-being-handled-by-support", {
                            count: module.needs_admin_attention_count,
                          })}
                        </Badge>
                      )}
                    </div>
                    {module.needs_admin_attention_count > 0 && (
                      <p className={supportNoteCss}>
                        {t("credit-registration-with-support-explanation")}
                      </p>
                    )}
                    <StatusBreakdown
                      label={nameOf(module)}
                      segments={segmentsOf(module)}
                      total={module.registration_count}
                    />
                  </li>
                ))}
              </ul>

              <FailuresByOwner
                courseId={courseId}
                reasons={reasons}
                failedCount={failedCount}
                isCapped={isCapped}
                retryableCount={retryableCount}
                isAnyModulePaused={isAnyModulePaused}
                onSelectView={onSelectView}
              />
            </div>

            {summary.unlinked_enrolled_student_count > 0 && (
              <div className={subsectionCss}>
                <p className={proseCss}>
                  {t("credit-registration-unlinked-enrolled-explanation", {
                    count: summary.unlinked_enrolled_student_count,
                  })}
                </p>
                {summary.linking_emails_failed_to_send_count > 0 && (
                  <p className={noteCss}>
                    {t("credit-registration-unlinked-emails-failed", {
                      count: summary.linking_emails_failed_to_send_count,
                    })}
                  </p>
                )}
              </div>
            )}

            <Disclosure
              variant={PLAIN_DISCLOSURE}
              title={t("credit-registration-heading-exact-counts")}
            >
              <Table
                caption={t("credit-registration-heading-exact-counts")}
                density={DENSITY_COMPACT}
                rowKey={(module) => module.course_module_id}
                rows={shownModules}
                responsive={STACKED_TABLE}
                columns={[
                  {
                    header: t("module"),
                    grow: true,
                    nowrap: false,
                    cell: (module) => nameOf(module),
                  },
                  {
                    header: t("credit-registration-column-registrations"),
                    align: ALIGN_END,
                    cell: (module) => module.registration_count,
                  },
                  ...SEGMENTS.map(({ view, count }) => ({
                    header: registrationStatusViewLabel(t, view),
                    align: ALIGN_END,
                    cell: count,
                  })),
                ]}
              />
            </Disclosure>

            <CourseCreditRegistrationActionsPanel courseId={courseId} />
          </section>
        )
      }}
    </QueryResult>
  )
}

export default CourseCreditRegistrationSummaryPanel
