/**
 * stl-manager.js - STL File Management
 * 
 * Handles STL file uploads, processing, and display.
 */

(function () {
  // Make sure the namespace exists
  window.PrinterCalc = window.PrinterCalc || {};

  // Helper function to check THREE.js components
  function checkThreeComponents() {
    const missing = [];

    if (typeof THREE === 'undefined') missing.push('THREE main library');
    else {
      if (typeof THREE.STLLoader === 'undefined') missing.push('STLLoader');
      if (typeof THREE.OrbitControls === 'undefined') missing.push('OrbitControls');
    }

    return {
      ready: missing.length === 0,
      missing: missing
    };
  }

  // Create an STL manager module
  PrinterCalc.STLManager = {
    // Store STL rows by ID
    rows: {},

    /**
     * Initialize STL manager
     */
    init: function () {
      // Create initial STL upload area
      this.createSingleSTLInterface();

      // Show memory warning if appropriate
      this.showMemoryWarningIfNeeded();

      // Add lock proportions checkbox to manual tab
      const manualTab = document.getElementById('manual-tab');
      if (manualTab) {
        const formGroups = manualTab.querySelectorAll('.form-group');
        const lastFormGroup = formGroups[formGroups.length - 1];

        if (lastFormGroup && !document.getElementById('manual-lock-proportions')) {
          const toggleContainer = document.createElement('div');
          toggleContainer.className = 'toggle-container';
          toggleContainer.style.marginBottom = '1rem';
          toggleContainer.innerHTML = `
            <label class="toggle-switch">
              <input type="checkbox" id="manual-lock-proportions" checked>
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">Lock Proportions</span>
          `;

          lastFormGroup.after(toggleContainer);
        }
      }

      // Initialize manual scaling
      if (PrinterCalc.ScalingManager &&
        typeof PrinterCalc.ScalingManager.initManualScaling === 'function') {
        PrinterCalc.ScalingManager.initManualScaling();
      }
      setTimeout(() => {
        if (PrinterCalc.ScalingManager && typeof PrinterCalc.ScalingManager.initDimensionClickHandlers === 'function') {
          PrinterCalc.ScalingManager.initDimensionClickHandlers();
        }
      }, 200);
    },

    /**
 * Create a single STL interface
 */
    createSingleSTLInterface: function () {
      // Get the container
      const container = document.getElementById('stlRows');
      if (!container) {
        console.error('STL rows container not found');
        return;
      }

      // Clear any existing content
      container.innerHTML = '';

      // Generate a unique ID for the STL interface
      const rowId = (PrinterCalc.Utils && typeof PrinterCalc.Utils.generateId === 'function')
        ? PrinterCalc.Utils.generateId()
        : ('stl-' + Math.random().toString(36).substring(2, 15));

      // Create the single STL interface
      const rowElement = document.createElement('div');
      rowElement.id = rowId;
      rowElement.className = 'stl-row card';

      // Add main content
      rowElement.innerHTML = `
    <div class="stl-row-inner">
      <div class="stl-col stl-viz-col">
        <div class="model-viewer">
          <div class="model-viewer-loading">
            <div class="spinner"></div>
            <div>Loading model...</div>
            <div class="model-viewer-loading-progress">
              <div class="model-viewer-loading-bar" style="width: 0%"></div>
            </div>
          </div>
        </div>

        <div class="orientation-toggle">
          <button type="button" class="orientation-btn active" data-orientation="flat">
            <span class="material-icon">crop_landscape</span> Flat
          </button>
          <button type="button" class="orientation-btn" data-orientation="vertical">
            <span class="material-icon">crop_portrait</span> Vertical
          </button>
        </div>

        <div class="packing-visualizers">
          <div class="packing-visualizer" id="${rowId}-packing-400"></div>
          <div class="packing-visualizer" id="${rowId}-packing-600"></div>
        </div>
      </div>

      <div class="stl-col stl-info-col">
        <div class="upload-area">
          <div class="upload-icon">
            <span class="material-icon">cloud_upload</span>
          </div>
          <p><strong>Click or drag to upload STL</strong></p>
          <p>Supports binary STL files</p>
          <p class="upload-limits">Maximum file size: 100MB</p>
        </div>
        <input type="file" accept=".stl" style="display: none;">

        <div class="results-panel">
          <h3>
            <span class="material-icon">analytics</span>
            Cost Analysis
          </h3>
          <div class="error-message"></div>
          <div class="loading-message">
            <div class="spinner"></div>
            Processing STL file...
          </div>
          <div class="total-cost">--</div>

          <div class="stats-grid">
            <div class="stat-box">
              <div class="stat-value">--</div>
              <div class="stat-label">Volume (cm³)</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">--</div>
              <div class="stat-label">Dimensions (mm)</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">--</div>
              <div class="stat-label">Print Time (400/600)</div>
            </div>
          </div>

          <div class="toggle-container">
            <label class="toggle-switch">
              <input type="checkbox" class="glaze-toggle" checked>
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">Apply Glaze</span>
          </div>

          <div class="progress-container"></div>

          <h3>
            <span class="material-icon">view_in_ar</span>
            Printer Capacity
          </h3>
          <div class="printer-cards">
            <div class="printer-card">
              <div class="printer-title">Printer 400</div>
              <div class="printer-stats" id="${rowId}-printer-400-stats">
                <p>Calculating...</p>
              </div>
            </div>
            <div class="printer-card">
              <div class="printer-title">Printer 600</div>
              <div class="printer-stats" id="${rowId}-printer-600-stats">
                <p>Calculating...</p>
              </div>
            </div>
          </div>

          <div class="row-actions">
            <button class="btn btn-primary new-calculation-btn">
              <span class="material-icon">refresh</span> New Calculation
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

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

      // Hide elements initially
      const modelViewer = rowElement.querySelector('.model-viewer');
      const orientationToggle = rowElement.querySelector('.orientation-toggle');
      const packingVisualizers = rowElement.querySelector('.packing-visualizers');
      const resultsPanel = rowElement.querySelector('.results-panel');

      if (modelViewer) modelViewer.style.display = 'none';
      if (orientationToggle) orientationToggle.style.display = 'none';
      if (packingVisualizers) packingVisualizers.style.display = 'none';
      if (resultsPanel) resultsPanel.style.display = 'none';

      return rowId;
    },

    /**
     * Create a new STL row
     * @returns {string} Row ID
     */
    /**
 * Modified createSTLRow function to hide visualization elements initially
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

        // Hide visualization elements initially
        const modelViewer = rowElement.querySelector('.model-viewer');
        const orientationToggle = rowElement.querySelector('.orientation-toggle');
        const packingVisualizers = rowElement.querySelector('.packing-visualizers');
        const resultsPanel = rowElement.querySelector('.results-panel');

        if (modelViewer) modelViewer.style.display = 'none';
        if (orientationToggle) orientationToggle.style.display = 'none';
        if (packingVisualizers) packingVisualizers.style.display = 'none';
        if (resultsPanel) resultsPanel.style.display = 'none';

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

        // New calculation button handler
        const newCalculationBtn = row.querySelector('.new-calculation-btn');
        if (newCalculationBtn) {
          newCalculationBtn.addEventListener('click', () => {
            // Confirm with user before starting new calculation
            if (PrinterCalc.Notification) {
              const confirmNewCalc = confirm('Start a new calculation? This will clear the current STL model.');
              if (confirmNewCalc) {
                this.resetSTLInterface(rowId);
              }
            } else {
              this.resetSTLInterface(rowId);
            }
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

    /**
     * Modified handleFileUpload function to properly show visualization elements
     */
    handleFileUpload: async function (rowId, file) {
      console.log('Handling file upload for row:', rowId);

      const row = document.getElementById(rowId);
      if (!row) {
        console.error('Row element not found:', rowId);
        return;
      }

      // Check if desktop layout is active (window width > 1024px)
      const isDesktopLayout = window.innerWidth > 1024;

      // If in desktop layout, rearrange the row for better visualization
      if (isDesktopLayout) {
        // Add desktop grid layout class if not already present
        if (!row.classList.contains('stl-content-grid')) {
          row.classList.add('stl-content-grid');
        }

        // Enhance the visualization column with additional classes
        const vizCol = row.querySelector('.stl-viz-col');
        if (vizCol && !vizCol.classList.contains('desktop-viz-col')) {
          vizCol.classList.add('desktop-viz-col');
        }

        // Enhance the info column with additional classes
        const infoCol = row.querySelector('.stl-info-col');
        if (infoCol && !infoCol.classList.contains('desktop-info-col')) {
          infoCol.classList.add('desktop-info-col');
        }
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
        const packingVisualizers = row.querySelector('.packing-visualizers');
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

          // Check if THREE.js and all components are ready
          const threeStatus = checkThreeComponents();
          if (!threeStatus.ready) {
            console.error('THREE.js components not ready:', threeStatus.missing.join(', '));

            if (errorMessage) {
              errorMessage.textContent = `3D libraries not fully loaded (missing: ${threeStatus.missing.join(', ')}). Continuing without 3D visualization.`;
              errorMessage.style.display = 'block';
            }

            // Always clear loading indicators
            if (modelViewerLoading) modelViewerLoading.style.display = 'none';
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
              return;
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
            return;
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

          // Make sure loading indicators are cleared even on error
          if (modelViewerLoading) modelViewerLoading.style.display = 'none';
          if (loadingMessage) loadingMessage.style.display = 'none';

          // Continue with calculations without 3D
          this.processWithout3D(rowId, file);
          return;
        }

        // Hide loading indicators
        if (modelViewerLoading) modelViewerLoading.style.display = 'none';
        if (loadingMessage) loadingMessage.style.display = 'none';

        // Show the orientation toggle and packing visualizers now that the STL is loaded
        if (orientationToggle) orientationToggle.style.display = 'flex';
        if (packingVisualizers) packingVisualizers.style.display = 'flex';

        // Add class to show visualization column
        row.classList.add('file-uploaded');

        // Update results
        this.updateResults(rowId);

        // Show success notification
        if (PrinterCalc.Notification) {
          PrinterCalc.Notification.success(
            'STL Loaded',
            `Model loaded successfully (${stlData.triangleCount.toLocaleString()} triangles)`
          );
        }

        // Add scaling UI if not already present
        if (!row.querySelector('.scaling-section')) {
          this.addScalingUI(rowId);
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
    processWithout3D: async function (rowId, file) {
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
          // Check if STLProcessor is available
          if (!PrinterCalc.STLProcessor || typeof PrinterCalc.STLProcessor.processFile !== 'function') {
            throw new Error('STL processor not available. Please reload the page.');
          }

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

        // Validate stlData
        if (!stlData || typeof stlData.volumeCm3 !== 'number' ||
          !stlData.dimensions || typeof stlData.dimensions !== 'object') {
          console.error('Invalid STL data:', stlData);

          if (errorMessage) {
            errorMessage.textContent = 'Invalid data received from STL processor';
            errorMessage.style.display = 'block';
          }
          if (loadingMessage) loadingMessage.style.display = 'none';
          return;
        }

        // Store STL data
        this.rows[rowId].stlData = {
          file,
          volumeCm3: stlData.volumeCm3 || 0,
          dimensions: stlData.dimensions || { width: 0, depth: 0, height: 0 },
          triangleCount: stlData.triangleCount || 0
        };

        // Hide loading indicators
        if (loadingMessage) loadingMessage.style.display = 'none';

        // Show notification
        if (PrinterCalc.Notification && typeof PrinterCalc.Notification.success === 'function') {
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
    // This is the key function that needs fixing in stl-manager.js
    // Replace the updateResults function with this fixed version

    /**
     * Add scaling UI to STL row
     * @param {string} rowId - Row ID
     */
    addScalingUI: function (rowId) {
      try {
        const row = document.getElementById(rowId);
        if (!row) return;

        // Only add if not already present
        if (row.querySelector('.scaling-section')) return;

        // Check if this is a valid STL row, not a print time calculator section
        if (!this.rows[rowId] || !this.rows[rowId].stlData) {
          console.log('Not adding scaling UI to non-STL row:', rowId);
          return;
        }

        // Find the results panel
        const resultsPanel = row.querySelector('.results-panel');
        if (!resultsPanel) return;

        // Create scaling section
        const scalingSection = document.createElement('div');
        scalingSection.className = 'scaling-section';

        // Add HTML content for scaling UI
        scalingSection.innerHTML = `
          <button class="btn btn-primary btn-sm toggle-scaling">
            <span class="material-icon">transform</span> Scale Model
          </button>
          
          <div class="scaling-controls" style="display: none; margin-top: 1rem;">
            <div class="form-group">
              <label for="${rowId}-scale-factor">Scale Factor</label>
              <div class="input-group">
                <input 
                  id="${rowId}-scale-factor" 
                  class="scale-factor" 
                  type="number" 
                  min="0.1" 
                  max="5" 
                  step="0.01" 
                  value="1.00"
                >
                <span class="input-group-append">×</span>
              </div>
            </div>
            
            <div class="toggle-container">
              <label class="toggle-switch">
                <input type="checkbox" class="lock-proportions" checked>
                <span class="toggle-slider"></span>
              </label>
              <span class="toggle-label">Lock Proportions</span>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 1rem 0;">
              <div class="form-group">
                <label for="${rowId}-scale-width">Width (mm)</label>
                <input 
                  id="${rowId}-scale-width" 
                  class="scale-width" 
                  type="number" 
                  min="0.1" 
                  step="0.1"
                >
              </div>
              
              <div class="form-group">
                <label for="${rowId}-scale-depth">Depth (mm)</label>
                <input 
                  id="${rowId}-scale-depth" 
                  class="scale-depth" 
                  type="number" 
                  min="0.1" 
                  step="0.1"
                >
              </div>
              
              <div class="form-group">
                <label for="${rowId}-scale-height">Height (mm)</label>
                <input 
                  id="${rowId}-scale-height" 
                  class="scale-height" 
                  type="number" 
                  min="0.1" 
                  step="0.1"
                >
              </div>
            </div>
            
            <div style="display: flex; gap: 1rem;">
              <button class="btn btn-primary apply-scale">
                Apply Scale
              </button>
              
              <button class="btn btn-outline cancel-scale">
                Cancel
              </button>
            </div>
          </div>
          
          <div class="scaling-preview" style="
            display: none;
            margin-top: 1rem;
            padding: 1rem;
            background-color: var(--gray-50);
            border-radius: var(--radius);
          ">
            <h4>Preview of Changes</h4>
            <div style="display: flex; justify-content: space-between;">
              <div>
                <p><strong>Original Volume:</strong> <span class="original-volume">--</span></p>
                <p><strong>New Volume:</strong> <span class="new-volume">--</span></p>
              </div>
              <div>
                <p><strong>Volume Change:</strong> <span class="volume-change">--</span></p>
                <p><strong>Est. Cost Change:</strong> <span class="cost-change">--</span></p>
              </div>
            </div>
          </div>
        `;

        // Insert after stats grid
        const statsGrid = resultsPanel.querySelector('.stats-grid');
        if (statsGrid) {
          statsGrid.after(scalingSection);
        } else {
          // Fallback: insert at the beginning of the results panel
          resultsPanel.prepend(scalingSection);
        }

        // Log that we're about to initialize scaling controls
        console.log('Adding scaling UI to row:', rowId);

        // Initialize scaling controls
        if (PrinterCalc.ScalingManager && typeof PrinterCalc.ScalingManager.initScalingControls === 'function') {
          PrinterCalc.ScalingManager.initScalingControls(rowId);
        } else {
          console.error('ScalingManager not available or missing initScalingControls function');
        }
      } catch (error) {
        console.error('Error adding scaling UI:', error);
      }
    },

    /**
     * Update results for an STL row
     * @param {string} rowId - Row ID
     */
    updateResults: function (rowId) {
      console.log('Updating results for row:', rowId);

      // Always try to clear loading indicators first to prevent UI from getting stuck
      const element = document.getElementById(rowId);
      if (element) {
        const loadingElem = element.querySelector('.loading-message');
        if (loadingElem) {
          setTimeout(() => {
            loadingElem.style.display = 'none';
          }, 100);
        }

        const spinnerElem = element.querySelector('.model-viewer-loading');
        if (spinnerElem) {
          spinnerElem.style.display = 'none';
        }
      }

      // Validate all dependencies are available
      if (!PrinterCalc.MaterialCalculator || typeof PrinterCalc.MaterialCalculator.calculate !== 'function') {
        console.error('MaterialCalculator not available for updating results');
        this.showErrorInRow(rowId, 'Calculation module not available. Please reload the page.');
        return;
      }

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
        this.showErrorInRow(rowId, 'Invalid volume data. Please try uploading again.');
        return;
      }

      if (!dimensions || typeof dimensions !== 'object') {
        console.error('Invalid dimensions data:', dimensions);
        this.showErrorInRow(rowId, 'Invalid dimension data. Please try uploading again.');
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
        const errorMessageEl = row.querySelector('.error-message');

        // Hide any previous error message
        if (errorMessageEl) {
          errorMessageEl.style.display = 'none';
        }

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

        // Calculate material costs with enhanced error handling
        // Calculate material costs with enhanced error handling
        let materialResult;
        try {
          if (!PrinterCalc.MaterialCalculator || typeof PrinterCalc.MaterialCalculator.calculate !== 'function') {
            throw new Error('MaterialCalculator not available or not initialized');
          }

          materialResult = PrinterCalc.MaterialCalculator.calculate(
            volumeCm3,
            applyGlaze,
            currency
          );

          // Validate calculation results
          if (!materialResult || !materialResult.costs || typeof materialResult.costs.total !== 'number' || isNaN(materialResult.costs.total)) {
            throw new Error('Invalid calculation results returned');
          }

          console.log('Material calculation successful:', materialResult);
          this.rows[rowId].materialResult = materialResult;
        } catch (calcError) {
          console.error('Error in material calculation:', calcError);
          this.showErrorInRow(rowId, 'Error calculating material costs. Please try again.');
          return;
        }

        // Calculate print times
        let printTimes;
        try {
          printTimes = PrinterCalc.MaterialCalculator.calculatePrintTimes(
            orientedDimensions,
            orientation
          );
        } catch (printError) {
          console.error('Error calculating print times:', printError);
          printTimes = {
            display: '--/--',
            printer400: { fits: false, seconds: null, formatted: '--' },
            printer600: { fits: false, seconds: null, formatted: '--' }
          };
        }

        // Calculate printer capacity
        let capacity400, capacity600;
        try {
          if (PrinterCalc.PrinterCapacity && typeof PrinterCalc.PrinterCapacity.calculate === 'function') {
            capacity400 = PrinterCalc.PrinterCapacity.calculate(
              orientedDimensions,
              orientation,
              '400'
            );

            capacity600 = PrinterCalc.PrinterCapacity.calculate(
              orientedDimensions,
              orientation,
              '600'
            );
          } else {
            console.error('PrinterCapacity module not available');
            capacity400 = { fitsInPrinter: false };
            capacity600 = { fitsInPrinter: false };
          }
        } catch (capacityError) {
          console.error('Error calculating printer capacity:', capacityError);
          capacity400 = { fitsInPrinter: false };
          capacity600 = { fitsInPrinter: false };
        }

        // Update total cost
        if (totalCostEl) {
          if (PrinterCalc.Utils && typeof PrinterCalc.Utils.formatCurrency === 'function') {
            totalCostEl.textContent = PrinterCalc.Utils.formatCurrency(
              materialResult.costs.total,
              currency
            );
          } else {
            // Fallback formatting if Utils not available
            const symbol = (PrinterCalc.CONSTANTS && PrinterCalc.CONSTANTS.CURRENCY_SYMBOLS) ?
              (PrinterCalc.CONSTANTS.CURRENCY_SYMBOLS[currency] || '$') : '$';
            totalCostEl.textContent = `${symbol}${materialResult.costs.total.toFixed(2)}`;
          }
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
              if (PrinterCalc.Utils && typeof PrinterCalc.Utils.formatDimensions === 'function') {
                valueEl.textContent = PrinterCalc.Utils.formatDimensions(orientedDimensions);
              } else {
                // Fallback formatting
                const { width, depth, height } = orientedDimensions;
                valueEl.textContent = `${width.toFixed(1)} × ${depth.toFixed(1)} × ${height.toFixed(1)}`;
              }
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
          if (PrinterCalc.Utils && typeof PrinterCalc.Utils.createCostBreakdown === 'function') {
            PrinterCalc.Utils.createCostBreakdown(
              progressContainer,
              materialResult.costs,
              currency
            );
          } else {
            // Simple fallback for cost breakdown
            this.createSimpleCostBreakdown(progressContainer, materialResult.costs, currency);
          }
        }

        // Update printer stats
        if (printer400Stats) {
          this.updatePrinterStats(printer400Stats, capacity400, currency);
        }

        if (printer600Stats) {
          this.updatePrinterStats(printer600Stats, capacity600, currency);
        }
        if (PrinterCalc.PrinterCapacity && typeof PrinterCalc.PrinterCapacity.visualize === 'function') {
          // Ensure packing visualizers are properly initialized after DOM updates
          setTimeout(() => {
            this.updatePackingVisualization(
              rowId,
              row.querySelector(`#${rowId}-packing-400`),
              capacity400,
              PrinterCalc.CONSTANTS.PRINTERS['400']
            );
            this.updatePackingVisualization(
              rowId,
              row.querySelector(`#${rowId}-packing-600`),
              capacity600,
              PrinterCalc.CONSTANTS.PRINTERS['600']
            );
          }, 100);
        }

        // Update packing visualizations
        if (PrinterCalc.PrinterCapacity && typeof PrinterCalc.PrinterCapacity.visualize === 'function') {
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
        }
        // Dispatch event to notify of results update
        const event = new CustomEvent('printercalc:resultsUpdated', {
          detail: { rowId: rowId }
        });
        document.dispatchEvent(event);
      } catch (error) {
        console.error(`Error updating results for row ${rowId}:`, error);
        this.showErrorInRow(rowId, 'Error updating results. Please try again.');
      }

      // Add enhanced desktop controls if in desktop layout
      if (window.innerWidth > 1024 && rowData.viewerId &&
        PrinterCalc.ModelViewer && typeof PrinterCalc.ModelViewer.addDesktopControls === 'function' &&
        !row.querySelector('.viewer-toolbar')) {
        setTimeout(() => {
          PrinterCalc.ModelViewer.addDesktopControls(rowData.viewerId);
        }, 200); // Small delay to ensure model is loaded
      }

      // Desktop optimization: Add keyboard shortcut tips
      if (window.innerWidth > 1024) {
        const statsBoxes = row.querySelectorAll('.stat-box');
        if (statsBoxes.length > 0) {
          // Add keyboard shortcut tip to dimensions box
          const dimensionsBox = Array.from(statsBoxes).find(box => {
            const label = box.querySelector('.stat-label');
            return label && label.textContent.includes('Dimensions');
          });

          if (dimensionsBox) {
            const valueEl = dimensionsBox.querySelector('.stat-value');
            if (valueEl && !valueEl.querySelector('.shortcut-tip')) {
              // Add scaling shortcut tip
              const tip = document.createElement('span');
              tip.className = 'shortcut-tip';
              tip.textContent = 'Click to scale (S)';
              valueEl.style.position = 'relative';
              valueEl.appendChild(tip);
            }
          }
        }
      }
    },

    /**
     * Show an error message in the row
     * @param {string} rowId - Row ID
     * @param {string} message - Error message
     */
    showErrorInRow: function (rowId, message) {
      const row = document.getElementById(rowId);
      if (!row) return;

      const errorMessageEl = row.querySelector('.error-message');
      if (errorMessageEl) {
        errorMessageEl.textContent = message;
        errorMessageEl.style.display = 'block';
      }

      const loadingMessageEl = row.querySelector('.loading-message');
      if (loadingMessageEl) {
        loadingMessageEl.style.display = 'none';
      }
    },

    /**
     * Simple fallback for cost breakdown when Utils is not available
     * @param {HTMLElement} container - Container for cost breakdown
     * @param {Object} costs - Cost breakdown object
     * @param {string} currency - Currency code
     */
    createSimpleCostBreakdown: function (container, costs, currency) {
      if (!container || !costs) return;

      // Clear container
      container.innerHTML = '';

      // Get currency symbol
      const symbol = (PrinterCalc.CONSTANTS && PrinterCalc.CONSTANTS.CURRENCY_SYMBOLS) ?
        (PrinterCalc.CONSTANTS.CURRENCY_SYMBOLS[currency] || '$') : '$';

      // Create simple cost breakdown HTML
      const costItems = [
        { name: "Powder", cost: costs.powder, color: "#3a86ff" },
        { name: "Binder", cost: costs.binder, color: "#ff006e" },
        { name: "Silica", cost: costs.silica, color: "#8338ec" },
        { name: "Glaze", cost: costs.glaze, color: "#ffbe0b" }
      ];

      costItems.forEach(item => {
        if (item.cost <= 0) return;

        const percentage = costs.total > 0 ? (item.cost / costs.total) * 100 : 0;

        container.innerHTML += `
      <div class="progress-item">
        <div class="progress-header">
          <div class="progress-label">${item.name}</div>
          <div class="progress-value">${symbol}${item.cost.toFixed(2)} (${percentage.toFixed(1)}%)</div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${percentage}%; background-color: ${item.color}"></div>
        </div>
      </div>
    `;
      });
    },

    /**
     * Update printer stats element
     * @param {HTMLElement} element - Stats element
     * @param {Object} capacity - Capacity data
     * @param {string} currency - Currency code
     */
    updatePrinterStats: function (element, capacity, currency) {
      try {
        const rowId = element.closest('.stl-row').id;
        const rowData = this.rows[rowId];

        console.log('Updating printer stats, row data:', rowId, rowData);

        let singleObjectCost = 0;

        if (rowData && rowData.materialResult && rowData.materialResult.costs &&
          !isNaN(rowData.materialResult.costs.total)) {
          singleObjectCost = Number(rowData.materialResult.costs.total);
        } else if (rowData && rowData.stlData && rowData.stlData.volumeCm3) {
          if (PrinterCalc.MaterialCalculator && typeof PrinterCalc.MaterialCalculator.calculate === 'function') {
            const materialResult = PrinterCalc.MaterialCalculator.calculate(
              rowData.stlData.volumeCm3,
              rowData.applyGlaze !== false,
              currency || 'USD'
            );
            singleObjectCost = Number(materialResult.costs.total);
            console.log('Recalculated cost:', singleObjectCost);
          } else {
            console.error('MaterialCalculator not available for recalculation');
          }
        }

        // Fix potential NaN issues
        const objectCount = Number(capacity.totalObjects) || 0;
        // Ensure singleObjectCost is a valid number
        singleObjectCost = isNaN(singleObjectCost) ? 0 : singleObjectCost;
        const batchCost = objectCount * singleObjectCost;

        console.log('STL Manager batch calculation:', objectCount, '*', singleObjectCost, '=', batchCost);

        let formattedBatchCost;
        if (PrinterCalc.Utils && typeof PrinterCalc.Utils.formatCurrency === 'function') {
          formattedBatchCost = PrinterCalc.Utils.formatCurrency(batchCost, currency);
        } else {
          const symbol = (PrinterCalc.CONSTANTS && PrinterCalc.CONSTANTS.CURRENCY_SYMBOLS) ?
            (PrinterCalc.CONSTANTS.CURRENCY_SYMBOLS[currency] || '$') : '$';
          formattedBatchCost = `${symbol}${batchCost.toFixed(2)}`;
        }

        if (capacity.fitsInPrinter) {
          element.innerHTML = `
          <p><span class="printer-highlight">${capacity.totalObjects}</span> objects</p>
          <p>Arrangement: ${capacity.arrangement}</p>
          <p>Print Time: ${capacity.formattedPrintTime}</p>
          <p>Total Cost: ${formattedBatchCost}</p>
        `;
        } else {
          element.innerHTML = `
          <p style="color: var(--danger); font-weight: 600;">Object exceeds printer capacity</p>
          <p>Check dimensions or change orientation</p>
        `;
        }
      } catch (error) {
        console.error('Error updating printer stats:', error, error.stack);
        element.innerHTML = `
        <p style="color: var(--danger); font-weight: 600;">Error updating printer stats</p>
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
      if (!container) {
        console.error(`Missing container for row ${rowId}`);
        return;
      }

      // Add safety checks for capacity and printer
      if (!capacity || !printer) {
        console.error(`Missing capacity or printer data for row ${rowId}`);
        return;
      }

      try {
        // Clean up previous visualization if exists
        if (container.visualizerCleanup && typeof container.visualizerCleanup === 'function') {
          container.visualizerCleanup();
        }

        // Clear container
        container.innerHTML = '';

        // Check if capacity data is valid
        if (!capacity.fitsInPrinter) {
          const errorMsg = document.createElement('div');
          errorMsg.textContent = 'Object exceeds printer capacity';
          errorMsg.style.textAlign = 'center';
          errorMsg.style.padding = '50px 0';
          errorMsg.style.color = '#ef4444';
          container.appendChild(errorMsg);
          return;
        }

        // Check if we have the STL data for this row
        let stlGeometry = null;

        if (this.rows[rowId] && this.rows[rowId].stlData && this.rows[rowId].viewerId) {
          // Try to get the geometry from the ModelViewer
          try {
            if (PrinterCalc.ModelViewer && typeof PrinterCalc.ModelViewer.getGeometry === 'function') {
              stlGeometry = PrinterCalc.ModelViewer.getGeometry(this.rows[rowId].viewerId);
            } else {
              // Fallback: Find the mesh in the viewer's scene
              const viewer = PrinterCalc.ModelViewer.viewers[this.rows[rowId].viewerId];

              if (viewer && viewer.threeContext && viewer.threeContext.scene) {
                // Find the model mesh in the scene
                viewer.threeContext.scene.traverse(object => {
                  if (object.isMesh && object.userData && object.userData.isModel) {
                    // Clone the geometry for use in the batch visualizer
                    stlGeometry = object.geometry.clone();
                  }
                });
              }
            }
          } catch (error) {
            console.warn('Error getting STL geometry from viewer:', error);
          }
        }

        // Explicitly show the container
        if (container.style.display === 'none') {
          container.style.display = 'block';
        }

        // Use 3D visualization with STL geometry if available
        if (PrinterCalc.PrinterCapacity && typeof PrinterCalc.PrinterCapacity.visualize3D === 'function') {
          PrinterCalc.PrinterCapacity.visualize3D(container, capacity, printer, stlGeometry);
        } else {
          // Create canvas for 2D visualization (fallback)
          const canvas = document.createElement('canvas');
          canvas.width = container.clientWidth || 280;
          canvas.height = container.clientHeight || 200;
          container.appendChild(canvas);

          // Use the 2D visualization method
          if (PrinterCalc.PrinterCapacity && typeof PrinterCalc.PrinterCapacity.visualize === 'function') {
            PrinterCalc.PrinterCapacity.visualize(canvas, capacity, printer);
          }
        }
      } catch (error) {
        console.error(`Error updating packing visualization for row ${rowId}:`, error);

        // Try to display a simple error message
        try {
          const errorMsg = document.createElement('div');
          errorMsg.textContent = 'Error visualizing capacity';
          errorMsg.style.textAlign = 'center';
          errorMsg.style.padding = '50px 0';
          errorMsg.style.color = '#94a3b8';

          // Clear container first
          container.innerHTML = '';
          container.appendChild(errorMsg);
        } catch (fallbackError) {
          console.error('Error adding fallback message:', fallbackError);
        }
      }
    },

    // Helper methods for 3D visualization
    init3DVisualizer: function (container) {
      const width = container.clientWidth || 280;
      const height = container.clientHeight || 200;

      // Determine if we're in dark mode
      const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';

      // Create scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(isDarkMode ? 0x1e293b : 0xf8fafc);

      // Create camera
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
      camera.position.set(400, 400, 400);

      // Create renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      container.appendChild(renderer.domElement);

      // Add lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 1, 1);
      scene.add(directionalLight);

      return { scene, camera, renderer };
    },

    addPrinterVolume: function (scene, printer) {
      const { width, depth, height } = printer.dimensions;

      // Create wireframe box for printer volume
      const geometry = new THREE.BoxGeometry(width, height, depth);
      const material = new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        wireframe: true,
        opacity: 0.5,
        transparent: true
      });

      const printerBox = new THREE.Mesh(geometry, material);

      // Position box with bottom at y=0 and centered in xz plane
      printerBox.position.set(width / 2, height / 2, depth / 2);

      scene.add(printerBox);

      // Add grid helper at bottom
      const gridHelper = new THREE.GridHelper(Math.max(width, depth) * 1.2, 10, 0x555555, 0x333333);
      gridHelper.rotation.x = Math.PI / 2;
      gridHelper.position.y = 0.1; // slightly above bottom to avoid z-fighting
      scene.add(gridHelper);
    },

    addPackedObjects: function (scene, capacityData) {
      const { positions, objectDimensions } = capacityData;

      if (!positions || !positions.length) return;

      const geometry = new THREE.BoxGeometry(
        objectDimensions.width,
        objectDimensions.height,
        objectDimensions.depth
      );

      const material = new THREE.MeshPhongMaterial({
        color: 0x4ade80,
        opacity: 0.8,
        transparent: true
      });

      positions.forEach(pos => {
        const mesh = new THREE.Mesh(geometry, material);

        // Position the mesh
        mesh.position.set(
          pos.x + objectDimensions.width / 2,
          pos.z + objectDimensions.height / 2,
          pos.y + objectDimensions.depth / 2
        );

        scene.add(mesh);
      });
    },

    fitCameraToScene: function (camera, scene) {
      // Create a bounding box for all objects in the scene
      const box = new THREE.Box3().setFromObject(scene);

      // Get the center and size of the box
      const center = new THREE.Vector3();
      box.getCenter(center);

      const size = new THREE.Vector3();
      box.getSize(size);

      // Calculate the distance needed to view the entire box
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2)));

      // Add some padding
      cameraZ *= 1.5;

      // Position the camera
      camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
      camera.lookAt(center);
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

        // Clean up any visualizations
        const visualizers = row.querySelectorAll('.packing-visualizer');
        visualizers.forEach(vis => {
          vis.innerHTML = '';
        });

        // Remove row element
        row.remove();

        // Remove from rows object
        delete this.rows[rowId];
      } catch (error) {
        console.error(`Error removing row ${rowId}:`, error);
      }
    },
    /**
 * Reset the STL interface to start a new calculation
 * @param {string} rowId - Row ID
 */
    resetSTLInterface: function (rowId) {
      try {
        // Get row element
        const row = document.getElementById(rowId);
        if (!row) return;

        // Clean up viewer if it exists
        if (this.rows[rowId] && this.rows[rowId].viewerId) {
          if (PrinterCalc.ModelViewer && typeof PrinterCalc.ModelViewer.dispose === 'function') {
            PrinterCalc.ModelViewer.dispose(this.rows[rowId].viewerId);
          }
          this.rows[rowId].viewerId = null;
        }

        // Reset row data
        this.rows[rowId].stlData = null;
        this.rows[rowId].orientation = 'flat';

        // Get elements to reset
        const uploadArea = row.querySelector('.upload-area');
        const fileInput = row.querySelector('input[type="file"]');
        const modelViewer = row.querySelector('.model-viewer');
        const orientationToggle = row.querySelector('.orientation-toggle');
        const packingVisualizers = row.querySelector('.packing-visualizers');
        const resultsPanel = row.querySelector('.results-panel');
        const errorMessage = row.querySelector('.error-message');

        // Reset file input
        if (fileInput) {
          fileInput.value = "";
        }

        // Reset UI states
        if (uploadArea) uploadArea.style.display = 'block';
        if (modelViewer) modelViewer.style.display = 'none';
        if (orientationToggle) orientationToggle.style.display = 'none';
        if (packingVisualizers) packingVisualizers.style.display = 'none';
        if (resultsPanel) resultsPanel.style.display = 'none';
        if (errorMessage) errorMessage.style.display = 'none';

        // Reset orientation buttons
        const orientationBtns = row.querySelectorAll('.orientation-btn');
        orientationBtns.forEach(btn => {
          if (btn.getAttribute('data-orientation') === 'flat') {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });

        // Clear the model viewer
        if (modelViewer) {
          // Remove any existing 3D content
          const modelViewerLoading = modelViewer.querySelector('.model-viewer-loading');
          if (modelViewerLoading) {
            modelViewerLoading.style.display = 'none';
          }
        }

        // Clear the packing visualizers
        const packing400El = row.querySelector(`#${rowId}-packing-400`);
        const packing600El = row.querySelector(`#${rowId}-packing-600`);
        if (packing400El) packing400El.innerHTML = '';
        if (packing600El) packing600El.innerHTML = '';

        // Show success notification
        if (PrinterCalc.Notification) {
          PrinterCalc.Notification.info(
            'New Calculation',
            'Ready for a new STL file.'
          );
        }
      } catch (error) {
        console.error('Error resetting STL interface:', error);
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