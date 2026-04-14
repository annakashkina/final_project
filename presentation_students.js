const slides = document.querySelectorAll('.slide');
let current = 0;

function show(n) {
  slides[current].classList.remove('active');
  current = Math.max(0, Math.min(n, slides.length - 1));
  slides[current].classList.add('active');
  document.getElementById('progress').style.width =
    ((current / (slides.length - 1)) * 100) + '%';
  document.getElementById('counter').textContent =
    (current + 1) + ' / ' + slides.length;
  document.getElementById('hint').style.display = current > 0 ? 'none' : '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); show(current + 1); }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); show(current - 1); }
  if (e.key === 'Home')       { e.preventDefault(); show(0); }
  if (e.key === 'End')        { e.preventDefault(); show(slides.length - 1); }
});

document.addEventListener('click', e => {
  if (e.target.closest('#demo-link')) return;
  if (e.clientX > window.innerWidth / 2) show(current + 1);
  else show(current - 1);
});

show(0);
