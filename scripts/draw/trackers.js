
/* global chrome */ // from system
/* global toggleCollapse */ // from utils
/* global expandIfCollapsed */ // from utils
/* global dg */ // from dgelements.js

const trackers = {
  header: function (alog, options) {
    // options: isCurrent
    const [ttlCookies, trackerNum] = trackers.countTrackers(alog)
    const thediv = dg.div(
      {style: {
        display: (ttlCookies || trackerNum)? 'inline-block':'none',
        'margin-top': '10px',
        'margin-left': '3px',
      }},
      dg.span({
        style: {
          cursor: 'pointer',
          color: CSS.LIGHT_GREY,
        },
        onclick: function (evt) {
          const blocktotoggle = this.parentElement.nextSibling
          var isExpanded = toggleCollapse(blocktotoggle)
          const arrow = evt.target.className.includes('fa-chevron') ? evt.target : evt.target.firstChild
          arrow.className = isExpanded ? ('fa-chevron-down hist_details_expanded') : ('fa-chevron-right  hist_details_collapse')
        }
      },
      dg.span({
        className: 'fa-chevron-right hist_details_collapse',
        style: { color: (alog._id ? 'green' : 'cornflowerblue') }
      }),
      ((ttlCookies || trackerNum) ? dg.span(dg.span('Found ' + ttlCookies + ' cookies, using ' + trackerNum + ' tracker' + (trackerNum !== 1 ? 's.' : '.') ))
      :
      'No trackers - (this should be hidden)')

    ),trackers.removeCookiesButt(alog, options)
    )
    return thediv
  },
  details: function (alog, options) {
    if (!alog) alog = {}

    const detailsdiv = dg.div({
      style: {
        color: CSS.LIGHT_GREY,
        'font-size': '12px',
        'padding-left': '22px',
        height: '0px',
        overflow: 'hidden',
        transition: 'height 0.3s ease-out'
      }
    },
    dg.div({ style: { color: 'indianred', 'padding-top':'5px', 'margin-bottom':'5px' } }, 'Note: Clicking "Remove Trackers" will search for cookies related to the page and try to delete them. But sites have various ways of tracking you, so this is no panecea. Also, as all third party cookies will be sought, this may log you out of some services. So please use with caution.'),
    dg.div({ style: { display: 'none', margin:'3px', padding:'5px', color: 'indianred', border:'1px solid yellowgreen', 'border-radius':'3px' } },'Are you sure you want to remove cookies? (If you click below, this warning will not be shown again.)',
      dg.div({
        onclick: function(evt) { trackers.removecookies(alog, evt.target.parentElement) },
        style: {'font-weight' : 'bold', margin : '3px', 'text-align' : 'center', cursor : 'pointer' }
      }, 'CLICK TO REMOVE')
    ),
    dg.div(dg.b('Tracker Details:'),dg.br(),dg.br()))

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
    if (!alog.vulog_sub_pages) alog.vulog_sub_pages = []
    const [ttlCookies, numSubTrackers, trackerVisits] = trackers.countTrackers(alog)

    // show main site cookies from alog.vulog_cookies
    detailsdiv.appendChild (
      dg.div( dg.span( dg.b('Cookie keys: '), drawCookieDetails(alog.vulog_cookies) ) )
    )

    // Show sub page cookies // alog.vulog_sub_pages.vulog_cookies
    const trackersDiv = dg.div({ style: { } })
    const trackerList = alog.vulog_sub_pages
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
                (trackers.cnum(asubpage.vulog_cookies)
                  ? (trackers.cnum(asubpage.vulog_cookies) + '')
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
    detailsdiv.appendChild(trackersDiv)

    // Show sub page cookies alog.vulog_3pjs  alog.vulog_3pimg
    const resourcesDiv = dg.div({ style: { } })
    if (!alog.vulog_3rdParties) alog.vulog_3rdParties = { js: [], img: [] }
    alog.vulog_3rdParties.js = alog.vulog_3rdParties.js || []
    alog.vulog_3rdParties.img = alog.vulog_3rdParties.img || []
    alog.vulog_3rdParties.js = alog.vulog_3rdParties.js.sort()
    alog.vulog_3rdParties.img = alog.vulog_3rdParties.img.sort()
    const rListLen = alog.vulog_3rdParties.js.length + alog.vulog_3rdParties.img.length
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
      if (alog.vulog_3rdParties.js.length > 0) {
        details3p.appendChild(dg.div({ className: 'subtitle', style: { 'margin-top': '5px' } }, 'Scripts (Javascript files):'))
        alog.vulog_3rdParties.js.forEach(aUrl => details3p.appendChild(dg.div({ className: 'wrapurl small_space' }, aUrl)))
      }
      if (alog.vulog_3rdParties.img.length > 0) {
        details3p.appendChild(dg.div({ className: 'subtitle', style: { 'margin-top': '5px' } }, 'Images (and other):'))
        alog.vulog_3rdParties.img.forEach(aUrl => details3p.appendChild(dg.div({ className: 'wrapurl small_space' }, aUrl)))
        details3p.appendChild(dg.div({ className: 'subtitle', style: { 'margin-top': '5px' } }, 'These files may also be depositing 3rd party cookies.'))
      }
      resourcesDiv.appendChild(details3p)
    }
    detailsdiv.appendChild(resourcesDiv)

    detailsdiv.appendChild(dg.div({style:{
      'border-bottom': '2px solid grey',
      'padding-bottom': '5px',
      'margin-bottom': '10px',}}))

    return detailsdiv
  },


  removeCookiesButt : function(alog, options) {
    if (!options.isCurrent) {
      return dg.span()
    } else {
      return dg.span({
        style: {
          //color: 'lightskyblue',
          //'border-radius': '3px',
          // border: '1px solid yellowgreen',
          width: 'fit-content',
          cursor: 'pointer',
          'margin-left': '5px',
          color: '#2060ff'
        },
        onclick: function (evt) {
          const button = evt.target
          button.style.display='none'
          const removeDiv = button.parentElement.nextSibling.firstChild.nextSibling
          removeDiv.style.display='block'

          const blocktoexpand = this.parentElement.nextSibling
          var isExpanded = expandIfCollapsed(blocktoexpand)
          const arrow = evt.target.parentElement.firstChild.firstChild
          arrow.className = 'fa-chevron-down hist_details_expanded'

          if (options.cookieRemovalHasBeenCalled) {
            trackers.removecookies(alog, removeDiv)
          }
        }
      }, ' Remove Trackers')
    }
  },

  removecookies: function (alog, removeDiv) {
    removeDiv.innerHTML=''

    removeDiv.previousSibling.style.color='black'

    //utility function
    const hostFromUrl = function (url) {
      if (!url) return url
      let temp = url.split('://')
      if (temp.length > 1) temp.shift()
      temp = temp[0].split('/')[0]
      return temp
    }

    // get a list of urls from log and all 3p sites... and then sequentialluy delete them
    let allSites = [alog.url, ...alog.vulog_3rdParties.img, ...alog.vulog_3rdParties.js]
    alog.vulog_sub_pages.forEach(subpage => {
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
      chrome.tabs.sendMessage(tabs[0].id, { action: 'removeLocalStorage', url: alog.url }, function (response) {
        lsRemoved = response.nums
      })
    })
    setTimeout(function () {
      removeDiv.appendChild(
        dg.div({ style: { 'margin-top': '5px' } },
          dg.div((numRemoved > 0 ? ('Total Cookies Removed :' + numRemoved) : 'Did not find any cookies to remove')),
          dg.div((lsRemoved ? ('Local Storage Items Erased: ' + lsRemoved) : '')),
          dg.div(errCount ? ('Total Errors Encountered: ' + errCount) : ''),
          dg.div({style:{margin:'5px'}}, 'Please close this tab to avoid cookie re-insertion')
      ))
      chrome.runtime.sendMessage( {msg: 'cookieRemovalCalled'} , function (response) {
        // onsole.log('cookieRemovalHasBeenCalled res',response)
      })

    }, 1000)
  },

  countTrackers : function (alog) {
    let ttlCookies = trackers.cnum(alog.vulog_cookies)
    let trackerVisits = 0
    if (alog.vulog_sub_pages) {
      alog.vulog_sub_pages.forEach(asubpage => {
        ttlCookies += trackers.cnum(asubpage.vulog_cookies)
        trackerVisits += asubpage.vulog_visits.length
      })
    } else { alog.vulog_sub_pages = [] }
    return [ttlCookies, alog.vulog_sub_pages.length, trackerVisits]
  },
  cnum : function (cookies) {
    return (!cookies) ? 0 : Object.keys(cookies).length
  }

}
