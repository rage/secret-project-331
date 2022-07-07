import { css } from "@emotion/css"
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
import { headingFont } from "../../../shared-module/styles"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

const TopLevelPageBlock: React.FC<BlockRendererProps<TopLevelPageExtraProps>> = () => {
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
              <h2
                className={css`
                  font-family: ${headingFont};
                  font-size: clamp(28px, 3vw, 30px);
                  color: #065853;
                `}
              >
                {t("top-level-pages")}
              </h2>
              {getTopLevelPages.data.map((page) => (
                <TopLevelPage title={page.title} url={page.url_path} key={page.id} />
              ))}
            </BreakFromCentered>
          )}
        </>
      )}
    </>
  )
}
export default withErrorBoundary(TopLevelPageBlock)
