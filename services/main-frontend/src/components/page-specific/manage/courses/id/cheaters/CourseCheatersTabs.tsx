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
} from "../../../../../../services/backend/courses"

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
  perPage,
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
      {suspectedCheaters.isPending && (
        <ErrorBanner variant={"readOnly"} error={suspectedCheaters.error} />
      )}
      {suspectedCheaters.isError && <Spinner variant={"medium"} />}
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
        >
          <tr>
            <th>{t("student-id")}</th>
            <th>{t("points")}</th>
            <th>{t("duration")}</th>
            <th>{t("actions")}</th>
          </tr>
          {suspectedCheaters.data?.map(
            ({ user_id, total_points, total_duration_seconds }, index) => {
              const everySecondListItem = index % 2 === 1
              return (
                <tr
                  key={user_id}
                  className={css`
                    background: ${everySecondListItem ? "#ffffff" : "#F5F6F7"};
                  `}
                >
                  <td>
                    {" "}
                    <Link
                      href={{
                        pathname: "/manage/users/[userId]",
                        query: { userId: user_id },
                      }}
                    >
                      {user_id}
                    </Link>
                  </td>
                  <td>{total_points}</td>
                  <td>{total_duration_seconds}</td>
                  {!archive && (
                    <td>
                      <Button
                        className="threshold-btn"
                        variant="primary"
                        size="medium"
                        onClick={() => handleApproval.mutate(user_id)}
                      >
                        {t("approve")}
                      </Button>
                      <Button
                        className="threshold-btn"
                        variant="secondary"
                        size="medium"
                        onClick={() => handleArchive.mutate(user_id)}
                      >
                        {t("delete")}
                      </Button>
                    </td>
                  )}
                </tr>
              )
            },
          )}
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
            <ExclamationTriangle size={16} weight="bold" />
            <span>{t("list-cheaters-of-cheaters-empty-state")}</span>
          </div>
        </div>
      )}
    </>
  )
}

export default CourseCheaterTabs
