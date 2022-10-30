// utilities to be used with draw elements

/* global requestAnimationFrame */
/* exported toggleCollapse, collapseSection, expandIfCollapsed, removeSpacesEtc */

function toggleCollapse (element) {
  var wasCollapsed = !element.getAttribute('data-collapsed') || element.getAttribute('data-collapsed') === 'false'
  if (wasCollapsed) {
    expandSection(element)
    element.setAttribute('data-collapsed', 'true')
  } else {
    collapseSection(element)
    element.setAttribute('data-collapsed', 'false')
  }
  return wasCollapsed // ie it is now expanded
}

function collapseSection (element) {
  // from css-tricks.com/using-css-transitions-auto-dimensions/
  var sectionHeight = element.scrollHeight
  var elementTransition = element.style.transition
  element.style.transition = ''
  requestAnimationFrame(function () {
    element.style.height = sectionHeight + 'px'
    element.style.transition = elementTransition
    requestAnimationFrame(function () {
      element.style.height = 0 + 'px'
    })
  })
}

function expandSection (element) {
  // console.log('expand', element)
  // from css-tricks.com/using-css-transitions-auto-dimensions/
  var sectionHeight = element.scrollHeight || 'auto'
  element.style.height = (sectionHeight + 'px')
  element.addEventListener('transitionend', function expander (e) {
    element.removeEventListener('transitionend', expander)
    element.style.height = null
  })
}

function expandIfCollapsed (element) {
  var wasCollapsed = !element.getAttribute('data-collapsed') || element.getAttribute('data-collapsed') === 'false'
  if (wasCollapsed) {
    expandSection(element)
    element.setAttribute('data-collapsed', 'true')
  }
}

function removeSpacesEtc (aText) {
  aText = aText.replace(/&nbsp;/g, ' ').trim()
  aText = aText.replace(/\//g, ' ').trim()
  aText = aText.replace(/,/g, ' ').trim()
  aText = aText.replace(/:/g, ' ').trim()
  aText = aText.replace(/-/g, ' ').trim()
  aText = aText.replace(/\./g, ' ').trim()
  while (aText.indexOf('  ') > -1) {
    aText = aText.replace(/ {2}/, ' ')
  }
  return aText.toLowerCase()
}
