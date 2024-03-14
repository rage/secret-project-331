import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import useAllOrganizationsQuery from "../../../../hooks/useAllOrganizationsQuery"
import DebugModal from "../../../../shared-module/components/DebugModal"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import UHNoBG from "../../../../shared-module/img/uh_without_background.svg"
import { baseTheme, typography } from "../../../../shared-module/styles"
import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import { organizationCoursesPageHref } from "../../../../shared-module/utils/cross-routing"

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
          font-weight: 600;
          font-size: ${typography.h2};
          margin: 2em 0em 1em 0em;
          color: #333;
        `}
      >
        {t("organizations-heading")}
      </h1>
      {allOrganizationsQuery.isError && (
        <ErrorBanner variant={"readOnly"} error={allOrganizationsQuery.error} />
      )}
      {allOrganizationsQuery.isPending && <Spinner variant={"medium"} />}
      {allOrganizationsQuery.isSuccess && (
        <div
          className={css`
            margin-bottom: 1rem;
          `}
        >
          {allOrganizationsQuery.data.map((organization) => (
            <a
              key={organization.id}
              href={organizationCoursesPageHref(organization.slug)}
              aria-label={organization.name}
              className={css`
                padding: 0em 1em;
                text-decoration: none;
                color: #656565;

                &:focus-visible > div {
                  outline: 2px solid ${baseTheme.colors.green[500]};
                  outline-offset: 2px;
                }

                &:focus {
                  outline: none;
                }
              `}
            >
              <div
                className={css`
                  flex-direction: column;
                  display: flex;
                  align-items: center;
                  background-color: #f5f6f7;
                  margin-bottom: 1em;

                  &:hover {
                    cursor: pointer;
                    background-color: #ebedee;
                  }
                  ${respondToOrLarger.lg} {
                    height: 15rem;
                    flex-direction: row;
                    max-height: 20rem;
                  }
                `}
              >
                <div
                  className={css`
                    background: #1a2333;
                    display: flex;
                    align-items: center;
                    width: 100%;
                    height: auto;
                    padding: 1em 1em;
                    ${respondToOrLarger.lg} {
                      width: 20%;
                      height: 100%;
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
                    padding: 0.5rem 1rem;
                  `}
                >
                  <h2
                    className={css`
                      color: #333;
                      font-weight: 600;
                      font-size: clamp(1.4rem, 3vw, 1.8rem);
                      text-transform: uppercase;
                    `}
                  >
                    {organization.name}
                  </h2>
                  <span
                    className={css`
                      font-size: clamp(16px, 2vw, 20px);
                      color: #333;
                      opacity: 0.8;
                    `}
                  >
                    {organization.description}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
      <DebugModal data={allOrganizationsQuery.data} />
    </div>
  )
}

export default OrganizationsList
