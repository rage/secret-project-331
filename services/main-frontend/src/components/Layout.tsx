import { css } from "@emotion/css"
import dynamic from "next/dynamic"
import Head from "next/head"
import { useRouter } from "next/router"
import React, { ReactNode } from "react"

import Centered from "@/shared-module/common/components/Centering/Centered"
import Footer from "@/shared-module/common/components/Footer"
import LanguageSelection from "@/shared-module/common/components/LanguageSelection"
import LoginControls from "@/shared-module/common/components/LoginControls"
import {
  NavBar,
  NavContainer,
  NavItem,
  NavItems,
} from "@/shared-module/common/components/Navigation/NavBar"
import Menu from "@/shared-module/common/components/Navigation/NavBar/Menu/Menu"
import withNoSsr from "@/shared-module/common/utils/withNoSsr"

const LANGUAGE_SELECTION_PLACEMENTPLACEMENT = "bottom-end"

type LayoutProps = {
  children: ReactNode
  noVisibleLayout?: boolean
}

const DynamicToaster = dynamic(
  () => import("@/shared-module/common/components/Notifications/ToasterNotifications"),
  { ssr: false },
)

const Layout: React.FC<React.PropsWithChildren<LayoutProps>> = ({
  children,
  noVisibleLayout = false,
}) => {
  const router = useRouter()
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
        <NavBar
          // faqUrl={faqUrl}
          variant={"simple"}
          // Return to path can be override per page
          // returnToPath={returnToPath ?? returnPath}
        >
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
