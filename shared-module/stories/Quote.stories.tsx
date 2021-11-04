/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import Quote from "../src/components/Quote"

export default {
  title: "Components/Quote",
  component: Quote,
} as Meta

const Component = Quote

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const BlockQuote: Story<ComponentProps> = Template.bind({})
BlockQuote.args = {
  children: "Quote",
  variant: "blockquote",
  content:
    "Just like a pull quote blockquote (actually block quotations) are also set off from the main text as a distinct paragraph or block. However, they refer to some external citation which isn’t already mentioned in the article. Block quotations are usually placed within the reader’s flow",
}

/* export const PullQuote: Story<ComponentProps> = Template.bind({})
PullQuote.args = {
  children: "Quote",
  variant: "pullquote",
}
 */
