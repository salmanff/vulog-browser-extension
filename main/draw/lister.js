
// version 0.0.1 - oct 2020

/* global chrome, screen, history */ // from system
/* global toggleCollapse, addToListAsUniqueItems, removeFromlist */ // from utils
/* global dg */ // from dgelements.js
/* global showWarning, currentLog, tabinfo, marks, COLOR_MAP, thisTab */ // from popup.js
/* from popupChromeExt - added a dummy */
/* global vulogOverlayGlobal */

/* global freezrMeta, freezr */

const SEARCH_COUNT = 40

const MCSS = {
  LIGHT_GREY: 'rgb(151, 156, 160)',
  DARK_GREY: 'darkgrey',
  RED: 'indianred'
}
const MAIN_STARS = ['star', 'inbox', 'archive']
// const XTRA_STARS = ['tags', 'sticky-note', 'quote-left', 'quote-right']

dg.addAttributeException('db_id')
dg.addAttributeException('fj_id')
dg.addAttributeException('purl')
dg.addAttributeException('contenteditable')
dg.addAttributeException('data-placeholder')
dg.addAttributeException('group-type')

var lister = {

  // draw marks
  drawItems: function (results, options) {
    if (!options) options = {}
    const groupBy = options.groupBy || 'date'
    return lister.drawGroupBy[groupBy](results, options)
  },
  drawGroupBy: {
    date: function (results, options) {
      const dateDivs = {}
      results.forEach(alog => {
        const thisdate = new Date(['messages','sentMsgs'].includes(options.tabtype) ? alog._date_modified : alog.vCreated).toDateString()
        if (!dateDivs[thisdate]) {
          dateDivs[thisdate] = dg.div(
            { style: { 'font-size': '18px', color: 'indianred', 'margin-top': (['messages','sentMsgs'].includes(options.tabtype) ? '20px' : '40px') } },
            (thisdate)
          )
        }
        dateDivs[thisdate].appendChild(lister.drawmarkItem(alog, 'date', options.tabtype))
      })
      const resultsdiv = dg.div()
      for (const [, divs] of Object.entries(dateDivs)) {
        resultsdiv.appendChild(divs)
      }
      return resultsdiv
    },
    referrer: function (results, options) {
      const refDivs = {}
      const tempstruct = {}
      results.forEach(alog => {
        if (!refDivs[alog.referrer]) {
          tempstruct[alog.referrer] = []
          refDivs[alog.referrer] = dg.div(
            { style: { 'font-size': '18px', color: 'indianred', 'margin-top': '40px' } },
            (alog.referrer)
          )
        }
        tempstruct[alog.referrer].push(alog)
        refDivs[alog.referrer].appendChild(lister.drawmarkItem(alog, 'referrer', options.tabtype))
      })
      const resultsdiv = dg.div()
      for (const [, divs] of Object.entries(refDivs)) {
        resultsdiv.appendChild(divs)
      }
      return resultsdiv
    }
  },

  idFromMark: function (mark) {
    const type = mark._id ? 'id' : 'temp'
    return 'vitem_' + type + '_' + (mark._id || mark.fj_local_temp_unique_id)
  },

  drawmarkItem: function (alog, source, tabtype) {
    const itemdiv = dg.div({
      style: { 'margin-top': '10px' },
      id: this.idFromMark(alog)
    })
    itemdiv.setAttribute('group-type', source)
    const options = { source, tabtype }
    this.drawmarkDetails(itemdiv, alog, options)
    return itemdiv
  },
  drawmarkDetails: function (itemdiv, alog, options) {
    // options source, tabtype, leaveOpen
    // favicon and title
    const that = this

    if (['messages', 'sentMsgs'].includes(options.tabtype)) {
      // onsole.log('drawing alog', alog)
      const fullname = (options.tabtype === 'messages'
        ? ('From ' + alog.sender_id + ' @ ' + alog.sender_host)
        : ('Sent to ' + alog.recipient_id + ' @ ' + alog.recipient_host))
      itemdiv.appendChild(dg.div({
        // style: { 'padding-left': '0px' }
      }, dg.div({
        style: {
          // 'margin-left': '0px',
          'font-size': '12px'
        }
      },
      fullname + ':')))
      itemdiv = itemdiv.firstChild
      alog.record._date_created = alog._date_created
      alog.record._date_modified = alog._date_modified
      alog = alog.record
    }

    itemdiv.appendChild(dg.span(
      // favicon
      dg.span(
        dg.img({
          style: {
            'vertical-align': 'top',
            'padding-top': '2px',
            width: '15px',
            height: '15px',
            'margin-left': '5px',
            'margin-right': '5px'
          },
          src: (alog.vulog_favIconUrl ? alog.vulog_favIconUrl : (this.getdomain(alog.url) + '/favicon.ico')),
          onerror: function () {
            this.onerror = null
            this.src = 'favicon_www.png'
          }
        })
      ),
      // title
      dg.span({
        style: {
          overflow: 'hidden',
          'text-overflow': 'ellipsis',
          'font-weight': 'bold',
          'font-size': '14px',
          cursor: 'pointer',
          width: '500px',
          height: '18px',
          display: 'inline-block',
          'vertical-align': 'top',
          color: MCSS.DARK_GREY
        },
        onclick: function () {
          chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            // onsole.log("tabs[0].url",tabs[0].url)
            if (that.viewMode === 'markInTab' || tabs[0].url.indexOf('chrome-extension') === 0) {
              const left = window.screenLeft !== undefined ? window.screenLeft : window.screenX
              const top = window.screenTop !== undefined ? window.screenTop : window.screenY
              const height = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height
              that.urlwin = window.open(alog.url, 'window', 'width=800, height=' + height + ',  left =' + (left + 500) + ', top=' + top + '') // toolbar=0, menubar=0,
            } else {
              chrome.tabs.sendMessage(tabs[0].id, { action: 'loadurl', url: alog.url }, function (response) {
                console.warn('GOT ERROR ON RETURN from loadurl')
                window.open(alog.purl, '_blank')
              })
            }
          })
        }
      },
      (alog.title ? (alog.domainApp + ' - ' + alog.title) : alog.url)
      )
    ))

    // Stars / top header
    // chevron arrow
    const toptag = dg.div(
      {
        style: { 'margin-left': '25px', 'margin-top': '-6px', 'font-size': '12px', color: 'darkgrey', cursor: 'pointer' },
        onclick: function (evt) {
          const blocktotoggle = this.nextSibling// this.parentElement.nextSibling
          var isExpanded = toggleCollapse(blocktotoggle)
          const arrow = evt.target.parentElement.firstChild // evt.target.className.includes('fa-chevron') ? evt.target : evt.target.firstChild
          arrow.className = isExpanded ? ('fa-chevron-down hist_details_expanded') : ('fa-chevron-right  hist_details_collapse')
        }
      }
    )

    // add non-changeable stars
    const topstarspan = lister.addTopStarSpan(alog, null, options.leaveOpen, options.source)
    // toptaginner.appendChild(dg.span(topstarspan))
    toptag.appendChild(dg.span(topstarspan))

    itemdiv.appendChild(toptag)

    const bookmarkchoices = function () { // part of detailsdiv-
      if (['messages', 'sentMsgs'].includes(options.tabtype)) return dg.span()
      return dg.div({
        style: { 'margin-top': '10px', 'margin-bottom': '10px', 'margin-left': '19px', padding: '2px', color: 'darkgray', 'font-size': '12px' }
      }, lister.addBookmarkChoices(alog, topstarspan, options.source))
    }
    const detailsdiv = dg.div({
      style: {
        'padding-left': '45px',
        height: options.leaveOpen ? 'auto' : '0px',
        overflow: 'hidden',
        transition: 'height 0.3s ease-out',
        width: '500px',
        'font-size': '14px'
      }
    },
    dg.div({ style: { 'margin-top': '3px', color: 'darkgray', 'font-size': '11px' } },
      dg.div({ style: { 'margin-bottom': '3px', color: 'darkgray' } },
        'Created: ' + (new Date(alog.vCreated || alog._date_created).toLocaleDateString() + ' ' + (alog.vCreated ? (' (Modified: ' + (new Date(alog._date_modified || alog.fj_modified_locally).toLocaleDateString()) + ')') : ''))),
      dg.div({ style: { 'margin-bottom': '3px', color: 'darkgray' } },
        dg.a({ href: alog.purl, target: '_blank' }, 'full url:' + alog.purl)),
      dg.div({ style: { 'margin-bottom': '3px', color: 'darkgray', display: (alog.referrer ? 'block' : 'none') } },
        dg.a({ href: alog.referrer, target: '_blank' },
          'referred by: ' + alog.referrer))
    ),
    bookmarkchoices(),
    vulogOverlayGlobal.drawCommentsSection(alog, alog.purl, { markId: (alog.id || alog.fj_local_temp_unique_id) })
    // lister.drawNote(alog, options)
    )

    if (alog.vHighlights && alog.vHighlights.length > 0) {
      if (alog.vHighlights) alog.vHighlights.forEach((item, i) => detailsdiv.appendChild(lister.drawHighlight(item, alog.purl, { include_delete: false, show_display_errs: false })))
    }

    if (options.leaveOpen) detailsdiv.setAttribute('data-collapsed', 'true')

    itemdiv.appendChild(detailsdiv)
  },

  // non-clickable stars on top of current tab and list tab
  addTopStarSpan: function (alog, topstarspan, divIsOpen, source) {
    if (!topstarspan) {
      topstarspan = dg.span()
    }
    topstarspan.innerHTML = ''
    topstarspan.appendChild(dg.span({
      className: divIsOpen ? ('fa-chevron-down hist_details_expanded') : ('fa-chevron-right  hist_details_collapse'),
      // className: 'fa-chevron-' + (divIsOpen ? 'down' : 'right') + ' hist_details_collapse',
      style: { cursor: 'pointer', color: (alog._id ? 'green' : 'cornflowerblue'), 'padding-right': '3px' }
    }))
    // add date if source is referrer
    if (source !== 'date') {
      topstarspan.appendChild(dg.span((new Date(alog._date_modified || alog.fj_modified_locally).toLocaleDateString()) + ' '))
    }
    let chosenstars = (alog.vStars && alog.vStars.length > 0) ? [...alog.vStars] : []
    if ((alog.vNote && alog.vNote.length > 0) || (alog.vComments && alog.vComments.length > 0)) chosenstars.push('sticky-note')
    if (alog.vHighlights && alog.vHighlights.length > 0) chosenstars = [...chosenstars, ...['quote-left', 'quote-right']]
    chosenstars.forEach(aStar => {
      topstarspan.appendChild(dg.span({
        className: 'fa fa-' + aStar + ' littlestars chosen-star'
      }))
      if (aStar === 'sticky-note') {
        const text = alog.vNote || ((alog.vComments && alog.vComments.length > 0 && alog.vComments[0].text) ? alog.vComments[0].text : '')
        topstarspan.appendChild(dg.span({ style: { 'margin-right': '5px' } }, ('"' + text.substring(0, 100) + '..." ')))
      } else if (aStar === 'quote-left') {
        topstarspan.appendChild(dg.span({ style: { 'margin-left': '-3px', 'margin-right': '2px' } }, (alog.vHighlights.length + ' highlight' + (alog.vHighlights.length > 1 ? 's' : ''))))
      }
    })

    if (!alog.vNote || alog.vNote.length === 0) topstarspan.appendChild(dg.span(' see details'))

    return topstarspan
  },
  updateStarsDiv: function (amark, topstarspan) {
    if (currentLog && amark.purl === currentLog.purl) {
      lister.drawStarsDiv('currentStars', amark.vStars)
      dg.el('addRemoveStars', { clear: true }).appendChild(lister.addBookmarkChoices(amark))
      if (amark.vStars && amark.vStars.length > 0) {
        dg.el('currentStars').style.height = '30px'
      }
    }
    if (topstarspan) {
      lister.addTopStarSpan(amark, topstarspan, true)
    }
  },
  drawStarsDiv: function (divName, starList, options) {
    const starEl = dg.el(divName, { clear: true })
    if (starList && starList.length > 0) {
      starList.forEach(function (starName) {
        starEl.appendChild(dg.span({
          className: 'fa fa-' + starName + ' chosen-star',
          style: { 'margin-right': '5px' }
        }))
      })
    }
  },

  // adding to bookmarks
  addBookmarkChoices: function (log, topstarspan, source) {
    const choiceEl = dg.span()
    MAIN_STARS.forEach(starName => {
      choiceEl.appendChild(lister.starAdder(starName, log, topstarspan, source))
    })
    return choiceEl
  },
  starLabel: function (starName) {
    const STAR_LABELS = {
      inbox: 'inbox', star: 'favorites', archive: 'archive'
    }
    return STAR_LABELS[starName]
  },
  starAdder: function (starName, log, topstarspan, source) {
    log = log || {}
    const starList = (log.vStars) ? log.vStars : []
    const doRemove = starList.includes(starName)

    return dg.span({
      className: 'cepsbutton',
      style: {
        width: '40px',
        'margin-right': '5px',
        padding: '2px 0px 2px 0px'
      },
      onclick: function (evt) {
        chrome.runtime.sendMessage({
          msg: 'mark_star',
          purl: (log.purl || null),
          id: (log._id || log.fj_local_temp_unique_id || null),
          theStar: starName,
          doAdd: !doRemove,
          // publishChange: publishChange,
          tabinfo: tabinfo
        }, function (response) {
          if (!response || response.error) {
            showWarning((response ? response.error : 'Error saving mark.'))
          } else {
            if (doRemove) {
              var starIdx = log.vStars.indexOf(starName)
              if (starIdx > -1) log.vStars.splice(starIdx, 1)
            } else if (!log.vStars) {
              log.vStars = [starName]
            } else {
              log.vStars.push(starName)
            }
            lister.updateStarsDiv(log, topstarspan)
            const bookMarkChoiceHolder = evt.target.parentElement.parentElement
            removeChildren(bookMarkChoiceHolder)
            lister.markUpdater.updated()
            bookMarkChoiceHolder.appendChild(lister.addBookmarkChoices(log, topstarspan, source))
          }
        })
      }
    },
    dg.span({ className: 'fa fa-' + starName + ' tinystars ' + (doRemove ? 'redstars' : 'bluestars'), style: { 'margin-left': '5px', 'margin-right': '2px' } }),
    dg.div({ style: { display: 'inline-block', 'min-width': '90px' } }, (doRemove ? 'Remove' : 'Add to ' + lister.starLabel(starName)))
    )
  },

  // draw highlights
  drawHighlight: function (item, purl, options) {
    // onsole.log('drawHighlight ', { item })
    let deleter = dg.div({})
    let displayErrDiv = dg.div({})
    if (options.include_delete) {
      deleter = dg.div({
        className: 'del_quote',
        onclick: function (e) {
          const hlightId = this.getAttribute('hlightId')
          // todo - change this to removeHighlight
          chrome.runtime.sendMessage({ msg: 'removeHighlight', url: marks.current.purl, hlightId: hlightId }, function (response) {
            if (!response || !response.success) {
              showWarning('Error trying to delete highlight (' + response.error + ')')
            } else {
              chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'refresh' }, function (response) {
                  e.target.parentElement.style.color = MCSS.red
                  e.target.parentElement.style['margin-left'] = '30px'
                  e.target.parentElement.innerHTML = ''
                })
              })
            }
          })
        },
        style: { display: 'none' }
      }, 'Click again here to remove quote')
      deleter.setAttribute('hlightId', item.id)
    }
    if (options.show_display_errs && item.displayErrDiv) {
      displayErrDiv = dg.div({ className: 'quote_display_err' },
        'This quote was not found and so it is not highlighted on the page')
    }
    const commentSection = function () {
      const hasAnnotations = (item.vComments && item.vComments.length > 0)
      const commentInner = vulogOverlayGlobal.drawCommentsSection(item, purl, { hlightId: item.id })
      return dg.div(dg.div({
        style: { color: 'blue', width: '100%', 'text-align': 'right', cursor: 'pointer', display: (hasAnnotations ? 'none' : 'block') },
        onclick: function (e) {
          e.target.nextSibling.style.display = 'block'
          e.target.style.display = 'none'
        }
      },
      '+ Annotate '),
      dg.div({
        style: { 'margin-left': '50px', 'margin-top': '4px', border: '1px solid lightgrey', 'border-radius': '3px', background: 'white', display: (hasAnnotations ? 'block' : 'none') }
      }, commentInner))
    }
    return dg.div({ className: 'quote_outer' },
      dg.span({ className: 'quote_left' }),
      dg.span({
        className: 'quote_close',
        style: { display: (options.include_delete ? 'block' : 'none') },
        onclick: function (e) {
          dg.toggleShow(e.target.nextSibling.nextSibling.nextSibling)
        }
      }),
      dg.span({
        className: 'quote_inner',
        style: { 'background-color': ((item.color && COLOR_MAP[item.color]) ? COLOR_MAP[item.color] : 'yellowgreen') }
      },
      dg.span(item.string),
      displayErrDiv,
      commentSection()
      ),
      dg.span({ className: 'quote_right' }),
      deleter
    )
  },

  inbox: {
    searchParams: {
      words: [],
      star_filters: ['inbox'],
      exstar_filters: ['archive'],
      count: SEARCH_COUNT
    },
    pages: [],
    groupBy: 'date',
    meta: {}
  },

  bookmarks: {
    searchParams: {
      words: [],
      star_filters: [],
      exstar_filters: [],
      count: SEARCH_COUNT
    },
    pages: [],
    groupBy: 'date',
    meta: {}
  },

  messages: {
    searchParams: {
      words: [],
      star_filters: [],
      exstar_filters: [],
      count: SEARCH_COUNT
    },
    pages: [],
    groupBy: 'date',
    meta: {}
  },

  sentMsgs: {
    searchParams: {
      words: [],
      star_filters: [],
      exstar_filters: [],
      count: SEARCH_COUNT
    },
    pages: [],
    groupBy: 'date',
    meta: {}
  },

  showSearch: function (page, tabName) {
    window.scrollTo(0, 0)
    if (dg.el('inbox_toptitle')) dg.el('inbox_toptitle').scrollIntoView()
    const mainDiv = dg.el('vulog_' + tabName + '_records', { clear: true })
    if (tabName === 'bookmarks') {
      mainDiv.appendChild(dg.div({ id: 'searchFilterChoices' }))
      lister.redrawSearchFilters(tabName, 'searchFilterChoices')
    }
    mainDiv.appendChild(lister.drawItems(lister[tabName].pages[page].results, { groupBy: lister[tabName].groupBy, tabtype: tabName }))

    const len = lister[tabName].pages.length
    const noMore = lister[tabName].pages[len - 1].results.length < SEARCH_COUNT
    const more = dg.div({ style: { color: 'darkgrey', 'margin-top': '20px', 'margin-bottom': '20px', 'font-size': '10px' } }, 'Pages: ')
    for (let i = 0; i < len; i++) {
      const samePage = (i === page)
      more.appendChild(dg.span({
        style: { 'margin-right': '5px', color: (samePage ? 'darkgrey' : 'cornflowerblue'), cursor: (samePage ? '' : 'pointer') },
        onclick: samePage ? null : function (evt) {
          const page = parseInt(evt.target.innerText) - 1
          lister.showSearch(page, tabName)
        }
      }, ('' + (i + 1))))
    }

    if (!noMore) {
      more.appendChild(dg.span({
        style: { color: 'cornflowerblue', cursor: 'pointer' },
        onclick: function (evt) {
          lister.doSearch(len, tabName)
        }
      }, 'More'))
    }
    mainDiv.appendChild(more)
  },
  doSearch: function (page, tabName, fromPopState = false) {
    var queryParams = lister[tabName].searchParams
    queryParams.skip = lister[tabName].pages.length * SEARCH_COUNT

    // if (tabName !== 'inbox') lister.addToPopState(tabName, fromPopState)
    if (history.pushState && typeof history.pushState === 'object') lister.addToPopState(tabName, fromPopState)

    const list = (['messages', 'sentMsgs'].includes(tabName)) ? tabName : 'marks'

    const searchCallback = function (response) {
      const mainDiv = dg.el('vulog_' + tabName + '_records', { clear: true })
      if (!response || !response.success) {
        console.warn('Something went wrong. Sorry. Please do try again.', response)
        mainDiv.innerText = 'Something went wrong. Sorry. Please do try again.'
      } else if (response.results.length === 0) {
        dg.hideEl('click_switchGroupByview') // console.log - todo- need to draw this not hardocde it
        if (tabName === 'inbox') {
          mainDiv.innerText = '\n\nYour inbox is empty. \n\n Add items to your inbox from the Current tab, or when you are on a web page, rightclick any link and add it to your inbox. '
        } else {
          mainDiv.appendChild(dg.div({ id: 'searchFilterChoices' }))
          if (!['messages', 'sentMsgs'].includes(tabName)) lister.redrawSearchFilters(tabName, 'searchFilterChoices')
          mainDiv.appendChild(dg.div({ style: { 'margin-top': '20px' } },
            (tabName === 'messages'
              ? (page === 0 ? 'No messages have been shared with you' : 'No more messages found')
              : (tabName === 'sentMsgs' ? (page === 0 ? 'You have not sent any messages yet' : 'No more messages found')
                : (page === 0 ? 'You have not bookmarked anything yet' : 'No more bookmarks found'))
            )
          ))
        }
      } else if (response.results.length > 0) {
        lister[tabName].pages[page] = { results: response.results }
        lister.showSearch(page, tabName)
      }
    }

    if (list === 'sentMsgs') {
      var params = { app_table: 'dev.ceps.messages.sent', count: SEARCH_COUNT, appToken: freezrMeta.appToken, q: { app_id: 'com.salmanff.vulog' } }
      if (queryParams.skip) params.skip = queryParams.skip
      // console.log - need to add more sophisticated earch here for msgs and others
      freezr.feps.postquery(params, (error, response) => {
        searchCallback({ results: response, success: (!error), error })
      })
    } else {
      chrome.runtime.sendMessage({ msg: 'searchLocally', list, queryParams }, searchCallback)
    }
  },

  addToPopState: function (tabName, fromPopState) {
    const queryParams = lister[tabName].searchParams
    if (!fromPopState) {
      let stateUrl = '?vulogTab=' + thisTab // +'&stars=inbox'
      if (queryParams.star_filters.length > 0) {
        const addquery = queryParams.star_filters.join(' ').replace('star', 'favorite')
        stateUrl += '&stars=' + addquery
      }
      if (queryParams.exstar_filters.length > 0) {
        const addquery = queryParams.exstar_filters.join(' ').replace('star', 'favorite')
        stateUrl += '&notstars=' + addquery
      }
      if (queryParams.words.length > 0 && queryParams.words.join('').trim() !== '') stateUrl += '&words=' + queryParams.words.join(' ')
      stateUrl += '&groupBy=' + lister[tabName].groupBy
      history.pushState(null, '', stateUrl)
    }
  },
  loadUrlParams: function (searchBox) {
    const urlParams = (new URL(document.location)).searchParams
    const theTab = urlParams.get('vulogTab') || 'bookmarks'
    if (theTab === 'bookmarks') {
      const starfilters = urlParams.get('stars')
      if (starfilters) lister.bookmarks.searchParams.star_filters = starfilters.replace('favorite', 'star').split(' ')
      const exStarfilters = urlParams.get('notstars')
      if (exStarfilters) lister.bookmarks.searchParams.exstar_filters = exStarfilters.replace('favorite', 'star').split(' ')
      if (urlParams.get('groupBy')) lister.bookmarks.groupBy = urlParams.get('groupBy')
      const words = urlParams.get('words') || ''
      searchBox.innerText = words.trim()
    }
    return theTab
  },

  redrawSearchFilters: function (tabName, filterDivId) {
    dg.el(filterDivId).appendChild(dg.span('Filters by bookmark '))
    var includeFilters = dg.span({ className: 'longcepsButt' }, 'Must have: ')
    MAIN_STARS.forEach(starName => { includeFilters.appendChild(lister.filterAdder(tabName, starName, 'include')) })
    dg.el(filterDivId).appendChild(includeFilters)
    var excludeFilters = dg.span({ className: 'longcepsButt' }, 'Cannot have: ')
    MAIN_STARS.forEach(starName => { excludeFilters.appendChild(lister.filterAdder(tabName, starName, 'exclude')) })
    dg.el(filterDivId).appendChild(excludeFilters)
  },

  filterAdder: function (tabName, starName, type) {
    const listName = (type === 'include' ? 'star_filters' : 'exstar_filters')
    const isInParams = lister[tabName].searchParams[listName].includes(starName)
    const starColor = isInParams ? ((type === 'include') ? 'greenstars' : 'redstars') : 'greystars'
    return dg.span({
      className: 'fa fa-' + starName + ' littlestars markmiddle ' + starColor,
      style: { 'margin-left': '5px', 'margin-right': '2px' },
      onclick: function (evt) {
        const isChosen = !evt.target.className.includes('greystars')
        if (!isChosen) {
          lister[tabName].searchParams[listName] = addToListAsUniqueItems(lister[tabName].searchParams[listName], starName)
          evt.target.className = evt.target.className.replace('greystars', ((type === 'include') ? 'greenstars' : 'redstars'))
        } else {
          // if (isChosen)
          lister[tabName].searchParams[listName] = removeFromlist(lister[tabName].searchParams[listName], starName)
          evt.target.className = evt.target.className.replace(((type === 'include') ? 'greenstars' : 'redstars'), 'greystars')
        }
        // linter: searchInTab should be passed in here
        searchInTab()
      }
    })
  },

  // utilities
  getdomain: function (aUrl) {
    if (!aUrl) return 'Missing aUrl'
    var start = aUrl.indexOf('//') + 2
    var stop = aUrl.slice(start).indexOf('/')
    return aUrl.slice(0, stop + start)
  },

  markUpdater: {
    lastUpdate: new Date().getTime(),
    updated: function () {
      lister.markUpdater.lastUpdate = new Date().getTime()
    },
    checkBackgroundForChanges: function () {
      chrome.runtime.sendMessage({ msg: 'get_recent_marks' }, function (response) {
        response.recentMarks.forEach(item => {
          if (item._date_modified > lister.markUpdater.lastUpdate || item.fj_modified_locally > lister.markUpdater.lastUpdate) {
            const itemdiv = dg.el(lister.idFromMark(item))
            const collapsable = (itemdiv && itemdiv.firstChild && itemdiv.firstChild.nextSibling && itemdiv.firstChild.nextSibling.nextSibling) ? itemdiv.firstChild.nextSibling.nextSibling : null
            if (itemdiv && collapsable) {
              const isCollapsed = !collapsable.getAttribute('data-collapsed') || collapsable.getAttribute('data-collapsed') === 'false'
              itemdiv.innerHTML = ''
              lister.drawmarkDetails(itemdiv, item, { source: itemdiv.getAttribute('group-type'), tabtype: 'bookmarks', leaveOpen: !isCollapsed })
            }
            lister.bookmarks.pages.forEach((page, i) => {
              page.results.forEach((storeditem, j) => {
                if (storeditem.purl === item.purl) page.results[j] = item
              })
            })
          }
        })
        lister.markUpdater.updated()
      })
    }
  }
}

const removeChildren = function (parent) {
  while (parent.firstChild) {
    parent.firstChild.remove()
  }
}
