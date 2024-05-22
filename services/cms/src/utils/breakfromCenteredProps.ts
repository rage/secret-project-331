import { WithSidebar } from "@/shared-module/common/components/Centering/BreakFromCentered"
import {
  CMS_EDITOR_SIDEBAR_THRESHOLD,
  CMS_EDITOR_SIDEBAR_WIDTH,
} from "@/shared-module/common/utils/constants"

/* eslint-disable i18next/no-literal-string */
const breakFromCenteredProps: WithSidebar = {
  sidebar: true,
  sidebarPosition: "right",
  sidebarWidth: CMS_EDITOR_SIDEBAR_WIDTH,
  sidebarThreshold: CMS_EDITOR_SIDEBAR_THRESHOLD,
}

export default breakFromCenteredProps
