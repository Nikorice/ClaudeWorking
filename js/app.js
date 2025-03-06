/**
 * app.js - Main Application
 * 
 * Initializes and coordinates all modules of the 3D Printer Calculator.
 */

// Wait for DOM content to be loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing 3D Printer Calculator...');
    
    try {
      // Initialize all modules in order
      
      // Core modules first
      PrinterCalc.SettingsManager.init();
      PrinterCalc.ThemeManager.init();
      PrinterCalc.TabManager.init();
      
      // UI Components
      PrinterCalc.STLManager.init();
      initManualCalculator();
      
      // Set up global event handlers
      setupGlobalEventHandlers();
      
      console.log('Initialization complete');
    } catch (error) {
      console.error('Error during initialization:', error);
      
      // Show error notification
      if (PrinterCalc.Notification) {
        PrinterCalc.Notification.error(
          'Initialization Error',
          'There was an error initializing the application. Please reload the page.'
        );
      }
    }
  });
  
  /**
   * Initialize manual calculator tab
   */
  function initManualCalculator() {
    // Get calculate button
    const calculateButton = document.getElementById('calculateBtn');
    if (calculateButton) {
      calculateButton.addEventListener('click', calculateManualResults);
    }
    
    // Get glaze toggle
    const glazeToggle = document.getElementById('manual-glazeToggle');
    if (glazeToggle) {
      glazeToggle.addEventListener('change', calculateManualResults);
    }
    
    // Get recalculate button
    const recalculateButton = document.getElementById('recalculateManual');
    if (recalculateButton) {
      recalculateButton.addEventListener('click', calculateManualResults);
    }
    
    // Add validation to inputs
    const numberInputs = document.querySelectorAll('#manual-tab input[type="number"]');
    numberInputs.forEach(input => {
      input.addEventListener('input', function() {
        validateManualInput(input);
      });
    });
  }
  
  /**
   * Set up global event handlers
   */
  function setupGlobalEventHandlers() {
    // Listen for settings changes
    document.addEventListener('printercalc:settingschanged', function(e) {
      // Update all STL rows
      PrinterCalc.STLManager.updateAllRows();
      
      // Update manual results if visible
      if (PrinterCalc.TabManager.getActiveTabId() === 'manual') {
        calculateManualResults();
      }
    });
    
    // Listen for theme changes
    document.addEventListener('printercalc:themechanged', function(e) {
      // Update any visualizations that depend on theme
      Object.keys(PrinterCalc.STLManager.rows).forEach(rowId => {
        PrinterCalc.STLManager.updateResults(rowId);
      });
      
      // Update manual results if visible
      if (PrinterCalc.TabManager.getActiveTabId() === 'manual') {
        calculateManualResults();
      }
    });
  }
  
  /**
   * Validate a manual input field
   * @param {HTMLInputElement} input - Input element
   */
  function validateManualInput(input) {
    const value = parseFloat(input.value);
    
    if (isNaN(value) || value <= 0) {
      input.classList.add('invalid');
      return false;
    } else {
      input.classList.remove('invalid');
      return true;
    }
  }
  
  /**
   * Calculate manual results
   */
  function calculateManualResults() {
    try {
      // Get input values
      const volume = parseFloat(document.getElementById('volume').value);
      const width = parseFloat(document.getElementById('width').value);
      const depth = parseFloat(document.getElementById('depth').value);
      const height = parseFloat(document.getElementById('height').value);
      
      // Validate all inputs
      if (isNaN(volume) || volume <= 0 || 
          isNaN(width) || width <= 0 || 
          isNaN(depth) || depth <= 0 || 
          isNaN(height) || height <= 0) {
        
        // Show error message
        const errorMessage = document.querySelector('#manual-tab .error-message');
        if (errorMessage) {
          errorMessage.textContent = 'Please enter valid positive numbers for all dimensions and volume.';
          errorMessage.style.display = 'block';
          
          // Hide after 5 seconds
          setTimeout(() => {
            errorMessage.style.display = 'none';
          }, 5000);
        }
        
        return;
      }
      
      // Get glaze setting and currency
      const includeGlaze = document.getElementById('manual-glazeToggle').checked;
      const currency = PrinterCalc.SettingsManager.getSetting('currency') || 'USD';
      
      // Create dimensions object
      const dimensions = { width, depth, height };
      
      // Calculate material costs
      const materialResult = PrinterCalc.MaterialCalculator.calculate(
        volume,
        includeGlaze,
        currency
      );
      
      // Calculate print times
      const printTimes = PrinterCalc.MaterialCalculator.calculatePrintTimes(
        dimensions,
        'flat' // Default to flat orientation for manual
      );
      
      // Calculate printer capacity
      const capacity400 = PrinterCalc.PrinterCapacity.calculate(
        dimensions,
        'flat',
        '400'
      );
      
      const capacity600 = PrinterCalc.PrinterCapacity.calculate(
        dimensions,
        'flat',
        '600'
      );
      
      // Show results panel
      const resultsPanel = document.getElementById('manual-results');
      if (resultsPanel) {
        resultsPanel.style.display = 'block';
      }
      
      // Update total cost
      const totalCostEl = document.getElementById('manual-total-cost');
      if (totalCostEl) {
        totalCostEl.textContent = PrinterCalc.Utils.formatCurrency(
          materialResult.costs.total,
          currency
        );
      }
      
      // Update stats
      document.getElementById('volume-display').textContent = volume.toFixed(2);
      document.getElementById('dimensions-display').textContent = PrinterCalc.Utils.formatDimensions(dimensions);
      document.getElementById('print-time-display').textContent = printTimes.display;
      document.getElementById('material-weight-display').textContent = `${materialResult.weight.toFixed(1)}g`;
      
      // Update cost breakdown
      const costBreakdown = document.getElementById('manual-costBreakdown');
      if (costBreakdown) {
        PrinterCalc.Utils.createCostBreakdown(
          costBreakdown,
          materialResult.costs,
          currency
        );
      }
      
      // Update printer stats
      const printer400Stats = document.getElementById('manual-printer400-stats');
      if (printer400Stats) {
        if (capacity400.fitsInPrinter) {
          printer400Stats.innerHTML = `
            <p><span class="printer-highlight">${capacity400.totalObjects}</span> objects</p>
            <p>Arrangement: ${capacity400.arrangement}</p>
            <p>Print Time: ${capacity400.formattedPrintTime}</p>
            <p>Total Cost: ${PrinterCalc.Utils.formatCurrency(capacity400.totalObjects * materialResult.costs.total, currency)}</p>
          `;
        } else {
          printer400Stats.innerHTML = `
            <p style="color: var(--danger); font-weight: 600;">Object exceeds printer capacity</p>
            <p>Check dimensions or change orientation</p>
          `;
        }
      }
      
      const printer600Stats = document.getElementById('manual-printer600-stats');
      if (printer600Stats) {
        if (capacity600.fitsInPrinter) {
          printer600Stats.innerHTML = `
            <p><span class="printer-highlight">${capacity600.totalObjects}</span> objects</p>
            <p>Arrangement: ${capacity600.arrangement}</p>
            <p>Print Time: ${capacity600.formattedPrintTime}</p>
            <p>Total Cost: ${PrinterCalc.Utils.formatCurrency(capacity600.totalObjects * materialResult.costs.total, currency)}</p>
          `;
        } else {
          printer600Stats.innerHTML = `
            <p style="color: var(--danger); font-weight: 600;">Object exceeds printer capacity</p>
            <p>Check dimensions or change orientation</p>
          `;
        }
      }
      
      // Update packing visualizations
      const packing400El = document.getElementById('manual-packing-400');
      if (packing400El) {
        // Create canvas if needed
        let canvas = packing400El.querySelector('canvas');
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.width = packing400El.clientWidth || 280;
          canvas.height = packing400El.clientHeight || 200;
          packing400El.appendChild(canvas);
        }
        
        // Draw visualization
        PrinterCalc.PrinterCapacity.visualize(
          canvas,
          capacity400,
          PrinterCalc.CONSTANTS.PRINTERS['400']
        );
      }
      
      const packing600El = document.getElementById('manual-packing-600');
      if (packing600El) {
        // Create canvas if needed
        let canvas = packing600El.querySelector('canvas');
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.width = packing600El.clientWidth || 280;
          canvas.height = packing600El.clientHeight || 200;
          packing600El.appendChild(canvas);
        }
        
        // Draw visualization
        PrinterCalc.PrinterCapacity.visualize(
          canvas,
          capacity600,
          PrinterCalc.CONSTANTS.PRINTERS['600']
        );
      }
      
      // Show success notification
      PrinterCalc.Notification.success(
        'Calculation Complete',
        'Results have been updated.'
      );
    } catch (error) {
      console.error('Error calculating manual results:', error);
      
      // Show error notification
      PrinterCalc.Notification.error(
        'Calculation Error',
        'An error occurred during calculation.'
      );
    }
  }