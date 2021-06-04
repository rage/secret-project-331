import styled from "@emotion/styled"
import { Checkbox, FormControlLabel, FormGroup, FormLabel } from "@material-ui/core"
import { BlockEditProps } from "@wordpress/blocks"
import { InnerBlocks } from "@wordpress/block-editor"
import { CourseGridAttributes } from "."
import React from "react"

const ALLOWED_NESTED_BLOCKS = [""]

const CourseGridCard = styled.div`
  padding: 2rem;
  border: 1px solid black;
  border-radius: 2px;
`

const CourseGridEditor: React.FC<BlockEditProps<CourseGridAttributes>> = ({
  attributes,
  setAttributes,
  clientId,
}) => {
  return (
    <CourseGridCard id={clientId}>
      <h3>Course Parts Grid Placeholder</h3>
      <p>
        This block is placed on the course material front page for navigating to different parts
        easily.
      </p>
      <FormLabel component="legend">Settings</FormLabel>
      <FormGroup row>
        <FormControlLabel
          control={
            <Checkbox
              checked={attributes.hidden}
              onChange={() => {
                setAttributes({ hidden: !attributes.hidden })
              }}
              color="primary"
            />
          }
          label="Hide grid in course material"
        />
      </FormGroup>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </CourseGridCard>
  )
}

export default CourseGridEditor
