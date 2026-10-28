import React from 'react';

export default function Card({
  children,
  className = '',
  elevation = 'base', // 'none' | 'base' | 'hover' | 'glass'
  onClick,
  style = {},
  ...props
}) {
  const elevClass = `card-elev-${elevation}`;

  return (
    <div
      className={`aswenna-card ${elevClass} ${className}`}
      onClick={onClick}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}
