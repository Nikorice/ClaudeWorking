/**
 * material-calculator.js - Material Cost Calculation
 * 
 * Handles calculation of material usage and costs for 3D printing.
 */

(function() {
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
      calculate: function(volumeCm3, applyGlaze = true, currency = 'USD') {
        // Validate inputs
        if (!PrinterCalc.Utils.isPositiveNumber(volumeCm3)) {
          throw new Error('Invalid volume');
        }
        
        // Get material constants
        const { POWDER_DENSITY, BINDER_RATIO, SILICA_DENSITY } = PrinterCalc.CONSTANTS.MATERIALS;
        
        // Get pricing data for selected currency
        const pricing = PrinterCalc.CONSTANTS.PRICING[currency] || PrinterCalc.CONSTANTS.PRICING.USD;
        
        // Calculate material quantities
        const powder = volumeCm3 * POWDER_DENSITY; // kg
        const binder = volumeCm3 * BINDER_RATIO; // ml
        const silica = volumeCm3 * SILICA_DENSITY; // g
        
        // Calculate glaze amount (if enabled)
        const glaze = applyGlaze ? PrinterCalc.Utils.calculateGlazeUsage(volumeCm3) : 0; // g
        
        // Calculate component costs
        const powderCost = powder * pricing.powder;
        const binderCost = binder * pricing.binder;
        const silicaCost = silica * pricing.silica;
        const glazeCost = glaze * pricing.glaze;
        
        // Calculate total cost
        const totalCost = powderCost + binderCost + silicaCost + glazeCost;
        
        // Calculate material percentages
        const powderPercentage = (powderCost / totalCost) * 100;
        const binderPercentage = (binderCost / totalCost) * 100;
        const silicaPercentage = (silicaCost / totalCost) * 100;
        const glazePercentage = applyGlaze ? (glazeCost / totalCost) * 100 : 0;
        
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
      calculatePrintTimes: function(dimensions, orientation) {
        // Get printer specs
        const printer400 = PrinterCalc.CONSTANTS.PRINTERS['400'];
        const printer600 = PrinterCalc.CONSTANTS.PRINTERS['600'];
        
        // Check if model fits in each printer
        const fits400 = PrinterCalc.Utils.checkFitsInPrinter(dimensions, orientation, printer400);
        const fits600 = PrinterCalc.Utils.checkFitsInPrinter(dimensions, orientation, printer600);
        
        // Calculate print times (or mark as unavailable)
        const time400 = fits400 ? 
          PrinterCalc.Utils.calculatePrintTime(dimensions, orientation, printer400) : 
          null;
        
        const time600 = fits600 ? 
          PrinterCalc.Utils.calculatePrintTime(dimensions, orientation, printer600) : 
          null;
        
        // Format times for display
        const formatted400 = fits400 ? PrinterCalc.Utils.formatPrintTime(time400) : '--';
        const formatted600 = fits600 ? PrinterCalc.Utils.formatPrintTime(time600) : '--';
        
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