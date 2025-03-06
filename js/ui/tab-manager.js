/**
 * tab-manager.js - Tab Navigation
 * 
 * Handles tab switching functionality.
 */

(function() {
    // Make sure the namespace exists
    window.PrinterCalc = window.PrinterCalc || {};
    
    // Create a tab manager module
    PrinterCalc.TabManager = {
      /**
       * Initialize tab navigation
       */
      init: function() {
        // Get all tab buttons
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        // Add click handlers to tab buttons
        tabBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            if (!tabId) return;
            
            // Remove active class from all buttons and contents
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to selected button
            btn.classList.add('active');
            
            // Show selected content
            const selectedContent = document.getElementById(`${tabId}-tab`);
            if (selectedContent) {
              selectedContent.classList.add('active');
            }
          });
        });
      },
      
      /**
       * Switch to a specific tab
       * @param {string} tabId - Tab ID to switch to
       */
      switchToTab: function(tabId) {
        const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        if (tabBtn) {
          tabBtn.click();
        }
      },
      
      /**
       * Get the currently active tab ID
       * @returns {string} Active tab ID
       */
      getActiveTabId: function() {
        const activeBtn = document.querySelector('.tab-btn.active');
        return activeBtn ? activeBtn.getAttribute('data-tab') : null;
      }
    };
  })();