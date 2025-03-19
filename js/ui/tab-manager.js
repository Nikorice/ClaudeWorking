/**
 * tab-manager.js - Tab Navigation
 * 
 * Handles tab switching functionality.
 */

(function () {
  // Make sure the namespace exists
  window.PrinterCalc = window.PrinterCalc || {};

  // Create a tab manager module
  PrinterCalc.TabManager = {
    /**
     * Initialize tab navigation
     */
    /**
* Initialize tab navigation with enhanced desktop features
*/
    init: function () {
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

          // Show selected content with slight delay for animation
          const selectedContent = document.getElementById(`${tabId}-tab`);
          if (selectedContent) {
            // Force a reflow to ensure animation plays
            selectedContent.offsetWidth;
            selectedContent.classList.add('active');
          }

          // Save active tab to local storage
          try {
            localStorage.setItem('printercalc_active_tab', tabId);
          } catch (error) {
            console.error('Error saving active tab:', error);
          }
        });
      });

      // Restore active tab from local storage
      try {
        const savedTab = localStorage.getItem('printercalc_active_tab');
        if (savedTab) {
          const savedTabBtn = document.querySelector(`.tab-btn[data-tab="${savedTab}"]`);
          if (savedTabBtn) {
            savedTabBtn.click();
          }
        }
      } catch (error) {
        console.error('Error restoring active tab:', error);
      }

      // Set up keyboard shortcuts for tabs
      document.addEventListener('keydown', (e) => {
        // Only trigger if not in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
          return;
        }

        // Ctrl+1, Ctrl+2, etc. for tab navigation
        if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
          const index = parseInt(e.key) - 1;
          if (index < tabBtns.length) {
            tabBtns[index].click();
            e.preventDefault();
          }
        }
      });
    },

    /**
     * Switch to a specific tab
     * @param {string} tabId - Tab ID to switch to
     */
    switchToTab: function (tabId) {
      const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
      if (tabBtn) {
        // Clean up any 3D visualizations before switching tabs
        if (PrinterCalc.STLManager) {
          // Clear any existing canvas elements
          const visualizers = document.querySelectorAll('.packing-visualizer');
          visualizers.forEach(vis => {
            vis.innerHTML = '';
          });
        }

        tabBtn.click();
      }
    },

    /**
     * Get the currently active tab ID
     * @returns {string} Active tab ID
     */
    getActiveTabId: function () {
      const activeBtn = document.querySelector('.tab-btn.active');
      return activeBtn ? activeBtn.getAttribute('data-tab') : null;
    }
  };
})();