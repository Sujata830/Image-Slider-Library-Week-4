# Modular Vanilla JavaScript Image Slider Library

A lightweight, responsive, accessible image slider library built from scratch with **zero third-party dependencies**.

Developed as a University Software Engineering Assignment.

---

## 🌟 Key Features

- **Zero Dependencies**: Pure HTML5, CSS3, and modern ES6+ Vanilla JavaScript.
- **Horizontal Sliding Track**: Uses hardware-accelerated `transform: translateX()` and smooth CSS transitions (no opacity cross-fading).
- **Clone-Based Infinite Looping**: Smooth forward and backward transitions with zero visual jumps or rewinds.
- **Dynamic Indicators**: Navigation dots are automatically created at runtime to match the exact number of slides.
- **Full Responsiveness**: Adapts smoothly to mobile, tablet, and desktop viewports with fixed aspect ratios (`object-fit: cover`).
- **Interactive Controls**:
  - Previous (❮) and Next (❯) arrow navigation
  - Direct jump navigation via indicator dots
  - Keyboard navigation (Left/Right arrow keys)
  - Touch swipe support on mobile devices
  - Accessible ARIA roles and labels

---

## 📁 Project Structure

```text
Image-Slider-Library/
│
├── index.html       # Semantic HTML layout and slide markup
├── style.css        # Responsive styling and smooth CSS transitions
├── slider.js        # ES6 ImageSlider class and clone-based loop logic
└── README.md        # Project documentation
```

---

## 🚀 Quick Start

1. Clone or download this repository:
   ```bash
   git clone https://github.com/<your-username>/Image-Slider-Library.git
   ```
2. Navigate into the directory:
   ```bash
   cd Image-Slider-Library
   ```
3. Open `index.html` in any modern web browser or run with **VS Code Live Server**.

---

## 🛠️ Technical Implementation Details

- **Conveyor Belt Layout**: `.slider-viewport` uses `overflow: hidden`, and `.slider-track` uses `display: flex`.
- **Seamless Infinite Loop**: First and last slides are cloned and prepended/appended to the track. When sliding past bounds, the track silently snaps to the real slide position with `transition: none` upon the `transitionend` event.
- **Dynamic Dot Creation**: JavaScript queries `.slide` elements and appends `<button>` elements to `#slider-dots`.
- **Defensive Animation Locks**: Uses an `isAnimating` boolean flag to prevent glitching from rapid button clicks.

---

## 📜 License
This project is open-source and created for academic software engineering purposes.
