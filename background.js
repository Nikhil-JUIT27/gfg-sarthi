// Service Worker for GFG Sarthi
// Handles extension lifecycle and cross-tab communication
// Authors: Saurabh & Nikhil

console.log('[GFG Sarthi] Service worker started');

// Extension installation handler
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('[GFG Sarthi] Thanks for installing! Visit any GFG problem page to get started.');
    } else if (details.reason === 'update') {
        console.log(`[GFG Sarthi] Updated from v${details.previousVersion} to v3.0.0`);
    }
});

// Message handler for content script communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[GFG Sarthi] Received message:', message.type);
    
    // Handle different message types
    switch(message.type) {
        case 'EXTENSION_LOADED':
            console.log('[GFG Sarthi] Extension active in tab:', sender.tab?.id);
            sendResponse({ 
                success: true, 
                version: '3.0.0',
                timestamp: Date.now()
            });
            break;
            
        case 'LOG_ERROR':
            console.error('[GFG Sarthi] Error in tab', sender.tab?.id, ':', message.error);
            sendResponse({ received: true });
            break;
            
        case 'LOG_INFO':
            console.log('[GFG Sarthi] Info from tab', sender.tab?.id, ':', message.info);
            sendResponse({ received: true });
            break;
            
        default:
            console.warn('[GFG Sarthi] Unknown message type:', message.type);
    }
    
    return true; // Keep channel open for async response
});

// Track when GFG problem pages load
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only log when page fully loads
    if (changeInfo.status === 'complete' && tab.url?.includes('geeksforgeeks.org/problems/')) {
        console.log(`[GFG Sarthi] Problem page detected: ${tab.url}`);
    }
});

console.log('[GFG Sarthi] Service worker ready and listening');