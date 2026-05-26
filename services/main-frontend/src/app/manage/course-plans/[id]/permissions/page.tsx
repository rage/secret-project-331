"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { XmarkCircle } from "@vectopus/atlas-icons-react"
import { useParams } from "next/navigation"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  addCoursePlanMemberMutation,
  getCoursePlanMembersOptions,
  removeCoursePlanMemberMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type { PlanMemberWithDetails } from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

/** Returns member display name, or em dash when both names are empty. */
function formatPlanMemberDisplayName(
  member: Pick<PlanMemberWithDetails, "first_name" | "last_name">,
) {
  if (!member.first_name && !member.last_name) {
    // eslint-disable-next-line i18next/no-literal-string -- empty name placeholder
    return "—"
  }

  const first = member.first_name ?? ""

  const last = member.last_name ?? ""

  return `${first} ${last}`.trim()
}

const CoursePlanPermissionsPage: React.FC = () => {
  const { t } = useTranslation()
  const { id: planId } = useParams<{ id: string }>()
  const [newEmail, setNewEmail] = useState("")
  const [mutationError, setMutationError] = useState<unknown | null>(null)

  const membersQuery = useQuery({
    ...getCoursePlanMembersOptions({
      path: { plan_id: planId },
    }),
  })

  const addMutation = useToastMutationOptions(
    addCoursePlanMemberMutation(),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        setNewEmail("")
        membersQuery.refetch()
      },
      onError: setMutationError,
    },
  )

  const removeMutation = useToastMutationOptions(
    removeCoursePlanMemberMutation(),
    { notify: true, method: "DELETE" },
    {
      onSuccess: () => membersQuery.refetch(),
      onError: setMutationError,
    },
  )

  return (
    <div
      className={css`
        max-width: 900px;
        margin: 40px auto;
        padding: 0 2rem;
      `}
    >
      <h1>{t("course-plan-permissions-title")}</h1>

      {mutationError && <ErrorBanner variant="readOnly" error={mutationError} />}

      <div
        className={css`
          display: flex;
          align-items: flex-end;
          gap: 1rem;
          margin-top: 2rem;
          margin-bottom: 1rem;
        `}
      >
        <div
          className={css`
            flex: 1;
          `}
        >
          <TextField
            id="new-member-email"
            label={t("label-email")}
            placeholder={t("field-enter-email")}
            value={newEmail}
            onChangeByValue={(value) => setNewEmail(value)}
          />
        </div>
        <Button
          variant="primary"
          size="medium"
          onClick={() =>
            addMutation.mutate({
              path: { plan_id: planId },
              body: { email: newEmail },
            })
          }
          disabled={addMutation.isPending || newEmail.trim().length === 0}
        >
          {t("label-add-user")}
        </Button>
      </div>

      {membersQuery.isLoading && <Spinner variant="large" />}
      {membersQuery.isError && <ErrorBanner variant="readOnly" error={membersQuery.error} />}
      {membersQuery.isSuccess && membersQuery.data.length === 0 && <p>{t("no-roles-found")}</p>}
      {membersQuery.isSuccess && membersQuery.data.length > 0 && (
        <table
          className={css`
            width: 100%;
            border-spacing: 0 10px;
            margin-top: 1rem;
            th {
              font-weight: 500;
              opacity: 0.7;
              text-align: left;
            }
            th:not(:first-child),
            td:not(:first-child) {
              padding-left: 40px;
            }
          `}
        >
          <thead>
            <tr>
              <th>{t("text-field-label-name")}</th>
              <th>{t("label-email")}</th>
              <th>{t("label-action")}</th>
            </tr>
          </thead>
          <tbody>
            {membersQuery.data.map((member) => (
              <tr
                className={css`
                  td {
                    padding-top: 14px;
                    padding-bottom: 14px;
                    background: #f5f6f7;
                    font-size: 16px;
                    color: #1a2333;
                  }
                  td:first-child {
                    padding-left: 20px;
                    border-radius: 4px 0 0 4px;
                  }
                  td:last-child {
                    padding-right: 20px;
                    border-radius: 0 4px 4px 0;
                  }
                `}
                key={member.user_id}
              >
                <td>{formatPlanMemberDisplayName(member)}</td>
                <td>{member.email}</td>
                <td>
                  <button
                    aria-label={t("remove-role")}
                    className={css`
                      cursor: pointer;
                      background: transparent;
                      border: 0;
                    `}
                    onClick={() =>
                      removeMutation.mutate({
                        path: { plan_id: planId, user_id: member.user_id },
                      })
                    }
                  >
                    <XmarkCircle size={20} color="#1A2333" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(CoursePlanPermissionsPage))
