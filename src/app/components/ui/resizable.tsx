import * as React from "react"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@radix-ui/react-resizable"

import { cn } from "@/lib/utils"

const ResizableGroup = ({ className, ...props }: React.ComponentProps<typeof ResizablePanelGroup>) => (
  <ResizablePanelGroup className={cn("flex h-full w-full data-[panel-group-direction=vertical]:flex-col", className)} {...props} />
)

const ResizablePanelContent = React.forwardRef<
  React.ElementRef<typeof ResizablePanel>,
  React.ComponentPropsWithoutRef<typeof ResizablePanel>
>(({ className, ...props }, ref) => (
  <ResizablePanel
    ref={ref}
    className={cn("min-h-0 min-w-0 overflow-hidden", className)}
    {...props}
  />
))
ResizablePanelContent.displayName = "ResizablePanelContent"

const ResizableHandleElement = React.forwardRef<
  React.ElementRef<typeof ResizableHandle>,
  React.ComponentPropsWithoutRef<typeof ResizableHandle>
>(({ className, ...props }, ref) => (
  <ResizableHandle
    ref={ref}
    className={cn(
      "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0",
      className
    )}
    {...props}
  >
    <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-background data-[panel-group-direction=vertical]:h-3 data-[panel-group-direction=vertical]:w-4" />
  </ResizableHandle>
))
ResizableHandleElement.displayName = "ResizableHandleElement"

export { ResizableGroup, ResizablePanelContent, ResizableHandleElement }