"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useParams } from "next/navigation"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { createOrganizationGroup, fetchOrganizationGroups } from "@/services/backend/groups"
import { fetchOrganization } from "@/services/backend/organizations"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import {
  manageOrganizationGroupRoute,
  manageOrganizationRoute,
} from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const OrganizationGroupsPage: React.FC = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [newGroupName, setNewGroupName] = useState("")
  const [mutationError, setMutationError] = useState<unknown | null>(null)

  const organizationQuery = useQuery({
    queryKey: ["organization", id, "groups-page"],
    queryFn: () => fetchOrganization(id),
  })
  const groupsQuery = useQuery({
    queryKey: ["organization-groups", id],
    queryFn: () => fetchOrganizationGroups(id),
  })

  const createMutation = useToastMutation(
    () => createOrganizationGroup(id, newGroupName),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        setNewGroupName("")
        setMutationError(null)
        void groupsQuery.refetch()
      },
      onError: setMutationError,
    },
  )

  return (
    <div
      className={css`
        margin-top: 40px;
        ${respondToOrLarger.sm} {
          margin-top: 80px;
        }
      `}
    >
      {mutationError != null && <ErrorBanner variant="readOnly" error={mutationError} />}
      {(organizationQuery.isLoading || groupsQuery.isLoading) && <Spinner variant="large" />}
      {organizationQuery.isError && (
        <ErrorBanner variant="readOnly" error={organizationQuery.error} />
      )}
      {groupsQuery.isError && <ErrorBanner variant="readOnly" error={groupsQuery.error} />}
      {organizationQuery.isSuccess && groupsQuery.isSuccess && (
        <div>
          <div
            className={css`
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 16px;
              flex-wrap: wrap;
            `}
          >
            <div>
              <h1>
                {t("groups-for-organization")} {organizationQuery.data.name}
              </h1>
              <Link href={manageOrganizationRoute(id)}>{t("link-manage-organization")}</Link>
            </div>
          </div>

          {groupsQuery.data.can_create_groups && (
            <div
              className={css`
                margin-top: 1.5rem;
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                align-items: end;
              `}
            >
              <div
                className={css`
                  flex: 1 1 300px;
                `}
              >
                <label
                  htmlFor="new-group-name"
                  className={css`
                    display: block;
                    margin-bottom: 6px;
                    font-size: 14px;
                  `}
                >
                  {t("group-name")}
                </label>
                <input
                  id="new-group-name"
                  value={newGroupName}
                  onChange={(event) => setNewGroupName(event.target.value)}
                  className={css`
                    width: 100%;
                    border: 1px solid #ced1d7;
                    border-radius: 4px;
                    padding: 10px 12px;
                  `}
                  placeholder={t("group-name-placeholder")}
                />
              </div>
              <Button
                variant="primary"
                size="medium"
                onClick={() => createMutation.mutate()}
                disabled={!newGroupName.trim()}
              >
                {t("create-group")}
              </Button>
            </div>
          )}

          {!groupsQuery.data.can_create_groups && (
            <p
              className={css`
                margin-top: 1rem;
              `}
            >
              {t("group-list-membership-only-note")}
            </p>
          )}

          <div
            className={css`
              margin-top: 1.5rem;
            `}
          >
            {groupsQuery.data.groups.length === 0 && <p>{t("no-groups-found")}</p>}
            {groupsQuery.data.groups.length > 0 && (
              <div
                className={css`
                  display: grid;
                  gap: 10px;
                `}
              >
                {groupsQuery.data.groups.map((group) => (
                  <Link
                    key={group.id}
                    href={manageOrganizationGroupRoute(id, group.id)}
                    className={css`
                      display: block;
                      padding: 14px 16px;
                      border-radius: 6px;
                      background: #f5f6f7;
                      color: inherit;
                      text-decoration: none;
                      border: 1px solid transparent;

                      &:hover {
                        border-color: #ced1d7;
                      }
                    `}
                  >
                    <strong>{group.name}</strong>
                    <div
                      className={css`
                        opacity: 0.75;
                        font-size: 14px;
                        margin-top: 4px;
                      `}
                    >
                      {group.id}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(OrganizationGroupsPage))
