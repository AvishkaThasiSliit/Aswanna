import React, { useState, useEffect } from 'react';
import aswennaLogoWhite from '../../images/aswenna-logo-white.png';

export default function SplashScreen({ onFinish }) {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Simulated loading progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const delta = Math.floor(Math.random() * 14) + 10;
        return Math.min(100, prev + delta);
      });
    }, 110);

    // Complete splash sequence after 2.3 seconds
    const timer = setTimeout(() => {
      setIsFadingOut(true);
      setTimeout(() => {
        if (onFinish) onFinish();
      }, 700);
    }, 2300);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [onFinish]);

  const handleSkip = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      if (onFinish) onFinish();
    }, 450);
  };

  return (
    <div
      className={`aswenna-splash-overlay ${isFadingOut ? 'splash-fade-out' : ''}`}
      onClick={handleSkip}
    >
      {/* Designed Rich Emerald Green Background */}
      <div className="aswenna-splash-green-bg" />

      {/* Ambient Center Glow */}
      <div className="aswenna-splash-glow-aura" />

      {/* Subtle Botanical Grain / Watermark */}
      <div className="aswenna-splash-mesh-pattern" />

      {/* Centerpiece: White Logo, Animated Spinner & Typography */}
      <div className="aswenna-splash-center-content">
        {/* Prominent White Logo */}
        <div className="aswenna-splash-logo-wrap">
          <img
            src={aswennaLogoWhite}
            alt="Aswenna (අස්වැන්න)"
            className="aswenna-splash-white-logo"
          />
        </div>

        {/* Dynamic Rotating 12-Dot Dotted Green/Mint Spinner */}
        <div className="aswenna-spinner-wrapper">
          <svg
            className="aswenna-dotted-spinner-svg"
            viewBox="0 0 60 60"
            width="50"
            height="50"
          >
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 30 * Math.PI) / 180;
              const cx = 30 + 20 * Math.cos(angle);
              const cy = 30 + 20 * Math.sin(angle);
              const opacity = 0.2 + ((i + 1) / 12) * 0.8;
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r="3.2"
                  fill="#6ee7b7"
                  opacity={opacity}
                />
              );
            })}
          </svg>
        </div>

        {/* Status text & Subtitle */}
        <div className="aswenna-splash-text-group">
          <span className="aswenna-splash-loading-text">
            Loading<span className="dots-pulse">...</span>
          </span>
          <span className="aswenna-splash-tagline">
            Smarter Decisions for a Better Harvest
          </span>
        </div>

        {/* Minimalist Emerald Progress Indicator */}
        <div className="aswenna-splash-progress-bar-wrap">
          <div
            className="aswenna-splash-progress-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Subtle Skip Hint */}
      <button
        type="button"
        className="aswenna-splash-skip-btn"
        onClick={(e) => {
          e.stopPropagation();
          handleSkip();
        }}
      >
        Click anywhere to enter
      </button>
    </div>
  );
}
