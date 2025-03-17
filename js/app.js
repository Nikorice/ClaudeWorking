/**
 * app.js - Main Application
 * 
 * Initializes and coordinates all modules of the 3D Printer Calculator.
 */

// Wait for DOM content to be loaded
document.addEventListener('DOMContentLoaded', function () {
  console.log('Initializing 3D Printer Calculator...');

  try {
    // Ensure PrinterCalc namespace is properly initialized
    window.PrinterCalc = window.PrinterCalc || {};

    // Use a more robust initialization with proper dependency checking
    initializeApplication();
  } catch (error) {
    console.error('Error during initialization:', error);

    // Show error notification
    if (window.PrinterCalc && PrinterCalc.Notification) {
      PrinterCalc.Notification.error(
        'Initialization Error',
        'There was an error initializing the application. Please reload the page.'
      );
    } else {
      alert('Initialization Error: There was an error initializing the application. Please reload the page.');
    }
  }
});

/**
 * Initialize application with dependency checking
 */
function initializeApplication() {
  // Check core dependencies first with retry mechanism
  const maxRetries = 5;
  let retryCount = 0;

  function checkAndInitialize() {
    console.log(`Checking dependencies (attempt ${retryCount + 1})...`);

    // Check for critical dependencies
    const hasCoreUtils = !!(window.PrinterCalc && PrinterCalc.Utils);
    const hasConstants = !!(window.PrinterCalc && PrinterCalc.CONSTANTS);

    if (hasCoreUtils && hasConstants) {
      console.log('Core dependencies loaded, proceeding with initialization');
      initializeModules();
    } else {
      retryCount++;
      if (retryCount < maxRetries) {
        console.warn(`Some core dependencies not available yet. Retrying in ${200 * retryCount}ms...`);
        setTimeout(checkAndInitialize, 200 * retryCount);
      } else {
        console.error('Failed to load core dependencies after multiple attempts');
        if (window.PrinterCalc) {
          // Log what we have and what's missing
          console.log('Available modules:', Object.keys(window.PrinterCalc).join(', '));

          if (!hasCoreUtils) console.error('Utils module not loaded');
          if (!hasConstants) console.error('CONSTANTS module not loaded');

          // Try to continue with what we have
          console.warn('Attempting to initialize with limited functionality');
          initializeModules();
        } else {
          console.error('PrinterCalc namespace not available');
        }
      }
    }
  }

  function initializeModules() {
    // Log available modules
    if (window.PrinterCalc) {
      console.log('Available modules:', Object.keys(window.PrinterCalc).join(', '));
    }

    // Initialize settings manager first
    if (PrinterCalc.SettingsManager && PrinterCalc.SettingsManager.init) {
      PrinterCalc.SettingsManager.init();
      console.log('SettingsManager initialized');
    } else {
      console.warn('SettingsManager not available');
    }

    // Initialize theme manager
    if (PrinterCalc.ThemeManager && PrinterCalc.ThemeManager.init) {
      PrinterCalc.ThemeManager.init();
      console.log('ThemeManager initialized');
    } else {
      console.warn('ThemeManager not available');
    }

    // Initialize tab manager
    if (PrinterCalc.TabManager && PrinterCalc.TabManager.init) {
      PrinterCalc.TabManager.init();
      console.log('TabManager initialized');
    } else {
      console.warn('TabManager not available');
    }

    // Initialize UI modules after a short delay to ensure core modules are fully ready
    setTimeout(function () {
      // Initialize STL manager
      if (PrinterCalc.STLManager && PrinterCalc.STLManager.init) {
        PrinterCalc.STLManager.init();
        console.log('STLManager initialized');
      } else {
        console.warn('STLManager not available');
      }

      // Initialize manual calculator
      if (window.initManualCalculator) {
        initManualCalculator();
        console.log('Manual calculator initialized');
      } else {
        console.warn('Manual calculator function not available');
      }

      // Set up global event handlers
      if (window.setupGlobalEventHandlers) {
        setupGlobalEventHandlers();
        console.log('Global event handlers set up');
      } else {
        console.warn('Global event handlers function not available');
      }

      console.log('Initialization complete');

      // Initialize scaling functionality
      if (window.PrinterCalc && PrinterCalc.ScalingManager) {
        console.log('Initializing scaling functionality...');

        // Add scaling UI to existing STL rows
        if (PrinterCalc.STLManager && PrinterCalc.STLManager.rows) {
          Object.keys(PrinterCalc.STLManager.rows).forEach(rowId => {
            PrinterCalc.STLManager.addScalingUI(rowId);
          });
        }

        // Set up dimension click handlers using event delegation
        if (typeof PrinterCalc.ScalingManager.setupDimensionClickHandlers === 'function') {
          PrinterCalc.ScalingManager.setupDimensionClickHandlers();
        } else {
          console.error('setupDimensionClickHandlers function not available');
        }
      }
    }, 300);
  }

  // Start the initialization process
  checkAndInitialize();
}

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
    input.addEventListener('input', function () {
      validateManualInput(input);
    });
  });
}

/**
 * Set up global event handlers
 */
function setupGlobalEventHandlers() {
  // Listen for settings changes
  document.addEventListener('printercalc:settingschanged', function (e) {
    // Update all STL rows
    if (PrinterCalc.STLManager && PrinterCalc.STLManager.updateAllRows) {
      PrinterCalc.STLManager.updateAllRows();
    }

    // Update manual results if visible
    if (PrinterCalc.TabManager && PrinterCalc.TabManager.getActiveTabId) {
      if (PrinterCalc.TabManager.getActiveTabId() === 'manual') {
        calculateManualResults();
      }
    }
  });

  // Listen for theme changes
  document.addEventListener('printercalc:themechanged', function (e) {
    // Update any visualizations that depend on theme
    if (PrinterCalc.STLManager && PrinterCalc.STLManager.rows) {
      Object.keys(PrinterCalc.STLManager.rows).forEach(rowId => {
        if (PrinterCalc.STLManager.updateResults) {
          PrinterCalc.STLManager.updateResults(rowId);
        }
      });
    }

    // Update manual results if visible
    if (PrinterCalc.TabManager && PrinterCalc.TabManager.getActiveTabId) {
      if (PrinterCalc.TabManager.getActiveTabId() === 'manual') {
        calculateManualResults();
      }
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

    // Check for required dependencies
    if (!PrinterCalc.MaterialCalculator || !PrinterCalc.MaterialCalculator.calculate) {
      console.error('MaterialCalculator not available');

      // Show error message
      const errorMessage = document.querySelector('#manual-tab .error-message');
      if (errorMessage) {
        errorMessage.textContent = 'Calculation module not loaded. Please reload the page.';
        errorMessage.style.display = 'block';
      }

      return;
    }

    // Get glaze setting and currency
    const includeGlaze = document.getElementById('manual-glazeToggle').checked;
    let currency = 'USD'; // Default

    // Try to get currency from settings
    if (PrinterCalc.SettingsManager && PrinterCalc.SettingsManager.getSetting) {
      currency = PrinterCalc.SettingsManager.getSetting('currency') || 'USD';
    }

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

    // Show visualizers only after calculation
    const visualizersContainer = document.querySelector('#manual-results .packing-visualizers');
    if (visualizersContainer) {
      visualizersContainer.style.display = 'flex';
    }

    // Show results panel
    const resultsPanel = document.getElementById('manual-results');
    if (resultsPanel) {
      resultsPanel.style.display = 'block';
    }

    // Update total cost
    const totalCostEl = document.getElementById('manual-total-cost');
    if (totalCostEl) {
      if (PrinterCalc.Utils && PrinterCalc.Utils.formatCurrency) {
        totalCostEl.textContent = PrinterCalc.Utils.formatCurrency(
          materialResult.costs.total,
          currency
        );
      } else {
        // Fallback formatting
        const symbol = (PrinterCalc.CONSTANTS && PrinterCalc.CONSTANTS.CURRENCY_SYMBOLS)
          ? PrinterCalc.CONSTANTS.CURRENCY_SYMBOLS[currency] || '$'
          : '$';
        totalCostEl.textContent = `${symbol}${materialResult.costs.total.toFixed(2)}`;
      }
    }

    // Update stats
    const volumeDisplay = document.getElementById('volume-display');
    if (volumeDisplay) volumeDisplay.textContent = volume.toFixed(2);

    const dimensionsDisplay = document.getElementById('dimensions-display');
    if (dimensionsDisplay) {
      if (PrinterCalc.Utils && PrinterCalc.Utils.formatDimensions) {
        dimensionsDisplay.textContent = PrinterCalc.Utils.formatDimensions(dimensions);
      } else {
        // Fallback formatting
        dimensionsDisplay.textContent = `${width.toFixed(1)} × ${depth.toFixed(1)} × ${height.toFixed(1)}`;
      }
    }

    const printTimeDisplay = document.getElementById('print-time-display');
    if (printTimeDisplay) printTimeDisplay.textContent = printTimes.display;

    const materialWeightDisplay = document.getElementById('material-weight-display');
    if (materialWeightDisplay) materialWeightDisplay.textContent = `${materialResult.weight.toFixed(1)}g`;

    // Update cost breakdown
    const costBreakdown = document.getElementById('manual-costBreakdown');
    if (costBreakdown) {
      if (PrinterCalc.Utils && PrinterCalc.Utils.createCostBreakdown) {
        PrinterCalc.Utils.createCostBreakdown(
          costBreakdown,
          materialResult.costs,
          currency
        );
      } else {
        // Simple fallback for cost breakdown
        costBreakdown.innerHTML = `
          <div class="progress-item">
            <div class="progress-header">
              <div class="progress-label">Total Cost</div>
              <div class="progress-value">${materialResult.costs.total.toFixed(2)}</div>
            </div>
          </div>
        `;
      }
    }

    // Update printer stats
    const printer400Stats = document.getElementById('manual-printer400-stats');
    if (printer400Stats) {
      if (capacity400.fitsInPrinter) {
        const objectCount = Number(capacity400.totalObjects);
        const unitCost = Number(materialResult.costs.total);
        const totalCost = objectCount * unitCost;

        console.log("DEBUG - Printer 400 calculation:",
          "Objects:", objectCount,
          "Unit cost:", unitCost,
          "Total:", totalCost);

        const formattedTotalCost = PrinterCalc.Utils && PrinterCalc.Utils.formatCurrency
          ? PrinterCalc.Utils.formatCurrency(totalCost, currency)
          : `$${totalCost.toFixed(2)}`;

        printer400Stats.innerHTML = `
          <p><span class="printer-highlight">${objectCount}</span> objects</p>
          <p>Arrangement: ${capacity400.arrangement}</p>
          <p>Print Time: ${capacity400.formattedPrintTime}</p>
          <p>Total Cost: ${formattedTotalCost}</p>
        `;
      } else {
        printer400Stats.innerHTML = `
          <p style="color:red;">Objects do not fit</p>
          <p>Check dimensions or change orientation</p>
        `;
      }
    }

    const printer600Stats = document.getElementById('manual-printer600-stats');
    if (printer600Stats) {
      if (capacity600.fitsInPrinter) {
        const objectCount = Number(capacity600.totalObjects);
        const unitCost = Number(materialResult.costs.total);
        const totalCost = objectCount * unitCost;

        console.log("DEBUG - Printer 600 calculation:",
          "Objects:", objectCount,
          "Unit cost:", unitCost,
          "Total:", totalCost);

        const formattedTotalCost = PrinterCalc.Utils && PrinterCalc.Utils.formatCurrency
          ? PrinterCalc.Utils.formatCurrency(totalCost, currency)
          : `$${totalCost.toFixed(2)}`;

        printer600Stats.innerHTML = `
          <p><span class="printer-highlight">${objectCount}</span> objects</p>
          <p>Arrangement: ${capacity600.arrangement}</p>
          <p>Print Time: ${capacity600.formattedPrintTime}</p>
          <p>Total Cost: ${formattedTotalCost}</p>
        `;
      } else {
        printer600Stats.innerHTML = `
          <p style="color:var(--danger);">Check dimensions or change orientation</p>
        `;
      }
    }

    // Update packing visualizations
    const packing400El = document.getElementById('manual-packing-400');
    if (packing400El && PrinterCalc.STLManager && PrinterCalc.STLManager.updatePackingVisualization) {
      // Use the STLManager's visualization method
      PrinterCalc.STLManager.updatePackingVisualization(
        'manual',
        packing400El,
        capacity400,
        PrinterCalc.CONSTANTS.PRINTERS['400']
      );
    }

    const packing600El = document.getElementById('manual-packing-600');
    if (packing600El && PrinterCalc.STLManager && PrinterCalc.STLManager.updatePackingVisualization) {
      // Use the STLManager's visualization method
      PrinterCalc.STLManager.updatePackingVisualization(
        'manual',
        packing600El,
        capacity600,
        PrinterCalc.CONSTANTS.PRINTERS['600']
      );
    }

    // Handle resize events to ensure visualizations remain responsive
    window.addEventListener('resize', () => {
      if (PrinterCalc.PrinterCapacity && typeof PrinterCalc.PrinterCapacity.visualize === 'function') {
        const packing400El = document.getElementById('manual-packing-400');
        const packing600El = document.getElementById('manual-packing-600');

        if (packing400El && capacity400) {
          PrinterCalc.PrinterCapacity.visualize(
            packing400El,
            capacity400,
            PrinterCalc.CONSTANTS.PRINTERS['400']
          );
        }

        if (packing600El && capacity600) {
          PrinterCalc.PrinterCapacity.visualize(
            packing600El,
            capacity600,
            PrinterCalc.CONSTANTS.PRINTERS['600']
          );
        }
      }
    }, { passive: true });

    // Show success notification
    if (PrinterCalc.Notification) {
      PrinterCalc.Notification.success(
        'Calculation Complete',
        'Results have been updated.'
      );
    }
  } catch (error) {
    console.error('Error calculating manual results:', error);

    // Show error notification
    if (PrinterCalc.Notification) {
      PrinterCalc.Notification.error(
        'Calculation Error',
        'An error occurred during calculation.'
      );
    }

    // Show more detailed error in console for debugging
    console.error('Calculation error details:', error.stack || error);
  }
  // Add cleanup mechanism for uncaught errors during idle
  let idleTimeout = null;

  // Set up page visibility handling
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      // Page is hidden (user switched tabs or minimized)
      console.log('Page hidden, suspending animations');

      // Suspend any animations
      if (PrinterCalc.ModelViewer && PrinterCalc.ModelViewer.viewers) {
        Object.keys(PrinterCalc.ModelViewer.viewers).forEach(viewerId => {
          const viewer = PrinterCalc.ModelViewer.viewers[viewerId];
          if (viewer && viewer.threeContext && viewer.threeContext.animationSuspended !== true) {
            // Store animation frame ID
            viewer.threeContext.animationSuspended = true;
            console.log(`Suspended animation for viewer ${viewerId}`);
          }
        });
      }

      // Set a timer to do more cleanup if the page is hidden for a long time
      idleTimeout = setTimeout(function () {
        console.log('Long idle detected, performing cleanup');

        // Clean up Three.js resources for long idle periods
        if (PrinterCalc.ModelViewer && PrinterCalc.ModelViewer.viewers) {
          Object.keys(PrinterCalc.ModelViewer.viewers).forEach(viewerId => {
            try {
              // Don't fully dispose, just release some resources
              const viewer = PrinterCalc.ModelViewer.viewers[viewerId];
              if (viewer && viewer.threeContext && viewer.threeContext.renderer) {
                viewer.threeContext.renderer.dispose();
                console.log(`Released renderer resources for ${viewerId}`);
              }
            } catch (e) {
              console.error('Error during idle cleanup:', e);
            }
          });
        }
      }, 300000); // 5 minutes

    } else {
      // Page is visible again
      console.log('Page visible, resuming animations');

      // Clear the idle timeout
      if (idleTimeout) {
        clearTimeout(idleTimeout);
        idleTimeout = null;
      }

      // Resume animations
      if (PrinterCalc.ModelViewer && PrinterCalc.ModelViewer.viewers) {
        Object.keys(PrinterCalc.ModelViewer.viewers).forEach(viewerId => {
          try {
            const viewer = PrinterCalc.ModelViewer.viewers[viewerId];
            if (viewer && viewer.threeContext && viewer.threeContext.animationSuspended === true) {
              // Remove suspension flag
              viewer.threeContext.animationSuspended = false;

              // Force a re-render
              if (viewer.threeContext.renderer && viewer.threeContext.scene && viewer.threeContext.camera) {
                viewer.threeContext.renderer.render(viewer.threeContext.scene, viewer.threeContext.camera);
                console.log(`Resumed animation for viewer ${viewerId}`);
              }
            }
          } catch (e) {
            console.error('Error resuming animation:', e);
          }
        });
      }

      // Reinitialize if needed after long idle
      try {
        // Force update on any visible STL rows
        if (PrinterCalc.STLManager && PrinterCalc.STLManager.rows) {
          Object.keys(PrinterCalc.STLManager.rows).forEach(rowId => {
            const row = document.getElementById(rowId);
            if (row && row.offsetParent !== null) { // Check if visible
              console.log(`Refreshing row ${rowId} after visibility change`);
              PrinterCalc.STLManager.updateResults(rowId);
            }
          });
        }
      } catch (e) {
        console.error('Error during visibility refresh:', e);
      }
    }
  });

  // Add an error handler for uncaught errors
  window.addEventListener('error', function (event) {
    console.error('Uncaught error:', event.error);

    // Prevent error notification spam
    const now = Date.now();
    if (!window.lastErrorTime || now - window.lastErrorTime > 5000) {
      window.lastErrorTime = now;

      // Show notification if available
      if (PrinterCalc.Notification) {
        PrinterCalc.Notification.error(
          'Application Error',
          'An error occurred. Try refreshing the page if functionality is affected.'
        );
      }
    }

    // Attempt recovery for common Three.js errors
    if (event.error && (
      event.error.toString().includes('WebGL') ||
      event.error.toString().includes('THREE') ||
      event.error.toString().includes('undefined is not an object')
    )) {
      console.log('Attempting to recover from WebGL/Three.js error');

      // Try to restore Three.js contexts
      if (PrinterCalc.ModelViewer && PrinterCalc.ModelViewer.viewers) {
        Object.keys(PrinterCalc.ModelViewer.viewers).forEach(viewerId => {
          try {
            const viewer = PrinterCalc.ModelViewer.viewers[viewerId];
            if (viewer && viewer.threeContext && viewer.threeContext.renderer) {
              // Force a re-render
              viewer.threeContext.renderer.render(
                viewer.threeContext.scene,
                viewer.threeContext.camera
              );
            }
          } catch (e) {
            console.error('Error during recovery attempt:', e);
          }
        });
      }
    }
  });
}