"use client"

import { css } from "@emotion/css"
import { BlockIcon, MediaPlaceholder } from "@wordpress/block-editor"
import { Placeholder } from "@wordpress/components"
import { image as icon } from "@wordpress/icons"
import React from "react"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import { Button } from "@/shared-module/components/components/Button"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { ChartDataFile } from "./useChartDataFile"

const ALLOWED_DATA_FILE_MIMETYPES = ["text/csv", "application/json"]

// The WP placeholder lays its fieldset out in a row; this stacks the notice above the buttons.
const dataFileActionsStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
`

const dataFileButtonRowStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`

const dataFileNoticeStyles = css`
  margin: 0;
  font-family: ${primaryFont};
  font-size: 0.8125rem;
  color: ${baseTheme.colors.gray[700]};
`

// The attached data file's name as shown to the teacher. decodeURIComponent throws on a malformed
// percent sequence, so an odd URL falls back to the raw name rather than taking down the dialog.
const dataFileNameFromUrl = (url: string): string => {
  const name = url.split("/").pop() ?? url
  try {
    return decodeURIComponent(name)
  } catch {
    return name
  }
}

interface ChartDataFileSectionProps {
  dataFile: ChartDataFile
  /** The file attached to the block; without one the media picker is offered instead. */
  dataFileUrl: string | undefined
}

/**
 * The chart's data file: the attached file with its remove and restore controls, or the media
 * picker for choosing one. Shown both on the data step and in the editor.
 */
const ChartDataFileSection: React.FC<ChartDataFileSectionProps> = ({ dataFile, dataFileUrl }) => {
  const { t } = useTranslation()
  return (
    <>
      {dataFile.error && <ErrorBanner error={dataFile.error} />}
      {/* The live region must exist before content changes for screen readers to announce it. */}
      <div aria-live="polite">
        {dataFile.isExtracting && (
          <p
            className={css`
              font-family: ${primaryFont};
              font-size: 0.8125rem;
              color: ${baseTheme.colors.gray[600]};
              margin: 0 0 0.5rem;
            `}
          >
            {t("separating-chart-data")}
          </p>
        )}
        {dataFile.extractedDataUrl && (
          <div
            className={css`
              padding: 0.75rem 1rem;
              margin-bottom: 0.5rem;
              background: ${baseTheme.colors.yellow[100]};
              border: 1px solid ${baseTheme.colors.yellow[300]};
              border-radius: 4px;
              font-family: ${primaryFont};
              font-size: 0.8125rem;
              color: ${baseTheme.colors.gray[700]};
            `}
          >
            {t("chart-data-extracted-warning")}{" "}
            <a href={dataFile.extractedDataUrl} target="_blank" rel="noopener noreferrer">
              {t("view-data-file")}
            </a>
          </div>
        )}
      </div>
      {dataFileUrl ? (
        <Placeholder
          icon={<BlockIcon icon={icon} />}
          label={t("chart-data-file")}
          instructions={dataFileNameFromUrl(dataFileUrl)}
        >
          <div className={dataFileActionsStyles} aria-live="polite">
            {dataFile.isDetached ? (
              <p className={dataFileNoticeStyles}>{t("chart-data-file-missing-from-spec")}</p>
            ) : dataFile.restoreConfirmed ? (
              <p className={dataFileNoticeStyles}>{t("chart-data-file-reinserted")}</p>
            ) : null}
            <div className={dataFileButtonRowStyles}>
              <Button
                variant="tertiary"
                size="medium"
                onPress={dataFile.removeFile}
                ref={dataFile.removeButtonRef}
              >
                {t("remove")}
              </Button>
              {dataFile.isDetached && (
                <Button variant="tertiary" size="medium" onPress={dataFile.reinsertFile}>
                  {t("chart-data-file-reinsert")}
                </Button>
              )}
            </div>
          </div>
        </Placeholder>
      ) : dataFile.isExtracting ? null : (
        <MediaPlaceholder
          icon={<BlockIcon icon={icon} />}
          labels={{
            title: t("chart-data-file"),
            instructions: t("chart-data-file-instructions"),
          }}
          onSelect={dataFile.selectFile}
          accept={ALLOWED_DATA_FILE_MIMETYPES.join(",")}
          allowedTypes={ALLOWED_DATA_FILE_MIMETYPES}
          onError={dataFile.reportUploadError}
          onHTMLDrop={undefined}
        />
      )}
    </>
  )
}

export default ChartDataFileSection
