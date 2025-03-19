/**
 * model-viewer.js - 3D Model Viewer Component
 * 
 * Provides a higher-level interface for model visualization.
 */

(function () {
  // Make sure the namespace exists
  window.PrinterCalc = window.PrinterCalc || {};

  // Create a model viewer module
  PrinterCalc.ModelViewer = {
    // Store viewers by container ID
    viewers: {},
    /**
     * Add enhanced desktop controls to the model viewer
     * @param {string} viewerId - Viewer ID
     */
    addDesktopControls: function (viewerId) {
      const viewer = this.viewers[viewerId];
      if (!viewer || !viewer.container) return;

      // Create toolbar
      const toolbar = document.createElement('div');
      toolbar.className = 'viewer-toolbar';

      // Left toolbar group
      const leftGroup = document.createElement('div');
      leftGroup.className = 'toolbar-group';

      // Orientation buttons
      const flatBtn = document.createElement('button');
      flatBtn.className = 'toolbar-btn';
      flatBtn.innerHTML = '<span class="material-icon">crop_landscape</span> Flat';
      flatBtn.title = 'Flat orientation (R)';
      flatBtn.addEventListener('click', () => {
        this.changeOrientation(viewerId, 'flat');

        // Update button states
        flatBtn.classList.add('active');
        verticalBtn.classList.remove('active');
      });

      const verticalBtn = document.createElement('button');
      verticalBtn.className = 'toolbar-btn';
      verticalBtn.innerHTML = '<span class="material-icon">crop_portrait</span> Vertical';
      verticalBtn.title = 'Vertical orientation (V)';
      verticalBtn.addEventListener('click', () => {
        this.changeOrientation(viewerId, 'vertical');

        // Update button states
        flatBtn.classList.remove('active');
        verticalBtn.classList.add('active');
      });

      // Set initial state based on current orientation
      if (viewer.orientation === 'flat') {
        flatBtn.classList.add('active');
      } else {
        verticalBtn.classList.add('active');
      }

      // Add to left group
      leftGroup.appendChild(flatBtn);
      leftGroup.appendChild(verticalBtn);

      // Right toolbar group
      const rightGroup = document.createElement('div');
      rightGroup.className = 'toolbar-group';

      // Wireframe toggle
      const wireframeBtn = document.createElement('button');
      wireframeBtn.className = 'toolbar-btn';
      wireframeBtn.innerHTML = '<span class="material-icon">grid_3x3</span> Wireframe';
      wireframeBtn.title = 'Toggle wireframe (W)';

      let wireframeEnabled = false;
      wireframeBtn.addEventListener('click', () => {
        wireframeEnabled = !wireframeEnabled;
        this.toggleWireframe(viewerId, wireframeEnabled);

        // Update button state
        if (wireframeEnabled) {
          wireframeBtn.classList.add('active');
        } else {
          wireframeBtn.classList.remove('active');
        }
      });

      // Reset view button
      const resetViewBtn = document.createElement('button');
      resetViewBtn.className = 'toolbar-btn';
      resetViewBtn.innerHTML = '<span class="material-icon">restart_alt</span> Reset View';
      resetViewBtn.title = 'Reset camera (Space)';
      resetViewBtn.addEventListener('click', () => {
        const context = viewer.threeContext;
        if (!context) return;

        // Reset camera to initial position
        if (PrinterCalc.ThreeManager && typeof PrinterCalc.ThreeManager.fitCameraToObject === 'function') {
          // Find model in scene
          let modelMesh = null;
          context.scene.traverse(object => {
            if (object.userData && object.userData.isModel) {
              modelMesh = object;
            }
          });

          if (modelMesh) {
            PrinterCalc.ThreeManager.fitCameraToObject(context, modelMesh);
          }
        }
      });

      // Add to right group
      rightGroup.appendChild(wireframeBtn);
      rightGroup.appendChild(resetViewBtn);

      // Add groups to toolbar
      toolbar.appendChild(leftGroup);
      toolbar.appendChild(rightGroup);

      // Insert toolbar after the container
      viewer.container.parentNode.insertBefore(toolbar, viewer.container.nextSibling);

      // Set up keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        // Only process if model is loaded and viewer is visible
        if (!this.hasModel(viewerId) || !viewer.container.offsetParent) return;

        // Only trigger if not in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
          return;
        }

        switch (e.key.toLowerCase()) {
          case 'r':
            flatBtn.click();
            break;
          case 'v':
            verticalBtn.click();
            break;
          case 'w':
            wireframeBtn.click();
            break;
          case ' ': // Space
            resetViewBtn.click();
            e.preventDefault(); // Prevent page scroll
            break;
        }
      });

      console.log('Desktop controls added to viewer:', viewerId);
      return toolbar;
    },
    /**
     * Initialize a model viewer
     * @param {HTMLElement} container - Container element
     * @returns {string} Viewer ID
     */
    init: function (container) {
      if (!container) return null;

      // Generate a unique ID for this viewer
      // Fix the logic with proper parentheses:
      const viewerId = container.id ||
        ((PrinterCalc.Utils && typeof PrinterCalc.Utils.generateId === 'function')
          ? PrinterCalc.Utils.generateId()
          : ('viewer-' + Math.random().toString(36).substring(2, 15)));

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
    loadSTL: async function (viewerId, stlFile) {
      const viewer = this.viewers[viewerId];
      if (!viewer) {
        throw new Error(`Viewer not found: ${viewerId}`);
      }

      try {
        // Get array buffer if file was provided
        let arrayBuffer;
        if (stlFile instanceof File) {
          if (PrinterCalc.Utils && typeof PrinterCalc.Utils.readFileAsArrayBuffer === 'function') {
            arrayBuffer = await PrinterCalc.Utils.readFileAsArrayBuffer(stlFile);
          } else {
            // Fallback implementation
            arrayBuffer = await new Promise((resolve, reject) => {
              try {
                const reader = new FileReader();
                reader.onload = function (event) {
                  resolve(event.target.result);
                };
                reader.onerror = function (error) {
                  reject(error);
                };
                reader.readAsArrayBuffer(stlFile);
              } catch (error) {
                console.error('Error reading file:', error);
                reject(error);
              }
            });
          }
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
    changeOrientation: function (viewerId, orientation) {
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
    dispose: function (viewerId) {
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
    hasModel: function (viewerId) {
      const viewer = this.viewers[viewerId];
      return !!(viewer && viewer.loaded);
    },

    /**
     * Toggle wireframe mode
     * @param {string} viewerId - Viewer ID
     * @param {boolean} enabled - Whether wireframe should be enabled
     */
    toggleWireframe: function (viewerId, enabled) {
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
  /**
     * Get the geometry from a viewer
     * @param {string} viewerId - Viewer ID
     * @returns {THREE.BufferGeometry|null} Geometry or null if not found
     */
  PrinterCalc.ModelViewer.getGeometry = function (viewerId) {
    const viewer = this.viewers[viewerId];
    if (!viewer || !viewer.threeContext || !viewer.threeContext.scene) {
      return null;
    }

    let geometry = null;

    // Find the model mesh in the scene
    viewer.threeContext.scene.traverse(object => {
      if (object.isMesh && object.userData && object.userData.isModel) {
        geometry = object.geometry.clone();
      }
    });

    return geometry;
  };

  /**
   * Mark a mesh as a model
   * This is used by ThreeManager to mark meshes as models so they can be found later
   * @param {THREE.Mesh} mesh - Mesh to mark
   */
  PrinterCalc.ModelViewer.markAsModel = function (mesh) {
    if (mesh) {
      if (!mesh.userData) mesh.userData = {};
      mesh.userData.isModel = true;
    }
  };
  /**
     * Scale a 3D model
     * @param {string} viewerId - Viewer ID
     * @param {number} factor - Scale factor
     */
  PrinterCalc.ModelViewer.scaleModel = function (viewerId, factor) {
    const viewer = this.viewers[viewerId];
    if (!viewer || !viewer.threeContext) return;

    try {
      const { scene } = viewer.threeContext;

      // Find model mesh
      scene.traverse(object => {
        if (object.isMesh && object.userData && object.userData.isModel) {
          // Apply scaling
          object.scale.set(factor, factor, factor);

          // Update model
          object.updateMatrix();
        }
      });
    } catch (error) {
      console.error('Error scaling model:', error);
    }
  };
})();