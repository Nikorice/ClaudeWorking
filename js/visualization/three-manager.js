/**
 * three-manager.js - Three.js Integration Module
 * 
 * Handles 3D visualization of STL models using Three.js.
 */

(function () {
  // Make sure the namespace exists
  window.PrinterCalc = window.PrinterCalc || {};

  // Create a ThreeJS manager module
  PrinterCalc.ThreeManager = {
    /**
     * Initialize a Three.js viewer in a container
     * @param {HTMLElement} container - Container element
     * @returns {Object} Viewer context
     */
    initViewer: function (container) {
      if (!container) return null;

      try {
        // Check if Three.js is available
        if (typeof THREE === 'undefined') {
          console.error('THREE is not defined. Make sure Three.js library is loaded.');
          return null;
        }

        // Get container dimensions
        const width = container.clientWidth || 300;
        const height = container.clientHeight || 200;

        // Determine if we're in dark mode - with fallback
        let isDarkMode = false;
        try {
          if (PrinterCalc.Utils && typeof PrinterCalc.Utils.getCurrentTheme === 'function') {
            isDarkMode = PrinterCalc.Utils.getCurrentTheme() === 'dark';
          } else {
            // Fallback method to detect dark mode
            isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
          }
        } catch (themeError) {
          console.error('Error determining theme:', themeError);
          // Default to light mode
          isDarkMode = false;
        }

        // Create scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(isDarkMode ? 0x1e293b : 0xf0f2f5);

        // Create camera
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
        camera.position.set(100, 100, 100);

        // Create renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        container.appendChild(renderer.domElement);

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);

        // Add controls - with error handling
        let controls;
        try {
          if (typeof THREE.OrbitControls !== 'undefined') {
            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.25;
            controls.screenSpacePanning = true;
          } else {
            console.warn('OrbitControls not available');
            controls = { update: function() {} }; // Empty controls object as fallback
          }
        } catch (controlsError) {
          console.error('Error creating controls:', controlsError);
          controls = { update: function() {} }; // Empty controls object as fallback
        }

        // Add grid
        const gridHelper = new THREE.GridHelper(100, 10, 0x555555, 0x333333);
        scene.add(gridHelper);

        // Create a simple debounce function
        const debounce = function(func, wait) {
          let timeout;
          return function() {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(function() {
              func.apply(context, args);
            }, wait || 100);
          };
        };

        // Handle container resize
        const handleResize = () => {
          try {
            const newWidth = container.clientWidth;
            const newHeight = container.clientHeight;

            if (newWidth && newHeight) {
              camera.aspect = newWidth / newHeight;
              camera.updateProjectionMatrix();
              renderer.setSize(newWidth, newHeight);
            }
          } catch (resizeError) {
            console.error('Error handling resize:', resizeError);
          }
        };

        // Set up resize observer with fallback and error handling
        let resizeObserver;
        try {
          if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(
              (PrinterCalc.Utils && typeof PrinterCalc.Utils.debounce === 'function') 
                ? PrinterCalc.Utils.debounce(handleResize, 100)
                : debounce(handleResize, 100)
            );
            resizeObserver.observe(container);
          } else {
            // Fallback to window resize event
            console.warn('ResizeObserver not supported, using window resize event');
            window.addEventListener('resize', debounce(handleResize, 200));
          }
        } catch (observerError) {
          console.error('Error setting up resize observer:', observerError);
          // Basic fallback
          window.addEventListener('resize', debounce(handleResize, 200));
        }

        // Animation loop
        let animationFrameId;

        const animate = () => {
          try {
            animationFrameId = requestAnimationFrame(animate);
            
            // Add null check before updating controls
            if (controls && typeof controls.update === 'function') {
              controls.update();
            }
            
            // Add null check before rendering
            if (renderer && scene && camera) {
              renderer.render(scene, camera);
            }
          } catch (animateError) {
            console.error('Error in animation loop:', animateError);
            cancelAnimationFrame(animationFrameId);
          }
        };

        // Start animation
        animate();

        // Store context for later use
        const context = {
          scene,
          camera,
          renderer,
          controls,
          container,

          // Clean up method
          dispose: () => {
            try {
              cancelAnimationFrame(animationFrameId);
              
              if (resizeObserver && typeof resizeObserver.disconnect === 'function') {
                resizeObserver.disconnect();
              } else {
                window.removeEventListener('resize', handleResize);
              }

              // Remove any models and dispose of resources
              while (scene.children.length > 0) {
                const object = scene.children[0];

                if (object.geometry) object.geometry.dispose();

                if (object.material) {
                  if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                  } else {
                    object.material.dispose();
                  }
                }

                scene.remove(object);
              }

              // Remove renderer from DOM
              if (renderer.domElement && renderer.domElement.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
              }

              renderer.dispose();

              // Remove controls
              if (controls.dispose) controls.dispose();
            } catch (disposeError) {
              console.error('Error disposing viewer:', disposeError);
            }
          }
        };

        return context;
      } catch (error) {
        console.error('Error initializing Three.js viewer:', error);
        return null;
      }
    },

    /**
     * Load STL model into the scene
     * @param {Object} context - Viewer context from initViewer()
     * @param {ArrayBuffer} arrayBuffer - STL file data
     * @param {string} orientation - "flat" or "vertical"
     */
    loadModel: function (context, arrayBuffer, orientation = 'flat') {
      if (!context || !arrayBuffer) return;

      try {
        const { scene, camera, controls } = context;

        // Check if Three.js and STLLoader are available
        if (typeof THREE === 'undefined' || typeof THREE.STLLoader === 'undefined') {
          console.error('THREE.js or STLLoader not available');
          return;
        }

        // Remove existing models
        scene.traverse(object => {
          if (object.userData && object.userData.isModel) {
            scene.remove(object);

            if (object.geometry) object.geometry.dispose();

            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach(material => material.dispose());
              } else {
                object.material.dispose();
              }
            }
          }
        });

        // Use STL loader to parse the buffer
        const loader = new THREE.STLLoader();
        const geometry = loader.parse(arrayBuffer);

        // Create material
        const material = new THREE.MeshPhongMaterial({
          color: 0x4285F4,
          specular: 0x111111,
          shininess: 30
        });

        // Create mesh
        const mesh = new THREE.Mesh(geometry, material);
        if (!mesh.userData) mesh.userData = {};
        mesh.userData.isModel = true;

        // Apply orientation
        this.applyOrientation(mesh, orientation);

        // Add mesh to scene
        scene.add(mesh);

        // Center camera on model
        this.fitCameraToObject(context, mesh);
        
        // Mark mesh as model for later retrieval
        if (PrinterCalc.ModelViewer && PrinterCalc.ModelViewer.markAsModel) {
          PrinterCalc.ModelViewer.markAsModel(mesh);
        }
      } catch (error) {
        console.error('Error loading STL model:', error);
      }
    },

    /**
     * Apply orientation to model
     * @param {THREE.Mesh} mesh - Three.js mesh
     * @param {string} orientation - "flat" or "vertical" 
     */
    applyOrientation: function (mesh, orientation) {
      if (!mesh || !mesh.geometry) return;

      try {
        // Reset transformation
        mesh.rotation.set(0, 0, 0);
        mesh.updateMatrix();

        // Get the bounding box to determine dimensions
        mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox;

        // Calculate dimensions
        const size = new THREE.Vector3();
        box.getSize(size);

        // Find the dimensions in order of size
        let dims = [{ axis: 'x', value: size.x }, { axis: 'y', value: size.y }, { axis: 'z', value: size.z }];
        dims.sort((a, b) => b.value - a.value); // Sort by size (largest first)

        // Determine largest, middle, and smallest dimensions
        const largest = dims[0];
        const middle = dims[1];
        const smallest = dims[2];

        // Get the center of the geometry
        const center = new THREE.Vector3();
        box.getCenter(center);

        // Apply orientation
        if (orientation === 'flat') {
          // For flat orientation, we want the smallest dimension on the Y axis (up)
          // and the largest in the XZ plane

          // Create a new geometry that's centered
          mesh.geometry.translate(-center.x, -center.y, -center.z);

          // Apply rotations based on current axes orientation
          if (smallest.axis === 'x') {
            mesh.rotation.z = Math.PI / 2;
          } else if (smallest.axis === 'z') {
            mesh.rotation.x = Math.PI / 2;
          }
          // If smallest is already y, no rotation needed

          // Update geometry
          mesh.updateMatrix();
          mesh.geometry.applyMatrix4(mesh.matrix);
          mesh.rotation.set(0, 0, 0);
          mesh.matrix.identity();

          // Position at origin with bottom at y=0
          mesh.geometry.computeBoundingBox();
          const bottomY = mesh.geometry.boundingBox.min.y;
          mesh.geometry.translate(0, -bottomY, 0);
        } else {
          // For vertical orientation, we want the largest dimension on the Y axis (up)

          // Create a new geometry that's centered
          mesh.geometry.translate(-center.x, -center.y, -center.z);

          // Apply rotations based on current axes orientation
          if (largest.axis === 'x') {
            mesh.rotation.z = Math.PI / 2;
          } else if (largest.axis === 'z') {
            mesh.rotation.x = Math.PI / 2;
          }
          // If largest is already y, no rotation needed

          // Update geometry
          mesh.updateMatrix();
          mesh.geometry.applyMatrix4(mesh.matrix);
          mesh.rotation.set(0, 0, 0);
          mesh.matrix.identity();

          // Position at origin with bottom at y=0
          mesh.geometry.computeBoundingBox();
          const bottomY = mesh.geometry.boundingBox.min.y;
          mesh.geometry.translate(0, -bottomY, 0);
        }

        // Ensure matrix is updated
        mesh.updateMatrix();
      } catch (error) {
        console.error('Error applying orientation:', error);
      }
    },

    /**
     * Fit camera to object
     * @param {Object} context - Viewer context
     * @param {THREE.Object3D} object - Object to focus on
     */
    fitCameraToObject: function (context, object) {
      if (!context || !object) return;

      try {
        const { camera, controls } = context;

        // Get bounding sphere
        object.geometry.computeBoundingSphere();
        const boundingSphere = object.geometry.boundingSphere;

        // Calculate ideal camera distance
        const fov = camera.fov * (Math.PI / 180);
        const distance = (boundingSphere.radius * 2.5) / Math.sin(fov / 2);

        // Position camera
        camera.position.set(distance, distance, distance);
        camera.lookAt(boundingSphere.center);

        // Update controls target
        if (controls && typeof controls.update === 'function') {
          if (controls.target && typeof controls.target.copy === 'function') {
            controls.target.copy(boundingSphere.center);
          }
          controls.update();
        }
      } catch (error) {
        console.error('Error fitting camera to object:', error);
      }
    }
  };
})();