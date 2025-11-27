import { css } from "@emotion/css"
import { CheckCircle, ExclamationTriangle, XmarkCircle } from "@vectopus/atlas-icons-react"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useStatusDeployments } from "../../../hooks/useStatusDeployments"
import { useStatusEvents } from "../../../hooks/useStatusEvents"
import { useStatusPodDisruptionBudgets } from "../../../hooks/useStatusPodDisruptionBudgets"
import { useStatusPods } from "../../../hooks/useStatusPods"
import { useSystemHealthDetailed } from "../../../hooks/useSystemHealthDetailed"

import { EventInfo } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"

const StatusSummary: React.FC = () => {
  const { t } = useTranslation()
  const { data: pods, isLoading: podsLoading, error: podsError } = useStatusPods()
  const {
    data: deployments,
    isLoading: deploymentsLoading,
    error: deploymentsError,
  } = useStatusDeployments()
  const { data: events, isLoading: eventsLoading, error: eventsError } = useStatusEvents()
  const { data: _pdbs, isLoading: pdbsLoading } = useStatusPodDisruptionBudgets()
  const {
    data: systemHealthDetailed,
    isLoading: systemHealthDetailedLoading,
    error: systemHealthDetailedError,
  } = useSystemHealthDetailed()

  const summary = useMemo(() => {
    if (!pods || !deployments || !events) {
      return null
    }

    // Categorize pods more accurately
    const readyPods = pods.filter((p) => p.ready === true && p.phase === "Running")
    const failedPods = pods.filter((p) => p.phase === "Failed")
    const pendingPods = pods.filter((p) => p.phase === "Pending")
    const succeededPods = pods.filter((p) => p.phase === "Succeeded")
    const crashedPods = pods.filter((p) => p.phase === "Running" && p.ready === false)

    // Only count pods that should be running (exclude succeeded job pods from health checks)
    const activePods = pods.filter((p) => p.phase !== "Succeeded")
    const totalActivePods = activePods.length

    // Deployment health - only consider deployments that should have replicas
    const activeDeployments = deployments.filter((d) => d.replicas > 0)
    const healthyDeployments = activeDeployments.filter(
      (d) => d.ready_replicas === d.replicas,
    ).length
    const unhealthyDeployments = activeDeployments.filter(
      (d) => d.ready_replicas !== d.replicas,
    ).length
    const totalActiveDeployments = activeDeployments.length

    // Filter events by recency (last hour) and importance
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const isRecent = (timestamp: string | undefined | null): boolean => {
      if (!timestamp) {
        return false
      }
      try {
        const eventTime = new Date(timestamp.replace(" UTC", "Z"))
        return eventTime > oneHourAgo
      } catch {
        return false
      }
    }

    // Filter out common non-critical events
    const isCriticalEvent = (event: EventInfo): boolean => {
      const reason = event.reason?.toLowerCase() || ""
      const message = event.message?.toLowerCase() || ""

      // Ignore common informational events

      const ignoredReasons = [
        // eslint-disable-next-line i18next/no-literal-string
        "scheduled",
        // eslint-disable-next-line i18next/no-literal-string
        "pulled",
        // eslint-disable-next-line i18next/no-literal-string
        "created",
        // eslint-disable-next-line i18next/no-literal-string
        "started",
        // eslint-disable-next-line i18next/no-literal-string
        "killing",
      ]

      if (ignoredReasons.some((r) => reason.includes(r))) {
        return false
      }

      // Critical reasons

      const criticalReasons = [
        // eslint-disable-next-line i18next/no-literal-string
        "failed",
        // eslint-disable-next-line i18next/no-literal-string
        "backoff",
        // eslint-disable-next-line i18next/no-literal-string
        "crashloop",
        // eslint-disable-next-line i18next/no-literal-string
        "imagepullbackoff",
        // eslint-disable-next-line i18next/no-literal-string
        "errimagepull",
        // eslint-disable-next-line i18next/no-literal-string
        "invalid",
      ]

      return criticalReasons.some((r) => reason.includes(r) || message.includes(r))
    }

    const recentWarnings = events
      .filter(
        (e) =>
          e.type_ === "Warning" &&
          (isRecent(e.last_timestamp) || isRecent(e.first_timestamp)) &&
          isCriticalEvent(e),
      )
      .sort((a, b) => {
        const aTime = a.last_timestamp || a.first_timestamp || ""
        const bTime = b.last_timestamp || b.first_timestamp || ""
        return bTime.localeCompare(aTime)
      })
      .slice(0, 5)

    const recentErrors = events
      .filter(
        (e) =>
          e.type_ === "Error" &&
          (isRecent(e.last_timestamp) || isRecent(e.first_timestamp)) &&
          isCriticalEvent(e),
      )
      .sort((a, b) => {
        const aTime = a.last_timestamp || a.first_timestamp || ""
        const bTime = b.last_timestamp || b.first_timestamp || ""
        return bTime.localeCompare(aTime)
      })
      .slice(0, 5)

    // eslint-disable-next-line i18next/no-literal-string
    const defaultHealth: "healthy" | "warning" | "error" = "healthy"
    const overallHealth = (systemHealthDetailed?.status || defaultHealth) as
      | "healthy"
      | "warning"
      | "error"
    const healthIssues = systemHealthDetailed?.issues || []

    return {
      totalPods: totalActivePods,
      readyPods: readyPods.length,
      failedPods: failedPods.length,
      crashedPods: crashedPods.length,
      pendingPods: pendingPods.length,
      succeededPods: succeededPods.length,
      totalDeployments: totalActiveDeployments,
      healthyDeployments,
      unhealthyDeployments,
      recentWarnings,
      recentErrors,
      overallHealth,
      healthIssues,
    }
  }, [pods, deployments, events, systemHealthDetailed])

  if (
    podsLoading ||
    deploymentsLoading ||
    eventsLoading ||
    pdbsLoading ||
    systemHealthDetailedLoading
  ) {
    return <Spinner />
  }

  if (podsError || deploymentsError || eventsError || systemHealthDetailedError) {
    return (
      <div>
        {podsError && <ErrorBanner error={podsError} />}
        {deploymentsError && <ErrorBanner error={deploymentsError} />}
        {eventsError && <ErrorBanner error={eventsError} />}
        {systemHealthDetailedError && <ErrorBanner error={systemHealthDetailedError} />}
      </div>
    )
  }

  if (!summary) {
    return null
  }

  return (
    <div
      className={css`
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
      `}
    >
      {/* Overall Health */}
      <div
        className={css`
          grid-column: 1 / -1;
          padding: 1.5rem;
          border-radius: 8px;
          background-color: ${summary.overallHealth === "healthy"
            ? baseTheme.colors.green[100]
            : summary.overallHealth === "warning"
              ? baseTheme.colors.yellow[100]
              : baseTheme.colors.red[100]};
          border: 2px solid
            ${summary.overallHealth === "healthy"
              ? baseTheme.colors.green[600]
              : summary.overallHealth === "warning"
                ? baseTheme.colors.yellow[600]
                : baseTheme.colors.red[600]};
        `}
      >
        <h3
          className={css`
            margin: 0 0 0.5rem 0;
            font-size: 1.2rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 0.75rem;
          `}
        >
          {summary.overallHealth === "healthy" && (
            <CheckCircle size={24} color={baseTheme.colors.green[600]} />
          )}
          {summary.overallHealth === "warning" && (
            <ExclamationTriangle size={24} color={baseTheme.colors.yellow[700]} />
          )}
          {summary.overallHealth === "error" && (
            <XmarkCircle size={24} color={baseTheme.colors.red[600]} />
          )}
          <span>
            {t("status-system-health")}:{" "}
            <span
              className={css`
                text-transform: uppercase;
              `}
            >
              {summary.overallHealth === "healthy"
                ? t("status-healthy")
                : summary.overallHealth === "warning"
                  ? t("status-warning")
                  : t("status-error")}
            </span>
          </span>
        </h3>
        <p
          className={css`
            margin: 0;
            font-size: 0.9rem;
            color: ${baseTheme.colors.gray[500]};
          `}
        >
          {summary.overallHealth === "healthy"
            ? t("status-all-systems-operational")
            : summary.healthIssues.length > 0
              ? summary.healthIssues.join(", ")
              : summary.overallHealth === "warning"
                ? t("status-some-issues-detected")
                : t("status-critical-issues-detected")}
        </p>
      </div>

      {/* Pods Stats */}
      <div
        className={css`
          padding: 1rem;
          border-radius: 8px;
          background-color: ${baseTheme.colors.clear[100]};
          border: 1px solid ${baseTheme.colors.clear[300]};
        `}
      >
        <div
          className={css`
            font-size: 0.9rem;
            color: ${baseTheme.colors.gray[500]};
            margin-bottom: 0.5rem;
          `}
        >
          {t("status-pods")}
        </div>
        <div
          className={css`
            font-size: 2rem;
            font-weight: 600;
            color: ${baseTheme.colors.gray[700]};
          `}
        >
          {summary.readyPods}/{summary.totalPods}
        </div>
        <div
          className={css`
            font-size: 0.85rem;
            margin-top: 0.5rem;
          `}
        >
          {summary.failedPods > 0 && (
            <span
              className={css`
                color: ${baseTheme.colors.red[600]};
                margin-right: 0.5rem;
              `}
            >
              {summary.failedPods} {t("status-failed")}
            </span>
          )}
          {summary.crashedPods > 0 && (
            <span
              className={css`
                color: ${baseTheme.colors.red[600]};
                margin-right: 0.5rem;
              `}
            >
              {summary.crashedPods} {t("status-crashed")}
            </span>
          )}
          {summary.pendingPods > 0 && (
            <span
              className={css`
                color: ${baseTheme.colors.yellow[600]};
                margin-right: 0.5rem;
              `}
            >
              {summary.pendingPods} {t("status-pending")}
            </span>
          )}
          {summary.succeededPods > 0 && (
            <span
              className={css`
                color: ${baseTheme.colors.gray[400]};
                font-size: 0.8rem;
              `}
            >
              {summary.succeededPods} {t("status-completed")}
            </span>
          )}
        </div>
      </div>

      {/* Deployments Stats */}
      <div
        className={css`
          padding: 1rem;
          border-radius: 8px;
          background-color: ${baseTheme.colors.clear[100]};
          border: 1px solid ${baseTheme.colors.clear[300]};
        `}
      >
        <div
          className={css`
            font-size: 0.9rem;
            color: ${baseTheme.colors.gray[500]};
            margin-bottom: 0.5rem;
          `}
        >
          {t("status-deployments")}
        </div>
        <div
          className={css`
            font-size: 2rem;
            font-weight: 600;
            color: ${baseTheme.colors.gray[700]};
          `}
        >
          {summary.healthyDeployments}/{summary.totalDeployments}
        </div>
        <div
          className={css`
            font-size: 0.85rem;
            margin-top: 0.5rem;
          `}
        >
          {summary.unhealthyDeployments > 0 && (
            <span
              className={css`
                color: ${baseTheme.colors.red[600]};
              `}
            >
              {summary.unhealthyDeployments} {t("status-unhealthy")}
            </span>
          )}
        </div>
      </div>

      {/* Recent Warnings */}
      {summary.recentWarnings.length > 0 && (
        <div
          className={css`
            padding: 1rem;
            border-radius: 8px;
            background-color: ${baseTheme.colors.yellow[100]};
            border: 1px solid ${baseTheme.colors.yellow[600]};
          `}
        >
          <div
            className={css`
              font-size: 0.9rem;
              color: ${baseTheme.colors.gray[700]};
              margin-bottom: 0.5rem;
              font-weight: 600;
            `}
          >
            {t("status-recent-warnings")}
          </div>
          <div
            className={css`
              font-size: 2rem;
              font-weight: 600;
              color: ${baseTheme.colors.gray[700]};
            `}
          >
            {summary.recentWarnings.length}
          </div>
        </div>
      )}

      {/* Recent Errors */}
      {summary.recentErrors.length > 0 && (
        <div
          className={css`
            padding: 1rem;
            border-radius: 8px;
            background-color: ${baseTheme.colors.red[100]};
            border: 1px solid ${baseTheme.colors.red[600]};
          `}
        >
          <div
            className={css`
              font-size: 0.9rem;
              color: ${baseTheme.colors.red[700]};
              margin-bottom: 0.5rem;
              font-weight: 600;
            `}
          >
            {t("status-recent-errors")}
          </div>
          <div
            className={css`
              font-size: 2rem;
              font-weight: 600;
              color: ${baseTheme.colors.red[700]};
            `}
          >
            {summary.recentErrors.length}
          </div>
        </div>
      )}
    </div>
  )
}

export default StatusSummary
