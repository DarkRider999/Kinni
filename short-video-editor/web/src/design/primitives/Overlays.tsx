import * as RDialog from '@radix-ui/react-dialog'
import * as RToast from '@radix-ui/react-toast'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { ToastContext, type ToastInput } from './toast-context'

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
}

/** Modal used for export (S16), confirms and the plans sheet (S18). Focus is trapped and restored; Esc closes. */
export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="dialog-overlay" />
        <RDialog.Content className="dialog-content">
          <RDialog.Title className="dialog-title">{title}</RDialog.Title>
          {description ? (
            <RDialog.Description className="dialog-description">{description}</RDialog.Description>
          ) : (
            <RDialog.Description className="sr-only">{title}</RDialog.Description>
          )}
          {children && <div className="dialog-body">{children}</div>}
          {footer && <div className="dialog-footer">{footer}</div>}
          <div className="dialog-close">
            {/* No tooltip here: focus lands on this button when the dialog opens,
                and an open tooltip would swallow the first Escape. */}
            <RDialog.Close className="icon-btn" aria-label="Close">
              <X size={16} aria-hidden="true" />
            </RDialog.Close>
          </div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

interface ToastItem extends ToastInput {
  id: number
}

/** App-level toast host. Errors stay until dismissed; others auto-hide after 5s. Announced politely. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((t: ToastInput) => {
    setItems((prev) => [...prev.slice(-3), { ...t, id: Date.now() + Math.random() }])
  }, [])
  const remove = (id: number) => setItems((prev) => prev.filter((i) => i.id !== id))
  const icons = useMemo(
    () => ({
      success: <CheckCircle2 size={18} aria-hidden="true" />,
      error: <AlertCircle size={18} aria-hidden="true" />,
      info: <Info size={18} aria-hidden="true" />,
    }),
    [],
  )

  return (
    <ToastContext.Provider value={push}>
      <RToast.Provider swipeDirection="right">
        {children}
        {items.map((t) => (
          <RToast.Root
            key={t.id}
            className="toast"
            data-tone={t.tone}
            type={t.tone === 'error' ? 'foreground' : 'background'}
            duration={t.tone === 'error' ? Infinity : 5000}
            onOpenChange={(open) => !open && remove(t.id)}
          >
            <span className="toast-icon">{icons[t.tone]}</span>
            <div>
              <RToast.Title className="toast-title">{t.title}</RToast.Title>
              {t.description && <RToast.Description className="toast-description">{t.description}</RToast.Description>}
            </div>
            <RToast.Close asChild>
              <button type="button" className="icon-btn" aria-label="Dismiss notification">
                <X size={14} aria-hidden="true" />
              </button>
            </RToast.Close>
          </RToast.Root>
        ))}
        <RToast.Viewport className="toast-viewport" />
      </RToast.Provider>
    </ToastContext.Provider>
  )
}

