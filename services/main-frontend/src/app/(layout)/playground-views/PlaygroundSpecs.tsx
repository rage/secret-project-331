"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import type { UseQueryResult } from "@tanstack/react-query"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { PlaygroundSettings } from "@/app/(layout)/playground-tabs/page"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { monospaceFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { LoadingRegion, TextArea } from "@/shared-module/components"

export interface PlaygroundSpecsProps {
  settingsForm: UseFormReturn<PlaygroundSettings>
  publicSpecQuery: UseQueryResult<unknown, unknown>
  modelSolutionSpecQuery: UseQueryResult<unknown, unknown>
}

const StyledPre = styled.pre`
  background-color: rgba(218, 230, 229, 0.4);
  border-radius: 6px;
  padding: 1rem;
  font-size: 13px;
  width: 100%;
  max-height: 700px;
  overflow: auto;
  white-space: pre-wrap;
  resize: vertical;

  &[style*="height"] {
    max-height: unset;
  }
`

const PlaygroundSpecs: React.FC<PlaygroundSpecsProps> = ({
  settingsForm,
  publicSpecQuery,
  modelSolutionSpecQuery,
}) => {
  const { t } = useTranslation()

  return (
    <div
      className={css`
        padding: 2rem;
      `}
    >
      <div>
        <TextArea
          name="private_spec"
          control={settingsForm.control}
          rules={{
            validate: (value) => {
              try {
                JSON.parse(value)
                return true
              } catch (_e) {
                return false
              }
            },
          }}
          id="heading-private-spec"
          rows={20}
          label={t("private-spec")}
          className={css`
            margin-bottom: 1rem;
            textarea {
              width: 100%;
              height: 700px;
              font-family: ${monospaceFont} !important;
              resize: vertical;
              font-size: 13px !important;
            }
          `}
        />
      </div>

      <div>
        <div>
          <h2>{t("title-derived-specs")}</h2>

          <p>{t("derived-specs-explanation")}</p>
        </div>
      </div>

      <div
        className={css`
          margin-top: 1rem;
          ${respondToOrLarger.lg} {
            display: flex;
            justify-content: space-between;
            gap: 1rem;
          }
        `}
      >
        <div
          className={css`
            flex: 1;
          `}
        >
          <h3>{t("title-public-spec")}</h3>

          <p>{t("public-spec-explanation")}</p>

          {publicSpecQuery.isError && (
            <ErrorBanner variant={"readOnly"} error={publicSpecQuery.error} />
          )}
          {publicSpecQuery.isLoading && publicSpecQuery.isFetching && <LoadingRegion />}
          {publicSpecQuery.isLoading && !publicSpecQuery.isFetching && (
            <p>{t("error-cannot-load-with-the-given-inputs")}</p>
          )}

          {publicSpecQuery.isSuccess && (
            <StyledPre>
              {/* oxlint-disable-next-line i18next/no-literal-string */}
              {JSON.stringify(publicSpecQuery.data, undefined, 2).replaceAll("\\n", "\n")}
            </StyledPre>
          )}
        </div>

        <div
          className={css`
            flex: 1;
          `}
        >
          <h3>{t("title-model-solution-spec")}</h3>

          <p>{t("model-solution-spec-explanation")}</p>

          {modelSolutionSpecQuery.isError && (
            <ErrorBanner variant={"readOnly"} error={modelSolutionSpecQuery.error} />
          )}
          {modelSolutionSpecQuery.isLoading && modelSolutionSpecQuery.isFetching && (
            <LoadingRegion />
          )}
          {modelSolutionSpecQuery.isLoading && !modelSolutionSpecQuery.isFetching && (
            <p>{t("error-cannot-load-with-the-given-inputs")}</p>
          )}

          {modelSolutionSpecQuery.isSuccess && (
            <StyledPre>
              {/* oxlint-disable-next-line i18next/no-literal-string */}
              {JSON.stringify(modelSolutionSpecQuery.data, undefined, 2).replaceAll("\\n", "\n")}
            </StyledPre>
          )}
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(PlaygroundSpecs)
