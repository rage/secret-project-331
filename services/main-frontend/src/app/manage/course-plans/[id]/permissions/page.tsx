"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { XmarkCircle } from "@vectopus/atlas-icons-react"
import { useParams } from "next/navigation"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  addCoursePlanMemberMutation,
  getCoursePlanMembersOptions,
  removeCoursePlanMemberMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type { PlanMemberWithDetails } from "@/generated/api/types.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, QueryResult, TextField } from "@/shared-module/components"

const ADD_MEMBER_FIELD = "email" as const

type AddMemberFormValues = {
  email: string
}

/** Returns member display name, or em dash when both names are empty. */
function formatPlanMemberDisplayName(
  member: Pick<PlanMemberWithDetails, "first_name" | "last_name">,
) {
  if (!member.first_name && !member.last_name) {
    // oxlint-disable-next-line i18next/no-literal-string -- empty name placeholder
    return "—"
  }

  const first = member.first_name ?? ""
  const last = member.last_name ?? ""
  return `${first} ${last}`.trim()
}

const pageStyles = css`
  max-width: 900px;
  margin: 2.5rem auto;
  padding: 0 1.25rem 3rem;

  ${respondToOrLarger.md} {
    padding: 0 1.75rem 3rem;
  }
`

const titleStyles = css`
  font-size: 1.75rem;
  font-weight: 700;
  color: ${baseTheme.colors.gray[900]};
  margin: 0 0 1.5rem 0;
`

const addFormStyles = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  align-items: center;
  margin-bottom: 2rem;

  ${respondToOrLarger.sm} {
    grid-template-columns: minmax(0, 1fr) auto;
  }
`

const emailFieldStyles = css`
  flex: 1 1 16rem;
  min-width: 0;
`

const memberListStyles = css`
  display: flex;
  flex-direction: column;
`

const memberRowStyles = css`
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.5fr) auto;
  gap: 1.5rem;
  align-items: center;
  padding: 0.85rem 0;
  border-bottom: 1px solid ${baseTheme.colors.gray[200]};
`

const memberHeaderOnlyStyles = css`
  font-size: 0.85rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[500]};
  padding-top: 0;
`

const memberNameStyles = css`
  font-size: 0.95rem;
  color: ${baseTheme.colors.gray[800]};
`

const memberEmailStyles = css`
  font-size: 0.95rem;
  color: ${baseTheme.colors.gray[800]};
  overflow-wrap: anywhere;
`

const memberActionStyles = css`
  justify-self: end;
`

const emptyStateStyles = css`
  margin: 0;
  color: ${baseTheme.colors.gray[500]};
  font-size: 0.95rem;
`

const CoursePlanPermissionsPage: React.FC = () => {
  const { t } = useTranslation()
  const { id: planId } = useParams<{ id: string }>()
  const [mutationError, setMutationError] = useState<unknown | null>(null)
  const { control, handleSubmit, reset, watch } = useForm<AddMemberFormValues>({
    defaultValues: { email: "" },
  })
  const email = watch(ADD_MEMBER_FIELD) ?? ""

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
        reset()
        membersQuery.refetch()
        setMutationError(null)
      },
      onError: setMutationError,
    },
  )

  const removeMutation = useToastMutationOptions(
    removeCoursePlanMemberMutation(),
    { notify: true, method: "DELETE" },
    {
      onSuccess: () => {
        membersQuery.refetch()
        setMutationError(null)
      },
      onError: setMutationError,
    },
  )

  const normalizedMutationError =
    mutationError instanceof Error ? mutationError : new Error(String(mutationError))

  const handleAddMember = handleSubmit(({ email: memberEmail }) => {
    addMutation.mutate({
      path: { plan_id: planId },
      body: { email: memberEmail.trim() },
    })
  })

  return (
    <div className={pageStyles}>
      <h1 className={titleStyles}>{t("course-plan-permissions-title")}</h1>

      {mutationError != null && <ErrorBanner variant="readOnly" error={normalizedMutationError} />}

      <form className={addFormStyles} onSubmit={handleAddMember}>
        <TextField
          id="new-member-email"
          name={ADD_MEMBER_FIELD}
          control={control}
          label={t("label-email")}
          placeholder={t("field-enter-email")}
          type="email"
          autoComplete="email"
          className={emailFieldStyles}
        />
        <Button
          type="submit"
          variant="primary"
          size="medium"
          disabled={addMutation.isPending || email.trim().length === 0}
          isLoading={addMutation.isPending}
        >
          {t("label-add-user")}
        </Button>
      </form>

      <QueryResult
        query={membersQuery}
        emptyFallback={<p className={emptyStateStyles}>{t("no-roles-found")}</p>}
      >
        {(members) => (
          <div className={memberListStyles}>
            <div className={cx(memberRowStyles, memberHeaderOnlyStyles)}>
              <span>{t("text-field-label-name")}</span>
              <span>{t("label-email")}</span>
              <span className={memberActionStyles}>{t("label-action")}</span>
            </div>
            {members.map((member) => (
              <div className={memberRowStyles} key={member.user_id}>
                <span className={memberNameStyles}>{formatPlanMemberDisplayName(member)}</span>
                <span className={memberEmailStyles}>{member.email}</span>
                <div className={memberActionStyles}>
                  <Button
                    type="button"
                    variant="icon"
                    size="small"
                    aria-label={t("remove-role")}
                    disabled={removeMutation.isPending}
                    onClick={() =>
                      removeMutation.mutate({
                        path: { plan_id: planId, user_id: member.user_id },
                      })
                    }
                  >
                    <XmarkCircle size={18} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(CoursePlanPermissionsPage))
