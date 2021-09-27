import { css } from "@emotion/css"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../components/Layout"
import OrganizationsList from "../../components/lists/OrganizationsList"
import { normalWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

const Home: React.FC = () => {
  const { t } = useTranslation()
  return (
    <Layout>
      <OrganizationsList />

      {/* Temporary view for the exercise services */}
      <h1
        className={css`
          text-align: center;
          font-weight: 600;
          font-size: 3em;
          color: #707070;
        `}
      >
        {t("title-services")}
      </h1>
      <div className={normalWidthCenteredComponentStyles}>
        <Link
          href={{
            pathname: `/manage/exercise-services`,
          }}
        >
          <p
            className={css`
              cursor: pointer;
              color: blue;
              text-decoration: underline;
            `}
          >
            {t("link-manage-exercise-services")}
          </p>
        </Link>
      </div>
    </Layout>
  )
}

export default withErrorBoundary(Home)
