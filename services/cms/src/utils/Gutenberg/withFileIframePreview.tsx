"use client"

import { css } from "@emotion/css"
import { createHigherOrderComponent } from "@wordpress/compose"
import { createPortal, useEffect, useState } from "@wordpress/element"
import type { ComponentType } from "react"

import { useIsBlockPreviewMode } from "./blockPreviewMode"

const FILE_BLOCK_NAME = "core/file"

interface FileEditProps {
  name: string
  clientId: string
  attributes: { href?: string; fileName?: string }
  [key: string]: unknown
}

const FileIframePreview = ({
  BlockEdit,
  ...props
}: FileEditProps & { BlockEdit: ComponentType<FileEditProps> }) => {
  const { clientId, attributes } = props
  const isPreviewMode = useIsBlockPreviewMode()
  const [previewBox, setPreviewBox] = useState<Element | null>(null)
  const isPdf = /\.pdf$/i.test(attributes.href?.split(/[?#]/)[0] ?? "")

  // Gutenberg mounts and unmounts the preview box as the embed is toggled.
  useEffect(() => {
    const block = document.querySelector(`#block-${clientId}`)
    if (!block || isPreviewMode) {
      return
    }
    const findPreviewBox = () =>
      setPreviewBox(block.querySelector(".components-resizable-box__container"))
    findPreviewBox()
    const observer = new MutationObserver(findPreviewBox)
    observer.observe(block, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [clientId, isPreviewMode])

  return (
    <>
      <BlockEdit {...props} />
      {previewBox &&
        isPdf &&
        createPortal(
          // oxlint-disable-next-line react/iframe-missing-sandbox -- Chromium refuses PDFs in sandboxed frames
          <iframe
            src={attributes.href}
            title={attributes.fileName ?? ""}
            className={css`
              display: block;
              width: 100%;
              height: 100%;
              border: 0;
            `}
          />,
          previewBox,
        )}
    </>
  )
}

/**
 * Gutenberg embeds a PDF with `<object>`, which the CSP's `object-src 'none'` blocks. This frames
 * the PDF inside Gutenberg's own resizable preview box instead, the way main-frontend's FileBlock
 * shows it, so the "Show inline embed" toggle and the resize handle keep working.
 */
const withFileIframePreview = createHigherOrderComponent((BlockEdit) => {
  const BlockEditWithFileIframePreview = (props: FileEditProps) =>
    props.name === FILE_BLOCK_NAME ? (
      <FileIframePreview {...props} BlockEdit={BlockEdit} />
    ) : (
      <BlockEdit {...props} />
    )
  return BlockEditWithFileIframePreview
  // oxlint-disable-next-line i18next/no-literal-string
}, "withFileIframePreview")

export default withFileIframePreview
