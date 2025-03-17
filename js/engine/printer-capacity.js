(function () {
  // Make sure the namespace exists
  window.PrinterCalc = window.PrinterCalc || {};

  // Create a capacity calculator module
  PrinterCalc.PrinterCapacity = {
    /**
     * Calculate printer capacity for an object
     * @param {Object} dimensions - Width, depth, height of the object
     * @param {string} orientation - "flat" or "vertical"
     * @param {string} printerType - "400" or "600"
     * @returns {Object} Capacity information
     */
    calculate: function (dimensions, orientation, printerType = '400', scaleFactor = 1) {
      try {
        // Check if required constants are available
        if (!PrinterCalc.CONSTANTS || !PrinterCalc.CONSTANTS.PRINTERS) {
          console.error('CONSTANTS not available for printer capacity calculation');
          return {
            fitsInPrinter: false,
            countX: 0,
            countY: 0,
            countZ: 0,
            totalObjects: 0,
            arrangement: '0 × 0 × 0',
            positions: []
          };
        }

        // Get printer specifications with fallback
        const printer = PrinterCalc.CONSTANTS.PRINTERS[printerType];
        if (!printer) {
          console.error(`Unknown printer type: ${printerType}`);
          return {
            fitsInPrinter: false,
            countX: 0,
            countY: 0,
            countZ: 0,
            totalObjects: 0,
            arrangement: '0 × 0 × 0',
            positions: []
          };
        }

        // Get spacing constants with fallbacks
        const wallMargin = printer.wallMargin || 10;
        const objectSpacing = (PrinterCalc.CONSTANTS.SPACING && PrinterCalc.CONSTANTS.SPACING.OBJECT_SPACING) || 15;

        // Determine object dimensions based on orientation
        let objectWidth, objectDepth, objectHeight;

        if (orientation === 'vertical') {
          // For vertical orientation, sort dimensions and use
          // smallest for width, middle for depth, largest for height
          const dims = [dimensions.width, dimensions.depth, dimensions.height].sort((a, b) => a - b);
          objectWidth = dims[0];
          objectDepth = dims[1];
          objectHeight = dims[2];
        } else {
          // For flat orientation, sort dimensions and use
          // largest for width, middle for depth, smallest for height
          const dims = [dimensions.width, dimensions.depth, dimensions.height].sort((a, b) => a - b);
          objectWidth = dims[2];
          objectDepth = dims[1];
          objectHeight = dims[0];
        }

        // Check if object fits in printer at all
        if (objectWidth > (printer.dimensions.width - (2 * wallMargin)) ||
          objectDepth > (printer.dimensions.depth - (2 * wallMargin)) ||
          objectHeight > printer.dimensions.height) {

          return {
            fitsInPrinter: false,
            countX: 0,
            countY: 0,
            countZ: 0,
            totalObjects: 0,
            arrangement: '0 × 0 × 0',
            positions: []
          };
        }

        // Calculate available space
        const availableWidth = printer.dimensions.width - (2 * wallMargin);
        const availableDepth = printer.dimensions.depth - (2 * wallMargin);
        const availableHeight = printer.dimensions.height;

        // Calculate how many objects fit along each axis
        const countX = Math.floor((availableWidth + objectSpacing) / (objectWidth + objectSpacing));
        const countY = Math.floor((availableDepth + objectSpacing) / (objectDepth + objectSpacing));

        // For Z-axis, account for object spacing between layers
        const verticalSpacing = objectSpacing; // Use the same spacing for vertical direction
        const countZ = Math.floor((availableHeight + verticalSpacing) / (objectHeight + verticalSpacing));

        // Log the calculations for debugging
        console.log(`Calculating Z capacity: ${availableHeight} / (${objectHeight} + ${verticalSpacing}) = ${countZ}`);

        // Calculate total objects
        const totalObjects = countX * countY * countZ;

        // Generate positions for all objects
        const positions = this.generatePositions(
          objectWidth, objectDepth, objectHeight,
          countX, countY, countZ,
          wallMargin, objectSpacing
        );

        // Calculate maximum print height
        const printHeight = countZ * objectHeight;

        // Calculate print time with fallback
        let printTimeSeconds = 0;
        let formattedPrintTime = '--';

        try {
          // Get layer height with fallback
          const layerHeight = (PrinterCalc.CONSTANTS.SPACING && PrinterCalc.CONSTANTS.SPACING.LAYER_HEIGHT) || 0.1;

          // Calculate layers
          const layers = Math.ceil(printHeight / layerHeight);

          // Calculate print time
          printTimeSeconds = layers * printer.layerTime;

          // Format time with fallback
          if (PrinterCalc.Utils && typeof PrinterCalc.Utils.formatPrintTime === 'function') {
            formattedPrintTime = PrinterCalc.Utils.formatPrintTime(printTimeSeconds);
          } else {
            // Fallback time formatting
            const hours = Math.floor(printTimeSeconds / 3600);
            const minutes = Math.floor((printTimeSeconds % 3600) / 60);
            formattedPrintTime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
          }
        } catch (timeError) {
          console.error('Error calculating print time:', timeError);
        }

        return {
          fitsInPrinter: true,
          countX,
          countY,
          countZ,
          totalObjects,
          arrangement: `${countX} × ${countY} × ${countZ}`,
          positions,
          printHeight,
          printTime: printTimeSeconds,
          formattedPrintTime,
          objectDimensions: {
            width: objectWidth,
            depth: objectDepth,
            height: objectHeight
          },
          scaleFactor: scaleFactor
        };
      } catch (error) {
        console.error('Error in printer capacity calculation:', error);
        return {
          fitsInPrinter: false,
          countX: 0,
          countY: 0,
          countZ: 0,
          totalObjects: 0,
          arrangement: '0 × 0 × 0',
          positions: [],
          error: error.message
        };
      }
    },

    /**
     * Generate positions for objects in the printer
     * @param {number} width - Object width
     * @param {number} depth - Object depth 
     * @param {number} height - Object height
     * @param {number} countX - Number of objects in X direction
     * @param {number} countY - Number of objects in Y direction
     * @param {number} countZ - Number of objects in Z direction
     * @param {number} wallMargin - Margin from printer walls
     * @param {number} spacing - Spacing between objects
     * @returns {Array} Array of position objects {x, y, z}
     */
    generatePositions: function (width, depth, height, countX, countY, countZ, wallMargin, spacing) {
      try {
        const positions = [];

        // Add vertical spacing - we'll use the same spacing as the XY spacing for consistency
        const verticalSpacing = spacing;
        
        for (let z = 0; z < countZ; z++) {
          // Calculate z position - start at z=0 (bottom of printer)
          // Add vertical spacing between layers
          const zPos = z * (height + verticalSpacing);

          for (let y = 0; y < countY; y++) {
            const yPos = wallMargin + (y * (depth + spacing));

            for (let x = 0; x < countX; x++) {
              const xPos = wallMargin + (x * (width + spacing));

              positions.push({
                x: xPos,
                y: yPos,
                z: zPos
              });
            }
          }
        }

        return positions;
      } catch (error) {
        console.error('Error generating positions:', error);
        return [];
      }
    },

    /**
     * Visualize printer capacity in 2D
     * @param {HTMLCanvasElement} canvas - Canvas element to draw on
     * @param {Object} capacityData - Data from calculate() method
     * @param {Object} printer - Printer specifications
     */
    visualize: function (canvas, capacityData, printer) {
      const ctx = canvas.getContext('2d');
      const scale = 10; // Scale for visualization

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw printer dimensions
      ctx.strokeStyle = 'green';
      ctx.strokeRect(10, 10, printer.dimensions.width * scale, printer.dimensions.depth * scale);

      // Draw packed objects
      const { positions, objectDimensions } = capacityData;
      ctx.fillStyle = 'red';
      positions.forEach(pos => {
        ctx.fillRect(
          10 + pos.x * scale,
          10 + pos.y * scale,
          objectDimensions.width * scale,
          objectDimensions.depth * scale
        );
      });

      // Draw axes
      this.drawCoordinateAxes(ctx, canvas, scale);

      // Add axis labels
      this.addAxisLabels(ctx, canvas, scale);

      // Add dimension label
      this.addDimensionLabel(ctx, printer, scale);

      // Draw no fit message if necessary
      if (!capacityData.fitsInPrinter || capacityData.totalObjects === 0) {
        this.drawNoFitMessage(ctx, canvas);
      }
    },

    drawCoordinateAxes: function (ctx, canvas, scale) {
      ctx.strokeStyle = 'black';
      ctx.beginPath();
      ctx.moveTo(10, 10);
      ctx.lineTo(10, canvas.height - 10);
      ctx.lineTo(canvas.width - 10, canvas.height - 10);
      ctx.stroke();
    },

    addAxisLabels: function (ctx, canvas, scale) {
      ctx.fillStyle = 'black';
      ctx.fillText('Y', 5, 15);
      ctx.fillText('X', scale * 10 + 5, canvas.height - 5);
    },

    addDimensionLabel: function (ctx, printer, scale) {
      ctx.fillStyle = 'black';
      ctx.fillText(`Printer Dimensions: ${printer.dimensions.width} x ${printer.dimensions.depth}`, 10, 30);
    },

    drawNoFitMessage: function (ctx, canvas) {
      ctx.fillStyle = 'red';
      ctx.fillText('Object exceeds printer capacity', canvas.width / 2 - 100, canvas.height / 2);
    },

    /**
     * Initialize 3D visualizer
     * @param {HTMLCanvasElement} canvas - Canvas element to draw on
     */
    init3DVisualizer: function (canvas) {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ canvas });
      renderer.setSize(canvas.width, canvas.height);
      return { scene, camera, renderer };
    },

    /**
     * Add printer volume to the scene
     * @param {THREE.Scene} scene - The scene to add to
     * @param {Object} printer - Printer specifications
     */
    addPrinterVolume: function (scene, printer) {
      const geometry = new THREE.BoxGeometry(printer.dimensions.width, printer.dimensions.height, printer.dimensions.depth);
      const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
      const printerMesh = new THREE.Mesh(geometry, material);
      scene.add(printerMesh);
    },

    /**
     * Add packed objects to the scene
     * @param {THREE.Scene} scene - The scene to add to
     * @param {Object} capacityData - Data from calculate() method
     */
    addPackedObjects: function (scene, capacityData) {
      const { positions, objectDimensions } = capacityData;
      const geometry = new THREE.BoxGeometry(objectDimensions.width, objectDimensions.height, objectDimensions.depth);
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });

      positions.forEach(pos => {
        const objectMesh = new THREE.Mesh(geometry, material);
        objectMesh.position.set(pos.x, pos.y, pos.z);
        scene.add(objectMesh);
      });
    },

    /**
     * Add text label to the scene
     * @param {THREE.Scene} scene - The scene to add to
     * @param {string} text - The text to display
     * @param {THREE.Vector3} position - The position to place the text
     */
    addTextLabel: function (scene, text, position) {
      const textGeometry = new THREE.TextGeometry(text, {
        font: new THREE.FontLoader().parse(fontJson), // Assuming fontJson is defined
        size: 1,
        height: 0.1
      });
      const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const textMesh = new THREE.Mesh(textGeometry, textMaterial);
      textMesh.position.copy(position);
      scene.add(textMesh);
    },

    /**
     * Fit camera to the scene
     * @param {THREE.Camera} camera - The camera to adjust
     * @param {THREE.Scene} scene - The scene to fit to
     */
    fitCameraToScene: function (camera, scene) {
      const box = new THREE.Box3().setFromObject(scene);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = box.getCenter(new THREE.Vector3());
      camera.position.set(center.x, center.y, size.z * 2);
      camera.lookAt(center);
    },

    /**
     * Show "Does not fit" message in the scene
     * @param {THREE.Scene} scene - The scene to add to
     */
    showNoFitMessage: function (scene) {
      this.addTextLabel(scene, 'Object exceeds printer capacity', new THREE.Vector3(0, 0, 0));
    }
  };
  // Enhanced 3D visualization method
  PrinterCalc.PrinterCapacity.visualize3D = function (container, capacityData, printer, stlGeometry) {
    if (!container || !capacityData || !printer) {
      console.error('Missing required parameters for 3D visualization');
      return;
    }

    try {
      // Check if Three.js is available
      if (typeof THREE === 'undefined') {
        console.error('THREE is not defined. Falling back to 2D visualization.');
        return this.visualize(container, capacityData, printer);
      }

      // Clear previous contents
      container.innerHTML = '';

      // Check if capacity data is valid
      if (!capacityData.fitsInPrinter) {
        const errorMsg = document.createElement('div');
        errorMsg.textContent = 'Object exceeds printer capacity';
        errorMsg.style.textAlign = 'center';
        errorMsg.style.padding = '50px 0';
        errorMsg.style.color = '#ef4444';
        container.appendChild(errorMsg);
        return;
      }

      // Initialize 3D scene
      const width = container.clientWidth || 280;
      const height = container.clientHeight || 200;

      // Determine if we're in dark mode
      const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';

      // Create scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(isDarkMode ? 0x1e293b : 0xf8fafc);

      // Create camera
      const camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
      camera.position.set(400, 400, 400);

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
      let controls;
      try {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.25;
        controls.enableZoom = true;
        controls.autoRotate = false;
      } catch (controlsError) {
        console.warn('OrbitControls not available:', controlsError);
        controls = { update: function () { } };
      }

      // Add printer volume wireframe
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

      // Add a tiny floor plane to help with orientation
      const floorGeometry = new THREE.PlaneGeometry(printerWidth, printerDepth);
      const floorMaterial = new THREE.MeshBasicMaterial({
        color: 0xcccccc,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide
      });
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.rotation.x = Math.PI / 2; // Rotate to lay flat
      floor.position.set(printerWidth / 2, 0.01, printerDepth / 2); // Just above 0 to avoid z-fighting
      scene.add(floor);

      // Add axes
      const axesHelper = new THREE.AxesHelper(100);
      scene.add(axesHelper);

      // Add axis labels
      const addLabel = (text, position, color) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 32;

        ctx.fillStyle = color;
        ctx.font = 'bold 24px Arial';
        ctx.fillText(text, 10, 24);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.position.copy(position);
        sprite.scale.set(20, 10, 1);
        scene.add(sprite);
      };

      addLabel('X', new THREE.Vector3(110, 0, 0), '#ff4a4a');
      addLabel('Y', new THREE.Vector3(0, 0, 110), '#4ade80');
      addLabel('Z', new THREE.Vector3(0, 110, 0), '#3b82f6');

      // Create material for the STL models
      const modelMaterial = new THREE.MeshPhongMaterial({
        color: 0x4ade80,
        specular: 0x111111,
        shininess: 30,
        opacity: 0.85,
        transparent: true
      });

      // Add models to the scene if STL geometry is provided
      if (stlGeometry && capacityData.positions) {
        const { positions } = capacityData;
        const scaleFactor = capacityData.scaleFactor || 1; // Get scale factor or default to 1

        positions.forEach((pos, index) => {
          // Create a new mesh for each position with the scaled geometry
          const geometryClone = stlGeometry.clone();

          // Apply scale factor to the geometry if not already applied and if needed
          if (scaleFactor !== 1 && geometryClone.scale) {
            geometryClone.scale(scaleFactor, scaleFactor, scaleFactor);
          }

          const mesh = new THREE.Mesh(geometryClone, modelMaterial.clone());

          // Position according to the packing data
          // In Three.js, Y is up/down, so we use pos.z for the height
          mesh.position.set(
            pos.x + capacityData.objectDimensions.width * scaleFactor / 2,  // Center in X with scaling
            pos.z,  // Start at bottom in Y (Height)
            pos.y + capacityData.objectDimensions.depth * scaleFactor / 2   // Center in Z with scaling
          );

          // Add to scene
          scene.add(mesh);
        });
      } else {
        // Fallback to simple boxes if no STL geometry is provided
        const scaleFactor = capacityData.scaleFactor || 1; // Get scale factor or default to 1
        console.log(`Creating boxes with scale factor: ${scaleFactor}`);
        
        const boxGeometry = new THREE.BoxGeometry(
          capacityData.objectDimensions.width * scaleFactor,  // Apply scale factor
          capacityData.objectDimensions.height * scaleFactor, // Apply scale factor
          capacityData.objectDimensions.depth * scaleFactor   // Apply scale factor
        );
        
        // Update position calculation for boxes with scale factor
        capacityData.positions.forEach(pos => {
          const boxMesh = new THREE.Mesh(boxGeometry, modelMaterial.clone());
          
          // Position with bottom at floor level, adjusted for scale
          boxMesh.position.set(
            pos.x + (capacityData.objectDimensions.width * scaleFactor / 2),  // Center in X with scale
            pos.z + (capacityData.objectDimensions.height * scaleFactor / 2),  // Center in Y with scale
            pos.y + (capacityData.objectDimensions.depth * scaleFactor / 2)   // Center in Z with scale
          );
          
          scene.add(boxMesh);
        });
      }

      // Add printer model label
      const printerLabel = document.createElement('div');
      printerLabel.className = 'printer-label';
      printerLabel.textContent = printer.name === 'Printer 400' ? 'PB-400' : 'PB-600';
      printerLabel.style.position = 'absolute';
      printerLabel.style.top = '8px';
      printerLabel.style.left = '8px';
      printerLabel.style.color = 'rgba(59, 130, 246, 0.8)'; // Subtle blue color
      printerLabel.style.padding = '4px 8px';
      printerLabel.style.fontSize = '0.85rem';
      printerLabel.style.fontWeight = '500';
      printerLabel.style.zIndex = '10';
      container.appendChild(printerLabel);

      // Add count indicator
      const countLabel = document.createElement('div');
      countLabel.className = 'count-label';
      countLabel.textContent = `${capacityData.totalObjects} objects`;
      countLabel.style.position = 'absolute';
      countLabel.style.top = '8px';
      countLabel.style.right = '8px';
      countLabel.style.backgroundColor = '#4ade80';
      countLabel.style.color = 'white';
      countLabel.style.padding = '4px 8px';
      countLabel.style.borderRadius = '4px';
      countLabel.style.fontSize = '0.8rem';
      countLabel.style.fontWeight = 'bold';
      countLabel.style.zIndex = '10';
      container.appendChild(countLabel);

      // Set up animation loop
      let animationFrameId;

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);

        if (controls && typeof controls.update === 'function') {
          controls.update();
        }

        renderer.render(scene, camera);
      };

      // Start animation
      animate();

      // Handle container resize
      const handleResize = () => {
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;

        if (newWidth && newHeight) {
          camera.aspect = newWidth / newHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newWidth, newHeight);
        }
      };

      // Set up resize observer
      let resizeObserver;
      try {
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver((entries) => {
            // Debounce resize
            clearTimeout(container.resizeTimeout);
            container.resizeTimeout = setTimeout(() => {
              handleResize();
            }, 100);
          });
          resizeObserver.observe(container);
        } else {
          // Fallback to window resize event
          window.addEventListener('resize', handleResize);
        }
      } catch (error) {
        console.error('Error setting up resize observer:', error);
        window.addEventListener('resize', handleResize);
      }

      // Store cleanup function in container
      container.visualizerCleanup = () => {
        // Cancel animation frame if it exists
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }

        // Disconnect resize observer if it exists
        if (resizeObserver && typeof resizeObserver.disconnect === 'function') {
          resizeObserver.disconnect();
        } else if (window.removeEventListener) {
          window.removeEventListener('resize', handleResize);
        }

        // Clean up Three.js resources
        if (renderer) {
          renderer.dispose();
        }

        // Remove DOM elements safely - check if they exist and are children of container
        const safeRemove = (element) => {
          try {
            if (element && element.parentNode === container) {
              container.removeChild(element);
            }
          } catch (error) {
            console.warn('Error removing element:', error);
          }
        };

        // Safely remove elements
        if (renderer && renderer.domElement) safeRemove(renderer.domElement);
        if (printerLabel) safeRemove(printerLabel);
        if (countLabel) safeRemove(countLabel);

        // Clear any other content
        while (container.firstChild) {
          try {
            container.removeChild(container.firstChild);
          } catch (error) {
            console.warn('Error removing child:', error);
            break; // Prevent infinite loop if removal fails
          }
        }
      };

      // Position camera to view all objects isometrically
      const box = new THREE.Box3().setFromObject(scene);
      const center = new THREE.Vector3();
      box.getCenter(center);
      const size = new THREE.Vector3();
      box.getSize(size);

      // Use isometric view angles (approximately 35.264 degrees from each axis)
      const distance = Math.max(size.x, size.y, size.z) * 1.5;
      const isometricAngle = Math.PI / 4; // 45 degrees
      const elevationAngle = Math.atan(1 / Math.sqrt(2)); // approx 35.264 degrees

      // Position camera isometrically
      camera.position.set(
        center.x + distance * Math.cos(isometricAngle),
        center.y + distance * Math.sin(elevationAngle),
        center.z + distance * Math.sin(isometricAngle)
      );
      camera.lookAt(center);

      if (controls) {
        controls.target.copy(center);
        controls.update();
      }

    } catch (error) {
      console.error('Error in 3D visualization:', error);

      // Fall back to 2D visualization
      console.warn('Falling back to 2D visualization');
      this.visualize(container, capacityData, printer);
    }
  };

  // Store the original visualize method
  const originalVisualize = PrinterCalc.PrinterCapacity.visualize;

  // Override the visualize method to use 3D when possible
  PrinterCalc.PrinterCapacity.visualize = function (container, capacityData, printer) {
    try {
      // Check if Three.js is available
      if (typeof THREE !== 'undefined') {
        // Use the 3D visualization with box geometry (no STL)
        this.visualize3D(container, capacityData, printer);
      } else {
        // Fall back to original 2D visualization
        originalVisualize.call(this, container, capacityData, printer);
      }
    } catch (error) {
      console.error('Error in visualize:', error);
      // Fall back to original 2D visualization
      originalVisualize.call(this, container, capacityData, printer);
    }
  };
})();