import { css } from "@emotion/css"
import dynamic from "next/dynamic"
import Head from "next/head"
import { useRouter } from "next/router"
import React, { ReactNode, useContext } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "../contexts/PageContext"
import Centered from "../shared-module/components/Centering/Centered"
import Footer from "../shared-module/components/Footer"
import Navbar from "../shared-module/components/Navigation"
import SkipLink from "../shared-module/components/SkipLink"

import ScrollIndicator from "./ScrollIndicator"
import SearchDialog from "./SearchDialog"
import UserNavigationControls from "./navigation/UserNavigationControls"

interface LayoutProps {
  children: ReactNode
  navVariant?: "simple" | "complex"
  faqUrl?: string
  title?: string
  licenseUrl?: string
  returnToPath?: string
  courseSlug?: string
  organizationSlug: string
}

const DynamicToaster = dynamic(
  () => import("../shared-module/components/Notifications/ToasterNotifications"),
  { ssr: false },
)

const Layout: React.FC<LayoutProps> = ({
  children,
  title = process.env.NEXT_PUBLIC_SITE_TITLE ?? "Secret Project 331",
  navVariant,
  faqUrl,
  licenseUrl,
  returnToPath,
  courseSlug,
  organizationSlug,
}) => {
  const router = useRouter()
  const { t } = useTranslation()
  // eslint-disable-next-line i18next/no-literal-string
  const returnPath = `/login?return_to=${encodeURIComponent(
    process.env.NEXT_PUBLIC_BASE_PATH + router.asPath,
  )}`
  const pageContext = useContext(PageContext)

  const courseId = pageContext?.pageData?.course_id
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>
      <div
        // Push footer to bottom of page, e.g. on empty body
        className={css`
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 100vh;
        `}
      >
        <SkipLink href="#maincontent">{t("skip-to-content")}</SkipLink>
        <ScrollIndicator />
        <Navbar
          faqUrl={faqUrl}
          variant={navVariant ?? "simple"}
          SearchDialogComponent={
            courseId &&
            courseSlug && (
              <SearchDialog
                courseId={courseId}
                courseSlug={courseSlug}
                organizationSlug={organizationSlug}
              />
            )
          }
        >
          <UserNavigationControls returnToPath={returnToPath ?? returnPath} courseId={courseId} />
        </Navbar>

        {/* Do not touch flex */}
        <main
          className={css`
            flex: 1;
          `}
          id="maincontent"
        >
          <Centered variant="narrow">{children}</Centered>
        </main>
      </div>
      <div
        className={css`
          margin-top: 2rem;
        `}
      >
        <DynamicToaster />
        <Footer licenseUrl={licenseUrl} />
      </div>
    </>
  )
}

export default Layout
