/**
 * notification.js - Notification System
 * 
 * Provides user notifications for important events and errors.
 */

(function() {
    // Make sure the namespace exists
    window.PrinterCalc = window.PrinterCalc || {};
    
    // Create a notification manager
    PrinterCalc.Notification = {
      /**
       * Show a notification
       * @param {string} title - Notification title
       * @param {string} message - Notification message
       * @param {string} type - "success", "error", "warning", "info"
       * @param {number} duration - Duration in milliseconds
       */
      show: function(title, message, type = 'info', duration = 5000) {
        // Find or create container
        let container = document.getElementById('notification-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'notification-container';
          container.className = 'notification-container';
          document.body.appendChild(container);
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Create icon based on type
        let iconName;
        switch (type) {
          case 'success':
            iconName = 'check_circle';
            break;
          case 'error':
            iconName = 'error';
            break;
          case 'warning':
            iconName = 'warning';
            break;
          default:
            iconName = 'info';
        }
        
        // Set notification content
        notification.innerHTML = `
          <div class="notification-icon">
            <span class="material-icon">${iconName}</span>
          </div>
          <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
          </div>
          <button class="notification-close">
            <span class="material-icon">close</span>
          </button>
          <div class="notification-progress"></div>
        `;
        
        // Add to container
        container.appendChild(notification);
        
        // Progress animation
        const progress = notification.querySelector('.notification-progress');
        progress.style.transition = `width ${duration}ms linear`;
        
        // Use a small delay to ensure the notification is in the DOM
        setTimeout(() => {
          notification.classList.add('show');
          
          // Start progress animation
          setTimeout(() => {
            progress.style.width = '0%';
          }, 10);
        }, 10);
        
        // Set up close button
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
          this.close(notification);
        });
        
        // Auto close after duration
        const autoCloseTimeout = setTimeout(() => {
          this.close(notification);
        }, duration);
        
        // Store timeout ID to cancel if manually closed
        notification.dataset.timeoutId = autoCloseTimeout;
        
        return notification;
      },
      
      /**
       * Close a notification
       * @param {HTMLElement} notification - Notification element to close
       */
      close: function(notification) {
        // Skip if already closing
        if (notification.classList.contains('closing')) return;
        
        // Mark as closing to prevent duplicate calls
        notification.classList.add('closing');
        
        // Clear auto-close timeout
        if (notification.dataset.timeoutId) {
          clearTimeout(parseInt(notification.dataset.timeoutId));
        }
        
        // Hide notification
        notification.classList.remove('show');
        
        // Remove after animation completes
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      },
      
      /**
       * Show a success notification
       * @param {string} title - Notification title
       * @param {string} message - Notification message
       * @param {number} duration - Duration in milliseconds
       */
      success: function(title, message, duration = 5000) {
        return this.show(title, message, 'success', duration);
      },
      
      /**
       * Show an error notification
       * @param {string} title - Notification title
       * @param {string} message - Notification message
       * @param {number} duration - Duration in milliseconds
       */
      error: function(title, message, duration = 7000) {
        return this.show(title, message, 'error', duration);
      },
      
      /**
       * Show a warning notification
       * @param {string} title - Notification title
       * @param {string} message - Notification message
       * @param {number} duration - Duration in milliseconds
       */
      warning: function(title, message, duration = 6000) {
        return this.show(title, message, 'warning', duration);
      },
      
      /**
       * Show an info notification
       * @param {string} title - Notification title
       * @param {string} message - Notification message
       * @param {number} duration - Duration in milliseconds
       */
      info: function(title, message, duration = 5000) {
        return this.show(title, message, 'info', duration);
      }
    };
  })();