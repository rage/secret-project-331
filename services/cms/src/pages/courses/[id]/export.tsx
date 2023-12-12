import { TarBuilder } from "@bytedance/tar-wasm"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { getAllPagesForACourse } from "../../../services/backend/courses"
import { fetchPageInfo, fetchPageWithId } from "../../../services/backend/pages"
import Button from "../../../shared-module/components/Button"
import useToastMutation from "../../../shared-module/hooks/useToastMutation"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import { dateToString } from "../../../shared-module/utils/time"
import { denormalizeDocument } from "../../../utils/documentSchemaProcessor"

interface ExportPageProps {
  // courseId
  query: SimplifiedUrlQuery<"id">
}

const ExportPage: React.FC<React.PropsWithChildren<ExportPageProps>> = ({ query }) => {
  const { t } = useTranslation()
  const [totalSteps, setTotalSteps] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)

  const getAllPagesMutation = useToastMutation(
    async () => {
      try {
        const pages = await getAllPagesForACourse(query.id)
        setTotalSteps(pages.length)
        const tarBuilder = new TarBuilder()
        tarBuilder.set_gzip(false)
        const textEncoder = new TextEncoder()
        const alreadyAddedFiles = new Set<string>()
        for (const page of pages) {
          setCurrentStep((old) => old + 1)
          // Wait for a bit to avoid hitting rate limits
          await new Promise((r) => setTimeout(r, 100))
          const data = await fetchPageWithId(page.id)
          // denormalize content so that the json includes private specs of the exercises
          const denormalizedContent = denormalizeDocument({
            content: data.page.content,
            exercises: data.exercises,
            exercise_slides: data.exercise_slides,
            exercise_tasks: data.exercise_tasks,
            url_path: data.page.url_path,
            title: data.page.title,
            chapter_id: data.page.chapter_id,
          }).content
          let filename = page.url_path
          if (filename === "/") {
            filename = "/index"
          }
          tarBuilder.add_file(
            `pages${filename}.json`,
            textEncoder.encode(JSON.stringify(denormalizedContent, undefined, 2)),
          )
          // download all linked files
          const contentAsString = JSON.stringify(denormalizedContent)
          const allUrls = contentAsString.match(/https?:\/\/[^"]+/g)
          if (allUrls) {
            for (const url of allUrls) {
              const parsedUrl = new URL(url)
              if (alreadyAddedFiles.has(url.toString())) {
                continue
              }
              alreadyAddedFiles.add(url.toString())
              if (parsedUrl.hostname !== window.location.hostname) {
                console.info(
                  `Skipping ${url} because it's not coming from ${window.location.hostname}}`,
                )
                continue
              }
              console.info(`Downloading ${url}`)
              const response = await fetch(url)
              if (!response.ok) {
                throw new Error(`Failed to download ${url}`)
              }
              const body = await response.arrayBuffer()
              const bodyAsUint8Array = new Uint8Array(body)
              const path = `files${parsedUrl.pathname}`
              console.info(`Saving ${path}`)
              tarBuilder.add_file(path, bodyAsUint8Array)
            }
          }
        }
        if (pages.length === 0) {
          throw new Error("Course has no pages")
        }
        const pageInfo = await fetchPageInfo(pages[0].id)
        save(
          `Page export ${pageInfo.course_slug} ${dateToString(new Date()).replaceAll(
            ":",
            ".",
          )}.tar`,
          tarBuilder.finish(),
        )
      } finally {
        setTotalSteps(0)
        setCurrentStep(0)
      }
    },
    { notify: false },
  )

  return (
    <>
      <h1>{t("header-export")}</h1>
      <Button
        variant="primary"
        size="medium"
        disabled={getAllPagesMutation.isPending}
        onClick={() => {
          getAllPagesMutation.mutate()
        }}
      >
        {t("button-text-export-all-pages")} {totalSteps > 0 && ` ${currentStep}/${totalSteps}`}
      </Button>
    </>
  )
}

function save(filename: string, data: Uint8Array) {
  console.info(`Downloading ${filename}`)
  const blob = new Blob([data], { type: "application/gzip" })

  const elem = window.document.createElement("a")
  elem.href = window.URL.createObjectURL(blob)
  elem.download = filename
  document.body.appendChild(elem)
  elem.click()
  document.body.removeChild(elem)
}

const exported = dontRenderUntilQueryParametersReady(ExportPage)

// @ts-expect-error: hideBreadcrumbs is an addtional property on exported
exported.hideBreadcrumbs = true

export default exported
