/* eslint-disable i18next/no-literal-string */
import { Meta, Story } from "@storybook/react"
import React from "react"

import SideNavigation from "../src/components/Forum/SideNavigation"

export default {
  title: "Components/Forum/SideNavigation",
  component: SideNavigation,
} as Meta

const Component = SideNavigation

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: "SideNavigation",
}
