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
          
          // Calculate volume ratio based on dimensions
          const volumeRatio = (
            newDimensions.width * newDimensions.depth * newDimensions.height
          ) / (
            originalDimensions.width * originalDimensions.depth * originalDimensions.height
          );
          
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
          const rowData = PrinterCalc.STLManager.rows[rowId];
          if (!rowData || !rowData.stlData) return;
          
          // Calculate the volume ratio based on dimensions
          const volumeRatio = (
            newDimensions.width * newDimensions.depth * newDimensions.height
          ) / (
            rowData.stlData.dimensions.width * 
            rowData.stlData.dimensions.depth * 
            rowData.stlData.dimensions.height
          );
          
          // Update dimensions and volume
          rowData.stlData.dimensions = { ...newDimensions };
          rowData.stlData.volumeCm3 = rowData.stlData.volumeCm3 * volumeRatio;
          
          // Scale 3D model if available
          if (rowData.viewerId && PrinterCalc.ModelViewer && 
              typeof PrinterCalc.ModelViewer.scaleModel === 'function') {
            PrinterCalc.ModelViewer.scaleModel(rowData.viewerId, scaleFactor);
          }
          
          // Update results
          PrinterCalc.STLManager.updateResults(rowId);
          
          // Show notification
          if (PrinterCalc.Notification) {
            PrinterCalc.Notification.success(
              'Model Scaled',
              `Model scaled successfully by ${scaleFactor.toFixed(2)}x`
            );
          }
        } catch (error) {
          console.error('Error applying scaling:', error);
          
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
      }
    };
  })();