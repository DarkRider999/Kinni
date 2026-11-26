'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  destructive?: boolean;
  requireTyping?: string; // Must type this string to confirm
}

export function ConfirmModal({
  open, onClose, onConfirm, title, message,
  confirmText = 'Confirm', destructive, requireTyping,
}: ConfirmModalProps) {
  const [typed, setTyped] = useState('');

  if (!open) return null;

  const canConfirm = !requireTyping || typed === requireTyping;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}>
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6 max-w-md w-full mx-4"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className={destructive ? 'text-red-400' : 'text-[#f5c518]'} size={24} />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <p className="text-[#a0a0a0] mb-4">{message}</p>
        {requireTyping && (
          <div className="mb-4">
            <p className="text-sm text-[#666] mb-2">
              Type <code className="text-red-400">{requireTyping}</code> to confirm:
            </p>
            <input type="text" value={typed}
              onChange={e => setTyped(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded px-3 py-2 text-sm"
            />
          </div>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={!canConfirm}
            onClick={() => { onConfirm(); onClose(); setTyped(''); }}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
