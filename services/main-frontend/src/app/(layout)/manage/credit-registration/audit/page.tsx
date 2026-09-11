"use client"

import { css, cx } from "@emotion/css"
import React, { useMemo } from "react"
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
import AdminStateLabel from "@/components/credit-registration/admin/AdminStateLabel"
import type { FilterFieldDescriptor } from "@/components/credit-registration/admin/useFilteredAdminQuery"
import {
  selectFilterField,
  useFilteredAdminQuery,
} from "@/components/credit-registration/admin/useFilteredAdminQuery"
import {
  ABSENT,
  ARROW,
  BADGE_COMPACT,
  BUTTON_TERTIARY,
  CREDIT_REGISTRATION_NS,
  DENSITY_COMPACT,
  ID_PREFIX_LENGTH,
  LINK_QUIET,
  MIDDLE_DOT,
  QUIET_REFRESH,
  TABLE_STACK,
  TIME_COMPACT,
  TONE,
} from "@/components/credit-registration/constants"
import { actionSentence } from "@/components/credit-registration/creditRegistrationRetry"
import {
  controlCss,
  controlsCss,
  headingCss,
  noteCss,
  proseCss,
  rowCss,
  sectionCardCss,
  sectionCardHeaderCss,
  sectionCss,
  stackedCellCss,
  stateChangeFromCss,
} from "@/components/credit-registration/styles"
import type {
  CreditRegistrationAdminAction,
  CreditRegistrationAdminActionRow,
  CreditRegistrationAdminActionTarget,
} from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import Pagination from "@/shared-module/common/components/Pagination"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { creditRegistrationItemRoute } from "@/shared-module/common/utils/routes"
import { formatDateForDateInputs } from "@/shared-module/common/utils/time"
import {
  Badge,
  Button,
  Chip,
  DateField,
  EmptyState,
  Infobox,
  Link,
  QueryResult,
  RelativeTime,
  Select,
  Table,
  TextField,
} from "@/shared-module/components"

const ROWS_PER_PAGE = 50

const PARAM_ACTOR_ROLE = "actor_role"
const PARAM_ACTOR_USER_ID = "actor_user_id"
const PARAM_ACTION = "action"
const PARAM_TARGET_KIND = "target_kind"
const PARAM_TARGET_ID = "target_id"
const PARAM_COURSE_ID = "course_id"
const PARAM_FROM = "from"
const PARAM_TO = "to"
const ANY = ""
const OVERRIDE_RATE_CAP: CreditRegistrationAdminAction = "override_rate_cap"
const REGISTRATION_TARGET: CreditRegistrationAdminActionTarget = "credit_registration"
const TARGET_ID_FIELD = "target_id"

// Derived from the copy table so a new action can't appear in results without a filter option.
const ACTIONS = Object.keys(ADMIN_ACTION_KEYS) as CreditRegistrationAdminAction[]
const TARGET_KINDS = Object.keys(ADMIN_TARGET_KEYS) as CreditRegistrationAdminActionTarget[]

const isAdminAction = (value: string | undefined): value is CreditRegistrationAdminAction =>
  value !== undefined && (ACTIONS as string[]).includes(value)

const isAdminActionTarget = (
  value: string | undefined,
): value is CreditRegistrationAdminActionTarget =>
  value !== undefined && (TARGET_KINDS as string[]).includes(value)

/** A teacher cannot override a rate cap, so such a row records something that should not exist. */
const isBeyondActorsRole = (row: CreditRegistrationAdminActionRow): boolean =>
  row.action === OVERRIDE_RATE_CAP && row.actor_role === COURSE_TEACHER_ROLE

/** Who and what on one line, then which row and when on the next. */
const filterRowsCss = css`
  display: grid;
  gap: var(--space-4);
`

/** Lets the Selects share one row instead of stranding the last of them on a line of its own. */
const auditControlCss = cx(
  controlCss,
  css`
    flex: 1 1 12rem;
  `,
)

/** From and To read as one control, so they sit on one line and are announced as one group. */
const dateRangeCss = css`
  display: flex;
  flex: 1 1 20rem;
  gap: var(--space-3);
  align-items: end;

  > * {
    flex: 1 1 9rem;
  }
`

/** The "On" column's subtitle: a course or module name, which can outrun the column's width. */
const targetSubtitleCss = css`
  overflow-wrap: anywhere;
`

interface FilterFields {
  actor_role: string
  actor_user_id: string
  action: string
  target_kind: string
  target_id: string
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
  return formatDateForDateInputs(local) ?? ""
}

const FILTER_FIELDS: FilterFieldDescriptor<FilterFields>[] = [
  selectFilterField(PARAM_ACTOR_ROLE, "actor_role"),
  selectFilterField(PARAM_ACTOR_USER_ID, "actor_user_id"),
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

const actorName = (row: CreditRegistrationAdminActionRow): string =>
  formatUserName({ first_name: row.actor_first_name, last_name: row.actor_last_name })

/** The actor with the role under the name, so one cell answers who did this and on what authority. */
const ActorCell: React.FC<{ row: CreditRegistrationAdminActionRow }> = ({ row }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <span className={stackedCellCss}>
      <span>{actorName(row)}</span>
      <span className={noteCss}>
        {[actorRoleLabel(t, row.actor_role), row.actor_email].filter(Boolean).join(MIDDLE_DOT)}
      </span>
    </span>
  )
}

/** What the action was about, named rather than prefixed with its kind and identified by an id. */
const TargetCell: React.FC<{ row: CreditRegistrationAdminActionRow }> = ({ row }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const student =
    row.target_first_name || row.target_last_name
      ? formatUserName({ first_name: row.target_first_name, last_name: row.target_last_name })
      : null
  const name =
    student ??
    row.target_phase ??
    row.course_name ??
    (row.target_id ? row.target_id.slice(0, ID_PREFIX_LENGTH) : null)
  const kindAndCourse = [
    adminActionTargetLabel(t, row.target_kind),
    student ? row.course_name : null,
  ]
    .filter(Boolean)
    .join(MIDDLE_DOT)
  const body = (
    <span className={stackedCellCss}>
      <span>{name ?? ABSENT}</span>
      <span className={cx(noteCss, targetSubtitleCss)}>{kindAndCourse}</span>
    </span>
  )
  return row.target_kind === REGISTRATION_TARGET && row.target_id ? (
    <Link
      href={creditRegistrationItemRoute(row.target_id)}
      appearance={LINK_QUIET}
      prefetch={false}
    >
      {body}
    </Link>
  ) : (
    body
  )
}

/** Both sides of the move, so a single state is never left pointing in no direction. */
const StateChangeCell: React.FC<{ row: CreditRegistrationAdminActionRow }> = ({ row }) => {
  if (!row.before_state && !row.after_state) {
    return null
  }
  return (
    <span className={rowCss}>
      {row.before_state && (
        <span className={stateChangeFromCss}>
          <AdminStateLabel state={row.before_state} />
          <span aria-hidden="true">{ARROW}</span>
        </span>
      )}
      {row.after_state ? <AdminStateLabel state={row.after_state} /> : <span>{ABSENT}</span>}
    </span>
  )
}

/** What the action touched, and where it left it: one cell, because they name the same thing. */
const OnCell: React.FC<{ row: CreditRegistrationAdminActionRow }> = ({ row }) => (
  <span className={stackedCellCss}>
    <TargetCell row={row} />
    <StateChangeCell row={row} />
  </span>
)

/** The target of a `target_id` filter, named from the rows it matched. */
const filteredTargetLabel = (
  targetId: string,
  rows: readonly CreditRegistrationAdminActionRow[],
): string => {
  const match = rows.find((row) => row.target_id === targetId)
  const student = match
    ? formatUserName({ first_name: match.target_first_name, last_name: match.target_last_name })
    : ""
  return student || match?.course_name || targetId.slice(0, ID_PREFIX_LENGTH)
}

/**
 * Every hand action on the pipeline, admins and course teachers alike. The actor-kind filter is the
 * point of the tab: without it a teacher's retry on their own course reads as an admin's.
 */
const AuditPage: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const courseStatsQuery = useCreditRegistrationCourseStats()
  // The stats are one row per module, and a course can have several Suotar-enabled modules: dedupe
  // by course_id or the Select gets two options with the same value and refuses to render at all.
  const courseOptions = useMemo(() => {
    const byCourseId = new Map<string, string>()
    for (const courseModule of courseStatsQuery.data?.modules ?? []) {
      byCourseId.set(courseModule.course_id, courseModule.course_name)
    }
    return Array.from(byCourseId, ([value, label]) => ({ value, label }))
  }, [courseStatsQuery.data?.modules])

  const {
    control,
    setValue,
    handleSubmit,
    param,
    applyParams,
    activeFilterCount,
    clearFilters,
    paginationInfo,
    query,
  } = useFilteredAdminQuery(
    FILTER_FIELDS,
    (filters, pagination) => {
      const actorRole = filters.param(PARAM_ACTOR_ROLE)
      const actorUserId = filters.param(PARAM_ACTOR_USER_ID)
      const action = filters.param(PARAM_ACTION)
      const targetKind = filters.param(PARAM_TARGET_KIND)
      const targetId = filters.param(PARAM_TARGET_ID)
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
        ...includeIf(actorUserId, { actor_user_id: actorUserId }),
        ...includeIf(validAction, { action: [validAction as CreditRegistrationAdminAction] }),
        ...includeIf(validTargetKind, { target_kind: validTargetKind }),
        ...includeIf(targetId, { target_id: targetId }),
        ...includeIf(courseId, { course_id: courseId }),
        ...includeIf(from, { from }),
        ...includeIf(to, { to }),
      }
    },
    {
      rowsPerPage: ROWS_PER_PAGE,
      manualDefaults: (filters) => ({ target_id: filters.param(PARAM_TARGET_ID) ?? "" }),
    },
  )

  const actionsQuery = useCreditRegistrationAdminActions(query)
  const filteredTargetId = param(PARAM_TARGET_ID)
  const filteredActorId = param(PARAM_ACTOR_USER_ID)

  // Off the page in view, because the endpoint reports no roster of actors: someone who has not
  // acted on the rows currently listed is not offered, and picking one narrows the list to them.
  const actorOptions = useMemo(() => {
    const byUserId = new Map<string, string>()
    for (const row of actionsQuery.data?.data ?? []) {
      byUserId.set(row.actor_user_id, actorName(row))
    }
    // A filtered actor with no rows in the result would otherwise leave the Select showing nothing.
    if (filteredActorId && !byUserId.has(filteredActorId)) {
      byUserId.set(filteredActorId, filteredActorId.slice(0, ID_PREFIX_LENGTH))
    }
    return Array.from(byUserId, ([value, label]) => ({ value, label }))
  }, [actionsQuery.data?.data, filteredActorId])

  const clearTargetFilter = () => {
    setValue(TARGET_ID_FIELD, "")
    applyParams({ [PARAM_TARGET_ID]: undefined })
  }

  // The target id is applied on submit rather than on change, so it is not one of the descriptors
  // the hook counts — and a reader who arrived from a registration has only that one filter set.
  const narrowedByCount = activeFilterCount + (filteredTargetId ? 1 : 0)
  const clearAllFilters = () => {
    setValue(TARGET_ID_FIELD, "")
    clearFilters([PARAM_TARGET_ID])
  }

  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-audit")}</h2>
      </div>
      <p className={cx(noteCss, proseCss)}>
        {t("credit-registration-admin-audit-two-actor-kinds-note")}
      </p>
      <form
        className={filterRowsCss}
        onSubmit={handleSubmit((fields) =>
          applyParams({ [PARAM_TARGET_ID]: fields.target_id.trim() }),
        )}
      >
        <div className={controlsCss}>
          <div className={auditControlCss}>
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
          <div className={auditControlCss}>
            <Select
              name="actor_user_id"
              control={control}
              label={t("label-actor")}
              options={[
                { value: ANY, label: t("credit-registration-admin-any-actor") },
                ...actorOptions,
              ]}
              searchEnabled
            />
          </div>
          <div className={auditControlCss}>
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
          <div className={auditControlCss}>
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
          <div className={auditControlCss}>
            <Select
              name="course_id"
              control={control}
              label={t("label-course")}
              options={[
                { value: ANY, label: t("credit-registration-admin-any-course") },
                ...courseOptions,
              ]}
              searchEnabled
            />
          </div>
        </div>
        <div className={controlsCss}>
          <div className={auditControlCss}>
            <TextField
              name="target_id"
              control={control}
              label={t("credit-registration-admin-target-id")}
            />
          </div>
          <div
            className={dateRangeCss}
            role="group"
            aria-label={t("credit-registration-admin-taken")}
          >
            <DateField name="from" control={control} label={t("credit-registration-admin-from")} />
            <DateField name="to" control={control} label={t("credit-registration-admin-to")} />
          </div>
        </div>
      </form>
      <p className={cx(noteCss, proseCss)}>{t("credit-registration-admin-actors-on-this-page")}</p>
      {activeFilterCount > 0 && (
        <div className={rowCss}>
          <span className={noteCss}>
            {t("credit-registration-admin-active-filters", { count: activeFilterCount })}
          </span>
          <Button variant={BUTTON_TERTIARY} size="small" onClick={clearAllFilters}>
            {t("button-text-clear-filters")}
          </Button>
        </div>
      )}
      <QueryResult
        query={actionsQuery}
        refreshIndicator={QUIET_REFRESH}
        contentClassName={sectionCss}
      >
        {(page) => {
          const beyondRoleCount = page.data.filter(isBeyondActorsRole).length
          return (
            <>
              {beyondRoleCount > 0 && (
                <Infobox tone={TONE.DANGER}>
                  {t("credit-registration-admin-beyond-role-count", { count: beyondRoleCount })}
                </Infobox>
              )}
              <div className={rowCss}>
                {/* `Pagination` renders nothing below 2 pages, and repeats this total at 2 or
                    more: show it only where `Pagination` won't. */}
                {page.total_pages < 2 && (
                  <p className={noteCss}>
                    {t("credit-registration-admin-action-count", { count: page.total_count })}
                  </p>
                )}
                {filteredTargetId && (
                  <Chip
                    onRemove={clearTargetFilter}
                    removeLabel={t("credit-registration-admin-remove-filter", {
                      filter: t("credit-registration-admin-column-target"),
                      value: filteredTargetLabel(filteredTargetId, page.data),
                    })}
                  >
                    {t("credit-registration-admin-filtered-to", {
                      target: filteredTargetLabel(filteredTargetId, page.data),
                    })}
                  </Chip>
                )}
              </div>
              <Table
                caption={t("credit-registration-heading-audit")}
                density={DENSITY_COMPACT}
                responsive={TABLE_STACK}
                rowKey={(row) => row.id}
                rows={page.data}
                emptyState={
                  <EmptyState
                    title={t("credit-registration-admin-no-matching-actions")}
                    {...(narrowedByCount > 0
                      ? {
                          action: (
                            <Button
                              variant={BUTTON_TERTIARY}
                              size="small"
                              onClick={clearAllFilters}
                            >
                              {t("button-text-clear-filters")}
                            </Button>
                          ),
                        }
                      : {})}
                  />
                }
                columns={[
                  {
                    header: t("label-time"),
                    minWidth: "7rem",
                    nowrap: true,
                    cell: (row) => <RelativeTime at={row.created_at} absoluteTime={TIME_COMPACT} />,
                  },
                  {
                    header: t("label-actor"),
                    minWidth: "9rem",
                    cell: (row) => <ActorCell row={row} />,
                  },
                  {
                    header: t("credit-registration-admin-column-action"),
                    minWidth: "12rem",
                    cell: (row) => (
                      <span className={stackedCellCss}>
                        <span>{actionSentence(t, row.action, row.affected_row_count)}</span>
                        {isBeyondActorsRole(row) && (
                          <span className={rowCss}>
                            <Badge tone={TONE.DANGER} size={BADGE_COMPACT}>
                              {t("credit-registration-admin-impossible-action")}
                            </Badge>
                          </span>
                        )}
                      </span>
                    ),
                  },
                  {
                    // The widest column and the point of the log: it must never be the one that
                    // runs off the edge, so it takes twice the slack of the one beside it.
                    header: t("label-reason"),
                    grow: 2,
                    minWidth: "16rem",
                    nowrap: false,
                    cell: (row) => row.reason ?? ABSENT,
                  },
                  {
                    header: t("credit-registration-admin-column-on"),
                    grow: 1,
                    minWidth: "18rem",
                    cell: (row) => <OnCell row={row} />,
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
        }}
      </QueryResult>
    </section>
  )
}

export default AuditPage
