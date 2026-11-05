import * as RT from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RT.Provider delayDuration={400} skipDelayDuration={200}>
      {children}
    </RT.Provider>
  )
}

/** Hover/focus hint. Never the only place information lives: icon buttons also carry aria-label. */
export function Tooltip({ content, shortcut, children }: { content: string; shortcut?: string; children: ReactNode }) {
  return (
    <RT.Root>
      <RT.Trigger asChild>{children}</RT.Trigger>
      <RT.Portal>
        <RT.Content className="tooltip" side="top" sideOffset={6}>
          {content}
          {shortcut && <kbd>{shortcut}</kbd>}
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  )
}
