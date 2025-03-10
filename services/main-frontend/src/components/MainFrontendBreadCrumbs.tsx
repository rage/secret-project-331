import { css } from "@emotion/css"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import useCourseBreadcrumbInfoQuery from "../hooks/useCourseBreadcrumbInfoQuery"
import useOrganizationQueryBySlug from "../hooks/useOrganizationQueryBySlug"

import Breadcrumbs, { BreadcrumbPiece } from "@/shared-module/common/components/Breadcrumbs"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import { PageMarginOffset } from "@/shared-module/common/components/layout/PageMarginOffset"
import { MARGIN_BETWEEN_NAVBAR_AND_CONTENT } from "@/shared-module/common/utils/constants"
import {
  exerciseRoute,
  manageCourseRoute,
  organizationFrontPageRoute,
} from "@/shared-module/common/utils/routes"

interface MainFrontendBreadCrumbsProps {
  organizationSlug: string | null
  courseId: string | null
  exerciseName?: string
  exerciseId?: string
  exerciseUrl?: string
  additionalPieces?: BreadcrumbPiece[]
}

const MainFrontendBreadCrumbs: React.FC<MainFrontendBreadCrumbsProps> = ({
  organizationSlug,
  courseId,
  exerciseName,
  exerciseId,
  exerciseUrl,
  additionalPieces = [],
}) => {
  const { t } = useTranslation()

  const organizationQuery = useOrganizationQueryBySlug(organizationSlug)

  const courseQuery = useCourseBreadcrumbInfoQuery(courseId)

  const courseName = courseQuery.data?.course_name
  const courseQueryOrganizationSlug = courseQuery.data?.organization_slug
  const organizationName = organizationQuery.data?.name ?? courseQuery.data?.organization_name

  const pieces: BreadcrumbPiece[] = useMemo(() => {
    const pieces = [{ text: t("home"), url: "/" }]
    if (organizationSlug !== null) {
      pieces.push({
        text: organizationName ?? organizationSlug,
        url: organizationFrontPageRoute(organizationSlug),
      })
    }
    if (courseId !== null) {
      if (organizationSlug === null) {
        pieces.push({
          text: organizationName ?? "",
          url: organizationFrontPageRoute(courseQueryOrganizationSlug ?? ""),
        })
      }
      pieces.push({ text: courseName ?? courseId, url: manageCourseRoute(courseId) })
    }
    if (exerciseName) {
      pieces.push({
        text: exerciseName,
        url: exerciseUrl ?? (exerciseId ? exerciseRoute(exerciseId) : ""),
      })
    }

    // Add any additional pieces
    pieces.push(...additionalPieces)

    return pieces
  }, [
    courseId,
    courseName,
    courseQueryOrganizationSlug,
    organizationName,
    organizationSlug,
    t,
    exerciseName,
    exerciseId,
    exerciseUrl,
    additionalPieces,
  ])

  return (
    <div
      className={css`
        margin-bottom: ${MARGIN_BETWEEN_NAVBAR_AND_CONTENT};
      `}
    >
      <BreakFromCentered sidebar={false}>
        <PageMarginOffset marginTop={`-${MARGIN_BETWEEN_NAVBAR_AND_CONTENT}`} marginBottom={"0rem"}>
          <Breadcrumbs pieces={pieces} />
        </PageMarginOffset>
      </BreakFromCentered>
    </div>
  )
}

export default MainFrontendBreadCrumbs
