import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import useCourseQuery from "../hooks/useCourseQuery"
import useOrganizationQueryBySlug from "../hooks/useOrganizationQueryBySlug"
import { getCourseBreadCrumbInfo } from "../services/backend/courses"
import Breadcrumbs, { BreadcrumbPiece } from "../shared-module/components/Breadcrumbs"
import BreakFromCentered from "../shared-module/components/Centering/BreakFromCentered"
import { PageMarginOffset } from "../shared-module/components/layout/PageMarginOffset"
import { MARGIN_BETWEEN_NAVBAR_AND_CONTENT } from "../shared-module/utils/constants"
import { assertNotNullOrUndefined } from "../shared-module/utils/nullability"
import { manageCourseRoute, organizationFrontPageRoute } from "../shared-module/utils/routes"

interface MainFrontendBreadCrumbsProps {
  organizationSlug: string | null
  courseId: string | null
}

const MainFrontendBreadCrumbs: React.FC<MainFrontendBreadCrumbsProps> = ({
  organizationSlug,
  courseId,
}) => {
  const { t } = useTranslation()

  const organizationQuery = useOrganizationQueryBySlug(organizationSlug)

  const courseQuery = useQuery(
    ["course-breadcrumb-info", courseId],
    () => getCourseBreadCrumbInfo(assertNotNullOrUndefined(courseId)),
    { enabled: !!courseId },
  )
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
    return pieces
  }, [courseId, courseName, courseQueryOrganizationSlug, organizationName, organizationSlug, t])

  return (
    <div
      className={css`
        margin-bottom: ${MARGIN_BETWEEN_NAVBAR_AND_CONTENT};
      `}
    >
      <BreakFromCentered sidebar={false}>
        <PageMarginOffset
          marginTop={`-${MARGIN_BETWEEN_NAVBAR_AND_CONTENT}`}
          // eslint-disable-next-line i18next/no-literal-string
          marginBottom={"0rem"}
        >
          <Breadcrumbs pieces={pieces} />
        </PageMarginOffset>
      </BreakFromCentered>
    </div>
  )
}

export default MainFrontendBreadCrumbs
