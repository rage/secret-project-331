import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { UseQueryResult } from "@tanstack/react-query"
import { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { PlaygroundSettings } from "../../../pages/playground-tabs"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import TextAreaField from "../../../shared-module/components/InputFields/TextAreaField"
import Spinner from "../../../shared-module/components/Spinner"
import { monospaceFont } from "../../../shared-module/styles"
import { respondToOrLarger } from "../../../shared-module/styles/respond"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

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
  overflow: scroll;
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
        <TextAreaField
          id="heading-private-spec"
          rows={20}
          spellCheck={false}
          label={t("private-spec")}
          {...settingsForm.register("private_spec", {
            validate: (value) => {
              try {
                JSON.parse(value)
                return true
              } catch (_e) {
                return false
              }
            },
          })}
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
          {publicSpecQuery.isPending && publicSpecQuery.isFetching && (
            <Spinner variant={"medium"} />
          )}
          {publicSpecQuery.isPending && !publicSpecQuery.isFetching && (
            <p>{t("error-cannot-load-with-the-given-inputs")}</p>
          )}

          {publicSpecQuery.isSuccess && (
            <StyledPre>
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
          {modelSolutionSpecQuery.isPending && modelSolutionSpecQuery.isFetching && (
            <Spinner variant={"medium"} />
          )}
          {modelSolutionSpecQuery.isPending && !modelSolutionSpecQuery.isFetching && (
            <p>{t("error-cannot-load-with-the-given-inputs")}</p>
          )}

          {modelSolutionSpecQuery.isSuccess && (
            <StyledPre>
              {JSON.stringify(modelSolutionSpecQuery.data, undefined, 2).replaceAll("\\n", "\n")}
            </StyledPre>
          )}
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(PlaygroundSpecs)
