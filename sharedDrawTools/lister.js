
// version 0.0.2 - apr 2024

/* global screen, IntersectionObserver, freepr, freezr */ // from system
/* global domainAppFromUrl, overlayUtils, convertDownloadedMessageToRecord, mergeMessageRecords  */ // from utils
/* global dg */ // from dgelements.js
/* from popupChromeExt - added a dummy */
/* global  collapseIfExpanded, expandSection */ // from drawUtils
/* global vState */ // from view.js
/* global convertMarkToSharable, resetVulogKeyWords, dateLatestMessageSorter, sortBycreatedDate, convertPasteToText, convertLogToMark, getParentWithClass, MCSS, markMsgHlightsAsMarked */ // from utils

// const SEARCH_COUNT = 40

const lister = {}
// Initialization and search
lister.setDivListeners = function (vState) {
  const { divs } = vState
  if (!divs || !divs.searchBox || !divs.main || !divs.searchButton) {
    console.error('need divs for lister to work')
    return
  }
  divs.searchBox.onkeypress = function (evt) {
    if (evt.key === 'Enter') { evt.preventDefault() }
  }
  divs.searchBox.onkeyup = async function (e) {
    await lister.filterItemsInMainDivOrGetMore(vState, 'searchChange')
  }
  divs.searchBox.onpaste = async function (e) {
    convertPasteToText(e)
    await lister.filterItemsInMainDivOrGetMore(vState, 'searchChange')
  }
  divs.searchButton.onclick = async function (e) {
    await lister.filterItemsInMainDivOrGetMore(vState, 'searchChange')
  }
  if (divs.dateFilter) {
    divs.dateFilter.onkeyup = async function (e) {
      if (e.key === 'Enter') {
        e.preventDefault()
        await lister.filterItemsInMainDivOrGetMore(vState, 'searchChange')
        vState.calendar.hideCalendar()
        divs.dateFilter.blur()
      }
    }
  }
}
lister.getUrlParams = function () {
  const urlParams = (new URL(document.location)).searchParams
  const list = urlParams.get('view') || 'marks'

  const queryParams = { list }

  queryParams.words = urlParams.get('words') || null
  queryParams.starFilters = urlParams.get('stars') || null
  // queryParams.notStarfilters = urlParams.get('notstars') || null
  // queryParams.startDate = urlParams.get('startdate') || null
  queryParams.date = urlParams.get('date') || null

  return queryParams
}
lister.setUrlParams = function () {
  // todo - add all queryParams to the url
}
lister.getQueryParams = function () {
  vState.queryParams.words = lister.getSearchBoxParams(vState.divs.searchBox)
  const readDate = vState.divs?.dateFilter?.value ? new Date(vState.divs.dateFilter.value) : null
  // if (readDate) readDate.setUTCHours(23,59,59,999)
  if (readDate) readDate.setDate(readDate.getDate() + 1)
  vState.queryParams.date = isNaN(readDate) ? null : readDate
  if (isNaN(readDate)) vState.divs.dateFilter.value = ''
  return vState.queryParams
  // vState.queryParams.filterStars shoudl already be set... but really should be moved here for consistency
}
lister.getSearchBoxParams = function (searchBox) {
  return searchBox.textContent || ''
}

// draw structure
lister.drawAllItemsForList = async function (vState) {
  // called on load and also when new menu items are chosen
  const list = vState.queryParams.list
  const mainDiv = vState.divs.main
  mainDiv.innerHTML = ''
  
  // onsole.log('drawAllItemsForList', { list })

  window.scrollTo(0, 0)

  lister.createOuterDomStructure(vState)
  lister.drawFilters(vState)

  let gotErr = false

  vState.loadState.source = 'initialLoad'

  // populate marks to show some of the marks on history in any case
  if (!vState.marks && !vState.isPublicView) {
    vState.marks = lister.emptyStatsObj()
    vState.marks.lookups = {}
    
    try {
      await lister.getMoreAndUpdateCountStatsFor('marks', vState)
    } catch (e) {
      console.warn('error in drawAllItemsForList ', e)
      gotErr = true
    }
  }

  if (vState[list]?.unfilteredItems && vState[list].unfilteredItems.length > 0) {
    if (list === 'tabs') console.error('snbh drawAllItemsForList')
    lister.drawCardsOnMainDiv(list, vState[list].unfilteredItems, mainDiv)
    vState.divs.spinner.style.display = 'none'
  } else if (!gotErr && vState[list] && vState[list].unfilteredItems.length === 0) {
    vState.divs.spinner.style.display = 'none'
    lister.endCard.showNoMore()
  } else if (!gotErr) {
    try {
      const newItems = await lister.getMoreItems(vState)
      lister.drawCardsOnMainDiv(list, newItems, mainDiv)
      vState.divs.spinner.style.display = 'none'
    } catch (e) {
      console.warn('error in drawAllItemsForList ', e)
      gotErr = true
    }
  }
  if (gotErr) {
    vState.showWarning('There was a problem syncing with the server. Sorry.', 2000)
  } else {
    setTimeout(() => {
      if (list !== 'tabs') lister.filterItemsInMainDivOrGetMore(vState, 'initialLoad')
    }, 20)
  }
}
lister.emptyFlexBox = function () {
  return dg.div({ style: { display: 'flex', 'flex-wrap': 'wrap', 'justify-content': 'flex-start' } })
}
lister.endSpacer = function () {
  return dg.div({ style: { height: '300px', width: (document.body.getClientRects()[0].width - 100 + 'px'), 'min-height': '300px ' } })
}
lister.createOuterDomStructure = function (vState) {
  const list = vState.queryParams.list
  const mainDiv = vState.divs.main
  mainDiv.innerHTML = ''

  if (list === 'marks' || list === 'history' || list === 'tabs' || list === 'messages' || list === 'publicmarks') {
    const outer = dg.div({ className: (vState.viewType === 'fullHeight' ? 'heightColumsGridOuter' : 'widthFlexGridOuter') }) // lister.emptyFlexBox()
    mainDiv.appendChild(outer)
    outer.appendChild(lister.endCard.create(vState))
    outer.appendChild(lister.endSpacer())
  } else {
    // atlernate way of doing history or others
    // const outer = list === 'marks' ? lister.emptyFlexBox() : dg.div()
    // mainDiv.appendChild(outer)
    // mainDiv.appendChild(lister.endCard.create(vState))
  }
}
lister.endCard = {
  inited: false,
  endCardStyle: { display: 'none', margin: '50px 10px', 'text-align': 'center', cursor: 'pointer', 'border-radius': '5px', background: 'white', padding: '5px' },
  create: function (vState) {
    const moreButt = dg.div({
      id: 'vulogMoreButt',
      style: lister.endCard.endCardStyle,
      onclick: async function (e) {
        lister.endCard.showLoading()
        await lister.filterItemsInMainDivOrGetMore(vState, 'moreButt')
      }
    }, 'more')
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    }
    const moreButtObserver = new IntersectionObserver(function () {
      if (lister.endCard.inited) lister.filterItemsInMainDivOrGetMore(vState, 'auto')
      lister.endCard.inited = true
    }, observerOptions)
    moreButtObserver.observe(moreButt)
    lister.endCard.inited = false // ugly hack fix of loading triggering automatically on start

    const noMoreButt = dg.div({
      style: { display: 'none', margin: '50px 10px', 'text-align': 'center', 'border-radius': '5px', background: 'lightgrey', padding: '5px' }
    }, 'Nothing more to show.')

    const loadingButt = dg.div({ style: { width: '20px', margin: '50px 90px 10px' } }, smallSpinner() )
    //     const loadingButt = dg.div({ style: { width: '20px', margin: '50px 90px 10px' } }, dg.img({ src: (freezr.app?.isWebBased ? '/app_files/@public/info.freezr.public/public/static/ajaxloaderBig.gif' : '/freezr/static/ajaxloaderBig.gif') }))

    return dg.div({ style: { height: '200px', width: '200px', margin: '25px 15px 65px 15px', 'vertical-align': 'center', display: 'none' } },
      moreButt, noMoreButt, loadingButt)
  },
  showMore: function (vState) {
    const list = vState.queryParams.list
    const moreButt = dg.el('vulogMoreButt', { clear: true, show: true })
    moreButt.appendChild(dg.div(
      dg.span('Searched back to '), dg.br(),
      dg.span(new Date(vState[list].dates.oldestModified).toDateString()), dg.br(),
      dg.span({ style: { color: 'blue' } }, ' Get More...')))
    const endCard = moreButt.parentElement
    endCard.style.display = 'block'
    moreButt.nextSibling.style.display = 'none' // 'nomore'
    moreButt.nextSibling.nextSibling.style.display = 'none' // loading
  },
  showNoMore: function () {
    const moreButt = dg.el('vulogMoreButt', { clear: true, hide: true })
    moreButt.style.display = 'none'
    const nomoreButt = moreButt.nextSibling
    let text = ''
    const list = vState.queryParams.list
    if (!vState[list].unfilteredItems || vState[list].unfilteredItems.length === 0) {
      switch (list) {
        case 'marks':
          text = "You don't have any bookmarks yet. To book mark a page, click the extention icon on the top right of your browser window and mark it with a star or an inbox."
          break
        case 'history':
          text = 'hiper.cards is not logging your browsing history. To log browsing history go to settings and enable that.'
          break
          case 'tabs':
            text = 'Tabs will be added here soon.'
            break
        case 'messages':
          text = vState.freezrMeta.userId ?
            'To send your bookmark as a message, click the hiper.cards icon on the top right of your browser window to see your Sharing options.' :
            'To be able to send and receive message, you need to log in to a CEPS compatible server. Go to Settings for more guidance.'
          break
        default:
          text = 'Nothing more to show !'
      }
    }
    nomoreButt.innerText = text || 'Nothing more to show!!'
    nomoreButt.style.display = 'block'
    moreButt.nextSibling.nextSibling.style.display = 'none' // loading

    const endCard = moreButt.parentElement
    endCard.style.display = 'block'
  },
  hide: function () {
    const moreButt = dg.el('vulogMoreButt', { clear: true, hide: true })
    // const endCard = moreButt.parentElement
    // endCard.style.display = 'none'
    if (moreButt) moreButt.nextSibling.style.display = 'none' // 'nomore'
    if (moreButt) moreButt.nextSibling.nextSibling.style.display = 'block' // loading
  },
  showLoading: function () {
    const moreButt = dg.el('vulogMoreButt')
    moreButt.style.display = 'none'
    moreButt.nextSibling.style.display = 'none' // 'nomore'
    moreButt.nextSibling.nextSibling.style.display = 'block' // loading
  }
}
lister.drawCardsOnMainDiv = function (list, items, mainDiv) {
  if (!items || items.length === 0) return

  const outer = mainDiv.firstChild
  outer.className = (vState.viewType === 'fullHeight') ? 'heightColumsGridOuter' : 'widthFlexGridOuter'

  if (list === 'marks') {
    const moreDiv = outer.lastChild.previousSibling
    items.forEach(alog => {
      const theMark = lister.drawmarkItem(alog, vState, { tabtype: list })
      theMark.style.width = '0'
      theMark.style.margin = '0'
      theMark.firstChild.style.transform = 'rotateY(90deg)'
      outer.insertBefore(theMark, moreDiv)
    })
  } else if (list === 'publicmarks') {
    const moreDiv = outer.lastChild.previousSibling
    items.forEach(alog => {
      const theMark = lister.drawpublicmarkItem(alog, vState, { tabtype: list })
      theMark.style.height = '0'
      // xx fullHeight
      theMark.style.margin = '0'
      theMark.firstChild.style.transform = 'rotateX(90deg)'
      outer.insertBefore(theMark, moreDiv)
    })
  } else if (list === 'messages') {
    // for all new messages, check if already drawn and if so merge, and if not draw
    const moreDiv = outer.lastChild.previousSibling
    items.forEach(alog => {
      const theMark = lister.drawMessageItem(alog, vState, { tabtype: list })
      theMark.style.width = '0'
      theMark.style.margin = '0'
      theMark.firstChild.style.transform = 'rotateY(90deg)'
      outer.insertBefore(theMark, moreDiv)
    })
  } else if (list === 'history') {
    for (let i = items.length - 1; i > 0; i--) {
      const currentLog = items[i]
      const domainsAndReferrers = [domainAppFromUrl(currentLog.url)]
      if (currentLog.referrer) domainsAndReferrers.push(domainAppFromUrl(currentLog.referrer))

      let keepCheckingCollpasibles = true
      let j = i
      let urlOfFirstFoundReferrer = null
      while (keepCheckingCollpasibles && j-- > 0) {
        const nextItem = items[j]
        const nextItemDomain = nextItem ? domainAppFromUrl(nextItem.url) : null
        let nextItemeferrer = nextItem ? domainAppFromUrl(nextItem.referrer) : null
        if (nextItem && nextItem.referrer && !urlOfFirstFoundReferrer) urlOfFirstFoundReferrer = nextItem.referrer
        if (urlOfFirstFoundReferrer && urlOfFirstFoundReferrer !== nextItem?.url) nextItemeferrer = null
        if (!nextItem) {
          console.warn('missing item snbh??', { nextItem, currentLog, i, j })
        } else if (domainsAndReferrers.indexOf(nextItemDomain) > -1 || domainsAndReferrers.indexOf(nextItemeferrer) > -1) {
          items[j].vCollapsible = true
          domainsAndReferrers.push(nextItemDomain)
          if (nextItemeferrer) domainsAndReferrers.push(nextItemeferrer)
        } else {
          keepCheckingCollpasibles = false
        }
      }
    }

    if (!vState.tempUndrawnIds) vState.tempUndrawnIds = []

    const moreDiv = outer.lastChild.previousSibling
    moreDiv.style.display = 'none'
    for (let i = 0; i < items.length; i++) {
      const alog = items[i]
      if (alog.purl) {
        while (items[i + 1] && items[i + 1].purl === alog.purl) {
          vState.tempUndrawnIds.push(items[i + 1]._id)
          alog.vulog_max_scroll = Math.max(alog.vulog_max_scroll, items[i + 1].vulog_max_scroll)
          alog.vulog_visit_details = [...(alog.vulog_visit_details || []), ...(items[i + 1]?.vulog_visit_details || [])]
          i++
        }
        const theLogDiv = lister.drawlogItem(alog, vState, { tabtype: list })
        theLogDiv.style.width = '0'
        theLogDiv.style.margin = '0'
        theLogDiv.firstChild.style.transform = 'rotateY(90deg)'

        if (alog.vCollapsible) theLogDiv.setAttribute('vCollapsible', true)
        outer.insertBefore(theLogDiv, moreDiv)
      } else {
        console.warn('got log item with no purl', { alog })
      }
    }
    setTimeout(() => { moreDiv.style.dispaly = 'block' }, 100)
  } else if (list === 'tabs') {
    // const moreDiv = outer.lastChild.previousSibling

    // iterate open and closed tab
    const tabTypes = ['closedTabs'] //  ['openTabs', 'closedTabs'] // 
    tabTypes.forEach(tabStatus => {
      const windowTabs = items[tabStatus]
      if (windowTabs) {
        for (const [windowId, tabLogs] of Object.entries(windowTabs)) {
          for (const [tabId, logList] of Object.entries(tabLogs)) {
            // make sure duplicates are removed
            // const tabDiv = dg.div({ style: { border: '1px red solid', height: '150px' } })
            const tabDiv = lister.emptyFlexBox()
            tabDiv.style.border = '1px red solid'
            for (let i = logList.length - 1; i >= 0; i--) {
              const alog = logList[i]
              if (alog.purl) {
                const theLogDiv = lister.drawlogItem(alog, vState, { tabtype: list })
                theLogDiv.style.width = (i > 0 ? '5px' : '200px')
                theLogDiv.firstChild.style.background = (i > 0 ? 'grey' : 'white')
                if (i < logList.length - 1) theLogDiv.setAttribute('vCollapsible', true)
                tabDiv.appendChild(theLogDiv)
              } else {
                console.warn('got log item in tabs with no prul', { alog })
              }
            }
            outer.appendChild(tabDiv)
          }
          const seprator = dg.div({ style: lister.endCard.endCardStyle }, ' ')
          seprator.style.display = 'block'
          outer.appendChild(seprator)
        }
      }
    })
    lister.endCard.showNoMore()
  }
}

// draw marks and logs
lister.dims = {
  marks: {
    width: 200,
    height: 300
  },
  history: {
    width: 200,
    height: 200
  },
  messages: {
    width: 200,
    height: 360
  },
  publicmarks: {
    width: '100%',
    height: null
  }
}
lister.drawmarkItem = function (markOnMark, vState, opt = {}) {
  const { tabtype, expandedView, fromAutoUpdate } = opt
  const itemdiv = fromAutoUpdate
    ? dg.div()
    : lister.cardOuter(markOnMark, 'marks', expandedView)

  if (expandedView) itemdiv.setAttribute('expandedView', (expandedView))
  if (tabtype) itemdiv.setAttribute('tabtype', tabtype)
  itemdiv.setAttribute('purl', markOnMark.purl)
  itemdiv.className = 'cardOuter'

  const minMax = lister.minMaximizeButt(lister.idFromMark(markOnMark), vState)
  lister.minMaximizeButtSet(minMax, true)
  itemdiv.appendChild(minMax)

  itemdiv.appendChild(lister.domainSpanWIthRef(markOnMark, expandedView))

  const titleOuter = lister.titleOuter(expandedView)
  if (!markOnMark.url) console.warn('No url is markOnMark', { markOnMark })
  titleOuter.appendChild(lister.openOutside(markOnMark.url))

  const titleInner = dg.a({ style: { overflow: 'hidden', 'text-decoration': 'none' } }, (markOnMark.title || markOnMark.purl.replace(/\//g, ' ')))
  titleInner.setAttribute('href', markOnMark.url)
  titleOuter.appendChild(titleInner)

  itemdiv.appendChild(titleOuter)

  const stars = overlayUtils.drawstars(markOnMark, {
    drawTrash: true,
    trashFloatHide: true,
    markOnBackEnd: vState.markOnBackEnd
  })
  itemdiv.appendChild(dg.div({ className: 'starsOnCard', style: { 'text-align': 'center' } }, stars))

  itemdiv.appendChild(lister.imageBox(markOnMark.image))

  const summaryOuter = dg.div({ className: 'summarySharingAndHighlights' })
  summaryOuter.appendChild(lister.summarySharingAndHighlights(markOnMark))
  itemdiv.appendChild(summaryOuter)

  const notesBox = overlayUtils.drawMainNotesBox(markOnMark, { mainNoteSaver: vState.mainNoteSaver })
  notesBox.style.margin = '0px 0px 5px 0px'
  notesBox.style['max-height'] = '40px'
  notesBox.style.height = '40px'
  notesBox.style['overflow-y'] = 'scroll'
  itemdiv.appendChild(notesBox)

  const modifiedDate = new Date(markOnMark._date_modified || markOnMark.fj_modified_locally)
  const createdDate = new Date(markOnMark.vCreated || markOnMark._date_created)
  let dateString = 'Created: ' + (overlayUtils.smartDate(createdDate))
  if (modifiedDate - createdDate > 1000 * 60 * 60 * 24) dateString += ' Modified: ' + (modifiedDate.toLocaleDateString())
  itemdiv.appendChild(dg.div({ style: { color: 'indianred' } }, dateString))

  const hLightOptions = {
    type: 'markHighlights',
    purl: markOnMark.purl,
    markOnBackEnd: vState.markOnBackEnd,
    markOnMarks: markOnMark,
    logToConvert: null,
    hLightCommentSaver: vState.hLightCommentSaver,
    hLightDeleter: vState.hLightDeleter
  }
  if (!hLightOptions.hLightCommentSaver) console.error('No hLightOptions hLightCommentSaver  in drawmakr', { fromV: vState.hLightCommentSaver })
  itemdiv.appendChild(lister.newDrawHighlights(markOnMark.purl, markOnMark.vHighlights, hLightOptions)) //
  // previous;y allHighlights
  itemdiv.appendChild(overlayUtils.areaTitle('Sharing', { display: 'none' }))
  itemdiv.appendChild(lister.sharingDetailsSkeleton(markOnMark.purl))
  itemdiv.appendChild(overlayUtils.vMessageCommentDetails(markOnMark.purl, []))
  const msgHighLightoptions = JSON.parse(JSON.stringify(hLightOptions))
  msgHighLightoptions.hLightCommentSaver = vState.hLightCommentSaver
  msgHighLightoptions.type = 'msgHighLights'
  if (!msgHighLightoptions.hLightCommentSaver) console.error('No hLightOptions hLightCommentSaver msgHighLightoptions in drawmakr')
  itemdiv.appendChild(lister.newDrawHighlights(markOnMark.purl, [], msgHighLightoptions)) //

  return lister.addCard2ndOuter(itemdiv, 'marks')
}
lister.summarySharingAndHighlights = function (markOnMark) {
  const hasHighlights = (markOnMark.vHighlights && markOnMark.vHighlights.length > 0)
  const summarySharingAndHighlights = dg.div({
    style: { display: 'grid', 'grid-template-columns': (hasHighlights ? '1fr 1fr' : '1fr'), cursor: 'pointer', padding: '2px' }
  })
  if (markOnMark.vHighlights && markOnMark.vHighlights.length > 0) {
    const highlightSum = dg.div({ style: { overflow: 'hidden', color: '#057d47', 'padding-top': '3px' } },
      dg.div((markOnMark.vHighlights.length + ' highlights'),
        dg.div({ style: { overflow: 'hidden', 'text-overflow': 'ellipsis', height: '18px', 'margin-bottom': '-5px' } }, 'Click to see')))
    highlightSum.onclick = async function () { await lister.setItemExpandedStatus(lister.idFromMark(markOnMark), vState) }
    summarySharingAndHighlights.appendChild(highlightSum)
  } else {
    summarySharingAndHighlights.appendChild(dg.div(dg.div()))
  }

  const sharingSpan = vState.isLoggedIn ? lister.allPeopleSharedWith(markOnMark) : dg.span('Expand for details')
  const sharingButt = dg.div(
    { style: { 'text-align': 'center', color: 'purple', height: '32px', overflow: 'hidden', padding: '2px 5px 2px 5px' } }, sharingSpan)
  sharingButt.onclick = async function () { await lister.setItemExpandedStatus(lister.idFromMark(markOnMark), vState) }
    // : function () { window.open('logInPage', '_self') }
  summarySharingAndHighlights.appendChild(sharingButt)
  return summarySharingAndHighlights
}
lister.drawpublicmarkItem = function (markOnMark, vState, opt = {}) {
  const { fromAutoUpdate } = opt
  const itemdiv = fromAutoUpdate
    ? dg.div()
    : lister.cardOuter(markOnMark, 'publicmarks', false)

  itemdiv.setAttribute('purl', markOnMark.purl)
  itemdiv.className = 'cardOuter'

  // itemdiv.style['max-height'] = '300px'
  if (vState.viewType === 'fullHeight') {
    itemdiv.style.display = 'inline-block'
    itemdiv.style.width = '100%'
    itemdiv.style['margin-bottom'] = '10px'
    itemdiv.style['box-sizing'] = 'border-box'
  }

  // itemdiv.style.overflow = 'scroll'

  const hasComments = (markOnMark.vComments && markOnMark.vComments.length > 0)
  if (hasComments) {
    markOnMark.vComments.forEach(vComment => {
      if (!vComment.sender_id) vComment.sender_id = markOnMark._data_owner
      itemdiv.appendChild(overlayUtils.oneComment(markOnMark.purl, vComment, {
        isReceived: true, noreply: true, addPerson: true, nofrom: true
      }))
    })
  }

  const domainOuter = dg.div()
  domainOuter.appendChild(lister.domainSpanWIthRef(markOnMark, true))
  domainOuter.firstChild.appendChild(lister.openOutside(markOnMark.url, { nomargin: true }))
  itemdiv.appendChild(domainOuter)

  const titleOuter = lister.titleOuter(true)
  const titleInner = dg.a({ style: { overflow: 'hidden', 'text-decoration': 'none' } }, (markOnMark.title || markOnMark.purl.replace(/\//g, ' ')))
  titleInner.setAttribute('href', markOnMark.url)
  titleOuter.appendChild(titleInner)
  itemdiv.appendChild(titleOuter)

  const hasImg = Boolean(markOnMark.image)
  const hasDescript = Boolean(markOnMark.description)
  const hasHighlights = (markOnMark.vHighlights && markOnMark.vHighlights.length > 0)

  const titleGrid = dg.div({
    className: 'topTitleGrid',
    style: { display: 'grid', 'grid-template-columns': ((hasImg ? '1fr' : '') + (hasDescript ? ' 1fr' : '')), padding: '2px' }
  })
  if (hasDescript) {
    titleGrid.appendChild(dg.div({ style: { 'max-height': (hasHighlights ? '100px' : null), overflow: 'hidden', 'text-overflow': 'ellipsis', color: 'darkgrey' } }, markOnMark.description))
  }
  if (hasImg) {
    const imgBox = lister.imageBox(markOnMark.image, { 'border-radius': '20px', 'margin-top': '0px', 'max-height': '95px', 'max-width': '100%' })
    imgBox.style['max-height'] = '100px'
    imgBox.style.height = '100px'
    imgBox.style.padding = '0px 5px'
    titleGrid.appendChild(imgBox)
  }
  itemdiv.appendChild(titleGrid)

  if (hasHighlights) {
    const titleOuter = dg.div()
    const title = overlayUtils.areaTitle('Highlights', { display: 'inline-block' })
    title.style.width = '100%'
    titleOuter.appendChild(title)

    //  display: 'block', 'text-align': 'right', padding: '5px 0px', width: '100%',
    const openWithVulog = dg.a({ style: { float: 'right', 'font-size': 'small', 'font-weight': 'normal' } }, 'Open with hiper.cards')
    openWithVulog.setAttribute('href', '/' + markOnMark._id + '?vulogredirect=true')
    openWithVulog.setAttribute('target', '_blank')
    titleOuter.firstChild.appendChild(openWithVulog)

    itemdiv.appendChild(titleOuter)

    markOnMark.vHighlights.forEach(hlight => {
      if (hlight.vComments && hlight.vComments.length > 0) {
        hlight.vComments.forEach(comment => {
          if (!comment.sender_id) comment.sender_id = markOnMark._data_owner
        })
      }
      itemdiv.appendChild(overlayUtils.drawHighlight(markOnMark.purl, hlight, { noThreeDots: true, isReceived: true, noreply: true, addPerson: true, nofrom: true }))
    })
  } else {
    titleGrid.appendChild(dg.div({ style: { 'min-height': '20px' } }))
  }

  const postedDate = new Date(markOnMark._date_published || markOnMark._date_modified)
  const dateString = 'Posted: ' + (overlayUtils.smartDate(postedDate))
  itemdiv.appendChild(dg.div({ style: { color: 'indianred', float: 'right' } }, dateString))

  itemdiv.appendChild(overlayUtils.vMessageCommentDetails(markOnMark.purl, []))

  return lister.addCard2ndOuter(itemdiv, 'publicmarks')
}
lister.drawlogItem = function (logItem, vState, opt = {}) {
  const { tabtype, expandedView, fromAutoUpdate } = opt
  const itemdiv = fromAutoUpdate
    ? dg.div()
    : lister.cardOuter(logItem, 'history', expandedView)

  itemdiv.setAttribute('vulogId', lister.idFromMark(logItem))
  itemdiv.setAttribute('purl', logItem.purl)
  if (expandedView) itemdiv.setAttribute('expandedView', (expandedView))
  if (tabtype) itemdiv.setAttribute('tabtype', tabtype)
  itemdiv.className = 'cardOuter'

  const minMax = lister.minMaximizeButt(lister.idFromMark(logItem), vState)
  lister.minMaximizeButtSet(minMax, true)
  itemdiv.appendChild(minMax)

  itemdiv.appendChild(lister.domainSpanWIthRef(logItem, expandedView))

  let urlText = (logItem.title || (logItem.purl.replace(/\//g, ' ')))
  if (urlText.indexOf('chrome-extension') === 0 || urlText.indexOf('http') === 0) {
    const oldUrl = urlText
    urlText = ''
    for (let i = 0; i < oldUrl.length; i++) {
      urlText += (oldUrl.charAt(i) + '&#8203')
    }
  }
  if (!logItem.url) console.warn('No url is logItem', { logItem })
  const titleOuter = lister.titleOuter(expandedView)
  const titleInner = dg.a({ style: { overflow: 'hidden', 'text-decoration': 'none' } })
  titleInner.innerHTML = urlText
  titleInner.setAttribute('href', logItem.url)

  titleOuter.appendChild(lister.openOutside(logItem.url))
  titleOuter.appendChild(titleInner)

  itemdiv.appendChild(titleOuter)

  itemdiv.appendChild(dg.div({
    className: 'scrollAndTimeSpent',
    style: {
      height: '14px',
      overflow: 'hidden',
      'text-overflow': 'ellipsis',
      'white-space': 'nowrap',
      color: MCSS.DARK_GREY
      // 'margin-bottom': '5px'
    }
  }, timeAndScrollString(logItem)))

  // image
  const imageBox = lister.imageBox(logItem.image)
  imageBox.firstChild.style.padding = '0px 5px 5px 5px'
  imageBox.onclick = async function () { await lister.setItemExpandedStatus(lister.idFromMark(logItem), vState) }
  itemdiv.appendChild(imageBox)

  itemdiv.appendChild(dg.div({
    className: 'greyMessage',
    style: {
      'margin-left': '40px',
      'margin-top': '50px',
      cursor: 'pointer',
      color: '#747474',
      display: 'none'
    }
  }, 'Click to view details'))

  const markFromLog = (logItem?.purl && vState.logs?.lookups) ? vState.logs?.lookups[logItem.purl] : null // note this doesnt necessarily capture all marks, only recent ones...
  const stars = overlayUtils.drawstars(markFromLog || logItem, {
    drawTrash: false,
    showBookmark: true,
    markOnBackEnd: vState.markOnBackEnd,
    logToConvert: logItem
  })
  itemdiv.appendChild(dg.div({ className: 'starsOnCard', style: { 'text-align': 'center', display: (expandedView ? 'block' : 'none') } }, stars))
  const smallStars = overlayUtils.drawSmallStars(markFromLog)
  smallStars.onclick = async function () { await lister.setItemExpandedStatus(lister.idFromMark(logItem), vState) }
  smallStars.appendChild(dg.div({ style: { display: 'inline-block', cursor: 'pointer', 'vertical-align': 'top', margin: '8px 0px 0px 8px', color: 'lightgrey' } }, 'Share'))
  itemdiv.appendChild(dg.div({ className: 'smallStarsOnCard', style: { 'text-align': 'center', height: '15px', display: (expandedView ? 'none' : 'block') } }, smallStars))

  const notesBox = overlayUtils.drawMainNotesBox(markFromLog, { mainNoteSaver: vState.mainNoteSaver, log: logItem })
  itemdiv.appendChild(dg.div({ className: 'vNote', style: { display: (expandedView ? 'block' : 'none') } }, notesBox))

  itemdiv.appendChild(
    dg.div({
      style: {
        display: 'none',
        height: '17px',
        'text-overflow': 'ellipsis',
        'white-space': 'nowrap',
        'vertical-align': 'bottom',
        color: MCSS.DARK_GREY
      },
      className: 'viaReferrer'
    },
    (logItem?.referrer?.trim() ? (dg.span(' via ', dg.a({ href: logItem.referrer, style: { color: 'grey' } }, logItem.referrer))) : ' ')
    ))

  const dateToUse = new Date(logItem.vCreated) // logItem._date_modified

  const weekday = ['Sun', 'Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat']
  const dateString = weekday[dateToUse.getDay()] + ' ' + (dateToUse.toLocaleDateString() + ' ' + dateToUse.toLocaleTimeString()) // + ' ' + dateToUse
  itemdiv.appendChild(dg.div({ className: 'dateString', style: { color: 'indianred', 'margin-top': '10px' } }, dateString))

  const hLightOptions = {
    type: 'markHighlights',
    purl: logItem.purl,
    markOnBackEnd: vState.markOnBackEnd,
    markOnMarks: markFromLog,
    logToConvert: logItem,
    hLightCommentSaver: vState.hLightCommentSaver,
    hLightDeleter: vState.hLightDeleter
  }
  itemdiv.appendChild(lister.newDrawHighlights(logItem.purl, markFromLog?.vHighlights, hLightOptions)) //
  itemdiv.appendChild(overlayUtils.areaTitle('Sharing', { display: 'none' }))
  itemdiv.appendChild(lister.sharingDetailsSkeleton(logItem.purl))
  itemdiv.appendChild(overlayUtils.vMessageCommentDetails(logItem.purl, []))
  const msgHighLightoptions = JSON.parse(JSON.stringify(hLightOptions))
  msgHighLightoptions.type = 'msgHighLights'
  itemdiv.appendChild(lister.newDrawHighlights(logItem.purl, [], msgHighLightoptions)) //

  return lister.addCard2ndOuter(itemdiv, 'history')
}
lister.drawMessageItem = function (msgRecord, vState, opt = {}) {
  const { expandedView, fromAutoUpdate } = opt
  const itemdiv = fromAutoUpdate
    ? dg.div()
    : lister.cardOuter(msgRecord, 'messages', expandedView)

  if (!msgRecord || !msgRecord.purl) {
    console.error('missing purl in record ', { msgRecord })
    itemdiv.style.display = 'none'
    return lister.addCard2ndOuter(itemdiv, 'messages')
  }
  if (!msgRecord.url) console.warn('No url in msgRecord', { msgRecord })

  if (expandedView) itemdiv.setAttribute('expandedView', (expandedView))
  itemdiv.setAttribute('tabtype', 'messages')
  itemdiv.setAttribute('purl', msgRecord.purl)
  itemdiv.className = 'cardOuter'

  const minMax = lister.minMaximizeButt(lister.idFromMark(msgRecord), vState)
  lister.minMaximizeButtSet(minMax, true)
  itemdiv.appendChild(minMax)

  itemdiv.appendChild(lister.domainSpanWIthRef(msgRecord, expandedView))

  const titleOuter = lister.titleOuter(expandedView)
  titleOuter.appendChild(lister.openOutside(msgRecord.url))

  const titleInner = dg.a({ style: { overflow: 'hidden', 'text-decoration': 'none' } }, (msgRecord.title || msgRecord.purl.replace(/\//g, ' ')))
  titleInner.setAttribute('href', msgRecord.url)
  titleOuter.appendChild(titleInner)

  itemdiv.appendChild(titleOuter)

  itemdiv.appendChild(lister.imageBox(msgRecord.image))

  const markOnMarks = vState.marks.lookups[msgRecord.purl]

  const stars = overlayUtils.drawstars(markOnMarks || convertLogToMark(msgRecord), {
    drawTrash: false,
    showBookmark: true,
    markOnBackEnd: vState.markOnBackEnd,
    logToConvert: msgRecord
  })
  itemdiv.appendChild(dg.div({ className: 'starsOnCard', style: { 'text-align': 'center', display: (expandedView ? 'block' : 'none') } }, stars))

  const smallStars = overlayUtils.drawSmallStars(markOnMarks)
  // smallStars.onclick = async function () { await lister.setItemExpandedStatus(lister.idFromMark(msgRecord), vState) }
  smallStars.appendChild(dg.div({ style: { display: 'inline-block', cursor: 'pointer', 'vertical-align': 'top', margin: '8px 0px 0px 8px', color: 'lightgrey' } }, 'Share'))
  itemdiv.appendChild(dg.div({ className: 'smallStarsOnCard', style: { 'text-align': 'center', height: '15px', display: (expandedView ? 'none' : 'block') } }, smallStars))

  const notesBox = overlayUtils.drawMainNotesBox(markOnMarks, { mainNoteSaver: vState.mainNoteSaver, log: msgRecord })
  itemdiv.appendChild(dg.div({ className: 'vNote', style: { display: (expandedView ? 'block' : 'none'), padding: '10px 40px' } }, notesBox))

  itemdiv.appendChild(overlayUtils.areaTitle('Sharing', { display: 'none' }))
  itemdiv.appendChild(lister.sharingDetailsSkeleton(msgRecord.purl))

  itemdiv.appendChild(overlayUtils.vMessageCommentSummary(msgRecord.purl, msgRecord.vComments))
  itemdiv.appendChild(overlayUtils.vMessageCommentDetails(msgRecord.purl, msgRecord.vComments))

  if ((markOnMarks && markOnMarks.vHighlights && markOnMarks.vHighlights.length > 0) || (msgRecord.vHighlights && msgRecord.vHighlights.length > 0)) {
    // itemdiv.appendChild(dg.h2('new hlights'))
    const hLights = markMsgHlightsAsMarked(markOnMarks?.vHighlights, msgRecord?.vHighlights)
    const logToConvert = JSON.parse(JSON.stringify(msgRecord))
    logToConvert.vHighlights = []
    logToConvert.vComments = []
    logToConvert._id = null
    const options = {
      type: 'msgHighLights',
      purl: msgRecord.purl,
      markOnBackEnd: vState.markOnBackEnd,
      markOnMarks,
      logToConvert,
      hLightCommentSaver: vState.hLightCommentSaver,
      hLightDeleter: vState.hLightDeleter
    }
    itemdiv.appendChild(lister.newDrawHighlights(msgRecord.purl, hLights, options)) //
  }

  return lister.addCard2ndOuter(itemdiv, 'messages')
}

// Expanding card
lister.setItemExpandedStatus = async function (id, vState) {
  if (vState.viewType === 'fullHeight') console.error('setexpanded view cannot be used with fullheight')
  const theDiv = dg.el(id)
  const expandedView = theDiv.getAttribute('expandedView') === 'true'
  const purl = theDiv.getAttribute('purl')

  const list = vState.queryParams.list
  let gotFetchErr = false

  const doExpand = !expandedView
  theDiv.setAttribute('expandedView', doExpand || null)
  theDiv.style.overflow = doExpand ? 'scroll' : 'hidden'

  if (doExpand) {
    theDiv.style.position = 'absolute'
    theDiv.style['z-index'] = vState.zIndex++
  }
  const titleOuter = theDiv.querySelector('.vulog_title_url')
  titleOuter.style.height = doExpand ? null : '33px'
  const smallStarsOnCard = theDiv.querySelector('.smallStarsOnCard')
  if (smallStarsOnCard) smallStarsOnCard.style.display = doExpand ? 'block' : 'none'

  const divLeft = theDiv.getClientRects()[0].left
  const screenWidth = document.body.getClientRects()[0].width
  let moveX = theDiv.getAttribute('data-moveX') || (divLeft < 200 ? 50 : (screenWidth - divLeft < 400 ? -200 : 0))
  if (!moveX || isNaN(moveX)) moveX = 0
  const moveY = theDiv.getAttribute('data-moveY') || -50
  theDiv.setAttribute('data-moveY', moveY)
  theDiv.setAttribute('data-moveX', moveX)
  theDiv.style.transform = doExpand ? ('translate( ' + moveX + 'px , -50px)') : null

  theDiv.style.height = doExpand ? '600px' : (lister.dims[list].height + 'px')
  theDiv.style.width = doExpand ? '400px' : (lister.dims[list].width + 'px')
  if (doExpand && theDiv.parentElement.previousSibling && theDiv.parentElement.previousSibling.getAttribute('vCollapsible')) {
    // if previous el is collapsed, make it uncollpased
    lister.setCardAsCollapsible(theDiv.parentElement.previousSibling.firstChild, false, { list })
  }
  if (!doExpand) {
    setTimeout(() => {
      theDiv.style.position = null
      theDiv.style['z-index'] = null
    }, 1000)
  }
  // theDiv.o
  const trash = theDiv.querySelector('.vulog_overlay_trash')

  if (doExpand) {
    if (trash) trash.style.display = 'block'
    if (trash) trash.parentElement.style['padding-right'] = '40px'
    theDiv.firstChild.nextSibling.style.background = 'linear-gradient(to bottom, #aae9cc, white 20%, #aae9cc 20%, white 30%, #aae9cc 40%, white 50%, #aae9cc 60%, white 70%, #aae9cc 80%, white 90%)'
    theDiv.firstChild.nextSibling.style.cursor = 'grab'
    theDiv.firstChild.nextSibling.id = theDiv.id + 'header'
    lister.dragElement(theDiv, vState)
  } else {
    if (trash) trash.style.display = 'none'
    if (trash) trash.parentElement.style['padding-right'] = null
    theDiv.firstChild.nextSibling.style.background = null
    theDiv.firstChild.nextSibling.style.cursor = null
    theDiv.firstChild.nextSibling.id = null
  }

  // these are redunandant but added so transition looks better
  const highLightsDiv = theDiv.querySelector('.markHighlights')
  if (highLightsDiv) highLightsDiv.style.display = doExpand ? 'block' : 'none'
  const msgHighLightsDiv = theDiv.querySelector('.msgHighLights')
  if (msgHighLightsDiv) msgHighLightsDiv.style.display = doExpand ? 'block' : 'none'
  const sharingDiv = theDiv.querySelector('.sharingDetailsSkeleton')
  if (sharingDiv) sharingDiv.style.display = doExpand ? 'block' : 'none'
  const sharingTitle = theDiv.querySelector('.SharingTitle')
  if (sharingTitle) sharingTitle.style.display = doExpand ? 'block' : 'none'
  const starsOnCard = theDiv.querySelector('.starsOnCard')
  if (starsOnCard) starsOnCard.style.display = (doExpand || list === 'marks') ? 'block' : 'none'

  // When expand, look up purl to see if it has been marked. And reset 
  if (doExpand) {
    if (!vState.marks?.lookups || !vState.marks?.lookups[purl] || !vState.messages?.lookups || !vState.messages.lookups[purl]) { // ) { //
      let existing = null
      try {
        existing = await vState.environmentSpecificGetMark(purl)
      } catch (e) {
        console.warn('gotFetchErr 1 ', { e })
        gotFetchErr = true
        const sharingDiv = theDiv.querySelector('.sharingDetailsSkeleton')
        sharingDiv.appendChild(dg.div({ style: errStyle }, 'Error getting bookmarks: ' + e.message))
      }
      if (existing && (existing.mark || (existing.messages && existing.messages.length > 0))) {
        vState.marks.lookups[purl] = existing.mark

        const messages = (existing.messages && existing.messages.length > 0) ? existing.messages : null
        if (!vState.messages) vState.messages = {}
        if (!vState.messages.lookups) vState.messages.lookups = {}
        vState.messages.lookups[purl] = lister.mergeNewAndExistingMessages([], messages)[0]
      }
    }
    if (!vState.environmentSpecificGetMark) console.warn('(need to define  vState.environmentSpecificGetMark')

    const mark = vState.marks?.lookups[purl]
    const msgRecord = vState.messages?.lookups ? vState.messages.lookups[purl] : null
    const log = (list === 'history') ? (vState.history.unfilteredItems.find(m => m.purl === purl) || vState.history.filteredItems.find(m => m.purl === purl)) : null

    const logOrMsgToDraw = mark || (list === 'history' ? convertLogToMark(log) : convertLogToMark(msgRecord))

    const stars = overlayUtils.drawstars(logOrMsgToDraw, {
      drawTrash: (list === 'marks'),
      trashFloatHide: (list === 'marks'),
      showBookmark: !mark,
      markOnBackEnd: vState.markOnBackEnd,
      logToConvert: vState.logToConvert
    })
    const starDiv = theDiv.querySelector('.starsOnCard')
    starDiv.innerHTML = ''
    starDiv.appendChild(stars)
    starDiv.style['margin-right'] = '40px'
    const trash = starDiv.querySelector('.vulog_overlay_trash')
    if (trash) trash.style.display = 'block'
    const summarySharingAndHighlights = theDiv.querySelector('.summarySharingAndHighlights')
    if (summarySharingAndHighlights) summarySharingAndHighlights.style.display = 'none' // redundant with below - added here so it happens at starts
    const notesBox = overlayUtils.drawMainNotesBox(logOrMsgToDraw, { mainNoteSaver: vState.mainNoteSaver })
    const NoteDiv = theDiv.querySelector('.vNote')
    if (NoteDiv) {
      NoteDiv.innerHTML = ''
      NoteDiv.appendChild(notesBox)
    }
    const hLightOptions = {
      type: 'markHighLights',
      purl,
      markOnBackEnd: vState.markOnBackEnd,
      markOnMarks: mark,
      hLightCommentSaver: vState.hLightCommentSaver,
      hLightDeleter: vState.hLightDeleter
    }
    if (mark?.vHighlights && mark.vHighlights.length > 0) {
      const hLightDiv = theDiv.querySelector('.markHighlights')
      hLightOptions.existingDiv = hLightDiv
      if (hLightDiv) lister.newDrawHighlights(purl, mark.vHighlights, hLightOptions) //
    }
    if (msgRecord?.vHighlights && msgRecord.vHighlights.length > 0) {
      const hLightDiv = theDiv.querySelector('.msgHighLights')
      hLightOptions.existingDiv = hLightDiv
      hLightOptions.msgRecord = msgRecord
      hLightOptions.type = 'msgHighLights'
      const hLights = markMsgHlightsAsMarked(mark?.vHighlights, msgRecord.vHighlights)
      if (hLightDiv) lister.newDrawHighlights(purl, hLights, hLightOptions) //
    }

    // DO HIGLIGHTS AND DO SHARING
  } else {
    theDiv.querySelector('.starsOnCard').style['margin-right'] = '0'
  }
  if (!vState.messages) vState.messages = {}
  if (!vState.messages.unfilteredItems) vState.messages.unfilteredItems = []
  if (vState.freezrMeta?.userId && doExpand && vState.queryParams.list !== 'messages' && vState.messages?.unfilteredItems && !vState.messages.unfilteredItems.find((item) => item.purl === purl)) {
    const updateStatus = await getAllMessagesAndUpdateStateteFor(purl)
    if (updateStatus.error) console.warn('todo - Need to handle error on update') // todo - have an error box on the card and show this ??
  }
  const messageItem = vState.messages.unfilteredItems.find((item) => item.purl === purl)

  const vMessageCommentDetailsDiv = theDiv.querySelector('.vMessageCommentDetails')
  overlayUtils.vMessageCommentDetails(purl, messageItem?.vComments, vMessageCommentDetailsDiv)

  Array.from(theDiv.childNodes).forEach(el => {
    switch (el.className) {
      case 'minMaximizeButt':
        lister.minMaximizeButtSet(el, !doExpand)
        break
      case 'summarySharingAndHighlights':
        el.style.display = doExpand ? 'none' : 'grid'
        break
      case 'markHighlights':
        el.style.display = doExpand ? 'block' : 'none'
        break
      case 'msgHighLights':
        el.style.display = doExpand ? 'block' : 'none'
        break
      case 'vNote':
        el.style.display = doExpand ? 'block' : 'none'
        break
      case 'SharingTitle':
      case 'sharingDetailsSkeleton':
        el.style.display = doExpand ? 'block' : 'none' // redundant
        if (doExpand && el.className === 'sharingDetailsSkeleton') {
          setTimeout(async function () {
            if (vState.freezrMeta?.userId && doExpand && !vState.sharedmarks?.lookups[purl]) {
              if (!vState.sharedmarks) vState.sharedmarks = {}
              if (!vState.sharedmarks.lookups) vState.sharedmarks.lookups = {}
              try {
                await refreshSharedMarksinVstateFor(purl)
              } catch (e) {
                console.warn('gotFetchErr 2 ', { e })
                const sharingDiv = theDiv.querySelector('.sharingDetailsSkeleton')
                gotFetchErr = true
                sharingDiv.appendChild(dg.div({ style: errStyle }, 'Error getting public marks: ' + e.message))
              }
            }
            if (gotFetchErr) {
              console.warn({ gotFetchErr })
              lister.postErrInSharingDetails(el)
            } else {
              lister.redrawSharingDetails(el)
            }
          }, 5)
        }
        break
      case 'starsOnCard':
        el.style.display = (doExpand || list === 'marks') ? 'block' : 'none'
        break
      case 'viaReferrer':
        el.style.display = (doExpand) ? 'block' : 'none'
        break
      case 'smallStarsOnCard':
        el.style.display = (doExpand) ? 'none' : 'block'
        el.innerHTML = ''
        el.appendChild(overlayUtils.drawSmallStars(vState.marks.lookups[purl]))
        break
      case 'vMessageCommentDetails':
        el.style.display = doExpand ? 'block' : 'none'
        break
      case 'vMessageCommentSummary':
        el.style.display = doExpand ? 'none' : 'block'
        break
      default:
        break
    }
  })
}
const refreshSharedMarksinVstateFor = async function (purl) {
  vState.sharedmarks.lookups[purl] = await freepr.feps.postquery({ app_table: 'com.salmanff.vulog.sharedmarks', q: { purl } })
  return true
}

// Elements inside card
lister.addCard2ndOuter = function (cardOuter, list) {
  return dg.div({
    style: {
      margin: '15px', width: (lister.dims[list].width + 'px'), transition: 'all 0.5s ease-out'
    }
  }, cardOuter)
}
lister.cardOuter = function (markOrLog, list, expandedView) {
  return dg.div({
    style: {
      height: (expandedView ? null : (lister.dims[list].height + 'px')),
      width: (lister.dims[list].width + 'px'),
      display: 'inline-block',
      border: '1px solid black',
      'border-radius': '10px',
      'background-color': 'white',
      padding: '5px',
      transition: 'all 0.5s ease-out',
      overflow: 'hidden'
    },
    id: this.idFromMark(markOrLog)
  })
}
lister.idFromMark = function (mark) {
  const type = mark._id ? 'id' : 'temp'
  return 'vitem_' + type + '_' + (mark._id || mark.fj_local_temp_unique_id)
}
lister.domainSpanWIthRef = function (markOrLog, expandedView) {
  return dg.div({
    style: {
      overflow: 'hidden',
      color: 'darkgrey',
      'font-size': '12px',
      'font-weight': 'bold',
      height: '18px',
      'max-height': '18px'
    }
  }, lister.domainSpanWIthRefInner(markOrLog, expandedView))
}
lister.imageBox = function (image, styles) {
  const imageBox = dg.div({ style: { 'text-align': 'center', height: '80px', padding: '5px' } }, //
    (image
      ? dg.img({ src: (image || ''), style: { 'max-width': '170px', 'max-height': '80px' } })
      : dg.div({ style: { margin: '10px 40px 10px 40px', border: '5px solid lightgrey', height: '60px' } })
    ))
  if (styles) {
    for (const [key, attr] of Object.entries(styles)) {
      imageBox.firstChild.style[key] = attr
    }
  }
  return imageBox
}
lister.domainSpanWIthRefInner = function (markOrLog, expandedView) {
  const remDotCom = function (domain) {
    if (domain && domain.length > 5 && domain.indexOf('.com') === (domain.length - 4)) domain = domain.slice(0, -4)
    if (domain && domain.length > 5 && domain.indexOf('www.') === 0) domain = domain.slice(4)
    return domain
  }
  return (dg.span(
    // favicon
    dg.span(
      dg.img({
        style: {
          'vertical-align': 'top',
          width: '15px',
          height: '15px',
          'margin-right': '5px'
        },
        src: (markOrLog.vulog_favIconUrl ? markOrLog.vulog_favIconUrl : (this.getdomain(markOrLog.url) + '/favicon.ico')),
        onerror: function () {
          this.onerror = null
          this.src = '/static/faviconGeneric.png'
        }
      })
    ),
    // title
    dg.span({
      className: 'domainTitle',
      style: {
        overflow: 'hidden',
        'font-weight': 'bold',
        'font-size': '14px',
        'vertical-align': 'bottom',
        color: MCSS.DARK_GREY
      }
    },
    (remDotCom(markOrLog.domainApp)),
    dg.span({
      style: {
        overflow: 'hidden',
        'font-weight': 'normal',
        'font-size': '14px',
        'vertical-align': 'bottom',
        color: MCSS.DARK_GREY
      }
    },
    ((markOrLog.referrer && markOrLog.domainApp !== domainAppFromUrl(markOrLog.referrer)) ? (' via ' + remDotCom(domainAppFromUrl(markOrLog.referrer))) : ''
    ))
    )
  ))
}
lister.domainSpan = function (markOrLog) {
  return (dg.span(
    // favicon
    dg.span(
      dg.img({
        style: {
          'vertical-align': 'top',
          width: '15px',
          height: '15px',
          'margin-right': '5px'
        },
        src: (markOrLog.vulog_favIconUrl ? markOrLog.vulog_favIconUrl : (this.getdomain(markOrLog.url) + '/favicon.ico')),
        onerror: function () {
          this.onerror = null
          this.src = '/static/faviconGeneric.png'
        }
      })
    ),
    // title
    dg.span({
      style: {
        overflow: 'hidden',
        'font-weight': 'bold',
        'font-size': '14px',
        'vertical-align': 'bottom',
        color: MCSS.DARK_GREY
      }
    },
    markOrLog.domainApp)
  ))
}
lister.titleOuter = function (expandedView) {
  return dg.div({
    style: {
      overflow: 'hidden',
      color: 'cornflowerblue',
      height: (expandedView ? null : '33px'),
      'margin-top': '5px'
    },
    className: 'vulog_title_url'
  })
}
lister.openOutside = function (url, options) {
  return dg.div({
    className: 'fa fa-external-link',
    style: { float: 'right', color: 'cornflowerblue', 'font-size': '18px', margin: (options?.nomargin ? '' : '6px 0px 0px 5px'), cursor: 'pointer' },
    onclick: (e) => {
      const left = window.screenLeft !== undefined ? window.screenLeft : window.screenX
      const top = window.screenTop !== undefined ? window.screenTop : window.screenY
      const height = window.innerHeight
        ? window.innerHeight
        : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height
      window.open(url, 'window', 'width=800, height=' + height + ',  left =' + (left + 500) + ', top=' + top + '')
    }
  })
}
lister.newDrawHighlights = function (purl, hLights, options) {
  // options: hLightCommentSaver, hLightDeleter, existingDiv, markOnBackEnd, markOnMarks, logToConvert (eg msgRecord)
  // onsole.log('newDrawHighlights drawHighlight', { purl, hLights })
  if (options?.existingDiv) options.existingDiv.innerHTML = ''
  const innerHighs = options?.existingDiv || dg.div({ className: options.type, style: { display: 'none' } })
  if (hLights && hLights.length > 0) {
    const title = (options?.type === 'msgHighLights' ? 'Highlights in Messages' : 'Your Highlights')
    innerHighs.appendChild(overlayUtils.areaTitle('Highlights', { display: 'block', title, color: (options?.type === 'msgHighLights' ? 'purple' : '#057d47') }))

    const hLightOpts = JSON.parse(JSON.stringify(options))
    hLightOpts.include_delete = true
    hLightOpts.existingDiv = null
    hLightOpts.isOwn = !(options?.type === 'msgHighLights')
    hLightOpts.hLightCommentSaver = options.hLightCommentSaver
    hLightOpts.hLightDeleter = options.hLightDeleter

    if (!hLightOpts.hLightCommentSaver) console.error('No hLightOptions hLightCommentSaver 3 ', { optionscomm: JSON.stringify(options.hLightCommentSaver), hLightOptscomms: JSON.stringify(hLightOpts.hLightCommentSaver) })

    hLights.forEach(hlight => {
      innerHighs.appendChild(overlayUtils.drawHighlight(purl, hlight, hLightOpts))
    })
  } else if (!vState.freezrMeta?.userId && options?.type !== 'msgHighLights') { // ie relatively new user
    innerHighs.appendChild(overlayUtils.areaTitle('Highlights', { display: 'block', title: 'Highlights', color: (options?.type === 'msgHighLights' ? 'purple' : '#057d47') }))
    innerHighs.appendChild(dg.div({ style: { color: 'grey', padding: '10px' } }, 'You can highlight text on pages by selecting the text and right-clicking on it to see your menu options.'))
  }
  return innerHighs
}
lister.allPeopleSharedWith = function (currentMark) {
  const theSpan = dg.div({
    onclick: (e) => e.preventDefault(),
    style: { display: 'inline', cursor: 'default' }
  }, dg.span('Sharing Options'))
  let count = 0
  const sharedWith = dg.span('Shared with: ')
  if (currentMark?._accessible?._public) {
    sharedWith.appendChild(dg.span({
      style: { color: 'purple' },
      title: 'Every one has access',
      id: 'sharedWithPublicInTitle'
    },
    'the Public'))
    sharedWith.appendChild(dg.span(', '))
    count++
  }
  if (currentMark?._accessible) {
    for (const [searchName] of Object.entries(currentMark._accessible)) {
      if (searchName !== '_public') {
        sharedWith.appendChild(dg.span({
          style: { color: 'purple' },
          title: searchName
        }, searchName.split('@')[0]))
        sharedWith.appendChild(dg.span(', '))
        count++
      }
    }
  }
  // add public
  if (count > 0) { // remove comma - add period
    sharedWith.lastChild.innerText = '.'
    theSpan.firstChild.style.display = 'none'
    theSpan.appendChild(sharedWith)
  }
  return theSpan
}
// SHARING MENU and INTERACTIONS
lister.sharingDetailsSkeleton = function (purl, options) {
  const outer = dg.div({
    className: 'sharingDetailsSkeleton',
    style: {
      'min-height': (options?.minHeight || '150px'), display: 'none'
    }
  })
  // const purl = msgRecord?.purl || options?.purl
  if (!purl) return outer.appendChild(dg.div('No purl Sent to draw section'))
  outer.setAttribute('sectionDrawn', false)
  outer.setAttribute('purl', purl)

  const menuDetails = dg.div({ className: 'sharingMenuDetails', style: { padding: '10px' } })
  const summary = lister.summaryOfSharingOptions(purl, permsFromFreezrMetaState())
  if (!options || !options.hideSummary) menuDetails.appendChild(summary)
  if (vState.isLoggedIn) {
    outer.appendChild(lister.drawSharingMenuItems(purl, {}))
    SHARING_MENU_TYPES.forEach(type => menuDetails.appendChild(drawEmptySharingSubsection(type)))
  }
  outer.appendChild(menuDetails)
  setTimeout(function () { 
    expandSection(summary, { height: '180px' })
    // need to set these as 'transitioned' doesnt get triggered when hidden
    summary.style.height = null
    summary.setAttribute('data-collapsed', 'false')
  }, 100)
  return outer
}
lister.postErrInSharingDetails = function (sharingDiv) {
  sharingDiv.innerHTML = ''
  sharingDiv.appendChild(dg.div({ style: errStyle }, 'Sorry there was an error connecting to the server please try again later'))
}
const permsFromFreezrMetaState = function () {
  const { freezrMeta } = vState
  if (!freezrMeta.perms) freezrMeta.perms = { link_share: { granted: false }, friends: { granted: false } }
  const perms = { isLoggedIn: (vState.isLoggedIn) }
  perms.haveMessagingPerm = freezrMeta?.perms?.message_link?.granted
  perms.havePublicPerm = freezrMeta?.perms?.public_link?.granted
  perms.haveSharingPerm = perms.haveMessagingPerm || perms.havePublicPerm
  perms.haveFeedPerm = freezrMeta?.perms?.privateCodes?.granted
  perms.haveContactsPerm = freezrMeta?.perms?.friends?.granted
  return perms
}
lister.redrawSharingDetails = function (sharingDiv, options) {
  if (!sharingDiv) console.error('redrawSharingDetails - Try finding el using otpions.purl')
  const purl = sharingDiv.getAttribute('purl')

  const perms = permsFromFreezrMetaState()

  // find message in vState using purl
  if (!purl) {
    sharingDiv.appendChild(dg.div('Internal Error - no purl associated with this.'))
  } else if (!vState.isLoggedIn) {
    sharingDiv.appendChild(dg.div('. . .')) // todo -> login link if on extension
  } else if (vState.offlineCredentialsExpired) {
    sharingDiv.appendChild(dg.div('Your credentials have expired. Please login again.')) // todo -> login link if on extension
  } else {
    if (perms.isLoggedIn) {
      SHARING_MENU_TYPES.forEach(type => drawSharingSubsection[type](purl, { existingDiv: sharingDiv.querySelector('.sharingArea' + type) }))
    }
  }
  return sharingDiv
}
const SHARING_MENU_TYPES = ['_public', '_privatelink', '_messages', '_privatefeed']
lister.drawSharingMenuItems = function (purl, perms) {
  const outer = dg.div({ className: 'sharingMenuItems', style: { 'text-align': 'center' } })
  SHARING_MENU_TYPES.forEach(shareType => { outer.appendChild(shareMenuButton(shareType, purl, perms)) })
  return outer
}
const shareButtStyle = {
  display: 'inline-block',
  'text-align': 'center',
  'border-radius': '6px',
  border: '2px solid',
  'font-size': '11px',
  color: 'cornflowerblue',
  padding: '4px',
  margin: '3px',
  'min-width': '40px',
  width: '70px',
  cursor: 'pointer' // , position: ;relative
}
const shareMenuButton = function (shareType, purl, perms) {
  const theButton = dg.div({
    className: 'shareMenuButton',
    style: shareButtStyle,
    onclick: function (e) {
      const actualButton = getParentWithClass(e.target, 'shareMenuButton')
      const chosenShareType = actualButton.getAttribute('shareType')
      const sharingButtonsDiv = actualButton.parentElement
      Array.from(sharingButtonsDiv.childNodes).forEach(el => {
        const buttonShareType = el.getAttribute('shareType')
        el.style.color = (buttonShareType === chosenShareType) ? 'grey' : 'cornflowerblue'
        el.style.border = (buttonShareType === chosenShareType) ? '' : '2px solid'
        el.style.cursor = (buttonShareType === chosenShareType) ? 'normal' : 'pointer'
      })
      const sharingDetailsOuter = sharingButtonsDiv.nextSibling
      let elToExpand = null
      let didCollapseOne = false

      Array.from(sharingDetailsOuter.childNodes).forEach(el => {
        const detailsShareType = el.getAttribute('shareType')
        if (detailsShareType !== chosenShareType) {
          const didCollpaseThisOne = collapseIfExpanded(el)
          didCollapseOne = didCollapseOne || didCollpaseThisOne
        } else {
          elToExpand = el
        }
      })
      if (!elToExpand) console.warn('no eltoexpand')
      if (elToExpand.getAttribute('vStateChanged') === 'true') {
        elToExpand.setAttribute('vStateChanged', false)

        drawSharingSubsection[chosenShareType](purl, { existingDiv: elToExpand })
      }
      setTimeout(function () {
        if (elToExpand) expandSection(elToExpand)
      }, (didCollapseOne ? 500 : 0)) // at start, on popup there is no eltoexpand
    }
  }, spanIconForShareType(shareType), titleTextFor(shareType))
  theButton.setAttribute('shareType', shareType)
  return theButton
}
const titleTextFor = function (shareType) {
  return (shareType === '_public'
    ? 'Public'
    : (shareType === '_privatelink'
        ? 'Private'
        : (shareType === '_privatefeed'
            ? 'Feed'
            : (shareType === '_messages'
                ? 'Message'
                : 'UNKNOWN'
              ))))
}
const spanIconForShareType = function (shareType) {
  if (shareType === '_public') return dg.span({ style: { margin: '0 3px 0 3px' } }, dg.span({ className: 'fa fa-link' }))
  if (shareType === '_messages') return dg.span({ style: { margin: '0 3px 0 3px' } }, dg.span({ className: 'fa fa-comment-o' }))
  if (shareType === '_privatelink') return dg.span({ style: { margin: '0px 2px', padding: '0px 3px', height: '12px', border: '1px solid', 'border-radius': '8px' } }, dg.span({ className: 'fa fa-link', style: { 'font-size': '12px' } }))
  if (shareType === '_privatefeed') return dg.span({ style: { margin: '0px 2px', padding: '0px 3px', height: '11px', border: '1px solid', 'border-radius': '3px', 'border-top': '3px double' } }, dg.span({ className: 'fa fa-users', style: { 'font-size': '10px' } }))

  return dg.span({ style: { margin: '0px 3px 0 3px', padding: '0px 3px', height: '12px', border: '1px solid', 'border-radius': '8px', 'border-top': '2px double' } }, dg.span({ className: 'fa fa-user', style: { 'font-size': '12px' } }))
}
lister.makePublicShareButton = function (opts) {
  const { title, buttonText, onlineAction, callback, style } = opts // successText // shareType: _public, _privatelink, _privatefeed, _messages
  const DEFAULTEXT = 'Share'

  const theButt = dg.div({
    className: 'shareButt',
    title, // (shareType !== '_public' ? (shareType !== '_privatelink' ? 'Publish to this feed' : 'Create a Private Link') : (doGrant ? 'Share Publicly' : 'unPublish'))
    style: shareButtStyle, // { 'user-select': 'none' },
    onclick: async function (e) {
      const buttonDiv = e.target
      buttonDiv.innerHTML = ''
      buttonDiv.appendChild(smallSpinner({ width: '15px', 'margin-top': '-4px', 'margin-bottom': '-4px' }))
  // dg.img({
  //       src: '/app_files/@public/info.freezr.public/public/static/ajaxloaderBig.gif',
  //       style: { width: '15px', 'margin-top': '-4px', 'margin-bottom': '-4px' }
  //     }))
      const result = await onlineAction()
      if (result?.error) {
        buttonDiv.innerHTML = buttonText || DEFAULTEXT
        buttonDiv.after(dg.div({ style: { color: 'red' } }, 'Sorry, Error: ' + (result?.error || 'unknown')))
      } else {
        buttonDiv.style.display = 'none'
        if (callback) callback()
      }
      if (callback) callback()
    }
  }, (buttonText || DEFAULTEXT))
  if (style) {
    Object.keys(style).forEach(key => { theButt.style[key] = style[key] })
  }
  return theButt
}
lister.summaryOfSharingOptions = function (purl, perms, options) {
  const outer = options?.existingDiv || dg.div({ className: 'sharingArea_summary' }) // collapsibleDiv('sharingArea_summary')
  outer.innerHTML = ''
  outer.setAttribute('shareType', 'none')

  if (!perms.isLoggedIn) {
    outer.appendChild(dg.span({ style: { color: 'darkgrey' } }, 'Connect to a freezr server to be able to share your bookmarks, notes and highlights. '))
    outer.appendChild(dg.a({ href: 'https://www.freezr.info' }, 'Cleck here to find out more about setting up a freezr server.'))
    outer.appendChild(dg.div(dg.br(), dg.div({ style: { 'color': 'grey' } }, dg.span('If you already have a feezr server, log in '), dg.a({ href: '/main/settings.html' }, 'on the setting page.'))))
    return outer
  }
  outer.appendChild(dg.br())
  const havePublicPerm = perms.havePublicPerm

  // Public Summary
  const publicMark = getPublicMark(purl)
  const publicUrl = getPublicUrl(publicMark)
  if (!havePublicPerm) {
    outer.appendChild(dg.div(dg.span({ style: { 'font-weight': 'bold' } }, 'Public: '), dg.span('You can publish your bookmark by granting '), dg.a({ href: '/account/app/settings/com.salmanff.vulog' }, 'the link_share permission')))
  } else if (publicMark) {
    outer.appendChild(dg.div(dg.span({ style: { 'font-weight': 'bold' } }, 'Public: '), dg.span(('Your bookmark was published.'), dg.a({ href: '/' + publicUrl }, 'You can find it here.'), dg.span(' Press the Public button for more options.'))))
  } else {
    outer.appendChild(dg.div(dg.span({ style: { 'font-weight': 'bold' } }, 'Public: '), 'Press on the Public button to publish this bookmark. '))
  }

  // Private Summary
  const privateMark = getPrivateMark(purl)
  const privateUrl = getPrivateUrl(privateMark)
  outer.appendChild(dg.br())
  if (!havePublicPerm) {
    outer.appendChild(dg.div(dg.span({ style: { 'font-weight': 'bold' } }, 'Private Sharing: '), dg.span('You can create a private link, protected b a code, to your bookmark by granting '), dg.a({ href: '/account/app/settings/com.salmanff.vulog' }, 'the link_share permission.')))
  } else if (privateMark) {
    outer.appendChild(dg.div(dg.span({ style: { 'font-weight': 'bold' } }, 'Private Sharing: '), dg.span(('A private link has been created for your bookmark.'), dg.a({ href: '/' + privateUrl }, 'You can find it here.'), dg.span(' Press the Private button for more options.'))))
  } else {
    outer.appendChild(dg.div(dg.span({ style: { 'font-weight': 'bold' } }, 'Public: '), 'Press on the Private button to create a private link to this bookmark - this will be a publicly accessible url oritected b a simple code.. '))
  }

  // Messaging Summary
  outer.appendChild(dg.br())
  outer.appendChild(dg.div(dg.span({ style: { 'font-weight': 'bold' } }, 'Messaging: '), dg.span('Share your bookmark with your contacts ')))

  // Feed Summary
  outer.appendChild(dg.br())
  outer.appendChild(dg.div(dg.span({ style: { 'font-weight': 'bold' } }, 'Private Feed: '), dg.span('Share your bookmark with your contacts ')))

  // outer.style.height = '180px'
  // outer.style.transition = 'height 0.3s ease-out'
  // outer.setAttribute('data-collapsed', 'false')

  return outer
}
const drawEmptySharingSubsection = function (type) {
  const outer = collapsibleDiv('sharingArea' + type)
  outer.innerHTML = ''
  outer.setAttribute('shareType', type)
  return outer
}
const drawSharingSubsection = {}
drawSharingSubsection._public = function (purl, options) {
  // options: existingDiv log
  const perms = permsFromFreezrMetaState()

  const outer = options?.existingDiv || collapsibleDiv('sharingArea_public')
  outer.innerHTML = ''
  outer.setAttribute('shareType', '_public')

  if (!perms.havePublicPerm) {
    outer.appendChild(dg.div({ style: { padding: '5px' } }, dg.div('You need to grant the app permission to share links with others.'), dg.a({ href: '/account/app/settings/com.salmanff.vulog' }, 'Press here to grant the link_share permission.')))
    return outer
  }

  const mark = vState.marks.lookups[purl]
  const publicMark = getPublicMark(purl)
  const isPublished = hasPublicMark(purl)
  const publicUrl = getPublicUrl(publicMark)
  const publishDate = getPublishDate(publicMark, '_public')

  if (isPublished) {
    const messageBox = overlayUtils.editableBox({
      placeHolderText: 'Enter notes on the page'
    }, async function (e) {
    })
    if (publicMark.vComments && publicMark.vComments.length > 0) {
      messageBox.innerText = publicMark.vComments[0].text
    } else if (mark?.vNote) {
      messageBox.innerText = mark.vNote
    }
    messageBox.onpaste = convertPasteToText
    messageBox.className = 'messageBox vulog_overlay_input'
    messageBox.style.border = '1px solid lightgrey'
    messageBox.style['max-height'] = 'none'

    if (publicUrl) {
      outer.appendChild(dg.div(dg.span(('Your bookmark was made public on ' + new Date(publishDate).toLocaleDateString() + '.'), dg.span(' You can find it '), dg.a({ href: vState.freezrMeta.serverAddress + '/' + publicUrl, target: '_blank' }, 'here.'), dg.span(' You can republish the current mark below, or delete it.'))))
      outer.appendChild(messageBox)
    } else {
      outer.appendChild(dg.div(dg.span(('There seems to have been issues. Your bookmaark was made public on ' + new Date(publicMark._date_modified).toLocaleDateString() + ', but it seems the operation was incompete.. '), dg.span(' You can republish the current mark below, or delete it to retry.'))))
    }

    outer.appendChild(dg.br())

    const buttons = dg.div({ style: { 'text-align': 'center' } })
    buttons.appendChild(lister.makePublicShareButton(
      {
        buttonText: 'Republish',
        title: 'Republish the link',
        successText: 'You have re-published this!',
        onlineAction: async function () {
          try {
            // get item with isPublic from sharedMarks
            // todo check if there are multiple and if so delete
            // also check if accessible if not, give an error
            const newMark = convertMarkToSharable((mark || getMarkFromVstateList(purl, { excludeHandC: true })), { excludeHlights: !mark })
            newMark.vComments = []
            if (messageBox.innerText) newMark.vComments = [{ text: messageBox.innerText, vCreated: new Date().getTime() }]
            newMark._id = publicMark._id
            const updateRet = await freepr.feps.update(newMark, { app_table: 'com.salmanff.vulog.sharedmarks' })
            if (!updateRet || updateRet.error) throw new Error('Error updating shared mark: ' + (updateRet?.error || 'unknown'))
            const shareRet = await freepr.perms.shareRecords(publicMark._id, { grantees: ['_public'], name: 'public_link', action: 'grant', table_id: 'com.salmanff.vulog.sharedmarks' })
            if (!shareRet || shareRet.error) throw new Error('Error sharing: ' + (shareRet?.error || 'unknown'))
            outer.innerHTML = ''
            outer.appendChild(dg.div(
              dg.div({ style: { padding: '10px', color: 'red' } }, 'Your bookmark was republished.'), 
              dg.a({ style: { margin: '10px' }, href: vState.freezrMeta.serverAddress + '/@' + vState.freezrMeta.userId + '/com.salmanff.vulog.sharedmarks/' + newMark._id, target: '_blank' }, 'You can find it here.')
            ))
            await refreshSharedMarksinVstateFor(purl)
            outer.setAttribute('vStateChanged', 'true')
            return shareRet
          } catch (e) {
            outer.appendChild(dg.div({ style: { padding: '10px', color: 'red' } }, 'There was an error republishing. Please try again.'))
            console.warn('caught err in online action', { e })
            return { error: e?.error }
          }
        }
      }
    ))
    // ADD DELETE BUTTON using makePublicShareButton
    buttons.appendChild(dg.span({ style: { 'padding-left': '100px' } }, ' '))
    buttons.appendChild(lister.makePublicShareButton(
      {
        title: 'Remove the link',
        buttonText: 'Remove',
        style: { color: 'red' },
        onlineAction: async function () {
          try {
            if (!publicMark) throw new Error('No public mark found')
            const shareRet = await freepr.perms.shareRecords(publicMark._id, { grantees: ['_public'], name: 'public_link', action: 'deny', table_id: 'com.salmanff.vulog.sharedmarks' })
            if (!shareRet || shareRet.error) throw new Error('Error in shareRecords of mark: ' + (shareRet?.error || 'unknown'))

            const deleteRet = await freepr.feps.delete(publicMark._id, { app_table: 'com.salmanff.vulog.sharedmarks' })
            if (!deleteRet || deleteRet.error) throw new Error('Error updating shared mark: ' + (deleteRet?.error || 'unknown'))
            if (deleteRet.success) {
              outer.innerHTML = ''
              outer.appendChild(dg.div({ style: { padding: '10px', color: 'red' } }, 'Your bookmark was unpublished.'))
              await refreshSharedMarksinVstateFor(purl)
              outer.setAttribute('vStateChanged', 'true')
            }
            return deleteRet
          } catch (e) {
            console.warn('caught err in online action', { e })
            outer.appendChild(dg.div({ style: { padding: '10px', color: 'red' } }, 'There was an error removing the link. Please try again.'))
            return { error: e?.error }
          }
        }
      }
    ))
    outer.appendChild(buttons)
    // add spinners and padding
  } else {
    outer.appendChild(dg.div('You can make your link public. It will show up on your public page and you can share the link wih any one. Your highlights and initial hilight comments will also be shared.'))
    const messageBox = overlayUtils.editableBox({
      placeHolderText: 'Enter notes on the page'
    }, async function (e) {
    })
    if (mark?.vNote) messageBox.innerText = mark.vNote
    messageBox.onpaste = convertPasteToText
    messageBox.className = 'messageBox vulog_overlay_input'
    messageBox.style.border = '1px solid lightgrey'
    messageBox.style['max-height'] = 'none'
    outer.appendChild(messageBox)
    const button = lister.makePublicShareButton(
      {
        title: 'Share the link publicly',
        buttonText: 'Share Publicly',
        successText: 'You have published this!',
        onlineAction: async function () {
          try {
            const markCopy = convertMarkToSharable((mark || getMarkFromVstateList(purl, { excludeHandC: true })), { excludeHlights: !mark }) // currently excluding hLights
            if (messageBox.innerText) markCopy.vComments = [{ text: messageBox.innerText, vCreated: new Date().getTime() }]
            if (!markCopy) throw new Error('No mark or log to convert')
            markCopy.isPublic = true
            // deal with case of crashing here - isPublic is true but it is not shared.
            const createRet = await freepr.ceps.create(markCopy, { app_table: 'com.salmanff.vulog.sharedmarks' })
            if (!createRet || createRet.error) throw new Error('Error creating shared mark: ' + (createRet?.error || 'unknown'))
            markCopy._id = createRet._id

            const shareRet = await freepr.perms.shareRecords(createRet._id, { grantees: ['_public'], name: 'public_link', action: 'grant', table_id: 'com.salmanff.vulog.sharedmarks' })
            vState.sharedmarks.lookups[purl].push(createRet)
            outer.innerHTML = ''
            outer.appendChild(dg.div(
              dg.div({ style: { padding: '10px', color: 'red' } }, 'Your bookmark was published.'),
              dg.a({ style: { margin: '10px' }, href: vState.freezrMeta.serverAddress + '/@' + vState.freezrMeta.userId + '/com.salmanff.vulog.sharedmarks/' + createRet._id, target: '_blank' }, 'You can find it here.')
            ))
            await refreshSharedMarksinVstateFor(purl)
            outer.setAttribute('vStateChanged', 'true')
            return shareRet
          } catch (e) {
            outer.appendChild(dg.div({ style: { padding: '10px', color: 'red' } }, 'There was an error publishing. Please try again.'))
            console.warn('caught err in online action', { e })
            return { error: e?.error }
          }
        }
      })
    button.style.width = '150px'
    const holder = dg.div({ style: { 'text-align': 'center' } })
    holder.appendChild(button)
    outer.appendChild(holder)
  }

  return outer
}
drawSharingSubsection._privatelink = function (purl, options) {
  const perms = permsFromFreezrMetaState()
  const outer = options?.existingDiv || collapsibleDiv('sharingArea_privatelink')
  outer.innerHTML = ''
  outer.setAttribute('shareType', '_privatelink')

  if (!perms.havePublicPerm) {
    outer.appendChild(dg.div({ style: { padding: '5px' } }, dg.div('You need to grant the app permission to share links with others.'), dg.a({ href: '/account/app/settings/com.salmanff.vulog' }, 'Press here to grant the link_share permission.')))
    return outer
  }

  const mark = vState.marks.lookups[purl]
  const privateMark = getPrivateMark(purl)
  const privateUrl = getPrivateUrl(privateMark)
  const publishDate = getPublishDate(privateMark, '_privatelink')

  if (privateMark) {
    const messageBox = overlayUtils.editableBox({
      placeHolderText: 'Enter notes on the page'
    }, async function (e) {
    })
    if (privateMark.vComments && privateMark.vComments.length > 0) {
      messageBox.innerText = privateMark.vComments[0].text
    } else if (mark?.vNote) {
      messageBox.innerText = mark.vNote
    }
    messageBox.onpaste = convertPasteToText
    messageBox.className = 'messageBox vulog_overlay_input'
    messageBox.style.border = '1px solid lightgrey'
    messageBox.style['max-height'] = 'none'

    if (privateUrl) {
      outer.appendChild(dg.div(dg.span(('You created a private link to this bookmark on ' + new Date(publishDate).toLocaleDateString() + '.'), dg.span(' You can find it '), dg.a({ href: '/' + privateUrl }, 'here.'), dg.span(' You can republish the current mark below, or delete it.'))))
      outer.appendChild(messageBox)
    } else {
      outer.appendChild(dg.div(dg.span(('There seems to have been issues. A private link was created on ' + new Date(privateMark._date_modified).toLocaleDateString() + ', but it seems the operation was incompete.'), dg.span(' You can republish the current mark below, or delete it to retry.'))))
    }

    outer.appendChild(dg.br())

    const buttons = dg.div({ style: { 'text-align': 'center' } })
    buttons.appendChild(lister.makePublicShareButton(
      {
        buttonText: 'Republish',
        title: 'Republish the link',
        successText: 'You have re-published this! Press the Public button again to continue.',
        onlineAction: async function () {
          try {
            privateMark.vComments = []
            if (messageBox.innerText) privateMark.vComments = [{ text: messageBox.innerText, vCreated: new Date().getTime() }]
            const updateRet = await freepr.feps.update(privateMark, { app_table: 'com.salmanff.vulog.sharedmarks' })
            if (!updateRet || updateRet.error) throw new Error('Error updating shared mark: ' + (updateRet?.error || 'unknown'))
            const shareRet = await freepr.perms.shareRecords(privateMark._id, { grantees: ['_privatelink'], name: 'public_link', action: 'grant', table_id: 'com.salmanff.vulog.sharedmarks' })
            if (!shareRet || shareRet.error) throw new Error('Error sharing: ' + (shareRet?.error || 'unknown'))
            outer.innerHTML = ''
            outer.appendChild(dg.div({ style: { padding: '10px', color: 'red' } }, 'Your bookmark was republished. You can access it here'))
            await refreshSharedMarksinVstateFor(purl)
            outer.setAttribute('vStateChanged', 'true')
            return shareRet
          } catch (e) {
            outer.appendChild(dg.div({ style: { padding: '10px', color: 'red' } }, 'There was an error republishing. Please try again.'))
            console.warn('caught err in online action', { e })
            return { error: e?.error }
          }
        }
      }
    ))
    // ADD DELETE BUTTON using makePublicShareButton
    buttons.appendChild(dg.span({ style: { 'padding-left': '100px' } }, ' '))
    buttons.appendChild(lister.makePublicShareButton(
      {
        title: 'Remove the link',
        buttonText: 'Remove',
        successText: 'You have re-published this! Press the Private button again to continue.',
        style: { color: 'red' },
        onlineAction: async function () {
          try {
            if (!privateMark) throw new Error('No public mark found')
            const shareRet = await freepr.perms.shareRecords(privateMark._id, { grantees: ['_privatelink'], name: 'public_link', action: 'deny', table_id: 'com.salmanff.vulog.sharedmarks' })
            if (!shareRet || shareRet.error) throw new Error('Error in shareRecords of mark: ' + (shareRet?.error || 'unknown'))
            const deleteRet = await freepr.feps.delete(privateMark._id, { app_table: 'com.salmanff.vulog.sharedmarks' })
            if (!deleteRet || deleteRet.error) throw new Error('Error updating shared mark: ' + (deleteRet?.error || 'unknown'))
            if (deleteRet.success) {
              outer.innerHTML = ''
              outer.appendChild(dg.div({ style: { padding: '10px', color: 'red' } }, 'Your private link was removed.'))
              // remove deleted item from state:
              await refreshSharedMarksinVstateFor(purl)
              outer.setAttribute('vStateChanged', 'true')
            }
            return deleteRet
          } catch (e) {
            outer.appendChild(dg.div({ style: { padding: '10px', color: 'red' } }, 'There was an error remvoing the link. Please try again.'))
            console.warn('caught err in online action', { e })
            return { error: e?.error }
          }
        }
      }
    ))
    outer.appendChild(buttons)
    // add spinners and padding
  } else {
    outer.appendChild(dg.div('You can create a private link to this bookmark so you can share a link with your contacts without forcing them to sign up for vulog. Your highlights and initial hilight comments will also be shared.'))
    const messageBox = overlayUtils.editableBox({
      placeHolderText: 'Enter notes on the page'
    }, async function (e) {
    })
    if (mark?.vNote) messageBox.innerText = mark.vNote
    messageBox.onpaste = convertPasteToText
    messageBox.className = 'messageBox vulog_overlay_input'
    messageBox.style.border = '1px solid lightgrey'
    messageBox.style['max-height'] = 'none'
    outer.appendChild(messageBox)
    const button = lister.makePublicShareButton(
      {
        title: 'Create a private link',
        buttonText: 'Create Link',
        successText: 'Your link was created. Press the Private button again to continue.',
        onlineAction: async function () {
          const markCopy = convertMarkToSharable((mark || getMarkFromVstateList(purl, { excludeHandC: true })), { excludeHlights: !mark })
          if (messageBox.innerText) markCopy.vComments = [{ text: messageBox.innerText, vCreated: new Date().getTime() }]
          try {
            if (!markCopy) throw new Error('No mark or log to convert')

            markCopy.isPublic = false
            // deal with case of crashing here - isPublic is true but it is not shared.
            const createRet = await freepr.ceps.create(markCopy, { app_table: 'com.salmanff.vulog.sharedmarks' })
            if (!createRet || createRet.error) throw new Error('Error creating shared mark: ' + (createRet?.error || 'unknown'))
            markCopy._id = createRet._id

            const shareRet = await freepr.perms.shareRecords(createRet._id, { grantees: ['_privatelink'], name: 'public_link', action: 'grant', table_id: 'com.salmanff.vulog.sharedmarks' })
            vState.sharedmarks.lookups[purl].push(createRet)
            outer.innerHTML = ''
            outer.appendChild(dg.div({ style: { padding: '10px', color: 'red' } }, dg.span('You created a shared bookmark.'), dg.a({ href: ('/' + shareRet._publicid + '?code=' + shareRet.code) }, 'Access it here.')))
            await refreshSharedMarksinVstateFor(purl)
            outer.setAttribute('vStateChanged', 'true')
            return shareRet
          } catch (e) {
            outer.appendChild(dg.div({ style: { padding: '10px', color: 'red' } }, 'There was an error creating the link. Please try again.'))
            console.warn('caught err in online action', { e })
            return { error: e?.error }
          }
        }
      })
    button.style.width = '150px'
    const holder = dg.div({ style: { 'text-align': 'center' } })
    holder.appendChild(button)
    outer.appendChild(holder)
  }
  return outer
}
drawSharingSubsection._privatefeed = function (purl, options) {
  const perms = permsFromFreezrMetaState()
  const outer = options?.existingDiv || collapsibleDiv('sharingArea_privatefeed')
  outer.innerHTML = ''
  outer.setAttribute('shareType', '_privatefeed')

  if (!perms.havePublicPerm || !perms.haveFeedPerm) {
    outer.appendChild(dg.div({ style: { padding: '5px' } }, dg.div('You need to grant two permission to post to feeds - both a public sharing permission and a permission to read your feeds.'), dg.a({ href: '/account/app/settings/com.salmanff.vulog' }, 'Press here to grant the link_share permission.')))
    return outer
  }

  const mark = vState.marks.lookups[purl]
  // const feedNames = vState.feedcodes.map(f => f.name)

  if (!vState.feedcodes || vState.feedcodes.length === 0) {
    outer.appendChild(dg.div(dg.span('You need to create a feed to share with others.'), dg.a({ href: '/account/contacts' }, 'Press here to go to your contacts page anbd press other options..')))
  } else {
    outer.appendChild(dg.div('You can add specific bookmarks to your private feeds.'))
    vState.feedcodes.forEach(feedCode => {
      const feedName = feedCode.name
      const feedDiv = dg.div()
      const feedMark = getFeedMark(purl, feedName)
      if (!feedMark) {
        const button = lister.makePublicShareButton(
          {
            title: 'Post bookmark to feed',
            buttonText: 'Post to ' + feedName,
            onlineAction: async function () {
              try {
                const buttonHolder = button.parentElement
                buttonHolder.innerHTML = ''

                const markCopy = convertMarkToSharable((mark || getMarkFromVstateList(purl, { excludeHandC: true })), { excludeHlights: !mark })
                if (!markCopy) throw new Error('No mark or log to convert')
                markCopy.isPublic = false
                // deal with case of crashing here - isPublic is true but it is not shared.
                const createRet = await freepr.ceps.create(markCopy, { app_table: 'com.salmanff.vulog.sharedmarks' })
                if (!createRet || createRet.error) throw new Error('Error creating shared mark: ' + (createRet?.error || 'unknown'))
                markCopy._id = createRet._id

                const shareRet = await freepr.perms.shareRecords(createRet._id, { grantees: ['_privatefeed:' + feedName], name: 'public_link', action: 'grant', table_id: 'com.salmanff.vulog.sharedmarks' })
                vState.sharedmarks.lookups[purl].push(createRet)
                buttonHolder.appendChild(dg.div({ style: { padding: '10px', color: 'red' } }, dg.span('Posted to '), dg.a({ href: ('/ppage?feed=' + feedName + '&code=' + shareRet.code) }, 'feed!')))
                await refreshSharedMarksinVstateFor(purl)
                outer.setAttribute('vStateChanged', 'true')
                return shareRet
              } catch (e) {
                outer.appendChild(dg.div({ style: { padding: '10px', color: 'red' } }, 'There was an error posting the link. Please try again.'))
                console.warn('caught err in online action', { e })
                return { error: e?.error }
              }
            }
          }
        )
        button.style.width = '150px'
        const holder = dg.div({ style: { display: 'grid', 'grid-template-columns': '1fr 180px' } })
        holder.appendChild(dg.span({ style: { 'font-weight': 'bold' } }, feedName + ':'))
        holder.appendChild(dg.div({ style: { 'text-align': 'right' } }, button))
        feedDiv.appendChild(holder)
      } else { // feedMark exists
        const updateButt = lister.makePublicShareButton({
          buttonText: 'Post again',
          title: 'Post link again to ' + feedName,
          onlineAction: async function () {
            const buttonHolder = updateButt.parentElement
            try {
              const updateRet = await freepr.feps.update(feedMark, { app_table: 'com.salmanff.vulog.sharedmarks' })
              buttonHolder.innerHTML = ''

              if (!updateRet || updateRet.error) throw new Error('Error updating shared mark: ' + (updateRet?.error || 'unknown'))
              const shareRet = await freepr.perms.shareRecords(feedMark._id, { grantees: ['_privatefeed:' + feedName], name: 'public_link', action: 'grant', table_id: 'com.salmanff.vulog.sharedmarks' })
              if (!shareRet || shareRet.error) throw new Error('Error sharing: ' + (shareRet?.error || 'unknown'))
              buttonHolder.appendChild(dg.div({ style: { padding: '10px', color: 'red' } }, 'Reposted!!'))
              await refreshSharedMarksinVstateFor(purl)
              outer.setAttribute('vStateChanged', 'true')
              return shareRet
            } catch (e) {
              buttonHolder?.parentElement?.parentElement?.appendChild(dg.div({ style: { padding: '10px', color: 'red' } }, 'There was an error reposting to your feed. Please try again.'))
              console.warn('caught err in online action', { e })
              return { error: e?.error }
            }
          }
        })
        const deleteButt = lister.makePublicShareButton({
          title: 'Remove from feed',
          buttonText: 'Remove',
          style: { color: 'red' },
          onlineAction: async function () {
            const buttonHolder = deleteButt.parentElement
            try {
              if (!feedMark) throw new Error('No public mark found')
              buttonHolder.innerHTML = ''
              const shareRet = await freepr.perms.shareRecords(feedMark._id, { grantees: ['_privatefeed:' + feedName], name: 'public_link', action: 'deny', table_id: 'com.salmanff.vulog.sharedmarks' })
              if (!shareRet || shareRet.error) throw new Error('Error sharing: ' + (shareRet?.error || 'unknown'))
              const deleteRet = await freepr.feps.delete(feedMark._id, { app_table: 'com.salmanff.vulog.sharedmarks' })
              if (!deleteRet || deleteRet.error) throw new Error('Error sharing: ' + (deleteRet?.error || 'unknown'))
              if (!deleteRet || deleteRet.error) throw new Error('Error updating shared mark: ' + (deleteRet?.error || 'unknown'))
              if (deleteRet.success) {
                buttonHolder.appendChild(dg.div({ style: { padding: '10px', color: 'red' } }, 'Removed!'))
                buttonHolder.nextSibling.innerHTML = ''
                // remove deleted item from state:
                await refreshSharedMarksinVstateFor(purl)
                outer.setAttribute('vStateChanged', 'true')
              }
              return deleteRet
            } catch (e) {
              buttonHolder.parentElement.parentElement.appendChild(dg.div({ style: { padding: '10px', color: 'red' } }, 'There was an error remvoing the link. Please try again.'))
              console.warn('caught err in online action', { e })
              return { error: e?.error }
            }
          }
        })

        const holder = dg.div({ style: { display: 'grid', 'grid-template-columns': '1fr 1fr 1fr' } })
        holder.appendChild(dg.span({ style: { 'font-weight': 'bold' } }, feedName + ':'))
        holder.appendChild(dg.div({ style: { 'text-align': 'right' } }, deleteButt))
        holder.appendChild(dg.div({ style: { 'text-align': 'right' } }, updateButt))
        feedDiv.appendChild(holder)
      }
      outer.appendChild(feedDiv)
    })
  }
  return outer
}
drawSharingSubsection._messages = function (purl, options) {
  const perms = permsFromFreezrMetaState()
  const outer = options?.existingDiv || collapsibleDiv('sharingArea_messages')
  outer.innerHTML = ''
  outer.setAttribute('shareType', '_messages')

  if (!perms.haveMessagingPerm || !perms.haveContactsPerm) {
    const innerPerms = dg.span()
    if ((!perms.haveMessagingPerm && perms.haveContactsPerm) || (perms.haveMessagingPerm && !perms.haveContactsPerm)) innerPerms.innerText = 'You have only granted one of the two permissions'
    outer.appendChild(dg.div({ style: { padding: '5px' } }, innerPerms, dg.div('You need to grant two permission to send messages.'), dg.a({ href: '/account/app/settings/com.salmanff.vulog' }, 'Press here to grant   permissions.')))
    return outer
  }

  if (!vState.friends || vState.friends.length === 0) {
    outer.appendChild(dg.div(dg.span('You have no contacts. ;( ...'), dg.a({ href: '/account/contacts' }, 'Press here to add contacts..')))
  } else {
    overlayUtils.setUpMessagePurlWip(purl)

    outer.appendChild(overlayUtils.redrawFriendScrollerFor(purl))
    // recolorFriendScrollerFor(purl, outer)
    outer.appendChild(overlayUtils.redrawSendMessagePaneFor(purl))
  }
  return outer
}
const hasPublicMark = function (purl) {
  if (!purl) return false
  const sharedMarksList = vState.sharedmarks?.lookups ? vState.sharedmarks.lookups[purl] : null
  // takes a list of queried sharedmakrks to see if any are public
  if (!sharedMarksList || sharedMarksList.length === 0) return false
  return sharedMarksList.some(mark => mark.isPublic)
}
const getPublicMark = function (purl) {
  const sharedMarksList = vState.sharedmarks?.lookups ? vState.sharedmarks.lookups[purl] : null
  // takes a list of queried sharedmakrks to see if any are public
  if (!sharedMarksList || sharedMarksList.length === 0) return null
  return sharedMarksList.find(m => m.isPublic)
}
const getPublicUrl = function (publicMark) {
  if (publicMark?._accessible?._public && publicMark._accessible._public['com_salmanff_vulog/public_link']?.granted) return publicMark._accessible._public['com_salmanff_vulog/public_link'].public_id
  return null
}
const getPrivateMark = function (purl) {
  if (!purl) return false
  const sharedMarksList = vState.sharedmarks?.lookups ? vState.sharedmarks.lookups[purl] : null
  // takes a list of queried sharedmakrks to see if any are public
  if (!sharedMarksList || sharedMarksList.length === 0) return null
  return sharedMarksList.find(mark => (!mark.isPublic && mark._accessible?._privatelink && mark._accessible._privatelink['com_salmanff_vulog/public_link']?.granted))
}
const getPrivateUrl = function (privateMark) {
  const grantedAccessible = (privateMark?._accessible?._privatelink && privateMark._accessible._privatelink['com_salmanff_vulog/public_link']?.granted)
  if (!grantedAccessible) return null

  const accessibleObj = privateMark._accessible._privatelink['com_salmanff_vulog/public_link']
  const code = (accessibleObj.codes && accessibleObj.codes.length > 0) ? accessibleObj.codes[0] : null
  if (!code) return null
  return accessibleObj.public_id + '?code=' + code
}
const getFeedMark = function (purl, feedName) {
  if (!purl) return false
  const sharedMarksList = vState.sharedmarks?.lookups ? vState.sharedmarks.lookups[purl] : null
  // takes a list of queried sharedmakrks to see if any are public
  if (!sharedMarksList || sharedMarksList.length === 0) return null
  return sharedMarksList.find(mark => (
    !mark.isPublic &&
    mark._accessible?._privatefeed &&
    mark._accessible._privatefeed['com_salmanff_vulog/public_link']?.granted &&
    mark._accessible._privatefeed['com_salmanff_vulog/public_link']?.names.indexOf(feedName) > -1
  ))
}
const getPublishDate = function (sharedMark, type) {
  if (sharedMark?._accessible && sharedMark?._accessible[type] && sharedMark._accessible[type]['com_salmanff_vulog/public_link']?.granted) return sharedMark._accessible[type]['com_salmanff_vulog/public_link']._date_published
  return null
}
const getMarkFromVstateList = function (purl, options) {
  // options: excludeComments, excludeHLights, excludeHandC
  const list = vState.queryParams.list
  const items = (vState[list] && vState[list].unfilteredItems) ? vState[list].unfilteredItems : []
  const oneItem = items.find(item => item.purl === purl)
  if (!oneItem) return null
  if (list === 'history') return convertLogToMark(oneItem)

  if (options?.excludeHlights || options?.excludeHandC) oneItem.vHighlights = []
  if (options?.excludeComments || options?.excludeHandC) oneItem.vComments = []

  return oneItem
}

const collapsibleDiv = function (className) {
  return dg.div({
    style: { height: 0, overflow: 'hidden', transition: 'height 0.2s ease-out' },
    className
  })
}

const errStyle = {
  margin: '5px',
  padding: '5px',
  border: '2px solid red',
  color: 'red',
  'border-radius': '5px'
}
lister.minMaximizeButt = function (id, vState) {
  const butt = dg.div({ className: 'minMaximizeButt', style: { width: '14px', height: '11px', 'border-radius': '2px', border: '1px solid cornflowerblue', float: 'right', cursor: 'pointer', 'margin-right': '3px' } })
  butt.onclick = async function () {
    await lister.setItemExpandedStatus(id, vState)
    // try {
    // } catch (e) {
    //   console.warn('err in updating ', { e })
    // }
  }
  return butt
}
lister.minMaximizeButtSet = function (butt, showMax) {
  if (showMax) {
    butt.style['border-top'] = '4px solid cornflowerblue'
    butt.style['border-bottom'] = '1px solid cornflowerblue'
  } else {
    butt.style['border-top'] = '1px solid cornflowerblue'
    butt.style['border-bottom'] = '4px solid cornflowerblue'
  }
}

// filtering / pages
lister.filterItemsInMainDivOrGetMore = async function (vState, source) {
  const mainDiv = vState.divs.main
  const list = vState.queryParams.list

  lister.endCard.showLoading()
  // if (source !== 'auto') window.scrollTo(0, 0)

  const SHOW_INCREMENTS = 20
  const MAX_AUTO_INCREMENTS = 4
  vState.loadState.source = source
  if (source !== 'auto') { vState.loadState.autoTries = 0 }
  if (source === 'initialLoad' || source === 'searchChange') {
    vState.loadState.totalShown = 0 // todo needed?
    vState.loadState.gotAll = false
    vState.shownNum = 0
    lister.getQueryParams()

    if (vState[list].filteredItems && vState[list].filteredItems.length > 0) {
      vState[list].filteredItems.forEach(item => {
        const cardDiv = dg.el('vitem_id_' + item._id)
        if (cardDiv) cardDiv.parentElement.remove()
      })
    }
    vState[list].filteredItems = []
    lister.resetDatesForList(list)
    // lister.endCard.showMore(vState)
    // resetOldestItems etc...
    // nb queryparams should be updated everytime there is a letter added to searchbox
  }
  const newShowTotal = vState.loadState.totalShown + SHOW_INCREMENTS

  const { newShownNum, unShownItemRemain } = lister.showHideCardsBasedOnFilters[list](vState, newShowTotal, source)

  if (unShownItemRemain || newShownNum > vState.shownNum) {
    setTimeout(() => { lister.endCard.showMore(vState) }, 300)
    // doNothing - more button should work
  } else if (vState.loadState.autoTries < MAX_AUTO_INCREMENTS) {
    vState.loadState.autoTries++
    const newItems = await lister.getMoreItems(vState)
    // onsole.log('GETTING NEW ITEMS FROM SERVER vState.loadState.autoTries', vState.loadState.autoTries, { newShownNum, list, newItems })
    if (newItems.length === 0) {
      vState.loadState.gotAll = true
      lister.endCard.showNoMore()
    } else {
      lister.drawCardsOnMainDiv(list, newItems, mainDiv)
      // test
      setTimeout(async () => {
        await lister.filterItemsInMainDivOrGetMore(vState, 'auto')
      }, 200)
    }

    // NB if (newShowTotal === vState.loadState.totalShown) {  Nothing new was shown as a result of the filter... should search more
  } else {
    // manual butt
    setTimeout(() => { lister.endCard.showMore(vState) }, 500)
  }
  vState.loadState.totalShown = newShowTotal
  vState.shownNum = newShownNum
}
lister.fitsWordSearchCriteria = function (vSearchString, queryWords) {
  let fits = true
  if (!vSearchString) console.warn('no search words ', { vSearchString, queryWords })
  if (!vSearchString) vSearchString = ''
  if (!isNaN(vSearchString)) vSearchString = vSearchString + ''
  if (vSearchString?.length === 0 || !queryWords || !queryWords.trim()) return true

  queryWords = queryWords.split(' ')
  queryWords.forEach(queryWord => {
    queryWord = queryWord.toLowerCase().trim()
    if (!queryWord) {
      // do nothing
    } else if (queryWord.indexOf('!') === 0) {
      if (queryWord.length > 1 && vSearchString.indexOf(queryWord.slice(1)) > -1) fits = false
    } else {
      if (vSearchString.indexOf(queryWord) < 0) fits = false
    }
  })
  return fits
}
lister.showHideCardsBasedOnFilters = {
  hideAll: function (vState) {
    lister.endCard.showLoading()
    const list = vState.queryParams.list
    const { unfilteredItems, filteredItems } = vState[list]
    const items = [...filteredItems, ...unfilteredItems]
    for (let i = items.length - 1; i >= 0; i--) {
      const cardDiv = dg.el(lister.idFromMark(items[i]))
      // const cardDiv = dg.el('vitem_id_' + items[i]._id)
      // const cardDiv = lister.idFromMark(items[i])
      if (cardDiv) lister.showHideCard(cardDiv, false, { list })
    }
  },
  marks: function (vState, newShowTotal, source) {
    let newShownNum = 0
    let unShownItemRemain = false

    const fitsCriteria = function (item, queryParams) {
      let fits = true

      // temp - all should have a vsearchstring
      if (item && !item.vSearchString) item.vSearchString = resetVulogKeyWords(item)

      fits = lister.fitsWordSearchCriteria(item?.vSearchString, queryParams.words)
      if (fits) {
        if (queryParams.starFilters && queryParams.starFilters.length > 0) {
          queryParams.starFilters.forEach(starFilter => {
            if (['inbox', 'star'].indexOf(starFilter) > -1) {
              if (!item.vStars || item.vStars.indexOf(starFilter) < 0) fits = false
            } else if (starFilter === 'vHighlights') {
              if (!item.vHighlights || item.vHighlights.length === 0) fits = false
            } else if (starFilter === 'vNote') {
              if (!item.vNote) fits = false
            }
          })
        }
      }
      return fits
    }

    const { unfilteredItems, filteredItems } = vState.marks
    const items = [...filteredItems, ...unfilteredItems]
    items.forEach(item => {
      const cardDiv = item._id ? dg.el('vitem_id_' + item._id) : (item.fj_local_temp_unique_id ? dg.el('vitem_temp_' + item.fj_local_temp_unique_id) : null)
      if (cardDiv) {
        const doesFit = fitsCriteria(item, vState.queryParams)
        const doShow = doesFit && (newShownNum < newShowTotal)
        if (doesFit && !doShow) unShownItemRemain = true
        if (doShow) newShownNum++
        const options = { list: 'marks' }
        lister.showHideCard(cardDiv, doShow, options)
      } else {
        console.warn('SNB - item not shown ', { item })
      }
    })
    return { newShownNum, unShownItemRemain }
  },
  messages: function (vState, newShowTotal, source) { // currently this is cut and paste from markes - needs to be redone for messages
    let newShownNum = 0
    let unShownItemRemain = false

    const fitsCriteria = function (item, queryParams) {
      let fits = true
      fits = lister.fitsWordSearchCriteria(item?.vSearchString, queryParams.words)

      // to add people filters...
      return fits
    }

    const { unfilteredItems, filteredItems } = vState.messages
    const items = [...unfilteredItems, ...filteredItems]
    items.forEach(item => {
      const cardDiv = dg.el('vitem_id_' + item._id)
      if (cardDiv) {
        const doesFit = fitsCriteria(item, vState.queryParams)
        const doShow = doesFit && (newShownNum < newShowTotal)
        if (doesFit && !doShow) unShownItemRemain = true
        if (doShow) newShownNum++
        const options = { list: 'messages' }
        lister.showHideCard(cardDiv, doShow, options)
      } else {
        console.warn('SNB - item not shown ', { item })
      }
    })
    return { newShownNum, unShownItemRemain }
  },
  history: function (vState, newShowTotal) {
    let newShownNum = 0
    let unShownItemRemain = false

    const fitsCriteria = function (item, queryParams) {
      let fits = true
      // temp - all should have a vsearchstring
      if (item && !item.vSearchString) item.vSearchString = resetVulogKeyWords(item)
      fits = lister.fitsWordSearchCriteria(item?.vSearchString, queryParams.words)
      if (fits) {
        if (queryParams.date && (item.vCreated || item._date_created) > queryParams.date.getTime()) fits = false
      }
      return fits
    }

    // const isFiltered = (vState.queryParams.words || vState.queryParams.dateFilters)

    if (!vState.history) vState.history = lister.emptyStatsObj()

    const { unfilteredItems, filteredItems } = vState.history
    const items = [...filteredItems, ...unfilteredItems]
    let counter = 0
    items.forEach(item => {
      const cardDiv = dg.el(lister.idFromMark(item)) // 'vitem_id_' + item._id) 
      if (cardDiv) {
        const doesFit = fitsCriteria(item, vState.queryParams)
        const doShow = doesFit && (newShownNum < newShowTotal)
        if (doesFit && !doShow) unShownItemRemain = true
        if (doShow) newShownNum++
        const options = { list: 'history' }
        if (!doShow) options.uncollpasePrevious = true
        lister.showHideCard(cardDiv, doShow, options) // , { isFiltered, vCollapsible: item.vCollapsible })
      } else {
        if (vState.tempUndrawnIds.indexOf(item._id) < 0)console.warn('SNB - item not shown ', { counter, item })
        // console.warn('SNB - item not shown ', { counter, item })
      }
      counter++
    })
    return { newShownNum, unShownItemRemain }
  },
  publicmarks: function (vState, newShowTotal, source) {
    let newShownNum = 0
    let unShownItemRemain = false

    const fitsCriteria = function (item, queryParams) {
      let fits = true
      // temp - all should have a vsearchstring
      if (item && !item.vSearchString) item.vSearchString = resetVulogKeyWords(item)

      fits = lister.fitsWordSearchCriteria(item?.vSearchString, queryParams.words)
      if (fits) {
        if (queryParams.starFilters && queryParams.starFilters.length > 0) {
          queryParams.starFilters.forEach(starFilter => {
            if (starFilter === 'vHighlights') {
              if (!item.vHighlights || item.vHighlights.length === 0) fits = false
            }
          })
        }
      }
      return fits
    }

    const { unfilteredItems, filteredItems } = vState.publicmarks
    const items = [...filteredItems, ...unfilteredItems]
    items.forEach(item => {
      const cardDiv = item._id ? dg.el('vitem_id_' + item._id) : (item.fj_local_temp_unique_id ? dg.el('vitem_temp_' + item.fj_local_temp_unique_id) : null)
      if (cardDiv) {
        const doesFit = fitsCriteria(item, vState.queryParams)
        const doShow = doesFit && (newShownNum < newShowTotal)
        if (doesFit && !doShow) unShownItemRemain = true
        if (doShow) newShownNum++
        const options = { list: 'publicmarks' }
        lister.showHideCard(cardDiv, doShow, options)
      } else {
        console.warn('SNB - item not shown ', { item })
      }
    })
    return { newShownNum, unShownItemRemain }
  }
}
lister.showHideCard = function (cardDiv, doShow, options) {
  // options: isFiltered vCollapsible
  const parent = cardDiv.parentElement

  if (vState.viewType === 'fullHeight') {
    parent.style.height = doShow ? '100%' : '0'
  } else {
    parent.style.width = doShow ? (lister.dims[options.list].width + 'px') : '0'
    parent.style.padding = doShow ? '10px' : '0'
  }
  // parent.style.margin = doShow ? '15px' : '0'

  if (options?.list === 'history'){
    const shouldCollpase = (parent.getAttribute('vCollapsible') && !(vState.queryParams.words))
    lister.setCardAsCollapsible(cardDiv, (doShow && shouldCollpase), options)
    if (!doShow) cardDiv.parentElement.style['margin-right'] = 0
    // if (!doShow && options?.uncollpasePrevious) { // uncollpase a card if the card in front of it has been filtered out
    //   const prevCardParent = parent.previousSibling
    //   if (prevCardParent && prevCardParent.getAttribute('vCollapsible') && prevCardParent.style.width !== '0px') lister.setCardAsCollapsible(prevCardParent.firstChild, false, options)
    // }
  }

    // orginal version
    // const shouldCollpase = (parent.getAttribute('vCollapsible')) 
    //   if (doShow && shouldCollpase) lister.setCardAsCollapsible(cardDiv, true, options)
    //   if (!doShow && options?.uncollpasePrevious) { // uncollpase a card if the card in front of it has been filtered out
    //     const prevCardParent = parent.previousSibling
    //     if (prevCardParent && prevCardParent.getAttribute('vCollapsible') && prevCardParent.style.width !== '0px') lister.setCardAsCollapsible(prevCardParent.firstChild, false, options)
    //   }
    

  // if (options.list === 'history') {
  //   if (doShow && shouldCollpase) lister.setCardAsCollapsible(cardDiv, true, options)
  //   if (!doShow) {
  //     cardDiv.style.margin = 0
  //     if (options?.uncollpasePrevious) { // uncollpase a card if the card in front of it has been filtered out
  //       let prevCardParent = parent.previousSibling
  //       while (prevCardParent && prevCardParent.style.width === '0px') prevCardParent = prevCardParent.previousSibling
  //       if (prevCardParent && prevCardParent.getAttribute('vCollapsible') && prevCardParent.style.width !== '0px') lister.setCardAsCollapsible(prevCardParent.firstChild, false, options)
  //     }
  //   }
  // }

  if (vState.viewType === 'fullHeight') {
    cardDiv.style.transform = doShow ? 'rotateX(0deg)' : 'rotateX(90deg)'
  } else {
    cardDiv.style.transform = doShow ? 'rotateY(0deg)' : 'rotateY(90deg)'
  }
}
lister.setCardAsCollapsible = function (cardDiv, doSet, options) {
  const parent = cardDiv.parentElement
  cardDiv.style.transition = 'all 1.0s ease-out'
  cardDiv.style['background-color'] = doSet ? 'lightgrey' : 'white'

  parent.style['margin-right'] = doSet ? ('-' + (lister.dims[options.list].width - 10) + 'px') : '15px'

  const extlink = cardDiv.querySelector('.fa-external-link')
  if (extlink) extlink.style.display = doSet ? 'none' : 'inline-block'
  const greyMessage = cardDiv.querySelector('.greyMessage')
  if (greyMessage) greyMessage.style.display = doSet ? 'block' : 'none'

  const collapsibleSides = ['.scrollAndTimeSpent', '.dateString', '.smallStarsOnCard', '.domainTitle', '.cardImageBox']
  collapsibleSides.forEach(hidableClass => {
    const hieableDiv = cardDiv.querySelector(hidableClass)
    if (hieableDiv) hieableDiv.style.display = doSet ? 'none' : 'block'
    // if (hieableDiv) hieableDiv.style['margin-left'] = doSet ? '20px' : null
  })

  const titleDiv = cardDiv.querySelector('.vulog_title_url')
  titleDiv.style.transition = 'all 0.5s ease-out'
  titleDiv.style.width = doSet ? ((lister.dims[options.list].height - 30) + 'px') : null
  titleDiv.style.height = doSet ? '16px' : '30px'
  titleDiv.style.transform = doSet ? 'rotate(90deg)' : 'rotate(0deg)'
  titleDiv.style['transform-origin'] = 'left'
  titleDiv.style['margin-top'] = doSet ? '-5px' : '5px'
  titleDiv.style['margin-left'] = doSet ? '7px' : '0px'
  const showFullCard = function (e) {
    e.preventDefault()
    lister.setCardAsCollapsible(cardDiv, false, options)
  }
  cardDiv.onclick = doSet ? showFullCard : null
}
lister.getMoreItems = async function (vState) {
  if (!vState.environmentSpecificGetOlderItems) {
    throw new Error('need to define environmentSpecificGetOlderItems to be able to get items')
  }

  const list = vState.queryParams.list
  // if (!vState[list]) vState[list] = lister.emptyStatsObj()

  if (list !== 'messages') {
    return await lister.getMoreAndUpdateCountStatsFor(list, vState)
  } else { // messages is actually two lists that need to be merged
    return await lister.getAllMessagesAndMerge(vState)
  }
}
lister.getAllMessagesAndMerge = async function (vState) {
  // if (!vState.sentMsgs) vState.sentMsgs = lister.emptyStatsObj()
  // if (!vState.gotMsgs) vState.gotMsgs = lister.emptyStatsObj()
  const newSentMsgs = await lister.getMoreAndUpdateCountStatsFor('sentMsgs', vState)
  const newGotMsgs = await lister.getMoreAndUpdateCountStatsFor('gotMsgs', vState)
  const newItems = lister.mergeNewAndExistingMessages([], newSentMsgs, newGotMsgs) // note - really [] shoul;d be replaced by vState.messages.unfilteredItems - chec why old and new were seaprated befpore

  if (!vState.messages) vState.messages = lister.emptyStatsObj()
  if (!vState.messages.dates) vState.messages.dates = lister.emptyStatsObjDatesItem() // nb this should not happen but it does - ie potential bug in re-onitiating
  if (!vState.messages.unfilteredItems) vState.messages.unfilteredItems = []
  if (!vState.messages.filteredItems) vState.messages.filteredItems = []
  vState.messages.unfilteredItems = [...vState.messages.unfilteredItems, ...newItems]
  if (!vState.messages.dates) console.warn('messages.dates not initatlised')
  vState.messages.dates.oldestModified = [...vState.messages.unfilteredItems, ...vState.messages.filteredItems].reduce((acc, msg) => Math.min(msg._date_modified || new Date().getTime(), acc), vState.messages.dates.oldestModified)
  vState.messages.dates.newestModified = [...vState.messages.unfilteredItems, ...vState.messages.filteredItems].reduce((acc, msg) => Math.max(msg._date_modified || 0, acc), vState.messages.dates.newestModified)

  return newItems
}
const getAllMessagesAndUpdateStateteFor = async function (purl) {
  const retInfo = await vState.environmentSpecificSyncAndGetMessage(purl)
  if (!retInfo) return {}
  if (retInfo.error) return { error: retInfo.error }

  const mergedItems = retInfo.mergedMessages
  if (!mergedItems || mergedItems.length === 0) return { itemJson: {} }
  let itemJson = null

  mergedItems.forEach(item => {
    if (!item.record) {
      console.warn('no recrod to merge for ', item)
    } else if (!itemJson) {
      itemJson = convertDownloadedMessageToRecord(item)
    } else {
      itemJson = mergeMessageRecords(itemJson, item)
    }
  })

  const idx = vState.messages.unfilteredItems.findIndex((f) => f.purl === purl)
  if (idx < 0) {
    vState.messages.unfilteredItems.push(itemJson)
  } else {
    vState.messages.unfilteredItems[idx] = itemJson
  }
  vState.messages.unfilteredItems.sort(dateLatestMessageSorter)

  return { itemJson }
  // find purl in messages and update it
}
lister.mergeNewAndExistingMessages = function (existingitems, newSentOrGotMsgs1, newSentOrGotMsgs2) {
  if (!newSentOrGotMsgs1) newSentOrGotMsgs1 = []
  if (!newSentOrGotMsgs2) newSentOrGotMsgs2 = []
  const allNew = [...newSentOrGotMsgs1, ...newSentOrGotMsgs2]
  const itemJson = {}

  existingitems.forEach(item => {
    if (itemJson[item.record.purl]) console.warn('same putl appearing twice in merged messages???')
    itemJson[item.record.purl] = item
  })
  allNew.forEach(item => {
    if (!item.record) {
      console.warn('no recrod to merge for ', item)
    } else if (!itemJson[item.record.purl]) {
      itemJson[item.record.purl] = convertDownloadedMessageToRecord(item)
    } else {
      itemJson[item.record.purl] = mergeMessageRecords(itemJson[item.record.purl], item)
    }
  })
  const newItemsReturned = []
  for (const purl in itemJson) {
    itemJson[purl].vSearchString = resetVulogKeyWords(itemJson[purl])
    newItemsReturned.push(itemJson[purl])
  }
  newItemsReturned.sort(dateLatestMessageSorter)
  return newItemsReturned
}

lister.emptyStatsObj = function () {
  return {
    gotCount: 0,
    unfilteredItems: [],
    filteredItems: [],
    dates: lister.emptyStatsObjDatesItem(),
    lookups: {}
  }
}
lister.emptyStatsObjDatesItem = function () {
  return {
    oldestCreated: new Date().getTime(),
    newestModified: 0,
    oldestModified: new Date().getTime()
  }
}
lister.resetDatesForList = function (list) {
  const statsObject = vState[list]
  if (!statsObject.dates) statsObject.dates = lister.emptyStatsObjDatesItem()
  const mergedList = [...statsObject.unfilteredItems, ...statsObject.filteredItems]
  statsObject.dates.oldestModified = mergedList.reduce((acc, item) => Math.min((item?._date_modified || item?.fj_modified_locally || new Date().getTime()), acc), new Date().getTime())
  statsObject.dates.newestModified = mergedList.reduce((acc, item) => Math.max((item?._date_modified || item?.fj_modified_locally || 0), acc), 0)
  statsObject.dates.oldestCreated = mergedList.reduce((acc, item) => Math.min((item?.vCreated || item?._date_created || new Date().getTime()), acc), new Date().getTime())
}
lister.getMoreAndUpdateCountStatsFor = async function (list, vState) {
  // onsole.log(' getMoreAndUpdateCountStatsFor')
  // this should only be used in getMoreItems or for marks, as it doesnt add the hasmarks key to the record

  if (!vState[list]) vState[list] = lister.emptyStatsObj()
  const statsObject = vState[list]

  // source oldest
  const SEARCHCOUNT = 100
  // let oldestModified = statsObject.dates.oldestModified
  // if (statsObject.filteredItems.length > 0) oldestModified = [... statsObject.unfilteredItems, ... statsObject.filteredItems].reduce((acc, item) => Math.min((item?._date_modified || item?.fj_modified_locally || new Date().getTime()), acc), statsObject.dates.oldestModified)
  
  // logic needs to be that this is reset when filtered items are..

  if (vState.loadState.gotAll) console.warn('SNBH - gotAll was marked so why fetched more?')
  if (vState.loadState.gotAll) return []

  const { newItems, typeReturned } = await vState.environmentSpecificGetOlderItems(list, { getCount: SEARCHCOUNT, dates: statsObject.dates, queryParams: lister.getQueryParams(), gotCount: statsObject.unfilteredItems.length, alreadyGotFIlteredItems: (statsObject.filteredItems.length > 0) }) // gotCount no longer needed??
  // onsole.log('getMoreAndUpdateCountStatsFor newItems', {newItems, typeReturned, dates: statsObject.dates })
  // environmentSpecificGetOlderItems judges whether to return unfiltered or filtered items -
  // ideally a number of unfiltered items are returned so graphics can be nade nice.. adn then the filtered items are retirned so asd to make search more efficient

  if (['history', 'marks', 'sentMsgs', 'gotMsgs', 'publicmarks'].indexOf(list) > -1) {
    statsObject.gotCount += newItems.length

    if (typeReturned === 'unfilteredItems' || typeReturned === 'filteredItems') {
      statsObject[typeReturned] = [...statsObject[typeReturned], ...newItems]
    } else {
      throw new Error('type need to be unfilteredItems or filteredItems - cirrently is ', typeReturned)
    }
    // if (!statsObject.oldestItem || isNaN(statsObject.oldestItem)) statsObject.oldestItem = new Date().getTime()
    if (!statsObject.dates) console.warn('stats obj dates hsant been initialised')
    if (!statsObject.dates) statsObject.dates = lister.emptyStatsObjDatesItem()
    statsObject.dates.oldestModified = newItems.reduce((acc, item) => Math.min((item?._date_modified || item?.fj_modified_locally || new Date().getTime()), acc), statsObject.dates.oldestModified)
    statsObject.dates.newestModified = newItems.reduce((acc, item) => Math.max((item?._date_modified || item?.fj_modified_locally || 0), acc), statsObject.dates.newestModified)
    statsObject.dates.oldestCreated = newItems.reduce((acc, item) => Math.min((item?.vCreated || item?._date_created || new Date().getTime()), acc), statsObject.dates.oldestCreated)

    if (list === 'history') {
      newItems.sort(sortBycreatedDate).reverse()
      // todo - cam merge adjacent ones with same
    } else if (list === 'messages') {
      newItems.sort(dateLatestMessageSorter)
    } else if (list === 'marks') {
      newItems.sort(sortBycreatedDate).reverse()
    } else if (list === 'publicmarks') {
      newItems.sort(sortByPublishedDate).reverse()
    }

    if (list === 'marks') {
      newItems.forEach(item => {
        if (!statsObject.lookups[item.purl]) statsObject.lookups[item.purl] = item
      })
    }
    return newItems
  } else if (list === 'tabs') { // tabs
    vState.loadState.gotAll = true
    const openTabs = {}
    const closedTabs = {}

    if (newItems?.currentTabs && newItems?.currentTabs.lemngth > 0) {
      newItems.currentTabs.forEach(openTab => {
        if (!openTabs[openTab.windowId]) openTabs[openTab.windowId] = {}
        if (newItems.logDetailsInRAM[openTab.id]) {
          openTabs[openTab.windowId][openTab.id] = newItems.logDetailsInRAM[openTab.id]
          // iterate through and remove duplicates
        } else {
          openTabs[openTab.windowId][openTab.id] = [openTab]
          // covnert to log type object purl, title, tabid, tabWindowId
        }
        delete newItems.logDetailsInRAM[openTab.id]
      })
      for (const [tabId, closedTab] of Object.entries(newItems.logDetailsInRAM)) {
        const tabWindowId = closedTab[0].tabWindowId || 'unknownWindow'
        if (!closedTabs[tabWindowId]) closedTabs[tabWindowId] = {}
        closedTabs[tabWindowId][tabId] = closedTab
      }
    } 

    statsObject.tabitems = { openTabs, closedTabs }
    return { openTabs, closedTabs }
  } else {
    console.error('SNBH')
  }
}
lister.drawFilters = function (vState) {
  const filterDiv = vState.divs.searchFilters
  filterDiv.innerHTML = ''
  const queryParams = vState.queryParams
  const { list } = queryParams //  starFilters, dateFilters 
  const filterOuterParams = { style: { 'vertical-align': 'super', display: 'inline-block', 'margin-right': '5px', color: 'lightgrey' } }
  const filterInnerParams = {
    style: { 'background-color': 'white', 'border-radius': '3px', display: 'inline-block', color: 'darkgrey', height: '29px', 'margin-right': '5px' }
  }
  if (list === 'marks') {
    const STARS = ['star', 'inbox', 'vHighlights', 'vNote']
    filterDiv.appendChild(dg.div(filterOuterParams, 'Filters: '))
    const includeFilters = dg.div(filterInnerParams,
      dg.span({ style: { 'vertical-align': 'super' } }, ' ')) // Must have
    STARS.forEach(starName => { includeFilters.appendChild(lister.addFilterStar(starName, vState)) })
    filterDiv.appendChild(includeFilters)
    // var excludeFilters = dg.span({ className: 'longcepsButt' }, 'Cannot have: ')
    // MAIN_STARS.forEach(starName => { excludeFilters.appendChild(lister.filterAdder(list, starName, 'exclude')) })
    // filterDiv.appendChild(excludeFilters)
  }
}
lister.addFilterStar = function (star, vState) {
  const queryParams = vState.queryParams
  if (!queryParams.starFilters) queryParams.starFilters = []
  const existingFilters = queryParams.starFilters
  const chosen = (existingFilters.indexOf(star) > -1)
  return dg.span({
    className: ('vulog_overlay_' + star + '_' + (chosen ? 'ch' : 'nc')),
    style: { scale: 0.8 },
    onclick: async function (e) {
      const newChosen = !(e.target.className.slice(-2) === 'ch')
      if (newChosen) vState.queryParams.starFilters.push(star)
      if (!newChosen) vState.queryParams.starFilters.splice(queryParams.starFilters.indexOf(star), 1)
      e.target.className = ('vulog_overlay_' + star + '_' + (newChosen ? 'ch' : 'nc'))
      await lister.filterItemsInMainDivOrGetMore(vState, 'searchChange')
    }
  })
}

// utilities
lister.getdomain = function (aUrl) {
  if (!aUrl) return 'Missing aUrl'
  const start = aUrl.indexOf('//') + 2
  const stop = aUrl.slice(start).indexOf('/')
  return aUrl.slice(0, stop + start)
}
lister.dragElement = function (elmnt, vState) {
  // https://www.w3schools.com/howto/howto_js_draggable.asp
  let pos1 = 0
  let pos2 = 0
  let pos3 = 0
  let pos4 = 0

  if (document.getElementById(elmnt.id + 'header')) {
    // if present, the header is where you move the DIV from:
    document.getElementById(elmnt.id + 'header').onmousedown = dragMouseDown
    document.getElementById(elmnt.id + 'header').ontouchstart = dragTouchDown
  }
  // else {
  //   // otherwise, move the DIV from anywhere inside the DIV:
  //   elmnt.onmousedown = dragMouseDown;
  // }

  function dragMouseDown (e) {
    e = e || window.event
    e.preventDefault()
    // get the mouse cursor position at startup:
    pos3 = e.clientX
    pos4 = e.clientY
    elmnt.style['z-index'] = vState.zIndex++

    document.onmouseup = closeDragElement
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag
  }
  function dragTouchDown (e) {
    e.preventDefault()
    // get the mouse cursor position at startup:
    pos3 = e.clientX || e.touches[0].clientX
    pos4 = e.clientY || e.touches[0].clientY
    elmnt.style['z-index'] = vState.zIndex++
    document.ontouchend = closeTouchDragElement
    // call a function whenever the cursor moves:
    document.ontouchmove = elementDrag
  }

  function elementDrag (e) {
    // e = e || window.event;
    e.preventDefault()

    // if (!e.clientX) dg.el('click_gototab_messages').innerText = 'touches ' + JSON.stringify(e.touches)
    // if (!e.clientX) dg.el('click_gototab_history').innerText = 'targetTouches  ' + JSON.stringify(e.targetTouches)

    if (!e.clientX) e = e.changedTouches[0] // in case of a touch event
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX
    const screenWidth = document.body.getClientRects()[0].width
    if (pos3 < 0) pos1 = 0
    if (pos3 > screenWidth) pos1 = 0
    pos2 = pos4 - e.clientY
    if (pos4 < 50) pos2 = 0
    pos3 = e.clientX
    pos4 = e.clientY
    // set the element's new position:
    // onsole.log(' element pos e.clientX', e.clientX, ' e.screenX', e.screenX)

    // elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    // elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";

    let oldMoveX = parseInt(elmnt.getAttribute('data-moveX'))
    if (isNaN(oldMoveX)) dg.el('click_gototab_messages').innerText = 'isNaN  oldMoveX ' + oldMoveX + ' ' + pos1
    if (isNaN(oldMoveX)) oldMoveX = 0
    let oldMoveY = parseInt(elmnt.getAttribute('data-moveY'))
    if (isNaN(oldMoveY)) oldMoveY = 0
    const newMoveX = oldMoveX - pos1
    const newMoveY = oldMoveY - pos2
    // dg.el('click_gototab_sentMsgs').innerText = 'm ' + pos1 + ' y ' + pos3 + ' screen ' + e.screenX + ' newMoveX ' + newMoveX +  ' oldMoveX ' + oldMoveX + 'oldMoveY' + oldMoveY +  ' newMoveY ' + newMoveY + ' attrib ' + elmnt.getAttribute('data-moveY')

    elmnt.style.transform = 'translate(' + newMoveX + 'px , ' + newMoveY + 'px)'
    elmnt.setAttribute('data-moveX', newMoveX)
    elmnt.setAttribute('data-moveY', newMoveY)
  }

  function closeDragElement () {
    // stop moving when mouse button is released:
    document.onmouseup = null
    document.onmousemove = null
  }
  function closeTouchDragElement () {
    // stop moving when mouse button is released:
    document.ontouchup = null
    document.ontouchmove = null
  }
}
// time and scoll for logItems
const scrolledPercent = function (alog) {
  if (alog.vuLog_height && alog.vulog_max_scroll && !isNaN(alog.vuLog_height) && !isNaN(alog.vulog_max_scroll)) {
    return alog.vulog_max_scroll / alog.vuLog_height
  }
}
const percentString = function (fract) {
  if (!fract) return ''
  return Math.round(100 * fract) + '%'
}
const timeSpentOn = function (alog) {
  const visitDetails = alog.vulog_visit_details
  if (!visitDetails || visitDetails.length === 0) return null
  const reducerArray = [0, ...alog.vulog_visit_details]
  const timeSpent = reducerArray.reduce(function (total, obj) {
    const end = obj.end || obj.mid
    const newdiff = (end && !isNaN(end) && obj.start && !isNaN(obj.start)) ? (end - obj.start) : 0
    return total + newdiff
  })
  return timeSpent
}
const timePrettify = function (aTime) {
  if (!aTime) return ''
  return (Math.floor(aTime / 60000) > 0 ? (Math.floor(aTime / 60000) + 'mins ') : '') + (Math.round((aTime % 60000) / 1000, 0)) + 's'
}
const timeAndScrollString = function (alog) {
  const scrolled = percentString(scrolledPercent(alog))
  const time = timePrettify(timeSpentOn(alog))
  if (!scrolled && !time) return ' '
  return 'Viewed ' + (scrolled ? (scrolled + (time ? ', ' : '')) : ' ') + (time ? ('for ' + time) : '')
}

// uunused
document.addEventListener('click', e => {
  if (vState?.calendar && !getParentWithClass(e.target, 'calendar-popup') && !getParentWithClass(e.target, 'form-container')) { vState.calendar.hideCalendar() }
  // if (!getParentWithClass(e.target, 'calendar-popup') && !getParentWithClass(e.target, 'form-container')) { vState.calendar.hideCalendar()  }
})
