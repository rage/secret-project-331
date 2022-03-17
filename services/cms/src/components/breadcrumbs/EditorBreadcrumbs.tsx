import { useRouter } from "next/router"
import React from "react"
import { useQuery } from "react-query"

import { fetchPageWithId } from "../../services/backend/pages"
import Breadcrumbs from "../../shared-module/components/Breadcrumbs"
import BreakFromCentered from "../../shared-module/components/Centering/BreakFromCentered"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import Spinner from "../../shared-module/components/Spinner"

const EditorBreadcrumbs: React.FC = () => {
  const router = useRouter()

  const pageId = router.asPath.split("/")[2]
  const data = useQuery(`page-with-id-${pageId}`, () => {
    if (!pageId) {
      return null
    }
    return fetchPageWithId(pageId)
  })

  if (!data) {
    return (
      <BreakFromCentered sidebar={false}>
        <Breadcrumbs pieces={[]} />
      </BreakFromCentered>
    )
  }

  if (data.isError) {
    return <ErrorBanner variant={"readOnly"} error={data.error} />
  }

  if (data.isLoading || data.isIdle) {
    return <Spinner variant={"small"} />
  }

  if (!data.data) {
    return null
  }

  const pageTitle = data.data.page.title

  /* eslint-disable i18next/no-literal-string */
  const pieces = [
    {
      text: "Course",
      url: "",
    },
    {
      text: pageTitle,
      url: "#",
    },
  ]

  return (
    <BreakFromCentered sidebar={false}>
      <Breadcrumbs pieces={pieces} />
    </BreakFromCentered>
  )
}

export default EditorBreadcrumbs
