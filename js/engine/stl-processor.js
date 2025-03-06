/**
 * stl-processor.js - STL File Processing
 * 
 * Processes STL files to extract volume, dimensions, and geometry data.
 */

(function() {
    // Make sure the namespace exists
    window.PrinterCalc = window.PrinterCalc || {};
    
    // Create an STL processor module
    PrinterCalc.STLProcessor = {
      /**
       * Process an STL file
       * @param {File} file - STL file
       * @returns {Promise<Object>} Promise resolving to STL data
       */
      processFile: async function(file) {
        try {
          // Validate file
          if (!file || !file.name || !file.name.toLowerCase().endsWith('.stl')) {
            throw new Error('Invalid STL file format. Please upload a valid STL file.');
          }
          
          // Read file as array buffer
          const arrayBuffer = await PrinterCalc.Utils.readFileAsArrayBuffer(file);
          
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
      processWithWorker: function(arrayBuffer) {
        return new Promise((resolve, reject) => {
          // Create a blob URL for the worker
          const workerBlob = new Blob([`
            self.onmessage = function(e) {
              const arrayBuffer = e.data;
              
              try {
                const startTime = performance.now();
                const result = parseSTL(arrayBuffer);
                const processingTime = performance.now() - startTime;
                
                // Send back the result
                self.postMessage({
                  success: true,
                  volumeCm3: result.volumeCm3,
                  dimensions: result.dimensions,
                  triangleCount: result.triangleCount,
                  processingTime
                });
              } catch (error) {
                self.postMessage({
                  success: false,
                  error: error.message || 'Error processing STL file'
                });
              }
            };
            
            // Parse binary STL file and extract data
            function parseSTL(arrayBuffer) {
              const data = new DataView(arrayBuffer);
              const triangleCount = data.getUint32(80, true);
              
              // Safety check for very large files
              if (triangleCount > 5000000) {
                throw new Error("STL file too large (over 5 million triangles). Please use a decimated model.");
              }
              
              let totalVolume = 0;
              let minX = Infinity, minY = Infinity, minZ = Infinity;
              let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
              
              let offset = 84; // Skip header and triangle count
              
              for (let i = 0; i < triangleCount; i++) {
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
              
              // Convert to cm³ and ensure positive volume
              const volumeCm3 = Math.abs(totalVolume) / 1000;
              
              // Calculate dimensions in mm
              const dimensions = {
                width: maxX - minX,
                depth: maxY - minY,
                height: maxZ - minZ
              };
              
              return {
                volumeCm3,
                dimensions,
                triangleCount
              };
            }
          `], { type: 'application/javascript' });
          
          const workerURL = URL.createObjectURL(workerBlob);
          const worker = new Worker(workerURL);
          
          // Handle worker messages
          worker.onmessage = function(e) {
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
          worker.onerror = function(error) {
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
      processInMainThread: function(arrayBuffer) {
        return new Promise((resolve, reject) => {
          try {
            const startTime = performance.now();
            
            // Parse binary STL
            const data = new DataView(arrayBuffer);
            const triangleCount = data.getUint32(80, true);
            
            if (triangleCount > 5000000) {
              throw new Error('STL file too large (over 5 million triangles). Please use a decimated model.');
            }
            
            let totalVolume = 0;
            let minX = Infinity, minY = Infinity, minZ = Infinity;
            let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
            
            // Process in small batches to avoid blocking UI
            const CHUNK_SIZE = 5000;
            let offset = 84; // Skip header and triangle count
            let processedTriangles = 0;
            
            const processChunk = () => {
              const endTriangle = Math.min(processedTriangles + CHUNK_SIZE, triangleCount);
              
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
              
              if (processedTriangles < triangleCount) {
                // Continue processing in the next animation frame
                setTimeout(processChunk, 0);
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
       * Get ThreeJS geometry from STL file
       * This is used for 3D visualization
       * @param {ArrayBuffer} arrayBuffer - STL file data
       * @returns {Object} ThreeJS geometry
       */
      getGeometry: function(arrayBuffer) {
        // Create STL loader
        const loader = new THREE.STLLoader();
        
        // Parse the STL file
        return loader.parse(arrayBuffer);
      },
      
      /**
       * Calculate optimal orientation for a 3D model
       * @param {Object} dimensions - Width, depth, height of the model
       * @returns {Object} Orientation data
       */
      calculateOptimalOrientation: function(dimensions) {
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
        
        return orientationData;
      }
    };
  })();