"use client"

import { css } from "@emotion/css"
import { InnerBlocks, InspectorControls, RichText } from "@wordpress/block-editor"
import React, { useEffect, useMemo, useRef } from "react"
import { useForm } from "react-hook-form"

import { Select } from "@/shared-module/components"
import type { BlockEditProps, Template } from "@/utils/Gutenberg/types"
import { useTranslation } from "@/utils/useCmsTranslation"

import { EMAIL_CALLOUT_ICONS, type EmailCalloutAttributes, type EmailCalloutIcon } from "."
import BlockWrapper from "../BlockWrapper"

const ALLOWED_TITLE_FORMATS = ["core/italic", "core/link"]
const ALLOWED_INNER_BLOCKS = ["core/paragraph", "core/list", "core/buttons"]
const INNER_BLOCKS_TEMPLATE: Template[] = [["core/paragraph", {}]]

const EmailCalloutEditor: React.FC<
  React.PropsWithChildren<BlockEditProps<EmailCalloutAttributes>>
> = ({ attributes, setAttributes }) => {
  const { t } = useTranslation()
  const { control, watch, setValue } = useForm<{ icon: EmailCalloutIcon }>({
    defaultValues: { icon: attributes.icon },
  })
  const selectedIcon = watch("icon")
  const savedIcon = useRef(attributes.icon)
  useEffect(() => {
    savedIcon.current = attributes.icon
    // Undo, redo and other outside changes reach the Select this way.
    setValue("icon", attributes.icon)
  }, [attributes.icon, setValue])
  useEffect(() => {
    if (selectedIcon !== savedIcon.current) {
      setAttributes({ icon: selectedIcon })
    }
  }, [selectedIcon, setAttributes])
  const iconOptions = useMemo(
    () =>
      EMAIL_CALLOUT_ICONS.map((icon) => ({
        value: icon,
        label: {
          none: t("email-callout-icon-none"),
          info: t("email-callout-icon-info"),
          calendar: t("email-callout-icon-calendar"),
          warning: t("email-callout-icon-warning"),
          check: t("email-callout-icon-check"),
        }[icon],
      })),
    [t],
  )

  return (
    <BlockWrapper>
      <InspectorControls key="settings">
        <div
          className={css`
            padding: 1rem;
          `}
        >
          <Select
            control={control}
            name="icon"
            label={t("email-callout-icon")}
            options={iconOptions}
          />
        </div>
      </InspectorControls>
      <div
        className={css`
          display: flex;
          gap: 14px;
          padding: 20px;
          background-color: #edf3f2;
          border: 1px solid #dae6e5;
          border-radius: 8px;
        `}
      >
        {attributes.icon !== "none" && (
          <img
            src={`/static/email/icon-${attributes.icon}.png`}
            width={24}
            height={24}
            alt=""
            className={css`
              flex: none;
              margin-top: 2px;
            `}
          />
        )}
        <div
          className={css`
            flex: 1;
            min-width: 0;
          `}
        >
          <RichText
            tagName="p"
            className={css`
              margin: 0 0 6px;
              font-weight: 700;
            `}
            value={attributes.title}
            onChange={(title: string) => setAttributes({ title })}
            placeholder={t("email-callout-title-placeholder")}
            aria-label={t("email-callout-title")}
            allowedFormats={ALLOWED_TITLE_FORMATS}
          />
          <InnerBlocks allowedBlocks={ALLOWED_INNER_BLOCKS} template={INNER_BLOCKS_TEMPLATE} />
        </div>
      </div>
    </BlockWrapper>
  )
}

export default EmailCalloutEditor
