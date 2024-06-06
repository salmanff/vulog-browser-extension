/*
    marks.js -> com.salmanff.vulog

    version 0.0.3 - mid 2023

*/
// todo:  revise and review
/* global dg */ // from dgelements.js
/* global freezr, freepr */ // from freezr_core.js
/* global freezrMeta */ // from html
/* global lister */ // from lister.js
/* global convertLogToMark */ // from utils.js
/* global Calendar */ // from datepicker.js
/*
- getmore items -
  - abstact away for extension
  - filtered vs unfiltered
- Inside of cards
- filter by inbox etc and also use !#
- history and messages

*/

const vState = {
  // marks: {},
  // logs: {},
  // messages: {},
  // tabs: {},
  isLoggedIn: true,
  loadState: {
    tries: 0,
    totalShown: 0
  },
  zIndex: 1,
  queryParams: { list: null, words: null, starFilters: [], dateFilters: {} },
  queryPage: 0,
  querySkip: 0,
  asyncLatestMarks: async function () {
    // expected to be called when a mark has been updated to find latest items since last sync
    function apiOn() {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ msg: 'asyncListAndGetLatest', list: 'marks', since: vState.marks.dates.newestModified }, async function (retInfo) {
          resolve(retInfo)
        })
      })
    }
    async function runApi() {
      return await apiOn()
    }
    const retInfo = await runApi()

    if (retInfo && retInfo.items && retInfo.items.length > 0) {
      retInfo.items.forEach(item => {
        vState.marks.dates.newestModified = Math.max(vState.marks.dates.newestModified, item._date_modified)
      })
    }

    return retInfo
  },
  asyncLatestMarksAndUpdateVstate: async function () {
    // expected to be called when a mark has been updated to find latest items since last sync
    const retInfo = await vState.asyncLatestMarks()

    if (retInfo && retInfo.items && retInfo.items.length > 0) {
      retInfo.items.forEach(item => {
        let unfilteredItemIdx 
        if (item._id) unfilteredItemIdx = vState.marks.unfilteredItems.findIndex(m => m._id === item._id)
        if (unfilteredItemIdx < 0) unfilteredItemIdx = vState.marks.unfilteredItems.find(m => m.fj_local_temp_unique_id === item.fj_local_temp_unique_id && m.purl === item.purl)
        if (unfilteredItemIdx > -1) {
          vState.marks.unfilteredItems[unfilteredItemIdx] = item
        } else {
          vState.marks.unfilteredItems.push(item)
        }
      })
      vState.marks.unfilteredItems.sort(sortByModifedDate).reverse()
    } else if (retInfo.error) {
      vState.showWarning('There was an error updating data on this page.')
    }

    return retInfo
  },
  markOnBackEnd: async function (mark, options, theStar, starWasChosen) {
    // options - logToConvert

    function apiOn(mark, options, theStar, starWasChosen) {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({
          msg: 'mark_star',
          purl: mark.purl,
          id: mark._id,
          theStar,
          doAdd:!starWasChosen,
          props: mark,
          publishChange: false
        }, async function (retInfo) {
          resolve(retInfo)
        })
      });
    }
    async function runApi() {
      return await apiOn(mark, options, theStar, starWasChosen); 
    }
    const retInfo = await runApi()
    if (theStar === 'trash' && retInfo.success) {
      // remvoe card and remvoe from vState
      // remove card
      const cardDiv = document.getElementById(lister.idFromMark(mark))
      lister.showHideCard(cardDiv, false, { list: 'marks'})
      setTimeout(function () { 
        cardDiv.parentElement.style.display = 'none'
        cardDiv.parentElement.innerHTML = ''
      }, 1000)
      // remove from vState (should use asyncLatestMarksAndUpdateVstate - but not tested)
      const indx = vState.marks.unfilteredItems.findIndex(v => v._id === mark._id)
      if (indx >= 0) vState.marks.unfilteredItems.splice(indx, 1)
    } else if (retInfo.success) {
      // update state here should grab all ecent marks from backend and update all
      const syncResults = await vState.asyncLatestMarksAndUpdateVstate()
      if (syncResults.error) vState.showWarning('Bookmark was changed but there was an error updating this page. Try refreshing. Sorry.')

    } else {
      vState.showWarning('Could not change bookmark. Sorry. Please try again, after refreshing the page.')
    }
    return retInfo
  },
  hLightCommentSaver: async function (hLight, text, options) { // options: purl, mark,
    if (!hLight || !text || (!options.purl && !options.mark)) {
      console.warn('err here ', { hLight, text, options })
      vState.showWarning('There was an Internal error saving your comment. Sorry. Try refreshing.')
      return { error: true, msg: 'need hlight text to process' }
    }
    const purl = options?.purl || options?.mark?.purl
    const vCreated = new Date().getTime()
    const theComment = { text, vCreated, sender_id }
    if (!hLight.vComments) hLight.vComments = []
    hLight.vComments.push(theComment)
    if (document.getElementById('vulog_hlight_' + hLight.id)) document.getElementById('vulog_hlight_' + hLight.id).className = HIGHLIGHT_CLASS + ' hlightComment'
    const results = await chrome.runtime.sendMessage({ msg: 'addHLightComment', hlightId: hLight.id, text, vCreated, url: purl })
    if (!results.error) {
      const theMark = vState.marks.unfilteredItems.find(m => m.purl === purl)
      const hLightIdx = theMark.vHighlights.findIndex(m => m.id === hLight.id)
      theMark.vHighlights[hLightIdx] = hLight
      await vState.asyncLatestMarksAndUpdateVstate()
    } else {
      vState.showWarning('There was an error saving your comment. Sorry. Please try again, or refresh this page.')
    }
    return results
  },
  hLightDeleter: async function (hLight, mark) {
    for (let i = mark.vHighlights.length -1 ; i > -1; i--) {
      if (hLight.id === mark.vHighlights[i].id) {
        mark.vHighlights.splice(i,1)
      }
    }
    vState.saver.saveList.hLights[mark.id] = mark.vHighlights
    await vState.asyncLatestMarksAndUpdateVstate()
    return vState.saveWithInterValer()
  },
  saveWithInterValer: async function () {
    const now = new Date().getTime();
    if (!vState.saver.firstTimeSinceSave) vState.saver.firstTimeSinceSave = now
    clearTimeout(vState.saver.intervaler)
    if (now - vState.saver.firstTimeSinceSave > vState.saver.THRESHOLD_FOR_FORCED_SAVE) {
      vState.saver.intervaler = null // - needed??
      return await vState.saver.saveItems()
    } else {
      clearTimeout(vState.saver.intervaler)
      vState.saver.intervaler = setTimeout(vState.saver.saveItems, vState.saver.INTERVALS)
      return { success: true, note: 'set time out to save'}
    }
  },
  saver: {
    intervaler: null,
    saveList: { vNotes: {}, hLights: { }},
    firstTimeSinceSave: null,
    THRESHOLD_FOR_FORCED_SAVE: 5000, // 5 seconds before forceSave
    INTERVALS: 2000, // 2seconds
    saveItems: async function() {
      vState.saver.firstTimeSinceSave = null
      let errors = []
      for (const [_id, vNote] of Object.entries(vState.saver.saveList.vNotes)) {
        const markPartsCopy = { _id, vNote }
        const result = await freepr.feps.update(markPartsCopy, { app_table: 'com.salmanff.vulog.marks', replaceAllFields: false })
        if (!result || result.error) errors.push(result)
      }
      for (const [_id, vHighlights] of Object.entries(vState.saver.saveList.hLights)) {
        const markPartsCopy = { _id, vHighlights }
        const result = await freepr.feps.update(markPartsCopy, { app_table: 'com.salmanff.vulog.marks', replaceAllFields: false })
        if (!result || result.error) errors.push(result)
      }
      if (errors.length === 0) {
        await vState.asyncLatestMarksAndUpdateVstate()
        return { success: true }
      }
      if (errors.length > 0) vState.showWarning('There was an error uploading data to the server.')
      return { success: false, errors: { } }
    }
  },
  environmentSpecificGetOlderItems: async function (list, statParams) {
    //  msg: 'getOlderitems', list, statParams: { getCount: SEARCHCOUNT, gotCount: statsObject.gotCount, gotAll: statsObject.gotAll, dates: statsObject.dates, queryParams}
    // environmentSpecificGetOlderItems judges whether to return unfiltered or filtered items - 
    // ideally a number of unfiltered items are returned so graphics can be nade nice.. adn then the filtered items are retirned so asd to make search more efficient
    // onsole.log('environmentSpecificGetOlderItems sdsds', { list, statParams })

    // for online web based version
    // todo diff filtered and unfiltered lists
    if (statParams.gotAll) return []

    if (list === 'history') list = 'logs'

    function apiOn(list, statParams) {
      return new Promise(resolve => {
        if (list !== 'tabs') {
          chrome.runtime.sendMessage({ msg: 'getOlderitems', list, params: statParams}, async function (retInfo) {
            // onsole.log('getOlderitems retInfo', { retInfo, statParams })
            resolve(retInfo)
          })
        } else {
          chrome.runtime.sendMessage({ msg: 'getRecentTabData' }, async function (retInfo) {
            resolve(retInfo)
          })
        }
        // "{"getCount":100,"dates":{"oldestCreated":1713617490139,"newestModified":0,"oldestModified":1713617490139},"queryParams":{"list":"marks","words":"","starFilters":[],"date":null},"gotCount":0,"alreadyGotFIlteredItems":false}"

        // api.on(list, response => resolve(response));
      });
    }
    async function runApi() {
      const ret = await apiOn(list, statParams); // await is actually optional here
                                          // you'd return a Promise either way.
      if (!ret || ret.error) {
        throw new Error('could not fetch items')
      } else {
        return { newItems: ret.newItems, typeReturned: ret.typeReturned}
      }
    }
    return await runApi()

  },
  environmentSpecificSyncAndGetMessage: async function (purl) {
    function apiOn(purl) {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ msg: 'syncMessagesAndGetLatestFor', purl }, async function (retInfo) {
          resolve(retInfo)
        })
      })
    }
    async function runApi() {
      return await apiOn(purl)
    }
    return await runApi()
  },
  environmentSpecificGetMark: async function (purl) {
    console.log('environmentSpecificGetMark todo')

    function apiOn(purl) {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ msg: 'getMarkFromVulog', purl }, async function (retInfo) {
          resolve(retInfo)
        })
      })
    }
    async function runApi() {
      return await apiOn(purl); // await is actually optional here
                                          // you'd return a Promise either way.
    }
    const markFromBackground = await runApi()
    if (markFromBackground) return markFromBackground
    
    if (!freezrMeta?.appToken) return null
    console.warn('need apptoken')
    try {
      const marksFromServer = await freepr.feps.postquery({
        app_table: 'com.salmanff.vulog.marks',
        q: { fj_deleted: { $ne: true }, purl }
      })
      if (marksFromServer && marksFromServer.length > 0) return marksFromServer[0]
      // todo - consider saving so same check doesnt need to be done multiple times
      return null      
    } catch (error) {
      console.warn('Error conencting to server ', { error })
      vState.showWarning('Error conencting to server ', 500)

      // todo - store errors of conencting to server?? Or warn on load if syncing has not happenned in a ahilew
      return null 
    }    
  },
  environmentSpecificSendMessage: async function (params) {
    // params : { chosenFriends, text, hLight, markCopy }
    params.msg = 'sendMessage'
    return await chrome.runtime.sendMessage(params)
  },
  warningTimeOut: null,
  showWarning: function (msg, timing) {
    console.warn('WARNING : ' + JSON.stringify(msg))
    // null msg clears the message
    if (vState.warningTimeOut) clearTimeout(vState.warningTimeOut)
    if (!msg) {
      dg.el('warning_outer').style.display = 'none'
      dg.el('warnings', { clear: true })
    } else {
      const newWarning = dg.div(
        { style: { border: '1px solid grey', 'border-radius': '3px', padding: '3px', margin: '3px' } })
      newWarning.innerHTML = msg
      dg.el('warnings').appendChild(newWarning)
      dg.el('warning_outer').style.display = 'block'
      dg.el('warning_outer').style['z-index'] = '9999'
      if (timing) {
        setTimeout(function () {
          newWarning.remove()
          if (dg.el('warnings').innerText === '') dg.el('warning_outer').style.display = 'none'
        }, timing)
      }
    }
  }
}

freezr.initPageScripts = function() {
  setTimeout(initState, 0)
}

const initState = async function() {
  chrome.runtime.sendMessage({ msg: 'getVulogState' }, async function (vulogInfo) {
    if (vulogInfo && !vulogInfo.error) {
      // purl, currentLog, currentMark, contacts, edit_mode, cookieRemovalHasBeenCalled
      
      vState.friends = vulogInfo?.vState?.contacts //  vState.freezrMeta?.perms?.friends?.granted ? await freepr.feps.postquery({ app_table: 'dev.ceps.contacts', permission_name: 'friends' }) : []

      vState.feedcodes = vulogInfo?.vState?.feedcodes?.map(obj => ({ ...obj, type: 'privateFeed' }))
      vState.groups = vulogInfo?.vState?.groups?.map(obj => ({ ...obj, type: 'group' }))
    
      freezrMeta.set(vulogInfo?.vState?.freezrMeta)
      vState.freezrMeta = freezrMeta
      vState.offlineCredentialsExpired = !Boolean(freezrMeta.appToken)
      vState.isLoggedIn = Boolean(freezrMeta.appToken)
  
      // const permsList = await freepr.perms.getAppPermissions()
      // permsList.forEach(perm => {
      //   vState.freezrMeta.perms[perm.name] = perm
      // })
    
      
    
    } else  {
      vState.showWarning('Internal communication error. You may need to restart your browser.')
    }
  
  
    vState.divs = {}
    vState.divs.main = dg.el('vulogRecords')
    vState.divs.spinner = dg.el('spinner')
    vState.divs.searchBox = dg.el('idSearchMarksBox')
    vState.divs.searchButton = dg.el('click_search_marks')
    vState.divs.searchFilters = dg.el('click_search_filters')
    vState.divs.dateFilter = dg.el('dateInput')
    vState.calendar = new Calendar('#dateInput')
    vState.calendar.onChooseDate = async function (e) {
      await lister.filterItemsInMainDivOrGetMore(vState, 'searchChange')
    }
    lister.setDivListeners(vState)
  
    const lists = ['messages', 'history', 'marks', 'tabs', 'settings']
    lists.forEach(list => { dg.el('click_gototab_' + list).onclick = clickers })
  
    vState.queryParams = lister.getUrlParams()
    // list, words, starFilters, notStarfilters, startDate, endDate
    if (vState.queryParams.words) vState.divs.searchBox.innerText = vState.queryParams.words
    // TODO Add all other filters here
    resetHeaders()
    document.body.style['overflow-x'] = 'hidden'
  
    await setUpDivsAndDrawItems(vState)
  })
}

const clickers = async function(evt) {
  const parts = evt.target.id.split('_')
  const list = vState.queryParams.list
  if (parts[1] === 'gototab') {
    if (list === parts[2]) return
    if (parts[2] === 'settings') {
      window.open('/main/settings.html', '_self')
    } else {
      lister.showHideCardsBasedOnFilters.hideAll(vState)
      vState.queryParams.list = parts[2]
      resetHeaders()
      setTimeout(async () => {
        await setUpDivsAndDrawItems(vState)
      }, 500)
    }
  }
}

const resetHeaders = function () {
  vState.divs.spinner.style.display = 'block'
  const list = vState.queryParams.list
  dg.el('viewInTabWindow').style['background-color'] = (list === 'messages' ? MCSS.PURPLE : (list === 'history' ? MCSS.YGREENBG : MCSS.GREEN))
  document.querySelector('.tmChosen').className = 'tmClosed'
  if (document.getElementById('click_gototab_' + list)) document.getElementById('click_gototab_' + list).className = 'tmChosen'
  window.history.pushState(null, '', 'view.html?view=' + list)
}

const setUpDivsAndDrawItems = async function (vState) {
  dg.el('dateFormOuter').style.display = (vState.queryParams.list === 'history') ? 'block' : 'none'
  dg.el('click_search_filters').style.display = (vState.queryParams.list === 'history') ? 'none' : 'block'
  // if (!vState.marks) vState.marks = lister.emptyStatsObj()
  // lister.resetDatesForList('marks')

  await lister.drawAllItemsForList(vState)
}

/* 
- todo -> add highlights to card
- do end of sync
*/

chrome.runtime.onMessage.addListener( // messageMark from background
  async function (request, sender, sendResponse) {
    if (request.msg === 'updateExtenionPage') {
      // update unfiltereditems
      if (request.action !== 'endofSync') {
        updateMarkOnVstateAndPage(request.updatedMark)
      } else {
        // get more recent of each and then update each card
        const retInfo = await vState.asyncLatestMarks()

        if (retInfo && retInfo.items && retInfo.items.length > 0) {
          retInfo.items.forEach(item => {
            updateMarkOnVstateAndPage(item, true)
          })
        }
      }
      sendResponse({ success: true })
    }
    if (request.msg === 'newpage') {
      const subPage = (request.props.purl !== pureUrlify(sender.tab.url) || request.props.isiframe)
      if (!subPage && vState.history && vState.history.unfilteredItems && vState.history.unfilteredItems.length > 0) { 
        vState.history.unfilteredItems.unshift(request.props)
        if (vState.queryParams.list === 'history') {
          const newCard = lister.drawlogItem(request.props, vState, { type: 'history' })
          newCard.style.width = '0'
          newCard.style.margin = '0'
          newCard.firstChild.style.transform = 'rotateY(90deg)'
          vState.divs.main.firstChild.insertBefore(newCard, vState.divs.main.firstChild.firstChild)
          
          lister.showHideCardsBasedOnFilters.history(vState, vState.loadState.totalShown, 'updateMarkOnVstateAndPage')
        }
      }
    }
    /*
    'mark_star', 'addStarFromMenuOrOverlay', 'saveMainComment'
    'checkForAddingMetaToIncompletes', 'DeleteFromcheckForAddingMetaToIncompletes', 'newHighlight', 'addHLightComment', 'saveHlightComment'
    'copyHighlights'
    'removeHighlight'
    'endofSync'
    also need to update overlays
    */
    
})
const updateMarkOnVstateAndPage = function (updatedMark, fromSync) {
  const storedItemIdx = vState.marks.unfilteredItems.findIndex(m => (m._id === updatedMark._id || (m.fj_local_temp_unique_id === updatedMark.fj_local_temp_unique_id && m.purl === updatedMark.purl)))
  // onsole.log('updateMarkOnVstateAndPage ', { updatedMark, storedItemIdx, fromSync })
  
  if (storedItemIdx > -1) {
    if (fromSync && !vState.marks.unfilteredItems[storedItemIdx]._id && updatedMark._id) {
      // Exception case of being uopdated from sync
      const unSyncedId = lister.idFromMark( { fj_local_temp_unique_id: updatedMark.fj_local_temp_unique_id} )
      const card = document.getElementById(unSyncedId)
      if (card) card.id = lister.idFromMark(updatedMark)
    }

    vState.marks.unfilteredItems[storedItemIdx] = updatedMark
  } else {
    vState.marks.unfilteredItems.unshift(updatedMark)
    const filteredIndex = vState.marks.filteredItems.findIndex(m => m._id === updatedMark._id)
    if (filteredIndex > -1) {
      // first remvoe card if being synced and is a filtered item
      const card = document.getElementById(lister.idFromMark( { fj_local_temp_unique_id: updatedMark.fj_local_temp_unique_id} ))
      if (card) card.remove()

      vState.marks.filteredItems.splice(filteredIndex, 1)
    }
  } 

  // update card
  const cardInner = document.getElementById(lister.idFromMark(updatedMark))
  if (!cardInner) {
    if (!updatedMark.fj_deleted){
      const newCard = lister.drawmarkItem(updatedMark, vState, { type: 'marks' })
      newCard.style.width = '0'
      newCard.style.margin = '0'
      newCard.firstChild.style.transform = 'rotateY(90deg)'
      vState.divs.main.firstChild.insertBefore(newCard, vState.divs.main.firstChild.firstChild)
      
      const list = vState.queryParams.list
      if (list === 'marks') lister.showHideCardsBasedOnFilters[list](vState, vState.loadState.totalShown, 'updateMarkOnVstateAndPage')
    } // else - snbh
  } else if (updatedMark.fj_deleted) {
    cardInner.parentElement.remove()
  } else {
    const starsOnCard = cardInner.querySelector('.starsOnCard')
    const stars = overlayUtils.drawstars(updatedMark, {
      drawTrash: true,
      trashFloatHide: true,
      markOnBackEnd: vState.markOnBackEnd
    })
    starsOnCard.innerHTML = ''
    starsOnCard.appendChild(stars)

    // summarySharingAndHighlights
    const summarySharingAndHighlights = cardInner.querySelector('.summarySharingAndHighlights')
    summarySharingAndHighlights.innerHTML = ''
    summarySharingAndHighlights.appendChild(lister.summarySharingAndHighlights(updatedMark))

    // markHighlights
    const hLightOptions = {
      type: 'markHighLights',
      purl: updatedMark.purl,
      markOnBackEnd: vState.markOnBackEnd,
      markOnMarks: updatedMark,
      hLightCommentSaver: vState.hLightCommentSaver,
      hLightDeleter: vState.hLightDeleter
    }
    if (updatedMark?.vHighlights && updatedMark.vHighlights.length > 0) {
      const hLightDiv = cardInner.querySelector('.markHighlights')
      hLightOptions.existingDiv = hLightDiv
      if (hLightDiv) lister.newDrawHighlights(updatedMark.purl, updatedMark.vHighlights, hLightOptions) //
    }

    // vulog_notes
    if (updatedMark.vNote) {
      const noteDiv = cardInner.querySelector('.vulog_notes')
      if (noteDiv) noteDiv.innerText = updatedMark.vNote
    }
  }
}
