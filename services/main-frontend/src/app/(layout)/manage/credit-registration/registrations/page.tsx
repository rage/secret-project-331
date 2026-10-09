"use client"

import { css, cx } from "@emotion/css"
import { ExclamationTriangle, MagnifyingGlass } from "@vectopus/atlas-icons-react"
import React, { useEffect, useId, useMemo } from "react"
import type { Key } from "react-aria"
import { useTranslation } from "react-i18next"

import {
  adminErrorShortLabel,
  adminLedgerStateLabel,
  attentionReasonLabel,
  isAttentionReason,
} from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import {
  useAdminCreditRegistrations,
  useCreditRegistrationCourseStats,
  useCreditRegistrationOverview,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import { TONE_INK } from "@/components/credit-registration/admin/AdminStateLabel"
import LinkingMethodIcon from "@/components/credit-registration/admin/LinkingMethodIcon"
import {
  ALL_STATES,
  BUCKET_OF_STATE,
  BUCKET_ORDER,
  bucketLabel,
} from "@/components/credit-registration/admin/queueBuckets"
import { REGISTRATIONS_PARAM } from "@/components/credit-registration/admin/registrationsListUrl"
import StudentCell from "@/components/credit-registration/admin/StudentCell"
import {
  ATTENTION_STEPS,
  ENGAGEMENT_STEPS,
  ENGAGEMENTS,
  engagementLabel,
  isEngagement,
  isTimelineStep,
  STEPS_BY_PHASE,
  TIMELINE_PHASES,
  timelinePhaseLabel,
  timelineStepLabel,
} from "@/components/credit-registration/admin/timelineSteps"
import type { FilterFieldDescriptor } from "@/components/credit-registration/admin/useFilteredAdminQuery"
import {
  selectFilterField,
  useFilteredAdminQuery,
} from "@/components/credit-registration/admin/useFilteredAdminQuery"
import {
  ADMIN_PAGE_SIZE_OPTIONS,
  BADGE_COMPACT,
  BUTTON_TERTIARY,
  CREDIT_REGISTRATION_NS,
  DENSITY_COMPACT,
  ID_PREFIX_LENGTH,
  MIDDLE_DOT,
  PLAIN_DISCLOSURE,
  QUIET_REFRESH,
  TABLE_STACK,
  TIME_DURATION,
  TONE,
} from "@/components/credit-registration/constants"
import { labelFrom } from "@/components/credit-registration/labelFrom"
import {
  controlCss,
  controlsCss,
  codeValueCss,
  noteCss,
  rowCss,
  sectionCardCss,
  sectionCardsCss,
  stackedCellCss,
  subsectionCss,
  toolbarCheckboxCss,
} from "@/components/credit-registration/styles"
import { ZonedTimestamp } from "@/components/credit-registration/ZonedTimestamp"
import type {
  AdminCreditRegistrationRow,
  CreditRegistrationErrorCode,
  CreditRegistrationState,
  Engagement,
  TimelinePhase,
  TimelineStep,
} from "@/generated/api/types.generated"
import Pagination from "@/shared-module/common/components/Pagination"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { creditRegistrationItemRoute } from "@/shared-module/common/utils/routes"
import {
  Badge,
  Button,
  Checkbox,
  Chip,
  Disclosure,
  EmptyState,
  MultiSelect,
  QueryResult,
  RelativeTime,
  Select,
  Table,
  TextField,
  ToggleButtonGroup,
  ToggleButtonGroupButton,
} from "@/shared-module/components"

const ROWS_PER_PAGE = 50
const SEARCH_ICON_SIZE = 16
const ATTENTION_ICON_SIZE = 14

const PARAM = REGISTRATIONS_PARAM
const TRUE = "true"
const NONE = ""
const SELECT_MANY = "multiple" as const

const SORT_LAST_ACTIVITY = "last_activity"
const SORT_CREATED = "created"
const SORT_TIME_IN_STATE = "time_in_state"
const SORT_ATTEMPTS = "attempts"

/** The filters shown as removable chips: the ones a deep link sets and no control on the page owns. */
const CHIP_PARAMS = [PARAM.courseModuleId, PARAM.userId, PARAM.studentNumber, PARAM.attentionReason]

const NARROWING_PARAMS = [
  PARAM.step,
  PARAM.engagement,
  PARAM.state,
  PARAM.errorCode,
  PARAM.courseId,
  ...CHIP_PARAMS,
]

/** Chip labels for `CHIP_PARAMS`. */
const FILTER_LABEL_KEYS: Record<string, string> = {
  [PARAM.courseModuleId]: "label-course-module-id",
  [PARAM.userId]: "label-user-id",
  [PARAM.studentNumber]: "label-student-number",
  [PARAM.attentionReason]: "label-reason",
}

/** A uuid filter reads as noise in full; the prefix is enough to tell two of them apart. */
const ID_PARAMS = new Set<string>([PARAM.courseModuleId, PARAM.userId])

interface StepOption {
  step: TimelineStep
  phase: TimelinePhase
  label: string
}

interface StateOption {
  state: CreditRegistrationState
  label: string
}

interface ErrorCodeOption {
  code: CreditRegistrationErrorCode
  label: string
}

interface FilterFields {
  search: string
  sort: string
  course_id: string
  attention: boolean
  notStarted: boolean
  superseded: boolean
  steps: string[]
  engagements: Set<Key>
  states: string[]
  errorCodes: string[]
}

const booleanField = (
  param: string,
  field: "attention" | "notStarted" | "superseded",
): FilterFieldDescriptor<FilterFields> => ({
  param,
  field,
  fromParam: (raw) => raw === TRUE,
  toParam: (value) => (value ? TRUE : undefined),
})

const FILTER_FIELDS: FilterFieldDescriptor<FilterFields>[] = [
  {
    param: PARAM.sort,
    field: "sort",
    fromParam: (raw) => raw ?? SORT_LAST_ACTIVITY,
    // The default order stays out of the URL, so a pasted link carries only what was chosen.
    toParam: (value) => (value === SORT_LAST_ACTIVITY ? undefined : (value as string)),
  },
  selectFilterField(PARAM.courseId, "course_id"),
  booleanField(PARAM.needsAttention, "attention"),
  booleanField(PARAM.includeNotStarted, "notStarted"),
  booleanField(PARAM.includeSuperseded, "superseded"),
]

const searchCss = css`
  min-width: 20rem;
  flex: 1 1 20rem;
`

const activityCss = css`
  display: grid;
  gap: var(--space-2);
`

const attentionLineCss = css`
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
`

const stepCss = css`
  font-weight: 500;
`

/** Mirrors a multi-valued param into a form field and back; each side writes only on a difference. */
const useMirroredParam = (
  values: string[],
  picked: string[],
  write: (values: string[]) => void,
  apply: (values: string[]) => void,
) => {
  useEffect(() => {
    write(values)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [values.join()])

  useEffect(() => {
    if (picked.join() !== values.join()) {
      apply(picked)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [picked.join()])
}

/** Phase over step, in the timeline's words; an ending is its own one line. */
const StatusCell: React.FC<{ row: AdminCreditRegistrationRow }> = ({ row }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const needsAttention = row.attention_standing === "needs_attention"
  const isAttention = !row.superseded && (needsAttention || ATTENTION_STEPS.has(row.timeline_step))
  const reason = needsAttention ? row.attention_reasons[0] : undefined
  return (
    <span className={stackedCellCss}>
      {row.phase !== "ended" && <span className={noteCss}>{timelinePhaseLabel(t, row.phase)}</span>}
      <span className={cx(stepCss, isAttention && TONE_INK["action-needed"])}>
        {isAttention ? (
          <span className={attentionLineCss}>
            <ExclamationTriangle size={ATTENTION_ICON_SIZE} aria-hidden />
            {timelineStepLabel(t, row.timeline_step)}
          </span>
        ) : (
          timelineStepLabel(t, row.timeline_step)
        )}
      </span>
      {reason && <span className={noteCss}>{attentionReasonLabel(t, reason)}</span>}
      {row.attention_standing === "running_late" && (
        <span className={noteCss}>{t("credit-registration-admin-running-late")}</span>
      )}
      {row.superseded && (
        <span>
          <Badge tone={TONE.NEUTRAL} size={BADGE_COMPACT}>
            {t("credit-registration-admin-replaced")}
          </Badge>
        </span>
      )}
    </span>
  )
}

/** Superseded attempts and students who have not started are hidden unless asked for. */
const RegistrationsPage: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const activityLabelId = useId()

  const {
    control,
    watch,
    setValue,
    handleSubmit,
    param,
    params,
    applyParams,
    clearFilters,
    paginationInfo,
    query,
  } = useFilteredAdminQuery(
    FILTER_FIELDS,
    (filters, pagination) => {
      const steps = filters.params(PARAM.step).filter((value) => isTimelineStep(value))
      const engagements = filters.params(PARAM.engagement).filter((value) => isEngagement(value))
      const attentionReasons = filters
        .params(PARAM.attentionReason)
        .filter((value) => isAttentionReason(value))
      const states = filters.params(PARAM.state) as CreditRegistrationState[]
      const errorCodes = filters.params(PARAM.errorCode) as CreditRegistrationErrorCode[]
      const courseId = filters.param(PARAM.courseId)
      const courseModuleId = filters.param(PARAM.courseModuleId)
      const userId = filters.param(PARAM.userId)
      const studentNumber = filters.param(PARAM.studentNumber)
      const search = filters.param(PARAM.search)
      const sort = filters.param(PARAM.sort)
      // Picking Not started would otherwise select rows the default leaves out.
      const includeNotStarted =
        filters.param(PARAM.includeNotStarted) === TRUE || engagements.includes("not_started")
      return {
        page: pagination.page,
        limit: pagination.limit,
        ...includeIf(steps.length > 0, { step: steps }),
        ...includeIf(engagements.length > 0, { engagement: engagements }),
        ...includeIf(includeNotStarted, { include_not_started: true }),
        ...includeIf(attentionReasons.length > 0, { attention_reason: attentionReasons }),
        ...includeIf(states.length > 0, { state: states }),
        ...includeIf(errorCodes.length > 0, { error_code: errorCodes }),
        ...includeIf(courseId, { course_id: courseId }),
        ...includeIf(courseModuleId, { course_module_id: courseModuleId }),
        ...includeIf(userId, { user_id: userId }),
        ...includeIf(studentNumber, { student_number: studentNumber }),
        ...includeIf(filters.param(PARAM.needsAttention) === TRUE, { needs_attention: true }),
        ...includeIf(search, { search }),
        ...includeIf(filters.param(PARAM.includeSuperseded) === TRUE, {
          include_superseded: true,
        }),
        ...includeIf(sort, { sort }),
      }
    },
    {
      rowsPerPage: ROWS_PER_PAGE,
      manualDefaults: (filters) => ({
        search: filters.param(PARAM.search) ?? "",
        steps: filters.params(PARAM.step),
        engagements: new Set<Key>(filters.params(PARAM.engagement)),
        states: filters.params(PARAM.state),
        errorCodes: filters.params(PARAM.errorCode),
      }),
    },
  )

  const typedSearch = watch("search")
  // Refetching mid-word would reshuffle the table under the operator's cursor.
  const searchPending = typedSearch.trim() !== (param(PARAM.search) ?? "")

  const registrationsQuery = useAdminCreditRegistrations(query, { paused: searchPending })
  const chipFilters = CHIP_PARAMS.flatMap((name) => params(name).map((value) => ({ name, value })))

  // The stats are one row per module, and a course can have several enabled modules: dedupe by
  // course_id or the Select gets two options with the same value and refuses to render at all.
  const courseStatsQuery = useCreditRegistrationCourseStats()
  const courseOptions = useMemo(() => {
    const byCourseId = new Map<string, string>()
    for (const courseModule of courseStatsQuery.data?.modules ?? []) {
      byCourseId.set(courseModule.course_id, courseModule.course_name)
    }
    return Array.from(byCourseId, ([value, label]) => ({ value, label }))
  }, [courseStatsQuery.data?.modules])

  // Naming the module only tells the reader something where a course has more than one.
  const manyModuleCourseIds = useMemo(() => {
    const counts = new Map<string, number>()
    for (const courseModule of courseStatsQuery.data?.modules ?? []) {
      counts.set(courseModule.course_id, (counts.get(courseModule.course_id) ?? 0) + 1)
    }
    return new Set(
      Array.from(counts)
        .filter(([, count]) => count > 1)
        .map(([courseId]) => courseId),
    )
  }, [courseStatsQuery.data?.modules])

  // The live ledger's codes, so the filter never offers one no row could match.
  const overviewQuery = useCreditRegistrationOverview()
  const errorCodeOptions: ErrorCodeOption[] = (overviewQuery.data?.error_codes ?? []).map(
    (row) => ({
      code: row.error_code,
      label: `${adminErrorShortLabel(t, row.error_code)}${MIDDLE_DOT}${row.error_code}`,
    }),
  )

  const stepOptions: StepOption[] = TIMELINE_PHASES.flatMap((phase) =>
    STEPS_BY_PHASE[phase].map((step) => ({ step, phase, label: timelineStepLabel(t, step) })),
  )

  const stateOptions: StateOption[] = BUCKET_ORDER.flatMap((bucket) =>
    ALL_STATES.filter((state) => BUCKET_OF_STATE[state] === bucket).map((state) => ({
      state,
      label: `${adminLedgerStateLabel(t, state)}${MIDDLE_DOT}${bucketLabel(t, bucket)}`,
    })),
  )

  const chosenSteps = params(PARAM.step)
  const chosenEngagements = params(PARAM.engagement)
  const chosenStates = params(PARAM.state)
  const chosenErrorCodes = params(PARAM.errorCode)

  useMirroredParam(
    chosenSteps,
    watch("steps"),
    (values) => setValue("steps", values),
    (values) => applyParams({ [PARAM.step]: values }),
  )
  useMirroredParam(
    chosenEngagements,
    // In the order the chips are listed, so toggling one never reorders the URL.
    ENGAGEMENTS.filter((engagement) => watch("engagements").has(engagement)),
    (values) => setValue("engagements", new Set<Key>(values)),
    (values) => applyParams({ [PARAM.engagement]: values }),
  )
  useMirroredParam(
    chosenStates,
    watch("states"),
    (values) => setValue("states", values),
    (values) => applyParams({ [PARAM.state]: values }),
  )
  useMirroredParam(
    chosenErrorCodes,
    watch("errorCodes"),
    (values) => setValue("errorCodes", values),
    (values) => applyParams({ [PARAM.errorCode]: values }),
  )

  const chipText = (name: string, value: string): string => {
    if (name === PARAM.attentionReason && isAttentionReason(value)) {
      return attentionReasonLabel(t, value)
    }
    return ID_PARAMS.has(name) ? value.slice(0, ID_PREFIX_LENGTH) : value
  }

  const searchTerm = param(PARAM.search)
  const activeFilters: string[] = [
    ...chosenSteps
      .filter((value) => isTimelineStep(value))
      .map((step) => timelineStepLabel(t, step)),
    ...chosenEngagements
      .filter((value) => isEngagement(value))
      .map((engagement) => engagementLabel(t, engagement)),
    ...chosenStates.map((state) => adminLedgerStateLabel(t, state as CreditRegistrationState)),
    ...chosenErrorCodes,
    ...chipFilters.map(
      ({ name, value }) =>
        `${labelFrom(t, FILTER_LABEL_KEYS, name, name)}: ${chipText(name, value)}`,
    ),
    ...(searchTerm ? [searchTerm] : []),
  ]

  const clearEveryFilter = () => clearFilters([...NARROWING_PARAMS, PARAM.search])
  const hasAdvancedFilters = chosenStates.length > 0 || chosenErrorCodes.length > 0

  return (
    <div className={sectionCardsCss}>
      {/* No card header: this page is one card, and the layout's h1 already names it — a title
          here would only repeat it. The table keeps the same string as its caption. */}
      <section className={sectionCardCss}>
        <form
          className={controlsCss}
          onSubmit={handleSubmit((fields) => applyParams({ [PARAM.search]: fields.search.trim() }))}
        >
          <div className={searchCss}>
            <TextField
              name="search"
              control={control}
              label={t("credit-registration-admin-search-label")}
              description={t("credit-registration-admin-search-description")}
              iconEnd={<MagnifyingGlass size={SEARCH_ICON_SIZE} />}
            />
          </div>
        </form>
        <div className={controlsCss}>
          <div className={controlCss}>
            <Select
              name="course_id"
              control={control}
              label={t("label-course")}
              options={[
                { value: NONE, label: t("credit-registration-admin-any-course") },
                ...courseOptions,
              ]}
              searchEnabled
            />
          </div>
          <div className={controlCss}>
            <MultiSelect
              name="steps"
              control={control}
              label={t("credit-registration-admin-filter-step")}
              placeholder={t("credit-registration-admin-any-step")}
              items={stepOptions}
              getItemKey={(option) => option.step}
              getItemTextValue={(option) => option.label}
              getItemSection={(option) => timelinePhaseLabel(t, option.phase)}
            />
          </div>
          <div className={controlCss}>
            <Select
              name="sort"
              control={control}
              label={t("credit-registration-admin-sort")}
              options={[
                {
                  value: SORT_LAST_ACTIVITY,
                  label: t("credit-registration-admin-sort-last-activity"),
                },
                {
                  value: SORT_TIME_IN_STATE,
                  label: t("credit-registration-admin-sort-time-in-state"),
                },
                { value: SORT_ATTEMPTS, label: t("credit-registration-admin-sort-attempts") },
                { value: SORT_CREATED, label: t("credit-registration-admin-sort-created") },
              ]}
            />
          </div>
        </div>
        <div className={controlsCss}>
          <div className={activityCss}>
            <span id={activityLabelId} className={noteCss}>
              {t("credit-registration-admin-student-activity")}
            </span>
            <ToggleButtonGroup
              name="engagements"
              control={control}
              label={null}
              aria-labelledby={activityLabelId}
              selectionMode={SELECT_MANY}
              disallowEmptySelection={false}
            >
              {ENGAGEMENTS.map((engagement: Engagement) => (
                <ToggleButtonGroupButton key={engagement} id={engagement}>
                  {engagementLabel(t, engagement)}
                </ToggleButtonGroupButton>
              ))}
            </ToggleButtonGroup>
          </div>
          <div className={toolbarCheckboxCss}>
            <Checkbox
              name="attention"
              control={control}
              isInline
              label={t("credit-registration-admin-only-needs-attention")}
            />
          </div>
          <div className={toolbarCheckboxCss}>
            <Checkbox
              name="notStarted"
              control={control}
              isInline
              label={t("credit-registration-admin-show-not-started")}
            />
          </div>
          <div className={toolbarCheckboxCss}>
            <Checkbox
              name="superseded"
              control={control}
              isInline
              label={t("credit-registration-admin-show-superseded")}
            />
          </div>
        </div>
        <Disclosure
          title={t("credit-registration-admin-advanced-filters")}
          variant={PLAIN_DISCLOSURE}
          defaultExpanded={hasAdvancedFilters}
        >
          <div className={subsectionCss}>
            <p className={noteCss}>{t("credit-registration-admin-advanced-filters-note")}</p>
            <div className={controlsCss}>
              <div className={controlCss}>
                <MultiSelect
                  name="states"
                  control={control}
                  label={t("label-state")}
                  placeholder={t("credit-registration-admin-any-state")}
                  items={stateOptions}
                  getItemKey={(option) => option.state}
                  getItemTextValue={(option) => option.label}
                />
              </div>
              <div className={controlCss}>
                <MultiSelect
                  name="errorCodes"
                  control={control}
                  label={t("label-error-code")}
                  placeholder={t("credit-registration-admin-any-error-code")}
                  items={errorCodeOptions}
                  getItemKey={(option) => option.code}
                  getItemTextValue={(option) => option.label}
                />
              </div>
            </div>
          </div>
        </Disclosure>
        {chipFilters.length > 0 && (
          <div className={rowCss}>
            {chipFilters.map(({ name, value }) => (
              <Chip
                key={`${name}:${value}`}
                onRemove={() =>
                  applyParams({ [name]: params(name).filter((one) => one !== value) })
                }
                removeLabel={t("credit-registration-admin-remove-filter", {
                  filter: labelFrom(t, FILTER_LABEL_KEYS, name, name),
                  value: chipText(name, value),
                })}
              >
                {`${labelFrom(t, FILTER_LABEL_KEYS, name, name)}: ${chipText(name, value)}`}
              </Chip>
            ))}
          </div>
        )}
        <QueryResult query={registrationsQuery} refreshIndicator={QUIET_REFRESH}>
          {(page) =>
            page.data.length === 0 ? (
              <EmptyState
                title={t("credit-registration-admin-no-matching-rows")}
                // Nothing to clear when nothing is filtered, and a button that does nothing is worse
                // than no button.
                {...includeIf(activeFilters.length > 0, {
                  hint: t("credit-registration-admin-filters-in-use", {
                    filters: activeFilters.join(MIDDLE_DOT),
                  }),
                  action: (
                    <Button variant={BUTTON_TERTIARY} size="medium" onClick={clearEveryFilter}>
                      {t("button-text-clear-filters")}
                    </Button>
                  ),
                })}
              />
            ) : (
              <>
                {page.total_pages < 2 && (
                  <p className={noteCss}>
                    {t("credit-registration-admin-row-count", { count: page.total_count })}
                  </p>
                )}
                <Table
                  caption={t("credit-registration-heading-registrations")}
                  density={DENSITY_COMPACT}
                  rowKey={(row) => row.id}
                  rows={page.data}
                  responsive={TABLE_STACK}
                  stickyFirstColumn
                  rowHover
                  columns={[
                    {
                      header: t("label-student"),
                      minWidth: "14rem",
                      cell: (row) => (
                        <StudentCell row={row} href={creditRegistrationItemRoute(row.id)} />
                      ),
                    },
                    {
                      header: t("label-course"),
                      grow: 1,
                      minWidth: "11rem",
                      cell: (row) => (
                        <span className={stackedCellCss}>
                          <span>{row.course_name}</span>
                          {manyModuleCourseIds.has(row.course_id) && (
                            <span className={noteCss}>{row.course_module_name}</span>
                          )}
                          {row.uh_course_code && (
                            <span className={cx(noteCss, codeValueCss)}>{row.uh_course_code}</span>
                          )}
                        </span>
                      ),
                    },
                    {
                      header: t("label-student-number"),
                      minWidth: "8rem",
                      nowrap: true,
                      cell: (row) => {
                        const number = row.verified_student_number ?? row.student_number
                        if (!number) {
                          return (
                            <span className={noteCss}>
                              {t("credit-registration-admin-not-linked")}
                            </span>
                          )
                        }
                        return (
                          <span className={rowCss}>
                            <span className={codeValueCss}>{number}</span>
                            {row.verified_student_number_via && (
                              <LinkingMethodIcon
                                method={row.verified_student_number_via}
                                linkedAt={row.verified_student_number_at}
                              />
                            )}
                          </span>
                        )
                      },
                    },
                    {
                      header: t("label-status"),
                      minWidth: "14rem",
                      cell: (row) => <StatusCell row={row} />,
                    },
                    {
                      header: t("credit-registration-admin-student-activity"),
                      minWidth: "7rem",
                      nowrap: true,
                      cell: (row) =>
                        row.engagement && ENGAGEMENT_STEPS.has(row.timeline_step) ? (
                          <Badge
                            tone={row.engagement === "pressed" ? TONE.INFO : TONE.NEUTRAL}
                            size={BADGE_COMPACT}
                          >
                            {engagementLabel(t, row.engagement)}
                          </Badge>
                        ) : null,
                    },
                    {
                      header: t("label-credit-registration-in-phase-since"),
                      minWidth: "9rem",
                      nowrap: true,
                      cell: (row) => (
                        <span className={stackedCellCss}>
                          <RelativeTime at={row.phase_started_at} absoluteTime={TIME_DURATION} />
                          <span className={noteCss}>
                            <ZonedTimestamp at={row.phase_started_at} />
                          </span>
                        </span>
                      ),
                    },
                    {
                      header: t("label-credit-registration-last-activity"),
                      minWidth: "9rem",
                      nowrap: true,
                      // A blocked row has never been attempted, but entering its current state
                      // counts as its last activity, or "—" here would read as "nothing ever
                      // happened".
                      cell: (row) => {
                        const at = row.last_attempt_at ?? row.state_entered_at
                        return (
                          <span className={stackedCellCss}>
                            <RelativeTime at={at} absoluteTime={TIME_DURATION} />
                            <span className={noteCss}>
                              <ZonedTimestamp at={at} />
                            </span>
                          </span>
                        )
                      },
                    },
                  ]}
                />
                <Pagination
                  paginationInfo={paginationInfo}
                  totalPages={page.total_pages}
                  totalItems={page.total_count}
                  itemsPerPageOptions={ADMIN_PAGE_SIZE_OPTIONS}
                />
              </>
            )
          }
        </QueryResult>
      </section>
    </div>
  )
}

export default RegistrationsPage
