// GFG Sarthi - Main Autocomplete Engine
// Smart code completion for competitive programming on GeeksforGeeks
// Version: 1.0.0
// Authors: Saurabh & Nikhil

(function() {
    'use strict';

    // Configuration object - all tunable parameters in one place
    const CONFIG = {
        BACKEND_URL: 'wss://codehelper-backend.onrender.com/ws',
        RECONNECT_DELAY: 5000,
        CONNECTION_TIMEOUT: 45000,
        MIN_PREFIX_LENGTH: 2,
        MAX_SUGGESTIONS: 10,
        PARSE_INTERVAL: 2000,
        DEBUG_MODE: false, // Turn on for debugging
        MAX_RECONNECT_ATTEMPTS: 5
    };

    // Simple logger utility - helps with debugging
    const Logger = {
        info: (msg, ...args) => CONFIG.DEBUG_MODE && console.log(`[GFG-Sarthi] ${msg}`, ...args),
        success: (msg, ...args) => CONFIG.DEBUG_MODE && console.log(`[GFG-Sarthi] ✓ ${msg}`, ...args),
        error: (msg, ...args) => console.error(`[GFG-Sarthi] ✗ ${msg}`, ...args),
        warn: (msg, ...args) => CONFIG.DEBUG_MODE && console.warn(`[GFG-Sarthi] ⚠ ${msg}`, ...args)
    };

    // ====================================================================
    // Trie Data Structure for fast prefix matching
    // We built this to efficiently store and search variable names
    // ====================================================================
    
    class TrieNode {
        constructor() {
            this.children = {};
            this.isEndOfWord = false;
            this.frequency = 0; // Track how often this word appears
        }
    }

    class Trie {
        constructor() {
            this.root = new TrieNode();
        }
        
        // Add a word to the trie
        insert(word) {
            if (!word || word.length < 2) return;
            
            let node = this.root;
            
            // Walk through each character
            for (const char of word) {
                if (!node.children[char]) {
                    node.children[char] = new TrieNode();
                }
                node = node.children[char];
            }
            
            node.isEndOfWord = true;
            node.frequency++; // Increment usage count
        }
        
        // Find all words starting with given prefix
        findSuggestions(prefix) {
            if (!prefix) return [];
            
            let node = this.root;
            
            // Navigate to prefix node
            for (const char of prefix) {
                if (!node.children[char]) {
                    return []; // Prefix not found
                }
                node = node.children[char];
            }
            
            // Collect all words from this point
            const results = [];
            this._collectWords(node, prefix, results);
            
            // Sort by frequency (most used first)
            return results
                .sort((a, b) => b.freq - a.freq)
                .map(item => item.word);
        }
        
        // Helper: Recursively collect all words using DFS
        _collectWords(node, currentPrefix, results) {
            if (node.isEndOfWord) {
                results.push({ 
                    word: currentPrefix, 
                    freq: node.frequency 
                });
            }
            
            // Visit all children
            for (const char in node.children) {
                this._collectWords(
                    node.children[char], 
                    currentPrefix + char, 
                    results
                );
            }
        }
        
        // Clear all data
        clear() {
            this.root = new TrieNode();
        }
    }

    // ====================================================================
    // WebSocket Manager - Handles connection to backend server
    // ====================================================================
    
    class WebSocketManager {
        constructor(url, uiManager) {
            this.url = url;
            this.ws = null;
            this.connected = false;
            this.suggestions = [];
            this.reconnectAttempts = 0;
            this.maxReconnectAttempts = CONFIG.MAX_RECONNECT_ATTEMPTS;
            this.connectionTimeout = null;
            this.uiManager = uiManager;
            this.reconnectTimer = null;
            
            this.connect();
        }
        
        connect() {
            try {
                Logger.info(`Connecting to backend: ${this.url}`);
                
                // Close existing connection if any
                if (this.ws) {
                    try {
                        this.ws.close();
                    } catch (e) {
                        Logger.warn('Error closing old connection:', e);
                    }
                    this.ws = null;
                }
                
                // Clear old timeout
                if (this.connectionTimeout) {
                    clearTimeout(this.connectionTimeout);
                }
                
                // Set connection timeout
                this.connectionTimeout = setTimeout(() => {
                    if (!this.connected) {
                        Logger.error('Connection timeout - server not responding');
                        
                        if (this.ws) {
                            try {
                                this.ws.close();
                            } catch (e) {}
                        }
                        
                        this.scheduleReconnect();
                    }
                }, CONFIG.CONNECTION_TIMEOUT);
                
                // Create new WebSocket
                this.ws = new WebSocket(this.url);
                
                // Setup event handlers
                this.ws.onopen = () => {
                    clearTimeout(this.connectionTimeout);
                    this.onOpen();
                };
                
                this.ws.onclose = (event) => {
                    clearTimeout(this.connectionTimeout);
                    this.onClose(event);
                };
                
                this.ws.onerror = (error) => {
                    clearTimeout(this.connectionTimeout);
                    this.onError(error);
                };
                
                this.ws.onmessage = (event) => {
                    this.onMessage(event);
                };
                
            } catch (error) {
                Logger.error('Failed to create connection:', error);
                this.scheduleReconnect();
            }
        }
        
        onOpen() {
            this.connected = true;
            this.reconnectAttempts = 0;
            Logger.success('Connected to backend server');
            
            if (this.uiManager) {
                this.uiManager.updateConnectionStatus(true);
            }
            
            // Send initial ping
            this.sendPing();
        }
        
        onClose(event) {
            this.connected = false;
            
            Logger.warn(`Connection closed (code: ${event.code})`);
            
            if (this.uiManager) {
                this.uiManager.updateConnectionStatus(false);
            }
            
            // Reconnect unless it was a clean close
            if (event.code !== 1000) {
                this.scheduleReconnect();
            }
        }
        
        onError(error) {
            this.connected = false;
            Logger.error('WebSocket error occurred');
            
            if (this.uiManager) {
                this.uiManager.updateConnectionStatus(false);
            }
        }
        
        onMessage(event) {
            try {
                const data = JSON.parse(event.data);
                
                // Handle pong response
                if (data.type === 'pong') {
                    Logger.info('Heartbeat received');
                    return;
                }
                
                // Handle errors
                if (data.type === 'error') {
                    Logger.error('Backend error:', data.message || data.error);
                    return;
                }
                
                // Extract suggestions from various response formats
                let results = [];
                
                if (Array.isArray(data)) {
                    results = data;
                } else if (data.suggestions) {
                    results = data.suggestions;
                } else if (data.data) {
                    results = data.data;
                } else if (data.results) {
                    results = data.results;
                }
                
                // Update suggestions
                if (Array.isArray(results) && results.length > 0) {
                    this.suggestions = results;
                    Logger.success(`Got ${results.length} suggestions from backend`);
                } else {
                    this.suggestions = [];
                }
                
            } catch (error) {
                Logger.error('Failed to parse backend response:', error);
                this.suggestions = [];
            }
        }
        
        // Send search query to backend
        query(word, language) {
            if (!this.connected || !this.ws) {
                return false;
            }
            
            if (this.ws.readyState !== WebSocket.OPEN) {
                return false;
            }
            
            try {
                const payload = { 
                    type: 'search',
                    word: word, 
                    language: language,
                    timestamp: Date.now()
                };
                
                this.ws.send(JSON.stringify(payload));
                return true;
                
            } catch (error) {
                Logger.error('Failed to send query:', error);
                return false;
            }
        }
        
        // Send heartbeat ping
        sendPing() {
            if (!this.connected || !this.ws) return;
            
            try {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            } catch (error) {
                Logger.warn('Ping failed:', error);
            }
        }
        
        // Schedule reconnection with exponential backoff
        scheduleReconnect() {
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
            }
            
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                Logger.error(`Gave up after ${this.maxReconnectAttempts} attempts`);
                Logger.warn('Working with local suggestions only');
                return;
            }
            
            this.reconnectAttempts++;
            
            const delay = CONFIG.RECONNECT_DELAY * this.reconnectAttempts;
            
            Logger.info(`Reconnecting in ${delay/1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            this.reconnectTimer = setTimeout(() => {
                this.connect();
            }, delay);
        }
        
        getSuggestions() {
            return this.suggestions;
        }
        
        // Cleanup
        destroy() {
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
            }
            
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
            }
            
            if (this.ws) {
                try {
                    this.ws.close(1000, 'Extension cleanup');
                } catch (e) {}
                this.ws = null;
            }
            
            this.connected = false;
            Logger.info('WebSocket cleaned up');
        }
    }

    // ====================================================================
    // Code Parser - Extracts identifiers from code
    // ====================================================================
    
    class CodeParser {
        constructor(trie) {
            this.trie = trie;
            
            // Keywords to filter out (we don't want to suggest these)
            this.keywords = {
                cpp: new Set([
                    'int', 'float', 'double', 'char', 'void', 'bool', 'long', 'short',
                    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
                    'continue', 'return', 'class', 'struct', 'public', 'private',
                    'protected', 'namespace', 'using', 'const', 'static', 'auto',
                    'vector', 'map', 'set', 'queue', 'stack', 'string', 'pair'
                ]),
                java: new Set([
                    'int', 'float', 'double', 'char', 'void', 'boolean', 'long', 'short',
                    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
                    'continue', 'return', 'class', 'interface', 'extends', 'implements',
                    'public', 'private', 'protected', 'static', 'final', 'abstract'
                ]),
                python: new Set([
                    'if', 'else', 'elif', 'for', 'while', 'def', 'class', 'return',
                    'import', 'from', 'as', 'try', 'except', 'finally', 'with',
                    'lambda', 'pass', 'break', 'continue', 'True', 'False', 'None'
                ])
            };
        }
        
        // Parse code and populate trie with identifiers
        parse(code, language) {
            if (!code) return;
            
            this.trie.clear();
            
            // Extract all identifiers using regex
            const identifiers = code.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
            const keywords = this.keywords[language] || this.keywords.cpp;
            
            // Add non-keyword identifiers to trie
            identifiers.forEach(id => {
                // Filter out keywords, short identifiers, and numbers
                if (!keywords.has(id) && 
                    id.length >= 2 && 
                    !/^\d+$/.test(id)) {
                    
                    this.trie.insert(id);
                }
            });
        }
    }

    // ====================================================================
    // Suggestion Merger - Combines multiple suggestion sources
    // ====================================================================
    
    class SuggestionMerger {
        constructor() {
            this.snippets = this.loadSnippets();
        }
        
        // Load static code snippets for each language
        loadSnippets() {
            return {
                cpp: [
                    { t: 'vector', d: 'std::vector<T>', s: 'std::vector<int> v;', type: 'stl', priority: 9 },
                    { t: 'map', d: 'std::map<K,V>', s: 'std::map<int, int> m;', type: 'stl', priority: 8 },
                    { t: 'set', d: 'std::set<T>', s: 'std::set<int> s;', type: 'stl', priority: 8 },
                    { t: 'queue', d: 'std::queue<T>', s: 'std::queue<int> q;', type: 'stl', priority: 7 },
                    { t: 'stack', d: 'std::stack<T>', s: 'std::stack<int> st;', type: 'stl', priority: 7 },
                    { t: 'priority_queue', d: 'Max Heap', s: 'std::priority_queue<int> pq;', type: 'stl', priority: 7 },
                    { t: 'sort', d: 'Sort container', s: 'std::sort(v.begin(), v.end());', type: 'algo', priority: 9 },
                    { t: 'for', d: 'for loop', s: 'for (int i = 0; i < n; i++) {\n\t\n}', type: 'snippet', priority: 9 },
                    { t: '#include', d: '#include <bits/stdc++.h>', s: '#include <bits/stdc++.h>', type: 'include', priority: 10 }
                ],
                java: [
                    { t: 'ArrayList', d: 'ArrayList<T>', s: 'ArrayList<Integer> list = new ArrayList<>();', type: 'class', priority: 8 },
                    { t: 'HashMap', d: 'HashMap<K,V>', s: 'HashMap<Integer, Integer> map = new HashMap<>();', type: 'class', priority: 8 },
                    { t: 'Scanner', d: 'Scanner input', s: 'Scanner sc = new Scanner(System.in);', type: 'class', priority: 8 }
                ],
                python: [
                    { t: 'for', d: 'for i in range(n)', s: 'for i in range(n):\n\t', type: 'snippet', priority: 9 },
                    { t: 'def', d: 'def function()', s: 'def function_name():\n\tpass', type: 'snippet', priority: 9 }
                ]
            };
        }
        
        // Merge suggestions from all sources
        merge(prefix, backendSuggestions, localSuggestions, language) {
            const combined = [];
            const seen = new Set();
            const prefixLower = prefix.toLowerCase();
            
            // 1. Smart suggestions from backend (highest priority)
            backendSuggestions.forEach(item => {
                const text = typeof item === 'string' ? item : item.text || item.t;
                
                if (text && text.toLowerCase().startsWith(prefixLower)) {
                    if (!seen.has(text)) {
                        combined.push({
                            t: text,
                            d: text,
                            s: text,
                            type: 'smart',
                            priority: 20
                        });
                        seen.add(text);
                    }
                }
            });
            
            // 2. Local variables from code
            localSuggestions.forEach(varName => {
                if (varName !== prefix && !seen.has(varName)) {
                    combined.push({
                        t: varName,
                        d: varName,
                        s: varName,
                        type: 'local',
                        priority: 15
                    });
                    seen.add(varName);
                }
            });
            
            // 3. Static snippets
            const langSnippets = this.snippets[language] || this.snippets.cpp;
            
            langSnippets
                .filter(item => item.t.toLowerCase().startsWith(prefixLower))
                .forEach(item => {
                    if (!seen.has(item.t)) {
                        combined.push(item);
                        seen.add(item.t);
                    }
                });
            
            // Sort by priority
            const sorted = combined.sort((a, b) => {
                if (b.priority !== a.priority) {
                    return b.priority - a.priority;
                }
                return a.t.localeCompare(b.t);
            });
            
            return sorted.slice(0, CONFIG.MAX_SUGGESTIONS);
        }
    }

    // ====================================================================
    // UI Manager - Handles suggestion box and visual feedback
    // ====================================================================
    
    class UIManager {
        constructor() {
            this.suggestionBox = null;
            this.statusIndicator = null;
            this.activeIndex = 0;
            this.suggestions = [];
            
            this.init();
        }
        
        init() {
            // Create suggestion box
            this.suggestionBox = document.createElement('div');
            this.suggestionBox.id = 'gfg-autocomplete-box';
            this.suggestionBox.style.display = 'none';
            document.body.appendChild(this.suggestionBox);
            
            // Create connection status indicator
            this.statusIndicator = document.createElement('div');
            this.statusIndicator.id = 'gfg-connection-status';
            this.statusIndicator.title = 'Connection Status';
            document.body.appendChild(this.statusIndicator);
            
            Logger.success('UI components created');
        }
        
        updateConnectionStatus(isOnline) {
            if (!this.statusIndicator) return;
            
            this.statusIndicator.textContent = isOnline ? '●' : '○';
            this.statusIndicator.className = isOnline ? 'connected' : 'disconnected';
            this.statusIndicator.title = isOnline ? 'Online' : 'Offline';
        }
        
        showSuggestions(suggestions, cursorPos) {
            if (!suggestions || suggestions.length === 0) {
                this.hideSuggestions();
                return;
            }
            
            this.suggestions = suggestions;
            this.activeIndex = 0;
            
            // Clear and rebuild suggestion list
            this.suggestionBox.innerHTML = '';
            
            suggestions.forEach((suggestion, idx) => {
                const item = document.createElement('div');
                item.className = 'gfg-suggestion-item';
                
                // Type badge
                const badge = document.createElement('span');
                badge.className = `gfg-suggestion-type gfg-type-${suggestion.type || 'keyword'}`;
                badge.textContent = this.getTypeLabel(suggestion.type);
                
                // Description
                const desc = document.createElement('span');
                desc.className = 'gfg-suggestion-desc';
                desc.textContent = suggestion.d;
                
                item.appendChild(badge);
                item.appendChild(desc);
                
                // Click handler
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    this.activeIndex = idx;
                    this.selectActive();
                });
                
                this.suggestionBox.appendChild(item);
            });
            
            // Position the box
            this.positionBox(cursorPos);
            this.highlightActive();
        }
        
        getTypeLabel(type) {
            const labels = {
                'smart': 'Smart',
                'local': 'Local',
                'stl': 'STL',
                'algo': 'Algorithm',
                'keyword': 'Keyword',
                'include': 'Include',
                'class': 'Class',
                'snippet': 'Snippet'
            };
            return labels[type] || 'Keyword';
        }
        
        positionBox(cursorPos) {
            // Show temporarily to get dimensions
            this.suggestionBox.style.display = 'block';
            this.suggestionBox.style.visibility = 'hidden';
            
            const boxHeight = this.suggestionBox.offsetHeight;
            const boxWidth = this.suggestionBox.offsetWidth;
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            
            let left = cursorPos.pageX;
            let top = cursorPos.pageY + 20;
            
            // Check if there's space below, otherwise show above
            const spaceBelow = viewportHeight - (cursorPos.pageY + 20);
            const spaceAbove = cursorPos.pageY;
            
            if (spaceBelow < boxHeight && spaceAbove > spaceBelow) {
                top = cursorPos.pageY - boxHeight - 5;
            }
            
            // Keep box within viewport horizontally
            if (left + boxWidth > viewportWidth) {
                left = viewportWidth - boxWidth - 10;
            }
            
            if (left < 10) {
                left = 10;
            }
            
            // Keep box within viewport vertically
            if (top + boxHeight > viewportHeight) {
                top = viewportHeight - boxHeight - 10;
            }
            
            if (top < 10) {
                top = 10;
            }
            
            this.suggestionBox.style.left = `${left}px`;
            this.suggestionBox.style.top = `${top}px`;
            this.suggestionBox.style.visibility = 'visible';
        }
        
        hideSuggestions() {
            if (this.suggestionBox) {
                this.suggestionBox.style.display = 'none';
            }
            this.suggestions = [];
            this.activeIndex = 0;
        }
        
        moveSelection(direction) {
            if (this.suggestions.length === 0) return;
            
            if (direction === 'down') {
                this.activeIndex = (this.activeIndex + 1) % this.suggestions.length;
            } else if (direction === 'up') {
                this.activeIndex = (this.activeIndex - 1 + this.suggestions.length) % this.suggestions.length;
            }
            
            this.highlightActive();
        }
        
        highlightActive() {
            const items = this.suggestionBox.querySelectorAll('.gfg-suggestion-item');
            items.forEach((item, idx) => {
                if (idx === this.activeIndex) {
                    item.classList.add('active');
                    item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                } else {
                    item.classList.remove('active');
                }
            });
        }
        
        getActiveSuggestion() {
            return this.suggestions[this.activeIndex] || null;
        }
        
        isVisible() {
            return this.suggestionBox && this.suggestionBox.style.display === 'block';
        }
        
        selectActive() {
            const selected = this.getActiveSuggestion();
            if (selected) {
                const event = new CustomEvent('gfg-suggestion-selected', {
                    detail: { suggestion: selected }
                });
                document.dispatchEvent(event);
            }
        }
    }

    // ====================================================================
    // Main Controller - Orchestrates everything
    // ====================================================================
    
    class AutocompleteController {
        constructor() {
            this.editor = null;
            this.trie = new Trie();
            this.ui = new UIManager();
            this.wsManager = new WebSocketManager(CONFIG.BACKEND_URL, this.ui);
            this.parser = new CodeParser(this.trie);
            this.merger = new SuggestionMerger();
            
            this.currentPrefix = '';
            this.currentLang = 'cpp';
            this.parseTimer = null;
        }
        
        init(aceEditor) {
            this.editor = aceEditor;
            
            // Attach event listeners
            this.editor.renderer.textarea.addEventListener('input', () => this.onInput());
            this.editor.container.addEventListener('keydown', (e) => this.onKeyDown(e), true);
            
            // Hide suggestions on outside click
            document.addEventListener('click', (e) => {
                if (this.ui.suggestionBox && !this.ui.suggestionBox.contains(e.target)) {
                    this.ui.hideSuggestions();
                }
            });
            
            // Listen for suggestion selection
            document.addEventListener('gfg-suggestion-selected', (e) => {
                this.insertSuggestion(e.detail.suggestion);
            });
            
            // Start periodic code parsing
            this.parseTimer = setInterval(() => {
                this.parseCurrentCode();
            }, CONFIG.PARSE_INTERVAL);
            
            // Initial parse
            this.parseCurrentCode();
            
            Logger.success('Autocomplete ready!');
        }
        
        // Figure out which language we're working with
        detectLanguage() {
            try {
                const langDiv = document.querySelector('.divider.text');
                if (!langDiv) return 'cpp';
                
                const text = langDiv.textContent.toLowerCase();
                if (text.includes('c++')) return 'cpp';
                if (text.includes('java')) return 'java';
                if (text.includes('python')) return 'python';
                return 'cpp';
            } catch (err) {
                return 'cpp';
            }
        }
        
        // Parse code to extract identifiers
        parseCurrentCode() {
            if (!this.editor) return;
            
            try {
                const code = this.editor.getValue();
                const lang = this.detectLanguage();
                
                this.parser.parse(code, lang);
            } catch (err) {
                Logger.warn('Parse error:', err);
            }
        }
        
        // Handle user input
        onInput() {
            try {
                const cursor = this.editor.getCursorPosition();
                const line = this.editor.session.getLine(cursor.row);
                const textBeforeCursor = line.substring(0, cursor.column);
                
                // Extract the word being typed
                const match = textBeforeCursor.match(/([a-zA-Z0-9_#:]+)$/);
                
                if (!match || match[1].length < CONFIG.MIN_PREFIX_LENGTH) {
                    this.ui.hideSuggestions();
                    return;
                }
                
                this.currentPrefix = match[1];
                this.currentLang = this.detectLanguage();
                
                // Query backend
                this.wsManager.query(this.currentPrefix, this.currentLang);
                
                // Get suggestions from all sources
                const backendSugs = this.wsManager.getSuggestions();
                const localSugs = this.trie.findSuggestions(this.currentPrefix);
                
                // Merge everything
                const finalSugs = this.merger.merge(
                    this.currentPrefix,
                    backendSugs,
                    localSugs,
                    this.currentLang
                );
                
                // Show suggestions if we have any
                if (finalSugs.length > 0) {
                    const cursorCoords = this.editor.renderer.textToScreenCoordinates(cursor);
                    this.ui.showSuggestions(finalSugs, cursorCoords);
                } else {
                    this.ui.hideSuggestions();
                }
            } catch (err) {
                Logger.error('Input handling error:', err);
                this.ui.hideSuggestions();
            }
        }
        
        // Handle keyboard shortcuts
        onKeyDown(e) {
            // Always hide on backspace
            if (e.key === 'Backspace') {
                this.ui.hideSuggestions();
                return;
            }
            
            if (!this.ui.isVisible()) return;
            
            // Navigation and selection
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    e.stopPropagation();
                    this.ui.moveSelection('down');
                    break;
                    
                case 'ArrowUp':
                    e.preventDefault();
                    e.stopPropagation();
                    this.ui.moveSelection('up');
                    break;
                    
                case 'Enter':
                case 'Tab':
                    e.preventDefault();
                    e.stopPropagation();
                    this.ui.selectActive();
                    break;
                    
                case 'Escape':
                    e.preventDefault();
                    e.stopPropagation();
                    this.ui.hideSuggestions();
                    break;
            }
        }
        
        // Insert selected suggestion into editor
        insertSuggestion(suggestion) {
            if (!this.editor || !suggestion) return;
            
            try {
                const cursor = this.editor.getCursorPosition();
                const { Range } = ace.require("ace/range");
                
                // Create range for current word
                const range = new Range(
                    cursor.row,
                    cursor.column - this.currentPrefix.length,
                    cursor.row,
                    cursor.column
                );
                
                // Replace with suggestion
                this.editor.session.replace(range, suggestion.s);
                this.ui.hideSuggestions();
                this.editor.focus();
                
                Logger.success(`Inserted: ${suggestion.t}`);
            } catch (err) {
                Logger.error('Insert error:', err);
            }
        }
        
        // Cleanup when extension unloads
        cleanup() {
            if (this.parseTimer) {
                clearInterval(this.parseTimer);
            }
            
            if (this.wsManager) {
                this.wsManager.destroy();
            }
            
            this.ui.hideSuggestions();
            Logger.info('Cleaned up');
        }
    }

    // ====================================================================
    // Bootstrap - Wait for ACE editor and initialize
    // ====================================================================
    
    Logger.info('Starting GFG Sarthi...');
    
    let attempts = 0;
    const maxAttempts = 60;
    
    // Poll for ACE editor
    const checkForEditor = setInterval(() => {
        attempts++;
        
        const editorEl = document.querySelector('.ace_editor');
        
        if (editorEl && typeof ace !== 'undefined') {
            try {
                const aceEditor = ace.edit(editorEl);
                
                if (aceEditor && aceEditor.renderer && aceEditor.renderer.textarea) {
                    clearInterval(checkForEditor);
                    
                    // Initialize controller
                    const controller = new AutocompleteController();
                    controller.init(aceEditor);
                    
                    // Expose for debugging (optional)
                    if (CONFIG.DEBUG_MODE) {
                        window.GFG_SARTHI = controller;
                    }
                    
                    Logger.success('GFG Sarthi is ready!');
                }
            } catch (err) {
                Logger.error('Init error:', err);
            }
        }
        
        // Give up after max attempts
        if (attempts >= maxAttempts) {
            clearInterval(checkForEditor);
            Logger.error('Could not find ACE editor. Is this a GFG problem page?');
        }
    }, 500);

})();