"use client"

import { css } from "@emotion/css"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import { stateName } from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import { useAdminCreditRegistrations } from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminStateBadge from "@/components/credit-registration/admin/AdminStateBadge"
import type { FilterFieldDescriptor } from "@/components/credit-registration/admin/useFilteredAdminQuery"
import { useFilteredAdminQuery } from "@/components/credit-registration/admin/useFilteredAdminQuery"
import {
  ID_PREFIX_LENGTH,
  QUIET_REFRESH,
  TIME_IN_TITLE,
} from "@/components/credit-registration/constants"
import { labelFrom } from "@/components/credit-registration/labelFrom"
import {
  controlCss,
  controlsCss,
  emptyStateCss,
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
  attention: boolean
  superseded: boolean
}

const FILTER_FIELDS: FilterFieldDescriptor<FilterFields>[] = [
  {
    param: PARAM_SORT,
    field: "sort",
    fromParam: (raw) => raw ?? SORT_LAST_ACTIVITY,
    // The default order stays out of the URL, so a pasted link carries only what was chosen.
    toParam: (value) => (value === SORT_LAST_ACTIVITY ? undefined : (value as string)),
  },
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
      manualDefaults: (filters) => ({ search: filters.param(PARAM_SEARCH) ?? "" }),
    },
  )

  const typedSearch = watch("search")
  // Refetching mid-word would reshuffle the table under the operator's cursor.
  const searchPending = typedSearch.trim() !== (param(PARAM_SEARCH) ?? "")

  const registrationsQuery = useAdminCreditRegistrations(query, { paused: searchPending })
  const activeNarrowings = NARROWING_PARAMS.flatMap((name) =>
    params(name).map((value) => ({ name, value })),
  )

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
          label={t("credit-registration-admin-only-needs-attention")}
        />
        <Checkbox
          name="superseded"
          control={control}
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
        {(page) =>
          page.data.length === 0 ? (
            <p className={emptyStateCss}>{t("credit-registration-admin-no-matching-rows")}</p>
          ) : (
            <>
              <p className={noteCss}>
                {t("credit-registration-admin-row-count", { count: page.total_count })}
              </p>
              <Table
                caption={t("credit-registration-heading-registrations")}
                rowKey={(row) => row.id}
                rows={page.data}
                columns={[
                  {
                    header: t("label-student"),
                    // Up to 50 of these render at once, and few get clicked.
                    cell: (row) => (
                      <span className={stackedCellCss}>
                        <Link href={creditRegistrationItemRoute(row.id)} prefetch={false}>
                          {formatUserName(row)}
                        </Link>
                        <span className={noteCss}>{row.email}</span>
                      </span>
                    ),
                  },
                  {
                    header: t("label-student-number"),
                    cell: (row) => {
                      const number = row.verified_student_number ?? row.student_number
                      return number === null || number === undefined ? (
                        t("credit-registration-admin-not-linked")
                      ) : (
                        <span className={monospaceCss}>{number}</span>
                      )
                    },
                  },
                  {
                    header: t("label-course"),
                    cell: (row) => (
                      <span className={stackedCellCss}>
                        <span>{row.course_name}</span>
                        <span className={noteCss}>{row.course_module_name}</span>
                      </span>
                    ),
                  },
                  {
                    header: t("label-state"),
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
                    cell: (row) => (
                      <RelativeTime at={row.last_attempt_at} absoluteTime={TIME_IN_TITLE} />
                    ),
                  },
                ]}
              />
              <Pagination paginationInfo={paginationInfo} totalPages={page.total_pages} />
            </>
          )
        }
      </QueryResult>
    </section>
  )
}

export default RegistrationsPage
