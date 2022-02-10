import { css } from "@emotion/css"
import styled from "@emotion/styled"
import dynamic from "next/dynamic"
import Head from "next/head"
import { useRouter } from "next/router"
import React, { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import Centered from "../shared-module/components/Centering/Centered"
import Footer from "../shared-module/components/Footer"
import Navbar from "../shared-module/components/Navigation"
import { baseTheme } from "../shared-module/styles"
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

// eslint-disable-next-line i18next/no-literal-string
const SkipLink = styled.a`
  background: ${baseTheme.colors.green[600]};
  color: ${baseTheme.colors.clear[100]};
  font-weight: 700;
  left: 50%;
  padding: 6px;
  position: absolute;
  transform: translateY(-100%);
  text-decoration: none;

  &:focus {
    transform: translateY(0%);
  }
`

const Layout: React.FC<LayoutProps> = ({
  children,
  title = "Secret Project 331",
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
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 100vh;
        `}
      >
        {/* Skip to content*/}

        <SkipLink href="#maincontent">{t("skip-to-content")}</SkipLink>
        <div>
          <Navbar
            faqUrl={faqUrl}
            variant={navVariant ?? "simple"}
            // Return to path can be override per page
            returnToPath={returnToPath ?? returnPath}
          ></Navbar>
        </div>
        {/* Do not touch flex */}
        <main
          className={css`
            flex: 1;
          `}
          id="maincontent"
        >
          <Centered variant="default">{children}</Centered>
        </main>
      </div>
      <DynamicToaster />
      <Footer licenseUrl={licenseUrl} />
    </>
  )
}

export default Layout
