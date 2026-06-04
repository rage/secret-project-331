"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import CreateOrganizationPopup from "./CreateOrganizationPopup"
import OrganizationBanner from "./components/OrganizationBanner"

import { createOrganizationMutation as createOrganizationMutationOptions } from "@/generated/api/@tanstack/react-query.generated"
import useAllOrganizationsQuery from "@/hooks/useAllOrganizationsQuery"
import Button from "@/shared-module/common/components/Button"
import DebugModal from "@/shared-module/common/components/DebugModal"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { primaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { QueryResult } from "@/shared-module/components"

const OrganizationsList: React.FC = () => {
  const { t } = useTranslation()
  const [showCreatePopup, setShowCreatePopup] = React.useState(false)
  const allOrganizationsQuery = useAllOrganizationsQuery()

  const createOrganizationMutation = useToastMutationOptions(
    createOrganizationMutationOptions(),
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: async () => {
        setShowCreatePopup(false)
        await allOrganizationsQuery.refetch()
      },
    },
  )

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
      <OnlyRenderIfPermissions
        action={{ type: "create_courses_or_exams" }}
        resource={{ type: "global_permissions" }}
      >
        <div
          className={css`
            display: flex;
            justify-content: center;
            margin-bottom: 2rem;
          `}
        >
          <Button
            variant="primary"
            size="medium"
            onClick={() => {
              setShowCreatePopup(true)
            }}
          >
            {t("create-a-new-organization")}
          </Button>
        </div>
      </OnlyRenderIfPermissions>

      <QueryResult query={allOrganizationsQuery} treatEmptyAsData>
        {(organizations) => (
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
              margin-bottom: 0.2rem;

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
            {organizations.map((organization) => (
              <OrganizationBanner key={organization.id} organization={organization} />
            ))}
          </div>
        )}
      </QueryResult>
      <CreateOrganizationPopup
        show={showCreatePopup}
        onClose={() => setShowCreatePopup(false)}
        onCreate={({ name, slug, visibility }) => {
          createOrganizationMutation.mutate({
            body: {
              name,
              slug: slug.trim().toLowerCase().replace(/\s+/g, "-"),
              hidden: visibility === "private",
            },
          })
        }}
      />

      <DebugModal data={allOrganizationsQuery.data} />
    </div>
  )
}

export default OrganizationsList
