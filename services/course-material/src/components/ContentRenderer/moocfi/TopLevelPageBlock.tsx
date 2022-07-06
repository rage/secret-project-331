import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { BlockRendererProps } from ".."
import { fetchTopLevelPages } from "../../../services/backend"
import BreakFromCentered from "../../../shared-module/components/Centering/BreakFromCentered"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import Spinner from "../../../shared-module/components/Spinner"
import TopLevelPage, {
  TopLevelPageExtraProps,
} from "../../../shared-module/components/TopLevelPage"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

const TopLevelPageBlock: React.FC<BlockRendererProps<TopLevelPageExtraProps>> = (props) => {
  const { t } = useTranslation()
  const getTopLevelPages = useQuery(`top-level-pages`, () => fetchTopLevelPages())
  return (
    <>
      {getTopLevelPages.isError && (
        <ErrorBanner variant={"readOnly"} error={getTopLevelPages.error} />
      )}
      {(getTopLevelPages.isLoading || getTopLevelPages.isIdle) && <Spinner variant={"medium"} />}
      {getTopLevelPages.isSuccess && (
        <>
          {getTopLevelPages.data && (
            <BreakFromCentered sidebar={false}>
              <h2>{t("top-level-pages")}</h2>
              {getTopLevelPages.data.map((page) => (
                <TopLevelPage page={page} key={page.id} />
              ))}
            </BreakFromCentered>
          )}
        </>
      )}
    </>
  )
}
export default withErrorBoundary(TopLevelPageBlock)
