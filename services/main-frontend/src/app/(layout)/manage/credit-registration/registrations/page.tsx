"use client"

import { css } from "@emotion/css"
import { MagnifyingGlass } from "@vectopus/atlas-icons-react"
import React, { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { registrationErrorNote } from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import {
  useAdminCreditRegistrations,
  useCreditRegistrationCourseStats,
  useCreditRegistrationOverview,
  useCreditRegistrationThresholds,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminStateBadge from "@/components/credit-registration/admin/AdminStateBadge"
import {
  ALL_STATES,
  BUCKET_OF_STATE,
  BUCKET_ORDER,
  bucketLabel,
} from "@/components/credit-registration/admin/queueBuckets"
import {
  secondsSince,
  stuckThresholdSecs,
} from "@/components/credit-registration/admin/stuckThreshold"
import StudentCell from "@/components/credit-registration/admin/StudentCell"
import type { FilterFieldDescriptor } from "@/components/credit-registration/admin/useFilteredAdminQuery"
import {
  selectFilterField,
  useFilteredAdminQuery,
} from "@/components/credit-registration/admin/useFilteredAdminQuery"
import {
  BADGE_COMPACT,
  BUTTON_TERTIARY,
  DENSITY_COMPACT,
  ID_PREFIX_LENGTH,
  MIDDLE_DOT,
  QUIET_REFRESH,
  TABLE_STACK,
  TIME_COMPACT,
  TIME_DURATION,
  TONE,
} from "@/components/credit-registration/constants"
import {
  registrationErrorShortLabel,
  registrationLedgerStateLabel,
} from "@/components/credit-registration/creditRegistrationCopy"
import { labelFrom } from "@/components/credit-registration/labelFrom"
import {
  controlCss,
  controlsCss,
  monospaceCss,
  noteCss,
  rowCss,
  sectionCss,
  stackedCellCss,
} from "@/components/credit-registration/styles"
import type {
  CreditRegistrationErrorCode,
  CreditRegistrationState,
} from "@/generated/api/types.generated"
import Pagination from "@/shared-module/common/components/Pagination"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { creditRegistrationItemRoute } from "@/shared-module/common/utils/routes"
import {
  Badge,
  Button,
  Checkbox,
  Chip,
  EmptyState,
  MultiSelect,
  QueryResult,
  RelativeTime,
  Select,
  Table,
  TextField,
} from "@/shared-module/components"

const ROWS_PER_PAGE = 50
const SEARCH_ICON_SIZE = 16

// Every filter lives in the query string, so links are shareable and the Overview can deep-link in.
const PARAM_STATE = "state"
const PARAM_ERROR_CODE = "error_code"
const PARAM_COURSE_ID = "course_id"
const PARAM_COURSE_MODULE_ID = "course_module_id"
const PARAM_USER_ID = "user_id"
const PARAM_STUDENT_NUMBER = "student_number"
const PARAM_ATTENTION = "needs_admin_attention"
const PARAM_SEARCH = "search"
const PARAM_SUPERSEDED = "include_superseded"
const PARAM_SORT = "sort"
const TRUE = "true"
const NONE = ""

const SORT_LAST_ACTIVITY = "last_activity"
const SORT_CREATED = "created"
const SORT_TIME_IN_STATE = "time_in_state"
const SORT_ATTEMPTS = "attempts"

/** The filters shown as removable chips: the ones a deep link sets and no control on the page owns. */
const CHIP_PARAMS = [PARAM_COURSE_MODULE_ID, PARAM_USER_ID, PARAM_STUDENT_NUMBER]

const NARROWING_PARAMS = [PARAM_STATE, PARAM_ERROR_CODE, PARAM_COURSE_ID, ...CHIP_PARAMS]

/** Chip labels for `CHIP_PARAMS`. Their values are ids and numbers, so only the label translates. */
const FILTER_LABEL_KEYS: Record<string, string> = {
  [PARAM_COURSE_MODULE_ID]: "label-course-module-id",
  [PARAM_USER_ID]: "label-user-id",
  [PARAM_STUDENT_NUMBER]: "label-student-number",
}

/** A uuid filter reads as noise in full; the prefix is enough to tell two of them apart. */
const ID_PARAMS = new Set([PARAM_COURSE_MODULE_ID, PARAM_USER_ID])

/** What a filter chip shows for its value: shortened for ids, raw otherwise. */
const chipValue = (name: string, value: string): string =>
  ID_PARAMS.has(name) ? value.slice(0, ID_PREFIX_LENGTH) : value

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
  superseded: boolean
  states: string[]
  errorCodes: string[]
}

const FILTER_FIELDS: FilterFieldDescriptor<FilterFields>[] = [
  {
    param: PARAM_SORT,
    field: "sort",
    fromParam: (raw) => raw ?? SORT_LAST_ACTIVITY,
    // The default order stays out of the URL, so a pasted link carries only what was chosen.
    toParam: (value) => (value === SORT_LAST_ACTIVITY ? undefined : (value as string)),
  },
  selectFilterField(PARAM_COURSE_ID, "course_id"),
  {
    param: PARAM_ATTENTION,
    field: "attention",
    fromParam: (raw) => raw === TRUE,
    toParam: (value) => (value ? TRUE : undefined),
  },
  {
    param: PARAM_SUPERSEDED,
    field: "superseded",
    fromParam: (raw) => raw === TRUE,
    toParam: (value) => (value ? TRUE : undefined),
  },
]

const searchCss = css`
  min-width: 20rem;
  flex: 1 1 20rem;
`

/** Centers an inline checkbox against the taller floating-label selects beside it in the toolbar. */
const checkboxAlignCss = css`
  align-self: center;
`

/** Superseded attempts are hidden by default: a regraded course holds two rows per student. */
const RegistrationsPage: React.FC = () => {
  const { t } = useTranslation()

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
      const states = filters.params(PARAM_STATE) as CreditRegistrationState[]
      const errorCodes = filters.params(PARAM_ERROR_CODE) as CreditRegistrationErrorCode[]
      const courseId = filters.param(PARAM_COURSE_ID)
      const courseModuleId = filters.param(PARAM_COURSE_MODULE_ID)
      const userId = filters.param(PARAM_USER_ID)
      const studentNumber = filters.param(PARAM_STUDENT_NUMBER)
      const search = filters.param(PARAM_SEARCH)
      const sort = filters.param(PARAM_SORT)
      return {
        page: pagination.page,
        limit: pagination.limit,
        ...includeIf(states.length > 0, { state: states }),
        ...includeIf(errorCodes.length > 0, { error_code: errorCodes }),
        ...includeIf(courseId, { course_id: courseId }),
        ...includeIf(courseModuleId, { course_module_id: courseModuleId }),
        ...includeIf(userId, { user_id: userId }),
        ...includeIf(studentNumber, { student_number: studentNumber }),
        ...includeIf(filters.param(PARAM_ATTENTION) === TRUE, { needs_admin_attention: true }),
        ...includeIf(search, { search }),
        ...includeIf(filters.param(PARAM_SUPERSEDED) === TRUE, { include_superseded: true }),
        ...includeIf(sort, { sort }),
      }
    },
    {
      rowsPerPage: ROWS_PER_PAGE,
      manualDefaults: (filters) => ({
        search: filters.param(PARAM_SEARCH) ?? "",
        states: filters.params(PARAM_STATE),
        errorCodes: filters.params(PARAM_ERROR_CODE),
      }),
    },
  )

  const typedSearch = watch("search")
  // Refetching mid-word would reshuffle the table under the operator's cursor.
  const searchPending = typedSearch.trim() !== (param(PARAM_SEARCH) ?? "")

  const registrationsQuery = useAdminCreditRegistrations(query, { paused: searchPending })
  const thresholds = useCreditRegistrationThresholds().data
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
      label: `${registrationErrorShortLabel(t, row.error_code)}${MIDDLE_DOT}${row.error_code}`,
    }),
  )

  const stateOptions: StateOption[] = BUCKET_ORDER.flatMap((bucket) =>
    ALL_STATES.filter((state) => BUCKET_OF_STATE[state] === bucket).map((state) => ({
      state,
      label: `${registrationLedgerStateLabel(t, state)}${MIDDLE_DOT}${bucketLabel(t, bucket)}`,
    })),
  )

  const chosenStates = params(PARAM_STATE)
  const chosenErrorCodes = params(PARAM_ERROR_CODE)
  const pickedStates = watch("states")
  const pickedErrorCodes = watch("errorCodes")

  // The two multi-selects and the query string mirror each other, and each side writes only when
  // the two differ, which is what stops the pair of effects from bouncing off each other.
  useEffect(() => {
    setValue("states", chosenStates)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenStates.join()])

  useEffect(() => {
    if (pickedStates.join() !== chosenStates.join()) {
      applyParams({ [PARAM_STATE]: pickedStates })
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedStates.join()])

  useEffect(() => {
    setValue("errorCodes", chosenErrorCodes)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenErrorCodes.join()])

  useEffect(() => {
    if (pickedErrorCodes.join() !== chosenErrorCodes.join()) {
      applyParams({ [PARAM_ERROR_CODE]: pickedErrorCodes })
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedErrorCodes.join()])

  const searchTerm = param(PARAM_SEARCH)
  const activeFilters: string[] = [
    ...chosenStates.map((state) =>
      registrationLedgerStateLabel(t, state as CreditRegistrationState),
    ),
    ...chosenErrorCodes,
    ...chipFilters.map(
      ({ name, value }) =>
        `${labelFrom(t, FILTER_LABEL_KEYS, name, name)}: ${chipValue(name, value)}`,
    ),
    ...(searchTerm ? [searchTerm] : []),
  ]

  const clearEveryFilter = () => clearFilters([...NARROWING_PARAMS, PARAM_SEARCH])

  return (
    <section className={sectionCss}>
      <form
        className={controlsCss}
        onSubmit={handleSubmit((fields) => applyParams({ [PARAM_SEARCH]: fields.search.trim() }))}
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
        <div className={checkboxAlignCss}>
          <Checkbox
            name="attention"
            control={control}
            isInline
            label={t("credit-registration-admin-only-needs-attention")}
          />
        </div>
        <div className={checkboxAlignCss}>
          <Checkbox
            name="superseded"
            control={control}
            isInline
            label={t("credit-registration-admin-show-superseded")}
          />
        </div>
      </div>
      {chipFilters.length > 0 && (
        <div className={rowCss}>
          {chipFilters.map(({ name, value }) => (
            <Chip
              key={`${name}:${value}`}
              onRemove={() => applyParams({ [name]: params(name).filter((one) => one !== value) })}
              removeLabel={t("credit-registration-admin-remove-filter", {
                filter: labelFrom(t, FILTER_LABEL_KEYS, name, name),
                value,
              })}
            >
              {`${labelFrom(t, FILTER_LABEL_KEYS, name, name)}: ${chipValue(name, value)}`}
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
              <p className={noteCss}>
                {t("credit-registration-admin-row-count", { count: page.total_count })}
              </p>
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
                    minWidth: "16rem",
                    cell: (row) => (
                      <StudentCell row={row} href={creditRegistrationItemRoute(row.id)} />
                    ),
                  },
                  {
                    header: t("label-student-number"),
                    minWidth: "7rem",
                    nowrap: true,
                    cell: (row) => {
                      const number = row.verified_student_number ?? row.student_number
                      return number === null || number === undefined ? (
                        <span className={noteCss}>{t("credit-registration-admin-not-linked")}</span>
                      ) : (
                        <span className={monospaceCss}>{number}</span>
                      )
                    },
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
                      </span>
                    ),
                  },
                  {
                    header: t("label-state"),
                    minWidth: "14rem",
                    cell: (row) => {
                      const threshold = thresholds
                        ? stuckThresholdSecs(row.state, thresholds)
                        : null
                      const isStuck =
                        threshold !== null && secondsSince(row.state_entered_at) > threshold
                      const errorNote = registrationErrorNote(
                        t,
                        row.state,
                        row.error_code,
                        row.pending_reason,
                      )
                      return (
                        <span className={stackedCellCss}>
                          <span className={rowCss}>
                            <AdminStateBadge
                              state={row.state}
                              pendingReason={row.pending_reason}
                              superseded={row.superseded}
                              attemptNumber={row.attempt_number}
                            />
                            {isStuck && (
                              <Badge tone={TONE.DANGER} size={BADGE_COMPACT}>
                                {t("label-credit-registration-stuck")}
                              </Badge>
                            )}
                          </span>
                          {errorNote && (
                            <span className={noteCss}>
                              {errorNote} <code className={monospaceCss}>{row.error_code}</code>
                            </span>
                          )}
                        </span>
                      )
                    },
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
                            <RelativeTime at={at} absoluteTime={TIME_COMPACT} />
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
              />
            </>
          )
        }
      </QueryResult>
    </section>
  )
}

export default RegistrationsPage
