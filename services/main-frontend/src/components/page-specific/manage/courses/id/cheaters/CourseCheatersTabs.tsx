"use client"
import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { ExclamationTriangle } from "@vectopus/atlas-icons-react"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  approveSuspectedCheaters,
  archiveSuspectedCheaters,
  fetchSuspectedCheaters,
} from "@/services/backend/courses"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, headingFont } from "@/shared-module/common/styles"

interface CourseCheatersProps {
  courseId: string
  archive: boolean
  perPage: number
}

const CourseCheaterTabs: React.FC<React.PropsWithChildren<CourseCheatersProps>> = ({
  courseId,
  archive,
}) => {
  const { t } = useTranslation()

  const suspectedCheaters = useQuery({
    queryKey: [`suspected-cheaters-${courseId}-${archive}`],
    queryFn: () => fetchSuspectedCheaters(courseId, archive),
  })

  const handleApproval = useToastMutation(
    (id: string) => {
      if (!id) {
        throw Error("Student ID undefined")
      }

      return approveSuspectedCheaters(courseId, id)
    },
    {
      notify: true,
      successMessage: t("suspect-approved-successfully"),
      method: "POST",
    },
    {
      onSuccess: () => {
        suspectedCheaters.refetch()
      },
    },
  )

  const handleArchive = useToastMutation(
    (id: string) => {
      if (!id) {
        throw Error("Student ID undefined")
      }

      return archiveSuspectedCheaters(courseId, id)
    },
    {
      notify: true,
      successMessage: t("suspect-archived-successfully"),
      method: "POST",
    },
    {
      onSuccess: () => {
        suspectedCheaters.refetch()
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
        {archive ? t("deleted-cheaters-list") : t("cheaters-list")}
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
          aria-label={archive ? t("deleted-cheaters-list") : t("cheaters-list")}
        >
          <caption
            className={css`
              text-align: left;
              font-weight: 600;
              margin-bottom: 0.5rem;
              caption-side: top;
            `}
          >
            {archive ? t("deleted-cheaters-list") : t("cheaters-list")}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t("student-id")}</th>
              <th scope="col">{t("points")}</th>
              <th scope="col">{t("duration")}</th>
              {!archive && <th scope="col">{t("actions")}</th>}
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
                        href={{
                          pathname: "/manage/users/[userId]",
                          query: { userId: user_id },
                        }}
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
                    {!archive && (
                      <td>
                        <Button
                          className="threshold-btn"
                          variant="primary"
                          size="medium"
                          onClick={() => handleApproval.mutate(user_id)}
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
                          onClick={() => handleArchive.mutate(user_id)}
                          aria-label={t("confirm-cheating-for-student", {
                            action: t("clear-suspicion"),
                            label: t("student-id"),
                            id: user_id,
                          })}
                        >
                          {t("clear-suspicion")}
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
