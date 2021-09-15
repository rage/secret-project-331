import { Meta, Story } from "@storybook/react"
import React from "react"

import Banner from "../src/components/Banner/Banner"

export default {
  title: "Components/Banner",
  component: Banner,
} as Meta

const Component = Banner

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const TextBanner: Story<ComponentProps> = Template.bind({})
TextBanner.args = {
  children: (
    <>
      Just like a pull quote blockquote (actually block quotations) are also set off from the main
      text as a distinct paragraph or block. However, they refer to some external citation which
      isn’t already mentioned in the article. Block quotations are usually placed within the
      reader’s flow
    </>
  ),
  variant: "text",
}
export const LinkBanner: Story<ComponentProps> = Template.bind({})
LinkBanner.args = {
  children: (
    <>
      Just like a pull quote blockquote (actually block quotations) are also set off from the main
      text as a distinct paragraph or block. However, they refer to some external citation which
      isn’t already mentioned in the article. Block quotations are usually placed within the
      reader’s flow
    </>
  ),
  variant: "link",
}
export const ReadOnlyBanner: Story<ComponentProps> = Template.bind({})
ReadOnlyBanner.args = {
  children: (
    <>
      Just like a pull quote blockquote (actually block quotations) are also set off from the main
      text as a distinct paragraph or block. However, they refer to some external citation which
      isn’t already mentioned in the article. Block quotations are usually placed within the
      reader’s flow
    </>
  ),
  variant: "readOnly",
}
