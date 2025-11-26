import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import StatusCronJobs from "../components/page-specific/status/StatusCronJobs"
import StatusDeployments from "../components/page-specific/status/StatusDeployments"
import StatusEvents from "../components/page-specific/status/StatusEvents"
import StatusIngresses from "../components/page-specific/status/StatusIngresses"
import StatusJobs from "../components/page-specific/status/StatusJobs"
import StatusPods from "../components/page-specific/status/StatusPods"
import StatusServices from "../components/page-specific/status/StatusServices"
import StatusSummary from "../components/page-specific/status/StatusSummary"

import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"

const StatusPage: React.FC = () => {
  const { t } = useTranslation()
  return (
    <div
      className={css`
        padding: 2rem;
      `}
    >
      <h1
        className={css`
          margin-bottom: 2rem;
        `}
      >
        {t("status-kubernetes-status")}
      </h1>

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
