/**
 * material-calculator.js - Material Cost Calculation
 * 
 * Handles calculation of material usage and costs for 3D printing.
 */

(function () {
  // Make sure the namespace exists
  window.PrinterCalc = window.PrinterCalc || {};

  // Create a calculator module
  PrinterCalc.MaterialCalculator = {
    /**
     * Calculate material usage and costs for an object
     * @param {number} volumeCm3 - Volume in cubic centimeters
     * @param {boolean} applyGlaze - Whether to apply glaze
     * @param {string} currency - Currency code
     * @returns {Object} Material usage and cost data
     */
    calculate: function (volumeCm3, applyGlaze = true, currency = 'USD') {
      // Validate inputs with fallback if Utils isn't available
      if ((PrinterCalc.Utils && typeof PrinterCalc.Utils.isPositiveNumber === 'function' &&
        !PrinterCalc.Utils.isPositiveNumber(volumeCm3)) ||
        !(typeof volumeCm3 === 'number' && !isNaN(volumeCm3) && volumeCm3 > 0)) {
        throw new Error('Invalid volume');
      }

      // Get material constants
      const { POWDER_DENSITY, BINDER_RATIO, SILICA_DENSITY, GLAZE_FACTOR, GLAZE_BASE } = PrinterCalc.CONSTANTS.MATERIALS;

      // Get pricing data for selected currency
      const pricing = PrinterCalc.CONSTANTS.PRICING[currency] || PrinterCalc.CONSTANTS.PRICING.USD;

      // Calculate material quantities
      const powder = volumeCm3 * POWDER_DENSITY; // kg
      const binder = volumeCm3 * BINDER_RATIO; // ml
      const silica = volumeCm3 * SILICA_DENSITY; // g

      // Calculate glaze amount (if enabled) - with fallback if Utils is not available
      let glaze = 0;
      if (applyGlaze) {
        if (PrinterCalc.Utils && typeof PrinterCalc.Utils.calculateGlazeUsage === 'function') {
          // Use Utils method if available
          glaze = PrinterCalc.Utils.calculateGlazeUsage(volumeCm3);
        } else {
          // Fallback implementation
          glaze = (GLAZE_FACTOR * volumeCm3) + GLAZE_BASE;
        }
      }

      // Calculate component costs
      const powderCost = powder * pricing.powder;
      const binderCost = binder * pricing.binder;
      const silicaCost = silica * pricing.silica;
      const glazeCost = glaze * pricing.glaze;

      // Calculate total cost
      const totalCost = powderCost + binderCost + silicaCost + glazeCost;

      // Calculate material percentages (with check for zero to avoid division by zero)
      const powderPercentage = totalCost > 0 ? (powderCost / totalCost) * 100 : 0;
      const binderPercentage = totalCost > 0 ? (binderCost / totalCost) * 100 : 0;
      const silicaPercentage = totalCost > 0 ? (silicaCost / totalCost) * 100 : 0;
      const glazePercentage = applyGlaze && totalCost > 0 ? (glazeCost / totalCost) * 100 : 0;

      // Calculate total weight (convert powder kg to g)
      const totalWeight = (powder * 1000) + silica + glaze;

      // Return complete result
      return {
        // Material usage
        materials: {
          powder: powder, // kg
          binder: binder, // ml
          silica: silica, // g
          glaze: glaze    // g
        },

        // Cost breakdown
        costs: {
          powder: powderCost,
          binder: binderCost,
          silica: silicaCost,
          glaze: glazeCost,
          total: totalCost
        },

        // Cost percentages for visualization
        percentages: {
          powder: powderPercentage,
          binder: binderPercentage,
          silica: silicaPercentage,
          glaze: glazePercentage
        },

        // Summary stats
        volume: volumeCm3,
        weight: totalWeight,
        currency: currency
      };
    },

    /**
     * Calculate and format the print time for a model
     * @param {Object} dimensions - Width, depth, height of the model
     * @param {string} orientation - "flat" or "vertical"
     * @returns {Object} Print times for both printer models
     */
    calculatePrintTimes: function (dimensions, orientation) {
      // Check if required objects exist
      if (!PrinterCalc.CONSTANTS || !PrinterCalc.CONSTANTS.PRINTERS) {
        console.error('CONSTANTS not available for print time calculation');
        return {
          display: '--/--',
          printer400: { fits: false, seconds: null, formatted: '--' },
          printer600: { fits: false, seconds: null, formatted: '--' }
        };
      }

      // Get printer specs
      const printer400 = PrinterCalc.CONSTANTS.PRINTERS['400'];
      const printer600 = PrinterCalc.CONSTANTS.PRINTERS['600'];

      // Make sure we have Utils methods or create fallbacks
      const checkFitsInPrinter = (dims, orient, printer) => {
        if (PrinterCalc.Utils && typeof PrinterCalc.Utils.checkFitsInPrinter === 'function') {
          return PrinterCalc.Utils.checkFitsInPrinter(dims, orient, printer);
        } else {
          // Simplified fallback implementation
          const { width, depth, height } = dims;
          const { dimensions, wallMargin } = printer;
          const printerWidth = dimensions.width - (2 * wallMargin);
          const printerDepth = dimensions.depth - (2 * wallMargin);
          const printerHeight = dimensions.height;
          
          return width <= printerWidth && depth <= printerDepth && height <= printerHeight;
        }
      };

      const calculatePrintTime = (dims, orient, printer) => {
        if (PrinterCalc.Utils && typeof PrinterCalc.Utils.calculatePrintTime === 'function') {
          return PrinterCalc.Utils.calculatePrintTime(dims, orient, printer);
        } else {
          // Simplified fallback implementation
          const layerHeight = 0.1; // Default layer height
          let printHeight = orient === 'vertical' ? 
            Math.max(dims.width, dims.depth, dims.height) : 
            Math.min(dims.width, dims.depth, dims.height);
          
          return Math.ceil(printHeight / layerHeight) * printer.layerTime;
        }
      };

      const formatPrintTime = (seconds) => {
        if (PrinterCalc.Utils && typeof PrinterCalc.Utils.formatPrintTime === 'function') {
          return PrinterCalc.Utils.formatPrintTime(seconds);
        } else {
          // Simplified fallback implementation
          if (isNaN(seconds) || seconds === null) return '--';
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }
      };

      // Check if model fits in each printer
      const fits400 = checkFitsInPrinter(dimensions, orientation, printer400);
      const fits600 = checkFitsInPrinter(dimensions, orientation, printer600);

      // Calculate print times (or mark as unavailable)
      const time400 = fits400 ? calculatePrintTime(dimensions, orientation, printer400) : null;
      const time600 = fits600 ? calculatePrintTime(dimensions, orientation, printer600) : null;

      // Format times for display
      const formatted400 = fits400 ? formatPrintTime(time400) : '--';
      const formatted600 = fits600 ? formatPrintTime(time600) : '--';

      // Return combined time display and raw times
      return {
        // Formatted combined display (e.g. "45m / 35m")
        display: `${formatted400} / ${formatted600}`,

        // Individual printer times
        printer400: {
          fits: fits400,
          seconds: time400,
          formatted: formatted400
        },
        printer600: {
          fits: fits600,
          seconds: time600,
          formatted: formatted600
        }
      };
    }
  };
})();