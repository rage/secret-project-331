"use client"

import { css } from "@emotion/css"
import React, { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { stateName } from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import {
  useAdminCreditRegistrations,
  useCreditRegistrationCourseStats,
  useCreditRegistrationOverview,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminStateBadge from "@/components/credit-registration/admin/AdminStateBadge"
import {
  ALL_STATES,
  BUCKET_OF_STATE,
  BUCKET_ORDER,
  bucketLabel,
} from "@/components/credit-registration/admin/queueBuckets"
import type { FilterFieldDescriptor } from "@/components/credit-registration/admin/useFilteredAdminQuery"
import {
  selectFilterField,
  useFilteredAdminQuery,
} from "@/components/credit-registration/admin/useFilteredAdminQuery"
import {
  DENSITY_COMPACT,
  ID_PREFIX_LENGTH,
  LINK_QUIET,
  QUIET_REFRESH,
  TIME_COMPACT,
} from "@/components/credit-registration/constants"
import { labelFrom } from "@/components/credit-registration/labelFrom"
import {
  controlCss,
  controlsCss,
  headingCss,
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
import { formatUserName } from "@/hooks/useUserDetails"
import Pagination from "@/shared-module/common/components/Pagination"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { creditRegistrationItemRoute } from "@/shared-module/common/utils/routes"
import {
  Button,
  Checkbox,
  Link,
  QueryResult,
  RelativeTime,
  Select,
  Table,
  TextField,
} from "@/shared-module/components"

const ROWS_PER_PAGE = 50

// Every filter lives in the query string, so links are shareable and the Overview can deep-link in.
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_STATE = "state"
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_ERROR_CODE = "error_code"
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_COURSE_ID = "course_id"
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_COURSE_MODULE_ID = "course_module_id"
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_USER_ID = "user_id"
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_STUDENT_NUMBER = "student_number"
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_ATTENTION = "needs_admin_attention"
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_SEARCH = "search"
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_SUPERSEDED = "include_superseded"
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_SORT = "sort"
// oxlint-disable-next-line i18next/no-literal-string
const TRUE = "true"
// oxlint-disable-next-line i18next/no-literal-string
const NONE = ""

// oxlint-disable-next-line i18next/no-literal-string
const SORT_LAST_ACTIVITY = "last_activity"
// oxlint-disable-next-line i18next/no-literal-string
const SORT_CREATED = "created"
// oxlint-disable-next-line i18next/no-literal-string
const SORT_TIME_IN_STATE = "time_in_state"
// oxlint-disable-next-line i18next/no-literal-string
const SORT_ATTEMPTS = "attempts"

const NARROWING_PARAMS = [
  PARAM_STATE,
  PARAM_ERROR_CODE,
  PARAM_COURSE_ID,
  PARAM_COURSE_MODULE_ID,
  PARAM_USER_ID,
  PARAM_STUDENT_NUMBER,
]

/** Chip labels for `NARROWING_PARAMS`; the value itself stays untranslated, matching AdminStateBadge. */
const FILTER_LABEL_KEYS: Record<string, string> = {
  [PARAM_STATE]: "label-state",
  [PARAM_ERROR_CODE]: "label-error-code",
  [PARAM_COURSE_ID]: "label-course",
  [PARAM_COURSE_MODULE_ID]: "label-course-module-id",
  [PARAM_USER_ID]: "label-user-id",
  [PARAM_STUDENT_NUMBER]: "label-student-number",
}

/** A uuid filter reads as noise in full; the prefix is enough to tell two of them apart. */
const ID_PARAMS = new Set([PARAM_COURSE_ID, PARAM_COURSE_MODULE_ID, PARAM_USER_ID])

/** What a filter chip shows for its value: shortened for ids, named for states, raw otherwise. */
const chipValue = (name: string, value: string): string => {
  if (ID_PARAMS.has(name)) {
    return value.slice(0, ID_PREFIX_LENGTH)
  }
  return name === PARAM_STATE ? stateName(value as CreditRegistrationState) : value
}

interface FilterFields {
  search: string
  sort: string
  course_id: string
  attention: boolean
  superseded: boolean
  /** The two multi-value filters: picking a value appends it and the control returns to empty. */
  addState: string
  addErrorCode: string
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
        addState: NONE,
        addErrorCode: NONE,
      }),
    },
  )

  const typedSearch = watch("search")
  // Refetching mid-word would reshuffle the table under the operator's cursor.
  const searchPending = typedSearch.trim() !== (param(PARAM_SEARCH) ?? "")

  const registrationsQuery = useAdminCreditRegistrations(query, { paused: searchPending })
  const activeNarrowings = NARROWING_PARAMS.flatMap((name) =>
    params(name).map((value) => ({ name, value })),
  )

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

  // The live ledger's codes, so the filter never offers one no row could match.
  const overviewQuery = useCreditRegistrationOverview()
  const errorCodeOptions = (overviewQuery.data?.error_codes ?? []).map((row) => ({
    value: row.error_code,
    label: row.error_code,
  }))

  const stateOptions = BUCKET_ORDER.map((bucket) => ({
    label: bucketLabel(t, bucket),
    options: ALL_STATES.filter((state) => BUCKET_OF_STATE[state] === bucket).map((state) => ({
      value: state,
      label: stateName(state),
    })),
  }))

  const addState = watch("addState")
  const addErrorCode = watch("addErrorCode")
  const chosenStates = params(PARAM_STATE)
  const chosenErrorCodes = params(PARAM_ERROR_CODE)

  // The two "add" controls hand their pick to the URL and empty themselves again, so the chip row
  // stays the single account of what is filtered.
  useEffect(() => {
    if (addState !== NONE) {
      applyParams({ [PARAM_STATE]: [...new Set([...chosenStates, addState])] })
      setValue("addState", NONE)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [addState])

  useEffect(() => {
    if (addErrorCode !== NONE) {
      applyParams({ [PARAM_ERROR_CODE]: [...new Set([...chosenErrorCodes, addErrorCode])] })
      setValue("addErrorCode", NONE)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [addErrorCode])

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-registrations")}</h2>
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
          />
        </div>
        <Button variant="secondary" size="medium" type="submit">
          {t("button-text-search")}
        </Button>
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
          <Select
            name="addState"
            control={control}
            label={t("label-state")}
            options={[
              { value: NONE, label: t("credit-registration-admin-add-a-state") },
              ...stateOptions,
            ]}
          />
        </div>
        <div className={controlCss}>
          <Select
            name="addErrorCode"
            control={control}
            label={t("label-error-code")}
            options={[
              { value: NONE, label: t("credit-registration-admin-add-an-error-code") },
              ...errorCodeOptions,
            ]}
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
        <Checkbox
          name="attention"
          control={control}
          isInline
          label={t("credit-registration-admin-only-needs-attention")}
        />
        <Checkbox
          name="superseded"
          control={control}
          isInline
          label={t("credit-registration-admin-show-superseded")}
        />
      </div>
      {activeNarrowings.length > 0 && (
        <div className={rowCss}>
          {activeNarrowings.map(({ name, value }) => (
            <Button
              key={`${name}:${value}`}
              variant="tertiary"
              size="small"
              domProps={{ title: value }}
              aria-label={t("credit-registration-admin-remove-filter", {
                filter: labelFrom(t, FILTER_LABEL_KEYS, name, name),
                value,
              })}
              onClick={() => applyParams({ [name]: params(name).filter((one) => one !== value) })}
            >
              {`${labelFrom(t, FILTER_LABEL_KEYS, name, name)}: ${chipValue(name, value)}`}
            </Button>
          ))}
          <Button
            variant="tertiary"
            size="small"
            onClick={() => clearFilters([...NARROWING_PARAMS, PARAM_SEARCH])}
          >
            {t("button-text-clear-filters")}
          </Button>
        </div>
      )}
      <QueryResult query={registrationsQuery} refreshIndicator={QUIET_REFRESH}>
        {(page) => (
          <>
            <p className={noteCss}>
              {t("credit-registration-admin-row-count", { count: page.total_count })}
            </p>
            <Table
              caption={t("credit-registration-heading-registrations")}
              density={DENSITY_COMPACT}
              rowKey={(row) => row.id}
              rows={page.data}
              emptyState={t("credit-registration-admin-no-matching-rows")}
              columns={[
                {
                  header: t("label-student"),
                  grow: true,
                  minWidth: "12rem",
                  cell: (row) => (
                    <span className={stackedCellCss}>
                      {/* Not prefetched: up to 50 of these render at once and few get clicked. */}
                      <Link
                        href={creditRegistrationItemRoute(row.id)}
                        appearance={LINK_QUIET}
                        prefetch={false}
                      >
                        {formatUserName(row)}
                      </Link>
                      <span className={noteCss}>{row.email}</span>
                    </span>
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
                  minWidth: "11rem",
                  cell: (row) => (
                    <span className={stackedCellCss}>
                      <span>{row.course_name}</span>
                      <span className={noteCss}>{row.course_module_name}</span>
                    </span>
                  ),
                },
                {
                  header: t("label-state"),
                  minWidth: "13rem",
                  cell: (row) => (
                    <span className={stackedCellCss}>
                      <AdminStateBadge
                        state={row.state}
                        pendingReason={row.pending_reason}
                        superseded={row.superseded}
                        attemptNumber={row.attempt_number}
                      />
                      {row.error_code && <code>{row.error_code}</code>}
                    </span>
                  ),
                },
                {
                  header: t("label-credit-registration-last-activity"),
                  minWidth: "8rem",
                  nowrap: true,
                  cell: (row) => (
                    <RelativeTime at={row.last_attempt_at} absoluteTime={TIME_COMPACT} />
                  ),
                },
              ]}
            />
            <Pagination paginationInfo={paginationInfo} totalPages={page.total_pages} />
          </>
        )}
      </QueryResult>
    </section>
  )
}

export default RegistrationsPage
