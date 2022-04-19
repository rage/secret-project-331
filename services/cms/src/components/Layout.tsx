import { css } from "@emotion/css"
import dynamic from "next/dynamic"
import Head from "next/head"
import { useRouter } from "next/router"
import React, { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import Centered from "../shared-module/components/Centering/Centered"
import Footer from "../shared-module/components/Footer"
import LoginControls from "../shared-module/components/LoginControls"
import { Menu, NavBar } from "../shared-module/components/Navigation/NavBar"
import SkipLink from "../shared-module/components/SkipLink"
import { respondToOrLarger } from "../shared-module/styles/respond"

import EditorBreadcrumbs from "./breadcrumbs/EditorBreadcrumbs"

export const SIDEBAR_WIDTH_PX = 350

type LayoutProps = {
  children: ReactNode
  navVariant?: "simple" | "complex"
  faqUrl?: string
  title?: string
  licenseUrl?: string
  returnToPath?: string
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
}) => {
  const router = useRouter()
  // eslint-disable-next-line i18next/no-literal-string
  const returnPath = `/login?return_to=${encodeURIComponent(
    process.env.NEXT_PUBLIC_BASE_PATH + router.asPath,
  )}`

  const { t } = useTranslation()

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
          height: 100%;
          min-height: 100vh;
        `}
      >
        <SkipLink href="#maincontent">{t("skip-to-content")}</SkipLink>
        <NavBar
          faqUrl={faqUrl}
          variant={navVariant ?? "simple"}
          // Return to path can be override per page
          returnToPath={returnToPath ?? returnPath}
        >
          <Menu>
            <LoginControls returnToPath={returnToPath} />
          </Menu>
        </NavBar>
        {/* Do not touch flex */}
        <main
          className={css`
            /* Sidebar hidden on small screens */
            margin-right: 0;
            ${respondToOrLarger.xl} {
              /* Sidebar visible screens */
              margin-right: ${SIDEBAR_WIDTH_PX}px;
            }
          `}
          id="maincontent"
        >
          <Centered variant="narrow">
            <EditorBreadcrumbs />
            {children}
          </Centered>
        </main>
      </div>
      <DynamicToaster />
      <Footer licenseUrl={licenseUrl} />
    </>
  )
}

export default Layout
