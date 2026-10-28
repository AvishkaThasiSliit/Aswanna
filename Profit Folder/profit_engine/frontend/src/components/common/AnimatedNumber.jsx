import React from 'react';
import { useCountUp } from '../../hooks/useCountUp';

export default function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 800,
  className = ''
}) {
  const animatedVal = useCountUp(typeof value === 'number' ? value : 0, duration);

  const displayString = Number(animatedVal).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  return (
    <span className={`animated-num ${className}`}>
      {prefix}{displayString}{suffix}
    </span>
  );
}
