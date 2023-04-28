import { css } from "@emotion/css"
import dynamic from "next/dynamic"
import Head from "next/head"
import { useRouter } from "next/router"
import React, { ReactNode, useContext } from "react"

import PageContext from "../../contexts/PageContext"
import Centered from "../../shared-module/components/Centering/Centered"
import Footer from "../../shared-module/components/Footer"
import LanguageSelection from "../../shared-module/components/LanguageSelection"
import {
  NavBar,
  NavContainer,
  NavItem,
  NavItems,
  // NavLink,
} from "../../shared-module/components/Navigation/NavBar"
import SearchDialog from "../SearchDialog"
import UserNavigationControls from "../navigation/UserNavigationControls"

import ScrollIndicator from "./ScrollIndicator"

const LANGUAGE_SELECTION_PLACEMENTPLACEMENT = "bottom-end"

interface LayoutProps {
  children: ReactNode
  navVariant?: "simple" | "complex"
  faqUrl?: string
  title?: string
  licenseUrl?: string
  courseSlug?: string
  organizationSlug: string
}

const DynamicToaster = dynamic(
  () => import("../../shared-module/components/Notifications/ToasterNotifications"),
  { ssr: false },
)

const Layout: React.FC<React.PropsWithChildren<LayoutProps>> = ({
  children,
  title = process.env.NEXT_PUBLIC_SITE_TITLE ?? "Secret Project 331",
  navVariant,
  // faqUrl,
  licenseUrl,
  courseSlug,
  organizationSlug,
}) => {
  const router = useRouter()
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
          height: 100%;
          min-height: 100vh;
        `}
      >
        <ScrollIndicator />
        <NavBar variant={navVariant ?? "simple"}>
          <NavContainer>
            <NavItems>
              {/* <NavLink href="/FAQ">FAQ</NavLink> */}
              {courseId && courseSlug && (
                <NavItem>
                  <SearchDialog
                    courseId={courseId}
                    courseSlug={courseSlug}
                    organizationSlug={organizationSlug}
                  />
                </NavItem>
              )}
              <NavItem>
                <LanguageSelection placement={LANGUAGE_SELECTION_PLACEMENTPLACEMENT} />
              </NavItem>
            </NavItems>
          </NavContainer>
          <UserNavigationControls currentPagePath={router.asPath} courseId={courseId} />
        </NavBar>

        <main>
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
