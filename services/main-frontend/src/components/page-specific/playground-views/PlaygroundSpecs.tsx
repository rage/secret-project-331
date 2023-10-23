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

export interface PlaygroundSpecsProps {
  settingsForm: UseFormReturn<PlaygroundSettings>
  publicSpecQuery: UseQueryResult<unknown, unknown>
  modelSolutionSpecQuery: UseQueryResult<unknown, unknown>
}

const FULL_WIDTH = "100vw"
const HALF_WIDTH = "50vw"

const StyledPre = styled.pre<{ fullWidth: boolean }>`
  background-color: rgba(218, 230, 229, 0.4);
  border-radius: 6px;
  padding: 1rem;
  font-size: 13px;
  max-width: ${(props) => (props.fullWidth ? FULL_WIDTH : HALF_WIDTH)};
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

      <div>
        <div>
          <h3>{t("title-public-spec")}</h3>

          <p>{t("public-spec-explanation")}</p>

          {publicSpecQuery.isError && (
            <ErrorBanner variant={"readOnly"} error={publicSpecQuery.error} />
          )}
          {publicSpecQuery.isLoading && publicSpecQuery.isFetching && (
            <Spinner variant={"medium"} />
          )}
          {publicSpecQuery.isLoading && !publicSpecQuery.isFetching && (
            <p>{t("error-cannot-load-with-the-given-inputs")}</p>
          )}

          {publicSpecQuery.isSuccess && (
            <StyledPre fullWidth={false}>
              {JSON.stringify(publicSpecQuery.data, undefined, 2).replaceAll("\\n", "\n")}
            </StyledPre>
          )}
        </div>
      </div>

      <div>
        <div>
          <h3>{t("title-model-solution-spec")}</h3>

          <p>{t("model-solution-spec-explanation")}</p>

          {modelSolutionSpecQuery.isError && (
            <ErrorBanner variant={"readOnly"} error={modelSolutionSpecQuery.error} />
          )}
          {modelSolutionSpecQuery.isLoading && modelSolutionSpecQuery.isFetching && (
            <Spinner variant={"medium"} />
          )}
          {modelSolutionSpecQuery.isLoading && !modelSolutionSpecQuery.isFetching && (
            <p>{t("error-cannot-load-with-the-given-inputs")}</p>
          )}

          {modelSolutionSpecQuery.isSuccess && (
            <StyledPre fullWidth={false}>
              {JSON.stringify(modelSolutionSpecQuery.data, undefined, 2).replaceAll("\\n", "\n")}
            </StyledPre>
          )}
        </div>
      </div>
    </div>
  )
}

export default PlaygroundSpecs
