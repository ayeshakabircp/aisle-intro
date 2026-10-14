// Speed Insights initialization for vanilla HTML/JS project
import { injectSpeedInsights } from '@vercel/speed-insights';

// Initialize Speed Insights when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    injectSpeedInsights();
  });
} else {
  // DOM is already loaded
  injectSpeedInsights();
}
