/**
 * three-manager.js - Three.js Integration Module
 * 
 * Handles 3D visualization of STL models using Three.js.
 */

(function() {
    // Make sure the namespace exists
    window.PrinterCalc = window.PrinterCalc || {};
    
    // Create a ThreeJS manager module
    PrinterCalc.ThreeManager = {
      /**
       * Initialize a Three.js viewer in a container
       * @param {HTMLElement} container - Container element
       * @returns {Object} Viewer context
       */
      initViewer: function(container) {
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
          
          // Determine if we're in dark mode
          const isDarkMode = PrinterCalc.Utils.getCurrentTheme() === 'dark';
          
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
          
          // Add controls
          const controls = new THREE.OrbitControls(camera, renderer.domElement);
          controls.enableDamping = true;
          controls.dampingFactor = 0.25;
          controls.screenSpacePanning = true;
          
          // Add grid
          const gridHelper = new THREE.GridHelper(100, 10, 0x555555, 0x333333);
          scene.add(gridHelper);
          
          // Handle container resize
          const handleResize = () => {
            const newWidth = container.clientWidth;
            const newHeight = container.clientHeight;
            
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            
            renderer.setSize(newWidth, newHeight);
          };
          
          // Set up resize observer
          const resizeObserver = new ResizeObserver(PrinterCalc.Utils.debounce(handleResize, 100));
          resizeObserver.observe(container);
          
          // Animation loop
          let animationFrameId;
          
          const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            
            controls.update();
            renderer.render(scene, camera);
          };
          
          // Start animation
          animate();
          
          // Create control buttons
          this.createControlButtons(container, scene, camera, controls);
          
          // Store context for later use
          const context = {
            scene,
            camera,
            renderer,
            controls,
            container,
            
            // Clean up method
            dispose: () => {
              cancelAnimationFrame(animationFrameId);
              resizeObserver.disconnect();
              
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
              
              // Remove control buttons
              const buttons = container.querySelectorAll('.viewer-control-btn');
              buttons.forEach(button => button.remove());
            }
          };
          
          return context;
        } catch (error) {
          console.error('Error initializing Three.js viewer:', error);
          return null;
        }
      },
      
      /**
       * Create viewer control buttons
       * @param {HTMLElement} container - Container element
       * @param {THREE.Scene} scene - Three.js scene
       * @param {THREE.Camera} camera - Three.js camera
       * @param {THREE.OrbitControls} controls - OrbitControls object
       */
      createControlButtons: function(container, scene, camera, controls) {
        try {
          // Create controls container if it doesn't exist
          let controlsContainer = container.querySelector('.viewer-controls');
          if (!controlsContainer) {
            controlsContainer = document.createElement('div');
            controlsContainer.className = 'viewer-controls';
            container.appendChild(controlsContainer);
          }
          
          // Reset camera button
          const resetCameraBtn = document.createElement('button');
          resetCameraBtn.className = 'viewer-control-btn reset-camera-btn';
          resetCameraBtn.title = 'Reset Camera';
          resetCameraBtn.innerHTML = '<span class="material-icon">center_focus_strong</span>';
          resetCameraBtn.addEventListener('click', () => {
            camera.position.set(100, 100, 100);
            controls.target.set(0, 0, 0);
            controls.update();
          });
          
          // Toggle wireframe button
          const toggleWireframeBtn = document.createElement('button');
          toggleWireframeBtn.className = 'viewer-control-btn toggle-wireframe-btn';
          toggleWireframeBtn.title = 'Toggle Wireframe';
          toggleWireframeBtn.innerHTML = '<span class="material-icon">grid_3x3</span>';
          toggleWireframeBtn.addEventListener('click', () => {
            scene.traverse(object => {
              if (object.isMesh) {
                if (Array.isArray(object.material)) {
                  object.material.forEach(material => {
                    material.wireframe = !material.wireframe;
                  });
                } else if (object.material) {
                  object.material.wireframe = !object.material.wireframe;
                }
              }
            });
          });
          
          // Add buttons to container
          controlsContainer.appendChild(resetCameraBtn);
          controlsContainer.appendChild(toggleWireframeBtn);
        } catch (error) {
          console.error('Error creating control buttons:', error);
        }
      },
      
      /**
       * Load STL model into the scene
       * @param {Object} context - Viewer context from initViewer()
       * @param {ArrayBuffer} arrayBuffer - STL file data
       * @param {string} orientation - "flat" or "vertical"
       */
      loadModel: function(context, arrayBuffer, orientation = 'flat') {
        if (!context || !arrayBuffer) return;
        
        try {
          const { scene, camera, controls } = context;
          
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
          mesh.userData.isModel = true;
          
          // Apply orientation
          this.applyOrientation(mesh, orientation);
          
          // Add mesh to scene
          scene.add(mesh);
          
          // Center camera on model
          this.fitCameraToObject(context, mesh);
        } catch (error) {
          console.error('Error loading STL model:', error);
        }
      },
      
      /**
       * Apply orientation to model
       * @param {THREE.Mesh} mesh - Three.js mesh
       * @param {string} orientation - "flat" or "vertical" 
       */
      applyOrientation: function(mesh, orientation) {
        if (!mesh || !mesh.geometry) return;
        
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
        let dims = [{axis: 'x', value: size.x}, {axis: 'y', value: size.y}, {axis: 'z', value: size.z}];
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
      },
      
      /**
       * Fit camera to object
       * @param {Object} context - Viewer context
       * @param {THREE.Object3D} object - Object to focus on
       */
      fitCameraToObject: function(context, object) {
        if (!context || !object) return;
        
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
        if (controls) {
          controls.target.copy(boundingSphere.center);
          controls.update();
        }
      }
    };
  })();