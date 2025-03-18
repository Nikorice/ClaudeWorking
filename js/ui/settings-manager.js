(function () {
  // Ensure namespace exists and is accessible
  if (typeof window.PrinterCalc === 'undefined') {
    window.PrinterCalc = {};
    console.log("Created PrinterCalc namespace in SettingsManager");
  }

  // Make sure we have default constants if needed
  if (!window.PrinterCalc.CONSTANTS) {
    console.warn("CONSTANTS not available, creating minimal version for SettingsManager");
    window.PrinterCalc.CONSTANTS = {
      PRICING: {
        USD: { powder: 100.00, binder: 0.09, silica: 0.072, glaze: 0.01 },
        EUR: { powder: 92.86, binder: 0.085, silica: 0.069, glaze: 0.0098 },
        JPY: { powder: 14285.71, binder: 12.50, silica: 11.00, glaze: 1.56 },
        SGD: { powder: 135.00, binder: 0.12, silica: 0.10, glaze: 0.0137 }
      },
      CURRENCY_SYMBOLS: {
        USD: '$', EUR: '€', JPY: '¥', SGD: 'S$'
      },
      SPACING: {
        OBJECT_SPACING: 15,    // Default XY spacing (horizontal)
        VERTICAL_SPACING: 10   // Default Z spacing (vertical)
      }
    };
  }

  // Create a settings manager module
  window.PrinterCalc.SettingsManager = {
    // Default settings
    settings: {
      currency: 'USD',
      wallMargin: 10,
      objectSpacing: 15,      // XY spacing (horizontal)
      verticalSpacing: 10     // Z spacing (vertical)
    },

    /**
     * Initialize settings manager
     */
    init: function() {
      // Load settings from localStorage if available
      this.loadSettings();
      
      // Set up event listeners for settings UI
      this.setupEventListeners();
      
      // Check if we need to add the vertical spacing input
      this.checkAndAddVerticalSpacingInput();
      
      console.log("SettingsManager initialized with settings:", this.settings);
    },
    
    /**
     * Check if vertical spacing input exists, add if not
     */
    checkAndAddVerticalSpacingInput: function() {
      // Check if vertical spacing input exists
      if (document.getElementById('verticalSpacing')) {
        return; // Already exists
      }
      
      // Get object spacing input to find the right place to add the new input
      const objectSpacingInput = document.getElementById('objectSpacing');
      if (!objectSpacingInput) {
        return; // Can't find the reference element
      }
      
      // Get the parent form group
      const formGroup = objectSpacingInput.closest('.form-group');
      if (!formGroup) {
        return;
      }
      
      // Create the new form group for vertical spacing
      const newFormGroup = document.createElement('div');
      newFormGroup.className = 'form-group';
      newFormGroup.innerHTML = `
        <label for="verticalSpacing">Vertical Spacing (mm)</label>
        <input type="number" id="verticalSpacing" value="${this.settings.verticalSpacing}" min="0" max="50">
      `;
      
      // Insert the new form group after the object spacing one
      formGroup.parentNode.insertBefore(newFormGroup, formGroup.nextSibling);
      
      // Add event listener for the new input
      const verticalSpacingInput = document.getElementById('verticalSpacing');
      if (verticalSpacingInput) {
        verticalSpacingInput.addEventListener('input', () => {
          // Just validate the input - the value will be applied when the user clicks "Apply Settings"
          const value = parseFloat(verticalSpacingInput.value);
          if (isNaN(value) || value < 0 || value > 50) {
            verticalSpacingInput.classList.add('invalid');
          } else {
            verticalSpacingInput.classList.remove('invalid');
          }
        });
      }
    },
    
    /**
     * Load settings from localStorage
     */
    loadSettings: function() {
      try {
        const savedSettings = localStorage.getItem('printercalc_settings');
        
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings);
          
          // Merge saved settings with defaults
          this.settings = { ...this.settings, ...parsedSettings };
        }
        
        // Ensure vertical spacing is initialized
        if (this.settings.verticalSpacing === undefined) {
          this.settings.verticalSpacing = 10; // Default value
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
      
      // Update UI to reflect loaded settings
      this.updateUI();
    },
    
    /**
     * Save settings to localStorage
     */
    saveSettings: function() {
      try {
        localStorage.setItem('printercalc_settings', JSON.stringify(this.settings));
      } catch (error) {
        console.error('Error saving settings:', error);
      }
    },
    
    /**
     * Get a setting value
     * @param {string} key - Setting key
     * @param {*} defaultValue - Default value if setting not found
     * @returns {*} Setting value
     */
    getSetting: function(key, defaultValue) {
      return this.settings[key] !== undefined ? this.settings[key] : defaultValue;
    },
    
    /**
     * Set a setting value
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     */
    setSetting: function(key, value) {
      this.settings[key] = value;
      this.saveSettings();
      
      // Dispatch event to notify of setting change
      this.dispatchSettingChangeEvent(key, value);
    },
    
    /**
     * Update UI to reflect current settings
     */
    updateUI: function() {
      // Update currency selector
      const currencySelect = document.getElementById('currency');
      if (currencySelect) {
        currencySelect.value = this.settings.currency || 'USD';
      }
      
      // Update margin input
      const wallMarginInput = document.getElementById('wallMargin');
      if (wallMarginInput) {
        wallMarginInput.value = this.settings.wallMargin || 10;
      }
      
      // Update horizontal spacing input
      const objectSpacingInput = document.getElementById('objectSpacing');
      if (objectSpacingInput) {
        objectSpacingInput.value = this.settings.objectSpacing || 15;
      }
      
      // Update vertical spacing input
      const verticalSpacingInput = document.getElementById('verticalSpacing');
      if (verticalSpacingInput) {
        verticalSpacingInput.value = this.settings.verticalSpacing || 10;
      }
      
      // Update pricing inputs
      this.updatePricingUI();
    },
    
    /**
     * Update pricing UI
     */
    updatePricingUI: function() {
      const currency = this.settings.currency || 'USD';
      
      // Check if CONSTANTS and pricing are available
      if (!PrinterCalc.CONSTANTS || !PrinterCalc.CONSTANTS.PRICING) {
        console.warn('Pricing constants not available for UI update');
        return;
      }
      
      const pricing = PrinterCalc.CONSTANTS.PRICING[currency];
      if (!pricing) {
        console.warn(`No pricing data for currency: ${currency}`);
        return;
      }
      
      // Update pricing inputs
      const pricePowderInput = document.getElementById('pricePowder');
      if (pricePowderInput) {
        pricePowderInput.value = pricing.powder;
      }
      
      const priceBinderInput = document.getElementById('priceBinder');
      if (priceBinderInput) {
        priceBinderInput.value = pricing.binder;
      }
      
      const priceSilicaInput = document.getElementById('priceSilica');
      if (priceSilicaInput) {
        priceSilicaInput.value = pricing.silica;
      }
      
      const priceGlazeInput = document.getElementById('priceGlaze');
      if (priceGlazeInput) {
        priceGlazeInput.value = pricing.glaze;
      }
      
      // Update currency displays
      const currencyElements = document.querySelectorAll('[id$="-currency"]');
      const symbol = PrinterCalc.CONSTANTS.CURRENCY_SYMBOLS[currency];
      
      currencyElements.forEach(el => {
        el.textContent = currency;
      });
    },
    
    /**
     * Set up event listeners for settings UI
     */
    setupEventListeners: function() {
      // Currency selector change
      const currencySelect = document.getElementById('currency');
      if (currencySelect) {
        currencySelect.addEventListener('change', () => {
          this.setSetting('currency', currencySelect.value);
          this.updatePricingUI();
        });
      }
      
      // Apply settings button
      const updateSettingsBtn = document.getElementById('updateSettings');
      if (updateSettingsBtn) {
        updateSettingsBtn.addEventListener('click', () => {
          this.applySettings();
        });
      }
      
      // Update pricing button
      const updatePricingBtn = document.getElementById('updatePricing');
      if (updatePricingBtn) {
        updatePricingBtn.addEventListener('click', () => {
          this.updatePricing();
        });
      }
      
      // Save settings button
      const saveSettingsBtn = document.getElementById('saveSettings');
      if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
          this.saveSettings();
          if (PrinterCalc.Notification && typeof PrinterCalc.Notification.success === 'function') {
            PrinterCalc.Notification.success(
              'Settings Saved',
              'Your settings have been saved.'
            );
          }
        });
      }
      
      // Advanced toggle
      const advancedToggle = document.querySelector('.advanced-toggle');
      if (advancedToggle) {
        advancedToggle.addEventListener('click', () => {
          const advancedSettings = document.querySelector('.advanced-settings');
          if (advancedSettings) {
            advancedSettings.classList.toggle('open');
            advancedToggle.classList.toggle('open');
          }
        });
      }
    },
    
    /**
     * Apply settings from UI
     */
    applySettings: function() {
      // Get values from inputs
      const wallMarginInput = document.getElementById('wallMargin');
      const objectSpacingInput = document.getElementById('objectSpacing');
      const verticalSpacingInput = document.getElementById('verticalSpacing');
      
      if (wallMarginInput) {
        this.setSetting('wallMargin', parseFloat(wallMarginInput.value) || 10);
      }
      
      if (objectSpacingInput) {
        this.setSetting('objectSpacing', parseFloat(objectSpacingInput.value) || 15);
      }
      
      if (verticalSpacingInput) {
        this.setSetting('verticalSpacing', parseFloat(verticalSpacingInput.value) || 10);
      }
      
      // Update printer constants
      if (PrinterCalc.CONSTANTS && PrinterCalc.CONSTANTS.PRINTERS) {
        const wallMargin = this.settings.wallMargin || 10;
        
        // Update wall margin for each printer
        Object.keys(PrinterCalc.CONSTANTS.PRINTERS).forEach(key => {
          PrinterCalc.CONSTANTS.PRINTERS[key].wallMargin = wallMargin;
        });
        
        // Update spacing constants
        if (PrinterCalc.CONSTANTS.SPACING) {
          PrinterCalc.CONSTANTS.SPACING.OBJECT_SPACING = this.settings.objectSpacing || 15;
          PrinterCalc.CONSTANTS.SPACING.VERTICAL_SPACING = this.settings.verticalSpacing || 10;
        }
      }
      
      // Notify of settings change
      this.dispatchSettingsChangedEvent();
      
      if (PrinterCalc.Notification && typeof PrinterCalc.Notification.success === 'function') {
        PrinterCalc.Notification.success(
          'Settings Applied',
          'Your settings have been applied.'
        );
      }
    },
    
    /**
     * Update pricing from UI
     */
    updatePricing: function() {
      const currency = this.settings.currency || 'USD';
      
      // Get values from inputs
      const pricePowderInput = document.getElementById('pricePowder');
      const priceBinderInput = document.getElementById('priceBinder');
      const priceSilicaInput = document.getElementById('priceSilica');
      const priceGlazeInput = document.getElementById('priceGlaze');
      
      // Update pricing constants
      if (PrinterCalc.CONSTANTS && PrinterCalc.CONSTANTS.PRICING) {
        if (pricePowderInput) {
          PrinterCalc.CONSTANTS.PRICING[currency].powder = parseFloat(pricePowderInput.value) || PrinterCalc.CONSTANTS.PRICING.USD.powder;
        }
        
        if (priceBinderInput) {
          PrinterCalc.CONSTANTS.PRICING[currency].binder = parseFloat(priceBinderInput.value) || PrinterCalc.CONSTANTS.PRICING.USD.binder;
        }
        
        if (priceSilicaInput) {
          PrinterCalc.CONSTANTS.PRICING[currency].silica = parseFloat(priceSilicaInput.value) || PrinterCalc.CONSTANTS.PRICING.USD.silica;
        }
        
        if (priceGlazeInput) {
          PrinterCalc.CONSTANTS.PRICING[currency].glaze = parseFloat(priceGlazeInput.value) || PrinterCalc.CONSTANTS.PRICING.USD.glaze;
        }
      }
      
      // Notify of settings change
      this.dispatchSettingsChangedEvent();
      
      if (PrinterCalc.Notification && typeof PrinterCalc.Notification.success === 'function') {
        PrinterCalc.Notification.success(
          'Pricing Updated',
          'Your pricing settings have been updated.'
        );
      }
    },
    
    /**
     * Dispatch settings changed event
     */
    dispatchSettingsChangedEvent: function() {
      const event = new CustomEvent('printercalc:settingschanged', {
        detail: { settings: this.settings }
      });
      
      document.dispatchEvent(event);
    },
    
    /**
     * Dispatch setting change event
     * @param {string} key - Setting key
     * @param {*} value - New value
     */
    dispatchSettingChangeEvent: function(key, value) {
      const event = new CustomEvent('printercalc:settingchanged', {
        detail: { key, value }
      });
      
      document.dispatchEvent(event);
    }
  };
})();