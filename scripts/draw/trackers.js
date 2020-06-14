
/* global chrome */ // from system
/* global toggleCollapse */ // from utils
/* global dg */ // from dgelements.js

/* exported showTrackers */

var showTrackers = function () {}; showTrackers() // eslint error hack

showTrackers = function (theLog, isCurrent) {
  if (!theLog)theLog = {}
  const mainDiv = dg.div(
    { style: { 'margin-bottom': '20px' } },
    dg.span({
      style: { height: '16px', overflow: 'hidden', 'text-overflow': 'ellipsis', 'font-size': '18px', color: 'indianred', 'margin-top': '20px' }
    },
    (isCurrent ? dg.span('Trackers on the current Web Page')
      : dg.span('Trackers for: ', dg.span({ className: 'subtitle' }, theLog.purl)))
    )
  )

  // misc functions
  const drawCookieDetails = function (cookies) {
    const outer = dg.span({
      className: 'cookie_details hidden_cookies'
    }, (cookies && cookies.length > 0) ? (cookies.join(', ') + '.') : 'None.')
    return outer
  }
  const NUM_COLOR = 'indianred'
  const SHOW_COOKIES = 'See Details'
  const HIDE_COOKIES = 'Hide Details'
  const toggletrackers = function (evt) {
    const toggleButt = evt.target
    const detailButt = toggleButt.parentElement.nextSibling
    toggleDetails(toggleButt, detailButt)
  }
  const toggleDetails = function (toggleButt, detailButt) {
    var isExpanded = toggleCollapse(detailButt)
    toggleButt.innerText = isExpanded ? HIDE_COOKIES : SHOW_COOKIES
  }

  // Calculated aggregate numbers
  if (!theLog.vulog_sub_pages) theLog.vulog_sub_pages = []
  const [ttlCookies, numSubTrackers, trackerVisits] = countTrackers(theLog)

  // draw Overview from
  mainDiv.appendChild(
    dg.div(
      { className: 'subtitle' },
      dg.div(
        dg.span('This site installed '),
        dg.span({ style: { color: NUM_COLOR, size: '18px' } },
          (ttlCookies ? ttlCookies + '' : 'NO')),
        dg.span(' known cookies. '),
        dg.span(
          { style: { display: (numSubTrackers ? 'block' : 'none') } },
          dg.span('It connected to '),
          dg.span({ style: { color: NUM_COLOR, size: '18px' } },
            (numSubTrackers + '')
          ),
          dg.span(' tracker sites'),
          dg.span(
            { style: { display: (theLog.vulog_sub_pages.length !== trackerVisits ? 'inline' : 'none') } },
            dg.span({ style: { color: NUM_COLOR, size: '18px' } },
              (' ' + trackerVisits + ' ')
            ),
            dg.span('times')
          ),
          dg.span('.')
        )
      ),
      dg.div(
        { style: { display: (theLog.vulog_hidden_subcees ? 'block' : 'none') } },
        ('It has ' + theLog.vulog_hidden_subcees + ' trackers with unknown number of hidden cookies.')
      )
    )
  )

  // show main site cookies from theLog.vulog_cookies
  mainDiv.appendChild(
    dg.div(
      { className: 'subtitle' },
      ('The web page left ' + (cnum(theLog.vulog_cookies) ? (cnum(theLog.vulog_cookies) + '') : 'no ') + ' known cookies itself. '),
      dg.span({
        className: 'toggle_tracker_details',
        style: { display: (cnum(theLog.vulog_cookies) ? 'block' : 'none') },
        onclick: function (e) { toggleDetails(e.target, dg.el('site_cookies')) }
      },
      SHOW_COOKIES
      ),
      dg.div({
        id: 'site_cookies',
        style: {
          'padding-left': '5px',
          height: '0px',
          overflow: 'hidden',
          transition: 'height 0.3s ease-out'
        }
      },
      dg.div(dg.span(
        'Cookies:',
        drawCookieDetails(theLog.vulog_cookies)
      ))
      )
    )
  )

  // Show sub page cookies // theLog.vulog_sub_pages.vulog_cookies
  const trackersDiv = dg.div({ style: { } })
  const trackerList = theLog.vulog_sub_pages
  if (!trackerList || trackerList.length === 0) {
    trackersDiv.appendChild(dg.div())
  } else {
    trackersDiv.appendChild(
      dg.div(
        { className: 'subtitle' },
        dg.span('Tracker sites related to this web page sent data to:')
      )
    )
    trackerList.forEach(asubpage => {
      // onsole.log(asubpage)
      trackersDiv.appendChild(
        dg.div(
          { style: { 'margin-top': '5px', 'margin-right': '15px' } },
          dg.div(
            { style: { height: '16px', overflow: 'hidden', 'text-overflow': 'ellipsis' } },
            asubpage.purl.split('?')[0]
          ),
          dg.div(
            dg.span(
              { style: { 'margin-left': '5px' } },
              (' - Connected ')
            ),
            dg.span({ style: { color: NUM_COLOR } },
              (asubpage.vulog_visits.length > 1 ? (asubpage.vulog_visits.length + ' times ') : 'once ')
            ),
            dg.span('and received '),
            dg.span(
              { style: { color: NUM_COLOR } },
              (cnum(asubpage.vulog_cookies)
                ? (cnum(asubpage.vulog_cookies) + '')
                : (asubpage.vulog_hidden_subcees ? 'unknown number of hidden' : 'no')
              )
            ),
            dg.span(' cookies. '),
            dg.span({
              className: 'toggle_tracker_details',
              onclick: toggletrackers
            },
            SHOW_COOKIES)
          ),
          dg.div({
            style: {
              height: '0px',
              overflow: 'hidden',
              transition: 'height 0.3s ease-out',
              'padding-left': '5px'
            }
          },
          dg.span(
            { style: { } },
            'Full site url: ',
            dg.span(
              { className: 'cookie_details' },
              asubpage.url
            ),
            dg.div(dg.span(
              'Cookies:',
              drawCookieDetails(asubpage.vulog_cookies)
            ))
          ))
        )
      )
    })
  }
  mainDiv.appendChild(trackersDiv)

  // Show sub page cookies theLog.vulog_3pjs  theLog.vulog_3pimg
  const resourcesDiv = dg.div({ style: { } })
  if (!theLog.vulog_3rdParties) theLog.vulog_3rdParties = { js: [], img: [] }
  theLog.vulog_3rdParties.js = theLog.vulog_3rdParties.js || []
  theLog.vulog_3rdParties.img = theLog.vulog_3rdParties.img || []
  theLog.vulog_3rdParties.js = theLog.vulog_3rdParties.js.sort()
  theLog.vulog_3rdParties.img = theLog.vulog_3rdParties.img.sort()
  const rListLen = theLog.vulog_3rdParties.js.length + theLog.vulog_3rdParties.img.length
  if (rListLen === 0) {
    resourcesDiv.appendChild(dg.div())
  } else {
    resourcesDiv.appendChild(
      dg.div(
        { style: { 'margin-top': '20px' } },
        dg.div({ className: 'subtitle' },
          'Accessed ', dg.span({ style: { color: NUM_COLOR } }, (rListLen + ' ')), 'outside resources (scripts, images etc) fetched from 3rd party sites'),
        dg.div('(Some may be servers belonging to the same site) ',
          dg.span({
            className: 'toggle_tracker_details',
            onclick: function (e) { toggleDetails(e.target, dg.el('details3p')) }
          },
          SHOW_COOKIES)
        )
      )
    )
    const details3p = dg.div({
      id: 'details3p',
      className: 'cookie_details',
      style: {
        'padding-right': '30px',
        'padding-left': '5px',
        height: '0px',
        overflow: 'hidden',
        transition: 'height 0.3s ease-out'
      }
    })
    if (theLog.vulog_3rdParties.js.length > 0) {
      details3p.appendChild(dg.div({ className: 'subtitle', style: { 'margin-top': '5px' } }, 'Scripts (Javascript files):'))
      theLog.vulog_3rdParties.js.forEach(aUrl => details3p.appendChild(dg.div({ className: 'wrapurl small_space' }, aUrl)))
    }
    if (theLog.vulog_3rdParties.img.length > 0) {
      details3p.appendChild(dg.div({ className: 'subtitle', style: { 'margin-top': '5px' } }, 'Images (and other):'))
      theLog.vulog_3rdParties.img.forEach(aUrl => details3p.appendChild(dg.div({ className: 'wrapurl small_space' }, aUrl)))
      details3p.appendChild(dg.div({ className: 'subtitle', style: { 'margin-top': '5px' } }, 'These files may also be depositing 3rd party cookies.'))
    }
    resourcesDiv.appendChild(details3p)
  }
  mainDiv.appendChild(resourcesDiv)

  const removeCookiesButt = dg.div({
    style: {
      width: '100%',
      'margin-top': '30px',
      'text-align': 'center',
      color: 'indianred'
    }
  }, dg.span({
    style: {
      'border-radius': '3px',
      border: '1px solid yellowgreen',
      width: 'fit-content',
      cursor: 'pointer',
      padding: '3px',
      color: '#2060ff'
    },
    onclick: function (evt) {
      const button = evt.target
      const removeDiv = button.parentElement
      removeDiv.innerHTML = ''
      removeDiv.style['text-align'] = 'left'
      // get a list of urls from log and all 3p sites... and then sequentialluy delete them
      let allSites = [theLog.url, ...theLog.vulog_3rdParties.img, ...theLog.vulog_3rdParties.js]
      theLog.vulog_sub_pages.forEach(subpage => {
        if (subpage.vulog_cookies && subpage.vulog_cookies.length > 0) allSites = [...allSites, ...subpage.vulog_cookies]
      })

      let errCount = 0
      let numRemoved = 0
      let lsRemoved = 0
      allSites.forEach(site => {
        if (typeof site === 'string') {
          chrome.cookies.getAll({ url: site }, function (resp) {
            if (resp && resp.length > 0) {
              removeDiv.appendChild(dg.div(('Removing ' + resp.length + ' cookies from ' + hostFromUrl(site))))
              resp.forEach(acookie => {
                try {
                  chrome.cookies.remove({ url: site, name: acookie.name }, function (resp) {
                    if (resp) { numRemoved++ } else { errCount++ }
                  })
                } catch (e) {
                  console.warn('could not remove cookie ', acookie, site)
                  errCount++
                }
              })
            }
          })
        } else {
          console.warn('cookie removal problem at ', site)
          errCount++
        }
      })
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        // onsole.log("tabs[0].url",tabs[0].url)
        chrome.tabs.sendMessage(tabs[0].id, { action: 'removeLocalStorage', url: theLog.url }, function (response) {
          lsRemoved = response.nums
        })
      })
      setTimeout(function () {
        removeDiv.appendChild(
          dg.div({ style: { 'margin-top': '5px' } },
            dg.div((numRemoved > 0 ? ('Total Cookies Removed :' + numRemoved) : 'Did not find any cookies to remove')),
            dg.div((lsRemoved ? ('Local Storage Items Erased: ' + lsRemoved) : '')),
            dg.div(errCount ? ('Total Errors Encountered: ' + errCount) : '')
          )
        )
      }, 1000)
    }
  }, ' Remove Known Trackers * '),
  dg.div({ style: { color: 'indianred', 'text-align': 'left', margin: '2px', 'margin-top': '5px' } }, '* Clicking "Remove Known Trackers" will search for cookies related to the page and try to delete them. But sites have various ways of tracking you, so this is no panecea. Also, as all third party cookies will be sought, this may log you out of some services. So please use with caution.'))

  mainDiv.appendChild(removeCookiesButt)

  return mainDiv
}

const countTrackers = function (theLog) {
  let ttlCookies = cnum(theLog.vulog_cookies)
  let trackerVisits = 0
  if (theLog.vulog_sub_pages) {
    theLog.vulog_sub_pages.forEach(asubpage => {
      ttlCookies += cnum(asubpage.vulog_cookies)
      trackerVisits += asubpage.vulog_visits.length
    })
  } else { theLog.vulog_sub_pages = [] }
  return [ttlCookies, theLog.vulog_sub_pages.length, trackerVisits]
}
const cnum = function (cookies) {
  return (!cookies) ? 0 : Object.keys(cookies).length
}
// Utility functions
const hostFromUrl = function (url) {
  if (!url) return url
  let temp = url.split('://')
  if (temp.length > 1) temp.shift()
  temp = temp[0].split('/')[0]
  return temp
}
