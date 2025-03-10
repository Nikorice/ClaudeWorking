/**
 * printer-capacity.js - Printer Capacity Calculator
 * 
 * Calculates how many objects can fit in a printer and generates packing layouts.
 */

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
     * Visualize printer capacity on a canvas
     * @param {HTMLCanvasElement} canvas - Canvas element to draw on
     * @param {Object} capacityData - Data from calculate() method
     * @param {Object} printer - Printer specifications
     */
    visualize: function(canvas, capacityData, printer) {
      try {
        if (!canvas || !canvas.getContext || !capacityData || !printer) {
          console.error('Missing required parameters for visualization');
          return;
        }
        
        // Get canvas context
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.error('Could not get canvas context');
          return;
        }
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Check if object fits
        if (!capacityData.fitsInPrinter || capacityData.totalObjects === 0) {
          this.drawNoFitMessage(ctx, canvas.width, canvas.height);
          return;
        }
        
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
        
        // Set up colors based on theme
        const colors = {
          background: isDarkMode ? '#1e293b' : '#ffffff',
          grid: isDarkMode ? '#334155' : '#e2e8f0',
          printer: isDarkMode ? '#94a3b8' : '#64748b',
          object: '#4ade80',
          objectBorder: '#10b981',
          text: isDarkMode ? '#f8fafc' : '#1e293b'
        };
        
        // Draw background
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Set up sizing and scaling
        const padding = 20;
        const availableWidth = canvas.width - (2 * padding);
        const availableHeight = canvas.height - (2 * padding);
        
        // Scale to fit printer in canvas
        const scaleX = availableWidth / printer.dimensions.width;
        const scaleY = availableHeight / printer.dimensions.depth;
        const scale = Math.min(scaleX, scaleY);
        
        // Translate to add padding
        ctx.translate(padding, padding);
        
        // Draw printer outline
        ctx.strokeStyle = colors.printer;
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, printer.dimensions.width * scale, printer.dimensions.depth * scale);
        
        // Draw grid
        ctx.strokeStyle = colors.grid;
        ctx.lineWidth = 0.5;
        const gridSize = 20; // Grid cell size in mm
        
        for (let x = gridSize; x < printer.dimensions.width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x * scale, 0);
          ctx.lineTo(x * scale, printer.dimensions.depth * scale);
          ctx.stroke();
        }
        
        for (let y = gridSize; y < printer.dimensions.depth; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y * scale);
          ctx.lineTo(printer.dimensions.width * scale, y * scale);
          ctx.stroke();
        }
        
        // Draw objects for the current layer (Z=0)
        ctx.fillStyle = colors.object;
        ctx.strokeStyle = colors.objectBorder;
        ctx.lineWidth = 1;
        
        const { positions, objectDimensions } = capacityData;
        
        // Only draw first layer objects
        const firstLayerPositions = positions.filter(pos => pos.z === 0);
        
        firstLayerPositions.forEach(pos => {
          // Scale position and dimensions
          const x = pos.x * scale;
          const y = pos.y * scale;
          const w = objectDimensions.width * scale;
          const d = objectDimensions.depth * scale;
          
          // Draw object rectangle
          ctx.fillRect(x, y, w, d);
          ctx.strokeRect(x, y, w, d);
        });
        
        // Add text for printer dimensions
        ctx.font = '12px Arial';
        ctx.fillStyle = colors.text;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(
          `${printer.dimensions.width}mm × ${printer.dimensions.depth}mm`,
          5, 
          -15
        );
        
        // Add object count
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = colors.text;
        ctx.textAlign = 'left';
        ctx.fillText(
          `${capacityData.totalObjects} objects (${capacityData.arrangement})`,
          5, 
          printer.dimensions.depth * scale + 10
        );
        
        // Reset transformation
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      } catch (error) {
        console.error('Error in printer capacity visualization:', error);
        // Try to draw the error message if possible
        if (canvas && canvas.getContext) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#64748b';
            ctx.fillText('Error visualizing printer capacity', canvas.width / 2, canvas.height / 2);
          }
        }
      }
    },
    
    /**
     * Draw "Does not fit" message on canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     */
    drawNoFitMessage: function(ctx, width, height) {
      try {
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
        
        // Set text style
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isDarkMode ? '#94a3b8' : '#64748b';
        
        // Draw message
        ctx.fillText('Object exceeds printer capacity', width / 2, height / 2);
      } catch (error) {
        console.error('Error drawing no-fit message:', error);
        // Fallback to simpler message
        try {
          ctx.font = '14px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#64748b';
          ctx.fillText('Exceeds capacity', width / 2, height / 2);
        } catch (fallbackError) {
          console.error('Could not draw fallback message:', fallbackError);
        }
      }
    }
  };
})();