import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'destructive' | 'outline' | 'ghost' | 'secondary';
type Size = 'default' | 'sm' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  default: 'bg-[#f5c518] text-black hover:bg-[#ffd740]',
  destructive: 'bg-[#ef4444] text-white hover:bg-red-600',
  outline: 'border border-[#2a2a2a] bg-transparent hover:bg-[#222]',
  ghost: 'bg-transparent hover:bg-[#222]',
  secondary: 'bg-[#1a1a1a] text-white hover:bg-[#222]',
};

const sizes: Record<Size, string> = {
  default: 'h-10 px-4 py-2',
  sm: 'h-8 px-3 text-sm',
  lg: 'h-11 px-6',
  icon: 'h-9 w-9',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c518] disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
