// utilities to be used with draw elements

/* global requestAnimationFrame */
/* exported addToListAsUniqueItems, toggleCollapse, collapseSection, expandIfCollapsed, removeSpacesEtc */

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

const addToListAsUniqueItems = function (aList, items, transform) {
  // takes two lists..  integrates items into aList without duplicates
  // if items are strins or numbers, they are treated as a one item list
  if (!aList) aList = []
  if (!items) return aList
  if (typeof items === 'string' || !isNaN(items)) items = [items]
  if (!Array.isArray(items)) { throw new Error('items need to be a list') }
  if (transform) items = items.map(transform)
  items.forEach(function (anItem) { if (anItem && anItem !== ' ' && aList.indexOf(anItem) < 0 && anItem.length > 0) aList.push(anItem) })
  return aList
}

const removeFromlist = function (aList, item, transform) {
  // removes item from a list and returns it
  if (!aList) aList = []
  if (!item) return aList
  if (typeof item !== 'string' && isNaN(item)) throw new Error('need to pass string or number in removeFromlist')
  if (transform) item = transform(item)
  const idx = aList.indexOf(item)
  if (idx > -1) aList.splice(idx, 1)
  return aList
}
