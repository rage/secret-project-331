import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { ExclamationTriangle, Gear } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import {
  fetchSuspectedCheaters,
  postNewThreshold,
} from "../../../../../../services/backend/course-instances"

import { ThresholdData } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, headingFont } from "@/shared-module/common/styles"

const Header = styled.div`
  width: 100%;
`

const CourseCheaters: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()

  const [points, setPoints] = useState<number>()
  const [duration, setDuration] = useState<number>()

  const suspectedCheaters = useQuery({
    queryKey: [`suspected-cheaters-${courseId}`],
    queryFn: () => fetchSuspectedCheaters(courseId),
  })

  const handleCreateNewThreshold = async () => {
    if (!points) {
      console.log("Invalid Threshold")
      return
    }

    let convertedDuration

    if (duration) {
      //Convert duration from hours to seconds
      convertedDuration = duration * 3600
    }

    const threshold = {
      points: points,
      duration_seconds: convertedDuration ?? 0,
    }

    return postThresholdMutation.mutate(threshold)
  }

  const postThresholdMutation = useToastMutation(
    (threshold: ThresholdData) => postNewThreshold(courseId, threshold),
    {
      notify: true,
      successMessage: t("threshold-added-successfully"),
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
      <h1
        className={css`
          font-size: clamp(2rem, 3.6vh, 36px);
          color: ${baseTheme.colors.gray[700]};
          font-family: ${headingFont};
          font-weight: bold;
        `}
      >
        {t("suspected-cheater")}
      </h1>
      <div
        className={css`
          min-height: 9.375rem;
          border: 1px solid #cdcdcd;
          border-radius: 4px;
          margin: 1.25rem 0 2.5rem 0;
          padding: 1.245rem;

          .heading {
            display: flex;
            align-items: center;
            font-weight: 500;
            svg {
              margin-right: 5px;
            }
          }

          .description {
            color: #707070;
            margin-bottom: 0.625rem;
          }

          .points-threshold {
            width: 10rem;
            margin-bottom: 1.25rem;
            margin-right: 1.25rem;
          }

          .duration-threshold {
            width: 10rem;
            margin-bottom: 1.25rem;
          }

          .threshold-btn {
            margin-top: 0.5rem;
          }
        `}
      >
        <Header>
          <h5 className="heading">
            <Gear size={16} weight="bold" />
            {t("configure-threshold")}
          </h5>
          <p className="description">{t("configure-threshold-description")}</p>
        </Header>
        <div
          className={css`
            display: flex;
          `}
        >
          <TextField
            className="points-threshold"
            type="number"
            label={t("points")}
            placeholder={t("points")}
            value={points?.toString() ?? ""}
            onChangeByValue={(value: string) => {
              const parsed = parseInt(value)
              if (isNaN(parsed)) {
                setPoints(undefined)
                return
              }
              setPoints(parsed)
            }}
          />
          <TextField
            className="duration-threshold"
            type="number"
            label={t("duration-in-hours")}
            placeholder={t("duration")}
            value={duration?.toString() ?? ""}
            onChangeByValue={(value: string) => {
              const parsed = parseInt(value)
              if (isNaN(parsed)) {
                setDuration(undefined)
                return
              }
              setDuration(parsed)
            }}
          />
        </div>
        <Button
          className="threshold-btn"
          variant="primary"
          size="medium"
          disabled={(!points && !duration) || postThresholdMutation.isPending}
          onClick={handleCreateNewThreshold}
        >
          {t("set-threshold")}
        </Button>
      </div>
      <h5
        className={css`
          font-weight: 500;
          margin-bottom: 0.8rem;
        `}
      >
        {t("cheaters-list")}
      </h5>
      {suspectedCheaters.isPending && (
        <ErrorBanner variant={"readOnly"} error={suspectedCheaters.error} />
      )}
      {suspectedCheaters.isError && <Spinner variant={"medium"} />}
      {suspectedCheaters.isSuccess && suspectedCheaters.data.length ? (
        <table
          id="cheaters-table"
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
          </tr>
          {suspectedCheaters.data?.map(({ id, total_points, total_duration_seconds }, index) => {
            const everySecondListItem = index % 2 === 1
            return (
              <tr
                key={id}
                className={css`
                  background: ${everySecondListItem ? "#ffffff" : "#F5F6F7"};
                `}
              >
                <td>{id}</td>
                <td>{total_points}</td>
                <td>{total_duration_seconds}</td>
              </tr>
            )
          })}
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

export default CourseCheaters
