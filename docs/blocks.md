# Developing a block

There are two kind of blocks, one which is shown during the editing of the course and another when it's displayed. Let's start off by going through the editing block which is done in the CMS microservice.

## Edit block in CMS

In order to create a block in CMS, create a folder in `services/cms/src/blocks` directory and three files:

- `save.tsx` which contains the block's save view
- `edit.tsx` which contains the block's edit view
- `index.tsx` which contains configuration of the block

Let's start by creating `save.tsx` which contains a compoenent that is displayed when the block is saved:

```typescript
import { InnerBlocks } from "@wordpress/block-editor"

const MyCMSBlockSave: React.FC = () => {
  return (
    <div>
      <InnerBlocks.Content />
    </div>
  )
}

export default MyCMSBlockSave
```

Now that the `save.tsx` is ready we can move on to `edit.tsx` file which handles what the block looks like when it's being edited:

```typescript
import React from "react"

import { BlockEditProps } from "@wordpress/blocks"
import { InnerBlocks } from "@wordpress/block-editor"

interface BlockPlaceholderWrapperProps {
  id: string
}

const BlockPlaceholderWrapper: React.FC<BlockPlaceholderWrapperProps> = ({ id, children }) => {
  return <PlaceholderWrapperDiv id={id}>{children}</PlaceholderWrapperDiv>
}

const ALLOWED_NESTED_BLOCKS = [""]

const MyCMSBlockEditor: React.FC<BlockEditProps<Record<string, never>>> = ({ clientId }) => {
  return (
    <BlockPlaceholderWrapper id={clientId}>
      <h3>Place holder for the CMS Block</h3>
      <p>Some description for the placeholder</p>
      <InnerBlocks allowedBlocks={ALLOWED_NESTED_BLOCKS} />
    </BlockPlaceholderWrapper>
  )
}
```

Here, `ALLOWED_NESTED_BLOCKS` contains the components that are allowed to be inside the created block. This is optional. For further information about attributes, see this link https://developer.wordpress.org/block-editor/reference-guides/block-api/block-attributes/

Now, all that's remaining is the block's configuration which contains the metadata of the block. This is done in the `index.tsx` file.

```typescript
import { BlockConfiguration } from "@wordpress/blocks"

const NewCMSBlock: BlockConfiguration = {
  title: "Title of your component",
  description: "Description of your component",
  category: "category, e.g. 'embed'",
  attributes: {},
  edit: MyCMSBlockEditor,
  save: MyCMSBlockSave,
}

export default NewCMSBlock
```

Finally, we can connect the component to be rendered in the CMS by adding a line to blockTypeMap in `cms/src/blocks/index.tsx`-file

```typescript
export const blockTypeMap: Array<[string, BlockConfiguration]> = [
  ["moocfi/exercise", Exercise],
  ["moocfi/exercise-task", ExerciseTask],
  ["moocfi/course-grid", CourseGrid],
  ["moocfi/pages-in-chapter", PagesInChapter],
  ["moocfi/exercises-in-chapter", ExerciseInChapter],
  ["moocfi/course-progress", CourseProgress],
  ["moocfi/chapter-progress", ChapterProgress],
  ["moocfi/my-cms-component", NewCMSBlock], // Add your component here
]
```

## Display block in Course-Material

Creating a display block in course material is similar to creating a component in cms with few differences. Here you don't need to create a configuration. Let's start creating a display block by creating a file `MyRenderComponent.tsx` in `services/course-material/src/components/ContentRenderer` and add the following content to it:

```typescript
import { BlockRendererProps } from "."

const MyRendererComponent: React.FC<BlockRendererProps<HeadingBlockAttributes>> = ({ data }) => {
  const attributes = data.attributes

  return <div> {attributes.text} </div>
}

export default MyRendererComponent
```

The renderer component gets data as props which can be used internally.

Finally add the component to `blockToRendererMap` in the `index.tsx`

```typescript
...
const blockToRendererMap: { [blockName: string]: any } = {
  "core/paragraph": ParagraphBlock,
  "core/list": ListBlock,
  "core/image": ImageBlock,
  "core/heading": HeadingBlock,
  "core/buttons": ButtonBlock,
  "core/code": CodeBlock,
  "core/quote": QuoteBlock,
  "core/html": CustomHTMLBlock,
  "core/verse": VerseBlock,
  "core/cover": CoverBlock,
  "core/pullquote": PullquoteBlock,
  "core/preformatted": PreformatterBlock,
  "core/columns": TableBlock,
  "moocfi/exercise": ExerciseBlock,
  "moocfi/exercises-in-chapter": ExerciseListBlock,
  "moocfi/pages-in-chapter": PagesListBlock,
  "moocfi/my-render-component": MyRendererComponent
}
...
```
