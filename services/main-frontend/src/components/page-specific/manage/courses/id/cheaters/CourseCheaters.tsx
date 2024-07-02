import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { Gear } from "@vectopus/atlas-icons-react"
import { useRouter } from "next/router"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import {
  fetchSuspectedCheaters,
  postNewThreshold,
} from "../../../../../../services/backend/courses"

import CourseCheatersTabs from "./CourseCheatersTabs"

import { ThresholdData } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import TabLink from "@/shared-module/common/components/Navigation/TabLinks/TabLink"
import TabLinkNavigation from "@/shared-module/common/components/Navigation/TabLinks/TabLinkNavigation"
import TabLinkPanel from "@/shared-module/common/components/Navigation/TabLinks/TabLinkPanel"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { SimplifiedUrlQuery } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"

interface CourseCheatersProps extends CourseManagementPagesProps {
  query: SimplifiedUrlQuery<"id">
}

const Header = styled.div`
  width: 100%;
`

const CourseCheaters: React.FC<React.PropsWithChildren<CourseCheatersProps>> = ({ courseId }) => {
  const [archive, setArchive] = useState(true)
  const { t } = useTranslation()
  const router = useRouter()

  useEffect(() => {
    if (router.query.archive) {
      setArchive(router.query.archive === "true")
    }
  }, [router.query.archive])

  const [points, setPoints] = useState<number>()
  const [duration, setDuration] = useState<number>()

  const suspectedCheaters = useQuery({
    queryKey: [`suspected-cheaters-${courseId}-${archive}`],
    queryFn: () => fetchSuspectedCheaters(courseId, archive),
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
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <TabLinkNavigation>
        <TabLink
          url={{ pathname: router.pathname, query: { ...router.query, archive: true } }}
          isActive={archive}
          // countHook={createPendingChangeRequestCountHook(courseId)}
        >
          {t("cheaters")}
        </TabLink>
        <TabLink
          url={{ pathname: router.pathname, query: { ...router.query, archive: false } }}
          isActive={!archive}
        >
          {t("archived")}
        </TabLink>
      </TabLinkNavigation>
      {/* TODO: Dropdown for perPage? */}
      <TabLinkPanel>
        <CourseCheatersTabs courseId={courseId} archive={archive} perPage={4} />
      </TabLinkPanel>
    </>
  )
}

export default CourseCheaters
