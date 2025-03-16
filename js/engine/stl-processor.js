/**
 * stl-processor.js - STL File Processing
 * 
 * Processes STL files to extract volume, dimensions, and geometry data.
 * Modified to handle larger STL files.
 */

(function () {
  // Make sure the namespace exists
  window.PrinterCalc = window.PrinterCalc || {};

  // Create an STL processor module
  PrinterCalc.STLProcessor = {
    /**
     * Process an STL file
     * @param {File} file - STL file
     * @returns {Promise<Object>} Promise resolving to STL data
     */
    processFile: async function (file) {
      try {
        // Validate file
        if (!file || !file.name || !file.name.toLowerCase().endsWith('.stl')) {
          throw new Error('Invalid STL file format. Please upload a valid STL file.');
        }

        // Read file as array buffer
        let arrayBuffer;
        if (PrinterCalc.Utils && typeof PrinterCalc.Utils.readFileAsArrayBuffer === 'function') {
          arrayBuffer = await PrinterCalc.Utils.readFileAsArrayBuffer(file);
        } else {
          // Fallback implementation if Utils isn't available yet
          arrayBuffer = await new Promise((resolve, reject) => {
            try {
              const reader = new FileReader();
              reader.onload = function (event) {
                resolve(event.target.result);
              };
              reader.onerror = function (error) {
                reject(error);
              };
              reader.readAsArrayBuffer(file);
            } catch (error) {
              console.error('Error reading file:', error);
              reject(error);
            }
          });
        }

        // Try to use Web Worker if available
        if (window.Worker) {
          try {
            return await this.processWithWorker(arrayBuffer);
          } catch (workerError) {
            console.warn('Web Worker failed, falling back to main thread:', workerError);
            return this.processInMainThread(arrayBuffer);
          }
        } else {
          // Process in main thread if Web Workers not supported
          return this.processInMainThread(arrayBuffer);
        }
      } catch (error) {
        console.error('Error processing STL file:', error);
        throw error;
      }
    },

    /**
     * Process STL in a Web Worker
     * @param {ArrayBuffer} arrayBuffer - STL file data
     * @returns {Promise<Object>} Promise resolving to processed data
     */
    processWithWorker: function (arrayBuffer) {
      return new Promise((resolve, reject) => {
        // Worker code as a string
        const workerCode = `
          self.onmessage = function(e) {
            const arrayBuffer = e.data;
            
            try {
              const startTime = performance.now();
              
              // Parse binary STL
              const data = new DataView(arrayBuffer);
              const triangleCount = data.getUint32(80, true);
              
              // For large files, send a notification back to main thread
              if (triangleCount > 5000000) {
                self.postMessage({
                  progress: true,
                  triangleCount: triangleCount,
                  message: "Processing large model with " + triangleCount + " triangles..."
                });
              }
              
              let totalVolume = 0;
              let minX = Infinity, minY = Infinity, minZ = Infinity;
              let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
              
              let offset = 84; // Skip header and triangle count
              
              // Process in batches for large files
              const BATCH_SIZE = 100000;
              let processedTriangles = 0;
              
              while (processedTriangles < triangleCount) {
                const batchEnd = Math.min(processedTriangles + BATCH_SIZE, triangleCount);
                
                for (let i = processedTriangles; i < batchEnd; i++) {
                  // Skip normal vector (12 bytes)
                  offset += 12;
                  
                  // Read vertices
                  const v1x = data.getFloat32(offset, true);
                  const v1y = data.getFloat32(offset + 4, true);
                  const v1z = data.getFloat32(offset + 8, true);
                  offset += 12;
                  
                  const v2x = data.getFloat32(offset, true);
                  const v2y = data.getFloat32(offset + 4, true);
                  const v2z = data.getFloat32(offset + 8, true);
                  offset += 12;
                  
                  const v3x = data.getFloat32(offset, true);
                  const v3y = data.getFloat32(offset + 4, true);
                  const v3z = data.getFloat32(offset + 8, true);
                  offset += 12;
                  
                  // Skip attribute byte count (2 bytes)
                  offset += 2;
                  
                  // Update min/max coordinates
                  minX = Math.min(minX, v1x, v2x, v3x);
                  minY = Math.min(minY, v1y, v2y, v3y);
                  minZ = Math.min(minZ, v1z, v2z, v3z);
                  
                  maxX = Math.max(maxX, v1x, v2x, v3x);
                  maxY = Math.max(maxY, v1y, v2y, v3y);
                  maxZ = Math.max(maxZ, v1z, v2z, v3z);
                  
                  // Calculate tetrahedron volume using the divergence theorem
                  const crossX = (v2y - v1y) * (v3z - v1z) - (v2z - v1z) * (v3y - v1y);
                  const crossY = (v2z - v1z) * (v3x - v1x) - (v2x - v1x) * (v3z - v1z);
                  const crossZ = (v2x - v1x) * (v3y - v1y) - (v2y - v1y) * (v3x - v1x);
                  
                  const volume = (v1x * crossX + v1y * crossY + v1z * crossZ) / 6.0;
                  totalVolume += volume;
                }
                
                processedTriangles = batchEnd;
                
                // Report progress for large files
                if (triangleCount > 1000000 && processedTriangles % 1000000 < BATCH_SIZE) {
                  const progress = Math.round((processedTriangles / triangleCount) * 100);
                  self.postMessage({
                    progress: true,
                    current: processedTriangles,
                    total: triangleCount,
                    percent: progress,
                    message: "Processed " + (processedTriangles/1000000).toFixed(1) + "M of " + 
                             (triangleCount/1000000).toFixed(1) + "M triangles (" + progress + "%)"
                  });
                }
              }
              
              // Convert to cm³ and ensure positive volume
              const volumeCm3 = Math.abs(totalVolume) / 1000;
              
              // Calculate dimensions in mm
              const dimensions = {
                width: maxX - minX,
                depth: maxY - minY,
                height: maxZ - minZ
              };
              
              const processingTime = performance.now() - startTime;
              
              // Return the result
              self.postMessage({
                success: true,
                volumeCm3: volumeCm3,
                dimensions: dimensions,
                triangleCount: triangleCount,
                processingTime: processingTime
              });
            } catch (error) {
              self.postMessage({
                success: false,
                error: error.message || 'Error processing STL file'
              });
            }
          };
        `;

        // Create a blob with the worker code
        const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
        const workerURL = URL.createObjectURL(workerBlob);
        const worker = new Worker(workerURL);

        // Handle worker messages
        worker.onmessage = (e) => {
          // Check if this is a progress update
          if (e.data.progress) {
            console.log(`STL Processing: ${e.data.message || 'Working...'}`);
            
            // Show warning for large files
            if (e.data.triangleCount && e.data.triangleCount > 5000000) {
              this.showLargeFileWarning(e.data.triangleCount);
            }
            
            // Update loading bar if available
            if (e.data.percent) {
              const loadingBars = document.querySelectorAll('.model-viewer-loading-bar');
              loadingBars.forEach(bar => {
                if (bar) bar.style.width = `${e.data.percent}%`;
              });
            }
            
            return; // Don't resolve promise yet
          }

          // Clean up
          worker.terminate();
          URL.revokeObjectURL(workerURL);

          if (e.data.success) {
            resolve(e.data);
          } else {
            reject(new Error(e.data.error || 'Worker processing failed'));
          }
        };

        // Handle worker errors
        worker.onerror = (error) => {
          // Clean up
          worker.terminate();
          URL.revokeObjectURL(workerURL);
          reject(error);
        };

        // Send data to worker
        worker.postMessage(arrayBuffer);
      });
    },

    /**
     * Process STL in the main thread
     * @param {ArrayBuffer} arrayBuffer - STL file data
     * @returns {Promise<Object>} Promise resolving to processed data
     */
    processInMainThread: function (arrayBuffer) {
      return new Promise((resolve, reject) => {
        try {
          const startTime = performance.now();

          // Parse binary STL
          const data = new DataView(arrayBuffer);
          const triangleCount = data.getUint32(80, true);

          // Show warning for large files
          if (triangleCount > 5000000) {
            this.showLargeFileWarning(triangleCount);
          }

          let totalVolume = 0;
          let minX = Infinity, minY = Infinity, minZ = Infinity;
          let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

          // Process in small batches to avoid blocking UI
          const CHUNK_SIZE = 50000; // Process in smaller chunks for large files
          let offset = 84; // Skip header and triangle count
          let processedTriangles = 0;

          const processChunk = () => {
            const endTriangle = Math.min(processedTriangles + CHUNK_SIZE, triangleCount);
            const chunkStartTime = performance.now();

            for (let i = processedTriangles; i < endTriangle; i++) {
              // Skip normal vector (12 bytes)
              offset += 12;

              // Read vertices
              const v1x = data.getFloat32(offset, true);
              const v1y = data.getFloat32(offset + 4, true);
              const v1z = data.getFloat32(offset + 8, true);
              offset += 12;

              const v2x = data.getFloat32(offset, true);
              const v2y = data.getFloat32(offset + 4, true);
              const v2z = data.getFloat32(offset + 8, true);
              offset += 12;

              const v3x = data.getFloat32(offset, true);
              const v3y = data.getFloat32(offset + 4, true);
              const v3z = data.getFloat32(offset + 8, true);
              offset += 12;

              // Skip attribute byte count (2 bytes)
              offset += 2;

              // Update min/max coordinates
              minX = Math.min(minX, v1x, v2x, v3x);
              minY = Math.min(minY, v1y, v2y, v3y);
              minZ = Math.min(minZ, v1z, v2z, v3z);

              maxX = Math.max(maxX, v1x, v2x, v3x);
              maxY = Math.max(maxY, v1y, v2y, v3y);
              maxZ = Math.max(maxZ, v1z, v2z, v3z);

              // Calculate tetrahedron volume using the divergence theorem
              const crossX = (v2y - v1y) * (v3z - v1z) - (v2z - v1z) * (v3y - v1y);
              const crossY = (v2z - v1z) * (v3x - v1x) - (v2x - v1x) * (v3z - v1z);
              const crossZ = (v2x - v1x) * (v3y - v1y) - (v2y - v1y) * (v3x - v1x);

              const volume = (v1x * crossX + v1y * crossY + v1z * crossZ) / 6.0;
              totalVolume += volume;
            }

            processedTriangles = endTriangle;

            // Calculate and display progress for large files
            if (triangleCount > 1000000 && processedTriangles % 500000 < CHUNK_SIZE) {
              const percentComplete = Math.round((processedTriangles / triangleCount) * 100);
              console.log(`STL Processing: ${percentComplete}% complete (${processedTriangles.toLocaleString()} / ${triangleCount.toLocaleString()} triangles)`);
              
              // Update loading indicator if available
              const loadingBars = document.querySelectorAll('.model-viewer-loading-bar');
              loadingBars.forEach(bar => {
                if (bar) bar.style.width = `${percentComplete}%`;
              });
            }

            if (processedTriangles < triangleCount) {
              // Check if we need to yield to prevent script timeout
              const elapsedTime = performance.now() - chunkStartTime;
              const timeoutDelay = elapsedTime > 50 ? 10 : 0; // Yield if processing time exceeds 50ms
              
              // Continue processing in the next animation frame or timeout
              setTimeout(processChunk, timeoutDelay);
            } else {
              // All triangles processed, finalize results

              // Convert to cm³ and ensure positive volume
              const volumeCm3 = Math.abs(totalVolume) / 1000;

              // Calculate dimensions in mm
              const dimensions = {
                width: maxX - minX,
                depth: maxY - minY,
                height: maxZ - minZ
              };

              const processingTime = performance.now() - startTime;

              // Return results
              resolve({
                volumeCm3,
                dimensions,
                triangleCount,
                processingTime
              });
            }
          };

          // Start processing the first chunk
          processChunk();
        } catch (error) {
          reject(error);
        }
      });
    },

    /**
     * Show warning for large files
     * @param {number} triangleCount - Number of triangles in the model
     */
    showLargeFileWarning: function(triangleCount) {
      if (PrinterCalc.Notification && typeof PrinterCalc.Notification.warning === 'function') {
        PrinterCalc.Notification.warning(
          'Large STL File',
          `Processing ${(triangleCount / 1000000).toFixed(1)}M triangles. This may take some time and use significant memory.`,
          8000
        );
      }
    },

    /**
     * Get ThreeJS geometry from STL file
     * This is used for 3D visualization
     * @param {ArrayBuffer} arrayBuffer - STL file data
     * @returns {Object} ThreeJS geometry
     */
    getGeometry: function (arrayBuffer) {
      // Create STL loader
      const loader = new THREE.STLLoader();

      try {
        // Check triangle count for large files
        const triangleCount = new DataView(arrayBuffer).getUint32(80, true);
        
        // Parse the STL file
        const geometry = loader.parse(arrayBuffer);
        
        // For very large STLs, consider downsampling for visualization
        // while keeping full resolution for calculations
        if (triangleCount > 5000000) {
          console.log(`Note: Model has ${(triangleCount/1000000).toFixed(1)}M triangles. ` + 
                      `Consider using a decimated version for better performance.`);
        }
        
        return geometry;
      } catch (error) {
        console.error("Error parsing STL geometry:", error);
        throw error;
      }
    },

    /**
     * Calculate optimal orientation for a 3D model
     * @param {Object} dimensions - Width, depth, height of the model
     * @returns {Object} Orientation data
     */
    calculateOptimalOrientation: function (dimensions) {
      if (!dimensions) return null;

      // Sort dimensions
      const dims = [
        { value: dimensions.width, name: 'width' },
        { value: dimensions.depth, name: 'depth' },
        { value: dimensions.height, name: 'height' }
      ].sort((a, b) => b.value - a.value); // Sort by size (largest first)

      const maxDim = dims[0];
      const midDim = dims[1];
      const minDim = dims[2];

      // Create orientation data
      const orientationData = {
        // Flat orientation (shortest dimension on Z)
        flat: {
          width: maxDim.value,
          depth: midDim.value,
          height: minDim.value
        },

        // Vertical orientation (longest dimension on Z)
        vertical: {
          width: minDim.value,
          depth: midDim.value,
          height: maxDim.value
        }
      };

      // Store print times for each orientation and printer
      const printer400 = PrinterCalc.CONSTANTS.PRINTERS['400'];
      const printer600 = PrinterCalc.CONSTANTS.PRINTERS['600'];

      // Calculate print times if model fits
      if (PrinterCalc.Utils && typeof PrinterCalc.Utils.checkFitsInPrinter === 'function') {
        if (PrinterCalc.Utils.checkFitsInPrinter(orientationData.flat, 'flat', printer400)) {
          orientationData.flat.printTime400 = PrinterCalc.Utils.calculatePrintTime(
            orientationData.flat, 'flat', printer400
          );
        }

        if (PrinterCalc.Utils.checkFitsInPrinter(orientationData.flat, 'flat', printer600)) {
          orientationData.flat.printTime600 = PrinterCalc.Utils.calculatePrintTime(
            orientationData.flat, 'flat', printer600
          );
        }

        if (PrinterCalc.Utils.checkFitsInPrinter(orientationData.vertical, 'vertical', printer400)) {
          orientationData.vertical.printTime400 = PrinterCalc.Utils.calculatePrintTime(
            orientationData.vertical, 'vertical', printer400
          );
        }

        if (PrinterCalc.Utils.checkFitsInPrinter(orientationData.vertical, 'vertical', printer600)) {
          orientationData.vertical.printTime600 = PrinterCalc.Utils.calculatePrintTime(
            orientationData.vertical, 'vertical', printer600
          );
        }
      }

      return orientationData;
    }
  };
})();