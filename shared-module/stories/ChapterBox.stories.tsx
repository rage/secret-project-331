import { Meta, Story } from "@storybook/react"
import React from "react"

import PagesInChapterBox from "../src/components/PagesInChapterBox"

export default {
  title: "Components/ChapterBox",
  component: PagesInChapterBox,
} as Meta

const Component = PagesInChapterBox

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Selected: Story<ComponentProps> = Template.bind({})
Selected.args = {
  children: "ChapterBox",
  chapterIndex: 1,
  chapterTitle: "Introduction to everything",
  selected: true,
}
