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
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { courseUserStatusSummaryRoute } from "@/shared-module/common/utils/routes"

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

  // Only students still awaiting review can be acted on; the confirmed and dismissed
  // lists are read-only.
  const showActions = status === "Flagged"

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

  const handleConfirm = useToastMutation(
    (id: string) => {
      if (!id) {
        throw Error("Student ID undefined")
      }

      return confirmCourseSuspectedCheater({
        path: {
          course_id: courseId,
          id,
        },
      })
    },
    {
      notify: true,
      successMessage: t("cheating-confirmed-successfully"),
      method: "POST",
    },
    {
      onSuccess: () => {
        suspectedCheaters.refetch()
        // The acted-on student leaves the flagged set, so refresh the flagged-count badge
        // (course tabs) and the overview review banner, which are owned by other components.
        queryClient.invalidateQueries({
          queryKey: getCourseFlaggedSuspectedCheatersCountQueryKey({
            path: { course_id: courseId },
          }),
        })
      },
    },
  )

  const handleDismiss = useToastMutation(
    (id: string) => {
      if (!id) {
        throw Error("Student ID undefined")
      }

      return dismissCourseSuspectedCheater({
        path: {
          course_id: courseId,
          id,
        },
      })
    },
    {
      notify: true,
      successMessage: t("suspicion-dismissed-successfully"),
      method: "POST",
    },
    {
      onSuccess: () => {
        suspectedCheaters.refetch()
        // The acted-on student leaves the flagged set, so refresh the flagged-count badge
        // (course tabs) and the overview review banner, which are owned by other components.
        queryClient.invalidateQueries({
          queryKey: getCourseFlaggedSuspectedCheatersCountQueryKey({
            path: { course_id: courseId },
          }),
        })
      },
    },
  )

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
      {suspectedCheaters.isLoading && <Spinner variant={"medium"} />}
      {suspectedCheaters.isError && (
        <ErrorBanner variant={"readOnly"} error={suspectedCheaters.error} />
      )}
      {suspectedCheaters.isSuccess && suspectedCheaters.data.length ? (
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
            {suspectedCheaters.data?.map(
              ({ user_id, total_points, total_duration_seconds }, index) => {
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
                        <Button
                          className="threshold-btn"
                          variant="primary"
                          size="medium"
                          onClick={() => handleConfirm.mutate(user_id)}
                          aria-label={t("confirm-cheating-for-student", {
                            action: t("confirm-cheating"),
                            label: t("student-id"),
                            id: user_id,
                          })}
                        >
                          {t("confirm-cheating")}
                        </Button>
                        <Button
                          className="threshold-btn"
                          variant="secondary"
                          size="medium"
                          onClick={() => handleDismiss.mutate(user_id)}
                          aria-label={t("confirm-cheating-for-student", {
                            action: t("dismiss-suspicion"),
                            label: t("student-id"),
                            id: user_id,
                          })}
                        >
                          {t("dismiss-suspicion")}
                        </Button>
                      </td>
                    )}
                  </tr>
                )
              },
            )}
          </tbody>
        </table>
      ) : (
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
      )}
    </>
  )
}

export default CourseCheaterTabs
