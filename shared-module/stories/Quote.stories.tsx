import { Meta, Story } from "@storybook/react"
import React from "react"

import Quote from "../src/components/Quote"

export default {
  title: "Components/Button",
  component: Quote,
} as Meta

const Component = Quote

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const BlockQuote: Story<ComponentProps> = Template.bind({})
BlockQuote.args = {
  children: "Quote",
  variant: "blockquote",
}

/* export const PullQuote: Story<ComponentProps> = Template.bind({})
PullQuote.args = {
  children: "Quote",
  variant: "pullquote",
}
 */
