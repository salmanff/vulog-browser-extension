// utilities to be used with draw elements

/* global requestAnimationFrame */
/* exported toggleCollapse, collapseSection, expandIfCollapsed, removeSpacesEtc */

/* 
Colpasable elements need:
        height: 'auto' or '0px' when collapsed,
        overflow: 'hidden',
        transition: 'height 0.3s ease-out',
*/

function toggleCollapse(element) {
  var wasCollapsed = !element.getAttribute('data-collapsed') || element.getAttribute('data-collapsed') === 'false'
  if (wasCollapsed) {
    expandSection(element)
  } else {
    collapseSection(element)
  }
  return wasCollapsed // ie it is now expanded
}

function collapseSection(element) {
  if (element){
  // onsole.log('collapsing ', element)
  // from css-tricks.com/using-css-transitions-auto-dimensions/
  var sectionHeight = element.scrollHeight
  // var elementTransition = element.style.transition
  // element.style.transition = ''
  requestAnimationFrame(function() {
    element.style.height = sectionHeight + 'px'
    // element.style.transition = elementTransition
    requestAnimationFrame(function() {
      element.style.height = '0px'
        setTimeout(() => { // added cause some times this collapse didnt trigger
          element.style.display = 'none'
          element.setAttribute('data-collapsed', 'true')
        }, 200)
      })
    })
  }

}

function expandSection(element, options) {
  if (element) {
    // onsole.log('expand', element)
  // from css-tricks.com/using-css-transitions-auto-dimensions/
  element.style.transition ='height 0.3s ease-out' // for when the div hasnt been intialised properly
  // element.style.overflow ='hidden'
  element.style.display = options?.display || 'block' // to counter note above
  const sectionHeight = element.scrollHeight || 'auto'
  element.style.height = options?.height || (sectionHeight ? (sectionHeight + 'px') : 'auto')
  element.addEventListener('transitionend', function expander (e) {
    element.removeEventListener('transitionend', expander)
    element.style.height = null
    element.setAttribute('data-collapsed', 'false')

  })
  }
}

function expandIfCollapsed(element) {
  var wasCollapsed = element.getAttribute('data-collapsed') === null || element.getAttribute('data-collapsed') === 'true'
  if (wasCollapsed) {
    expandSection(element)
  }
}
function collapseIfExpanded(element) {
  var wasCollapsed = element.getAttribute('data-collapsed') === null || element.getAttribute('data-collapsed') === 'true'
  if (!wasCollapsed) {
    collapseSection(element)
    return true
  }
  return false // returns value to see if it collapsed
}

function smallSpinner(styleOptions) {
  const el = document.createElement('img')
  el.src = freezr?.app?.isWebBased ? '/app_files/@public/info.freezr.public/public/static/ajaxloaderBig.gif' : '/freezr/static/ajaxloaderBig.gif'
  Object.keys(styleOptions || {}).forEach(key => { el.style[key] = styleOptions[key] })

  const width = styleOptions?.width || '20px'
  el.style.width = width
  if (!styleOptions?.height) el.style.height = width
  return el
}


function removeSpacesEtc(aText) {
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
