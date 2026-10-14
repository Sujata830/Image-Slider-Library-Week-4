/**
 * ==========================================================================
 * Image Slider Library
 * Course: CSE 230 – Web Design and Development
 * Student: Sujata Woad | Professor: Professor Chaudhary
 * 
 * A responsive, accessible, dependency-free image slider library written in
 * modern ES6+ Vanilla JavaScript. Implements seamless infinite looping via
 * clone nodes, hardware-accelerated CSS transforms, and dynamic dot indicators.
 * ==========================================================================
 */

"use strict";

class ImageSlider {
  /**
   * Initializes the ImageSlider instance.
   * @param {HTMLElement|string} root - The root container element or selector.
   * @param {Object} options - Configuration options for the slider.
   */
  constructor(root, options = {}) {
    // Resolve element if selector string was provided
    if (typeof root === "string") {
      root = document.querySelector(root);
    }

    if (!root) {
      console.warn("ImageSlider: Target root element could not be found.");
      return;
    }

    // Prevent duplicate initializations on the same DOM element
    if (root._imageSliderInstance) {
      return root._imageSliderInstance;
    }
    root._imageSliderInstance = this;

    this.root = root;

    // Merge user options with default settings
    this.options = {
      duration: 450,          // Sliding transition duration in milliseconds
      autoplay: true,         // Automatically rotate through slides
      autoplayInterval: 5000, // Duration between slide changes (ms)
      pauseOnHover: true,     // Pause autoplay on mouse hover
      pauseOnFocus: true,     // Pause autoplay on keyboard focus
      ...options,
    };

    this.duration = this.options.duration;
    this.autoplayInterval = this.options.autoplayInterval;

    // Query sub-elements scoped within the slider container or immediate section
    const query = (selector) => {
      return (
        this.root.querySelector(selector) ||
        this.root.parentElement?.querySelector(selector) ||
        document.querySelector(selector) ||
        null
      );
    };

    this.track = query("#slider-track, .slider-track");
    this.prevButton = query("#prev-btn, .prev");
    this.nextButton = query("#next-btn, .next");
    this.dotsContainer = query("#slider-dots, .slider-dots");
    this.counter = query("#slide-counter, .slide-counter");
    this.autoplayButton = query("#slider-autoplay-btn, .slider-autoplay-btn");

    if (!this.track) {
      console.error("ImageSlider: Slider track (.slider-track) element is missing.");
      return;
    }

    // Capture the original slide elements before any clones are added
    this.originalSlides = [
      ...this.track.querySelectorAll(".slide:not([data-clone='true'])"),
    ];

    this.total = this.originalSlides.length;
    this.currentIndex = 0;   // Current active slide index (0 to total - 1)
    this.position = 1;       // Physical position in track (1 is original slide 0 due to leading clone)
    this.isAnimating = false;
    this.animationTimer = null;
    this.autoplayTimer = null;
    this.isAutoplayPaused = false;
    this.dots = [];

    // Early exit if no slides exist
    if (this.total === 0) {
      return;
    }

    // Initialize slider subsystems
    this.createClones();
    this.createDots();
    this.bindEvents();
    this.updateControls();

    // Position track at the first real slide without transition animation
    this.moveTo(this.position, false);

    // Initialize autoplay if enabled and reduced motion is not requested
    if (this.options.autoplay && !this.prefersReducedMotion()) {
      this.startAutoplay();
    } else {
      this.updateAutoplayButtonState(false);
    }
  }

  /**
   * Helper to determine if user prefers reduced motion.
   * @returns {boolean}
   */
  prefersReducedMotion() {
    return (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  /**
   * Clones the first and last slides to enable seamless infinite looping.
   * Leading clone allows smooth transition from Slide 1 -> Slide N.
   * Trailing clone allows smooth transition from Slide N -> Slide 1.
   */
  createClones() {
    // Clear any existing clones to ensure clean idempotency
    this.track.querySelectorAll("[data-clone='true']").forEach((node) => node.remove());

    if (this.total < 2) {
      this.position = 0;
      return;
    }

    const firstClone = this.originalSlides[0].cloneNode(true);
    const lastClone = this.originalSlides[this.total - 1].cloneNode(true);

    firstClone.dataset.clone = "true";
    lastClone.dataset.clone = "true";

    // Hide clones from assistive technology to prevent redundant screen reader announcements
    firstClone.setAttribute("aria-hidden", "true");
    lastClone.setAttribute("aria-hidden", "true");

    // Clear alt tags on cloned images to avoid repetitive announcements
    firstClone.querySelector("img")?.setAttribute("alt", "");
    lastClone.querySelector("img")?.setAttribute("alt", "");

    this.track.prepend(lastClone);
    this.track.append(firstClone);
  }

  /**
   * Dynamically generates indicator dots matching the total slide count.
   * Each dot is an accessible button configured with click navigation.
   */
  createDots() {
    if (!this.dotsContainer) {
      this.dots = [];
      return;
    }

    // Wipe any existing content in dots container
    this.dotsContainer.replaceChildren();

    this.originalSlides.forEach((_, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", `Go to slide ${index + 1} of ${this.total}`);
      dot.setAttribute("role", "tab");

      dot.addEventListener("click", () => {
        this.goTo(index);
        this.restartAutoplay();
      });

      this.dotsContainer.appendChild(dot);
    });

    this.dots = [...this.dotsContainer.querySelectorAll("button")];
  }

  /**
   * Registers DOM event listeners for buttons, touch gestures, keyboard, and resize.
   */
  bindEvents() {
    // Next navigation button
    if (this.nextButton) {
      this.nextButton.addEventListener("click", () => {
        this.next();
        this.restartAutoplay();
      });
    }

    // Previous navigation button
    if (this.prevButton) {
      this.prevButton.addEventListener("click", () => {
        this.previous();
        this.restartAutoplay();
      });
    }

    // Transition end listener on track to handle seamless boundary snap
    this.track.addEventListener("transitionend", (event) => {
      if (event.target !== this.track || event.propertyName !== "transform") {
        return;
      }
      this.finishAnimation();
    });

    // Keyboard arrow navigation
    this.root.addEventListener("keydown", (event) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        this.next();
        this.restartAutoplay();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.previous();
        this.restartAutoplay();
      }
    });

    // Mobile touch swipe gestures
    let touchStartX = 0;
    let touchStartY = 0;

    this.root.addEventListener(
      "touchstart",
      (event) => {
        touchStartX = event.changedTouches[0].clientX;
        touchStartY = event.changedTouches[0].clientY;
        this.pauseAutoplay();
      },
      { passive: true }
    );

    this.root.addEventListener(
      "touchend",
      (event) => {
        const touchEndX = event.changedTouches[0].clientX;
        const touchEndY = event.changedTouches[0].clientY;
        const diffX = touchStartX - touchEndX;
        const diffY = touchStartY - touchEndY;

        // Ensure horizontal swipe is dominant and exceeds minimum threshold of 40px
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
          if (diffX > 0) {
            this.next();
          } else {
            this.previous();
          }
        }
        this.resumeAutoplay();
      },
      { passive: true }
    );

    // Pause on Hover
    if (this.options.pauseOnHover) {
      this.root.addEventListener("mouseenter", () => this.pauseAutoplay());
      this.root.addEventListener("mouseleave", () => this.resumeAutoplay());
    }

    // Pause on Keyboard Focus
    if (this.options.pauseOnFocus) {
      this.root.addEventListener("focusin", () => this.pauseAutoplay());
      this.root.addEventListener("focusout", () => this.resumeAutoplay());
    }

    // Window resize handler: keeps track accurately centered without visual glitch
    window.addEventListener("resize", () => {
      this.moveTo(this.position, false);
    });

    // Autoplay manual play/pause button
    if (this.autoplayButton) {
      this.autoplayButton.addEventListener("click", () => {
        this.toggleAutoplay();
      });
    }
  }

  /**
   * Applies translateX transform to the track with or without transition.
   * @param {number} position - Track position index.
   * @param {boolean} animate - Whether to apply CSS transition animation.
   */
  moveTo(position, animate = true) {
    const shouldAnimate = animate && !this.prefersReducedMotion();

    this.track.style.transition = shouldAnimate
      ? `transform ${this.duration}ms cubic-bezier(0.25, 1, 0.5, 1)`
      : "none";

    this.track.style.transform = `translateX(-${position * 100}%)`;

    if (!shouldAnimate) {
      // Force DOM reflow so the browser commits the transform immediately without transition
      void this.track.offsetHeight;
    }
  }

  /**
   * Advances to the next slide.
   */
  next() {
    if (this.isAnimating || this.total < 2) {
      return;
    }

    this.isAnimating = true;
    this.position += 1;
    this.currentIndex = (this.currentIndex + 1) % this.total;

    this.updateControls();
    this.moveTo(this.position, true);
    this.startAnimationFallback();
  }

  /**
   * Moves to the previous slide.
   */
  previous() {
    if (this.isAnimating || this.total < 2) {
      return;
    }

    this.isAnimating = true;
    this.position -= 1;
    this.currentIndex = (this.currentIndex - 1 + this.total) % this.total;

    this.updateControls();
    this.moveTo(this.position, true);
    this.startAnimationFallback();
  }

  /**
   * Navigates directly to a target slide by zero-based index.
   * @param {number} index - Target slide index.
   */
  goTo(index) {
    if (
      this.isAnimating ||
      index < 0 ||
      index >= this.total ||
      index === this.currentIndex
    ) {
      return;
    }

    this.isAnimating = true;
    this.currentIndex = index;
    this.position = index + 1; // Slide N is at track position N + 1

    this.updateControls();
    this.moveTo(this.position, true);
    this.startAnimationFallback();
  }

  /**
   * Fallback timer that recovers animation state in case transitionend event is missed.
   */
  startAnimationFallback() {
    clearTimeout(this.animationTimer);
    this.animationTimer = setTimeout(() => {
      this.finishAnimation();
    }, this.duration + 120);
  }

  /**
   * Finalizes the transition and silently snaps boundary clones to real slides.
   */
  finishAnimation() {
    if (!this.isAnimating) {
      return;
    }

    clearTimeout(this.animationTimer);

    if (this.total > 1) {
      if (this.position === 0) {
        // We slid backwards into the leading clone (clone of last slide).
        // Instantly snap to the actual last slide without animation.
        this.position = this.total;
        this.moveTo(this.position, false);
      } else if (this.position === this.total + 1) {
        // We slid forward into the trailing clone (clone of first slide).
        // Instantly snap to the actual first slide without animation.
        this.position = 1;
        this.moveTo(this.position, false);
      }
    }

    this.isAnimating = false;
  }

  /**
   * Synchronizes visual control states (active dot and slide counter).
   */
  updateControls() {
    // Update indicator dots
    if (this.dots && this.dots.length > 0) {
      this.dots.forEach((dot, index) => {
        const isActive = index === this.currentIndex;
        dot.classList.toggle("active", isActive);

        if (isActive) {
          dot.setAttribute("aria-current", "true");
        } else {
          dot.removeAttribute("aria-current");
        }
      });
    }

    // Update textual counter (e.g., "01 / 05")
    if (this.counter) {
      const currentFormatted = String(this.currentIndex + 1).padStart(2, "0");
      const totalFormatted = String(this.total).padStart(2, "0");
      this.counter.textContent = `${currentFormatted} / ${totalFormatted}`;
    }
  }

  /**
   * Starts automatic slide rotation.
   */
  startAutoplay() {
    this.stopAutoplay();
    this.isAutoplayPaused = false;
    this.updateAutoplayButtonState(true);

    this.autoplayTimer = setInterval(() => {
      this.next();
    }, this.autoplayInterval);
  }

  /**
   * Stops autoplay timer completely.
   */
  stopAutoplay() {
    if (this.autoplayTimer) {
      clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
    }
  }

  /**
   * Temporarily pauses autoplay during user interactions.
   */
  pauseAutoplay() {
    if (this.options.autoplay && !this.isAutoplayPaused) {
      this.stopAutoplay();
    }
  }

  /**
   * Resumes autoplay after user interaction ceases.
   */
  resumeAutoplay() {
    if (this.options.autoplay && !this.isAutoplayPaused && !this.prefersReducedMotion()) {
      this.startAutoplay();
    }
  }

  /**
   * Restarts the autoplay cycle after manual action.
   */
  restartAutoplay() {
    if (this.options.autoplay && !this.isAutoplayPaused && !this.prefersReducedMotion()) {
      this.startAutoplay();
    }
  }

  /**
   * Toggles autoplay on and off via user click.
   */
  toggleAutoplay() {
    if (this.autoplayTimer) {
      this.stopAutoplay();
      this.isAutoplayPaused = true;
      this.updateAutoplayButtonState(false);
    } else {
      this.isAutoplayPaused = false;
      this.startAutoplay();
      this.updateAutoplayButtonState(true);
    }
  }

  /**
   * Updates the aria-pressed state and text/icon of the autoplay toggle button.
   * @param {boolean} isPlaying - True if autoplay is running.
   */
  updateAutoplayButtonState(isPlaying) {
    if (!this.autoplayButton) {
      return;
    }

    const icon = this.autoplayButton.querySelector(".autoplay-icon");
    const text = this.autoplayButton.querySelector(".autoplay-text");

    if (isPlaying) {
      this.autoplayButton.setAttribute("aria-pressed", "false");
      this.autoplayButton.setAttribute("aria-label", "Pause automatic slide rotation");
      if (icon) icon.innerHTML = "&#10074;&#10074;"; // Pause symbol
      if (text) text.textContent = "Pause";
    } else {
      this.autoplayButton.setAttribute("aria-pressed", "true");
      this.autoplayButton.setAttribute("aria-label", "Resume automatic slide rotation");
      if (icon) icon.innerHTML = "&#9654;"; // Play symbol
      if (text) text.textContent = "Play";
    }
  }

  /**
   * Returns current slide index (0-indexed).
   * @returns {number}
   */
  getCurrentIndex() {
    return this.currentIndex;
  }

  /**
   * Returns total number of slides.
   * @returns {number}
   */
  getTotalSlides() {
    return this.total;
  }
}

// Auto-initialize all sliders present on the page once the DOM is loaded
function initSliders() {
  document.querySelectorAll(".slider").forEach((element) => {
    new ImageSlider(element);
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSliders);
  } else {
    initSliders();
  }
}

// Support both browser global and module environments
if (typeof window !== "undefined") {
  window.ImageSlider = ImageSlider;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = ImageSlider;
}
