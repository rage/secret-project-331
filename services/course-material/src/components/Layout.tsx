import { css } from "@emotion/css"
import Head from "next/head"
import { useRouter } from "next/router"
import React, { ReactNode, useContext } from "react"
import { Toaster } from "react-hot-toast"
import { useTranslation } from "react-i18next"

import PageContext from "../contexts/PageContext"
import Centered from "../shared-module/components/Centering/Centered"
import Footer from "../shared-module/components/Footer"
import Navbar from "../shared-module/components/Navigation"
import useMedia from "../shared-module/hooks/useMedia"
import { respondToOrLarger } from "../shared-module/styles/respond"
import basePath from "../shared-module/utils/base-path"

import ScrollIndicator from "./ScrollIndicator"
import SearchDialog from "./SearchDialog"

interface LayoutProps {
  children: ReactNode
  frontPageUrl?: string
  navVariant?: "simple" | "complex"
  faqUrl?: string
  title?: string
  licenseUrl?: string
  returnToPath?: string
  courseSlug?: string
  organizationSlug: string
}

const TOAST_BOTTOM_LEFT = "bottom-left"
const TOAST_BOTTOM_CENTER = "bottom-center"

const Layout: React.FC<LayoutProps> = ({
  children,
  title = "Secret Project 331",
  navVariant,
  frontPageUrl,
  faqUrl,
  licenseUrl,
  returnToPath,
  courseSlug,
  organizationSlug,
}) => {
  const router = useRouter()
  const notMobile = useMedia(respondToOrLarger.xs)
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
        <nav role="navigation" aria-label={t("navigation-menu")}>
          <ScrollIndicator />
          <Navbar
            faqUrl={faqUrl}
            frontPageUrl={frontPageUrl ?? basePath()}
            variant={navVariant ?? "simple"}
            // Return to path can be override per page
            returnToPath={returnToPath ?? returnPath}
          >
            {courseId && courseSlug && (
              <SearchDialog
                courseId={courseId}
                courseSlug={courseSlug}
                organizationSlug={organizationSlug}
              />
            )}
          </Navbar>
        </nav>
        {/* Do not touch flex */}
        <main
          className={css`
            flex: 1;
          `}
        >
          <Centered variant="narrow">{children}</Centered>
        </main>
      </div>
      <div
        className={css`
          margin-top: 2rem;
        `}
      >
        <Toaster position={notMobile ? TOAST_BOTTOM_LEFT : TOAST_BOTTOM_CENTER} />
        <Footer licenseUrl={licenseUrl} />
      </div>
    </>
  )
}

export default Layout
