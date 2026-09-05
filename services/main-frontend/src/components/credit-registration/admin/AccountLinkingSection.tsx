"use client"

import { css, cx } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { adminUnlinkStudentNumber } from "@/generated/api/sdk.generated"
import type {
  AccountLinkingRealisationCounters,
  AccountLinkingStats,
  EmailSendStatus,
} from "@/generated/api/types.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import Pagination from "@/shared-module/common/components/Pagination"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { creditRegistrationRegistrationsRoute } from "@/shared-module/common/utils/routes"
import type { TableColumn } from "@/shared-module/components"
import {
  Badge,
  Button,
  DescriptionList,
  Dialog,
  Meter,
  QueryResult,
  RelativeTime,
  StatTile,
  StatTileList,
  Table,
} from "@/shared-module/components"

import {
  ABSENT,
  ALIGN_END,
  DENSITY_COMPACT,
  MIDDLE_DOT,
  QUIET_REFRESH,
  STACKED,
  TIME_COMPACT,
  TONE,
} from "../constants"
import {
  headingCss,
  monospaceCss,
  noteCss,
  proseCss,
  rowCss,
  sectionCss,
  sectionHeaderCss,
  stackedCellCss,
  subheadingCss,
  subsectionCss,
} from "../styles"
import {
  sendStatusLabel,
  verificationMethodLabel,
  verificationMethodTone,
} from "./adminCreditRegistrationCopy"
import {
  useAccountLinkingStats,
  useAdminVerifiedStudentNumbers,
  useInvalidateAfterLinkingChange,
} from "./adminCreditRegistrationHooks"
import AdminManualLinkButton from "./AdminManualLinkButton"
import AdminResendLinkingEmailDialog from "./AdminResendLinkingEmailDialog"
import { formatSharePercent } from "./percent"
import { useReasonConfirmAction } from "./useReasonConfirmAction"

const WINDOW_DAYS = 30
const CLAIMS_PER_PAGE = 25
const DAY_SECS = 86_400

// oxlint-disable-next-line i18next/no-literal-string
const WAITING_QUERY = "?state=pending"
// oxlint-disable-next-line i18next/no-literal-string
const ADMIN_MANUAL = "admin_manual"
// oxlint-disable-next-line i18next/no-literal-string
const FAST_TRACK = "email_match_fast_track"
// oxlint-disable-next-line i18next/no-literal-string
const SEND_FAILED: EmailSendStatus = "send_failed"
// oxlint-disable-next-line i18next/no-literal-string
const SMALL = "small" as const

const addressListCss = css`
  margin: 0;
  padding-inline-start: var(--space-4);
`

/** Capped, so the count does not sit a screen away from the domain it belongs to. */
const narrowTableCss = css`
  max-width: 24rem;
`

/** The escape hatch's warning belongs beside the button, not inside the dialog it opens. */
const manualLinkCalloutCss = css`
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border-left: 3px solid var(--color-crimson-600);
  border-radius: 0 var(--surface-radius) var(--surface-radius) 0;
  background: var(--color-crimson-50);
  justify-items: start;
`

const UnlinkButton: React.FC<{ verifiedStudentNumberId: string; number: string }> = ({
  verifiedStudentNumberId,
  number,
}) => {
  const { t } = useTranslation()
  const invalidateAfterLinkingChange = useInvalidateAfterLinkingChange()
  const { button, dialog } = useReasonConfirmAction({
    mutationFn: (fields) =>
      adminUnlinkStudentNumber({
        path: { verified_student_number_id: verifiedStudentNumberId },
        body: { reason: fields.reason },
      }),
    // Unlinking recomputes preconditions synchronously, so registration state moves too.
    invalidate: () => void invalidateAfterLinkingChange(),
    buttonLabel: t("button-text-unlink"),
    buttonSize: SMALL,
    dialogTitle: t("button-text-unlink"),
    dialogMessage: t("credit-registration-admin-unlink-warning", { number }),
  })

  return (
    <>
      {button}
      {dialog}
    </>
  )
}

/**
 * Where the last discovery run's people went, each step as a share of the people it listed. Only
 * counts from that one run belong here; anything measured over the window is a tile above.
 */
const DiscoverySteps: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  const funnel = stats.funnel
  const listed = funnel.persons_discovered_last_run
  const steps = [
    {
      label: t("credit-registration-admin-funnel-already-linked"),
      value: funnel.already_linked_last_run,
    },
    {
      label: t("credit-registration-admin-funnel-fast-tracked-last-run"),
      value: funnel.fast_tracked_last_run,
    },
    {
      label: t("credit-registration-admin-suppressed-by-dedup"),
      value: funnel.suppressed_by_dedup_last_run,
    },
    {
      label: t("credit-registration-admin-suppressed-by-rate-cap"),
      value: funnel.suppressed_by_rate_cap_last_run,
    },
    {
      label: t("credit-registration-admin-no-address-in-registry"),
      value: funnel.no_address_in_study_registry_last_run,
    },
  ]
  return (
    <div className={cx(subsectionCss, proseCss)}>
      <p className={noteCss}>{t("credit-registration-admin-funnel-listed", { count: listed })}</p>
      {steps.map((step) => (
        <Meter
          key={step.label}
          label={step.label}
          value={step.value}
          maxValue={Math.max(listed, 1)}
          valueLabel={String(step.value)}
        />
      ))}
    </div>
  )
}

const WindowTotals: React.FC<{ stats: AccountLinkingStats; windowDays: number }> = ({
  stats,
  windowDays,
}) => {
  const { t } = useTranslation()
  const funnel = stats.funnel
  return (
    <div className={subsectionCss}>
      <h3 className={subheadingCss}>
        {t("credit-registration-heading-linking-window", { days: windowDays })}
      </h3>
      <StatTileList
        ariaLabel={t("credit-registration-heading-linking-window", { days: windowDays })}
      >
        <StatTile
          label={t("credit-registration-admin-funnel-mails-sent")}
          value={funnel.mails_sent_in_window}
        />
        <StatTile
          label={t("credit-registration-admin-funnel-numbers-claimed")}
          value={funnel.numbers_claimed_in_window}
        />
        <StatTile
          label={t("credit-registration-admin-funnel-fast-tracked-in-window")}
          value={funnel.fast_tracked_in_window}
        />
        <StatTile
          label={t("credit-registration-admin-funnel-manual-links")}
          value={funnel.manual_links_in_window}
        />
      </StatTileList>
    </div>
  )
}

/** The two figures that are not about the window: the backlog now, and the all-time link mix. */
const StandingTotals: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  const fastTrackTotal =
    stats.links_total_by_method.find((row) => row.verified_via === FAST_TRACK)?.count ?? 0
  const manualTotal =
    stats.links_total_by_method.find((row) => row.verified_via === ADMIN_MANUAL)?.count ?? 0
  const linksTotal = stats.links_total_by_method.reduce((sum, row) => sum + row.count, 0)
  return (
    <div className={subsectionCss}>
      <h3 className={subheadingCss}>{t("credit-registration-heading-linking-standing")}</h3>
      <StatTileList ariaLabel={t("credit-registration-heading-linking-standing")} maxColumns={2}>
        <StatTile
          label={t("credit-registration-admin-waiting-for-number")}
          value={stats.waiting_for_student_number_count}
          href={`${creditRegistrationRegistrationsRoute()}${WAITING_QUERY}`}
          alertWhenNonZero
        />
        <StatTile label={t("credit-registration-admin-manual-links-total")} value={manualTotal} />
      </StatTileList>
      {linksTotal > 0 && (
        <Meter
          className={proseCss}
          label={t("credit-registration-admin-fast-track-share")}
          value={fastTrackTotal}
          maxValue={linksTotal}
          valueLabel={formatSharePercent(fastTrackTotal, linksTotal)}
        />
      )}
    </div>
  )
}

const SendStatusBlock: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  const totals = stats.send_status_totals
  return (
    <div className={subsectionCss}>
      <div className={sectionHeaderCss}>
        <h3 className={subheadingCss}>{t("credit-registration-admin-send-status-header")}</h3>
        <p className={cx(noteCss, proseCss)}>
          {t("credit-registration-admin-send-status-our-side-note")}
        </p>
      </div>
      <StatTileList ariaLabel={t("credit-registration-admin-send-status-header")}>
        <StatTile label={t("credit-registration-admin-send-status-queued")} value={totals.queued} />
        <StatTile
          label={t("credit-registration-admin-send-status-retrying")}
          value={totals.retrying}
        />
        <StatTile label={t("credit-registration-admin-send-status-sent")} value={totals.sent} />
        <StatTile
          label={t("credit-registration-admin-send-status-send-failed")}
          value={totals.send_failed}
          alertWhenNonZero
        />
      </StatTileList>
      {stats.hard_failure_domains.length > 0 && (
        <Table
          className={narrowTableCss}
          caption={t("credit-registration-heading-failure-domains")}
          showCaption
          density={DENSITY_COMPACT}
          rowKey={(row) => row.domain}
          rows={stats.hard_failure_domains}
          columns={[
            { header: t("label-domain"), grow: true, cell: (row) => <code>{row.domain}</code> },
            { header: t("label-count"), align: ALIGN_END, nowrap: true, cell: (row) => row.count },
          ]}
        />
      )}
    </div>
  )
}

/** The ten reasons a listed person got no mail, in a dialog so the row above stays one line high. */
const RealisationBreakdown: React.FC<{ row: AccountLinkingRealisationCounters }> = ({ row }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const counters: { label: string; value: number | null | undefined }[] = [
    {
      label: t("credit-registration-admin-funnel-already-linked"),
      value: row.already_linked_count,
    },
    {
      label: t("credit-registration-admin-suppressed-by-dedup"),
      value: row.suppressed_by_dedup_count,
    },
    {
      label: t("credit-registration-admin-suppressed-by-rate-cap"),
      value: row.suppressed_by_rate_cap_count,
    },
    { label: t("credit-registration-admin-no-address-in-registry"), value: row.no_address_count },
    {
      label: t("credit-registration-admin-fast-track-skipped-no-account"),
      value: row.fast_track_skipped_no_account_count,
    },
    {
      label: t("credit-registration-admin-fast-track-skipped-unverified"),
      value: row.fast_track_skipped_unverified_count,
    },
    {
      label: t("credit-registration-admin-fast-track-skipped-stale"),
      value: row.fast_track_skipped_stale_verification_count,
    },
    {
      label: t("credit-registration-admin-fast-track-skipped-name-mismatch"),
      value: row.fast_track_skipped_name_mismatch_count,
    },
    {
      label: t("credit-registration-admin-fast-track-skipped-has-number"),
      value: row.fast_track_skipped_account_has_number_count,
    },
    {
      label: t("credit-registration-admin-fast-track-skipped-unlinked-before"),
      value: row.fast_track_skipped_unlinked_before_count,
    },
  ]
  return (
    <>
      <Button variant="tertiary" size="small" onClick={() => setOpen(true)}>
        {t("credit-registration-admin-column-breakdown")}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("credit-registration-admin-why-no-mail")}
      >
        <DescriptionList
          layout={STACKED}
          items={counters.map((counter) => ({
            label: counter.label,
            value: counter.value ?? ABSENT,
          }))}
        />
      </Dialog>
    </>
  )
}

const RealisationBlock: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  return (
    <div className={subsectionCss}>
      <div className={sectionHeaderCss}>
        <h3 className={subheadingCss}>{t("credit-registration-heading-realisations")}</h3>
        <p className={cx(noteCss, proseCss)}>
          {t("credit-registration-admin-realisation-last-run-note")}
        </p>
      </div>
      <Table
        caption={t("credit-registration-heading-realisations")}
        density={DENSITY_COMPACT}
        rowKey={(row) => row.course_unit_realisation_id}
        rows={stats.realisations}
        emptyState={t("credit-registration-admin-no-realisations")}
        columns={[
          {
            header: t("label-course"),
            grow: true,
            minWidth: "14rem",
            cell: (row) => (
              <span className={stackedCellCss}>
                <span>{row.course_name}</span>
                <span className={cx(noteCss, monospaceCss)}>{row.uh_course_code}</span>
              </span>
            ),
          },
          {
            header: t("label-credit-registration-listing-health"),
            minWidth: "12rem",
            cell: (row) =>
              row.last_listing_error ? (
                <span className={stackedCellCss}>
                  <Badge tone={TONE.DANGER} size="compact">
                    {t("credit-registration-admin-listing-failing", {
                      count: row.consecutive_listing_failures,
                    })}
                  </Badge>
                  <span className={noteCss}>{row.last_listing_error}</span>
                </span>
              ) : (
                <Badge tone={TONE.SUCCESS} size="compact">
                  {t("credit-registration-admin-listing-ok")}
                </Badge>
              ),
          },
          {
            header: t("label-credit-registration-last-listed"),
            minWidth: "8rem",
            nowrap: true,
            cell: (row) => <RelativeTime at={row.last_listed_at} absoluteTime={TIME_COMPACT} />,
          },
          {
            header: t("credit-registration-admin-funnel-discovered"),
            align: ALIGN_END,
            minWidth: "7rem",
            nowrap: false,
            cell: (row) => row.listed_person_count ?? ABSENT,
          },
          {
            header: t("credit-registration-admin-funnel-mails-claimed"),
            align: ALIGN_END,
            minWidth: "6rem",
            nowrap: false,
            cell: (row) => row.mailed_count ?? ABSENT,
          },
          {
            header: t("credit-registration-admin-funnel-fast-tracked"),
            align: ALIGN_END,
            minWidth: "6rem",
            nowrap: false,
            cell: (row) => row.fast_tracked_count ?? ABSENT,
          },
          {
            header: t("credit-registration-admin-column-breakdown"),
            minWidth: "8rem",
            cell: (row) => <RealisationBreakdown row={row} />,
          },
        ]}
      />
    </div>
  )
}

const StaleAddressBlock: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  return (
    <div className={subsectionCss}>
      <div className={sectionHeaderCss}>
        <h3 className={subheadingCss}>
          {t("credit-registration-heading-stale-addresses", {
            max: stats.max_mails_per_person_and_course,
          })}
        </h3>
        <p className={cx(noteCss, proseCss)}>
          {t("credit-registration-admin-stale-addresses-note")}
        </p>
      </div>
      <Table
        caption={t("credit-registration-heading-stale-addresses-table")}
        density={DENSITY_COMPACT}
        rowKey={(row) => `${row.student_number}:${row.course_id}`}
        rows={stats.stale_addresses}
        emptyState={t("credit-registration-admin-no-stale-addresses")}
        columns={[
          {
            header: t("label-student-number"),
            minWidth: "7rem",
            nowrap: true,
            cell: (row) => <span className={monospaceCss}>{row.student_number}</span>,
          },
          { header: t("label-course"), minWidth: "12rem", cell: (row) => row.course_name },
          {
            header: t("label-credit-registration-addresses-tried"),
            grow: true,
            minWidth: "16rem",
            cell: (row) => (
              <ul className={addressListCss}>
                {row.sends.map((send) => (
                  <li key={send.address}>
                    {send.address}
                    {MIDDLE_DOT}
                    <Badge
                      tone={send.send_status === SEND_FAILED ? TONE.DANGER : TONE.NEUTRAL}
                      size="compact"
                    >
                      {sendStatusLabel(t, send.send_status)}
                    </Badge>
                  </li>
                ))}
              </ul>
            ),
          },
          {
            header: t("label-credit-registration-last-sent"),
            minWidth: "8rem",
            nowrap: true,
            cell: (row) => <RelativeTime at={row.last_sent_at} absoluteTime={TIME_COMPACT} />,
          },
          {
            header: t("label-actions"),
            minWidth: "12rem",
            cell: (row) => (
              <span className={rowCss}>
                <AdminResendLinkingEmailDialog
                  studentNumber={row.student_number}
                  courseId={row.course_id}
                  courseName={row.course_name}
                  compact
                />
                <AdminManualLinkButton
                  studentNumber={row.student_number}
                  size={SMALL}
                  label={t("credit-registration-admin-link-by-hand")}
                />
              </span>
            ),
          },
        ]}
      />
      <div className={manualLinkCalloutCss}>
        <p className={proseCss}>{t("credit-registration-admin-manual-link-warning")}</p>
        <AdminManualLinkButton />
      </div>
    </div>
  )
}

const RecentClaimsBlock: React.FC = () => {
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo(CLAIMS_PER_PAGE)
  const numbersQuery = useAdminVerifiedStudentNumbers({
    page: paginationInfo.page,
    limit: paginationInfo.limit,
  })
  return (
    <div className={subsectionCss}>
      <div className={sectionHeaderCss}>
        <h3 className={subheadingCss}>{t("credit-registration-heading-recent-claims")}</h3>
        <p className={cx(noteCss, proseCss)}>
          {t("credit-registration-admin-claiming-address-differs-note")}
        </p>
      </div>
      <QueryResult query={numbersQuery} refreshIndicator={QUIET_REFRESH}>
        {(page) => {
          // Only manual links carry one, so on most pages the column would be empty end to end.
          const reasonColumn: TableColumn<(typeof page.data)[number]>[] = page.data.some(
            (row) => row.link_reason,
          )
            ? [
                {
                  header: t("label-reason"),
                  grow: true,
                  minWidth: "14rem",
                  nowrap: false,
                  cell: (row) => row.link_reason ?? ABSENT,
                },
              ]
            : []
          return (
            <>
              <Table
                caption={t("credit-registration-heading-recent-claims")}
                density={DENSITY_COMPACT}
                rowKey={(row) => row.id}
                rows={page.data}
                emptyState={t("credit-registration-admin-no-links-yet")}
                columns={[
                  {
                    header: t("label-student-number"),
                    minWidth: "7rem",
                    nowrap: true,
                    cell: (row) => <span className={monospaceCss}>{row.student_number}</span>,
                  },
                  {
                    header: t("label-student"),
                    grow: reasonColumn.length === 0,
                    minWidth: "12rem",
                    cell: (row) => (
                      <span className={stackedCellCss}>
                        <span>{formatUserName(row)}</span>
                        <span className={noteCss}>{row.user_email}</span>
                      </span>
                    ),
                  },
                  {
                    header: t("label-credit-registration-verified-via"),
                    minWidth: "12rem",
                    cell: (row) => (
                      <span className={stackedCellCss}>
                        <Badge tone={verificationMethodTone(row.verified_via)} size="compact">
                          {verificationMethodLabel(t, row.verified_via) ?? row.verified_via}
                        </Badge>
                        <span className={noteCss}>{row.verified_via_email}</span>
                      </span>
                    ),
                  },
                  {
                    header: t("label-time"),
                    minWidth: "8rem",
                    nowrap: true,
                    cell: (row) => (
                      <RelativeTime at={row.verified_at} absoluteTime={TIME_COMPACT} />
                    ),
                  },
                  ...reasonColumn,
                  {
                    header: t("label-actions"),
                    minWidth: "7rem",
                    cell: (row) => (
                      <UnlinkButton verifiedStudentNumberId={row.id} number={row.student_number} />
                    ),
                  },
                ]}
              />
              <Pagination paginationInfo={paginationInfo} totalPages={page.total_pages} />
            </>
          )
        }}
      </QueryResult>
    </div>
  )
}

/** How a student number reaches an account, and who is stuck on the way. */
const AccountLinkingSection: React.FC = () => {
  const { t } = useTranslation()
  const statsQuery = useAccountLinkingStats(WINDOW_DAYS)

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-linking-funnel")}</h2>
      <QueryResult query={statsQuery} refreshIndicator={QUIET_REFRESH}>
        {(stats) => {
          // From the response, not the request: the endpoint decides what window it measured.
          const windowDays = Math.round(stats.window_secs / DAY_SECS)
          return (
            <>
              <WindowTotals stats={stats} windowDays={windowDays} />
              <StandingTotals stats={stats} />
              <div className={subsectionCss}>
                <h3 className={subheadingCss}>
                  {t("credit-registration-heading-last-discovery-run")}
                </h3>
                <DiscoverySteps stats={stats} />
              </div>
              <SendStatusBlock stats={stats} />
              <RealisationBlock stats={stats} />
              <StaleAddressBlock stats={stats} />
            </>
          )
        }}
      </QueryResult>
      <RecentClaimsBlock />
    </section>
  )
}

export default AccountLinkingSection
