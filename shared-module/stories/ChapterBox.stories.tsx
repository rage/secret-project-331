import { Meta, Story } from "@storybook/react"
import React from "react"

import ChapterBox from "../src/components/ChapterBox"

export default {
  title: "Components/ChapterBox",
  component: ChapterBox,
} as Meta

const Component = ChapterBox

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {}
