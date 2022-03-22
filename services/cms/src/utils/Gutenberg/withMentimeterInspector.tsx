import { css } from "@emotion/css"
import { InspectorControls } from "@wordpress/block-editor"
import { PanelBody, TextControl } from "@wordpress/components"
import { createHigherOrderComponent } from "@wordpress/compose"
import { Fragment } from "@wordpress/element"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../../shared-module/styles"

// https://developer.wordpress.org/block-editor/reference-guides/filters/block-filters/#editor-blockedit
const withMentimeterInspector = createHigherOrderComponent((BlockEdit) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MentiMeterEmbed = (props: any) => {
    const { t } = useTranslation()
    if (props.attributes.providerNameSlug !== "mentimeter") {
      return <BlockEdit {...props} />
    }

    function updateQueryStringParameter(url: string | undefined, key: string, value: string) {
      if (!url) {
        return
      }
      // eslint-disable-next-line i18next/no-literal-string
      const re = new RegExp("([?&])" + key + "=.*?(&|$)", "i")
      const separator = url.indexOf("?") !== -1 ? "&" : "?"
      if (url.match(re)) {
        return url.replace(re, "$1" + key + "=" + value + "$2")
      } else {
        return url + separator + key + "=" + value
      }
    }

    const { height, title, url } = props.attributes
    return (
      <Fragment>
        <BlockEdit {...props} />
        <InspectorControls>
          <PanelBody title={t("menti-panel-title")} initialOpen={true}>
            <p
              className={css`
                font-size: ${baseTheme.fontSizes[0]};
                margin: 1rem 0;
              `}
            >
              {t("menti-panel-instructions")}
            </p>
            <TextControl
              key={"title-edit"}
              label={t("menti-title-label")}
              value={title}
              onChange={(value) => {
                props.setAttributes({
                  title: value,
                  // eslint-disable-next-line i18next/no-literal-string
                  url: updateQueryStringParameter(url, "title", value),
                })
              }}
              help={t("menti-title-help-text")}
            />
            <TextControl
              key={"height-edit"}
              label={t("menti-height-label")}
              value={height}
              onChange={(value) => {
                props.setAttributes({
                  height: value,
                  // eslint-disable-next-line i18next/no-literal-string
                  url: updateQueryStringParameter(url, "height", value),
                })
              }}
              help={t("menti-height-help-text")}
            />
          </PanelBody>
        </InspectorControls>
      </Fragment>
    )
  }
  // eslint-disable-next-line i18next/no-literal-string
  MentiMeterEmbed.displayName = "MentimeterComponent"
  return MentiMeterEmbed
  // eslint-disable-next-line i18next/no-literal-string
}, "withMentimeterInspector")

export default withMentimeterInspector
