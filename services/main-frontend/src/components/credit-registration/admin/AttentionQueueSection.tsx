"use client"

import { cx } from "@emotion/css"
import React, { useCallback, useEffect } from "react"
import { VisuallyHidden } from "react-aria"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type {
  CreditRegistrationAttentionItem,
  CreditRegistrationAttentionItems,
  CreditRegistrationAttentionReason,
  GetCreditRegistrationAttentionItemsData,
  StuckThresholds,
} from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import Pagination from "@/shared-module/common/components/Pagination"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { creditRegistrationItemRoute } from "@/shared-module/common/utils/routes"
import {
  Badge,
  Button,
  Checkbox,
  Link,
  Meter,
  QueryResult,
  RelativeTime,
  Select,
  Table,
} from "@/shared-module/components"
import { formatDuration } from "@/utils/moduleTimeline"

import { DENSITY_COMPACT, LINK_QUIET, QUIET_REFRESH, TIME_COMPACT, TONE } from "../constants"
import {
  controlCss,
  controlsCss,
  headingCss,
  noteCss,
  proseCss,
  rowCss,
  sectionCss,
  sectionHeaderCss,
  stackedCellCss,
  toolbarCss,
} from "../styles"
import AdminBulkTransitionDialog from "./AdminBulkTransitionDialog"
import { attentionReasonLabel, isAttentionReason } from "./adminCreditRegistrationCopy"
import {
  useCreditRegistrationAttentionItems,
  useCreditRegistrationThresholds,
} from "./adminCreditRegistrationHooks"
import AdminStateBadge from "./AdminStateBadge"
import FacetChip from "./FacetChip"
import { secondsSince, stuckThresholdSecs } from "./stuckThreshold"
import type { FilterFieldDescriptor } from "./useFilteredAdminQuery"
import { useFilteredAdminQuery } from "./useFilteredAdminQuery"
import type { QueryParamFilters } from "./useQueryParamFilters"

type AttentionQuery = NonNullable<GetCreditRegistrationAttentionItemsData["query"]>

const ROWS_PER_PAGE = 50

/** The bar runs to twice the threshold, so a stuck row shows how far past it has gone. */
const STUCK_METER_SCALE = 2

// oxlint-disable-next-line i18next/no-literal-string
const PARAM_REASON = "reason"
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_WITHOUT_REASON = "without_reason"
// oxlint-disable-next-line i18next/no-literal-string
const PARAM_SORT = "sort"
// oxlint-disable-next-line i18next/no-literal-string
const TRUE = "true"

// oxlint-disable-next-line i18next/no-literal-string
const SORT_TIME_IN_STATE = "time_in_state"
// oxlint-disable-next-line i18next/no-literal-string
const SORT_NEXT_ATTEMPT = "next_attempt"
// oxlint-disable-next-line i18next/no-literal-string
const SORT_COURSE = "course"

interface SortFields {
  sort: string
}

interface SelectionFields {
  selectAll: boolean
  selected: Record<string, boolean>
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

const StuckMeter: React.FC<{
  item: CreditRegistrationAttentionItem
  thresholds: StuckThresholds
}> = ({ item, thresholds }) => {
  const { t } = useTranslation()
  const threshold = stuckThresholdSecs(item.state, thresholds)
  if (threshold === null) {
    return null
  }
  const elapsed = secondsSince(item.state_entered_at)
  return (
    <Meter
      value={elapsed}
      maxValue={threshold * STUCK_METER_SCALE}
      threshold={threshold}
      showLabel={false}
      tone={elapsed > threshold ? TONE.DANGER : TONE.NEUTRAL}
      label={t("credit-registration-admin-stuck-progress", {
        elapsed: formatDuration(elapsed, t),
        threshold: formatDuration(threshold, t),
      })}
    />
  )
}

const FacetChips: React.FC<{
  attention: CreditRegistrationAttentionItems
  facets: Facets
  applyParams: QueryParamFilters["applyParams"]
}> = ({ attention, facets, applyParams }) => {
  const { t } = useTranslation()
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

  return (
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
    </div>
  )
}

/**
 * The work queue: every live registration a detector picked, plus the ones the pipeline flagged
 * without one. Its length is the number the tab badge and the Overview tile show.
 */
const AttentionQueueSection: React.FC = () => {
  const { t } = useTranslation()
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

  const {
    control: selectionControl,
    watch,
    reset,
    setValue,
  } = useForm<SelectionFields>({
    defaultValues: { selectAll: false, selected: {} },
  })
  const selected = watch("selected")
  const selectAll = watch("selectAll")
  const clearSelection = useCallback(() => reset({ selectAll: false, selected: {} }), [reset])

  const items = attentionQuery.data?.items ?? []
  const visibleIds = items.map((item) => item.credit_registration_id)
  // Read off the rows on screen, so a tick a facet or a page turn has since hidden cannot reach the
  // bulk dialog, and the header box's indeterminate state counts the set the table shows.
  const selectedIds = visibleIds.filter((id) => selected[id])

  // Only when the header box itself is toggled: reacting to `visibleIds` would clear the selection
  // on every poll.
  useEffect(() => {
    setValue("selected", Object.fromEntries(visibleIds.map((id) => [id, selectAll] as const)))
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [selectAll])

  // A facet or a page turn changes which rows exist to act on; ticks they hide would otherwise
  // reappear in the toolbar's count once the narrowing is cleared again.
  const narrowingKey = `${facets.reasons.join()}:${facets.withoutReason}:${paginationInfo.page}`
  useEffect(() => {
    clearSelection()
  }, [narrowingKey, clearSelection])

  return (
    <section className={sectionCss}>
      <div className={sectionHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-attention")}</h2>
        {attentionQuery.data && (
          <p className={noteCss}>
            {t("credit-registration-admin-queue-length", {
              count: attentionQuery.data.total_count,
            })}
          </p>
        )}
      </div>
      {attentionQuery.data && (
        <FacetChips attention={attentionQuery.data} facets={facets} applyParams={applyParams} />
      )}
      {facets.withoutReason && (
        <p className={cx(noteCss, proseCss)}>{t("credit-registration-admin-flagged-only-note")}</p>
      )}
      {thresholds && (
        <p className={cx(noteCss, proseCss)}>
          {t("credit-registration-admin-stuck-thresholds", {
            readyToSubmit: formatDuration(thresholds.stuck_ready_to_submit_secs, t),
            submitting: formatDuration(thresholds.stuck_submitting_secs, t),
            awaitingVerification: formatDuration(thresholds.stuck_awaiting_verification_secs, t),
            failedRetryable: formatDuration(thresholds.stuck_failed_retryable_secs, t),
          })}
        </p>
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
      </div>
      <QueryResult query={attentionQuery} refreshIndicator={QUIET_REFRESH}>
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
              columns={[
                {
                  header: (
                    <Checkbox
                      name="selectAll"
                      control={selectionControl}
                      isIndeterminate={
                        selectedIds.length > 0 && selectedIds.length < attention.items.length
                      }
                      label={
                        <VisuallyHidden>
                          {t("credit-registration-admin-select-every-row")}
                        </VisuallyHidden>
                      }
                    />
                  ),
                  nowrap: true,
                  cell: (row) => (
                    <Checkbox
                      name={`selected.${row.credit_registration_id}`}
                      control={selectionControl}
                      label={
                        <VisuallyHidden>
                          {t("credit-registration-admin-select-registration", {
                            student: formatUserName(row),
                          })}
                        </VisuallyHidden>
                      }
                    />
                  ),
                },
                {
                  header: t("label-student"),
                  grow: true,
                  minWidth: "12rem",
                  cell: (row) => (
                    <span className={stackedCellCss}>
                      <Link
                        href={creditRegistrationItemRoute(row.credit_registration_id)}
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
                  minWidth: "10rem",
                  cell: (row) => (
                    <span className={stackedCellCss}>
                      <AdminStateBadge state={row.state} />
                      {row.error_code && <code>{row.error_code}</code>}
                    </span>
                  ),
                },
                {
                  header: t("credit-registration-admin-column-reasons"),
                  minWidth: "10rem",
                  cell: (row) =>
                    row.reasons.length === 0 ? (
                      <Badge tone={TONE.NEUTRAL} size="compact">
                        {t("credit-registration-admin-reason-flagged-only")}
                      </Badge>
                    ) : (
                      <span className={rowCss}>
                        {row.reasons.map((reason) => (
                          <Badge key={reason} tone={TONE.NEUTRAL} size="compact">
                            {attentionReasonLabel(t, reason)}
                          </Badge>
                        ))}
                      </span>
                    ),
                },
                {
                  header: t("label-credit-registration-time-in-state"),
                  minWidth: "8rem",
                  nowrap: true,
                  cell: (row) => (
                    <span className={stackedCellCss}>
                      <RelativeTime at={row.state_entered_at} absoluteTime={TIME_COMPACT} />
                      {thresholds && <StuckMeter item={row} thresholds={thresholds} />}
                    </span>
                  ),
                },
                {
                  header: t("credit-registration-admin-column-next-attempt"),
                  minWidth: "7rem",
                  nowrap: true,
                  cell: (row) => (
                    <RelativeTime at={row.next_attempt_at} absoluteTime={TIME_COMPACT} />
                  ),
                },
              ]}
            />
            {selectedIds.length > 0 && (
              <div className={toolbarCss}>
                <div className={rowCss}>
                  <span>
                    {t("credit-registration-admin-selected-count", { count: selectedIds.length })}
                  </span>
                  <AdminBulkTransitionDialog selectedIds={selectedIds} onApplied={clearSelection} />
                  <Button variant="tertiary" size="medium" onClick={clearSelection}>
                    {t("credit-registration-admin-clear-selection")}
                  </Button>
                </div>
              </div>
            )}
            <Pagination paginationInfo={paginationInfo} totalPages={attention.total_pages} />
          </>
        )}
      </QueryResult>
    </section>
  )
}

export default AttentionQueueSection
