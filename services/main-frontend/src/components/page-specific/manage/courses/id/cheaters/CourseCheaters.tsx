import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { Gear } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import {
  fetchSuspectedCheaters,
  postNewThreshold,
} from "../../../../../../services/backend/course-instances" //
import { ThresholdData } from "../../../../../../shared-module/bindings" //
import Button from "../../../../../../shared-module/components/Button"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import TextField from "../../../../../../shared-module/components/InputFields/TextField"
import Spinner from "../../../../../../shared-module/components/Spinner"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"
import { baseTheme, headingFont, primaryFont } from "../../../../../../shared-module/styles"

const Header = styled.div`
  width: 100%;
`

const cheaters = [
  // eslint-disable-next-line i18next/no-literal-string
  { id: "ed0518ce-11b2-48a3-98f1-377515b57ddf", points: 40, duration: 200 },
  // eslint-disable-next-line i18next/no-literal-string
  { id: "ed0518ce-11b2-48a3-98f1-377515b57ddf", points: 30, duration: 290 },
  // eslint-disable-next-line i18next/no-literal-string
  { id: "ed0518ce-11b2-48a3-98f1-377515b57ddf", points: 6, duration: 195 },
]

const CourseGlossary: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()

  const [points, setPoints] = useState<string>("")
  const [duration, setDuration] = useState<number | null>(null)

  console.log("courseId", courseId)

  const suspectedCheaters = useQuery({
    queryKey: [`suspected-cheaters-${courseId}`],
    queryFn: () => fetchSuspectedCheaters(courseId),
  })

  const handleCreateNewThreshold = async () => {
    if (!points) {
      console.log("Invalid Threshold")
    }

    const threshold = {
      points: Number(points),
      duration_seconds: duration,
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
            width: 160px;
            margin-bottom: 1.25rem;
          }

          .threshold-btn {
            margin-top: 1.25rem;
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
        <TextField
          className="points-threshold"
          type="number"
          label={t("points")}
          placeholder={t("points")}
          value={points}
          onChangeByValue={(value) => setPoints(value)}
        />
        <Button
          className="threshold-btn"
          variant="primary"
          size="medium"
          disabled={points == "" || postThresholdMutation.isPending}
          onClick={handleCreateNewThreshold}
        >
          {t("set-threshold")}
        </Button>
      </div>
      {/* {suspectedCheaters.isError && (
        <ErrorBanner variant={"readOnly"} error={suspectedCheaters.error} />
      )}
      {suspectedCheaters.isPending && <Spinner variant={"medium"} />}
      {suspectedCheaters.isSuccess &&
        suspectedCheaters.data
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((cheater) => {
            return <div key={cheater.id}>{cheater.user_id}</div>
          })} */}
      <h5
        className={css`
          font-weight: 500;
        `}
      >
        {t("cheaters-list")}
      </h5>
      {cheaters && (
        <table
          className={css`
            width: 100%;
            margin-top: 0.4rem;
            text-align: left;
            border-collapse: collapse;
            font-family: ${headingFont};

            tr {
              border-bottom: 2px solid ${baseTheme.colors.gray[100]};
            }

            th {
              color: ${baseTheme.colors.gray[500]};
              padding: 0.4rem 0;
              font-weight: 600;
              font-size: 15px;
            }

            td {
              color: ${baseTheme.colors.gray[400]};
              padding: 0.4rem 0;
              font-size: 18px;
            }
          `}
        >
          <tr>
            <th>{t("student-id")}</th>
            <th>{t("points")}</th>
            <th>{t("duration")}</th>
          </tr>
          {cheaters?.map(({ id, points, duration }) => {
            return (
              <tr key={id}>
                <td>{id}</td>
                <td>{points}</td>
                <td>{duration}</td>
              </tr>
            )
          })}
        </table>
      )}
    </>
  )
}

export default CourseGlossary
