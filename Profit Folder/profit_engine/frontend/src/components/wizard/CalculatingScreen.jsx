import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useCalculatorStore } from '../../state/calculatorStore';

export default function CalculatingScreen({ onComplete }) {
  const isCalculating = useCalculatorStore(s => s.isCalculating);
  const finishCalculation = useCalculatorStore(s => s.finishCalculation);

  useEffect(() => {
    // Keep plant growing animation for at least 1.6 seconds for delightful UX
    const timer = setTimeout(() => {
      if (!isCalculating) {
        finishCalculation();
        if (onComplete) onComplete();
      }
    }, 1600);

    return () => clearTimeout(timer);
  }, [isCalculating, finishCalculation, onComplete]);

  return (
    <div className="calculating-screen-wrapper">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="calculating-plant-card"
      >
        {/* Animated growing plant SVG */}
        <div className="plant-animation-box">
          <svg viewBox="0 0 160 160" width="160" height="160">
            {/* Ground mound */}
            <path
              d="M 20 135 Q 80 120 140 135 L 140 150 L 20 150 Z"
              fill="#78350f"
              opacity="0.35"
            />
            {/* Stem growing */}
            <motion.path
              d="M 80 135 Q 76 90 80 50"
              stroke="#059669"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
            {/* Left Leaf unfolding */}
            <motion.path
              d="M 78 85 C 50 75 45 55 75 65 C 78 75 78 85 78 85 Z"
              fill="#10b981"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6, type: "spring" }}
            />
            {/* Right Leaf unfolding */}
            <motion.path
              d="M 80 70 C 110 60 115 40 85 50 C 82 60 80 70 80 70 Z"
              fill="#34d399"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.6, type: "spring" }}
            />
            {/* Bud / Sun Glow */}
            <motion.circle
              cx="80"
              cy="48"
              r="7"
              fill="#fbbf24"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.3, 1] }}
              transition={{ delay: 1.1, duration: 0.5 }}
            />
          </svg>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="calculating-text-box"
        >
          <div className="cal-title-row">
            <Sparkles size={20} className="spin-slow" color="#10b981" />
            <h3>Synthesizing Agronomic & Market Intelligence</h3>
          </div>
          <p>
            Running ExtraTrees cost model • Querying wholesale price forecasts • Computing multi-channel transport logistics...
          </p>
        </motion.div>

        {/* Progress indicator bar */}
        <div className="calculating-bar-track">
          <motion.div
            className="calculating-bar-progress"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.6, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </div>
  );
}
