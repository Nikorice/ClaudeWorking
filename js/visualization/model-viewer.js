/**
 * model-viewer.js - 3D Model Viewer Component
 * 
 * Provides a higher-level interface for model visualization.
 */

(function() {
    // Make sure the namespace exists
    window.PrinterCalc = window.PrinterCalc || {};
    
    // Create a model viewer module
    PrinterCalc.ModelViewer = {
      // Store viewers by container ID
      viewers: {},
      
      /**
       * Initialize a model viewer
       * @param {HTMLElement} container - Container element
       * @returns {string} Viewer ID
       */
      init: function(container) {
        if (!container) return null;
        
        // Generate a unique ID for this viewer
        const viewerId = container.id || PrinterCalc.Utils.generateId();
        
        // Initialize Three.js viewer
        const threeContext = PrinterCalc.ThreeManager.initViewer(container);
        if (!threeContext) {
          console.error('Failed to initialize Three.js viewer');
          return null;
        }
        
        // Store viewer context
        this.viewers[viewerId] = {
          threeContext,
          container,
          stlData: null,
          orientation: 'flat',
          loaded: false
        };
        
        return viewerId;
      },
      
      /**
       * Load an STL file into the viewer
       * @param {string} viewerId - Viewer ID
       * @param {File|ArrayBuffer} stlFile - STL file or array buffer
       * @returns {Promise} Promise resolving when loading is complete
       */
      loadSTL: async function(viewerId, stlFile) {
        const viewer = this.viewers[viewerId];
        if (!viewer) {
          throw new Error(`Viewer not found: ${viewerId}`);
        }
        
        try {
          // Get array buffer if file was provided
          let arrayBuffer;
          if (stlFile instanceof File) {
            arrayBuffer = await PrinterCalc.Utils.readFileAsArrayBuffer(stlFile);
          } else if (stlFile instanceof ArrayBuffer) {
            arrayBuffer = stlFile;
          } else {
            throw new Error('Invalid STL input. Expected File or ArrayBuffer.');
          }
          
          // Process STL data
          viewer.stlData = {
            arrayBuffer,
            file: stlFile instanceof File ? stlFile : null
          };
          
          // Load model with current orientation
          PrinterCalc.ThreeManager.loadModel(
            viewer.threeContext,
            arrayBuffer,
            viewer.orientation
          );
          
          viewer.loaded = true;
          
          // Return success
          return true;
        } catch (error) {
          console.error('Error loading STL:', error);
          throw error;
        }
      },
      
      /**
       * Change model orientation
       * @param {string} viewerId - Viewer ID
       * @param {string} orientation - "flat" or "vertical"
       */
      changeOrientation: function(viewerId, orientation) {
        const viewer = this.viewers[viewerId];
        if (!viewer || !viewer.stlData) return;
        
        // Update orientation
        viewer.orientation = orientation;
        
        // Reload model with new orientation
        PrinterCalc.ThreeManager.loadModel(
          viewer.threeContext,
          viewer.stlData.arrayBuffer,
          orientation
        );
      },
      
      /**
       * Dispose of a viewer and free resources
       * @param {string} viewerId - Viewer ID
       */
      dispose: function(viewerId) {
        const viewer = this.viewers[viewerId];
        if (!viewer) return;
        
        // Clean up Three.js resources
        if (viewer.threeContext && viewer.threeContext.dispose) {
          viewer.threeContext.dispose();
        }
        
        // Remove from viewers list
        delete this.viewers[viewerId];
      },
      
      /**
       * Check if a viewer has a model loaded
       * @param {string} viewerId - Viewer ID
       * @returns {boolean} True if a model is loaded
       */
      hasModel: function(viewerId) {
        const viewer = this.viewers[viewerId];
        return !!(viewer && viewer.loaded);
      },
      
      /**
       * Toggle wireframe mode
       * @param {string} viewerId - Viewer ID
       * @param {boolean} enabled - Whether wireframe should be enabled
       */
      toggleWireframe: function(viewerId, enabled) {
        const viewer = this.viewers[viewerId];
        if (!viewer || !viewer.threeContext) return;
        
        const { scene } = viewer.threeContext;
        
        scene.traverse(object => {
          if (object.isMesh && object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => {
                material.wireframe = enabled;
              });
            } else {
              object.material.wireframe = enabled;
            }
          }
        });
      }
    };
  })();