import { InspectorControls } from "@wordpress/block-editor"
import { PanelBody, TextControl } from "@wordpress/components"
import { createHigherOrderComponent } from "@wordpress/compose"
import { Fragment } from "@wordpress/element"

// https://developer.wordpress.org/block-editor/reference-guides/filters/block-filters/#editor-blockedit
const withMentimeterInspector = createHigherOrderComponent((BlockEdit) => {
  const mentiMeterEmbed = (props: any) => {
    if (props.attributes.providerNameSlug !== "mentimeter") {
      return <BlockEdit {...props} />
    }

    function updateQueryStringParameter(url: string | undefined, key: string, value: string) {
      if (!url) {
        return
      }
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
          <PanelBody title={"Mentimeter attributes"} initialOpen={true}>
            <p>
              Please first set the URL in the input box on the left and then press the Embed. After
              that you can edit the height and title.
            </p>
            <TextControl
              key={"title-edit"}
              label={"Title"}
              value={title}
              onChange={(value) => {
                props.setAttributes({
                  title: value,
                  url: updateQueryStringParameter(url, "title", value),
                })
                console.log(url)
              }}
              help={"Set a title which is used for example by screen readers."}
            />
            <TextControl
              key={"height-edit"}
              label={"Height"}
              value={height}
              onChange={(value) => {
                props.setAttributes({
                  height: value,
                  url: updateQueryStringParameter(url, "height", value),
                })
                console.log(url)
              }}
              help={"Set the correct height so that the scrollbar disappears."}
            />
          </PanelBody>
        </InspectorControls>
      </Fragment>
    )
  }
  mentiMeterEmbed.displayName = "MentimeterComponent"
  return mentiMeterEmbed
}, "withMentimeterInspector")

export default withMentimeterInspector
