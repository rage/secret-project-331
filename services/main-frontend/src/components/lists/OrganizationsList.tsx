import { css } from "@emotion/css"
import Link from "next/link"
import React from "react"
import { useQuery } from "react-query"

import { fetchOrganizations } from "../../services/backend/organizations"
import DebugModal from "../../shared-module/components/DebugModal"
import UHNoBG from "../../shared-module/img/uh_without_background.svg"
import { wideWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
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
                width: 100%;
                height: 185px;
                display: flex;
                align-items: center;
                background-color: rgb(216, 216, 216, 0.7);
                margin-bottom: 1em;
                &:hover {
                  cursor: pointer;
                  background-color: rgb(216, 216, 216);
                }
              `}
            >
              <div
                className={css`
                  width: 20%;
                  background: #b5b5b5;
                  height: 100%;
                  display: flex;
                  align-items: center;
                `}
              >
                {/* <img src={organization.organization_image_url} /> */}
                <UHNoBG
                  className={css`
                    margin: 0 auto;
                    display: block;
                  `}
                />
              </div>
              <div
                className={css`
                  width: 80%;
                  margin: 1em 1em;
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
          </Link>
        ))}
      </div>
      <DebugModal data={data} />
    </div>
  )
}

export default OrganizationsList
