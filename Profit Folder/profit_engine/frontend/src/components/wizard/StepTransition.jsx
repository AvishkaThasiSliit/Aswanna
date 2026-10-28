import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCalculatorStore } from '../../state/calculatorStore';

const variants = {
  enter: (direction) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.28,
      ease: [0.16, 1, 0.3, 1]
    }
  },
  exit: (direction) => ({
    x: direction > 0 ? -50 : 50,
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: [0.16, 1, 0.3, 1]
    }
  })
};

export default function StepTransition({ children, stepKey }) {
  const direction = useCalculatorStore(s => s.direction);

  return (
    <div className="step-transition-container" style={{ position: 'relative', overflow: 'hidden' }}>
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={stepKey}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          className="step-motion-wrapper"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
