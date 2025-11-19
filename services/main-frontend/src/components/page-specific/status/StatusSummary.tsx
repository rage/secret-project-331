import { css } from "@emotion/css"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useStatusDeployments } from "../../../hooks/useStatusDeployments"
import { useStatusEvents } from "../../../hooks/useStatusEvents"
import { useStatusPods } from "../../../hooks/useStatusPods"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

const StatusSummary: React.FC = () => {
  const { t } = useTranslation()
  const { data: pods, isLoading: podsLoading, error: podsError } = useStatusPods()
  const {
    data: deployments,
    isLoading: deploymentsLoading,
    error: deploymentsError,
  } = useStatusDeployments()
  const { data: events, isLoading: eventsLoading, error: eventsError } = useStatusEvents()

  const summary = useMemo(() => {
    if (!pods || !deployments || !events) {
      return null
    }

    // Categorize pods more accurately
    const runningPods = pods.filter((p) => p.phase === "Running")
    const readyPods = pods.filter((p) => p.ready === true && p.phase === "Running")
    const failedPods = pods.filter((p) => p.phase === "Failed")
    const pendingPods = pods.filter((p) => p.phase === "Pending")
    const succeededPods = pods.filter((p) => p.phase === "Succeeded") // Job pods that completed successfully
    const crashedPods = pods.filter((p) => p.phase === "Running" && p.ready === false) // Running but not ready (likely crash loop)

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
    const isCriticalEvent = (event: (typeof events)[0]): boolean => {
      const reason = event.reason?.toLowerCase() || ""
      const message = event.message?.toLowerCase() || ""

      // Ignore common informational events
      // eslint-disable-next-line i18next/no-literal-string
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
        // eslint-disable-next-line i18next/no-literal-string
        "unhealthy", // Sometimes this is just a health check, not critical
      ]

      if (ignoredReasons.some((r) => reason.includes(r))) {
        return false
      }

      // Critical reasons
      // eslint-disable-next-line i18next/no-literal-string
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

    // Improved health detection logic
    // eslint-disable-next-line i18next/no-literal-string
    let overallHealth: "healthy" | "warning" | "error" = "healthy"
    const healthIssues: string[] = []

    // Critical issues (error state)
    if (failedPods.length > 0) {
      // eslint-disable-next-line i18next/no-literal-string
      overallHealth = "error"
      healthIssues.push(
        t("status-failed-pods-count", {
          count: failedPods.length,
          defaultValue: `${failedPods.length} failed pod(s)`,
        }),
      )
    }
    if (crashedPods.length > 0) {
      // eslint-disable-next-line i18next/no-literal-string
      overallHealth = "error"
      healthIssues.push(
        t("status-crashed-pods-count", {
          count: crashedPods.length,
          defaultValue: `${crashedPods.length} crashed pod(s)`,
        }),
      )
    }
    if (unhealthyDeployments > 0) {
      // eslint-disable-next-line i18next/no-literal-string
      overallHealth = "error"
      healthIssues.push(
        t("status-unhealthy-deployments-count", {
          count: unhealthyDeployments,
          defaultValue: `${unhealthyDeployments} unhealthy deployment(s)`,
        }),
      )
    }
    if (recentErrors.length > 0) {
      // eslint-disable-next-line i18next/no-literal-string
      overallHealth = "error"
      healthIssues.push(
        t("status-recent-errors-count", {
          count: recentErrors.length,
          defaultValue: `${recentErrors.length} recent error(s)`,
        }),
      )
    }

    // Warning issues (only if not already in error state)
    // eslint-disable-next-line i18next/no-literal-string
    if (overallHealth !== "error") {
      if (pendingPods.length > 0 && pendingPods.length > totalActivePods * 0.1) {
        // More than 10% of pods pending
        // eslint-disable-next-line i18next/no-literal-string
        overallHealth = "warning"
        healthIssues.push(
          t("status-pending-pods-count", {
            count: pendingPods.length,
            defaultValue: `${pendingPods.length} pending pod(s)`,
          }),
        )
      }
      if (readyPods.length < runningPods.length && runningPods.length > 0) {
        // Some running pods are not ready
        const notReadyCount = runningPods.length - readyPods.length
        if (notReadyCount > 0) {
          // eslint-disable-next-line i18next/no-literal-string
          overallHealth = "warning"
          healthIssues.push(
            t("status-pods-not-ready-count", {
              count: notReadyCount,
              defaultValue: `${notReadyCount} pod(s) not ready`,
            }),
          )
        }
      }
      if (recentWarnings.length > 0) {
        // eslint-disable-next-line i18next/no-literal-string
        overallHealth = "warning"
        healthIssues.push(
          t("status-recent-warnings-count", {
            count: recentWarnings.length,
            defaultValue: `${recentWarnings.length} recent warning(s)`,
          }),
        )
      }
    }

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
  }, [pods, deployments, events])

  if (podsLoading || deploymentsLoading || eventsLoading) {
    return <Spinner />
  }

  if (podsError || deploymentsError || eventsError) {
    return (
      <div>
        {podsError && <ErrorBanner error={podsError} />}
        {deploymentsError && <ErrorBanner error={deploymentsError} />}
        {eventsError && <ErrorBanner error={eventsError} />}
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
            ? "#d4edda"
            : summary.overallHealth === "warning"
              ? "#fff3cd"
              : "#f8d7da"};
          border: 2px solid
            ${summary.overallHealth === "healthy"
              ? "#28a745"
              : summary.overallHealth === "warning"
                ? "#ffc107"
                : "#dc3545"};
        `}
      >
        <h3
          className={css`
            margin: 0 0 0.5rem 0;
            font-size: 1.2rem;
            font-weight: 600;
          `}
        >
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
        </h3>
        <p
          className={css`
            margin: 0;
            font-size: 0.9rem;
            opacity: 0.8;
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
          background-color: #f8f9fa;
          border: 1px solid #dee2e6;
        `}
      >
        <div
          className={css`
            font-size: 0.9rem;
            color: #6c757d;
            margin-bottom: 0.5rem;
          `}
        >
          {t("status-pods")}
        </div>
        <div
          className={css`
            font-size: 2rem;
            font-weight: 600;
            color: #212529;
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
                color: #dc3545;
                margin-right: 0.5rem;
              `}
            >
              {summary.failedPods} {t("status-failed")}
            </span>
          )}
          {summary.crashedPods > 0 && (
            <span
              className={css`
                color: #dc3545;
                margin-right: 0.5rem;
              `}
            >
              {summary.crashedPods} {t("status-crashed")}
            </span>
          )}
          {summary.pendingPods > 0 && (
            <span
              className={css`
                color: #ffc107;
                margin-right: 0.5rem;
              `}
            >
              {summary.pendingPods} {t("status-pending")}
            </span>
          )}
          {summary.succeededPods > 0 && (
            <span
              className={css`
                color: #6c757d;
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
          background-color: #f8f9fa;
          border: 1px solid #dee2e6;
        `}
      >
        <div
          className={css`
            font-size: 0.9rem;
            color: #6c757d;
            margin-bottom: 0.5rem;
          `}
        >
          {t("status-deployments")}
        </div>
        <div
          className={css`
            font-size: 2rem;
            font-weight: 600;
            color: #212529;
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
                color: #dc3545;
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
            background-color: #fff3cd;
            border: 1px solid #ffc107;
          `}
        >
          <div
            className={css`
              font-size: 0.9rem;
              color: #856404;
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
              color: #856404;
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
            background-color: #f8d7da;
            border: 1px solid #dc3545;
          `}
        >
          <div
            className={css`
              font-size: 0.9rem;
              color: #721c24;
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
              color: #721c24;
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
