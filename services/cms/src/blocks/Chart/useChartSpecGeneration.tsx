"use client"

import { requestChartSpecGeneration } from "@/generated/api/sdk.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { useTranslation } from "@/utils/useCmsTranslation"

import { dataFormatForUrl, specWithDataUrl } from "./chartSpec"
import { renderErrorForSpec } from "./validateChartSpec"

// Enough of the data file for the model to see field names and value shapes.
const DATA_SAMPLE_MAX_CHARS = 4000

interface ChartSpecGenerationOptions {
  /** The data file the chart draws from; the model is given its URL, format and a sample. */
  dataFileUrl: string | undefined
  pageId: string | undefined
  /** Receives the generated specification. */
  onSpecGenerated: (spec: string) => void
}

interface ChartSpecGeneration {
  /**
   * Writes a specification from the teacher's description, editing `currentSpec` when there is one.
   * Resolves to whether a specification came back; a failure leaves it in `error`.
   */
  generateSpec: (prompt: string, currentSpec: string | null) => Promise<boolean>
  /** Hands a specification that won't render back to the model, together with its error. */
  repairSpec: (renderError: string, brokenSpec: string) => void
  isGenerating: boolean
  error: unknown
  /** Clears a previous failure, so the prompt opens without a stale error on it. */
  reset: () => void
}

/**
 * Generating a Vega-Lite specification with the AI chart generator.
 *
 * A specification that doesn't render is retried once with the renderer's error as context; the
 * result is applied either way, leaving a still-broken one to `repairSpec`.
 */
export const useChartSpecGeneration = ({
  dataFileUrl,
  pageId,
  onSpecGenerated,
}: ChartSpecGenerationOptions): ChartSpecGeneration => {
  const { t } = useTranslation()

  // Not HTML-escaped, so the raw error text reaches the model intact.
  const fixPromptFor = (error: string) =>
    t("ai-fix-chart-prompt", { error, interpolation: { escapeValue: false } })

  // One round-trip to the generator, returning the produced spec with the data file re-bound.
  const requestSpec = async (prompt: string, currentSpec: string | null): Promise<string> => {
    let dataSample: string | undefined
    if (dataFileUrl) {
      try {
        const res = await fetch(dataFileUrl)
        if (res.ok) {
          dataSample = (await res.text()).slice(0, DATA_SAMPLE_MAX_CHARS)
        }
      } catch {
        // The sample is optional context; generate without it.
      }
    }
    const response = await requestChartSpecGeneration({
      body: {
        prompt,
        current_spec: currentSpec,
        data_url: dataFileUrl ?? null,
        data_format: dataFileUrl ? (dataFormatForUrl(dataFileUrl)?.type ?? null) : null,
        data_sample: dataSample ?? null,
        page_id: pageId ?? null,
      },
    })
    // Keep the teacher's data file bound even if the model changed or dropped the URL.
    const rebound = dataFileUrl ? specWithDataUrl(response.spec, dataFileUrl) : null
    return rebound ? JSON.stringify(rebound, null, 2) : response.spec
  }

  const mutation = useToastMutation<
    string,
    unknown,
    { prompt: string; currentSpec: string | null }
  >(
    async ({ prompt, currentSpec }) => {
      const result = await requestSpec(prompt, currentSpec)
      const error = renderErrorForSpec(result)
      return error ? await requestSpec(fixPromptFor(error), result) : result
    },
    { notify: false },
    { onSuccess: (result) => onSpecGenerated(result) },
  )

  return {
    generateSpec: async (prompt, currentSpec) => {
      try {
        await mutation.mutateAsync({ prompt, currentSpec })
        return true
      } catch {
        return false
      }
    },
    repairSpec: (renderError, brokenSpec) => {
      mutation.mutate({ prompt: fixPromptFor(renderError), currentSpec: brokenSpec })
    },
    isGenerating: mutation.isPending,
    error: mutation.error,
    reset: () => mutation.reset(),
  }
}
