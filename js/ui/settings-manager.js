/**
 * settings-manager.js - Settings Management
 * 
 * Handles application settings and preferences.
 */

(function () {
  // Ensure namespace exists and is accessible
  if (typeof window.PrinterCalc === 'undefined') {
    window.PrinterCalc = {};
    console.log("Created PrinterCalc namespace in SettingsManager");
  }

  // Make sure we have default constants if needed
  if (!window.PrinterCalc.CONSTANTS) {
    console.warn("CONSTANTS not available, creating minimal version for SettingsManager");
    window.PrinterCalc.CONSTANTS = {
      PRICING: {
        USD: { powder: 100.00, binder: 0.09, silica: 0.072, glaze: 0.01 },
        EUR: { powder: 92.86, binder: 0.085, silica: 0.069, glaze: 0.0098 },
        JPY: { powder: 14285.71, binder: 12.50, silica: 11.00, glaze: 1.56 },
        SGD: { powder: 135.00, binder: 0.12, silica: 0.10, glaze: 0.0137 }
      },
      CURRENCY_SYMBOLS: {
        USD: '$', EUR: '€', JPY: '¥', SGD: 'S$'
      }
    };
  }

  // Create a settings manager module
  window.PrinterCalc.SettingsManager = {}; // This closes the SettingsManager object definition
})(); // This closes the IIFE started at the beginning of the file