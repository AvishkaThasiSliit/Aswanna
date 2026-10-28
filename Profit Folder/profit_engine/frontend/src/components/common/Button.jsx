import React from 'react';

export default function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'ghost' | 'danger'
  size = 'md',        // 'sm' | 'md' | 'lg'
  icon: Icon,
  disabled = false,
  onClick,
  className = '',
  type = 'button',
  title,
  ...props
}) {
  const baseClass = `btn-${variant}`;
  const sizeClass = `btn-${size}`;

  return (
    <button
      type={type}
      className={`aswenna-btn ${baseClass} ${sizeClass} ${className}`}
      disabled={disabled}
      onClick={onClick}
      title={title}
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />}
      {children}
    </button>
  );
}
