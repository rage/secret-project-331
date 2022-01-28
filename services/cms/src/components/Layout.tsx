import { css } from "@emotion/css"
import Head from "next/head"
import { useRouter } from "next/router"
import React, { ReactNode } from "react"

import Centered from "../shared-module/components/Centering/Centered"
import Footer from "../shared-module/components/Footer"
import Navbar from "../shared-module/components/Navigation"
import { respondToOrLarger } from "../shared-module/styles/respond"
import basePath from "../shared-module/utils/base-path"

export const SIDEBAR_WIDTH_PX = 280

type LayoutProps = {
  children: ReactNode
  frontPageUrl?: string
  navVariant?: "simple" | "complex"
  faqUrl?: string
  title?: string
  licenseUrl?: string
  returnToPath?: string
}

const Layout: React.FC<LayoutProps> = ({
  children,
  title = "Secret Project 331",
  navVariant,
  frontPageUrl,
  faqUrl,
  licenseUrl,
  returnToPath,
}) => {
  const router = useRouter()
  // eslint-disable-next-line i18next/no-literal-string
  const returnPath = `/login?return_to=${encodeURIComponent(
    process.env.NEXT_PUBLIC_BASE_PATH + router.asPath,
  )}`
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
        <div
          className={css`
            position: fixed;
            top: 0;
            z-index: 9002;
            background-color: white;
            width: 100%;
          `}
        >
          <Navbar
            faqUrl={faqUrl}
            frontPageUrl={frontPageUrl ?? basePath()}
            variant={navVariant ?? "complex"}
            // Return to path can be override per page
            returnToPath={returnToPath ?? returnPath}
          ></Navbar>
        </div>
        {/* Do not touch flex */}
        <main
          className={css`
            flex: 1;
            margin-top: 90px;
            /* Sidebar hidden on small screens */
            margin-right: 0;
            ${respondToOrLarger.xl} {
              /* Sidebar visible screens */
              margin-right: ${SIDEBAR_WIDTH_PX}px;
            }
          `}
        >
          <Centered variant="narrow">{children}</Centered>
        </main>
      </div>
      <Footer licenseUrl={licenseUrl} />
    </>
  )
}

export default Layout
