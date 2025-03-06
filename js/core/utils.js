/**
 * utils.js - Utility Functions Module
 * 
 * This module provides general utility functions used throughout the application.
 */

// Extend the PrinterCalc namespace
(function() {
    // Make sure the namespace exists
    window.PrinterCalc = window.PrinterCalc || {};
    
    // Create a Utils object inside our namespace
    PrinterCalc.Utils = {
      /**
       * Generate a unique ID
       * @returns {string} A unique identifier
       */
      generateId: function() {
        return 'id-' + Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
      },
      
      /**
       * Format a number with specified precision
       * @param {number} value - The number to format
       * @param {number} precision - Number of decimal places
       * @returns {string} Formatted number
       */
      formatNumber: function(value, precision = 2) {
        if (isNaN(value)) return '--';
        return value.toFixed(precision);
      },
      
      /**
       * Format currency value
       * @param {number} value - The amount
       * @param {string} currency - Currency code (USD, EUR, etc.)
       * @returns {string} Formatted currency string
       */
      formatCurrency: function(value, currency = 'USD') {
        if (isNaN(value)) return '--';
        
        const symbol = PrinterCalc.CONSTANTS.CURRENCY_SYMBOLS[currency] || '$';
        return `${symbol}${value.toFixed(2)}`;
      },
      
      /**
       * Format print time from seconds
       * @param {number} seconds - Time in seconds
       * @returns {string} Formatted time string
       */
      formatPrintTime: function(seconds) {
        if (isNaN(seconds) || seconds === null) return '--';
        if (typeof seconds === 'string') return seconds;
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
          return `${hours}h ${minutes}m`;
        } else {
          return `${minutes}m`;
        }
      },
      
      /**
       * Format dimensions string
       * @param {object} dimensions - Object with width, depth, height properties
       * @returns {string} Formatted dimensions string
       */
      formatDimensions: function(dimensions) {
        if (!dimensions) return '--';
        
        const { width, depth, height } = dimensions;
        if (!width || !depth || !height) return '--';
        
        return `${width.toFixed(1)} × ${depth.toFixed(1)} × ${height.toFixed(1)}`;
      },
      
      /**
       * Format file size
       * @param {number} bytes - Size in bytes
       * @returns {string} Formatted file size
       */
      formatFileSize: function(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
      },
      
      /**
       * Calculate glaze usage based on volume
       * @param {number} volumeCm3 - Volume in cubic centimeters
       * @returns {number} Glaze amount in grams
       */
      calculateGlazeUsage: function(volumeCm3) {
        const { GLAZE_FACTOR, GLAZE_BASE } = PrinterCalc.CONSTANTS.MATERIALS;
        return (GLAZE_FACTOR * volumeCm3) + GLAZE_BASE;
      },
      
      /**
       * Validate positive number input
       * @param {number} value - Value to check
       * @returns {boolean} True if valid
       */
      isPositiveNumber: function(value) {
        return typeof value === 'number' && !isNaN(value) && value > 0;
      },
      
      /**
       * Parse dimensions from string (format: "10 × 20 × 30")
       * @param {string} dimensionString - Formatted dimensions string
       * @returns {object|null} Object with width, depth, height or null if invalid
       */
      parseDimensionsString: function(dimensionString) {
        if (!dimensionString || typeof dimensionString !== 'string') return null;
        
        // Split by '×' character
        const parts = dimensionString.split('×').map(p => parseFloat(p.trim()));
        
        if (parts.length !== 3 || parts.some(isNaN)) return null;
        
        return {
          width: parts[0],
          depth: parts[1],
          height: parts[2]
        };
      },
      
      /**
       * Get current theme (light or dark)
       * @returns {string} "light" or "dark"
       */
      getCurrentTheme: function() {
        return document.documentElement.getAttribute('data-theme') || 'light';
      },
      
      /**
       * Debounce function to limit function call frequency
       * @param {Function} func - Function to debounce
       * @param {number} wait - Wait time in milliseconds
       * @returns {Function} Debounced function
       */
      debounce: function(func, wait = 300) {
        let timeout;
        return function(...args) {
          clearTimeout(timeout);
          timeout = setTimeout(() => func.apply(this, args), wait);
        };
      },
      
      /**
       * Check if object fits in printer with given orientation
       * @param {object} dimensions - Object with width, depth, height properties
       * @param {string} orientation - "flat" or "vertical"
       * @param {object} printer - Printer specifications
       * @returns {boolean} True if object fits
       */
      checkFitsInPrinter: function(dimensions, orientation, printer) {
        if (!dimensions || !printer) return false;
        
        // Get printer dimensions and wall margin
        const { width: printerWidth, depth: printerDepth, height: printerHeight } = printer.dimensions;
        const wallMargin = printer.wallMargin || PrinterCalc.CONSTANTS.PRINTERS['400'].wallMargin;
        
        // Get object dimensions based on orientation
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
        
        // Check if object fits within print area
        return (objectWidth <= printerWidth - (2 * wallMargin)) && 
               (objectDepth <= printerDepth - (2 * wallMargin)) && 
               (objectHeight <= printerHeight);
      },
      
      /**
       * Calculate print time for an object
       * @param {object} dimensions - Object with width, depth, height properties
       * @param {string} orientation - "flat" or "vertical"
       * @param {object} printer - Printer specifications
       * @returns {number} Print time in seconds
       */
      calculatePrintTime: function(dimensions, orientation, printer) {
        if (!dimensions || !printer) return null;
        
        const layerHeight = PrinterCalc.CONSTANTS.SPACING.LAYER_HEIGHT;
        let printHeight;
        
        if (orientation === 'vertical') {
          // For vertical, use the largest dimension as height
          printHeight = Math.max(dimensions.width, dimensions.depth, dimensions.height);
        } else {
          // For flat, use the smallest dimension as height
          printHeight = Math.min(dimensions.width, dimensions.depth, dimensions.height);
        }
        
        // Calculate number of layers and total print time
        const layers = Math.ceil(printHeight / layerHeight);
        return layers * printer.layerTime;
      },
      
      /**
       * Read file as array buffer (Promise-based)
       * @param {File} file - File object
       * @returns {Promise<ArrayBuffer>} Promise resolving to array buffer
       */
      readFileAsArrayBuffer: function(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          
          reader.onload = function(event) {
            resolve(event.target.result);
          };
          
          reader.onerror = function(error) {
            reject(error);
          };
          
          reader.readAsArrayBuffer(file);
        });
      },
      
      /**
       * Create cost breakdown DOM elements
       * @param {HTMLElement} container - Container element to append to
       * @param {object} costs - Cost breakdown with powder, binder, silica, glaze properties
       * @param {string} currency - Currency code
       */
      createCostBreakdown: function(container, costs, currency = 'USD') {
        if (!container || !costs) return;
        
        // Clear container
        container.innerHTML = '';
        
     // Get total cost and currency symbol
const totalCost = costs.total;
const symbol = PrinterCalc.CONSTANTS.CURRENCY_SYMBOLS[currency] || '$';
        
        // Cost items to display
        const costItems = [
          { name: "Powder", cost: costs.powder, color: "#3a86ff" },
          { name: "Binder", cost: costs.binder, color: "#ff006e" },
          { name: "Silica", cost: costs.silica, color: "#8338ec" },
          { name: "Glaze", cost: costs.glaze, color: "#ffbe0b" }
        ];
        
        // Create progress items
        costItems.forEach(item => {
          if (item.cost <= 0) return;
          
          // Calculate percentage
          const percentage = (item.cost / totalCost) * 100;
          
          // Create progress item elements
          const progressItem = document.createElement('div');
          progressItem.className = 'progress-item';
          
          const progressHeader = document.createElement('div');
          progressHeader.className = 'progress-header';
          
          const progressLabel = document.createElement('div');
          progressLabel.className = 'progress-label';
          progressLabel.textContent = item.name;
          
          const progressValue = document.createElement('div');
          progressValue.className = 'progress-value';
          progressValue.textContent = `${symbol}${item.cost.toFixed(2)} (${percentage.toFixed(1)}%)`;
          
          const progressBar = document.createElement('div');
          progressBar.className = 'progress-bar';
          
          const progressFill = document.createElement('div');
          progressFill.className = 'progress-fill';
          progressFill.style.width = `${percentage}%`;
          progressFill.style.backgroundColor = item.color;
          
          // Assemble elements
          progressHeader.appendChild(progressLabel);
          progressHeader.appendChild(progressValue);
          progressBar.appendChild(progressFill);
          progressItem.appendChild(progressHeader);
          progressItem.appendChild(progressBar);
          
          // Add to container
          container.appendChild(progressItem);
        });
      }
    };
  })();