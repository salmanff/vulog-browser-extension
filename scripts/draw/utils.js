

function toggleCollapse(element) {
  var wasCollapsed = !element.getAttribute('data-collapsed') || element.getAttribute('data-collapsed') === 'false';
  if(wasCollapsed) {
    expandSection(element)
    element.setAttribute('data-collapsed', 'true')
  } else {
    collapseSection(element)
    element.setAttribute('data-collapsed', 'false')
  }
  return wasCollapsed // ie it is now expanded
}

function collapseSection(element) {
  // from css-tricks.com/using-css-transitions-auto-dimensions/
  var sectionHeight = element.scrollHeight;
  var elementTransition = element.style.transition;
  element.style.transition = '';
  requestAnimationFrame(function() {
    element.style.height = sectionHeight + 'px';
    element.style.transition = elementTransition;
    requestAnimationFrame(function() {
      element.style.height = 0 + 'px';
    });
  });
}

function expandSection(element) {
  // from css-tricks.com/using-css-transitions-auto-dimensions/
  var sectionHeight = element.scrollHeight || 'auto';
  element.style.height = (sectionHeight + 'px');
  element.addEventListener('transitionend', function(e) {
    element.removeEventListener('transitionend', arguments.callee);
    element.style.height = null;
  });
}
