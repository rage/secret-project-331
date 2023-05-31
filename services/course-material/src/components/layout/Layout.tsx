import { css } from "@emotion/css"
import dynamic from "next/dynamic"
import Head from "next/head"
import { useRouter } from "next/router"
import React, { ReactNode, useState } from "react"

import LayoutContext from "../../contexts/LayoutContext"
import PageContext, { getDefaultPageState } from "../../contexts/PageContext"
import { PageState } from "../../reducers/pageStateReducer"
import Centered from "../../shared-module/components/Centering/Centered"
import Footer from "../../shared-module/components/Footer"
import LanguageSelection from "../../shared-module/components/LanguageSelection"
import {
  NavBar,
  NavContainer,
  NavItem,
  NavItems,
} from "../../shared-module/components/Navigation/NavBar"
import SearchDialog from "../SearchDialog"
import UserNavigationControls from "../navigation/UserNavigationControls"

import ScrollIndicator from "./ScrollIndicator"

const LANGUAGE_SELECTION_PLACEMENTPLACEMENT = "bottom-end"

interface LayoutProps {
  children: ReactNode
}

const DynamicToaster = dynamic(
  () => import("../../shared-module/components/Notifications/ToasterNotifications"),
  { ssr: false },
)

const DEFAULT_TITLE = process.env.NEXT_PUBLIC_SITE_TITLE ?? "Secret Project 331"

const Layout: React.FC<React.PropsWithChildren<LayoutProps>> = ({ children }) => {
  const router = useRouter()

  const [title, setTitle] = useState<string | null>(null)
  const fullTitle = title ? `${title} - ${DEFAULT_TITLE}` : DEFAULT_TITLE
  const [organizationSlug, setOrganizationSlug] = useState<string | null>(null)
  const [courseId, setCourseId] = useState<string | null>(null)
  const [hideFromSearchEngines, setHideFromSearchEngines] = useState<boolean>(false)
  const [pageState, setPageState] = useState<PageState>(getDefaultPageState())

  return (
    <>
      <Head>
        <title>{fullTitle}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />

        {hideFromSearchEngines && <meta name="robots" content="noindex" />}
      </Head>
      <div
        // Push footer to bottom of page, e.g. on empty body
        className={css`
          height: 100%;
          min-height: 100vh;
        `}
      >
        <ScrollIndicator />
        <PageContext.Provider value={pageState}>
          <NavBar variant={"simple"}>
            <NavContainer>
              <NavItems>
                {/* <NavLink href="/FAQ">FAQ</NavLink> */}
                {courseId && organizationSlug && (
                  <NavItem>
                    <SearchDialog courseId={courseId} organizationSlug={organizationSlug} />
                  </NavItem>
                )}
                <NavItem>
                  <LanguageSelection placement={LANGUAGE_SELECTION_PLACEMENTPLACEMENT} />
                </NavItem>
              </NavItems>
            </NavContainer>
            <UserNavigationControls currentPagePath={router.asPath} courseId={courseId} />
          </NavBar>
        </PageContext.Provider>

        <main>
          <Centered variant="narrow">
            <LayoutContext.Provider
              value={{
                title,
                setTitle,
                organizationSlug,
                setOrganizationSlug,
                courseId,
                setCourseId,
                hideFromSearchEngines,
                setHideFromSearchEngines,
                setPageState,
              }}
            >
              {children}
            </LayoutContext.Provider>
          </Centered>
        </main>
      </div>
      <div
        className={css`
          margin-top: 2rem;
        `}
      >
        <DynamicToaster />
        <Footer />
      </div>
    </>
  )
}

export default Layout
