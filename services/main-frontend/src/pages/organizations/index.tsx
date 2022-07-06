import { css } from "@emotion/css"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../components/Layout"
import OrganizationsList from "../../components/page-specific/organizations/index/OrganizationsList"
import OnlyRenderIfPermissions from "../../shared-module/components/OnlyRenderIfPermissions"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

const MANAGE_EXERCISE_SERVICES_HREF = "/manage/exercise-services"

const Home: React.FC = () => {
  const { t } = useTranslation()
  return (
    <Layout>
      <OrganizationsList />

      <OnlyRenderIfPermissions action={{ type: "edit" }} resource={{ type: "global_permissions" }}>
        <h1
          className={css`
            text-align: center;
            font-weight: 600;
            font-size: 3em;
            color: #656565;
          `}
        >
          {t("title-services")}
        </h1>
        <div>
          <Link href={MANAGE_EXERCISE_SERVICES_HREF} passHref>
            <a
              href="replace"
              className={css`
                cursor: pointer;
                color: blue;
                text-decoration: underline;
              `}
            >
              {t("link-manage-exercise-services")}
            </a>
          </Link>
        </div>
      </OnlyRenderIfPermissions>
    </Layout>
  )
}

export default withErrorBoundary(Home)
