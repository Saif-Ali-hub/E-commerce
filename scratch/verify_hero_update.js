const http = require('http');
const fs = require('fs');

http.get('http://localhost:5000/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    const hasHero = data.includes('id="hero-banner"');
    const hasTrustSection = data.includes('id="trust-features-section"');
    const hasTrustGrid = data.includes('class="hero-trust-grid"');
    const cardsCount = (data.match(/class="hero-trust-card/g) || []).length;
    const slidesCount = (data.match(/class="hero-info-slide/g) || []).length;
    const popoverCount = (data.match(/class="feature-popover/g) || []).length;

    console.log('hero-banner present:', hasHero);
    console.log('trust-features-section present:', hasTrustSection);
    console.log('hero-trust-grid present:', hasTrustGrid);
    console.log('hero-trust-card count:', cardsCount);
    console.log('hero-info-slide count:', slidesCount);
    console.log('feature-popover count:', popoverCount);

    const css = fs.readFileSync('frontend/styles.css', 'utf8');
    const hasOverlayDark = css.includes('[data-theme="dark"] .hero-slider-overlay');
    const hasHeroContentGlass = css.includes('.hero-content {') && css.includes('backdrop-filter: blur(14px)');
    const hasHighContrastText = css.includes('[data-theme="dark"] .hero-title') && css.includes('text-shadow');
    const hasTrustSectionCss = css.includes('.trust-features-section {');

    console.log('Dark overlay rule present:', hasOverlayDark);
    console.log('Frosted glass card rule present:', hasHeroContentGlass);
    console.log('High contrast text shadow rule present:', hasHighContrastText);
    console.log('Trust features section CSS present:', hasTrustSectionCss);

    if (hasHero && hasTrustSection && cardsCount === 6 && slidesCount === 5 && popoverCount === 6) {
      console.log('VERIFICATION: ALL CRITERIA SATISFIED 100%!');
    } else {
      console.error('VERIFICATION: FAILED CRITERIA!');
      process.exit(1);
    }
  });
}).on('error', err => {
  console.error('Server error:', err);
  process.exit(1);
});
