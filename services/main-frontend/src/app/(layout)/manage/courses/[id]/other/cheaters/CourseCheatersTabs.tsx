"use client"

import { css } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ExclamationTriangle } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import { LINK_QUIET } from "@/components/credit-registration/constants"
import {
  getCourseFlaggedSuspectedCheatersCountQueryKey,
  getCourseSuspectedCheatersOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  confirmCourseSuspectedCheater,
  dismissCourseSuspectedCheater,
} from "@/generated/api/sdk.generated"
import type { SuspectedCheaterStatus } from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme } from "@/shared-module/common/styles"
import { courseUserStatusSummaryRoute } from "@/shared-module/common/utils/routes"
import { Button, Link, QueryResult, Table, useDialog } from "@/shared-module/components"

interface CourseCheatersProps {
  courseId: string
  status: SuspectedCheaterStatus
}

const CourseCheaterTabs: React.FC<React.PropsWithChildren<CourseCheatersProps>> = ({
  courseId,
  status,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { confirm } = useDialog()

  // Each tab can move a student to the other states. Confirm is offered on the flagged and
  // dismissed tabs; dismiss on the flagged and confirmed tabs. (On the flagged tab both apply.)
  const canConfirm = status === "Flagged" || status === "Dismissed"
  const canDismiss = status === "Flagged" || status === "ConfirmedCheating"
  const showActions = canConfirm || canDismiss

  const listTitle =
    status === "ConfirmedCheating"
      ? t("confirmed-cheaters-list")
      : status === "Dismissed"
        ? t("dismissed-cheaters-list")
        : t("cheaters-list")

  const suspectedCheaters = useQuery({
    ...getCourseSuspectedCheatersOptions({
      path: {
        course_id: courseId,
      },
      query: {
        status,
      },
    }),
  })

  // Confirm and dismiss move the student to a different status. Refetch this list (the student
  // leaves it) and invalidate the flagged-count badge (course tabs) and overview review banner,
  // which are owned by other components. The destination tab is a separate route that refetches on
  // navigation, so it does not need explicit invalidation here.
  const handleActionSuccess = () => {
    suspectedCheaters.refetch()
    queryClient.invalidateQueries({
      queryKey: getCourseFlaggedSuspectedCheatersCountQueryKey({
        path: { course_id: courseId },
      }),
    })
  }

  const handleConfirm = useToastMutation(
    (id: string) => {
      if (!id) {
        throw new Error("Student ID undefined")
      }

      return confirmCourseSuspectedCheater({
        path: {
          course_id: courseId,
          user_id: id,
        },
      })
    },
    {
      notify: true,
      successMessage: t("cheating-confirmed-successfully"),
      method: "POST",
    },
    { onSuccess: handleActionSuccess },
  )

  const handleDismiss = useToastMutation(
    (id: string) => {
      if (!id) {
        throw new Error("Student ID undefined")
      }

      return dismissCourseSuspectedCheater({
        path: {
          course_id: courseId,
          user_id: id,
        },
      })
    },
    {
      notify: true,
      successMessage: t("suspicion-dismissed-successfully"),
      method: "POST",
    },
    { onSuccess: handleActionSuccess },
  )

  // Confirming fails the student, so always ask first.
  const onConfirmClick = async (userId: string) => {
    const confirmed = await confirm({
      message: t("confirm-cheating-dialog-message"),
      title: t("confirm-cheating-dialog-title"),
    })
    if (confirmed) {
      handleConfirm.mutate(userId)
    }
  }

  // Dismissing from the confirmed tab un-fails the student and restores their grade, so ask first.
  // Dismissing a still-flagged student is harmless and fires directly.
  const onDismissClick = async (userId: string) => {
    if (status === "ConfirmedCheating") {
      const confirmed = await confirm({
        message: t("dismiss-from-confirmed-dialog-message"),
        title: t("dismiss-suspicion"),
      })
      if (!confirmed) {
        return
      }
    }
    handleDismiss.mutate(userId)
  }

  return (
    <>
      <h5
        className={css`
          font-weight: 500;
          margin-bottom: 0.8rem;
        `}
      >
        {listTitle}
      </h5>
      <QueryResult
        query={suspectedCheaters}
        emptyFallback={
          <div
            className={css`
              background: #e4e5e6;
              padding: 1.25rem;
              text-align: center;
              display: flex;
              justify-content: center;
              align-items: center;
              border-radius: 6px;
              color: ${baseTheme.colors.gray[700]};

              span {
                margin-left: 0.4rem;
              }
            `}
          >
            <div>
              <ExclamationTriangle size={16} weight="bold" aria-hidden="true" />
              <span>{t("list-cheaters-of-cheaters-empty-state")}</span>
            </div>
          </div>
        }
      >
        {(data) => (
          <Table
            caption={listTitle}
            showCaption
            rows={data}
            rowKey={(row) => row.user_id}
            columns={[
              {
                header: t("student-id"),
                cell: ({ user_id }) => (
                  <Link
                    href={courseUserStatusSummaryRoute(courseId, user_id)}
                    appearance={LINK_QUIET}
                    aria-label={`${t("student-id")}: ${user_id}`}
                  >
                    {user_id}
                  </Link>
                ),
              },
              { header: t("points"), cell: ({ total_points }) => total_points },
              {
                header: t("duration"),
                cell: ({ total_duration_seconds }) => {
                  const durationHours = total_duration_seconds
                    ? Math.round((total_duration_seconds / 3600) * 10) / 10
                    : 0
                  const durationText = total_duration_seconds
                    ? `${durationHours} ${t("hours")} (${total_duration_seconds} ${t("seconds")})`
                    : `0 ${t("hours")}`
                  return (
                    <span aria-label={`${t("duration")}: ${durationText}`}>
                      {total_duration_seconds
                        ? `${durationHours}${t("hours-short")}`
                        : `0${t("hours-short")}`}
                    </span>
                  )
                },
              },
              ...(showActions
                ? [
                    {
                      header: t("actions"),
                      cell: ({ user_id }: { user_id: string }) => (
                        <>
                          {canConfirm && (
                            <Button
                              className="threshold-btn"
                              variant="primary"
                              size="medium"
                              onClick={() => onConfirmClick(user_id)}
                              aria-label={t("confirm-cheating-for-student", {
                                action: t("confirm-cheating"),
                                label: t("student-id"),
                                id: user_id,
                              })}
                            >
                              {t("confirm-cheating")}
                            </Button>
                          )}
                          {canDismiss && (
                            <Button
                              className="threshold-btn"
                              variant="secondary"
                              size="medium"
                              onClick={() => onDismissClick(user_id)}
                              aria-label={t("confirm-cheating-for-student", {
                                action: t("dismiss-suspicion"),
                                label: t("student-id"),
                                id: user_id,
                              })}
                            >
                              {t("dismiss-suspicion")}
                            </Button>
                          )}
                        </>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </QueryResult>
    </>
  )
}

export default CourseCheaterTabs
