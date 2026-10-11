import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'error' | 'info'
export interface ToastInput {
  tone: ToastTone
  title: string
  description?: string
}

export const ToastContext = createContext<((t: ToastInput) => void) | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
