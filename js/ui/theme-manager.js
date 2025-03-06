/**
 * theme-manager.js - Theme Management
 * 
 * Handles light/dark theme switching.
 */

(function() {
    // Make sure the namespace exists
    window.PrinterCalc = window.PrinterCalc || {};
    
    // Create a theme manager module
    PrinterCalc.ThemeManager = {
      /**
       * Initialize theme manager
       */
      init: function() {
        // Check for saved theme
        this.loadSavedTheme();
        
        // Add theme toggle button if not present
        this.addThemeToggle();
        
        // Set up event handler for theme change
        this.setupEventHandler();
        
        // Watch for system theme changes
        this.watchSystemTheme();
      },
      
      /**
       * Load saved theme from localStorage
       */
      loadSavedTheme: function() {
        try {
          const savedTheme = localStorage.getItem('printercalc_theme');
          
          if (savedTheme) {
            // Apply saved theme
            document.documentElement.setAttribute('data-theme', savedTheme);
          } else {
            // Check for system preference
            this.applySystemTheme();
          }
        } catch (error) {
          console.error('Error loading theme setting:', error);
        }
      },
      
      /**
       * Add theme toggle button to header
       */
      addThemeToggle: function() {
        // Check if button already exists
        if (document.querySelector('.theme-toggle')) return;
        
        // Get header element
        const header = document.querySelector('header');
        if (!header) return;
        
        // Create toggle button
        const themeToggle = document.createElement('button');
        themeToggle.className = 'theme-toggle';
        themeToggle.setAttribute('title', 'Toggle Dark Mode');
        
        // Set icon based on current theme
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        themeToggle.innerHTML = `<span class="material-icon">${currentTheme === 'dark' ? 'light_mode' : 'dark_mode'}</span>`;
        
        // Add click handler
        themeToggle.addEventListener('click', () => {
          this.toggleTheme();
        });
        
        // Add to header
        header.appendChild(themeToggle);
      },
      
      /**
       * Toggle between light and dark themes
       */
      toggleTheme: function() {
        // Get current theme
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        
        // Calculate new theme
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        // Apply new theme
        document.documentElement.setAttribute('data-theme', newTheme);
        
        // Save theme setting
        try {
          localStorage.setItem('printercalc_theme', newTheme);
        } catch (error) {
          console.error('Error saving theme setting:', error);
        }
        
        // Update toggle button
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
          themeToggle.innerHTML = `<span class="material-icon">${newTheme === 'dark' ? 'light_mode' : 'dark_mode'}</span>`;
        }
        
        // Dispatch theme change event
        this.dispatchThemeChangeEvent(newTheme);
      },
      
      /**
       * Apply theme based on system preference
       */
      applySystemTheme: function() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          document.documentElement.setAttribute('data-theme', 'dark');
          
          // Update toggle button
          const themeToggle = document.querySelector('.theme-toggle');
          if (themeToggle) {
            themeToggle.innerHTML = '<span class="material-icon">light_mode</span>';
          }
        } else {
          document.documentElement.setAttribute('data-theme', 'light');
          
          // Update toggle button
          const themeToggle = document.querySelector('.theme-toggle');
          if (themeToggle) {
            themeToggle.innerHTML = '<span class="material-icon">dark_mode</span>';
          }
        }
      },
      
      /**
       * Watch for system theme changes
       */
      watchSystemTheme: function() {
        if (window.matchMedia) {
          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            // Only apply system theme if no theme is saved
            try {
              const savedTheme = localStorage.getItem('printercalc_theme');
              if (!savedTheme) {
                const newTheme = e.matches ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', newTheme);
                
                // Update toggle button
                const themeToggle = document.querySelector('.theme-toggle');
                if (themeToggle) {
                  themeToggle.innerHTML = `<span class="material-icon">${newTheme === 'dark' ? 'light_mode' : 'dark_mode'}</span>`;
                }
                
                // Dispatch theme change event
                this.dispatchThemeChangeEvent(newTheme);
              }
            } catch (error) {
              console.error('Error handling system theme change:', error);
            }
          });
        }
      },
      
      /**
       * Set up event handler for theme changes
       */
      setupEventHandler: function() {
        // Custom event listener for theme changes
        document.addEventListener('printercalc:themechanged', (e) => {
          // Handle theme change
          const theme = e.detail && e.detail.theme;
          
          if (theme) {
            document.documentElement.setAttribute('data-theme', theme);
            
            // Update toggle button
            const themeToggle = document.querySelector('.theme-toggle');
            if (themeToggle) {
              themeToggle.innerHTML = `<span class="material-icon">${theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>`;
            }
            
            // Save theme setting
            try {
              localStorage.setItem('printercalc_theme', theme);
            } catch (error) {
              console.error('Error saving theme setting:', error);
            }
          }
        });
      },
      
      /**
       * Dispatch theme change event
       * @param {string} theme - New theme value ('light' or 'dark')
       */
      dispatchThemeChangeEvent: function(theme) {
        const event = new CustomEvent('printercalc:themechanged', {
          detail: { theme }
        });
        
        document.dispatchEvent(event);
      },
      
      /**
       * Get current theme
       * @returns {string} Current theme ('light' or 'dark')
       */
      getCurrentTheme: function() {
        return document.documentElement.getAttribute('data-theme') || 'light';
      }
    };
  })();