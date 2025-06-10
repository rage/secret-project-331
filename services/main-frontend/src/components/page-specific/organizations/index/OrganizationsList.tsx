import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import useAllOrganizationsQuery from "../../../../hooks/useAllOrganizationsQuery"

import OrganizationBanner from "./components/OrganizationBanner"

import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { primaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

const OrganizationsList: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()

  const allOrganizationsQuery = useAllOrganizationsQuery()

  return (
    <div
      className={css`
        margin: 1em 0;
      `}
    >
      <h1
        className={css`
          text-align: center;
          font-family: ${primaryFont};
          font-weight: 500;
          font-size: 30px;
          line-height: 100%;
          letter-spacing: 0;
          margin: 2em 0em 0.5em 0em;
          color: #333;
        `}
      >
        {t("organizations-heading")}
      </h1>
      <p
        className={css`
          text-align: center;
          font-family: ${primaryFont};
          font-size: 16px;
          line-height: 100%;
          letter-spacing: 0;
          margin-bottom: 2.5rem;
          color: #555;
        `}
      >
        {t("select-organization")}
      </p>
      {allOrganizationsQuery.isError && (
        <ErrorBanner variant={"readOnly"} error={allOrganizationsQuery.error} />
      )}
      {allOrganizationsQuery.isPending && <Spinner variant={"medium"} />}
      {allOrganizationsQuery.isSuccess && (
        <div
          className={css`
            background-color: rgba(26, 35, 51, 0.05);
            padding: 0.5rem 0rem;
            border-radius: 0.5rem;
            width: 95vw;
            position: relative;
            left: 50%;
            right: 50%;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            gap: 0.5em;

            ${respondToOrLarger.lg} {
              width: auto;
              max-width: 900px;
              left: auto;
              right: auto;
              transform: none;
              margin: 2rem auto;
              padding: 2rem 1rem;
            }
          `}
        >
          {allOrganizationsQuery.data.map((organization) => (
            <OrganizationBanner key={organization.id} organization={organization} />
          ))}
        </div>
      )}
      <DebugModal data={allOrganizationsQuery.data} />
    </div>
  )
}

export default OrganizationsList
