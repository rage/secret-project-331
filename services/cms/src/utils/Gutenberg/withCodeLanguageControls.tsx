"use client"

import { BlockControls, InspectorControls } from "@wordpress/block-editor"
import { PanelBody, SelectControl, ToolbarDropdownMenu, ToolbarGroup } from "@wordpress/components"
import { createHigherOrderComponent } from "@wordpress/compose"
import { Fragment } from "@wordpress/element"
import { code as codeIcon } from "@wordpress/icons"

import { useTranslation } from "@/utils/useCmsTranslation"

import { CODE_LANGUAGES } from "./codeLanguages"

const CODE_BLOCK_NAME = "core/code"

// Adds a language selector for core/code, both as a block-toolbar dropdown and as a settings-sidebar
// panel. An empty value clears the attribute, leaving highlight.js to auto-detect on render.
const withCodeLanguageControls = createHigherOrderComponent((BlockEdit) => {
  // oxlint-disable-next-line typescript/no-explicit-any
  const CodeWithLanguageControls = (props: any) => {
    const { t } = useTranslation()
    if (props.name !== CODE_BLOCK_NAME) {
      return <BlockEdit {...props} />
    }

    const autoDetectLabel = t("code-language-auto-detect")
    const options = [{ label: autoDetectLabel, value: "" }, ...CODE_LANGUAGES]
    const currentValue = props.attributes.language ?? ""
    const currentLabel =
      options.find((option) => option.value === currentValue)?.label ?? autoDetectLabel

    const setLanguage = (value: string) => {
      props.setAttributes({ language: value === "" ? undefined : value })
    }

    return (
      <Fragment>
        <BlockEdit {...props} />
        <BlockControls>
          <ToolbarGroup>
            <ToolbarDropdownMenu
              icon={codeIcon}
              label={t("code-language-label")}
              text={currentLabel}
              controls={options.map((option) => ({
                title: option.label,
                isActive: currentValue === option.value,
                onClick: () => setLanguage(option.value),
              }))}
            />
          </ToolbarGroup>
        </BlockControls>
        <InspectorControls>
          <PanelBody title={t("code-language-panel-title")} initialOpen={true}>
            <SelectControl
              label={t("code-language-label")}
              value={currentValue}
              options={options}
              onChange={(value: string) => setLanguage(value)}
              help={t("code-language-help")}
            />
          </PanelBody>
        </InspectorControls>
      </Fragment>
    )
  }

  CodeWithLanguageControls.displayName = "CodeWithLanguageControls"
  return CodeWithLanguageControls
  // oxlint-disable-next-line i18next/no-literal-string
}, "withCodeLanguageControls")

export default withCodeLanguageControls
