"use client"

import { css } from "@emotion/css"
import { skipToken, useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { usePathname } from "next/navigation"
import React, { ReactNode } from "react"

import Topbar from "./Topbar"

import { getCourseMaterialPrivacyLink } from "@/generated/course-material-api/sdk.generated"
import Centered from "@/shared-module/common/components/Centering/Centered"
import Footer from "@/shared-module/common/components/Footer"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import withNoSsr from "@/shared-module/common/utils/withNoSsr"
import { currentCourseIdAtom } from "@/state/course-material/selectors"
import { organizationSlugAtom } from "@/state/layoutAtoms"

type LayoutProps = {
  children: ReactNode
  noVisibleLayout?: boolean
}

const DynamicToaster = dynamicImport<Record<string, never>>(
  () => import("@/shared-module/common/components/Notifications/ToasterNotifications"),
)

const Layout: React.FC<React.PropsWithChildren<LayoutProps>> = ({
  children,
  noVisibleLayout = false,
}) => {
  const pathname = usePathname()
  const courseId = useAtomValue(currentCourseIdAtom)
  const organizationSlug = useAtomValue(organizationSlugAtom)

  const getPrivacyLink = useQuery({
    queryKey: ["privacy-link", courseId],
    queryFn: courseId
      ? () =>
          getCourseMaterialPrivacyLink({
            path: {
              course_id: courseId,
            },
          })
      : skipToken,
    enabled: !!courseId,
  })

  const customPrivacyLinks =
    getPrivacyLink.isSuccess && Array.isArray(getPrivacyLink.data)
      ? getPrivacyLink.data.map((link) => ({
          linkTitle: link.title,
          linkUrl: link.url,
        }))
      : []

  const visibleLayout = noVisibleLayout ? (
    <>{children}</>
  ) : (
    <>
      <div
        // Push footer to bottom of page, e.g. on empty body
        className={css`
          height: 100%;
          min-height: 100vh;
        `}
      >
        <Topbar
          courseId={courseId}
          organizationSlug={organizationSlug}
          currentPagePath={pathname}
        />

        <main id="maincontent">
          <Centered variant="default">{children}</Centered>
        </main>
      </div>
      <Footer privacyLinks={customPrivacyLinks} />
    </>
  )

  return (
    <>
      {visibleLayout}
      <DynamicToaster />
    </>
  )
}

export default withNoSsr(Layout)
