"use client"
import { css } from "@emotion/css"
import { useAtomValue } from "jotai"
import Head from "next/head"
import { usePathname } from "next/navigation"
import React, { ReactNode } from "react"

import Topbar from "./Topbar"

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
  // eslint-disable-next-line i18next/no-literal-string
  const title = process.env.NEXT_PUBLIC_SITE_TITLE ?? "Secret Project 331"

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
      <Footer />
    </>
  )

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>
      {visibleLayout}
      <DynamicToaster />
    </>
  )
}

export default withNoSsr(Layout)
