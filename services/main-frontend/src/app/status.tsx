"use client"

import { css } from "@emotion/css"
import React, { useEffect, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"

import StatusCronJobs from "../components/page-specific/status/StatusCronJobs"
import StatusDeployments from "../components/page-specific/status/StatusDeployments"
import StatusEvents from "../components/page-specific/status/StatusEvents"
import StatusIngresses from "../components/page-specific/status/StatusIngresses"
import StatusJobs from "../components/page-specific/status/StatusJobs"
import StatusPods from "../components/page-specific/status/StatusPods"
import StatusServices from "../components/page-specific/status/StatusServices"
import StatusSummary from "../components/page-specific/status/StatusSummary"
import { useFavicon } from "../hooks/useFavicon"
import { useLocalNotifications } from "../hooks/useLocalNotifications"
import { useSystemHealthDetailed } from "../hooks/useSystemHealthDetailed"

import Button from "@/shared-module/common/components/Button"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"

const createFavicon = (status: "healthy" | "warning" | "error"): string => {
  const colors = {
    healthy: "#22c55e",

    warning: "#eab308",

    error: "#ef4444",
  }
  const icons = {
    // eslint-disable-next-line i18next/no-literal-string
    healthy: "✓",

    warning: "⚠",
    // eslint-disable-next-line i18next/no-literal-string
    error: "✕",
  }

  // eslint-disable-next-line i18next/no-literal-string
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" fill="${colors[status]}" rx="4"/>
      <text x="16" y="24" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="white" text-anchor="middle">${icons[status]}</text>
    </svg>
  `.trim()

  // eslint-disable-next-line i18next/no-literal-string
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const StatusPage: React.FC = () => {
  const { t } = useTranslation()
  const { data: systemHealthDetailed } = useSystemHealthDetailed()
  const previousHealthRef = useRef<"healthy" | "warning" | "error" | null>(null)
  const {
    notificationsEnabled,
    permissionDeniedMessage,
    notificationsSupported,
    toggleNotifications,
    sendNotification: sendLocalNotification,
  } = useLocalNotifications()

  const overallHealth = useMemo(() => {
    // eslint-disable-next-line i18next/no-literal-string
    const defaultHealth: "healthy" | "warning" | "error" = "healthy"
    return (systemHealthDetailed?.status || defaultHealth) as "healthy" | "warning" | "error"
  }, [systemHealthDetailed?.status])

  useEffect(() => {
    if (!notificationsEnabled) {
      return
    }

    if (previousHealthRef.current === null) {
      previousHealthRef.current = overallHealth
      return
    }

    if (previousHealthRef.current === overallHealth) {
      return
    }

    const healthIssues = systemHealthDetailed?.issues || []
    const issueText = healthIssues.length > 0 ? healthIssues.join(", ") : ""

    let title = ""
    let body = ""

    if (overallHealth === "error") {
      title = `${t("status-error")}: ${t("status-kubernetes-status")}`
      body = issueText || t("status-critical-issues-detected")
    } else if (overallHealth === "warning") {
      title = `${t("status-warning")}: ${t("status-kubernetes-status")}`
      body = issueText || t("status-some-issues-detected")
    } else if (overallHealth === "healthy" && previousHealthRef.current !== "healthy") {
      title = `${t("status-healthy")}: ${t("status-kubernetes-status")}`
      body = t("status-all-systems-operational")
    }

    if (title) {
      sendLocalNotification(title, {
        body,
        icon: createFavicon(overallHealth),
        // eslint-disable-next-line i18next/no-literal-string
        tag: "status-change",
      })
    }

    previousHealthRef.current = overallHealth
  }, [overallHealth, systemHealthDetailed?.issues, notificationsEnabled, sendLocalNotification, t])

  const statusText = useMemo(() => {
    return {
      healthy: t("status-healthy"),
      warning: t("status-warning"),
      error: t("status-error"),
    }
  }, [t])

  useFavicon({
    favicon: createFavicon(overallHealth),
    title: `${statusText[overallHealth]} | ${document.location.hostname}`,
    // eslint-disable-next-line i18next/no-literal-string
    defaultFavicon: "/favicon.ico",
    defaultTitle: t("status-kubernetes-status"),
  })

  return (
    <div
      className={css`
        padding: 2rem;
      `}
    >
      <div
        className={css`
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        `}
      >
        <h1
          className={css`
            margin: 0;
          `}
        >
          {t("status-kubernetes-status")}
        </h1>
        {notificationsSupported && (
          <Button
            variant={notificationsEnabled ? "secondary" : "tertiary"}
            size="medium"
            onClick={toggleNotifications}
          >
            {notificationsEnabled
              ? t("status-notifications-enabled")
              : permissionDeniedMessage
                ? permissionDeniedMessage
                : t("status-enable-notifications")}
          </Button>
        )}
      </div>

      <StatusSummary />

      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 3rem;
        `}
      >
        <div>
          <h2
            className={css`
              margin-bottom: 1rem;
            `}
          >
            {t("status-pods")}
          </h2>
          <StatusPods />
        </div>

        <div>
          <h2
            className={css`
              margin-bottom: 1rem;
            `}
          >
            {t("status-deployments")}
          </h2>
          <StatusDeployments />
        </div>

        <div>
          <h2
            className={css`
              margin-bottom: 1rem;
            `}
          >
            {t("status-cronjobs")}
          </h2>
          <StatusCronJobs />
        </div>

        <div>
          <h2
            className={css`
              margin-bottom: 1rem;
            `}
          >
            {t("status-jobs")}
          </h2>
          <StatusJobs />
        </div>

        <div>
          <h2
            className={css`
              margin-bottom: 1rem;
            `}
          >
            {t("status-services")}
          </h2>
          <StatusServices />
        </div>

        <div>
          <h2
            className={css`
              margin-bottom: 1rem;
            `}
          >
            {t("status-events")}
          </h2>
          <StatusEvents />
        </div>

        <div>
          <h2
            className={css`
              margin-bottom: 1rem;
            `}
          >
            {t("status-ingresses")}
          </h2>
          <StatusIngresses />
        </div>
      </div>
    </div>
  )
}

export default withSignedIn(StatusPage)
