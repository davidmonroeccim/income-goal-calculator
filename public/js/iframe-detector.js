/**
 * Iframe Detection and Context Management
 * Detects if application is running within an iframe (HighLevel integration)
 * and applies appropriate styling and behavior modifications
 * ©2025 AcquisitionPRO® - All Rights Reserved
 */

class IframeDetector {
  constructor() {
    this.isIframe = false;
    this.parentOrigin = null;
    this.iframeConfig = {
      enablePostMessage: true,
      enableResize: true,
      enableNavigation: true,
      parentWhitelist: [
        'https://app.gohighlevel.com',
        'https://app2.gohighlevel.com',
        'https://highlevel.com'
      ]
    };
    
    this.init();
  }

  /**
   * Initialize iframe detection and setup
   */
  init() {
    this.detectIframe();
    this.setupEventListeners();
    this.applyIframeMode();
    this.setupPostMessage();
    
    // Debug logging
    if (this.isIframe) {
      console.log('🖼️ Iframe mode detected', {
        parentOrigin: this.parentOrigin,
        windowSize: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      });
    }
  }

  /**
   * Detect if running within iframe
   */
  detectIframe() {
    try {
      // Primary detection method
      this.isIframe = window !== window.top;
      
      // Secondary checks
      if (!this.isIframe) {
        this.isIframe = window.frameElement !== null;
      }
      
      // Get parent origin if in iframe
      if (this.isIframe) {
        try {
          this.parentOrigin = document.referrer ? new URL(document.referrer).origin : null;
        } catch (e) {
          // Cross-origin, can't access referrer
          this.parentOrigin = 'cross-origin';
        }
      }
      
      // URL parameter override (for testing)
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('iframe') === 'true') {
        this.isIframe = true;
        this.parentOrigin = 'url-override';
      }
      
    } catch (error) {
      console.warn('Error detecting iframe context:', error);
      // Fallback to safe mode
      this.isIframe = false;
    }
  }

  /**
   * Apply iframe-specific modifications
   */
  applyIframeMode() {
    if (!this.isIframe) return;

    // Add iframe class to body
    document.body.classList.add('iframe-mode');
    
    // Load iframe-specific CSS
    this.loadIframeCSS();
    
    // Modify page title for iframe context
    this.updatePageTitle();
    
    // Hide elements not needed in iframe
    this.hideStandaloneElements();
    
    // Adjust layout for iframe constraints
    this.adjustLayoutForIframe();
    
    // Set up iframe-specific navigation
    this.setupIframeNavigation();
  }

  /**
   * Load iframe-specific CSS
   */
  loadIframeCSS() {
    const existingLink = document.querySelector('link[data-iframe-css]');
    if (existingLink) return; // Already loaded

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/iframe.css';
    link.setAttribute('data-iframe-css', 'true');
    document.head.appendChild(link);
  }

  /**
   * Update page title for iframe context
   */
  updatePageTitle() {
    const originalTitle = document.title;
    if (!originalTitle.includes('(Embedded)')) {
      document.title = `${originalTitle} (Embedded)`;
    }
  }

  /**
   * Hide elements marked as standalone-only
   */
  hideStandaloneElements() {
    const standaloneElements = document.querySelectorAll('.standalone-only');
    standaloneElements.forEach(element => {
      element.style.display = 'none';
    });
  }

  /**
   * Adjust layout for iframe constraints
   */
  adjustLayoutForIframe() {
    // Remove fixed positioning that might cause issues
    const fixedElements = document.querySelectorAll('[style*="position: fixed"]');
    fixedElements.forEach(element => {
      element.style.position = 'relative';
    });

    // Adjust viewport meta tag
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.content = 'width=device-width, initial-scale=1.0, user-scalable=no';
    }
  }

  /**
   * Setup iframe-specific navigation
   */
  setupIframeNavigation() {
    // Prevent navigation that would break iframe context
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link && link.target === '_blank') {
        e.preventDefault();
        this.postMessageToParent('navigate', { url: link.href, target: '_blank' });
      }
    });

    // Modify form submissions if needed
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (form.target === '_blank') {
        e.preventDefault();
        this.postMessageToParent('formSubmit', { 
          action: form.action,
          target: '_blank'
        });
      }
    });
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Window resize handler
    window.addEventListener('resize', this.debounce(() => {
      if (this.isIframe && this.iframeConfig.enableResize) {
        this.handleResize();
      }
    }, 250));

    // Message from parent iframe
    window.addEventListener('message', (event) => {
      this.handleParentMessage(event);
    });

    // Visibility change (iframe focus/blur)
    document.addEventListener('visibilitychange', () => {
      if (this.isIframe) {
        this.handleVisibilityChange();
      }
    });
  }

  /**
   * Handle window resize in iframe
   */
  handleResize() {
    const dimensions = {
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };

    this.postMessageToParent('resize', dimensions);
  }

  /**
   * Handle visibility change
   */
  handleVisibilityChange() {
    const isVisible = !document.hidden;
    this.postMessageToParent('visibilityChange', { visible: isVisible });
  }

  /**
   * Setup PostMessage communication with parent
   */
  setupPostMessage() {
    if (!this.isIframe || !this.iframeConfig.enablePostMessage) return;

    // Send ready message to parent
    this.postMessageToParent('ready', {
      url: window.location.href,
      title: document.title,
      userAgent: navigator.userAgent
    });
  }

  /**
   * Send message to parent window
   */
  postMessageToParent(type, data = {}) {
    if (!this.isIframe || !window.parent) return;

    // Determine target origin for security
    let targetOrigin = '*';
    if (this.parentOrigin && this.parentOrigin !== 'cross-origin' && this.parentOrigin !== 'url-override') {
      targetOrigin = this.parentOrigin;
    } else {
      // Check if parent matches whitelist
      const trustedOrigins = this.iframeConfig.parentWhitelist;
      try {
        const referrerOrigin = document.referrer ? new URL(document.referrer).origin : null;
        if (referrerOrigin && trustedOrigins.includes(referrerOrigin)) {
          targetOrigin = referrerOrigin;
        }
      } catch (e) {
        console.warn('Could not determine safe target origin for postMessage');
      }
    }

    const message = {
      type: `iframe_${type}`,
      source: 'income-goal-calculator',
      timestamp: new Date().toISOString(),
      data: data
    };

    try {
      window.parent.postMessage(message, targetOrigin);
    } catch (error) {
      console.warn('Failed to post message to parent:', error);
    }
  }

  /**
   * Handle messages from parent window
   */
  handleParentMessage(event) {
    // Verify origin if possible
    if (this.parentOrigin && this.parentOrigin !== 'cross-origin') {
      const isWhitelisted = this.iframeConfig.parentWhitelist.some(origin => 
        event.origin.includes(origin.replace('https://', ''))
      );
      
      if (!isWhitelisted && event.origin !== this.parentOrigin) {
        console.warn('Message from untrusted origin:', event.origin);
        return;
      }
    }

    const message = event.data;
    if (!message || typeof message !== 'object') return;

    switch (message.type) {
      case 'iframe_config':
        this.updateConfig(message.data);
        break;
      case 'iframe_navigate':
        this.handleNavigationRequest(message.data);
        break;
      case 'iframe_theme':
        this.handleThemeChange(message.data);
        break;
      case 'iframe_resize':
        this.handleParentResize(message.data);
        break;
      default:
        // Custom message handlers can be added here
        this.handleCustomMessage(message);
    }
  }

  /**
   * Update configuration from parent
   */
  updateConfig(config) {
    Object.assign(this.iframeConfig, config);
    console.log('📝 Updated iframe config:', this.iframeConfig);
  }

  /**
   * Handle navigation requests from parent
   */
  handleNavigationRequest(data) {
    if (data.url && this.iframeConfig.enableNavigation) {
      window.location.href = data.url;
    }
  }

  /**
   * Handle theme changes from parent
   */
  handleThemeChange(data) {
    if (data.darkMode !== undefined) {
      document.body.classList.toggle('dark-mode', data.darkMode);
    }
    
    if (data.primaryColor) {
      document.documentElement.style.setProperty('--primary-color', data.primaryColor);
    }
  }

  /**
   * Handle parent resize
   */
  handleParentResize(data) {
    // Adjust layout based on new parent size
    if (data.width && data.height) {
      this.adjustForParentSize(data.width, data.height);
    }
  }

  /**
   * Handle custom messages
   */
  handleCustomMessage(message) {
    // Emit custom event for application-specific handling
    const event = new CustomEvent('iframeMessage', { 
      detail: message 
    });
    document.dispatchEvent(event);
  }

  /**
   * Adjust layout for parent size
   */
  adjustForParentSize(width, height) {
    // Add responsive classes based on parent size
    document.body.classList.toggle('iframe-small', width < 600);
    document.body.classList.toggle('iframe-medium', width >= 600 && width < 1024);
    document.body.classList.toggle('iframe-large', width >= 1024);
  }

  /**
   * Utility: Debounce function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Public API methods
   */
  
  // Check if in iframe mode
  isInIframe() {
    return this.isIframe;
  }

  // Get parent origin
  getParentOrigin() {
    return this.parentOrigin;
  }

  // Send custom message to parent
  sendToParent(type, data) {
    this.postMessageToParent(type, data);
  }

  // Update iframe configuration
  updateIframeConfig(config) {
    Object.assign(this.iframeConfig, config);
  }

  // Force refresh iframe detection
  refresh() {
    this.init();
  }
}

// Initialize iframe detector when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.iframeDetector = new IframeDetector();
  });
} else {
  window.iframeDetector = new IframeDetector();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IframeDetector;
}