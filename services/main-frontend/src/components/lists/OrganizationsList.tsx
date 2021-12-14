import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchOrganizations } from "../../services/backend/organizations"
import DebugModal from "../../shared-module/components/DebugModal"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import Spinner from "../../shared-module/components/Spinner"
import UHNoBG from "../../shared-module/img/uh_without_background.svg"
import { wideWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import { respondToOrLarger } from "../../shared-module/styles/respond"
import { organizationCoursesPageHref } from "../../shared-module/utils/cross-routing"

const OrganizationsList: React.FC = () => {
  const { t } = useTranslation()
  const getOrganizations = useQuery(`organizations`, () => fetchOrganizations(), {
    cacheTime: 60000,
  })

  return (
    <div
      className={css`
        margin: 1em 0;
        ${wideWidthCenteredComponentStyles}
      `}
    >
      <h1
        className={css`
          text-align: center;
          font-weight: 600;
          font-size: 3em;
          margin: 2em 0em;
          color: #656565;
        `}
      >
        {t("organizations-heading")}
      </h1>
      {getOrganizations.isError && (
        <ErrorBanner variant={"readOnly"} error={getOrganizations.error} />
      )}
      {getOrganizations.isLoading && <Spinner variant={"medium"} />}
      {getOrganizations.isSuccess && (
        <div
          className={css`
            margin-bottom: 1rem;
          `}
        >
          {getOrganizations.data.map((organization) => (
            <a
              key={organization.id}
              href={organizationCoursesPageHref(organization.slug)}
              aria-label={organization.name}
              className={css`
                padding: 0em 1em;
                text-decoration: none;
                color: #656565;
              `}
            >
              <div
                className={css`
                  flex-direction: column;
                  display: flex;
                  align-items: center;
                  background-color: rgb(216, 216, 216, 0.7);
                  margin-bottom: 1em;
                  &:hover {
                    cursor: pointer;
                    background-color: rgb(216, 216, 216);
                  }
                  ${respondToOrLarger.lg} {
                    flex-direction: row;
                    max-height: 15rem;
                  }
                `}
              >
                <div
                  className={css`
                    background: #b5b5b5;
                    display: flex;
                    align-items: center;
                    width: 100%;
                    padding: 1em 1em;
                    ${respondToOrLarger.lg} {
                      width: 20%;
                      height: 10rem;
                    }
                  `}
                >
                  {organization.organization_image_url ? (
                    <img
                      alt={organization.name}
                      className={css`
                        margin: 0 auto;
                        display: block;
                        max-height: 10rem;
                      `}
                      src={organization.organization_image_url}
                    />
                  ) : (
                    <UHNoBG
                      className={css`
                        margin: 0 auto;
                        display: block;
                      `}
                    />
                  )}
                </div>
                <div
                  className={css`
                    width: 80%;
                    margin: 1em;
                  `}
                >
                  <h2
                    className={css`
                      color: #656565;
                      font-weight: 600;
                      font-size: 1.5em;
                    `}
                  >
                    {organization.name}
                  </h2>
                  <span>{organization.description}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
      <DebugModal data={getOrganizations.data} />
    </div>
  )
}

export default OrganizationsList
