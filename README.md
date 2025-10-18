# 🧬 Evo Wars - Evolution Simulation

An interactive evolution simulation where organisms evolve through natural selection, developing unique traits, forming species, and competing for survival.

## ✨ Features

- 🧬 **Genetic System** - DNA sequences, genes, and protein expression
- 🌳 **Species Evolution** - Dynamic speciation with genealogy tracking
- 📊 **Trait Analysis** - Interactive radar charts and comparisons
- 🎮 **Real-time Simulation** - Watch evolution happen in real-time
- 📸 **Screenshot System** - Capture any view with flash effects
- 🌲 **Family Trees** - Visualize evolutionary relationships
- 🎨 **Modern UI** - Dark theme with smooth animations
- 📱 **Mobile Optimized** - Touch gestures, responsive design, performance-tuned

## 🌐 Live Demo

**🚀 [Play Live Demo](https://Ledsav.github.io/evo-wars/)**

## 🎮 Quick Start

### Development

```powershell
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173`

### Production Build

```powershell
# Build for production
npm run build

# Preview production build
npm run preview
```

## 🚀 Deployment

This project is configured for automatic deployment to GitHub Pages.

### Automatic Deployment (Recommended)

1. **Push your code:**
   ```powershell
   git push origin master
   ```

2. **Enable GitHub Pages:**
   - Go to Repository **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions**
   
3. **Done!** Your site deploys automatically on every push.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## 📁 Project Structure

```
evo-wars/
├── src/
│   ├── components/       # React components
│   │   ├── CreatureViewer/
│   │   ├── FamilyTree/
│   │   ├── Statistics/
│   │   └── ...
│   ├── core/            # Genetics & organism systems
│   ├── engine/          # Game engine & performance
│   ├── simulation/      # AI, species, world logic
│   └── rendering/       # Canvas rendering
├── docs/               # Documentation
└── public/            # Static assets
```

## 🎯 How It Works

1. **Initial Population** - Organisms spawn with random genetic variations
2. **Natural Selection** - Organisms compete for food and reproduction
3. **Mutation & Evolution** - DNA mutates, creating new traits
4. **Speciation** - Genetic divergence leads to new species
5. **Genealogy** - Family trees track evolutionary relationships

## 🛠️ Tech Stack

- **React 19** - UI framework
- **Vite** - Build tool & dev server
- **Canvas API** - High-performance rendering
- **GitHub Pages** - Deployment

## 📖 Documentation

- [Species System](./docs/SPECIES_SYSTEM.md) - How species form and evolve
- [Trait System](./docs/TRAIT_SYSTEM.md) - Genetic traits and phenotypes
- [Deployment Guide](./DEPLOYMENT.md) - Complete deployment instructions
- [Mobile Support](./MOBILE.md) - Mobile optimization and touch gestures

## 🎮 Controls

### Desktop
- **Pause/Play** - Control simulation speed
- **Zoom** - Mouse wheel or trackpad to zoom in/out
- **Pan** - Click and drag to move around
- **Speed** - Change simulation speed (0.25x - 4x)
- **Environment** - Modify food, temperature, and conditions
- **Screenshots** - Capture any view with camera buttons

### Mobile 📱
- **Pinch to Zoom** - Two-finger pinch gesture
- **Pan** - Single finger drag to move around
- **Tap** - Select organisms and interact with UI
- **Portrait/Landscape** - Responsive layout adapts
- **Touch-Optimized** - 44px minimum touch targets

## 🧪 Features in Detail

### Genetic System
- DNA sequences with codons
- Gene expression to proteins
- Mutation system (point, insertion, deletion)
- Protein folding affects traits

### Species Evolution
- Dynamic species formation
- Color-coded identification
- Emoji + procedural names
- Extinction tracking

### Visualization
- Real-time simulation canvas
- Radar charts for trait comparison
- Interactive family trees
- Population statistics

### Mobile Support 📱
- **Touch Gestures**
  - Pinch-to-zoom on simulation canvas
  - Single-finger pan navigation
  - Double-tap to reset view
  
- **Responsive Design**
  - Adaptive layout for portrait/landscape
  - Touch-friendly 44px minimum buttons
  - Collapsible controls on small screens
  - Full-screen popups on mobile
  
- **Performance Optimizations**
  - Reduced population size on mobile (50 vs 100)
  - Fewer food particles (200-400 vs 800)
  - Smaller world dimensions for better framerate
  - Optimized rendering for mobile GPUs
  
- **Mobile-First Features**
  - No pinch-zoom on page (app handles zoom)
  - PWA-ready with app-like experience
  - Status bar integration on iOS
  - Landscape orientation support

## 📝 License

MIT License - Feel free to use and modify!

## 🤝 Contributing

Contributions welcome! Feel free to open issues or submit pull requests.

## 🙏 Acknowledgments

Built with React + Vite for optimal performance and developer experience.
