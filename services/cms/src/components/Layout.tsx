import { css } from "@emotion/css"
import Head from "next/head"
import { useRouter } from "next/router"
import React, { ReactNode } from "react"

import EditorBreadcrumbs from "./breadcrumbs/EditorBreadcrumbs"

import Centered from "@/shared-module/common/components/Centering/Centered"
import Footer from "@/shared-module/common/components/Footer"
import LanguageSelection from "@/shared-module/common/components/LanguageSelection"
import LoginControls from "@/shared-module/common/components/LoginControls"
import {
  Menu,
  NavBar,
  NavContainer,
  NavItem,
  NavItems,
} from "@/shared-module/common/components/Navigation/NavBar"
import { PageMarginOffset } from "@/shared-module/common/components/layout/PageMarginOffset"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { MARGIN_BETWEEN_NAVBAR_AND_CONTENT } from "@/shared-module/common/utils/constants"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import withNoSsr from "@/shared-module/common/utils/withNoSsr"

const LANGUAGE_SELECTION_PLACEMENTPLACEMENT = "bottom-end"
export const SIDEBAR_WIDTH_PX = 350

type LayoutProps = {
  children: ReactNode
  hideBreadcrumbs?: boolean
}

const DynamicToaster = dynamicImport(
  () => import("@/shared-module/common/components/Notifications/ToasterNotifications"),
)

const Layout: React.FC<React.PropsWithChildren<LayoutProps>> = ({
  children,
  hideBreadcrumbs = false,
}) => {
  const router = useRouter()
  // eslint-disable-next-line i18next/no-literal-string
  const title = process.env.NEXT_PUBLIC_SITE_TITLE ?? "Secret Project 331"
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
        <NavBar variant={"simple"}>
          <NavContainer>
            <NavItems>
              <NavItem>
                <LanguageSelection placement={LANGUAGE_SELECTION_PLACEMENTPLACEMENT} />
              </NavItem>
            </NavItems>
          </NavContainer>
          <Menu>
            <LoginControls currentPagePath={router.asPath} />
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
            {!hideBreadcrumbs && (
              <PageMarginOffset
                marginTop={`-${MARGIN_BETWEEN_NAVBAR_AND_CONTENT}`}
                marginBottom={MARGIN_BETWEEN_NAVBAR_AND_CONTENT}
              >
                <EditorBreadcrumbs />
              </PageMarginOffset>
            )}
            {children}
          </Centered>
        </main>
      </div>
      <DynamicToaster />
      <Footer />
    </>
  )
}

export default withNoSsr(Layout)
