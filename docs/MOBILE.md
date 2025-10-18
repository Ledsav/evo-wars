# 📱 Mobile Support Guide

## Overview

Evo Wars is fully optimized for mobile devices with touch gestures, responsive design, and performance optimizations.

## Device Support

### ✅ Tested Devices
- **iOS**: iPhone 12+, iPad Pro, iPad Air
- **Android**: Samsung Galaxy S20+, Pixel 6+, OnePlus 9+
- **Tablets**: iPad (7th gen+), Android tablets 10"+

### 📱 Screen Sizes
- **Portrait**: 320px - 768px width
- **Landscape**: 568px - 1024px width
- **Tablets**: 768px+ width

## Touch Gestures

### Simulation Canvas

| Gesture | Action | Description |
|---------|--------|-------------|
| 🤏 **Pinch** | Zoom In/Out | Two-finger pinch to zoom (1x - 5x) |
| 👆 **Drag** | Pan View | Single-finger drag to move around |
| 👆👆 **Double Tap** | Reset View | Reset zoom and pan to default |

### UI Navigation

| Action | Description |
|--------|-------------|
| **Tap** | Select organism or species |
| **Tap Tab** | Switch between Controls/Environment/Statistics/Genealogy |
| **Tap Button** | Execute actions (play/pause, restart, etc.) |
| **Scroll** | Navigate lists and charts |

## Responsive Layout

### Portrait Mode (≤ 768px width)

```
┌─────────────────┐
│   Controls Bar  │ ← Compact, essential buttons only
├─────────────────┤
│                 │
│   Simulation    │ ← 50% of screen height
│     Canvas      │
│                 │
├─────────────────┤
│   Tab Bar       │ ← Horizontal scroll if needed
├─────────────────┤
│                 │
│   Tab Content   │ ← 50% of screen height
│   (Scrollable)  │
│                 │
└─────────────────┘
```

### Landscape Mode (768px+ width)

```
┌──────────────────────────────────────┐
│          Controls Bar                │
├────────────────────┬─────────────────┤
│                    │   Tab Bar       │
│   Simulation       ├─────────────────┤
│     Canvas         │                 │
│                    │   Tab Content   │
│                    │                 │
└────────────────────┴─────────────────┘
```

### Very Small Screens (≤ 480px width)

- Statistics in control bar are hidden
- Zoom/speed controls are hidden (use defaults)
- Full-screen popups take entire viewport
- Simplified single-column layouts

## Performance Optimizations

### Automatic Adjustments

Mobile devices automatically receive:

| Setting | Desktop | Mobile | Very Small (<480px) |
|---------|---------|--------|---------------------|
| **World Size** | 2560 × 1440 | 1280 × 720 | 800 × 600 |
| **Population** | 100 | 50 | 50 |
| **Food Count** | 800 | 400 | 200 |
| **Food Spawn Rate** | 0.5 | 0.3 | 0.3 |
| **Update Batch** | 50 | 30 | 30 |

### Rendering Optimizations

- **Frustum Culling**: Only renders visible organisms/food
- **Spatial Hashing**: Fast collision detection
- **Object Pooling**: Reuses food particle objects
- **Staggered Updates**: Updates AI in batches

### Frame Rate Targets

- **Desktop**: 60 FPS
- **High-end Mobile**: 60 FPS
- **Mid-range Mobile**: 45-60 FPS
- **Budget Mobile**: 30-45 FPS

## Touch-Friendly UI

### Button Sizes

All interactive elements meet accessibility standards:

- **Minimum Touch Target**: 44px × 44px
- **Control Buttons**: 44px height
- **Tab Buttons**: 44px height
- **List Items**: 44px height minimum

### Visual Feedback

- **Tap Highlight**: Disabled for app-like feel
- **Hover States**: Converted to active states on touch
- **Focus Indicators**: Clear visual states
- **Loading States**: Show during long operations

## Browser Support

### Recommended Browsers

| Browser | iOS | Android | Notes |
|---------|-----|---------|-------|
| **Safari** | ✅ 14+ | N/A | Best on iOS |
| **Chrome** | ✅ Latest | ✅ 90+ | Recommended |
| **Firefox** | ✅ Latest | ✅ Latest | Good support |
| **Edge** | ✅ Latest | ✅ Latest | Good support |
| **Samsung Internet** | N/A | ✅ 14+ | Native on Samsung |

### Required Features

- **Canvas API**: For rendering simulation
- **Touch Events**: For gesture support
- **Web Storage**: For settings persistence
- **ES6+**: Modern JavaScript features

## PWA Features (Future)

The app is PWA-ready with:

- ✅ Viewport meta tags configured
- ✅ Mobile-optimized styling
- ✅ Touch-action controls
- ✅ Theme colors defined
- 🔄 Service Worker (coming soon)
- 🔄 Offline support (coming soon)
- 🔄 Add to Home Screen (coming soon)

## Known Limitations

### iOS Safari

- **Viewport Height**: Uses `100dvh` for dynamic viewport
- **Rubber Banding**: Disabled to prevent scroll bounce
- **Status Bar**: Translucent on iPhone X+

### Android Chrome

- **Address Bar**: Auto-hides on scroll
- **Pull-to-Refresh**: Disabled on canvas
- **Notification Bar**: May cover top controls

### General Mobile

- **Memory**: Limited to ~2GB on some devices
- **Battery**: Simulation is CPU-intensive
- **Heat**: May cause device warming during extended use

## Troubleshooting

### Performance Issues

**Problem**: Simulation is laggy or choppy

**Solutions**:
1. Close other browser tabs
2. Reduce simulation speed (0.5x or 0.25x)
3. Restart simulation with fewer organisms
4. Close other apps to free memory
5. Enable battery saver mode may reduce performance

### Touch Gestures Not Working

**Problem**: Pinch zoom or pan doesn't work

**Solutions**:
1. Ensure you're touching the canvas area
2. Try refreshing the page
3. Check browser supports touch events
4. Update browser to latest version

### Layout Issues

**Problem**: UI elements overlap or don't fit

**Solutions**:
1. Rotate device (try landscape/portrait)
2. Refresh page to reset layout
3. Clear browser cache
4. Update browser to latest version

### Canvas Not Visible

**Problem**: Black screen or blank canvas

**Solutions**:
1. Check browser console for errors
2. Ensure Canvas API is supported
3. Try different browser
4. Refresh page

## Tips for Best Experience

### Battery Life

- Use slower simulation speeds (0.5x - 1x)
- Pause simulation when not actively watching
- Reduce screen brightness
- Close simulation when finished

### Performance

- Start with default settings
- Avoid running at maximum speed (4x) on mobile
- Close other apps and browser tabs
- Keep device cool for best performance

### Usability

- Use landscape mode for more screen space
- Two-finger gestures work best for zoom
- Double-tap to quickly reset view
- Enable full-screen mode if supported

## Development Notes

### Testing Mobile

```powershell
# Test mobile responsive design in browser
1. Open Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select device (iPhone, iPad, etc.)
4. Test touch events and layout
```

### Mobile Detection

The app uses `src/utils/mobileDetect.js` to:

- Detect mobile devices (user agent + screen size)
- Adjust world size based on device
- Optimize population and food counts
- Apply performance settings automatically

### Debugging Touch Events

```javascript
// Add to SimulationCanvas.jsx for debugging
handleTouchStart: (e) => {
  console.log('Touch Start:', e.touches.length, 'fingers');
}
```

## Future Enhancements

### Planned Features

- [ ] Gesture customization settings
- [ ] Performance mode toggle
- [ ] Battery saver mode
- [ ] Haptic feedback on iOS
- [ ] Split-screen support on tablets
- [ ] Landscape-only mode option

### Potential Optimizations

- [ ] WebGL rendering for better performance
- [ ] Web Workers for AI calculations
- [ ] IndexedDB for larger data storage
- [ ] Progressive image loading
- [ ] Adaptive quality based on frame rate

## Feedback

Experiencing mobile issues? Please report:

- Device model and OS version
- Browser name and version
- Screen size and orientation
- Specific issue or error message
- Steps to reproduce

## Credits

Mobile optimization by the Evo Wars team.
Touch gesture implementation inspired by modern mobile web standards.
