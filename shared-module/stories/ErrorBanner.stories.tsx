import { Meta, Story } from "@storybook/react"
import React from "react"

import ErrorBanner from "../src/components/ErrorBanner"

export default {
  title: "Components/ErrorBanner",
  component: ErrorBanner,
} as Meta

const Component = ErrorBanner

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {}
