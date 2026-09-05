"use client"

import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  actorRoleLabel,
  ADMIN_ACTION_KEYS,
  ADMIN_TARGET_KEYS,
  adminActionLabel,
  adminActionTargetLabel,
  COURSE_TEACHER_ROLE,
  GLOBAL_ADMIN_ROLE,
} from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import {
  useCreditRegistrationAdminActions,
  useCreditRegistrationCourseStats,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminStateBadge from "@/components/credit-registration/admin/AdminStateBadge"
import type { FilterFieldDescriptor } from "@/components/credit-registration/admin/useFilteredAdminQuery"
import {
  selectFilterField,
  useFilteredAdminQuery,
} from "@/components/credit-registration/admin/useFilteredAdminQuery"
import {
  MIDDLE_DOT,
  QUIET_REFRESH,
  TIME_IN_TITLE,
  TONE,
} from "@/components/credit-registration/constants"
import {
  controlCss,
  controlsCss,
  headingCss,
  noteCss,
  rowCss,
  sectionCss,
  sectionsCss,
  stackedCellCss,
} from "@/components/credit-registration/styles"
import type {
  CreditRegistrationAdminAction,
  CreditRegistrationAdminActionRow,
  CreditRegistrationAdminActionTarget,
} from "@/generated/api/types.generated"
import Pagination from "@/shared-module/common/components/Pagination"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { creditRegistrationItemRoute } from "@/shared-module/common/utils/routes"
import {
  Badge,
  Button,
  DateField,
  QueryResult,
  RelativeTime,
  RELATIVE_TIME_ABSENT_LABEL,
  Select,
  Table,
} from "@/shared-module/components"

const ROWS_PER_PAGE = 50
const ID_PREFIX_LENGTH = 8
// oxlint-disable-next-line i18next/no-literal-string
const ARROW = " → "

// oxlint-disable-next-line i18next/no-literal-string
const PARAM_ACTOR_ROLE = "actor_role"
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_ACTION = "action"
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_TARGET_KIND = "target_kind"
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_COURSE_ID = "course_id"
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_FROM = "from"
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_TO = "to"
// oxlint-disable-next-line i18next/no-literal-string
const ANY = ""
// oxlint-disable-next-line i18next/no-literal-string
const OVERRIDE_RATE_CAP: CreditRegistrationAdminAction = "override_rate_cap"
// oxlint-disable-next-line i18next/no-literal-string
const REGISTRATION_TARGET: CreditRegistrationAdminActionTarget = "credit_registration"

const CLEARABLE_PARAMS = [
  PARAM_ACTOR_ROLE,
  PARAM_ACTION,
  PARAM_TARGET_KIND,
  PARAM_COURSE_ID,
  PARAM_FROM,
  PARAM_TO,
]

// Derived from the copy table so a new action can't appear in results without a filter option.
const ACTIONS = Object.keys(ADMIN_ACTION_KEYS) as CreditRegistrationAdminAction[]
const TARGET_KINDS = Object.keys(ADMIN_TARGET_KEYS) as CreditRegistrationAdminActionTarget[]

const isAdminAction = (value: string | undefined): value is CreditRegistrationAdminAction =>
  value !== undefined && (ACTIONS as string[]).includes(value)

const isAdminActionTarget = (
  value: string | undefined,
): value is CreditRegistrationAdminActionTarget =>
  value !== undefined && (TARGET_KINDS as string[]).includes(value)

interface FilterFields {
  actor_role: string
  action: string
  target_kind: string
  course_id: string
  from: string
  to: string
}

/**
 * The chosen day is the operator's own day, so the window has to run from their midnight to their
 * next midnight. A `Z` suffix would silently shift "today" by the offset from UTC.
 */
const dayStart = (day: string): string | undefined =>
  day === "" ? undefined : new Date(`${day}T00:00:00`).toISOString()

const dayEnd = (day: string): string | undefined => {
  if (day === "") {
    return undefined
  }
  const nextMidnight = new Date(`${day}T00:00:00`)
  nextMidnight.setDate(nextMidnight.getDate() + 1)
  return new Date(nextMidnight.getTime() - 1).toISOString()
}

/** The inverse of the two above, so a pasted link's window reaches the date inputs it came from. */
const dayOf = (instant: string | undefined): string => {
  if (instant === undefined) {
    return ""
  }
  const local = new Date(instant)
  if (Number.isNaN(local.getTime())) {
    return ""
  }
  const month = String(local.getMonth() + 1).padStart(2, "0")
  const day = String(local.getDate()).padStart(2, "0")
  return `${local.getFullYear()}-${month}-${day}`
}

const FILTER_FIELDS: FilterFieldDescriptor<FilterFields>[] = [
  selectFilterField(PARAM_ACTOR_ROLE, "actor_role"),
  selectFilterField(PARAM_ACTION, "action"),
  selectFilterField(PARAM_TARGET_KIND, "target_kind"),
  selectFilterField(PARAM_COURSE_ID, "course_id"),
  {
    param: PARAM_FROM,
    field: "from",
    fromParam: (raw) => dayOf(raw),
    toParam: (value) => dayStart(value as string),
  },
  {
    param: PARAM_TO,
    field: "to",
    fromParam: (raw) => dayOf(raw),
    toParam: (value) => dayEnd(value as string),
  },
]

const ActorCell: React.FC<{ row: CreditRegistrationAdminActionRow }> = ({ row }) => {
  const { t } = useTranslation()
  return (
    <span className={stackedCellCss}>
      <span>
        {[row.actor_first_name, row.actor_last_name].filter(Boolean).join(" ")}
        {MIDDLE_DOT}
        {actorRoleLabel(t, row.actor_role)}
      </span>
      <span className={noteCss}>{row.actor_email}</span>
    </span>
  )
}

const TargetCell: React.FC<{ row: CreditRegistrationAdminActionRow }> = ({ row }) => {
  const { t } = useTranslation()
  const kind = adminActionTargetLabel(t, row.target_kind)
  if (row.target_kind === REGISTRATION_TARGET && row.target_id) {
    // Every registration link would otherwise read "Credit registration", which a screen reader's
    // link list turns into one indistinguishable row per action.
    return (
      <Link href={creditRegistrationItemRoute(row.target_id)} prefetch={false}>
        {[kind, row.course_name ?? row.target_id.slice(0, ID_PREFIX_LENGTH)].join(MIDDLE_DOT)}
      </Link>
    )
  }
  return (
    <span>
      {kind}
      {row.target_phase && (
        <>
          {MIDDLE_DOT}
          <code>{row.target_phase}</code>
        </>
      )}
    </span>
  )
}

/**
 * Every hand action on the pipeline, admins and course teachers alike. The actor-kind filter is the
 * point of the tab: without it a teacher's retry on their own course reads as an admin's.
 */
const AuditPage: React.FC = () => {
  const { t } = useTranslation()
  const courseStatsQuery = useCreditRegistrationCourseStats()
  // The stats are one row per module, and a course can have several Suotar-enabled modules: dedupe
  // by course_id or the Select gets two options with the same value and refuses to render at all.
  const courseOptions = React.useMemo(() => {
    const byCourseId = new Map<string, string>()
    for (const courseModule of courseStatsQuery.data?.modules ?? []) {
      byCourseId.set(courseModule.course_id, courseModule.course_name)
    }
    return Array.from(byCourseId, ([value, label]) => ({ value, label }))
  }, [courseStatsQuery.data?.modules])

  const { control, param, reset, applyParams, paginationInfo, query } = useFilteredAdminQuery(
    FILTER_FIELDS,
    (filters, pagination) => {
      const actorRole = filters.param(PARAM_ACTOR_ROLE)
      const action = filters.param(PARAM_ACTION)
      const targetKind = filters.param(PARAM_TARGET_KIND)
      const courseId = filters.param(PARAM_COURSE_ID)
      const from = filters.param(PARAM_FROM)
      const to = filters.param(PARAM_TO)
      // Validated against the derived option list rather than cast blind, so a stale/tampered URL
      // param can't reach the API as a value the Select never offered.
      const validAction = isAdminAction(action) ? action : undefined
      const validTargetKind = isAdminActionTarget(targetKind) ? targetKind : undefined
      return {
        page: pagination.page,
        limit: pagination.limit,
        ...includeIf(actorRole, { actor_role: actorRole }),
        ...includeIf(validAction, { action: [validAction as CreditRegistrationAdminAction] }),
        ...includeIf(validTargetKind, { target_kind: validTargetKind }),
        ...includeIf(courseId, { course_id: courseId }),
        ...includeIf(from, { from }),
        ...includeIf(to, { to }),
      }
    },
    { rowsPerPage: ROWS_PER_PAGE },
  )

  const actionsQuery = useCreditRegistrationAdminActions(query)
  const activeFilterCount = CLEARABLE_PARAMS.filter((name) => param(name) !== undefined).length

  return (
    <div className={sectionsCss}>
      <section className={sectionCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-audit")}</h2>
        <p className={noteCss}>{t("credit-registration-admin-audit-two-actor-kinds-note")}</p>
        <form className={controlsCss}>
          <div className={controlCss}>
            <Select
              name="actor_role"
              control={control}
              label={t("credit-registration-admin-actor-kind")}
              options={[
                { value: ANY, label: t("credit-registration-admin-any-actor-kind") },
                {
                  value: GLOBAL_ADMIN_ROLE,
                  label: t("credit-registration-admin-actor-global-admin"),
                },
                {
                  value: COURSE_TEACHER_ROLE,
                  label: t("credit-registration-admin-actor-course-teacher"),
                },
              ]}
            />
          </div>
          <div className={controlCss}>
            <Select
              name="action"
              control={control}
              label={t("credit-registration-admin-column-action")}
              options={[
                { value: ANY, label: t("credit-registration-admin-any-action") },
                ...ACTIONS.map((action) => ({
                  value: action,
                  label: adminActionLabel(t, action),
                })),
              ]}
            />
          </div>
          <div className={controlCss}>
            <Select
              name="target_kind"
              control={control}
              label={t("credit-registration-admin-column-target")}
              options={[
                { value: ANY, label: t("credit-registration-admin-any-target") },
                ...TARGET_KINDS.map((kind) => ({
                  value: kind,
                  label: adminActionTargetLabel(t, kind),
                })),
              ]}
            />
          </div>
          <div className={controlCss}>
            <Select
              name="course_id"
              control={control}
              label={t("label-course")}
              options={[
                { value: ANY, label: t("credit-registration-admin-any-course") },
                ...courseOptions,
              ]}
            />
          </div>
          <div className={controlCss}>
            <DateField name="from" control={control} label={t("credit-registration-admin-from")} />
          </div>
          <div className={controlCss}>
            <DateField name="to" control={control} label={t("credit-registration-admin-to")} />
          </div>
        </form>
        {activeFilterCount > 0 && (
          <div className={rowCss}>
            <span className={noteCss}>
              {t("credit-registration-admin-active-filters", { count: activeFilterCount })}
            </span>
            <Button
              variant="tertiary"
              size="small"
              onClick={() => {
                reset({
                  actor_role: ANY,
                  action: ANY,
                  target_kind: ANY,
                  course_id: ANY,
                  from: "",
                  to: "",
                })
                applyParams(Object.fromEntries(CLEARABLE_PARAMS.map((name) => [name, undefined])))
              }}
            >
              {t("button-text-clear-filters")}
            </Button>
          </div>
        )}
        <QueryResult query={actionsQuery} refreshIndicator={QUIET_REFRESH}>
          {(page) =>
            page.data.length === 0 ? (
              <p className={noteCss}>{t("credit-registration-admin-no-matching-actions")}</p>
            ) : (
              <>
                <p className={noteCss}>
                  {t("credit-registration-admin-action-count", { count: page.total_count })}
                </p>
                <Table
                  caption={t("credit-registration-heading-audit")}
                  rowKey={(row) => row.id}
                  rows={page.data}
                  columns={[
                    {
                      header: t("label-time"),
                      cell: (row) => (
                        <RelativeTime at={row.created_at} absoluteTime={TIME_IN_TITLE} />
                      ),
                    },
                    { header: t("label-actor"), cell: (row) => <ActorCell row={row} /> },
                    {
                      header: t("credit-registration-admin-column-action"),
                      cell: (row) => (
                        <span className={stackedCellCss}>
                          <span>{adminActionLabel(t, row.action)}</span>
                          {/* Teachers cannot override a rate cap, so such a row is a hole, not a record. */}
                          {row.action === OVERRIDE_RATE_CAP &&
                            row.actor_role === COURSE_TEACHER_ROLE && (
                              <Badge tone={TONE.DANGER}>
                                {t("credit-registration-admin-impossible-action")}
                              </Badge>
                            )}
                        </span>
                      ),
                    },
                    {
                      header: t("credit-registration-admin-column-target"),
                      cell: (row) => <TargetCell row={row} />,
                    },
                    {
                      header: t("credit-registration-admin-column-state-change"),
                      cell: (row) =>
                        row.before_state === null && row.after_state === null ? (
                          RELATIVE_TIME_ABSENT_LABEL
                        ) : (
                          <span className={rowCss}>
                            {row.before_state && <AdminStateBadge state={row.before_state} />}
                            {row.before_state && row.after_state && ARROW}
                            {row.after_state && <AdminStateBadge state={row.after_state} />}
                          </span>
                        ),
                    },
                    {
                      header: t("label-reason"),
                      cell: (row) => row.reason ?? RELATIVE_TIME_ABSENT_LABEL,
                    },
                  ]}
                />
                <Pagination paginationInfo={paginationInfo} totalPages={page.total_pages} />
              </>
            )
          }
        </QueryResult>
      </section>
    </div>
  )
}

export default AuditPage
