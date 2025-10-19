# GFG Sarthi - Smart Autocomplete for GeeksforGeeks

## Overview
GFG Sarthi is a Chrome extension that provides intelligent code completion for competitive programming on GeeksforGeeks. It helps you code faster with context-aware suggestions, local variable tracking, and curated DSA snippets.

## Features

### 🚀 Smart Suggestions
Get intelligent code completions from our backend pattern database containing 1000+ competitive programming snippets, perfectly matched to your coding context.

### 📝 Local Variable Tracking
Never forget variable names! The extension automatically scans your code and tracks all variables you've declared, making them instantly available as suggestions.

### 💡 DSA Snippets
Quick access to handpicked data structures and algorithms:
- STL containers (vector, map, set, queue, stack, priority_queue)
- Common algorithms (sort, binary search, DFS, BFS patterns)
- Loop templates and control structures
- Language-specific syntax helpers

### 🎨 Theme Support
Seamlessly works with both light and dark themes, automatically adapting to match your GFG editor appearance.

### ⚡ Real-time Updates
Instant suggestions as you type with <50ms latency. WebSocket connection ensures lightning-fast response times.

### 🔌 Offline Capability
Even when backend is unavailable, local variable suggestions and static snippets continue working.

## How It Works

GFG Sarthi combines three intelligent suggestion sources:

1. **Backend Pattern Database** - Server maintains 1000+ curated competitive programming patterns, searchable by prefix with WebSocket for real-time delivery

2. **Local Variable Tracking** - Uses Trie data structure to scan your code every 2 seconds, extracting identifiers for O(m) prefix matching

3. **Static Templates** - Handpicked DSA snippets for common algorithms and data structures, optimized for competitive programming

All suggestions are merged and ranked using a priority system:
- Backend patterns (Priority: 20) - Most relevant to your query
- Local variables (Priority: 15) - From your current code
- Static templates (Priority: 7-10) - Common snippets

## Installation

### From Chrome Web Store
Coming soon! Will be available at [Chrome Web Store link]

### From Source
1. Clone this repository
   ```bash
   git clone https://github.com/Nikhil-JUIT27/gfg-sarthi.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `gfg-sarthi` folder
6. Extension is now installed!

## Usage

1. Visit any GeeksforGeeks problem page (e.g., `geeksforgeeks.org/problems/...`)
2. Start coding in the editor
3. Type at least **2 characters** to trigger suggestions
4. **Navigate** with `↑` and `↓` arrow keys
5. **Insert** suggestion with `Tab` or `Enter`
6. **Close** suggestions with `Esc`

### Connection Status
- **Green dot (●)** = Connected to backend server (full features)
- **Gray dot (○)** = Offline mode (local suggestions only)

## Supported Languages
- **C++** - Full support with STL snippets
- **Java** - Collections framework and common patterns
- **Python** - List comprehensions and built-in functions

## Tech Stack

### Frontend
- Vanilla JavaScript (ES6+)
- Chrome Extension APIs (Manifest V3)
- ACE Editor integration
- CSS3 with theme detection

### Backend Communication
- WebSocket for real-time suggestions
- Exponential backoff reconnection strategy
- Graceful degradation when offline

### Data Structures
- **Trie** - Efficient prefix matching for local variables
- **Set** - Keyword filtering
- **Map** - Frequency tracking

### Architecture
- Service Worker (background.js) - Extension lifecycle
- Content Script (content.js) - Bridge to page context
- Page Script (injector.js) - Main autocomplete engine

## Performance

- **Suggestion Latency**: <50ms
- **Code Parsing**: Every 2 seconds (non-blocking)
- **Memory Usage**: ~5MB for typical session
- **Trie Lookup**: O(m) where m = prefix length
- **Network**: WebSocket with automatic reconnection

## Privacy & Security

- ✅ Only typed prefixes sent to backend (not full code)
- ✅ No personal data collection
- ✅ No code storage or logging
- ✅ Local-only variable tracking
- ✅ Open source - verify the code yourself

Read our [Privacy Policy](PRIVACY.md)

## Architecture Deep Dive

### Why Three-Layer Architecture?

Chrome's security model isolates content scripts from page context. ACE Editor APIs are only accessible in page context, so we need:

1. **Service Worker (background.js)**
   - Handles extension lifecycle
   - Cross-tab messaging
   - Cannot access page content

2. **Content Script (content.js)**
   - Bridge between extension and page
   - Injects main script into page context
   - Limited DOM access

3. **Page Script (injector.js)**
   - Full access to ACE Editor APIs
   - Main autocomplete logic
   - Runs in page context

### Trie Data Structure

We chose Trie over simpler structures because:

| Data Structure | Lookup Time | Space | Use Case |
|---------------|-------------|-------|----------|
| Array + filter() | O(n*m) | O(n) | Small datasets |
| Hash Map | O(1) | O(n) | Exact matching |
| **Trie** | **O(m)** | **O(n*k)** | **Prefix matching** |

Where:
- n = number of variables
- m = prefix length
- k = average key length

For autocomplete with 50-100 variables, Trie gives consistent O(m) performance regardless of variable count.

### WebSocket vs REST

| Feature | WebSocket | REST |
|---------|-----------|------|
| Connection | Persistent | Per-request |
| Latency | <50ms | 100-300ms |
| Server Load | Low | High (polling) |
| Real-time | Yes | Requires polling |

## Development

### Project Structure
```
gfg-sarthi/
├── background.js      # Service worker
├── content.js         # Content script bridge
├── injector.js        # Main autocomplete engine
├── manifest.json      # Extension configuration
├── style.css          # UI styling
├── icons/            # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

### Key Configuration (injector.js)
```javascript
const CONFIG = {
    BACKEND_URL: 'wss://codehelper-backend.onrender.com/ws',
    RECONNECT_DELAY: 5000,           // 5 seconds
    CONNECTION_TIMEOUT: 45000,       // 45 seconds
    MIN_PREFIX_LENGTH: 2,            // Trigger after 2 chars
    MAX_SUGGESTIONS: 10,             // Show top 10
    PARSE_INTERVAL: 2000,            // Parse every 2 seconds
    DEBUG_MODE: false,               // Set true for logging
    MAX_RECONNECT_ATTEMPTS: 5        // Give up after 5 tries
};
```

### Testing Locally

1. Enable debug mode in `injector.js`:
   ```javascript
   DEBUG_MODE: true
   ```

2. Open Chrome DevTools (F12) on GFG problem page

3. Look for `[GFG-Sarthi]` logs in console

4. Test different scenarios:
   - Slow network (Chrome DevTools → Network → Slow 3G)
   - Offline mode (Disable network)
   - Theme switching
   - Different languages (C++, Java, Python)

## Roadmap

### Version 1.1.0 (Planned)
- [ ] Add debouncing for backend queries (reduce server load)
- [ ] Implement suggestion caching with TTL
- [ ] Add keyboard shortcut customization
- [ ] Support for more languages (JavaScript, C#)

### Version 1.2.0 (Future)
- [ ] LeetCode support
- [ ] CodeChef integration
- [ ] User preferences page
- [ ] Custom snippet creation

### Version 2.0.0 (Ideas)
- [ ] Code context analysis for smarter suggestions
- [ ] Popular snippet recommendations
- [ ] Multi-line snippet insertion
- [ ] Collaborative snippet sharing

## Known Issues

1. **Suggestion box positioning** - May clip on very small screens (<768px)
   - Workaround: Zoom out or use landscape mode
   
2. **ACE editor detection** - Takes 0.5-1s to initialize
   - This is normal - polling mechanism ensures detection

3. **Theme detection lag** - Rare cases where theme switches before CSS updates
   - Refresh page if colors look wrong

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Ways to Contribute
- 🐛 Report bugs via GitHub Issues
- 💡 Suggest features
- 🔧 Submit pull requests
- 📝 Improve documentation
- ⭐ Star the repository

## Authors

**Saurabh & Nikhil**

Built as a project to help competitive programmers code faster on GeeksforGeeks.

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- GeeksforGeeks for the amazing platform
- ACE Editor team for the editor API
- Chrome Extensions documentation
- Competitive programming community for inspiration

## Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/Nikhil-JUIT27/gfg-sarthi/issues)
- 💬 **Questions**: [GitHub Discussions](https://github.com/Nikhil-JUIT27/gfg-sarthi/discussions)
- 📧 **Email**: codemanthan05@gmail.com

## Stats

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Chrome-yellow)

---

**Happy Coding!** 🚀 If GFG Sarthi helps you solve problems faster, consider giving it a ⭐ on GitHub!