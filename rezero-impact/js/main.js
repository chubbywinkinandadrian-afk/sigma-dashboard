/* Re:Impact — boot. */
(function () {
  function start() { RZ.UI.boot(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
