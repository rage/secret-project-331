"use client"
import { css } from "@emotion/css"
import axios from "axios"
import React from "react"
import { useTranslation } from "react-i18next"

import useAllOrganizationsQuery from "../../../../hooks/useAllOrganizationsQuery"

import CreateOrganizationPopup from "./CreateOrganizationPopup"
import OrganizationBanner from "./components/OrganizationBanner"

import Button from "@/shared-module/common/components/Button"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { primaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

const OrganizationsList: React.FC = () => {
  const { t } = useTranslation()
  const [showCreatePopup, setShowCreatePopup] = React.useState(false)
  const { refetch } = useAllOrganizationsQuery()

  const allOrganizationsQuery = useAllOrganizationsQuery()

  const createOrganizationMutation = useToastMutation(
    async (data: { name: string; slug: string; visibility: string }) => {
      return await axios.post("/api/v0/main-frontend/organizations", {
        name: data.name,
        slug: data.slug,
        description: "",
        hidden: data.visibility === "private",
      })
    },
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: () => {
        setShowCreatePopup(false)
        refetch()
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

      {allOrganizationsQuery.isError && (
        <ErrorBanner variant={"readOnly"} error={allOrganizationsQuery.error} />
      )}
      {allOrganizationsQuery.isLoading && <Spinner variant={"medium"} />}
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
          {allOrganizationsQuery.data.map((organization) => (
            <OrganizationBanner key={organization.id} organization={organization} />
          ))}
        </div>
      )}
      <CreateOrganizationPopup
        show={showCreatePopup}
        onClose={() => setShowCreatePopup(false)}
        onCreate={({ name, slug, visibility }) => {
          createOrganizationMutation.mutate({
            name,
            slug: slug.trim().toLowerCase().replace(/\s+/g, "-"),
            visibility,
          })
        }}
      />

      <DebugModal data={allOrganizationsQuery.data} />
    </div>
  )
}

export default OrganizationsList
