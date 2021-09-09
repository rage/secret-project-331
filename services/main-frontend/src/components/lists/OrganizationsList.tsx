import { css } from "@emotion/css"
import Link from "next/link"
import React from "react"
import { useQuery } from "react-query"

import { fetchOrganizations } from "../../services/backend/organizations"
import DebugModal from "../../shared-module/components/DebugModal"
import UHNoBG from "../../shared-module/img/uh_without_background.svg"
import { wideWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import { respondToOrLarger } from "../../shared-module/styles/respond"
import basePath from "../../shared-module/utils/base-path"

const OrganizationsList: React.FC = () => {
  const { isLoading, error, data } = useQuery(`organizations`, () => fetchOrganizations(), {
    cacheTime: 60000,
  })

  if (error) {
    return <div>Error loading organizations.</div>
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

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
          color: #707070;
        `}
      >
        Organizations
      </h1>
      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        {data.map((organization) => (
          <Link
            key={organization.id}
            href={{
              pathname: `${basePath()}/organizations/[id]`,
              query: { id: organization.id },
            }}
            aria-label={organization.name}
          >
            <div
              className={css`
                padding: 0em 1em;
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
                        max-width: 10rem;
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
                      color: #707070;
                      font-weight: 600;
                      font-size: 1.5em;
                    `}
                  >
                    {organization.name}
                  </h2>
                  <span>{organization.description}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <DebugModal data={data} />
    </div>
  )
}

export default OrganizationsList
