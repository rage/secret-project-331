"use client"

import { css } from "@emotion/css"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import React, { useCallback, useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { useAdminCreditRegistrations } from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminStateBadge from "@/components/credit-registration/admin/AdminStateBadge"
import RelativeTime from "@/components/credit-registration/admin/RelativeTime"
import type {
  CreditRegistrationErrorCode,
  CreditRegistrationState,
} from "@/generated/api/types.generated"
import Pagination from "@/shared-module/common/components/Pagination"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { creditRegistrationItemRoute } from "@/shared-module/common/utils/routes"
import { Button, Checkbox, QueryResult, Table, TextField } from "@/shared-module/components"

const ROWS_PER_PAGE = 50

// Every filter lives in the query string, so a support person can paste a link to exactly what they
// are looking at, and so the Overview's tiles can deep-link into it.
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

interface FilterFields {
  search: string
  needs_admin_attention: boolean
  include_superseded: boolean
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

const secondaryCss = css`
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
`

const noteCss = css`
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
`

/**
 * The support workhorse: find this student, tell me what happened.
 *
 * Superseded attempts are hidden by default — a course that regrades holds two rows per student, and
 * showing both by default makes every number on the page read twice.
 */
const RegistrationsPage: React.FC = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const paginationInfo = usePaginationInfo(ROWS_PER_PAGE)

  const param = useCallback(
    (name: string): string | undefined => searchParams?.get(name) ?? undefined,
    [searchParams],
  )

  const { control, watch, reset, handleSubmit } = useForm<FilterFields>({
    defaultValues: {
      search: param(PARAM_SEARCH) ?? "",
      needs_admin_attention: param(PARAM_ATTENTION) === TRUE,
      include_superseded: param(PARAM_SUPERSEDED) === TRUE,
    },
  })
  // The two toggles apply the moment they are pressed; the search box waits for submit so the table
  // does not reshuffle on every keystroke.
  const attention = watch("needs_admin_attention")
  const superseded = watch("include_superseded")
  const typedSearch = watch("search")
  // Refetching while the operator is mid-word would reshuffle the table under their cursor.
  const searchPending = typedSearch.trim() !== (param(PARAM_SEARCH) ?? "")

  const applyParams = useCallback(
    (changes: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams?.toString() ?? "")
      for (const [name, value] of Object.entries(changes)) {
        if (value === undefined || value === "") {
          next.delete(name)
        } else {
          next.set(name, value)
        }
      }
      // A narrowed result set has different pages.
      next.delete("page")
      router.replace(`${window.location.pathname}?${next.toString()}`)
    },
    [router, searchParams],
  )

  useEffect(() => {
    const current = param(PARAM_ATTENTION) === TRUE
    if (current !== attention) {
      applyParams({ [PARAM_ATTENTION]: attention ? TRUE : undefined })
    }
  }, [attention, applyParams, param])

  useEffect(() => {
    const current = param(PARAM_SUPERSEDED) === TRUE
    if (current !== superseded) {
      applyParams({ [PARAM_SUPERSEDED]: superseded ? TRUE : undefined })
    }
  }, [superseded, applyParams, param])

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
      ...(state ? { state: [state as CreditRegistrationState] } : {}),
      ...(errorCode ? { error_code: [errorCode as CreditRegistrationErrorCode] } : {}),
      ...(courseId ? { course_id: courseId } : {}),
      ...(courseModuleId ? { course_module_id: courseModuleId } : {}),
      ...(userId ? { user_id: userId } : {}),
      ...(studentNumber ? { student_number: studentNumber } : {}),
      ...(param(PARAM_ATTENTION) === TRUE ? { needs_admin_attention: true } : {}),
      ...(search ? { search } : {}),
      ...(param(PARAM_SUPERSEDED) === TRUE ? { include_superseded: true } : {}),
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
          name="needs_admin_attention"
          control={control}
          label={t("credit-registration-admin-only-needs-attention")}
        />
        <Checkbox
          name="include_superseded"
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
              {name}: {param(name)}
            </button>
          ))}
          <button
            type="button"
            className={chipCss}
            onClick={() => {
              reset({ search: "", needs_admin_attention: false, include_superseded: false })
              router.replace(window.location.pathname)
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
                    cell: (row) => (
                      <Link href={creditRegistrationItemRoute(row.id)}>
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
                        <span className={secondaryCss}>{row.email}</span>
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
                        <span className={secondaryCss}>{row.course_module_name}</span>
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
