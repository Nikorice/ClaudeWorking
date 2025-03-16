/**
 * performance-optimizer.js - Performance Optimization Module
 * 
 * This module enhances the 3D Printer Calculator by implementing:
 * 1. WebGL context pooling and reuse
 * 2. Lazy loading of 3D visualizations
 * 3. Memory management improvements
 * 4. Throttled calculations and rendering
 */

(function() {
    // Make sure the namespace exists
    window.PrinterCalc = window.PrinterCalc || {};
    
    // Create a performance optimizer module
    PrinterCalc.PerformanceOptimizer = {
      // Track active WebGL contexts
      webglContexts: [],
      maxWebGLContexts: 4, // Limit maximum concurrent WebGL contexts
      
      /**
       * Initialize the performance optimizer
       */
      init: function() {
        console.log('Initializing Performance Optimizer...');
        
        // Apply patches to existing modules
        this.patchThreeManager();
        this.patchSTLManager();
        this.patchPrinterCapacity();
        this.patchModelViewer();
        
        // Set up global event listeners for cleanup
        this.setupCleanupListeners();
        
        // Create a global WebGL context pool
        this.initializeWebGLPool();
        
        // Add throttled rendering
        this.implementThrottledRendering();
        
        console.log('Performance Optimizer initialized');
      },
      
      /**
       * Initialize WebGL context pool
       */
      initializeWebGLPool: function() {
        // Create a pool with a limited number of contexts
        this.webglPool = {
          contexts: [],
          
          // Get a context from the pool or create a new one if below limit
          getContext: function() {
            // Check if there's an available context in the pool
            if (this.contexts.length > 0) {
              return this.contexts.pop();
            }
            
            // Check if we're under the max limit
            if (PrinterCalc.PerformanceOptimizer.webglContexts.length < 
                PrinterCalc.PerformanceOptimizer.maxWebGLContexts) {
              // Create a new context
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('webgl', { powerPreference: 'default' });
              
              if (context) {
                PrinterCalc.PerformanceOptimizer.webglContexts.push(context);
                return context;
              }
            }
            
            // Return the oldest context if we've hit the limit
            if (PrinterCalc.PerformanceOptimizer.webglContexts.length > 0) {
              console.warn('WebGL context limit reached. Reusing oldest context.');
              return PrinterCalc.PerformanceOptimizer.webglContexts[0];
            }
            
            return null;
          },
          
          // Return a context to the pool
          releaseContext: function(context) {
            if (context) {
              // Clean up context if needed
              if (context.canvas) {
                context.canvas.width = 1;
                context.canvas.height = 1;
              }
              
              this.contexts.push(context);
            }
          }
        };
      },
      
      /**
       * Patch the ThreeManager to use context pooling and efficient cleanup
       */
      patchThreeManager: function() {
        // Store original methods
        const originalInitViewer = PrinterCalc.ThreeManager.initViewer;
        const originalLoadModel = PrinterCalc.ThreeManager.loadModel;
        
        // Override initViewer to use context pooling
        PrinterCalc.ThreeManager.initViewer = function(container) {
          if (!container) return null;
          
          try {
            // Check if this container already has a viewer
            if (container._viewerContext) {
              console.log('Reusing existing viewer for container');
              return container._viewerContext;
            }
            
            // Get a WebGL context from the pool instead of creating a new one
            const context = originalInitViewer.call(this, container);
            
            if (context) {
              // Store the context in the container for reuse
              container._viewerContext = context;
              
              // Enhance the dispose method to release the context back to the pool
              const originalDispose = context.dispose;
              context.dispose = function() {
                try {
                  // Call the original dispose
                  originalDispose.call(this);
                  
                  // Remove models to free memory
                  while (this.scene && this.scene.children.length > 0) {
                    const object = this.scene.children[0];
                    
                    // Proper resource cleanup for geometries and materials
                    if (object.geometry) object.geometry.dispose();
                    
                    if (object.material) {
                      if (Array.isArray(object.material)) {
                        object.material.forEach(material => {
                          if (material.map) material.map.dispose();
                          material.dispose();
                        });
                      } else {
                        if (object.material.map) object.material.map.dispose();
                        object.material.dispose();
                      }
                    }
                    
                    this.scene.remove(object);
                  }
                  
                  // Release context back to the pool
                  if (this.renderer && this.renderer.getContext()) {
                    PrinterCalc.PerformanceOptimizer.webglPool.releaseContext(this.renderer.getContext());
                  }
                  
                  // Clear the container reference
                  if (this.container) {
                    this.container._viewerContext = null;
                  }
                } catch (error) {
                  console.error('Error in enhanced dispose:', error);
                }
              };
            }
            
            return context;
          } catch (error) {
            console.error('Error in patched initViewer:', error);
            return null;
          }
        };
        
        // Override loadModel to add memory optimization
        PrinterCalc.ThreeManager.loadModel = function(context, arrayBuffer, orientation = 'flat') {
          if (!context || !arrayBuffer) return;
          
          try {
            // Check if this model is already loaded with same orientation
            if (context._loadedModel && 
                context._loadedModel.arrayBuffer === arrayBuffer && 
                context._loadedModel.orientation === orientation) {
              console.log('Model already loaded with same orientation, skipping reload');
              return;
            }
            
            // Call original load model
            originalLoadModel.call(this, context, arrayBuffer, orientation);
            
            // Store reference to loaded model data
            context._loadedModel = {
              arrayBuffer: arrayBuffer,
              orientation: orientation
            };
          } catch (error) {
            console.error('Error in patched loadModel:', error);
          }
        };
      },
      
      /**
       * Patch the STLManager for optimized visualization loading
       */
      patchSTLManager: function() {
        // Store original methods
        const originalUpdateResults = PrinterCalc.STLManager.updateResults;
        const originalUpdatePackingVisualization = PrinterCalc.STLManager.updatePackingVisualization;
        
        // Override updateResults with lazy loading of visualizations
        PrinterCalc.STLManager.updateResults = function(rowId) {
          // Delay visualization updates until calculations are done
          try {
            // Skip updates if row no longer exists
            const row = document.getElementById(rowId);
            if (!row) return;
            
            // Get row data
            const rowData = this.rows[rowId];
            if (!rowData || !rowData.stlData) return;
            
            // Update calculations and UI elements first
            originalUpdateResults.call(this, rowId);
            
            // Delay visualization to next frame
            requestAnimationFrame(() => {
              try {
                // Skip if row was removed during the delay
                if (!document.getElementById(rowId)) return;
                
                // Only update visible visualizers
                if (this.isRowVisible(rowId)) {
                  this.updateVisibleVisualizations(rowId);
                } else {
                  console.log('Row not visible, skipping visualizations:', rowId);
                }
              } catch (error) {
                console.error('Error in delayed visualization update:', error);
              }
            });
          } catch (error) {
            console.error('Error in patched updateResults:', error);
          }
        };
        
        // Override updatePackingVisualization to use lazy loading
        PrinterCalc.STLManager.updatePackingVisualization = function(rowId, container, capacity, printer) {
          // Mark container as needing update but don't update immediately
          if (container) {
            container.dataset.needsUpdate = 'true';
            container.dataset.rowId = rowId;
            container.dataset.printerType = printer.name;
            
            // Store capacity data for later use
            container._capacityData = capacity;
            container._printerData = printer;
          }
          
          // Only update if actually visible
          if (container && this.isElementVisible(container)) {
            originalUpdatePackingVisualization.call(this, rowId, container, capacity, printer);
            container.dataset.needsUpdate = 'false';
          }
        };
        
        // Add new helper methods for visibility checking
        PrinterCalc.STLManager.isElementVisible = function(element) {
          if (!element) return false;
          
          // Check if element is connected to the DOM
          if (!element.isConnected) return false;
          
          const rect = element.getBoundingClientRect();
          const isVisible = rect.top < window.innerHeight && rect.bottom >= 0;
          
          // Also check if the element is rendered (not display:none)
          const computedStyle = window.getComputedStyle(element);
          return isVisible && computedStyle.display !== 'none';
        };
        
        PrinterCalc.STLManager.isRowVisible = function(rowId) {
          const row = document.getElementById(rowId);
          return row && this.isElementVisible(row);
        };
        
        // Add method to update only visible visualizations
        PrinterCalc.STLManager.updateVisibleVisualizations = function(rowId) {
          const row = document.getElementById(rowId);
          if (!row) return;
          
          // Find visualizers that need updates
          const visualizers = row.querySelectorAll('.packing-visualizer[data-needs-update="true"]');
          
          visualizers.forEach(container => {
            if (this.isElementVisible(container)) {
              const capacity = container._capacityData;
              const printer = container._printerData;
              
              if (capacity && printer) {
                originalUpdatePackingVisualization.call(this, rowId, container, capacity, printer);
                container.dataset.needsUpdate = 'false';
              }
            }
          });
        };
        
        // Add scroll event listener to update visualizations when they become visible
        window.addEventListener('scroll', PrinterCalc.Utils.debounce(function() {
          // Find all visualizers that need updates
          const visualizers = document.querySelectorAll('.packing-visualizer[data-needs-update="true"]');
          
          visualizers.forEach(container => {
            const rowId = container.dataset.rowId;
            
            if (rowId && PrinterCalc.STLManager.isElementVisible(container)) {
              const capacity = container._capacityData;
              const printer = container._printerData;
              
              if (capacity && printer) {
                PrinterCalc.STLManager.updatePackingVisualization(
                  rowId, container, capacity, printer
                );
                container.dataset.needsUpdate = 'false';
              }
            }
          });
        }, 100), { passive: true });
      },
      
      /**
       * Patch printer capacity visualization to be more efficient
       */
      patchPrinterCapacity: function() {
        // Store original methods
        const originalVisualize3D = PrinterCalc.PrinterCapacity.visualize3D;
        
        // Override visualize3D to reuse geometries and materials
        PrinterCalc.PrinterCapacity.visualize3D = function(container, capacityData, printer, stlGeometry) {
          // Skip update if not visible to improve performance
          if (!container.isConnected || !PrinterCalc.PerformanceOptimizer.isContainerVisible(container)) {
            container.dataset.needsUpdate = 'true';
            return;
          }
          
          // Check if we already have a scene for this container
          if (container._scene && container._animationId) {
            // Update existing scene instead of creating a new one
            this.updateExistingScene(container, capacityData, printer, stlGeometry);
            return;
          }
          
          // Limit the number of concurrent 3D visualizations
          const visibleVisualizers = document.querySelectorAll('.packing-visualizer._3d-active');
          if (visibleVisualizers.length >= PrinterCalc.PerformanceOptimizer.maxWebGLContexts) {
            // Find the oldest visualizer to repurpose
            const oldestVisualizer = visibleVisualizers[0];
            
            // Dispose its resources
            if (oldestVisualizer._dispose && typeof oldestVisualizer._dispose === 'function') {
              oldestVisualizer._dispose();
              oldestVisualizer.classList.remove('_3d-active');
            }
          }
          
          // Mark this container as having active 3D
          container.classList.add('_3d-active');
          
          // Call original method
          originalVisualize3D.call(this, container, capacityData, printer, stlGeometry);
        };
        
        // Add method to update an existing scene
        PrinterCalc.PrinterCapacity.updateExistingScene = function(container, capacityData, printer, stlGeometry) {
          try {
            // Access existing scene
            const scene = container._scene;
            const camera = container._camera;
            const renderer = container._renderer;
            
            if (!scene || !camera || !renderer) return;
            
            // Remove previous objects
            while (scene.children.length > 0) {
              const obj = scene.children[0];
              if (obj.geometry) obj.geometry.dispose();
              if (obj.material) {
                if (Array.isArray(obj.material)) {
                  obj.material.forEach(m => m.dispose());
                } else {
                  obj.material.dispose();
                }
              }
              scene.remove(obj);
            }
            
            // Re-add printer wireframe
            const { width: printerWidth, depth: printerDepth, height: printerHeight } = printer.dimensions;
            
            const geometry = new THREE.BoxGeometry(printerWidth, printerHeight, printerDepth);
            const material = new THREE.MeshBasicMaterial({
              color: 0x3b82f6,
              wireframe: true,
              opacity: 0.3,
              transparent: true
            });
            
            const printerBox = new THREE.Mesh(geometry, material);
            printerBox.position.set(printerWidth / 2, printerHeight / 2, printerDepth / 2);
            scene.add(printerBox);
            
            // Add models
            const modelMaterial = new THREE.MeshPhongMaterial({
              color: 0x4ade80,
              specular: 0x111111,
              shininess: 30,
              opacity: 0.85,
              transparent: true
            });
            
            if (stlGeometry && capacityData.positions) {
              capacityData.positions.forEach(pos => {
                const mesh = new THREE.Mesh(stlGeometry.clone(), modelMaterial.clone());
                
                mesh.position.set(
                  pos.x + capacityData.objectDimensions.width / 2,
                  pos.z,
                  pos.y + capacityData.objectDimensions.depth / 2
                );
                
                scene.add(mesh);
              });
            } else {
              // Use simple boxes
              const boxGeometry = new THREE.BoxGeometry(
                capacityData.objectDimensions.width,
                capacityData.objectDimensions.height,
                capacityData.objectDimensions.depth
              );
              
              capacityData.positions.forEach(pos => {
                const boxMesh = new THREE.Mesh(boxGeometry, modelMaterial.clone());
                
                boxMesh.position.set(
                  pos.x + capacityData.objectDimensions.width / 2,
                  pos.z + capacityData.objectDimensions.height / 2,
                  pos.y + capacityData.objectDimensions.depth / 2
                );
                
                scene.add(boxMesh);
              });
            }
            
            // Update object count display
            const countLabel = container.querySelector('.count-label');
            if (countLabel) {
              countLabel.textContent = `${capacityData.totalObjects} objects`;
            }
            
            // Single render call instead of animation if possible
            renderer.render(scene, camera);
          } catch (error) {
            console.error('Error updating existing scene:', error);
          }
        };
      },
      
      /**
       * Patch model viewer for improved memory management
       */
      patchModelViewer: function() {
        // Store original methods
        const originalLoadSTL = PrinterCalc.ModelViewer.loadSTL;
        const originalDispose = PrinterCalc.ModelViewer.dispose;
        
        // Override loadSTL to be more memory-efficient
        PrinterCalc.ModelViewer.loadSTL = async function(viewerId, stlFile) {
          const viewer = this.viewers[viewerId];
          if (!viewer) throw new Error(`Viewer not found: ${viewerId}`);
          
          try {
            // Check if this is a reload of the same file - use cached data
            if (viewer.stlData && viewer.stlData.file && stlFile instanceof File &&
                viewer.stlData.file.name === stlFile.name && 
                viewer.stlData.file.size === stlFile.size) {
              
              console.log('Using cached STL data for', stlFile.name);
              
              // Reload model with existing buffer and orientation
              if (PrinterCalc.ThreeManager && typeof PrinterCalc.ThreeManager.loadModel === 'function') {
                PrinterCalc.ThreeManager.loadModel(
                  viewer.threeContext,
                  viewer.stlData.arrayBuffer,
                  viewer.orientation
                );
              }
              
              viewer.loaded = true;
              return true;
            }
            
            // Otherwise load normally
            return await originalLoadSTL.call(this, viewerId, stlFile);
          } catch (error) {
            console.error('Error in patched loadSTL:', error);
            throw error;
          }
        };
        
        // Override dispose for better cleanup
        PrinterCalc.ModelViewer.dispose = function(viewerId) {
          const viewer = this.viewers[viewerId];
          if (!viewer) return;
          
          // Cancel any pending loads
          if (viewer._loadPromise) {
            viewer._loadPromise.cancel = true;
          }
          
          // Clear STL data to release memory
          if (viewer.stlData) {
            viewer.stlData.arrayBuffer = null;
          }
          
          // Call original dispose
          originalDispose.call(this, viewerId);
        };
      },
      
      /**
       * Implement throttled rendering to improve performance
       */
      implementThrottledRendering: function() {
        // Apply global render throttling for Three.js
        if (typeof THREE !== 'undefined' && THREE.WebGLRenderer) {
          // Store original render method
          const originalRender = THREE.WebGLRenderer.prototype.render;
          
          // Override render method with throttling
          THREE.WebGLRenderer.prototype.render = function(scene, camera) {
            // Skip automatic animations for offscreen elements
            if (this.domElement && !PrinterCalc.PerformanceOptimizer.isElementInViewport(this.domElement)) {
              this._needsRender = true;
              return;
            }
            
            // Allow max 60 FPS for visible renderers
            const now = performance.now();
            if (!this._lastRenderTime || now - this._lastRenderTime >= 16.67) {
              // Perform the render
              originalRender.call(this, scene, camera);
              this._lastRenderTime = now;
              this._needsRender = false;
            } else {
              // Queue render for next frame if needed
              if (!this._renderQueued) {
                this._renderQueued = true;
                
                requestAnimationFrame(() => {
                  this._renderQueued = false;
                  
                  // Only render if still needed
                  if (this._needsRender) {
                    originalRender.call(this, scene, camera);
                    this._lastRenderTime = performance.now();
                    this._needsRender = false;
                  }
                });
              }
              
              this._needsRender = true;
            }
          };
        }
      },
      
      /**
       * Set up event listeners for global cleanup
       */
      setupCleanupListeners: function() {
        // Cleanup on tab change
        document.addEventListener('printercalc:tabchanged', this.cleanupTabChange.bind(this));
        
        // Cleanup on tab visibility change (page minimized)
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
        
        // Attempt cleanup every few minutes to prevent memory leaks
        setInterval(this.periodicCleanup.bind(this), 180000); // 3 minutes
      },
      
      /**
       * Clean up WebGL resources when changing tabs
       */
      cleanupTabChange: function(event) {
        if (!event.detail || !event.detail.prevTabId) return;
        
        console.log('Cleaning up after tab change from', event.detail.prevTabId);
        
        try {
          const prevTab = document.getElementById(`${event.detail.prevTabId}-tab`);
          if (!prevTab) return;
          
          // Clean up visualizers in previous tab
          const visualizers = prevTab.querySelectorAll('.packing-visualizer');
          visualizers.forEach(container => {
            // Mark for update when visible again
            container.dataset.needsUpdate = 'true';
            
            // Dispose existing renderer to free memory
            if (container._dispose && typeof container._dispose === 'function') {
              container._dispose();
            }
          });
          
          // Clean up model viewers
          if (PrinterCalc.ModelViewer && PrinterCalc.ModelViewer.viewers) {
            Object.keys(PrinterCalc.ModelViewer.viewers).forEach(viewerId => {
              const viewer = PrinterCalc.ModelViewer.viewers[viewerId];
              
              // Check if viewer belongs to previous tab
              if (viewer && viewer.container && !this.isElementVisible(viewer.container)) {
                // Pause the viewer when not visible
                this.pauseViewer(viewer);
              }
            });
          }
        } catch (error) {
          console.error('Error during tab change cleanup:', error);
        }
      },
      
      /**
       * Handle visibility change (tab or window focus)
       */
      handleVisibilityChange: function() {
        if (document.hidden) {
          // Page is hidden, pause all animations
          this.pauseAllViewers();
        } else {
          // Page is visible again, resume active viewers
          this.resumeVisibleViewers();
        }
      },
      
      /**
       * Pause animation in a specific viewer
       */
      pauseViewer: function(viewer) {
        if (!viewer || !viewer.threeContext) return;
        
        try {
          // Store animation ID
          viewer._pausedAnimationId = viewer.threeContext.animationFrameId;
          
          // Cancel animation frame
          if (viewer.threeContext.animationFrameId) {
            cancelAnimationFrame(viewer.threeContext.animationFrameId);
            viewer.threeContext.animationFrameId = null;
          }
        } catch (error) {
          console.error('Error pausing viewer:', error);
        }
      },
      
      /**
       * Resume animation in a specific viewer
       */
      resumeViewer: function(viewer) {
        if (!viewer || !viewer.threeContext || !viewer._pausedAnimationId) return;
        
        try {
          // Only resume if the viewer is visible
          if (viewer.container && this.isElementVisible(viewer.container)) {
            // Restart animation loop
            const animate = () => {
              viewer.threeContext.animationFrameId = requestAnimationFrame(animate);
              
              if (viewer.threeContext.controls && typeof viewer.threeContext.controls.update === 'function') {
                viewer.threeContext.controls.update();
              }
              
              if (viewer.threeContext.renderer && viewer.threeContext.scene && viewer.threeContext.camera) {
                viewer.threeContext.renderer.render(viewer.threeContext.scene, viewer.threeContext.camera);
              }
            };
            
            // Start animation
            animate();
          }
          
          // Clear stored ID
          viewer._pausedAnimationId = null;
        } catch (error) {
          console.error('Error resuming viewer:', error);
        }
      },
      
      /**
       * Pause all viewers to free resources
       */
      pauseAllViewers: function() {
        if (!PrinterCalc.ModelViewer || !PrinterCalc.ModelViewer.viewers) return;
        
        Object.keys(PrinterCalc.ModelViewer.viewers).forEach(viewerId => {
          const viewer = PrinterCalc.ModelViewer.viewers[viewerId];
          this.pauseViewer(viewer);
        });
      },
      
      /**
       * Resume all viewers that are currently visible
       */
      resumeVisibleViewers: function() {
        if (!PrinterCalc.ModelViewer || !PrinterCalc.ModelViewer.viewers) return;
        
        Object.keys(PrinterCalc.ModelViewer.viewers).forEach(viewerId => {
          const viewer = PrinterCalc.ModelViewer.viewers[viewerId];
          if (viewer && viewer._pausedAnimationId) {
            this.resumeViewer(viewer);
          }
        });
      },
      
      /**
       * Periodic cleanup to prevent memory leaks
       */
      periodicCleanup: function() {
        try {
          console.log('Running periodic cleanup...');
          
          // Force garbage collection for textures and unused resources
          if (typeof THREE !== 'undefined' && THREE.WebGLRenderer) {
            // Get all renderers
            document.querySelectorAll('canvas').forEach(canvas => {
              try {
                const renderer = canvas._renderer;
                if (renderer && typeof renderer.dispose === 'function') {
                  if (!this.isElementInViewport(canvas)) {
                    // Clean up renderer resources
                    renderer.forceContextLoss();
                    renderer.dispose();
                    canvas._renderer = null;
                  } else {
                    // Just clean up textures
                    renderer.info.reset();
                  }
                }
              } catch (error) {
                console.error('Error cleaning up renderer:', error);
              }
            });
          }
          
          // Clean up inactive STL rows
          if (PrinterCalc.STLManager && PrinterCalc.STLManager.rows) {
            Object.keys(PrinterCalc.STLManager.rows).forEach(rowId => {
              const row = document.getElementById(rowId);
              if (!row || !this.isElementVisible(row)) {
                const rowData = PrinterCalc.STLManager.rows[rowId];
                
                // Clear large array buffers to save memory
                if (rowData && rowData.stlData) {
                  rowData.stlData._cachedArrayBuffer = rowData.stlData.arrayBuffer;
                  rowData.stlData.arrayBuffer = null;
                }
              } else {
                // Row is visible again, restore buffer if needed
                const rowData = PrinterCalc.STLManager.rows[rowId];
                if (rowData && rowData.stlData && !rowData.stlData.arrayBuffer && rowData.stlData._cachedArrayBuffer) {
                  rowData.stlData.arrayBuffer = rowData.stlData._cachedArrayBuffer;
                  rowData.stlData._cachedArrayBuffer = null;
                }
              }
            });
          }
        } catch (error) {
          console.error('Error during periodic cleanup:', error);
        }
      },
      
      /**
       * Check if an element is currently in the viewport
       * @param {HTMLElement} element - Element to check
       * @returns {boolean} True if element is in viewport
       */
      isElementInViewport: function(element) {
        if (!element || !element.getBoundingClientRect) return false;
        
        try {
          const rect = element.getBoundingClientRect();
          
          return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
          );
        } catch (error) {
          console.error('Error checking visibility:', error);
          return false;
        }
      },
      
      /**
       * Check if a container is visible
       * @param {HTMLElement} container - Container to check
       * @returns {boolean} True if container is visible
       */
      isContainerVisible: function(container) {
        if (!container) return false;
        
        try {
          // Check if element is in DOM
          if (!document.body.contains(container)) return false;
          
          // Check computed style
          const style = window.getComputedStyle(container);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          
          // Check if element has size
          const rect = container.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return false;
          
          // Check if element is at least partially in viewport
          return (
            rect.bottom >= 0 &&
            rect.right >= 0 &&
            rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.left <= (window.innerWidth || document.documentElement.clientWidth)
          );
        } catch (error) {
          console.error('Error checking container visibility:', error);
          return false;
        }
      }
    };
    
    // Add function to extend PrinterCalc.TabManager
    PrinterCalc.PerformanceOptimizer.enhanceTabManager = function() {
      if (!PrinterCalc.TabManager) return;
      
      // Store original switchToTab method
      const originalSwitchToTab = PrinterCalc.TabManager.switchToTab;
      
      // Override to add cleanup logic
      PrinterCalc.TabManager.switchToTab = function(tabId) {
        // Track previous tab
        const prevTabId = this.getActiveTabId();
        
        // Call original method
        originalSwitchToTab.call(this, tabId);
        
        // Dispatch event with previous tab info
        const event = new CustomEvent('printercalc:tabchanged', {
          detail: { 
            prevTabId: prevTabId,
            newTabId: tabId
          }
        });
        
        document.dispatchEvent(event);
      };
    };
    
    // Auto-initialize when loaded
    if (document.readyState === 'complete') {
      PrinterCalc.PerformanceOptimizer.init();
    } else {
      window.addEventListener('load', function() {
        PrinterCalc.PerformanceOptimizer.init();
      });
    }
  })();