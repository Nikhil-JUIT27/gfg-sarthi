// Content Script Bridge
// This script runs in the page context and injects our main script
// We need this bridge because ACE editor APIs are only accessible in page context
// Authors: Saurabh & Nikhil

(function() {
    'use strict';
    
    console.log('[GFG Sarthi] Content script initialized');
    
    // Check if we've already injected to prevent duplicates
    if (window.GFG_SARTHI_LOADED) {
        console.log('[GFG Sarthi] Already loaded, skipping injection');
        return;
    }
    
    // Mark as loaded
    window.GFG_SARTHI_LOADED = true;
    
    // Create and inject the main script
    const mainScript = document.createElement('script');
    mainScript.src = chrome.runtime.getURL('injector.js');
    mainScript.type = 'text/javascript';
    
    // Success callback
    mainScript.onload = function() {
        console.log('[GFG Sarthi] Main script injected successfully');
        this.remove(); // Clean up script tag after loading
    };
    
    // Error callback
    mainScript.onerror = function() {
        console.error('[GFG Sarthi] Failed to inject main script');
    };
    
    // Inject into page
    (document.head || document.documentElement).appendChild(mainScript);
    
})();