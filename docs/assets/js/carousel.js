// Enhanced carousel with accessibility, responsive recalculation and button state
(function(){
  const root = document.querySelector('#carousel');
  if(!root) return;
  const track = root.querySelector('.carousel-track');
  if(!track) return;
  const slides = Array.from(track.children);
  if(slides.length === 0) return;
  const nextButton = root.querySelector('.carousel-button.next');
  const prevButton = root.querySelector('.carousel-button.prev');
  let currentIndex = 0;
  let slideWidth = 0;

  // Accessibility roles
  root.setAttribute('role','region');
  root.setAttribute('aria-roledescription','carousel');
  root.setAttribute('aria-label','Application screenshots');
  track.setAttribute('role','list');
  slides.forEach((s,i)=>{
    s.setAttribute('role','group');
    s.setAttribute('aria-roledescription','slide');
    s.setAttribute('aria-label',`Slide ${i+1} of ${slides.length}`);
    s.setAttribute('tabindex','-1');
  });

  function computeWidth(){
    // Each slide occupies full width of root carousel container
    slideWidth = root.getBoundingClientRect().width;
    slides.forEach(slide => {
      slide.style.minWidth = slideWidth + 'px';
    });
    update(true);
  }

  function update(skipFocus){
    track.style.transform = `translateX(-${currentIndex * slideWidth}px)`;
    if(prevButton){
      prevButton.disabled = currentIndex === 0;
      prevButton.setAttribute('aria-disabled', prevButton.disabled);
    }
    if(nextButton){
      nextButton.disabled = currentIndex === slides.length - 1;
      nextButton.setAttribute('aria-disabled', nextButton.disabled);
    }
    slides.forEach((s,i)=>{
      s.classList.toggle('is-active', i===currentIndex);
    });
    if(!skipFocus){
      slides[currentIndex].focus({preventScroll:true});
    }
  }

  function goTo(index){
    if(index < 0 || index >= slides.length) return;
    currentIndex = index;
    update();
  }

  nextButton && nextButton.addEventListener('click', ()=> goTo(currentIndex + 1));
  prevButton && prevButton.addEventListener('click', ()=> goTo(currentIndex - 1));

  // Keyboard navigation
  root.addEventListener('keydown', (e)=>{
    if(e.key === 'ArrowRight') { goTo(currentIndex + 1); e.preventDefault(); }
    else if(e.key === 'ArrowLeft') { goTo(currentIndex - 1); e.preventDefault(); }
    else if(e.key === 'Home') { goTo(0); e.preventDefault(); }
    else if(e.key === 'End') { goTo(slides.length -1); e.preventDefault(); }
  });

  let resizeTimer;
  window.addEventListener('resize', ()=>{
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(computeWidth, 120);
  });

  // Init after images load (fallback to DOMContentLoaded)
  if(document.readyState === 'complete' || document.readyState === 'interactive'){
    computeWidth();
  } else {
    document.addEventListener('DOMContentLoaded', computeWidth);
  }
})();
