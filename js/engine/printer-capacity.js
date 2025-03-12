(function() {
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
    calculate: function(dimensions, orientation, printerType = '400') {
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
        const countZ = Math.floor(availableHeight / objectHeight);
        
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
          }
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
    generatePositions: function(width, depth, height, countX, countY, countZ, wallMargin, spacing) {
      try {
        const positions = [];
        
        for (let z = 0; z < countZ; z++) {
          const zPos = z * height;
          
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
    visualize: function(canvas, capacityData, printer) {
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

    drawCoordinateAxes: function(ctx, canvas, scale) {
      ctx.strokeStyle = 'black';
      ctx.beginPath();
      ctx.moveTo(10, 10);
      ctx.lineTo(10, canvas.height - 10);
      ctx.lineTo(canvas.width - 10, canvas.height - 10);
      ctx.stroke();
    },

    addAxisLabels: function(ctx, canvas, scale) {
      ctx.fillStyle = 'black';
      ctx.fillText('Y', 5, 15);
      ctx.fillText('X', scale * 10 + 5, canvas.height - 5);
    },

    addDimensionLabel: function(ctx, printer, scale) {
      ctx.fillStyle = 'black';
      ctx.fillText(`Printer Dimensions: ${printer.dimensions.width} x ${printer.dimensions.depth}`, 10, 30);
    },

    drawNoFitMessage: function(ctx, canvas) {
      ctx.fillStyle = 'red';
      ctx.fillText('Object exceeds printer capacity', canvas.width / 2 - 100, canvas.height / 2);
    },

    /**
     * Initialize 3D visualizer
     * @param {HTMLCanvasElement} canvas - Canvas element to draw on
     */
    init3DVisualizer: function(canvas) {
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
    addPrinterVolume: function(scene, printer) {
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
    addPackedObjects: function(scene, capacityData) {
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
    addTextLabel: function(scene, text, position) {
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
    fitCameraToScene: function(camera, scene) {
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
    showNoFitMessage: function(scene) {
      this.addTextLabel(scene, 'Object exceeds printer capacity', new THREE.Vector3(0, 0, 0));
    }
  };
})();