# Optimized Userscripts

This directory contains optimized versions of userscripts with improved performance, reduced resource usage, and enhanced functionality.

## Available Optimized Scripts

### 1. YouTube Ultimate Optimizer (Optimized)
- **File**: `youtube-optimized.js`
- **Purpose**: YouTube performance optimization with CPU taming, GPU optimization, resource lock removal, and ad blocking
- **Key Improvements**:
  - Reduced CPU usage through better timer management
  - Optimized event throttling with RAF-based queuing
  - Improved memory management for IndexedDB
  - More efficient thumbnail loading
  - Better idle detection for performance savings

### 2. ChatGPT/Gemini/Claude Complete Optimization (Optimized)
- **File**: `LLM-optimizer-optimized.js`
- **Purpose**: Width adjustment, DOM cleanup, auto-continue, and initial load optimization for LLM websites
- **Key Improvements**:
  - More efficient DOM element selection and manipulation
  - Throttled cleanup operations to reduce CPU usage
  - Better caching of DOM queries
  - Optimized auto-continue logic with prevention of overlapping executions

### 3. Web Pro Enhanced (Optimized)
- **File**: `tweak-optimized.js`
- **Purpose**: General web performance optimizer with various enhancements
- **Key Improvements**:
  - More efficient resource caching with reduced memory footprint
  - Optimized lazy loading with better batch processing
  - Improved script deferral with more comprehensive blocking patterns
  - Better throttling and debouncing of expensive operations
  - Reduced cache size limits for better memory management

## Performance Improvements

The optimized scripts include several key performance enhancements:

- **Throttling**: Expensive operations are throttled to prevent excessive resource usage
- **Debouncing**: Similar operations are batched to reduce execution frequency
- **Efficient DOM queries**: Caching and optimized selectors reduce DOM traversal
- **Memory management**: Better cleanup and reduced memory footprint
- **Reduced network requests**: More efficient caching and prefetching
- **Optimized event handling**: Better event throttling and reduced listener overhead

## Usage

To use the optimized scripts, simply install them as regular userscripts in your browser extension (Tampermonkey, Greasemonkey, etc.). They can be used alongside the original scripts or as replacements.

## Configuration

Most scripts maintain the same configuration options as the original versions, with some performance-related defaults changed for better out-of-box performance. Configuration can typically be adjusted by modifying the `cfg` object in each script.