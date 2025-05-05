import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import useAllOrganizationsQuery from "../../../../hooks/useAllOrganizationsQuery"

import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import UHNoBG from "@/shared-module/common/img/uh_without_background.svg"
import { baseTheme, typography } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { organizationCoursesPageHref } from "@/shared-module/common/utils/cross-routing"

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
          font-family: Inter;
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
          font-family: Inter;
          font-weight: 400;
          font-size: 16px;
          line-height: 100%;
          letter-spacing: 0;
          margin-bottom: 2.5rem;
          color: #555;
        `}
      >
        {t("select-organization", { defaultValue: "Select an organization" })}
      </p>
      {allOrganizationsQuery.isError && (
        <ErrorBanner variant={"readOnly"} error={allOrganizationsQuery.error} />
      )}
      {allOrganizationsQuery.isPending && <Spinner variant={"medium"} />}
      {allOrganizationsQuery.isSuccess && (
        <div
          className={css`
            background-color: rgba(26, 35, 51, 0.05);
            padding: 2rem 1rem;
            border-radius: 0.5rem;
            margin: 2rem auto;
            max-width: 900px;
          `}
        >
          {allOrganizationsQuery.data.map((organization) => (
            <div
              key={organization.id}
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
                  background-color: rgb(255, 255, 255);
                  margin-bottom: 0.5em;

                  ${respondToOrLarger.lg} {
                    height: 3.5rem;
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
                    justify-content: center;
                    width: 27px;
                    min-width: 27px;
                    height: 26px;
                    padding: 0;
                    margin-left: 0.75rem;

                    ${respondToOrLarger.lg} {
                      width: 27px;
                      height: 26px;
                    }
                  `}
                >
                  {organization.organization_image_url ? (
                    <img
                      alt={organization.name}
                      className={css`
                        width: auto;
                        height: auto;
                        display: block;
                        object-fit: contain;
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
                      font-family: Inter;
                      font-weight: 400;
                      font-size: 18px;
                      line-height: 100%;
                      letter-spacing: 0;
                      text-transform: uppercase;
                    `}
                  >
                    {organization.name}
                  </h2>
                </div>
                <button
                  onClick={() =>
                    (window.location.href = organizationCoursesPageHref(organization.slug))
                  }
                  className={css`
                    margin-left: auto;
                    margin-right: 1rem;
                    background-color: rgba(237, 238, 240, 1);
                    color: rgba(26, 35, 51, 1);
                    border: none;
                    border-radius: 0px;
                    padding: 0.4rem 0.8rem;
                    font-family: Inter;
                    font-weight: 400;
                    font-size: 18px;
                    line-height: 100%;
                    letter-spacing: 0;
                    cursor: pointer;
                    &:hover {
                      background-color: rgb(216, 216, 216);
                      cursor: pointer;
                    }
                  `}
                >
                  {t("Select", { defaultValue: "Select" })}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <DebugModal data={allOrganizationsQuery.data} />
    </div>
  )
}

export default OrganizationsList
