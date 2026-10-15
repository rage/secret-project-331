"use client"

import { cx } from "@emotion/css"
import React, { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import AbsentValue from "@/components/credit-registration/AbsentValue"
import { adminLedgerStateLabel } from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import { useCreditRegistrationPhases } from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import { phaseAnchorId } from "@/components/credit-registration/admin/adminLinks"
import AdminPhaseActions from "@/components/credit-registration/admin/AdminPhaseActions"
import ApiLogSection from "@/components/credit-registration/admin/ApiLogSection"
import BulkChangesSection from "@/components/credit-registration/admin/BulkChangesSection"
import CircuitBreakerSection from "@/components/credit-registration/admin/CircuitBreakerSection"
import EndpointSummarySection from "@/components/credit-registration/admin/EndpointSummarySection"
import ErrorCodeSection from "@/components/credit-registration/admin/ErrorCodeSection"
import {
  countPhasesByHealth,
  isUnhealthyPhase,
  phaseHealth,
  phaseHealthLabel,
} from "@/components/credit-registration/admin/phaseStatus"
import QueueSizeByStateSection from "@/components/credit-registration/admin/QueueSizeByStateSection"
import {
  ALIGN_END,
  CREDIT_REGISTRATION_NS,
  DENSITY_COMPACT,
  PLAIN_DISCLOSURE,
  QUIET_REFRESH,
  TABLE_STACK,
  TONE,
} from "@/components/credit-registration/constants"
import { formatIntervalInWords } from "@/components/credit-registration/durationWords"
import ScheduledTime from "@/components/credit-registration/ScheduledTime"
import {
  headingCss,
  inlineTooltipTriggerCss,
  codeValueCss,
  noteCss,
  proseCss,
  rowCss,
  sectionCardCss,
  sectionCardHeaderCss,
  sectionCardsCss,
  sectionCss,
  stackedCellCss,
  subheadingCss,
  subsectionCss,
} from "@/components/credit-registration/styles"
import { ZonedTimestamp } from "@/components/credit-registration/ZonedTimestamp"
import type {
  CreditRegistrationErrorCode,
  CreditRegistrationPhaseList,
  CreditRegistrationPhaseRow,
} from "@/generated/api/types.generated"
import {
  Badge,
  Disclosure,
  Link,
  QueryResult,
  StatTile,
  StatTileList,
  Table,
  Tooltip,
} from "@/shared-module/components"

const SERVER_STATUS_PATH = "/status"

const PhaseTable: React.FC<{
  phases: CreditRegistrationPhaseRow[]
  caption: string
}> = ({ phases, caption }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <Table
      caption={caption}
      density={DENSITY_COMPACT}
      responsive={TABLE_STACK}
      rowKey={(row) => row.phase}
      rows={phases}
      columns={[
        {
          header: t("credit-registration-admin-column-phase"),
          minWidth: "12rem",
          cell: (row) => (
            <span id={phaseAnchorId(row.phase)} className={rowCss}>
              <code className={codeValueCss}>{row.phase}</code>
              {row.owned_states.length > 0 && (
                <Tooltip
                  aria-label={t("credit-registration-admin-owned-states-tooltip-label", {
                    phase: row.phase,
                  })}
                  className={inlineTooltipTriggerCss}
                  trigger={
                    <span className={noteCss}>
                      {t("credit-registration-admin-owned-states-trigger", {
                        count: row.owned_states.length,
                      })}
                    </span>
                  }
                >
                  {t("credit-registration-admin-owned-states-tooltip-body", {
                    states: row.owned_states
                      .map((state) => adminLedgerStateLabel(t, state))
                      .join(", "),
                  })}
                </Tooltip>
              )}
            </span>
          ),
        },
        {
          header: t("label-status"),
          minWidth: "11rem",
          cell: (row) => {
            const health = phaseHealth(row)
            // `failing` already implies at least one consecutive failure, so the count badge
            // carries the health label too rather than doubling up on red.
            const failing = health === "failing"
            return (
              <span className={stackedCellCss}>
                {isUnhealthyPhase(health) ? (
                  <Badge tone={TONE.DANGER} size="compact">
                    {failing
                      ? t("credit-registration-admin-consecutive-failures", {
                          count: row.consecutive_failures,
                        })
                      : phaseHealthLabel(t, health)}
                  </Badge>
                ) : (
                  <span>{phaseHealthLabel(t, health)}</span>
                )}
                {!failing && row.consecutive_failures > 0 && (
                  <span className={noteCss}>
                    {t("credit-registration-admin-consecutive-failures", {
                      count: row.consecutive_failures,
                    })}
                  </span>
                )}
                {row.last_error && (
                  <span className={cx(noteCss, codeValueCss)}>{row.last_error}</span>
                )}
                {row.pause_reason && <span className={noteCss}>{row.pause_reason}</span>}
              </span>
            )
          },
        },
        {
          header: t("credit-registration-admin-phase-last-run"),
          minWidth: "8rem",
          nowrap: true,
          cell: (row) => <ZonedTimestamp at={row.last_run_finished_at} />,
        },
        {
          header: t("credit-registration-admin-column-due"),
          minWidth: "10rem",
          cell: (row) => (
            <span className={stackedCellCss}>
              {/* A paused phase keeps a stale next_run_at; the status column says why it will not run. */}
              {row.paused_at ? <AbsentValue /> : <ScheduledTime at={row.next_run_at} />}
              <span className={noteCss}>
                {t("credit-registration-admin-phase-interval", {
                  interval: formatIntervalInWords(t, row.expected_interval_secs),
                })}
              </span>
            </span>
          ),
        },
        {
          header: t("credit-registration-admin-column-queue"),
          align: ALIGN_END,
          minWidth: "5rem",
          nowrap: true,
          cell: (row) => row.queue_depth ?? <AbsentValue />,
        },
        {
          header: t("label-actions"),
          minWidth: "4rem",
          cell: (row) => (
            <AdminPhaseActions
              phase={row.phase}
              paused={row.paused_at !== null}
              isKnownPhase={row.is_known_phase}
            />
          ),
        },
      ]}
    />
  )
}

/** Rows arrive in process then pipeline order, so grouping is a fold rather than a sort. */
const groupByProcess = (
  phases: CreditRegistrationPhaseRow[],
): [string, CreditRegistrationPhaseRow[]][] => {
  const groups: [string, CreditRegistrationPhaseRow[]][] = []
  for (const phase of phases) {
    const last = groups.at(-1)
    if (last && last[0] === phase.process_name) {
      last[1].push(phase)
    } else {
      groups.push([phase.process_name, [phase]])
    }
  }
  return groups
}

const PhaseSection: React.FC<{ list: CreditRegistrationPhaseList }> = ({ list }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const counts = countPhasesByHealth(list.phases)

  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-phases")}</h2>
      </div>
      <p className={cx(noteCss, proseCss)}>
        {t("credit-registration-admin-phase-late-note", {
          multiplier: list.heartbeat_interval_multiplier,
          limit: list.consecutive_failure_limit,
        })}{" "}
        <Link href={SERVER_STATUS_PATH}>{t("credit-registration-admin-open-pod-status")}</Link>
      </p>
      <p className={noteCss}>
        {t("credit-registration-admin-server-build")}{" "}
        <code className={codeValueCss}>{list.server_build_commit}</code>
      </p>
      {/* Failing and heartbeat-late counts are the System tab badge's own number; repeating them
          here would just be that badge restated. Running and paused are not shown anywhere else. */}
      <StatTileList ariaLabel={t("credit-registration-heading-phases")}>
        <StatTile label={t("credit-registration-admin-phase-running")} value={counts.running} />
        {counts.paused > 0 && (
          <StatTile label={t("credit-registration-admin-phase-paused")} value={counts.paused} />
        )}
      </StatTileList>
      {list.paused_globally && (
        <div className={rowCss}>
          <Badge tone={TONE.DANGER}>{t("credit-registration-admin-paused-globally")}</Badge>
        </div>
      )}
      {groupByProcess(list.phases).map(([processName, phases]) => (
        <div key={processName} className={subsectionCss}>
          <h3 className={subheadingCss}>{processName}</h3>
          <PhaseTable phases={phases} caption={processName} />
        </div>
      ))}
      {list.phases.length === 0 && (
        <p className={noteCss}>{t("credit-registration-admin-no-phases")}</p>
      )}
    </section>
  )
}

/** The machinery: the phases that move the ledger, their history, the tools that act on many rows at
 * once, and the calls they make to the study registry. */
const SystemPage: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const phasesQuery = useCreditRegistrationPhases()
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  const [bulkErrorCode, setBulkErrorCode] = useState<CreditRegistrationErrorCode | null>(null)
  const bulkSectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (bulkErrorCode) {
      bulkSectionRef.current?.scrollIntoView()
    }
  }, [bulkErrorCode])

  const selectRowsWithErrorCode = (errorCode: CreditRegistrationErrorCode) => {
    setBulkErrorCode(errorCode)
    setIsBulkOpen(true)
  }

  return (
    <div className={sectionCardsCss}>
      <QueryResult query={phasesQuery} refreshIndicator={QUIET_REFRESH}>
        {(list) => <PhaseSection list={list} />}
      </QueryResult>
      <section className={sectionCardCss}>
        {/* Mounted only when opened, so the history is fetched only for a reader who wants it. */}
        <Disclosure title={t("credit-registration-heading-history")} variant={PLAIN_DISCLOSURE}>
          <div className={sectionCss}>
            <ErrorCodeSection onSelectRows={selectRowsWithErrorCode} />
            <QueueSizeByStateSection />
          </div>
        </Disclosure>
      </section>
      <section ref={bulkSectionRef} className={sectionCardCss}>
        <Disclosure
          title={t("credit-registration-heading-bulk-changes")}
          variant={PLAIN_DISCLOSURE}
          expanded={isBulkOpen}
          onExpandedChange={setIsBulkOpen}
        >
          <BulkChangesSection prefilledErrorCode={bulkErrorCode} />
        </Disclosure>
      </section>
      <CircuitBreakerSection />
      <EndpointSummarySection />
      <ApiLogSection />
    </div>
  )
}

export default SystemPage
