import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Lightbulb, CheckCircle } from 'lucide-react';

export default function AiRecommendations({ recommendations = [] }) {
  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div className="ai-recommendations-section">
      <div className="section-head-row">
        <div className="title-with-sparkle">
          <Sparkles size={18} color="#059669" />
          <h3>AI Agronomic & Market Decision Insights</h3>
        </div>
        <span className="sub-tag">Automated Decision Support</span>
      </div>

      <div className="recommendations-cards-grid">
        {recommendations.map((rec, idx) => (
          <motion.div
            key={rec.id || idx}
            whileHover={{ y: -3 }}
            className="ai-rec-card"
          >
            <div className="rec-card-icon-box">
              <Lightbulb size={18} />
            </div>
            <div className="rec-card-content">
              <h4>{rec.title}</h4>
              <p>{rec.text || rec.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
