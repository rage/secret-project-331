"use client"

import { css } from "@emotion/css"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ExclamationTriangle } from "@vectopus/atlas-icons-react"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  getCourseFlaggedSuspectedCheatersCountQueryKey,
  getCourseSuspectedCheatersOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  confirmCourseSuspectedCheater,
  dismissCourseSuspectedCheater,
} from "@/generated/api/sdk.generated"
import type { SuspectedCheaterStatus } from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { courseUserStatusSummaryRoute } from "@/shared-module/common/utils/routes"
import { QueryResult } from "@/shared-module/components"

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
    const confirmed = await confirm(
      t("confirm-cheating-dialog-message"),
      t("confirm-cheating-dialog-title"),
    )
    if (confirmed) {
      handleConfirm.mutate(userId)
    }
  }

  // Dismissing from the confirmed tab un-fails the student and restores their grade, so ask first.
  // Dismissing a still-flagged student is harmless and fires directly.
  const onDismissClick = async (userId: string) => {
    if (status === "ConfirmedCheating") {
      const confirmed = await confirm(
        t("dismiss-from-confirmed-dialog-message"),
        t("dismiss-suspicion"),
      )
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
          <table
            id="cheaters"
            className={css`
              width: 100%;
              margin-top: 0.4rem;
              text-align: left;
              border-collapse: collapse;
              font-family: ${headingFont};
              border: 1px solid ${baseTheme.colors.gray[100]};

              th {
                color: ${baseTheme.colors.gray[500]};
                padding: 0.4rem 0;
                font-weight: 600;
                font-size: 15px;
                border-bottom: 1px solid ${baseTheme.colors.gray[100]};
                padding: 0.8rem;
              }

              td {
                color: ${baseTheme.colors.gray[500]};
                padding: 0.4rem 0;
                font-size: 18px;
                padding: 0.8rem;
              }
            `}
            aria-label={listTitle}
          >
            <caption
              className={css`
                text-align: left;
                font-weight: 600;
                margin-bottom: 0.5rem;
                caption-side: top;
              `}
            >
              {listTitle}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t("student-id")}</th>
                <th scope="col">{t("points")}</th>
                <th scope="col">{t("duration")}</th>
                {showActions && <th scope="col">{t("actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {data.map(({ user_id, total_points, total_duration_seconds }, index) => {
                const everySecondListItem = index % 2 === 1
                const durationHours = total_duration_seconds
                  ? Math.round((total_duration_seconds / 3600) * 10) / 10
                  : 0
                const durationText = total_duration_seconds
                  ? `${durationHours} ${t("hours")} (${total_duration_seconds} ${t("seconds")})`
                  : `0 ${t("hours")}`
                return (
                  <tr
                    key={user_id}
                    className={css`
                      background: ${everySecondListItem ? "#ffffff" : "#F5F6F7"};
                    `}
                  >
                    <td>
                      <Link
                        href={courseUserStatusSummaryRoute(courseId, user_id)}
                        className={css`
                          text-decoration: none;
                        `}
                        aria-label={`${t("student-id")}: ${user_id}`}
                      >
                        {user_id}
                      </Link>
                    </td>
                    <td>{total_points}</td>
                    <td>
                      <span aria-label={`${t("duration")}: ${durationText}`}>
                        {total_duration_seconds
                          ? `${durationHours}${t("hours-short")}`
                          : `0${t("hours-short")}`}
                      </span>
                    </td>
                    {showActions && (
                      <td>
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
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </QueryResult>
    </>
  )
}

export default CourseCheaterTabs
