import { css } from "@emotion/css"
import { ApartmentBuilding, Gear } from "@vectopus/atlas-icons-react"
import { useRouter } from "next/router"
import React from "react"
import { useTranslation } from "react-i18next"

import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import {
  manageOrganizationRoute,
  organizationFrontPageRoute,
} from "@/shared-module/common/utils/routes"

type Props = {
  organization: {
    id: string
    name: string
    slug: string
    hidden?: boolean
  }
}

const OrganizationBanner: React.FC<Props> = ({ organization }) => {
  const { t } = useTranslation()
  const router = useRouter()

  return (
    <div
      key={organization.id}
      aria-label={organization.name}
      className={css`
        padding: 0em 0.4em;
        color: #656565;

        &:focus-visible > div {
          outline: 2px solid ${baseTheme.colors.green[500]};
          outline-offset: 2px;
        }

        &:focus {
          outline: none;
        }

        ${respondToOrLarger.lg} {
          padding: 0em 1em;
        }
      `}
    >
      <div
        className={css`
          display: flex;
          align-items: center;
          justify-content: space-between;
          background-color: rgb(255, 255, 255);
          padding: 0.25rem 0.5rem;
          gap: 0.3rem;
          width: 100%;

          ${respondToOrLarger.lg} {
            height: 3.5rem;
            padding: 0.5rem 1rem;
            gap: 0.5rem;
          }
        `}
      >
        <OrganizationIcon />
        <OrganizationText name={organization.name} hidden={organization.hidden} />
        <div
          className={css`
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-left: auto;
            margin-right: 1rem;
          `}
        >
          <OnlyRenderIfPermissions
            action={{ type: "create_courses_or_exams" }}
            resource={{ type: "organization", id: organization.id }}
          >
            <button
              type="button"
              onClick={() => router.push(manageOrganizationRoute(organization.id))}
              aria-label={t("label-manage-organization", {
                name: organization.name,
                defaultValue: `Manage organization ${organization.name}`,
              })}
              className={css`
                width: 25px;
                height: 25px;
                border-radius: 50%;
                background-color: rgba(237, 238, 240, 1);
                border: none;
                margin-right: 0.5rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                text-decoration: none;

                &:hover {
                  background-color: rgb(216, 216, 216);
                }
              `}
            >
              <Gear
                className={css`
                  width: 14px;
                  height: 13px;
                  color: rgba(26, 35, 51, 1);
                `}
              />
            </button>
          </OnlyRenderIfPermissions>

          <button
            type="button"
            onClick={() => router.push(organizationFrontPageRoute(organization.slug))}
            aria-label={t("label-visit-organization", { name: organization.name })}
            className={css`
              background-color: rgba(237, 238, 240, 1);
              color: rgba(26, 35, 51, 1);
              border: none;
              border-radius: 0px;
              padding: 0.4rem 0.8rem;
              font-family: ${primaryFont};
              font-size: 18px;
              line-height: 100%;
              letter-spacing: 0;
              cursor: pointer;
              text-decoration: none;
              display: inline-block;

              &:hover {
                transition: background-color 0.3s;
                background-color: rgb(216, 216, 216);
              }
            `}
          >
            {t("label-select")}
          </button>
        </div>
      </div>
    </div>
  )
}

const OrganizationIcon: React.FC = () => (
  <div
    className={css`
      background: #1a2333;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 27px;
      min-width: 27px;
      height: 26px;
      padding: 4px;
      border-radius: 2px;
      margin-left: 0rem;

      ${respondToOrLarger.lg} {
        margin-left: 0.75rem;
      }
    `}
  >
    <ApartmentBuilding
      className={css`
        width: 21px;
        height: 20px;
        color: white;
        display: block;
        margin: auto;
        object-fit: contain;
        padding: 1px;
      `}
    />
  </div>
)

const OrganizationText: React.FC<{ name: string; hidden?: boolean }> = ({ name, hidden }) => {
  const { t } = useTranslation()

  return (
    <div
      className={css`
        flex-grow: 1;
        min-width: 0;
        padding: 0.5rem 0.5rem;

        ${respondToOrLarger.lg} {
          padding: 0.5rem 1rem;
        }
      `}
    >
      <h2
        className={css`
          color: ${hidden ? "#666" : "#333"};
          font-family: ${primaryFont};
          font-size: 15px;
          line-height: 1.1;
          text-transform: capitalize;
          opacity: 1;

          ${respondToOrLarger.lg} {
            font-size: 18px;
            line-height: 1.3;
          }
        `}
      >
        {name} {hidden ? `(${t("label-hidden")})` : ""}
      </h2>
    </div>
  )
}

export default OrganizationBanner
