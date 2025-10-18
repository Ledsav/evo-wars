/**
 * Mobile detection utilities
 */

/**
 * Detect if the current device is mobile
 * @returns {boolean}
 */
export const isMobileDevice = () => {
  // Check user agent
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // Check for mobile patterns
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
  const isMobileUA = mobileRegex.test(userAgent.toLowerCase());
  
  // Check for touch support
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Check for small screen
  const isSmallScreen = window.innerWidth <= 768;
  
  return isMobileUA || (hasTouch && isSmallScreen);
};

/**
 * Get recommended world size based on device capabilities
 * @returns {{width: number, height: number}}
 */
export const getRecommendedWorldSize = () => {
  const isMobile = isMobileDevice();
  
  if (isMobile) {
    // Smaller world for mobile devices
    const isVerySmall = window.innerWidth <= 480;
    return isVerySmall 
      ? { width: 800, height: 600 }   // Very small phones
      : { width: 1280, height: 720 }; // Tablets and larger phones
  }
  
  // Full size for desktop
  return { width: 2560, height: 1440 };
};

/**
 * Get recommended initial population based on device
 * @returns {number}
 */
export const getRecommendedPopulation = () => {
  const isMobile = isMobileDevice();
  return isMobile ? 50 : 100; // Fewer organisms on mobile
};

/**
 * Get recommended food particle count based on device
 * @returns {number}
 */
export const getRecommendedFoodCount = () => {
  const isMobile = isMobileDevice();
  const isVerySmall = window.innerWidth <= 480;
  
  if (isMobile) {
    return isVerySmall ? 200 : 400; // Fewer particles on small screens
  }
  
  return 800; // Full count for desktop
};

/**
 * Check if device supports high performance rendering
 * @returns {boolean}
 */
export const supportsHighPerformance = () => {
  const isMobile = isMobileDevice();
  
  // Check for hardware acceleration
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  const hasWebGL = !!gl;
  
  return !isMobile && hasWebGL;
};
