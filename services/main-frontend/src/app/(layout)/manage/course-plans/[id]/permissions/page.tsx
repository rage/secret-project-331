"use client"

import { css, cx } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash } from "@vectopus/atlas-icons-react"
import { useParams, useRouter } from "next/navigation"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { pageTitleCss } from "@/components/credit-registration/styles"
import {
  addCoursePlanMemberMutation,
  getCourseDesignerPlanOptions,
  getCourseDesignerPlansQueryKey,
  getCoursePlanMembersOptions,
  removeCoursePlanMemberMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type { PlanMemberWithDetails } from "@/generated/api/types.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import useUserInfo from "@/shared-module/common/hooks/useUserInfo"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { manageCoursePlansListRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import {
  Badge,
  Button,
  ErrorNotice,
  QueryResult,
  TextField,
  TONE,
  Tooltip,
  useDialog,
} from "@/shared-module/components"

import WeeklyDigestToggle from "./WeeklyDigestToggle"

const ADD_MEMBER_FIELD = "email" as const

interface AddMemberFormValues {
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
  padding-bottom: 3rem;
`

const titleStyles = css`
  margin-bottom: 1.5rem;
`

const addFormStyles = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
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

const memberNameCellStyles = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
`

const memberEmailStyles = css`
  font-size: 0.95rem;
  color: ${baseTheme.colors.gray[800]};
  overflow-wrap: anywhere;
`

const memberActionStyles = css`
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`

const emptyStateStyles = css`
  margin: 0;
  color: ${baseTheme.colors.gray[500]};
  font-size: 0.95rem;
`

const CoursePlanPermissionsPage: React.FC = () => {
  const { t } = useTranslation()
  const { id: planId } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { confirm } = useDialog()
  const userInfo = useUserInfo()
  const currentUserId = userInfo.data?.user_id ?? null
  const planQuery = useQuery(getCourseDesignerPlanOptions({ path: { plan_id: planId } }))
  const creatorUserId = planQuery.data?.plan.created_by_user_id ?? null
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
      onSuccess: async (_data, variables) => {
        setMutationError(null)
        if (variables.path.user_id === currentUserId) {
          await queryClient.invalidateQueries({ queryKey: getCourseDesignerPlansQueryKey() })
          router.push(manageCoursePlansListRoute())
          return
        }
        await membersQuery.refetch()
      },
      onError: setMutationError,
    },
  )

  const removeMember = async (member: PlanMemberWithDetails) => {
    if (member.user_id === currentUserId) {
      const isConfirmed = await confirm({
        title: t("course-plans-leave-plan-confirm-title"),
        message: t("course-plans-leave-plan-confirm-body"),
        confirmLabel: t("course-plans-leave-plan"),
        isDestructive: true,
      })
      if (!isConfirmed) {
        return
      }
    }
    removeMutation.mutate({ path: { plan_id: planId, user_id: member.user_id } })
  }

  /** Why the member cannot be removed, mirroring the backend's protections; `null` when allowed. */
  const removalBlockedReason = (member: PlanMemberWithDetails, memberCount: number) => {
    if (memberCount <= 1) {
      return t("course-plans-remove-member-blocked-last")
    }
    if (member.user_id === creatorUserId && member.user_id !== currentUserId) {
      return t("course-plans-remove-member-blocked-creator")
    }
    return null
  }

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
      <h1 className={cx(pageTitleCss, titleStyles)}>{t("course-plan-permissions-title")}</h1>

      {/* notify:true already announces this error via the toast; the banner is just the persistent copy */}
      {mutationError !== null && mutationError !== undefined && (
        // oxlint-disable-next-line i18next/no-literal-string -- "off" is an ErrorNoticeAnnouncement enum value, not UI text
        <ErrorNotice error={normalizedMutationError} announce="off" />
      )}

      {currentUserId && (
        <QueryResult query={membersQuery}>
          {(members) => {
            const currentMember = members.find((member) => member.user_id === currentUserId)
            return currentMember ? (
              <WeeklyDigestToggle
                planId={planId}
                receivesWeeklyDigest={currentMember.receives_weekly_digest}
              />
            ) : null
          }}
        </QueryResult>
      )}

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
          size="large"
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
            {members.map((member) => {
              const isCurrentUser = member.user_id === currentUserId
              const blockedReason = removalBlockedReason(member, members.length)
              const removeLabel = isCurrentUser
                ? t("course-plans-leave-plan")
                : t("course-plans-remove-member", { name: formatPlanMemberDisplayName(member) })
              const removeButton = (
                <Button
                  type="button"
                  variant="icon"
                  size="small"
                  aria-label={removeLabel}
                  disabled={removeMutation.isPending || blockedReason !== null}
                  onClick={() => void removeMember(member)}
                >
                  <Trash size={18} />
                </Button>
              )
              return (
                <div className={memberRowStyles} key={member.user_id}>
                  <span className={memberNameCellStyles}>
                    <span className={memberNameStyles}>{formatPlanMemberDisplayName(member)}</span>
                    {isCurrentUser && (
                      <Badge tone={TONE.INFO} size="compact">
                        {t("course-plans-member-you")}
                      </Badge>
                    )}
                    {member.user_id === creatorUserId && (
                      <Badge tone={TONE.NEUTRAL} size="compact">
                        {t("course-plans-member-creator")}
                      </Badge>
                    )}
                  </span>
                  <span className={memberEmailStyles}>{member.email}</span>
                  <div className={memberActionStyles}>
                    {blockedReason && (
                      <Tooltip aria-label={t("course-plans-remove-member-blocked-why")}>
                        {blockedReason}
                      </Tooltip>
                    )}
                    {removeButton}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(CoursePlanPermissionsPage))
