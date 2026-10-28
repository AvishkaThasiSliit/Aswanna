/**
 * Placeholder expected yield table per crop (kg/acre)
 * NOTE: The SO1 Machine Learning model predicts cost of cultivation per acre, NOT yield.
 * Expected yields remain configured as agronomic benchmark constants in this file
 * pending empirical harvest survey integration with the Department of Agriculture (DoA).
 * CONFIRM WITH DoA (Department of Agriculture)
 */
export const CROP_YIELDS = {
  Paddy: 2200,   // kg/acre
  Maize: 1800,   // kg/acre
  Tomato: 3500,  // kg/acre
  Chili: 1200,   // kg/acre
};

export const DEMO_CROPS = ['Paddy', 'Maize', 'Tomato', 'Chili'];
