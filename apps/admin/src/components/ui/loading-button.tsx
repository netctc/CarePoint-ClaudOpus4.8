'use client';

import React from 'react';

export type LoadingButtonVariant = 'primary' | 'secondary' | 'danger';

export interface LoadingButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: LoadingButtonVariant;
}

export function LoadingButton({
  isLoading = false,
  variant = 'primary',
  disabled,
  className,
  children,
  ...props
}: LoadingButtonProps) {
  const classes = ['button', variant, className].filter(Boolean).join(' ');

  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      style={isLoading ? { opacity: 0.7, pointerEvents: 'none' } : undefined}
      {...props}
    >
      {isLoading && <span className="loading-button-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
