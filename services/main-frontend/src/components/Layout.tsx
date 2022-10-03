import { css } from "@emotion/css"
import dynamic from "next/dynamic"
import Head from "next/head"
import { useRouter } from "next/router"
import React, { ReactNode } from "react"

import Centered from "../shared-module/components/Centering/Centered"
import Footer from "../shared-module/components/Footer"
import LanguageSelection from "../shared-module/components/LanguageSelection"
import LoginControls from "../shared-module/components/LoginControls"
import {
  NavBar,
  NavContainer,
  NavItem,
  NavItems,
} from "../shared-module/components/Navigation/NavBar"
import Menu from "../shared-module/components/Navigation/NavBar/Menu/Menu"

const LANGUAGE_SELECTION_PLACEMENTPLACEMENT = "bottom-end"

type LayoutProps = {
  children: ReactNode
  navVariant?: "simple" | "complex"
  faqUrl?: string
  title?: string
  licenseUrl?: string
}

const DynamicToaster = dynamic(
  () => import("../shared-module/components/Notifications/ToasterNotifications"),
  { ssr: false },
)

const Layout: React.FC<React.PropsWithChildren<LayoutProps>> = ({
  children,
  title = process.env.NEXT_PUBLIC_SITE_TITLE ?? "Secret Project 331",
  navVariant,
  licenseUrl,
}) => {
  const router = useRouter()

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
        <NavBar
          // faqUrl={faqUrl}
          variant={navVariant ?? "simple"}
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
      <DynamicToaster />
      <Footer licenseUrl={licenseUrl} />
    </>
  )
}

export default Layout
