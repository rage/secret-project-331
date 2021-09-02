import { css } from "@emotion/css"
import Head from "next/head"
import { useRouter } from "next/router"
import React, { ReactNode } from "react"

import Footer from "../shared-module/components/Footer"
import Navbar from "../shared-module/components/Navigation"

import ScrollIndicator from "./ScrollIndicator"

type LayoutProps = {
  children: ReactNode
  frontPageUrl: string
  faqUrl: string
  title?: string
  licenseUrl?: string
  returnToPath?: string
}

const Layout: React.FC<LayoutProps> = ({
  children,
  title,
  frontPageUrl,
  faqUrl,
  licenseUrl,
  returnToPath,
}) => {
  const router = useRouter()
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
        <header>
          <ScrollIndicator />
          <Navbar
            faqUrl={faqUrl}
            frontPageUrl={frontPageUrl}
            variant="simple"
            // Return to path can be override per page
            returnToPath={returnToPath ?? returnPath}
          ></Navbar>
        </header>
        {/* Do not touch flex */}
        <div
          className={css`
            flex: 1;
          `}
        >
          {children}
        </div>
        <footer
          className={css`
            margin-top: 2rem;
          `}
        >
          <Footer licenseUrl={licenseUrl} />
        </footer>
      </div>
    </>
  )
}
export default Layout
