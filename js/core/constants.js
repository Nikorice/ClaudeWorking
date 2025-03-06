/**
 * constants.js - Core Constants Module
 * 
 * This module defines all fixed constants used throughout the application.
 * Centralizing these values makes maintenance easier and ensures consistency.
 */

// Create a namespace for our constants to avoid global scope pollution
const PrinterCalc = window.PrinterCalc || {};

// Material constants
PrinterCalc.CONSTANTS = {
  // Material properties
  MATERIALS: {
    // Powder density in kg/cm³
    POWDER_DENSITY: 0.002,
    
    // Binder ratio in ml/cm³
    BINDER_RATIO: 0.27,
    
    // Silica density in g/cm³
    SILICA_DENSITY: 0.55,
    
    // Glaze formula: g = 0.1615 * volume + 31.76
    GLAZE_FACTOR: 0.1615,
    GLAZE_BASE: 31.76
  },
  
  // Printer specifications
  PRINTERS: {
    // Printer 400 specs
    '400': {
      name: 'Printer 400',
      dimensions: {
        width: 390,
        depth: 290,
        height: 200
      },
      // Seconds per 0.1mm layer
      layerTime: 45,
      // Print area margins in mm
      wallMargin: 10
    },
    
    // Printer 600 specs
    '600': {
      name: 'Printer 600',
      dimensions: {
        width: 595,
        depth: 600,
        height: 250
      },
      // Seconds per 0.1mm layer
      layerTime: 35,
      // Print area margins in mm
      wallMargin: 10
    }
  },
  
  // Spacing settings
  SPACING: {
    // Default object spacing in mm
    OBJECT_SPACING: 15,
    
    // Layer height in mm
    LAYER_HEIGHT: 0.1
  },
  
  // Material pricing by currency
  PRICING: {
    // USD pricing
    USD: {
      // Price per kg
      powder: 100.00,
      
      // Price per ml
      binder: 0.09,
      
      // Price per g
      silica: 0.072,
      
      // Price per g
      glaze: 0.01
    },
    
    // EUR pricing
    EUR: {
      powder: 92.86,
      binder: 0.085,
      silica: 0.069,
      glaze: 0.0098
    },
    
    // JPY pricing
    JPY: {
      powder: 14285.71,
      binder: 12.50,
      silica: 11.00,
      glaze: 1.56
    },
    
    // SGD pricing
    SGD: {
      powder: 135.00,
      binder: 0.12,
      silica: 0.10,
      glaze: 0.0137
    }
  },
  
  // Currency symbols for display
  CURRENCY_SYMBOLS: {
    USD: '$',
    EUR: '€',
    JPY: '¥',
    SGD: 'S$'
  }
};

// Export the namespace to make it globally available
window.PrinterCalc = PrinterCalc;