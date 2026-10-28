import { useState, useEffect } from 'react';

export function useCountUp(targetNumber, durationMs = 800) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    // Respect prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(targetNumber);
      return;
    }

    if (targetNumber === null || targetNumber === undefined || isNaN(targetNumber)) {
      setValue(0);
      return;
    }

    const start = value;
    const end = Number(targetNumber);
    const startTime = performance.now();

    let animationFrameId;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * easeProgress;

      setValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setValue(end);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [targetNumber, durationMs]);

  return value;
}
