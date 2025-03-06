/**
 * stl-manager.js - STL File Management
 * 
 * Handles STL file uploads, processing, and display.
 */

(function () {
  // Make sure the namespace exists
  window.PrinterCalc = window.PrinterCalc || {};

  // Create an STL manager module
  PrinterCalc.STLManager = {
    // Store STL rows by ID
    rows: {},

    /**
     * Initialize STL manager
     */
    init: function () {
      // Add new STL button handler
      const addButton = document.getElementById('addNewStl');
      if (addButton) {
        addButton.addEventListener('click', () => {
          this.createSTLRow();
        });
      }

      // Create initial row if no rows exist
      const stlRows = document.getElementById('stlRows');
      if (stlRows && stlRows.childElementCount === 0) {
        this.createSTLRow();
      }

      // Show memory warning if appropriate
      this.showMemoryWarningIfNeeded();
    },

    /**
     * Create a new STL row
     * @returns {string} Row ID
     */
    createSTLRow: function () {
      try {
        // Local fallback function for generating IDs if Utils.generateId is not available
        const generateFallbackId = function () {
          return 'id-' + Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
        };

        // Generate a unique ID using either Utils.generateId or our fallback
        const rowId = (PrinterCalc.Utils && typeof PrinterCalc.Utils.generateId === 'function')
          ? PrinterCalc.Utils.generateId()
          : generateFallbackId();

        // Get container
        const container = document.getElementById('stlRows');
        if (!container) {
          console.error('STL rows container not found');
          return null;
        }

        // Clone template
        const template = document.getElementById('stl-row-template');
        if (!template) {
          console.error('STL row template not found');
          return null;
        }

        // Create row element from template
        const rowContent = template.content.cloneNode(true);
        const rowElement = rowContent.querySelector('.stl-row');

        // Set ID
        rowElement.id = rowId;

        // Fix ID references in template
        const elementsWithId = rowElement.querySelectorAll('[id]');
        elementsWithId.forEach(el => {
          if (el.id.startsWith('__')) {
            el.id = `${rowId}-${el.id.substring(2)}`;
          }
        });

        // Add to container
        container.appendChild(rowElement);

        // Initialize event handlers
        this.initRowHandlers(rowId);

        // Store row data
        this.rows[rowId] = {
          element: rowElement,
          stlData: null,
          viewerId: null,
          orientation: 'flat',
          applyGlaze: true,
          currency: 'USD' // Default to USD if SettingsManager is not available
        };

        // Try to get currency from settings if available
        if (PrinterCalc.SettingsManager && typeof PrinterCalc.SettingsManager.getSetting === 'function') {
          this.rows[rowId].currency = PrinterCalc.SettingsManager.getSetting('currency') || 'USD';
        }

        return rowId;
      } catch (error) {
        console.error('Error creating STL row:', error);
        return null;
      }
    },

    /**
     * Initialize event handlers for an STL row
     * @param {string} rowId - Row ID
     */
    initRowHandlers: function (rowId) {
      const row = document.getElementById(rowId);
      if (!row) return;

      try {
        // Get elements
        const uploadArea = row.querySelector('.upload-area');
        const fileInput = row.querySelector('input[type="file"]');
        const modelViewer = row.querySelector('.model-viewer');
        const orientationBtns = row.querySelectorAll('.orientation-btn');
        const glazeToggle = row.querySelector('.glaze-toggle');
        const removeBtn = row.querySelector('.remove-stl-btn');

        // File upload event handling
        if (uploadArea && fileInput) {
          // Click handler
          uploadArea.addEventListener('click', () => {
            fileInput.click();
          });

          // Drag and drop handlers
          uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
          });

          uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
          });

          uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');

            // Get file
            const file = e.dataTransfer.files[0];
            if (file) {
              this.handleFileUpload(rowId, file);
            }
          });

          // File input change handler
          fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
              this.handleFileUpload(rowId, e.target.files[0]);
            }
          });
        }

        // Orientation button handlers
        orientationBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            const orientation = btn.getAttribute('data-orientation');

            // Update active state
            orientationBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update model orientation
            this.changeOrientation(rowId, orientation);
          });
        });

        // Glaze toggle handler
        if (glazeToggle) {
          glazeToggle.addEventListener('change', () => {
            this.updateGlazeSetting(rowId, glazeToggle.checked);
          });
        }

        // Remove button handler
        if (removeBtn) {
          removeBtn.addEventListener('click', () => {
            this.removeSTLRow(rowId);
          });
        }
      } catch (error) {
        console.error(`Error initializing handlers for row ${rowId}:`, error);
      }
    },

    /**
     * Handle STL file upload
     * @param {string} rowId - Row ID
     * @param {File} file - Uploaded STL file
     */
    handleFileUpload: async function(rowId, file) {
      console.log('Handling file upload for row:', rowId);
      
      const row = document.getElementById(rowId);
      if (!row) {
        console.error('Row element not found:', rowId);
        return;
      }
      
      try {
        // Check file validity
        if (!file) {
          console.error('No file provided');
          if (PrinterCalc.Notification) {
            PrinterCalc.Notification.error(
              'Invalid File',
              'No file was provided.'
            );
          } else {
            alert('No file was provided.');
          }
          return;
        }
        
        if (!file.name || !file.name.toLowerCase().endsWith('.stl')) {
          console.error('Invalid file type:', file.name);
          if (PrinterCalc.Notification) {
            PrinterCalc.Notification.error(
              'Invalid File',
              'Please upload a valid STL file.'
            );
          } else {
            alert('Please upload a valid STL file.');
          }
          return;
        }

        // Get elements
        const uploadArea = row.querySelector('.upload-area');
        const modelViewer = row.querySelector('.model-viewer');
        const modelViewerLoading = row.querySelector('.model-viewer-loading');
        const loadingBar = row.querySelector('.model-viewer-loading-bar');
        const resultsPanel = row.querySelector('.results-panel');
        const loadingMessage = row.querySelector('.loading-message');
        const errorMessage = row.querySelector('.error-message');
        const orientationToggle = row.querySelector('.orientation-toggle');

        // Update UI to show loading state
        if (uploadArea) uploadArea.style.display = 'none';
        if (modelViewer) modelViewer.style.display = 'block';
        if (modelViewerLoading) modelViewerLoading.style.display = 'flex';
        if (resultsPanel) resultsPanel.style.display = 'block';
        if (loadingMessage) loadingMessage.style.display = 'flex';
        if (errorMessage) errorMessage.style.display = 'none';

        // Animate loading bar
        if (loadingBar) {
          loadingBar.style.width = '30%';
          setTimeout(() => {
            loadingBar.style.width = '70%';
          }, 500);
        }

        // Make sure ModelViewer is available
        if (!PrinterCalc.ModelViewer || typeof PrinterCalc.ModelViewer.init !== 'function') {
          if (errorMessage) {
            errorMessage.textContent = 'Model viewer not available. Please reload the page.';
            errorMessage.style.display = 'block';
          }
          if (loadingMessage) loadingMessage.style.display = 'none';
          return;
        }

      // Initialize 3D viewer if needed with dependency checks
if (!this.rows[rowId].viewerId && modelViewer) {
  // Create unique viewer ID
  const viewerId = rowId + '-viewer';
  
  // First check: is THREE loaded alongside all required components?
  const isThreeReady = typeof THREE !== 'undefined' && 
                       typeof THREE.STLLoader !== 'undefined' && 
                       typeof THREE.OrbitControls !== 'undefined';
                       
  if (!isThreeReady) {
    console.error('THREE.js or required components not loaded');
    
    // Show specific error message for better debugging
    let missingComponents = [];
    if (typeof THREE === 'undefined') missingComponents.push('THREE main library');
    else {
      if (typeof THREE.STLLoader === 'undefined') missingComponents.push('STLLoader');
      if (typeof THREE.OrbitControls === 'undefined') missingComponents.push('OrbitControls');
    }
    
    if (errorMessage) {
      errorMessage.textContent = `3D libraries not fully loaded (missing: ${missingComponents.join(', ')}). Please reload the page.`;
      errorMessage.style.display = 'block';
    }
    if (loadingMessage) loadingMessage.style.display = 'none';
    
    // Continue with calculations, just without 3D visualization
    this.processWithout3D(rowId, file);
    return;
  }
  
  // Initialize model viewer
  if (PrinterCalc.ModelViewer && typeof PrinterCalc.ModelViewer.init === 'function') {
    try {
      console.log('Initializing model viewer for row:', rowId);
      const initResult = PrinterCalc.ModelViewer.init(modelViewer);
      console.log('Viewer initialization result:', initResult);
      
      if (initResult) {
        this.rows[rowId].viewerId = initResult;
      } else {
        throw new Error('Viewer initialization returned null or undefined');
      }
    } catch (viewerError) {
      console.error('Error initializing viewer:', viewerError);
      
      if (errorMessage) {
        errorMessage.textContent = 'Failed to initialize 3D viewer. Continuing without visualization.';
        errorMessage.style.display = 'block';
      }
      if (loadingMessage) loadingMessage.style.display = 'none';
      
      // Continue with calculations, just without 3D visualization
      this.processWithout3D(rowId, file);
    }
  } else {
    console.error('ModelViewer not available');
    if (errorMessage) {
      errorMessage.textContent = 'Model viewer not available. Continuing without visualization.';
      errorMessage.style.display = 'block';
    }
    if (loadingMessage) loadingMessage.style.display = 'none';
    
    // Continue with calculations, just without 3D visualization
    this.processWithout3D(rowId, file);
  }
}

        // Make sure STLProcessor is available
        if (!PrinterCalc.STLProcessor || typeof PrinterCalc.STLProcessor.processFile !== 'function') {
          if (errorMessage) {
            errorMessage.textContent = 'STL processor not available. Please reload the page.';
            errorMessage.style.display = 'block';
          }
          if (loadingMessage) loadingMessage.style.display = 'none';
          return;
        }

        // Process STL file
        let stlData;
        try {
          stlData = await PrinterCalc.STLProcessor.processFile(file);
        } catch (error) {
          console.error('Error processing STL file:', error);

          // Show error
          if (errorMessage) {
            errorMessage.textContent = error.message || 'Error processing STL file';
            errorMessage.style.display = 'block';
          }

          if (loadingMessage) loadingMessage.style.display = 'none';

          if (PrinterCalc.Notification) {
            PrinterCalc.Notification.error(
              'Processing Error',
              error.message || 'Error processing STL file'
            );
          } else {
            alert('Error processing STL file: ' + (error.message || 'Unknown error'));
          }

          return;
        }

        // Complete loading bar
        if (loadingBar) {
          loadingBar.style.width = '100%';
        }

        // Store STL data
        this.rows[rowId].stlData = {
          file,
          volumeCm3: stlData.volumeCm3 || 0,
          dimensions: stlData.dimensions || { width: 0, depth: 0, height: 0 },
          triangleCount: stlData.triangleCount || 0
        };

        // Load model into viewer
        try {
          if (PrinterCalc.ModelViewer && typeof PrinterCalc.ModelViewer.loadSTL === 'function') {
            await PrinterCalc.ModelViewer.loadSTL(
              this.rows[rowId].viewerId,
              file
            );

            // Apply current orientation
            if (PrinterCalc.ModelViewer.changeOrientation) {
              PrinterCalc.ModelViewer.changeOrientation(
                this.rows[rowId].viewerId,
                this.rows[rowId].orientation
              );
            }
          }
        } catch (viewerError) {
          console.error('Error displaying model:', viewerError);
        }

        // Hide loading indicators
        if (modelViewerLoading) modelViewerLoading.style.display = 'none';
        if (loadingMessage) loadingMessage.style.display = 'none';
        if (orientationToggle) orientationToggle.style.display = 'flex';

        // Update results
        this.updateResults(rowId);

        // Show success notification
        if (PrinterCalc.Notification) {
          PrinterCalc.Notification.success(
            'STL Loaded',
            `Model loaded successfully (${stlData.triangleCount.toLocaleString()} triangles)`
          );
        }
      } catch (error) {
        console.error('Error handling file upload:', error);

        // Show error in the UI
        if (row) {
          const errorMessage = row.querySelector('.error-message');
          if (errorMessage) {
            errorMessage.textContent = 'Error processing file: ' + (error.message || 'Unknown error');
            errorMessage.style.display = 'block';
          }

          const loadingMessage = row.querySelector('.loading-message');
          if (loadingMessage) loadingMessage.style.display = 'none';
        }

        // Show error notification
        if (PrinterCalc.Notification) {
          PrinterCalc.Notification.error(
            'Upload Error',
            'An error occurred while processing the file.'
          );
        }
      }
    },
/**
 * Process STL file without 3D visualization
 * @param {string} rowId - Row ID
 * @param {File} file - STL file
 */
processWithout3D: async function(rowId, file) {
  try {
    // Get elements
    const row = document.getElementById(rowId);
    if (!row) return;
    
    const uploadArea = row.querySelector('.upload-area');
    const resultsPanel = row.querySelector('.results-panel');
    const loadingMessage = row.querySelector('.loading-message');
    const errorMessage = row.querySelector('.error-message');
    
    // Update UI states
    if (uploadArea) uploadArea.style.display = 'none';
    if (resultsPanel) resultsPanel.style.display = 'block';
    if (loadingMessage) loadingMessage.style.display = 'flex';
    
    // Process STL file to get volume and dimensions
    let stlData;
    try {
      stlData = await PrinterCalc.STLProcessor.processFile(file);
    } catch (error) {
      console.error('Error processing STL file:', error);
      
      if (errorMessage) {
        errorMessage.textContent = error.message || 'Error processing STL file';
        errorMessage.style.display = 'block';
      }
      if (loadingMessage) loadingMessage.style.display = 'none';
      return;
    }
    
    // Store STL data
    this.rows[rowId].stlData = {
      file,
      volumeCm3: stlData.volumeCm3 || 0,
      dimensions: stlData.dimensions || {width: 0, depth: 0, height: 0},
      triangleCount: stlData.triangleCount || 0
    };
    
    // Hide loading indicators
    if (loadingMessage) loadingMessage.style.display = 'none';
    
    // Show notification
    if (PrinterCalc.Notification) {
      PrinterCalc.Notification.success(
        'STL Loaded',
        `Model loaded successfully without 3D preview (${stlData.triangleCount.toLocaleString()} triangles)`
      );
    }
    
    // Update results
    this.updateResults(rowId);
  } catch (error) {
    console.error('Error in processWithout3D:', error);
    
    // Show error in UI
    const row = document.getElementById(rowId);
    if (row) {
      const errorMessage = row.querySelector('.error-message');
      if (errorMessage) {
        errorMessage.textContent = 'Error processing file without 3D preview: ' + (error.message || 'Unknown error');
        errorMessage.style.display = 'block';
      }
      
      const loadingMessage = row.querySelector('.loading-message');
      if (loadingMessage) loadingMessage.style.display = 'none';
    }
  }
},
    /**
     * Change model orientation
     * @param {string} rowId - Row ID
     * @param {string} orientation - Orientation ("flat" or "vertical")
     */
    changeOrientation: function (rowId, orientation) {
      // Update stored orientation
      if (this.rows[rowId]) {
        this.rows[rowId].orientation = orientation;
      } else {
        return;
      }

      // Update 3D view if model is loaded
      if (this.rows[rowId].viewerId && PrinterCalc.ModelViewer.hasModel(this.rows[rowId].viewerId)) {
        PrinterCalc.ModelViewer.changeOrientation(
          this.rows[rowId].viewerId,
          orientation
        );
      }

      // Update results
      this.updateResults(rowId);
    },

    /**
     * Update glaze setting
     * @param {string} rowId - Row ID
     * @param {boolean} enabled - Whether glaze should be applied
     */
    updateGlazeSetting: function (rowId, enabled) {
      // Update stored setting
      if (this.rows[rowId]) {
        this.rows[rowId].applyGlaze = enabled;
      } else {
        return;
      }

      // Update results
      this.updateResults(rowId);
    },

    /**
     * Update currency setting
     * @param {string} rowId - Row ID
     * @param {string} currency - Currency code
     */
    updateCurrency: function (rowId, currency) {
      // Update stored setting
      if (this.rows[rowId]) {
        this.rows[rowId].currency = currency;
      } else {
        return;
      }

      // Update results
      this.updateResults(rowId);
    },

    /**
     * Update results for an STL row
     * @param {string} rowId - Row ID
     */
    updateResults: function(rowId) {
      console.log('Updating results for row:', rowId);
      
      const rowData = this.rows[rowId];
      if (!rowData) {
        console.error('Row data not found for ID:', rowId);
        return;
      }
      
      if (!rowData.stlData) {
        console.log('No STL data available for row:', rowId);
        return;
      }
      
      const { volumeCm3, dimensions } = rowData.stlData;
      
      // Verify we have valid data
      if (typeof volumeCm3 !== 'number' || isNaN(volumeCm3) || volumeCm3 <= 0) {
        console.error('Invalid volume data:', volumeCm3);
        return;
      }
      
      if (!dimensions || typeof dimensions !== 'object') {
        console.error('Invalid dimensions data:', dimensions);
        return;
      }
      
      const orientation = rowData.orientation;
      const applyGlaze = rowData.applyGlaze;
      const currency = rowData.currency;

      // Get row element
      const row = document.getElementById(rowId);
      if (!row) return;

      try {
        // Get UI elements
        const totalCostEl = row.querySelector('.total-cost');
        const statsGrid = row.querySelector('.stats-grid');
        const progressContainer = row.querySelector('.progress-container');
        const printer400Stats = row.querySelector(`#${rowId}-printer-400-stats`);
        const printer600Stats = row.querySelector(`#${rowId}-printer-600-stats`);
        const packing400El = row.querySelector(`#${rowId}-packing-400`);
        const packing600El = row.querySelector(`#${rowId}-packing-600`);

        // Get orientated dimensions
        let orientedDimensions;

        if (orientation === 'vertical') {
          // For vertical orientation, sort dimensions and use
          // smallest for width, middle for depth, largest for height
          const dims = [dimensions.width, dimensions.depth, dimensions.height].sort((a, b) => a - b);
          orientedDimensions = {
            width: dims[0],
            depth: dims[1],
            height: dims[2]
          };
        } else {
          // For flat orientation, sort dimensions and use
          // largest for width, middle for depth, smallest for height
          const dims = [dimensions.width, dimensions.depth, dimensions.height].sort((a, b) => a - b);
          orientedDimensions = {
            width: dims[2],
            depth: dims[1],
            height: dims[0]
          };
        }

        // Calculate material costs
        const materialResult = PrinterCalc.MaterialCalculator.calculate(
          volumeCm3,
          applyGlaze,
          currency
        );

        console.log('materialResult:', materialResult);
        console.log('Storing materialResult in row:', rowId);
        this.rows[rowId].materialResult = materialResult;
        console.log('After storing, row data is:', this.rows[rowId]);

        // Calculate print times
        const printTimes = PrinterCalc.MaterialCalculator.calculatePrintTimes(
          orientedDimensions,
          orientation
        );

        // Calculate printer capacity
        const capacity400 = PrinterCalc.PrinterCapacity.calculate(
          orientedDimensions,
          orientation,
          '400'
        );

        const capacity600 = PrinterCalc.PrinterCapacity.calculate(
          orientedDimensions,
          orientation,
          '600'
        );

        // Update total cost
        if (totalCostEl) {
          totalCostEl.textContent = PrinterCalc.Utils.formatCurrency(
            materialResult.costs.total,
            currency
          );
        }

        // Update stats
        if (statsGrid) {
          const statBoxes = statsGrid.querySelectorAll('.stat-box');

          // Volume
          if (statBoxes[0]) {
            const valueEl = statBoxes[0].querySelector('.stat-value');
            if (valueEl) {
              valueEl.textContent = volumeCm3.toFixed(2);
            }
          }

          // Dimensions
          if (statBoxes[1]) {
            const valueEl = statBoxes[1].querySelector('.stat-value');
            if (valueEl) {
              valueEl.textContent = PrinterCalc.Utils.formatDimensions(orientedDimensions);
            }
          }

          // Print Time
          if (statBoxes[2]) {
            const valueEl = statBoxes[2].querySelector('.stat-value');
            if (valueEl) {
              valueEl.textContent = printTimes.display;
            }
          }
        }

        // Update cost breakdown
        if (progressContainer) {
          PrinterCalc.Utils.createCostBreakdown(
            progressContainer,
            materialResult.costs,
            currency
          );
        }

        // Update printer stats
        if (printer400Stats) {
          this.updatePrinterStats(printer400Stats, capacity400, currency);
        }

        if (printer600Stats) {
          this.updatePrinterStats(printer600Stats, capacity600, currency);
        }

        // Update packing visualizations
        this.updatePackingVisualization(
          rowId,
          packing400El,
          capacity400,
          PrinterCalc.CONSTANTS.PRINTERS['400']
        );

        this.updatePackingVisualization(
          rowId,
          packing600El,
          capacity600,
          PrinterCalc.CONSTANTS.PRINTERS['600']
        );
      } catch (error) {
        console.error(`Error updating results for row ${rowId}:`, error);
      }
    },

    /**
     * Update printer stats element
     * @param {HTMLElement} element - Stats element
     * @param {Object} capacity - Capacity data
     * @param {string} currency - Currency code
     */

    updatePrinterStats: function (element, capacity, currency) {
      if (!element || !capacity) return;

      if (capacity.fitsInPrinter) {
        // Get row ID from element ID
        const rowId = element.id.split('-')[0];

        // Get the calculated material cost directly
        const rowData = this.rows[rowId];

        let singleObjectCost = 0;

        if (rowData && rowData.materialResult && rowData.materialResult.costs && !isNaN(rowData.materialResult.costs.total)) {
          // Use the already calculated material cost
          singleObjectCost = rowData.materialResult.costs.total;
        }

        // Make sure the cost is a valid number
        if (isNaN(singleObjectCost) || singleObjectCost <= 0) {
          // Attempt to recalculate if we have the volumeCm3
          if (rowData && rowData.stlData && rowData.stlData.volumeCm3) {
            try {
              const materialResult = PrinterCalc.MaterialCalculator.calculate(
                rowData.stlData.volumeCm3,
                rowData.applyGlaze,
                currency
              );
              singleObjectCost = materialResult.costs.total;
            } catch (e) {
              console.error('Error recalculating cost:', e);
            }
          }
        }

        // Calculate total cost for all objects
        const batchCost = capacity.totalObjects * singleObjectCost;

        // Build HTML content
        element.innerHTML = `
            <p><span class="printer-highlight">${capacity.totalObjects}</span> objects</p>
            <p>Arrangement: ${capacity.arrangement}</p>
            <p>Print Time: ${capacity.formattedPrintTime}</p>
            <p>Total Cost: ${PrinterCalc.Utils.formatCurrency(batchCost, currency)}</p>
          `;
      } else {
        // Object doesn't fit
        element.innerHTML = `
            <p style="color: var(--danger); font-weight: 600;">Object exceeds printer capacity</p>
            <p>Check dimensions or change orientation</p>
          `;
      }
    },

    /**
     * Update packing visualization
     * @param {string} rowId - Row ID
     * @param {HTMLElement} container - Visualization container
     * @param {Object} capacity - Capacity data
     * @param {Object} printer - Printer specifications
     */
    updatePackingVisualization: function (rowId, container, capacity, printer) {
      if (!container || !capacity || !printer) return;

      // Create canvas if needed
      let canvas = container.querySelector('canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = container.clientWidth || 280;
        canvas.height = container.clientHeight || 200;
        container.appendChild(canvas);
      }

      // Draw visualization
      PrinterCalc.PrinterCapacity.visualize(canvas, capacity, printer);
    },

    /**
     * Remove an STL row
     * @param {string} rowId - Row ID
     */
    removeSTLRow: function (rowId) {
      // Get row element
      const row = document.getElementById(rowId);
      if (!row) return;

      try {
        // Clean up viewer
        if (this.rows[rowId] && this.rows[rowId].viewerId) {
          PrinterCalc.ModelViewer.dispose(this.rows[rowId].viewerId);
        }

        // Remove row element
        row.remove();

        // Remove from rows object
        delete this.rows[rowId];
      } catch (error) {
        console.error(`Error removing row ${rowId}:`, error);
      }
    },

    /**
     * Update all rows when settings change
     */
    updateAllRows: function () {
      // Get current currency
      const currency = PrinterCalc.SettingsManager.getSetting('currency') || 'USD';

      // Update each row
      Object.keys(this.rows).forEach(rowId => {
        // Update currency
        this.rows[rowId].currency = currency;

        // Update results
        this.updateResults(rowId);
      });
    },

    /**
     * Show memory warning if needed
     */
    showMemoryWarningIfNeeded: function () {
      // Check if device has limited memory (< 4GB)
      const hasLimitedMemory = navigator.deviceMemory && navigator.deviceMemory < 4;

      // Show warning if needed
      const warningEl = document.querySelector('.memory-warning');
      if (warningEl && hasLimitedMemory) {
        warningEl.style.display = 'block';
      }
    }
  };
})();