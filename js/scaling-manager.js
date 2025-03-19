/**
 * scaling-manager.js - Model Scaling Functionality
 * 
 * Provides scaling functionality for STL models with real-time updates
 * to costs and print times.
 */

(function() {
    // Make sure the namespace exists
    window.PrinterCalc = window.PrinterCalc || {};
    
    // Create a scaling manager module
    PrinterCalc.ScalingManager = {
      /**
       * Initialize scaling controls for an STL row
       * @param {string} rowId - Row ID
       */
      initScalingControls: function(rowId) {
        const row = document.getElementById(rowId);
        if (!row) return;
        
        try {
          // Get elements
          const scalingSection = row.querySelector('.scaling-section');
          if (!scalingSection) return;
          
          const toggleBtn = scalingSection.querySelector('.toggle-scaling');
          if (!toggleBtn) {
            console.error('Toggle scaling button not found in row:', rowId);
            return;
          }
          
          const scaleFactorInput = scalingSection.querySelector('.scale-factor');
          const lockProportionsCheckbox = scalingSection.querySelector('.lock-proportions');
          const widthInput = scalingSection.querySelector('.scale-width');
          const depthInput = scalingSection.querySelector('.scale-depth');
          const heightInput = scalingSection.querySelector('.scale-height');
          const applyBtn = scalingSection.querySelector('.apply-scale');
          const cancelBtn = scalingSection.querySelector('.cancel-scale');
          
          // Get current STL data
          const rowData = PrinterCalc.STLManager.rows[rowId];
          if (!rowData || !rowData.stlData) return;
          
          // Store original dimensions
          const originalDimensions = { ...rowData.stlData.dimensions };
          let currentScaleFactor = 1;
          
          console.log('Setting up toggle button click handler for row:', rowId);
          
          // Toggle scaling controls visibility
          toggleBtn.addEventListener('click', (e) => {
            console.log('Toggle scaling button clicked for row:', rowId);
            e.preventDefault(); // Prevent default button action
            
            const controls = scalingSection.querySelector('.scaling-controls');
            if (!controls) {
              console.error('Scaling controls not found');
              return;
            }
            
            const isVisible = controls.style.display === 'block';
            
            controls.style.display = isVisible ? 'none' : 'block';
            toggleBtn.innerHTML = isVisible ? 
              '<span class="material-icon">transform</span> Scale Model' : 
              '<span class="material-icon">close</span> Cancel Scaling';
            
            // Reset values when opening
            if (!isVisible) {
              // Set inputs to current dimensions
              widthInput.value = originalDimensions.width.toFixed(2);
              depthInput.value = originalDimensions.depth.toFixed(2);
              heightInput.value = originalDimensions.height.toFixed(2);
              scaleFactorInput.value = '1.00';
              currentScaleFactor = 1;
              
              // Update preview
              this.updateScalingPreview(rowId, originalDimensions, currentScaleFactor);
            }
          });
          
          // Handle scale factor changes
          scaleFactorInput.addEventListener('input', () => {
            const factor = parseFloat(scaleFactorInput.value);
            if (isNaN(factor) || factor <= 0) return;
            
            currentScaleFactor = factor;
            
            // Update dimension inputs
            widthInput.value = (originalDimensions.width * factor).toFixed(2);
            depthInput.value = (originalDimensions.depth * factor).toFixed(2);
            heightInput.value = (originalDimensions.height * factor).toFixed(2);
            
            // Update preview
            this.updateScalingPreview(rowId, {
              width: originalDimensions.width * factor,
              depth: originalDimensions.depth * factor,
              height: originalDimensions.height * factor
            }, factor);
          });
          
          // Handle dimension input changes with proportional scaling
          const handleDimensionChange = (dimension, value) => {
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue <= 0) return;
            
            // Calculate new scale factor based on the changed dimension
            const newScaleFactor = numValue / originalDimensions[dimension];
            
            if (lockProportionsCheckbox.checked) {
              // Update all dimensions proportionally
              currentScaleFactor = newScaleFactor;
              scaleFactorInput.value = newScaleFactor.toFixed(2);
              
              widthInput.value = (originalDimensions.width * newScaleFactor).toFixed(2);
              depthInput.value = (originalDimensions.depth * newScaleFactor).toFixed(2);
              heightInput.value = (originalDimensions.height * newScaleFactor).toFixed(2);
              
              // Update preview with all dimensions scaled
              this.updateScalingPreview(rowId, {
                width: originalDimensions.width * newScaleFactor,
                depth: originalDimensions.depth * newScaleFactor,
                height: originalDimensions.height * newScaleFactor
              }, newScaleFactor);
            } else {
              // Update just the changed dimension
              const updatedDimensions = {
                width: parseFloat(widthInput.value),
                depth: parseFloat(depthInput.value),
                height: parseFloat(heightInput.value)
              };
              
              updatedDimensions[dimension] = numValue;
              
              // Calculate volume scale factor (for preview)
              const volumeScaleFactor = (
                updatedDimensions.width * updatedDimensions.depth * updatedDimensions.height
              ) / (
                originalDimensions.width * originalDimensions.depth * originalDimensions.height
              );
              
              // Update preview
              this.updateScalingPreview(rowId, updatedDimensions, Math.cbrt(volumeScaleFactor));
            }
          };
          
          // Add change handlers to dimension inputs
          widthInput.addEventListener('input', () => handleDimensionChange('width', widthInput.value));
          depthInput.addEventListener('input', () => handleDimensionChange('depth', depthInput.value));
          heightInput.addEventListener('input', () => handleDimensionChange('height', heightInput.value));
          
          // Apply scale button
          applyBtn.addEventListener('click', () => {
            // Get scaled dimensions
            const scaledDimensions = {
              width: parseFloat(widthInput.value),
              depth: parseFloat(depthInput.value),
              height: parseFloat(heightInput.value)
            };
            
            // Apply scaling
            this.applyScaling(rowId, scaledDimensions, currentScaleFactor);
            
            // Hide scaling controls
            scalingSection.querySelector('.scaling-controls').style.display = 'none';
            toggleBtn.innerHTML = '<span class="material-icon">transform</span> Scale Model';
          });
          
          // Cancel button
          cancelBtn.addEventListener('click', () => {
            // Hide scaling controls
            scalingSection.querySelector('.scaling-controls').style.display = 'none';
            toggleBtn.innerHTML = '<span class="material-icon">transform</span> Scale Model';
          });
        } catch (error) {
          console.error('Error initializing scaling controls:', error);
        }
      },
      
      /**
       * Update scaling preview
       * @param {string} rowId - Row ID
       * @param {object} newDimensions - New dimensions object
       * @param {number} scaleFactor - Scale factor
       */
      updateScalingPreview: function(rowId, newDimensions, scaleFactor) {
        try {
          const row = document.getElementById(rowId);
          if (!row) return;
          
          const rowData = PrinterCalc.STLManager.rows[rowId];
          if (!rowData || !rowData.stlData) return;
          
          const originalVolume = rowData.stlData.volumeCm3;
          const originalDimensions = rowData.stlData.dimensions;
          
          // Check for zero dimensions to avoid division by zero
if (originalDimensions.width <= 0 || originalDimensions.depth <= 0 || originalDimensions.height <= 0) {
    console.error('Original dimensions contain zero or negative values', originalDimensions);
    return;
  }
  
  // Calculate volume ratio based on dimensions
  const volumeRatio = (
    newDimensions.width * newDimensions.depth * newDimensions.height
  ) / (
    originalDimensions.width * originalDimensions.depth * originalDimensions.height
  );
  
  // Safety check for invalid ratio
  if (!isFinite(volumeRatio) || isNaN(volumeRatio)) {
    console.error('Invalid volume ratio calculated', volumeRatio);
    return;
  }
  
  // Calculate new volume
  const newVolume = originalVolume * volumeRatio;
          
          // Update preview elements
          const preview = row.querySelector('.scaling-preview');
          if (!preview) return;
          
          const originalVolumeEl = preview.querySelector('.original-volume');
          const newVolumeEl = preview.querySelector('.new-volume');
          const volumeChangeEl = preview.querySelector('.volume-change');
          const costChangeEl = preview.querySelector('.cost-change');
          
          if (originalVolumeEl) originalVolumeEl.textContent = originalVolume.toFixed(2) + ' cm³';
          if (newVolumeEl) newVolumeEl.textContent = newVolume.toFixed(2) + ' cm³';
          
          // Calculate percentage changes
          const percentageChange = (volumeRatio * 100 - 100).toFixed(1);
          if (volumeChangeEl) volumeChangeEl.textContent = percentageChange + '%';
          if (costChangeEl) costChangeEl.textContent = percentageChange + '%';
          
          // Show preview section
          preview.style.display = 'block';
        } catch (error) {
          console.error('Error updating scaling preview:', error);
        }
      },
      
      /**
       * Apply scaling to an STL model
       * @param {string} rowId - Row ID
       * @param {object} newDimensions - New dimensions object
       * @param {number} scaleFactor - Scale factor
       */
      applyScaling: function(rowId, newDimensions, scaleFactor) {
        try {
          console.log('Applying scaling to row:', rowId, 'with scale factor:', scaleFactor);
          
          // Ensure we have access to STLManager
          if (!PrinterCalc.STLManager) {
            console.error('STLManager not available');
            throw new Error('STLManager not available');
          }
          
          // Get row data from STLManager, not from this.rows
          const rowData = PrinterCalc.STLManager.rows[rowId];
          if (!rowData) {
            console.error('Row data not found for ID:', rowId);
            throw new Error('Row data not found');
          }
          
          if (!rowData.stlData) {
            console.error('No STL data in row:', rowId);
            throw new Error('No STL data available');
          }
          
          console.log('Original dimensions:', rowData.stlData.dimensions);
          console.log('New dimensions:', newDimensions);
          
          // Calculate the volume ratio based on dimensions
          const volumeRatio = (
            newDimensions.width * newDimensions.depth * newDimensions.height
          ) / (
            rowData.stlData.dimensions.width * 
            rowData.stlData.dimensions.depth * 
            rowData.stlData.dimensions.height
          );
          
          console.log('Volume ratio:', volumeRatio);
          
          // Update dimensions and volume
          rowData.stlData.dimensions = { ...newDimensions };
          rowData.stlData.volumeCm3 = rowData.stlData.volumeCm3 * volumeRatio;
          
          // Scale 3D model if available
          if (rowData.viewerId && PrinterCalc.ModelViewer && 
              typeof PrinterCalc.ModelViewer.scaleModel === 'function') {
            PrinterCalc.ModelViewer.scaleModel(rowData.viewerId, scaleFactor);
          }
          
          // Update results first
          PrinterCalc.STLManager.updateResults(rowId);
          
          // Then update the batch visualizer
          setTimeout(() => {
            // Get row element
            const row = document.getElementById(rowId);
            if (!row) {
              console.error('Row element not found:', rowId);
              return;
            }
            
            console.log('Updating batch visualizers with scale factor:', scaleFactor);
            
            // Get visualizer elements
            const packing400El = row.querySelector(`#${rowId}-packing-400`);
            const packing600El = row.querySelector(`#${rowId}-packing-600`);
            
            // Clear visualizers if they exist
            if (packing400El) packing400El.innerHTML = '';
            if (packing600El) packing600El.innerHTML = '';
            
            // Get printer specs
            const printer400 = PrinterCalc.CONSTANTS.PRINTERS['400'];
            const printer600 = PrinterCalc.CONSTANTS.PRINTERS['600'];
            
            // Get current orientation
            const orientation = rowData.orientation || 'flat';
            
            // Recalculate and redraw visualizations
            if (packing400El && PrinterCalc.PrinterCapacity) {
              try {
                // Calculate capacity for Printer 400
                const capacity400 = PrinterCalc.PrinterCapacity.calculate(
                  newDimensions,
                  orientation,
                  '400'
                );
                
                // Add scale factor to capacity data
                capacity400.scaleFactor = scaleFactor;
                
                console.log('Capacity 400 calculated:', capacity400);
                
                // Redraw visualization
                PrinterCalc.STLManager.updatePackingVisualization(
                  rowId,
                  packing400El,
                  capacity400,
                  printer400
                );
              } catch (err) {
                console.error('Error updating 400 visualizer:', err);
              }
            }
            
            if (packing600El && PrinterCalc.PrinterCapacity) {
              try {
                // Calculate capacity for Printer 600
                const capacity600 = PrinterCalc.PrinterCapacity.calculate(
                  newDimensions,
                  orientation,
                  '600'
                );
                
                // Add scale factor to capacity data
                capacity600.scaleFactor = scaleFactor;
                
                console.log('Capacity 600 calculated:', capacity600);
                
                // Redraw visualization
                PrinterCalc.STLManager.updatePackingVisualization(
                  rowId,
                  packing600El,
                  capacity600,
                  printer600
                );
              } catch (err) {
                console.error('Error updating 600 visualizer:', err);
              }
            }
          }, 100); // Small delay to ensure updateResults has completed
          
          // Show notification
          if (PrinterCalc.Notification) {
            PrinterCalc.Notification.success(
              'Model Scaled',
              `Model scaled successfully by ${scaleFactor.toFixed(2)}x`
            );
          }
        } catch (error) {
          console.error('Error applying scaling:', error);
          console.error('Error stack:', error.stack);
          
          if (PrinterCalc.Notification) {
            PrinterCalc.Notification.error(
              'Scaling Error',
              'Failed to apply scaling to the model.'
            );
          }
        }
      },
      
      /**
       * Initialize scaling for manual input tab
       */
      initManualScaling: function() {
        try {
          // Get elements
          const volumeInput = document.getElementById('volume');
          const widthInput = document.getElementById('width');
          const depthInput = document.getElementById('depth');
          const heightInput = document.getElementById('height');
          const lockProportionsCheckbox = document.getElementById('manual-lock-proportions');
          
          if (!volumeInput || !widthInput || !depthInput || !heightInput) return;
          
          // Store original values
          let originalDimensions = {
            width: parseFloat(widthInput.value) || 50,
            depth: parseFloat(depthInput.value) || 50,
            height: parseFloat(heightInput.value) || 50
          };
          
          // Update volume when dimensions change
          const updateVolume = () => {
            const width = parseFloat(widthInput.value) || 0;
            const depth = parseFloat(depthInput.value) || 0;
            const height = parseFloat(heightInput.value) || 0;
            
            // Calculate volume in cm³
            const volumeCm3 = (width * depth * height) / 1000;
            volumeInput.value = volumeCm3.toFixed(2);
          };
          
          // Handle dimension changes with proportional scaling
          const handleDimensionChange = (dimension, value, inputElement) => {
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue <= 0) return;
            
            // Calculate scale factor
            const scaleFactor = numValue / originalDimensions[dimension];
            
            if (lockProportionsCheckbox && lockProportionsCheckbox.checked) {
              // Update other dimensions proportionally
              if (dimension !== 'width') {
                widthInput.value = (originalDimensions.width * scaleFactor).toFixed(1);
              }
              
              if (dimension !== 'depth') {
                depthInput.value = (originalDimensions.depth * scaleFactor).toFixed(1);
              }
              
              if (dimension !== 'height') {
                heightInput.value = (originalDimensions.height * scaleFactor).toFixed(1);
              }
            }
            
            // Update volume
            updateVolume();
          };
          
          // Add input handlers
          widthInput.addEventListener('input', () => handleDimensionChange('width', widthInput.value));
          depthInput.addEventListener('input', () => handleDimensionChange('depth', depthInput.value));
          heightInput.addEventListener('input', () => handleDimensionChange('height', heightInput.value));
          
          // Update original dimensions when Calculate button is clicked
          const calculateBtn = document.getElementById('calculateBtn');
          if (calculateBtn) {
            calculateBtn.addEventListener('click', () => {
              originalDimensions = {
                width: parseFloat(widthInput.value) || 50,
                depth: parseFloat(depthInput.value) || 50,
                height: parseFloat(heightInput.value) || 50
              };
            });
          }
        } catch (error) {
          console.error('Error initializing manual scaling:', error);
        }
      },
      
      initDimensionClickHandlers: function() {
        // Find all stat-value elements that contain dimensions
        const dimensionStats = document.querySelectorAll('.stat-box .stat-value');
        
        dimensionStats.forEach(statEl => {
          // Only add click handler to dimension stats (ones that contain × symbol)
          if (statEl.textContent.includes('×')) {
            // Make it visually clear this is clickable
            statEl.style.cursor = 'pointer';
            
            // Add click handler
            statEl.addEventListener('click', (e) => {
              // Find the parent row
              const row = statEl.closest('.stl-row, #manual-tab');
              
              if (!row) return;
              
              // Handle different row types
              if (row.id === 'manual-tab') {
                // For manual tab, just focus on the width input
                const widthInput = document.getElementById('width');
                if (widthInput) {
                  widthInput.focus();
                  widthInput.select();
                }
              } else {
                // For STL rows, find and click the scaling toggle button
                const toggleBtn = row.querySelector('.toggle-scaling');
                if (toggleBtn) {
                  toggleBtn.click();
                }
              }
            });
          }
        });
      },
      
      // Add this new method
      setupDimensionClickHandlers: function() {
        console.log('Setting up dimension click handlers');
        
        // Use event delegation to handle clicks on dimensions
        document.addEventListener('click', function(event) {
          // Find if we clicked on a stat value that contains dimensions
          let target = event.target;
          
          // Check if the clicked element is a stat value or a child of one
          while (target && !target.classList?.contains('stat-value')) {
            if (target === document.body) return;
            target = target.parentElement;
          }
          
          // If we found a stat value
          if (target && target.textContent.includes('×')) {
            console.log('Dimension value clicked:', target.textContent);
            
            // Find the parent row or manual tab
            const row = target.closest('.stl-row, #manual-tab');
            if (!row) {
              console.log('No parent row found');
              return;
            }
            
            console.log('Found parent row:', row.id);
            
            // Handle different row types
            if (row.id === 'manual-tab') {
              // For manual tab, just focus on the width input
              const widthInput = document.getElementById('width');
              if (widthInput) {
                console.log('Focusing on manual width input');
                widthInput.focus();
                widthInput.select();
              }
            } else {
              // For STL rows, find and click the scaling toggle button
              const toggleBtn = row.querySelector('.toggle-scaling');
              if (toggleBtn) {
                console.log('Clicking scale toggle button');
                toggleBtn.click();
              } else {
                console.log('Scale toggle button not found');
              }
            }
          }
        });
        
        // Highlight all dimension values to make them visibly clickable
        function highlightDimensions() {
          console.log('Highlighting dimension values');
          const dimensionStats = document.querySelectorAll('.stat-box .stat-value');
          
          dimensionStats.forEach(statEl => {
            // First, reset any previous styling
            statEl.style.cursor = '';
            statEl.style.color = '';
            statEl.title = '';
            
            // Check if this is dimensions label (contains × symbol AND has a "Dimensions" label sibling)
            if (statEl.textContent.includes('×')) {
              // Extra check: make sure this is actually dimensions by looking at the label
              const statBox = statEl.closest('.stat-box');
              const label = statBox ? statBox.querySelector('.stat-label') : null;
              
              if (label && label.textContent.toLowerCase().includes('dimension')) {
                statEl.style.cursor = 'pointer';
                statEl.style.color = '#3b82f6'; // Blue color to indicate clickable
                statEl.title = 'Click to scale';
              }
            }
          });
        }
        
        // Run immediately
        highlightDimensions();
        
        // Also run whenever results are updated
        document.addEventListener('printercalc:resultsUpdated', highlightDimensions);
        
        console.log('Dimension click handlers setup complete');
      }
    };
  })();