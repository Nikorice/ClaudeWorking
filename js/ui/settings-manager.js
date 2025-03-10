/**
 * settings-manager.js - Settings Management
 * 
 * Handles application settings and preferences.
 */

(function() {
    // Make sure the namespace exists
    window.PrinterCalc = window.PrinterCalc || {};
    
    // Create a settings manager module
    PrinterCalc.SettingsManager = {
      // Default settings
      defaults: {
        currency: 'USD',
        wallMargin: 10,
        objectSpacing: 15,
        applyGlaze: true
      },
      
      // Current settings
      current: {},
      
      /**
       * Initialize settings manager
       */
      init: function() {
        // Load saved settings or use defaults
        this.loadSettings();
        
        // Initialize UI elements
        this.initUI();
        
        // Apply settings to UI
        this.applyToUI();
        
        // Set up event handlers
        this.setupEventHandlers();
      },
      
      /**
       * Load settings from localStorage
       */
      loadSettings: function() {
        try {
          // Try to load from localStorage
          const savedSettings = localStorage.getItem('printercalc_settings');
          
          if (savedSettings) {
            // Parse saved settings
            const parsed = JSON.parse(savedSettings);
            
            // Apply saved settings with defaults for any missing values
            this.current = {
              ...this.defaults,
              ...parsed
            };
          } else {
            // No saved settings, use defaults
            this.current = { ...this.defaults };
          }
        } catch (error) {
          console.error('Error loading settings:', error);
          // Use defaults on error
          this.current = { ...this.defaults };
        }
      },
      
      /**
       * Save settings to localStorage
       */
      saveSettings: function() {
        try {
          localStorage.setItem('printercalc_settings', JSON.stringify(this.current));
          return true;
        } catch (error) {
          console.error('Error saving settings:', error);
          return false;
        }
      },
      
      /**
       * Initialize UI elements
       */
      initUI: function() {
        // Initialize currency selector
        const currencySelect = document.getElementById('currency');
        if (currencySelect) {
          // Add change handler
          currencySelect.addEventListener('change', () => {
            this.updateSetting('currency', currencySelect.value);
            this.updatePricingFields();
            
            // Update any displayed costs
            this.notifySettingsChanged();
          });
        }
        
        // Initialize wall margin input
        const wallMarginInput = document.getElementById('wallMargin');
        if (wallMarginInput) {
          wallMarginInput.addEventListener('change', () => {
            const value = parseInt(wallMarginInput.value) || this.defaults.wallMargin;
            this.updateSetting('wallMargin', value);
          });
        }
        
        // Initialize object spacing input
        const objectSpacingInput = document.getElementById('objectSpacing');
        if (objectSpacingInput) {
          objectSpacingInput.addEventListener('change', () => {
            const value = parseInt(objectSpacingInput.value) || this.defaults.objectSpacing;
            this.updateSetting('objectSpacing', value);
          });
        }
        
        // Initialize advanced settings toggle
        const advancedToggle = document.querySelector('.advanced-toggle');
        if (advancedToggle) {
          advancedToggle.addEventListener('click', () => {
            advancedToggle.classList.toggle('open');
            
            const advancedSettings = document.querySelector('.advanced-settings');
            if (advancedSettings) {
              advancedSettings.classList.toggle('open');
            }
          });
        }
        
        // Initialize update pricing button
        const updatePricingBtn = document.getElementById('updatePricing');
        if (updatePricingBtn) {
          updatePricingBtn.addEventListener('click', () => {
            this.updatePricing();
          });
        }
        
        // Initialize apply settings button
        const updateSettingsBtn = document.getElementById('updateSettings');
        if (updateSettingsBtn) {
          updateSettingsBtn.addEventListener('click', () => {
            this.applySettings();
          });
        }
      },
      
      /**
       * Apply settings to UI elements
       */
      applyToUI: function() {
        // Set currency selector
        const currencySelect = document.getElementById('currency');
        if (currencySelect) {
          currencySelect.value = this.current.currency;
        }
        
        // Set wall margin input
        const wallMarginInput = document.getElementById('wallMargin');
        if (wallMarginInput) {
          wallMarginInput.value = this.current.wallMargin;
        }
        
        // Set object spacing input
        const objectSpacingInput = document.getElementById('objectSpacing');
        if (objectSpacingInput) {
          objectSpacingInput.value = this.current.objectSpacing;
        }
        
        // Update pricing fields
        this.updatePricingFields();
      },
      
      /**
       * Set up event handlers
       */
      setupEventHandlers: function() {
        // Add save settings button handler
        const saveSettingsBtn = document.getElementById('saveSettings');
        if (saveSettingsBtn) {
          saveSettingsBtn.addEventListener('click', () => {
            // Update pricing before saving
            this.updatePricing();
            
            // Save settings
            if (this.saveSettings()) {
              PrinterCalc.Notification.success(
                'Settings Saved',
                'Your settings have been saved successfully.'
              );
            } else {
              PrinterCalc.Notification.error(
                'Save Failed',
                'There was an error saving your settings.'
              );
            }
          });
        }
      },
      
      /**
       * Update a single setting
       * @param {string} key - Setting key
       * @param {any} value - Setting value
       */
      updateSetting: function(key, value) {
        this.current[key] = value;
      },
      
      /**
       * Update pricing fields based on current currency
       */
      updatePricingFields: function() {
        const currency = this.current.currency;
        const pricing = PrinterCalc.CONSTANTS.PRICING[currency] || PrinterCalc.CONSTANTS.PRICING.USD;
        
        // Update pricing fields with proper formatting
        const pricePowder = document.getElementById('pricePowder');
        const priceBinder = document.getElementById('priceBinder');
        const priceSilica = document.getElementById('priceSilica');
        const priceGlaze = document.getElementById('priceGlaze');
        
        if (pricePowder) pricePowder.value = pricing.powder.toFixed(2);
        if (priceBinder) priceBinder.value = pricing.binder.toFixed(2);
        if (priceSilica) priceSilica.value = pricing.silica.toFixed(2);
        if (priceGlaze) priceGlaze.value = pricing.glaze.toFixed(2);
        
        // Update currency labels
        const currencyLabels = document.querySelectorAll('.input-group-append');
        currencyLabels.forEach(label => {
          label.textContent = currency;
        });
      },
      
      /**
       * Update pricing from input fields
       */
      updatePricing: function() {
        const currency = this.current.currency;
        
        // Get values from inputs with proper validation
        const powderPriceInput = document.getElementById('pricePowder');
        const binderPriceInput = document.getElementById('priceBinder');
        const silicaPriceInput = document.getElementById('priceSilica');
        const glazePriceInput = document.getElementById('priceGlaze');
        
        // Parse values with fallbacks to existing values
        const powderPrice = powderPriceInput && !isNaN(parseFloat(powderPriceInput.value)) 
            ? parseFloat(powderPriceInput.value) 
            : PrinterCalc.CONSTANTS.PRICING[currency].powder;
        
        const binderPrice = binderPriceInput && !isNaN(parseFloat(binderPriceInput.value))
            ? parseFloat(binderPriceInput.value)
            : PrinterCalc.CONSTANTS.PRICING[currency].binder;
        
        const silicaPrice = silicaPriceInput && !isNaN(parseFloat(silicaPriceInput.value))
            ? parseFloat(silicaPriceInput.value)
            : PrinterCalc.CONSTANTS.PRICING[currency].silica;
        
        const glazePrice = glazePriceInput && !isNaN(parseFloat(glazePriceInput.value))
            ? parseFloat(glazePriceInput.value)
            : PrinterCalc.CONSTANTS.PRICING[currency].glaze;
        
        // Update field values with proper formatting
        if (powderPriceInput) powderPriceInput.value = powderPrice.toFixed(2);
        if (binderPriceInput) binderPriceInput.value = binderPrice.toFixed(2);
        if (silicaPriceInput) silicaPriceInput.value = silicaPrice.toFixed(2);
        if (glazePriceInput) glazePriceInput.value = glazePrice.toFixed(2);
        
        // Update pricing constants - making sure we use Numbers not Strings
        PrinterCalc.CONSTANTS.PRICING[currency] = {
          powder: Number(powderPrice),
          binder: Number(binderPrice),
          silica: Number(silicaPrice),
          glaze: Number(glazePrice)
        };
        
        // Notify of changes for updates
        this.notifySettingsChanged();
        
        // Show notification
        PrinterCalc.Notification.success(
          'Pricing Updated',
          'Material pricing has been updated.'
        );
      },
      
      /**
       * Apply printer settings
       */
      applySettings: function() {
        // Get values from inputs
        const wallMargin = parseInt(document.getElementById('wallMargin')?.value) || this.defaults.wallMargin;
        const objectSpacing = parseInt(document.getElementById('objectSpacing')?.value) || this.defaults.objectSpacing;
        
        // Update settings
        this.updateSetting('wallMargin', wallMargin);
        this.updateSetting('objectSpacing', objectSpacing);
        
        // Update printer constants
        PrinterCalc.CONSTANTS.PRINTERS['400'].wallMargin = wallMargin;
        PrinterCalc.CONSTANTS.PRINTERS['600'].wallMargin = wallMargin;
        PrinterCalc.CONSTANTS.SPACING.OBJECT_SPACING = objectSpacing;
        
        // Notify of changes for updates
        this.notifySettingsChanged();
        
        // Show notification
        PrinterCalc.Notification.success(
          'Settings Applied',
          'Printer settings have been applied.'
        );
      },
      
      /**
       * Notify that settings have changed
       */
      notifySettingsChanged: function() {
        // Create and dispatch custom event
        const event = new CustomEvent('printercalc:settingschanged', {
          detail: { settings: this.current }
        });
        
        document.dispatchEvent(event);
      },
      
      /**
       * Get a setting value
       * @param {string} key - Setting key
       * @returns {any} Setting value
       */
      getSetting: function(key) {
        return this.current[key];
      }
    };
  })();