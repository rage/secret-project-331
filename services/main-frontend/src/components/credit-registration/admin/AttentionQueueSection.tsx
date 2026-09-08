"use client"

import { cx } from "@emotion/css"
import React, { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import type {
  CreditRegistrationAttentionItem,
  CreditRegistrationAttentionItems,
  CreditRegistrationAttentionReason,
  CreditRegistrationState,
  GetCreditRegistrationAttentionItemsData,
  StuckThresholds,
} from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import Pagination from "@/shared-module/common/components/Pagination"
import { includeIf } from "@/shared-module/common/utils/nullability"
import {
  creditRegistrationItemRoute,
  creditRegistrationRegistrationsRoute,
} from "@/shared-module/common/utils/routes"
import {
  Button,
  Link,
  MeterInline,
  QueryResult,
  RelativeTime,
  Select,
  Table,
  Tooltip,
} from "@/shared-module/components"
import { formatDuration } from "@/utils/moduleTimeline"

import {
  ABSENT,
  BUTTON_TERTIARY,
  CREDIT_REGISTRATION_NS,
  DENSITY_COMPACT,
  LINK_QUIET,
  MIDDLE_DOT,
  QUIET_REFRESH,
  TABLE_STACK,
  TIME_COMPACT,
  TIME_DURATION,
  TONE,
} from "../constants"
import {
  controlCss,
  controlsCss,
  headingCss,
  monospaceCss,
  noteCss,
  proseCss,
  rowCss,
  sectionCardCss,
  sectionCardHeaderCss,
  sectionCss,
  sectionHeaderCss,
  stackedCellCss,
  toolbarCss,
} from "../styles"
import AdminBulkTransitionDialog from "./AdminBulkTransitionDialog"
import {
  attentionReasonLabel,
  isAttentionReason,
  registrationErrorNote,
} from "./adminCreditRegistrationCopy"
import {
  useCreditRegistrationAttentionItems,
  useCreditRegistrationThresholds,
} from "./adminCreditRegistrationHooks"
import AdminRequeueRetryableDialog from "./AdminRequeueRetryableDialog"
import AdminStateLabel from "./AdminStateLabel"
import FacetChip from "./FacetChip"
import { secondsSince, stuckThresholdSecs } from "./stuckThreshold"
import StudentCell, { STUDENT_COLUMN_MIN_WIDTH } from "./StudentCell"
import type { FilterFieldDescriptor } from "./useFilteredAdminQuery"
import { useFilteredAdminQuery } from "./useFilteredAdminQuery"
import type { QueryParamFilters } from "./useQueryParamFilters"

type AttentionQuery = NonNullable<GetCreditRegistrationAttentionItemsData["query"]>

const ROWS_PER_PAGE = 50

/** The bar runs to twice the threshold, so a stuck row shows how far past it has gone. */
const STUCK_METER_SCALE = 2

/**
 * Above this, selecting a whole facet is not offered: the rows have to be fetched to be selected,
 * and the bulk endpoint caps what one call may move anyway.
 */
const MAX_SELECT_ALL_ROWS = 500

/** The only states a next attempt is scheduled for. Everything else here waits on a person. */
const RETRYING_STATES: readonly CreditRegistrationState[] = ["failed_retryable", "ready_to_submit"]

// These reasons just restate the state badge beside them ("Reversed by Sisu" on a "Reversed in
// Sisu" row, say); showing them again in the reasons column triples what one glance already said.
const REASONS_IMPLIED_BY_STATE: ReadonlySet<CreditRegistrationAttentionReason> = new Set([
  "permanent_error",
  "outcome_uncertain",
  "misregistered",
])

const PARAM_REASON = "reason"
const PARAM_WITHOUT_REASON = "without_reason"
const PARAM_SORT = "sort"
const TRUE = "true"

const SORT_TIME_IN_STATE = "time_in_state"
const SORT_NEXT_ATTEMPT = "next_attempt"
const SORT_COURSE = "course"

const ATTENTION_QUERY = "?needs_admin_attention=true"
const COURSE_PARAM = "&course_id="
const STATE_PARAM = "&state="

interface SortFields {
  sort: string
}

const FILTER_FIELDS: FilterFieldDescriptor<SortFields>[] = [
  {
    param: PARAM_SORT,
    field: "sort",
    fromParam: (raw) => raw ?? SORT_TIME_IN_STATE,
    // The default order stays out of the URL, so a pasted link carries only what was chosen.
    toParam: (value) => (value === SORT_TIME_IN_STATE ? undefined : (value as string)),
  },
]

interface Facets {
  reasons: CreditRegistrationAttentionReason[]
  withoutReason: boolean
}

const readFacets = (filters: Pick<QueryParamFilters, "param" | "params">): Facets => ({
  // Validated, not cast: an unknown reason would narrow the queue to nothing, which the page then
  // reports as "nothing needs a human".
  reasons: filters.params(PARAM_REASON).filter((raw) => isAttentionReason(raw)),
  withoutReason: filters.param(PARAM_WITHOUT_REASON) === TRUE,
})

/**
 * How long this row has sat in its state, against the threshold that makes it stuck.
 *
 * The duration is the reading; the bar is only there to show how far past the threshold it is.
 */
const TimeInState: React.FC<{
  item: CreditRegistrationAttentionItem
  thresholds: StuckThresholds | undefined
}> = ({ item, thresholds }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const threshold = thresholds ? stuckThresholdSecs(item.state, thresholds) : null
  const elapsed = secondsSince(item.state_entered_at)

  return (
    <span className={stackedCellCss}>
      {threshold === null ? (
        <RelativeTime at={item.state_entered_at} absoluteTime={TIME_DURATION} />
      ) : (
        <MeterInline
          value={elapsed}
          maxValue={threshold * STUCK_METER_SCALE}
          threshold={threshold}
          tone={elapsed > threshold ? TONE.DANGER : TONE.NEUTRAL}
          valueText={<RelativeTime at={item.state_entered_at} absoluteTime={TIME_DURATION} />}
          valueLabel={t("credit-registration-admin-stuck-progress", {
            elapsed: formatDuration(elapsed, t),
            threshold: formatDuration(threshold, t),
          })}
          label={t("label-credit-registration-time-in-state")}
        />
      )}
      <span className={noteCss}>
        <RelativeTime at={item.state_entered_at} absoluteTime={TIME_COMPACT} />
      </span>
    </span>
  )
}

const FacetChips: React.FC<{
  attention: CreditRegistrationAttentionItems
  facets: Facets
  applyParams: QueryParamFilters["applyParams"]
  thresholds: StuckThresholds | undefined
}> = ({ attention, facets, applyParams, thresholds }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const groups = attention.counts_by_reason.filter((group) => group.count > 0)

  // The two narrowings select disjoint sets and the endpoint refuses them together, so picking one
  // clears the other rather than quietly returning nothing.
  const toggleReason = (reason: CreditRegistrationAttentionReason) =>
    applyParams({
      [PARAM_REASON]: facets.reasons.includes(reason)
        ? facets.reasons.filter((one) => one !== reason)
        : [...facets.reasons, reason],
      [PARAM_WITHOUT_REASON]: undefined,
    })

  const toggleWithoutReason = () =>
    applyParams({
      [PARAM_WITHOUT_REASON]: facets.withoutReason ? undefined : TRUE,
      [PARAM_REASON]: undefined,
    })

  const reasonTotal =
    groups.reduce((sum, group) => sum + group.count, 0) + attention.flagged_without_reason_count

  return (
    <div className={sectionHeaderCss}>
      <div className={rowCss}>
        {groups.map((group) => (
          <FacetChip
            key={group.reason}
            label={attentionReasonLabel(t, group.reason)}
            count={group.count}
            isSelected={facets.reasons.includes(group.reason)}
            onToggle={() => toggleReason(group.reason)}
          />
        ))}
        {attention.flagged_without_reason_count > 0 && (
          <FacetChip
            label={t("credit-registration-admin-reason-flagged-only")}
            count={attention.flagged_without_reason_count}
            isSelected={facets.withoutReason}
            onToggle={toggleWithoutReason}
          />
        )}
        {thresholds && (
          <Tooltip aria-label={t("credit-registration-admin-about-stuck")}>
            {t("credit-registration-admin-stuck-thresholds", {
              readyToSubmit: formatDuration(thresholds.stuck_ready_to_submit_secs, t),
              submitting: formatDuration(thresholds.stuck_submitting_secs, t),
              awaitingVerification: formatDuration(thresholds.stuck_awaiting_verification_secs, t),
              failedRetryable: formatDuration(thresholds.stuck_failed_retryable_secs, t),
            })}
          </Tooltip>
        )}
      </div>
      {/* The chips add up to more than the queue whenever a row carries two reasons, which reads as
          an error unless it is said. */}
      {reasonTotal > attention.total_count && (
        <p className={cx(noteCss, proseCss)}>
          {t("credit-registration-admin-several-reasons-note")}
        </p>
      )}
    </div>
  )
}

/**
 * The work queue: every live registration a detector picked, plus the ones the pipeline flagged
 * without one. Its length is the number the tab badge shows.
 */
const AttentionQueueSection: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const thresholds = useCreditRegistrationThresholds().data

  const { control, param, params, applyParams, paginationInfo, query } = useFilteredAdminQuery<
    SortFields,
    AttentionQuery
  >(
    FILTER_FIELDS,
    (filters, pagination) => {
      const facets = readFacets(filters)
      const sort = filters.param(PARAM_SORT)
      return {
        page: pagination.page,
        limit: pagination.limit,
        ...includeIf(!facets.withoutReason && facets.reasons.length > 0, {
          reason: facets.reasons,
        }),
        ...includeIf(facets.withoutReason, { without_reason: true }),
        ...includeIf(sort, { sort }),
      }
    },
    { rowsPerPage: ROWS_PER_PAGE },
  )

  const facets = readFacets({ param, params })
  const attentionQuery = useCreditRegistrationAttentionItems(query)
  const items = attentionQuery.data?.items ?? []
  const filteredCount = attentionQuery.data?.filtered_count ?? 0

  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(() => new Set())
  const [isSelectingFacet, setIsSelectingFacet] = useState(false)
  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set())
    setIsSelectingFacet(false)
  }, [])

  // Every row the narrowing matches, fetched only when the operator asks to select them all: the
  // bulk dialog needs each row's state to decide which moves are safe, not just its id.
  const facetQuery = useCreditRegistrationAttentionItems(
    { ...query, page: 1, limit: Math.max(filteredCount, 1) },
    { enabled: isSelectingFacet },
  )
  const facetItems = facetQuery.data?.items ?? []

  // A facet or a page turn changes which rows exist to act on; ticks they hide would otherwise
  // reappear in the toolbar's count once the narrowing is cleared again.
  useEffect(clearSelection, [
    facets.reasons.join(),
    facets.withoutReason,
    paginationInfo.page,
    clearSelection,
  ])

  const shownKeys = isSelectingFacet
    ? new Set(facetItems.map((item) => item.credit_registration_id))
    : selectedKeys
  const rowsById = new Map(
    [...items, ...facetItems].map((item) => [item.credit_registration_id, item] as const),
  )
  const selectedRows = Array.from(shownKeys).flatMap((id) => {
    const row = rowsById.get(id)
    return row ? [row] : []
  })
  const canSelectWholeFacet =
    filteredCount > items.length && filteredCount <= MAX_SELECT_ALL_ROWS && !isSelectingFacet

  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-attention")}</h2>
      </div>
      {attentionQuery.data && (
        <FacetChips
          attention={attentionQuery.data}
          facets={facets}
          applyParams={applyParams}
          thresholds={thresholds}
        />
      )}
      {facets.withoutReason && (
        <p className={cx(noteCss, proseCss)}>{t("credit-registration-admin-flagged-only-note")}</p>
      )}
      <div className={controlsCss}>
        <div className={controlCss}>
          <Select
            name="sort"
            control={control}
            label={t("credit-registration-admin-sort")}
            options={[
              {
                value: SORT_TIME_IN_STATE,
                label: t("credit-registration-admin-sort-time-in-state"),
              },
              { value: SORT_NEXT_ATTEMPT, label: t("credit-registration-admin-sort-next-attempt") },
              { value: SORT_COURSE, label: t("credit-registration-admin-sort-course-name") },
            ]}
          />
        </div>
        <AdminRequeueRetryableDialog />
      </div>
      {(selectedRows.length > 0 || canSelectWholeFacet) && (
        <div className={toolbarCss}>
          <div className={rowCss}>
            {selectedRows.length > 0 && (
              <>
                <span>
                  {t("credit-registration-admin-selected-count", {
                    count: selectedRows.length,
                  })}
                </span>
                <AdminBulkTransitionDialog selectedRows={selectedRows} onApplied={clearSelection} />
                <Button variant={BUTTON_TERTIARY} size="medium" onClick={clearSelection}>
                  {t("credit-registration-admin-clear-selection")}
                </Button>
              </>
            )}
            {canSelectWholeFacet && (
              <Button
                variant={BUTTON_TERTIARY}
                size="small"
                onClick={() => setIsSelectingFacet(true)}
              >
                {t("credit-registration-admin-select-all-matching", { count: filteredCount })}
              </Button>
            )}
          </div>
        </div>
      )}
      <QueryResult
        query={attentionQuery}
        refreshIndicator={QUIET_REFRESH}
        contentClassName={sectionCss}
      >
        {(attention) => (
          <>
            {attention.filtered_count !== attention.total_count && (
              <p className={noteCss}>
                {t("credit-registration-admin-queue-narrowed", {
                  shown: attention.filtered_count,
                  total: attention.total_count,
                })}
              </p>
            )}
            <Table
              caption={t("credit-registration-heading-attention")}
              density={DENSITY_COMPACT}
              rowKey={(row) => row.credit_registration_id}
              rows={attention.items}
              emptyState={t("credit-registration-admin-nothing-needs-a-human")}
              responsive={TABLE_STACK}
              stickyFirstColumn
              rowHover
              selection={{
                selectedKeys: shownKeys,
                onChange: (keys) => {
                  setIsSelectingFacet(false)
                  setSelectedKeys(keys)
                },
                selectAllLabel: t("credit-registration-admin-select-every-row"),
                rowLabel: (row) =>
                  t("credit-registration-admin-select-registration", {
                    student: formatUserName(row),
                  }),
              }}
              columns={[
                {
                  header: t("label-student"),
                  grow: 1,
                  minWidth: STUDENT_COLUMN_MIN_WIDTH,
                  cell: (row) => (
                    <StudentCell
                      row={row}
                      href={creditRegistrationItemRoute(row.credit_registration_id)}
                    />
                  ),
                },
                {
                  header: t("label-course"),
                  grow: 1,
                  minWidth: "11rem",
                  // The queue cannot be narrowed by course, so the cell opens the list that can.
                  cell: (row) => (
                    <span className={stackedCellCss}>
                      <Link
                        href={`${creditRegistrationRegistrationsRoute()}${ATTENTION_QUERY}${COURSE_PARAM}${row.course_id}`}
                        appearance={LINK_QUIET}
                        prefetch={false}
                      >
                        {row.course_name}
                      </Link>
                      <span className={noteCss}>{row.course_module_name}</span>
                    </span>
                  ),
                },
                {
                  header: t("label-state"),
                  minWidth: "13rem",
                  cell: (row) => {
                    const errorNote = registrationErrorNote(t, row.state, row.error_code)
                    return (
                      <span className={stackedCellCss}>
                        <Link
                          href={`${creditRegistrationRegistrationsRoute()}${ATTENTION_QUERY}${STATE_PARAM}${row.state}`}
                          appearance={LINK_QUIET}
                          prefetch={false}
                        >
                          <AdminStateLabel state={row.state} />
                        </Link>
                        {errorNote && (
                          <span className={noteCss}>
                            {errorNote} <code className={monospaceCss}>{row.error_code}</code>
                          </span>
                        )}
                      </span>
                    )
                  },
                },
                // Once a facet is picked every row carries it, so the column only repeats the chip.
                ...(facets.reasons.length > 0 || facets.withoutReason
                  ? []
                  : [
                      {
                        header: t("credit-registration-admin-column-reasons"),
                        minWidth: "10rem",
                        cell: (row: CreditRegistrationAttentionItem) => {
                          if (row.reasons.length === 0) {
                            return (
                              <span className={noteCss}>
                                {t("credit-registration-admin-reason-flagged-only")}
                              </span>
                            )
                          }
                          const informative = row.reasons.filter(
                            (reason) => !REASONS_IMPLIED_BY_STATE.has(reason),
                          )
                          return informative.length === 0 ? (
                            <span className={noteCss}>{ABSENT}</span>
                          ) : (
                            informative
                              .map((reason) => attentionReasonLabel(t, reason))
                              .join(MIDDLE_DOT)
                          )
                        },
                      },
                    ]),
                {
                  header: t("label-credit-registration-time-in-state"),
                  minWidth: "11rem",
                  cell: (row) => <TimeInState item={row} thresholds={thresholds} />,
                },
                {
                  header: t("credit-registration-admin-column-next-attempt"),
                  minWidth: "7rem",
                  nowrap: true,
                  // A terminal or blocked row is never attempted again, and a date under this
                  // heading promises that it will be.
                  cell: (row) =>
                    RETRYING_STATES.includes(row.state) ? (
                      <RelativeTime at={row.next_attempt_at} absoluteTime={TIME_COMPACT} />
                    ) : (
                      <span className={noteCss}>{ABSENT}</span>
                    ),
                },
              ]}
            />
            <Pagination
              paginationInfo={paginationInfo}
              totalPages={attention.total_pages}
              totalItems={attention.filtered_count}
            />
          </>
        )}
      </QueryResult>
    </section>
  )
}

export default AttentionQueueSection
