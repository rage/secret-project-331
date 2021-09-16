import { css } from "@emotion/css"
import { useRouter } from "next/router"

import HistoryView from "../../../../components/HistoryView"
import Layout from "../../../../components/Layout"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"

const History: React.FC<unknown> = () => {
  const router = useRouter()
  const id = router.query.id

  if (typeof id !== "string") {
    return (
      <div>
        <h1>Error</h1>
        <pre>Invalid query</pre>
      </div>
    )
  }

  return (
    <Layout navVariant="complex">
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
        `}
      >
        <h2>Page edit history</h2>
        <HistoryView pageId={id} />
      </div>
    </Layout>
  )
}

export default History
