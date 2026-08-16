"use client"

import { css } from "@emotion/css"
import Link from "next/link"
import React, { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { useAdminCreditRegistrations } from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminStateBadge from "@/components/credit-registration/admin/AdminStateBadge"
import RelativeTime from "@/components/credit-registration/admin/RelativeTime"
import { useQueryParamFilters } from "@/components/credit-registration/admin/useQueryParamFilters"
import { labelFrom } from "@/components/credit-registration/labelFrom"
import { noteCss } from "@/components/credit-registration/styles"
import type {
  CreditRegistrationErrorCode,
  CreditRegistrationState,
} from "@/generated/api/types.generated"
import Pagination from "@/shared-module/common/components/Pagination"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { creditRegistrationItemRoute } from "@/shared-module/common/utils/routes"
import { Button, Checkbox, QueryResult, Table, TextField } from "@/shared-module/components"

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
const TRUE = "true"

const NARROWING_PARAMS = [
  PARAM_STATE,
  PARAM_ERROR_CODE,
  PARAM_COURSE_ID,
  PARAM_COURSE_MODULE_ID,
  PARAM_USER_ID,
  PARAM_STUDENT_NUMBER,
]

const CLEARABLE_PARAMS = [...NARROWING_PARAMS, PARAM_SEARCH, PARAM_ATTENTION, PARAM_SUPERSEDED]

/** Chip labels for `NARROWING_PARAMS`; the value itself stays untranslated, matching AdminStateBadge. */
const FILTER_LABEL_KEYS: Record<string, string> = {
  [PARAM_STATE]: "label-state",
  [PARAM_ERROR_CODE]: "label-error-code",
  [PARAM_COURSE_ID]: "label-course",
  [PARAM_COURSE_MODULE_ID]: "label-course-module-id",
  [PARAM_USER_ID]: "label-user-id",
  [PARAM_STUDENT_NUMBER]: "label-student-number",
}

interface FilterFields {
  search: string
  attention: boolean
  superseded: boolean
}

const controlsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: end;
  margin-bottom: 1rem;
`

const searchCss = css`
  min-width: 20rem;
  flex: 1 1 20rem;
`

const chipsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
`

const chipCss = css`
  border: 1px solid var(--color-gray-200);
  border-radius: 999px;
  background: var(--color-gray-50);
  color: var(--color-gray-700);
  font-size: var(--font-size-1);
  padding: 0.15rem 0.6rem;
  cursor: pointer;
`

const stackedCellCss = css`
  display: grid;
`

/** Superseded attempts are hidden by default: a regraded course holds two rows per student. */
const RegistrationsPage: React.FC = () => {
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo(ROWS_PER_PAGE)

  const { param, applyParams } = useQueryParamFilters()

  const attention = param(PARAM_ATTENTION) === TRUE
  const superseded = param(PARAM_SUPERSEDED) === TRUE
  const { control, watch, reset, setValue, handleSubmit } = useForm<FilterFields>({
    defaultValues: {
      search: param(PARAM_SEARCH) ?? "",
      attention,
      superseded,
    },
  })
  const typedSearch = watch("search")
  // Refetching mid-word would reshuffle the table under the operator's cursor.
  const searchPending = typedSearch.trim() !== (param(PARAM_SEARCH) ?? "")
  const watchedAttention = watch("attention")
  const watchedSuperseded = watch("superseded")

  // The params are the source of truth for what is filtered, so the boxes follow the URL: Back, or
  // a shared link, has to move them.
  useEffect(() => {
    setValue("attention", attention)
    setValue("superseded", superseded)
  }, [attention, superseded, setValue])

  // And a checked box pushes back into the URL. Comparing against the URL-derived value (rather
  // than reacting unconditionally) is what stops this from bouncing right back against the sync
  // effect above: once the two agree, this has nothing left to apply.
  useEffect(() => {
    if (watchedAttention !== attention) {
      applyParams({ [PARAM_ATTENTION]: watchedAttention ? TRUE : undefined })
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedAttention])
  useEffect(() => {
    if (watchedSuperseded !== superseded) {
      applyParams({ [PARAM_SUPERSEDED]: watchedSuperseded ? TRUE : undefined })
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedSuperseded])

  const query = useMemo(() => {
    const state = param(PARAM_STATE)
    const errorCode = param(PARAM_ERROR_CODE)
    const courseId = param(PARAM_COURSE_ID)
    const courseModuleId = param(PARAM_COURSE_MODULE_ID)
    const userId = param(PARAM_USER_ID)
    const studentNumber = param(PARAM_STUDENT_NUMBER)
    const search = param(PARAM_SEARCH)
    return {
      page: paginationInfo.page,
      limit: paginationInfo.limit,
      ...includeIf(state, { state: [state as CreditRegistrationState] }),
      ...includeIf(errorCode, { error_code: [errorCode as CreditRegistrationErrorCode] }),
      ...includeIf(courseId, { course_id: courseId }),
      ...includeIf(courseModuleId, { course_module_id: courseModuleId }),
      ...includeIf(userId, { user_id: userId }),
      ...includeIf(studentNumber, { student_number: studentNumber }),
      ...includeIf(param(PARAM_ATTENTION) === TRUE, { needs_admin_attention: true }),
      ...includeIf(search, { search }),
      ...includeIf(param(PARAM_SUPERSEDED) === TRUE, { include_superseded: true }),
    }
  }, [param, paginationInfo.page, paginationInfo.limit])

  const registrationsQuery = useAdminCreditRegistrations(query, { paused: searchPending })
  const activeNarrowings = NARROWING_PARAMS.filter((name) => param(name) !== undefined)

  return (
    <div>
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
      </form>
      {activeNarrowings.length > 0 && (
        <div className={chipsCss}>
          {activeNarrowings.map((name) => (
            <button
              key={name}
              type="button"
              className={chipCss}
              onClick={() => applyParams({ [name]: undefined })}
            >
              {labelFrom(t, FILTER_LABEL_KEYS, name, name)}: {param(name)}
            </button>
          ))}
          <button
            type="button"
            className={chipCss}
            onClick={() => {
              reset({ search: "", attention: false, superseded: false })
              applyParams(Object.fromEntries(CLEARABLE_PARAMS.map((name) => [name, undefined])))
            }}
          >
            {t("button-text-clear-filters")}
          </button>
        </div>
      )}
      <QueryResult query={registrationsQuery}>
        {(page) =>
          page.data.length === 0 ? (
            <p className={noteCss}>{t("credit-registration-admin-no-matching-rows")}</p>
          ) : (
            <>
              <Table
                caption={t("credit-registration-heading-registrations")}
                rowKey={(row) => row.id}
                rows={page.data}
                columns={[
                  {
                    header: t("label-state"),
                    // Up to 50 of these render at once, and few get clicked.
                    cell: (row) => (
                      <Link href={creditRegistrationItemRoute(row.id)} prefetch={false}>
                        <AdminStateBadge
                          state={row.state}
                          superseded={row.superseded}
                          attemptNumber={row.attempt_number}
                        />
                      </Link>
                    ),
                  },
                  {
                    header: t("label-student"),
                    cell: (row) => (
                      <span className={stackedCellCss}>
                        <span>
                          {row.first_name} {row.last_name}
                        </span>
                        <span className={noteCss}>{row.email}</span>
                      </span>
                    ),
                  },
                  {
                    header: t("label-student-number"),
                    cell: (row) =>
                      row.verified_student_number ??
                      row.student_number ??
                      t("credit-registration-admin-not-linked"),
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
                    header: t("label-error-code"),
                    cell: (row) => (row.error_code ? <code>{row.error_code}</code> : null),
                  },
                  {
                    header: t("label-credit-registration-attempts"),
                    cell: (row) => row.submit_retry_count + row.verify_attempt_count,
                  },
                  {
                    header: t("label-credit-registration-time-in-state"),
                    cell: (row) => <RelativeTime at={row.state_entered_at} />,
                  },
                  {
                    header: t("label-credit-registration-last-activity"),
                    cell: (row) => <RelativeTime at={row.last_attempt_at} />,
                  },
                ]}
              />
              <p className={noteCss}>
                {t("credit-registration-admin-row-count", { count: page.total_count })}
              </p>
              <Pagination paginationInfo={paginationInfo} totalPages={page.total_pages} />
            </>
          )
        }
      </QueryResult>
    </div>
  )
}

export default RegistrationsPage
