// Insert a Back-to-home button into the page (skip on homepage)
(function() {
  try {
    var path = location.pathname || '';
    if (path === '/' || path === '/index.html' || path === '') return;
    // create link
    var a = document.createElement('a');
    a.href = '/';
    a.className = 'back-home-btn';
    a.setAttribute('aria-label', 'Back to home');
    a.innerHTML = '🏠 Back to home';
    // append to body when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { document.body.appendChild(a); });
    } else {
      document.body.appendChild(a);
    }
  } catch (e) { /* fail silently */ }
})();
