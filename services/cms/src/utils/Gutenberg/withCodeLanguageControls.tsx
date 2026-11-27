"use client"

import { BlockControls, InspectorControls } from "@wordpress/block-editor"
import { PanelBody, SelectControl, ToolbarDropdownMenu, ToolbarGroup } from "@wordpress/components"
import { createHigherOrderComponent } from "@wordpress/compose"
import { Fragment } from "@wordpress/element"
import { code as codeIcon } from "@wordpress/icons"

import { useTranslation } from "@/utils/useCmsTranslation"

import { CODE_LANGUAGES } from "./codeLanguages"

const CODE_BLOCK_NAME = "core/code"

const DEFAULT_CODE_WIDTH = "column"
const WIDE_CODE_WIDTH = "wide"
const SMALL_CODE_FONT_SIZE = "small"
const DEFAULT_CODE_FONT_SIZE = "normal"
const LARGE_CODE_FONT_SIZE = "large"

// Adds a language selector for core/code, both as a block-toolbar dropdown and as a settings-sidebar
// panel, and width and font size settings in the sidebar. An empty language leaves highlight.js to
// auto-detect on render.
const withCodeLanguageControls = createHigherOrderComponent((BlockEdit) => {
  // oxlint-disable-next-line typescript/no-explicit-any, unicorn/consistent-function-scoping -- captures BlockEdit from HOC scope
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
          <PanelBody title={t("code-size-panel-title")} initialOpen={true}>
            <SelectControl
              label={t("code-width-label")}
              value={props.attributes.codeWidth ?? DEFAULT_CODE_WIDTH}
              options={[
                { label: t("code-width-column"), value: DEFAULT_CODE_WIDTH },
                { label: t("code-width-wide"), value: WIDE_CODE_WIDTH },
              ]}
              // The default is stored as a missing value.
              onChange={(value: string) =>
                props.setAttributes({ codeWidth: value === DEFAULT_CODE_WIDTH ? undefined : value })
              }
              help={t("code-width-help")}
            />
            <SelectControl
              label={t("code-font-size-label")}
              value={props.attributes.codeFontSize ?? DEFAULT_CODE_FONT_SIZE}
              options={[
                { label: t("code-font-size-small"), value: SMALL_CODE_FONT_SIZE },
                { label: t("code-font-size-normal"), value: DEFAULT_CODE_FONT_SIZE },
                { label: t("code-font-size-large"), value: LARGE_CODE_FONT_SIZE },
              ]}
              onChange={(value: string) =>
                props.setAttributes({
                  codeFontSize: value === DEFAULT_CODE_FONT_SIZE ? undefined : value,
                })
              }
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
