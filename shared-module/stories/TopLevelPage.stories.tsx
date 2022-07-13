/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import TopLevelPage from "../src/components/TopLevelPage"

export default {
  title: "Components/TopLevelPage",
  component: TopLevelPage,
} as Meta

const Component = TopLevelPage

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  title: "FAQ",
  url: "/",
}
