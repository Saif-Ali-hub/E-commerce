async function verify() {
  const res = await fetch('http://localhost:5000/');
  const html = await res.text();

  const navbarStatusMatch = html.includes('nav-status" id="backend-status"');
  const adminStatusMatch = html.includes('nav-status admin-api-status" id="backend-status"');
  const pauseBtnMatch = html.includes('hero-slider-pause-btn');
  const statusChipMatch = html.includes('hero-slider-status-chip');

  console.log('--- VERIFICATION REPORT ---');
  console.log('1. Public Navbar contains API Connected badge:', navbarStatusMatch);
  console.log('2. Admin Modal contains API Connected badge:', adminStatusMatch);
  console.log('3. Hero Slider contains Pause Button:', pauseBtnMatch);
  console.log('4. Hero Slider contains Pause/Reading chip:', statusChipMatch);

  if (!navbarStatusMatch && adminStatusMatch && !pauseBtnMatch && !statusChipMatch) {
    console.log('>>> ALL VERIFICATION CHECKS PASSED SUCCESSFULLY! <<<');
  } else {
    console.log('>>> Verification check failed! <<<');
    process.exit(1);
  }
}

verify().catch(console.error);
