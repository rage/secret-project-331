import { InspectorControls } from "@wordpress/block-editor"
import { PanelBody } from "@wordpress/components"
import { createHigherOrderComponent } from "@wordpress/compose"
import { count } from "@wordpress/wordcount"
import { Fragment } from "react"

export const blockWithWordCount = createHigherOrderComponent((BlockEdit) => {
  // eslint-disable-next-line react/display-name
  return (props) => {
    return (
      <Fragment>
        {props.attributes.content && (
          <InspectorControls>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <PanelBody>words: {count(props.attributes.content, "words")}</PanelBody>
          </InspectorControls>
        )}
        <BlockEdit {...props} />
      </Fragment>
    )
  }
  // eslint-disable-next-line i18next/no-literal-string
}, "BlockWithWordCount")
