import { css } from "@emotion/css"
import { Container } from "@material-ui/core"
import Link from "next/link"
import React from "react"

import Layout from "../../components/Layout"
import OrganizationsList from "../../components/lists/OrganizationsList"
import basePath from "../../shared-module/utils/base-path"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

const Home: React.FC = () => {
  return (
    <Layout frontPageUrl={basePath()} navVariant="simple">
      <OrganizationsList />

      {/* Temporal view for the exercise services */}
      <h1
        className={css`
          text-align: center;
          font-weight: 600;
          font-size: 3em;
          color: #707070;
        `}
      >
        Services
      </h1>
      <Container maxWidth="lg">
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
            Manage exercise services
          </p>
        </Link>
      </Container>
    </Layout>
  )
}

export default withErrorBoundary(Home)
