
// version 0.0.2 - march 2020

/* global chrome, screen */ // from system
/* global toggleCollapse */ // from utils
/* global dg */ // from dgelements.js
/* global showWarning */ // from popup.js
/* global freezrMeta */ // from freezr_app_init.js

let markSearchState
const MARK_SEARCH_STATE_INIT = {
  itemsFetched: 0,
  lastWordsSearched: '',
  moreItems: 20,
  allresults: [],
  star_filters: []
}
const MCSS = {
  LIGHT_GREY: 'rgb(151, 156, 160)',
  DARK_GREY: 'darkgrey',
  RED: 'indianred'
}
const MAIN_STARS = ['star', 'inbox', 'archive']
const XTRA_STARS = ['tags', 'sticky-note', 'quote-left', 'quote-right']

dg.addAttributeException('db_id')
dg.addAttributeException('fj_id')
dg.addAttributeException('purl')

const endsWith = function (longertext, checktext) {
  if (!longertext || !checktext || !(typeof longertext === 'string') || !(typeof checktext === 'string')) { return false } else
  if (checktext.length > longertext.length) { return false } else {
    return (checktext === longertext.slice(longertext.length - checktext.length))
  }
}

var marks = {
  mainDivId : 'vulog_marks_records', // default
  viewMode: (endsWith(window.location.pathname, 'markInTab.html') ? 'markInTab' : 'popup'),
  current: {},
  init_state: function (divId) {
    // onsole.log("INIT STATE")
    if (divId) marks.maindivId = divId
    dg.el(marks.mainDivId, { clear: true })
    markSearchState = JSON.parse(JSON.stringify(MARK_SEARCH_STATE_INIT))
  },
  clearSearch: function (params, divId) {
    this.init_state(divId)
    MAIN_STARS.forEach(
      function (aStar) { if (dg.el('click_filterStar_' + aStar + '_0')) dg.el('click_filterStar_' + aStar + '_0').className = 'fa fa-' + aStar + ' stars ' + (aStar === 'archive' ? 'ex' : 'un') + 'chosen-star' }
    )
    if (dg.el('idSearchMarksBox') ) dg.el('idSearchMarksBox').textContent = ''
    this.doSearch(params)
  },
  doSearch: function (queryParams, options) {
    options = options || {}
    if (!queryParams) {
      const searchTerms = this.removeSpacesEtc(dg.el('idSearchMarksBox').textContent).toLowerCase()
      if (!markSearchState.lastWordsSearched || markSearchState.lastWordsSearched !== searchTerms || options.reinit) this.init_state()
      markSearchState.lastWordsSearched = searchTerms
      markSearchState.star_filters = this.alwaysOnFilters || []
      MAIN_STARS.forEach(aStar => { if (dg.el('click_filterStar_' + aStar + '_0') && dg.el('click_filterStar_' + aStar + '_0').className.includes(' chosen-star')) markSearchState.star_filters.push(aStar) })
      markSearchState.exstar_filters = []
      MAIN_STARS.forEach(aStar => { if (dg.el('click_filterStar_' + aStar + '_0') && dg.el('click_filterStar_' + aStar + '_0').className.includes('exchosen-star')) markSearchState.exstar_filters.push(aStar) })

      queryParams = {
        words: ((searchTerms && searchTerms.length > 0) ? searchTerms.split(' ') : []),
        star_filters: markSearchState.star_filters,
        exstar_filters: markSearchState.exstar_filters,
        skip: markSearchState.itemsFetched,
        count: markSearchState.moreItems
      }
    }
    console.log({queryParams})
    chrome.runtime.sendMessage({ msg: 'searchLocally', list: 'marks', queryParams: queryParams }, function (response) {
      // onsole.log('search repsonse ',response)
      if (!response || !response.success) {
        showWarning('Error trying to do backgroundLocalSearch')
      } else if (response.results.length > 0 || markSearchState.allresults.length === 0) {
        // {success:true, results:results, nomore: current_item==0}
        markSearchState.allresults.push(response.results)
        markSearchState.nomore = response.nomore
        markSearchState.itemsFetched += response.results.length
        dg.el(marks.mainDivId, { clear: true, top: true }).appendChild(marks.drawItems(response.results, markSearchState.allresults.length, markSearchState.nomore))
      }
    })
  },

  // draw marks
  drawItems: function (results, page, nomore) {
    const resultsdiv = dg.div(
      { style: { 'margin-bottom': '20px', 'padding-left': '5px' } }
    )
    if (results && results.length > 0) {
      results.forEach(alog => {
        resultsdiv.appendChild(this.drawItem(alog))
      })
    }

    return resultsdiv
  },
  drawItem: function (alog) {
    const that = this
    const itemdiv = dg.div({ style: { 'margin-top': '10px' } })

    itemdiv.appendChild(dg.span(
      dg.span( // favicon
        dg.img({
          style: {
            'vertical-align': 'middle',
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
      (alog.title ? (alog.domain_app + ' - ' + alog.title) : alog.url)
      )
    ))

    // Stars / top header
    const toptag = dg.div(
      { style: { 'margin-left': '30px' } },
      dg.span({
        className: 'fa-chevron-right hist_details_collapse',
        style: { cursor: 'pointer', color: (alog._id ? 'green' : 'cornflowerblue'), 'padding-right': '10px' },
        onclick: function (evt) {
          const blocktotoggle = this.parentElement.nextSibling
          var isExpanded = toggleCollapse(blocktotoggle)
          const arrow = evt.target.className.includes('fa-chevron') ? evt.target : evt.target.firstChild
          arrow.className = isExpanded ? ('fa-chevron-down hist_details_expanded') : ('fa-chevron-right  hist_details_collapse')
        }
      })
    )
    const topstars = [...XTRA_STARS, ...MAIN_STARS]
    let chosenstars = (alog.vulog_highlights && alog.vulog_highlights.length > 0) ? ['quote-left', 'quote-right'] : []
    chosenstars = alog.vulog_mark_stars ? [...chosenstars, ...alog.vulog_mark_stars] : chosenstars
    if (alog.vulog_mark_tags && alog.vulog_mark_tags.length > 0) chosenstars.push('tags')
    if (alog.vulog_mark_notes && alog.vulog_mark_notes.length > 0) chosenstars.push('sticky-note')
    topstars.forEach(aStar => {
      let chosen = (chosenstars.includes(aStar)) ? 'chosen' : 'unchosen'
      const changable = MAIN_STARS.includes(aStar)
      toptag.appendChild(dg.span({
        className: 'fa fa-' + aStar + ' littlestars ' + chosen + '-star',
        style: { cursor: (changable ? 'pointer' : 'cursor') },
        dgdata: changable,
        purl: ((changable) ? alog.purl : null),
        db_id: ((changable && alog.id) ? alog.id : null),
        fj_id: ((changable && alog.fj_local_temp_unique_id) ? alog.fj_local_temp_unique_id : null),
        onclick: function (e) {
          if (aStar === 'bullhorn' && (chosen === 'unchosen')) {
            showWarning('You can only publish an item from the "Current" page.' + (aStar._id ? '' : '.. and you have to be logged into your Personal Data Store.'))
          } else if (changable) {
            chrome.runtime.sendMessage({
              msg: 'mark_star',
              purl: this.getAttribute('purl'),
              id: (this.getAttribute('db_id') || this.getAttribute('fj_id')),
              theStar: aStar,
              doAdd: (chosen === 'unchosen'),
              publishChange: false
            }, function (response) {
              if (!response || response.error) {
                showWarning((response ? response.error : 'Error changing mark.'))
              } else {
                chosen = ((chosen === 'unchosen') ? 'chosen' : 'unchosen')
                e.target.className = 'fa fa-' + aStar + ' littlestars ' + (chosen) + '-star'
              }
            })
          }
        }
      }))
      if (aStar !== 'quote-left') toptag.appendChild(dg.span({ style: { 'margin-left': '10px' } }, ' '))
    })

    itemdiv.appendChild(toptag)
    const detailsdiv = dg.div({
      style: {
        'padding-left': '45px',
        height: '0px',
        overflow: 'hidden',
        transition: 'height 0.3s ease-out',
        width: '500px'
      }
    },
    dg.div({ style: { 'margin-top': '3px', color: 'darkgray' } },
      dg.a({ href: alog.purl, target: '_blank', style: { height: '16px', overflow: 'hidden', 'text-overflow': 'ellipsis' } }, 'url:' + alog.purl),
      dg.div('Created: ' + (new Date(alog.vulog_timestamp).toLocaleDateString() + ' ' + new Date(alog.vulog_timestamp).toLocaleTimeString() + ' (Modified: ' + (new Date(alog._date_modified || alog.fj_modified_locally).toLocaleDateString()) + ')')),
      dg.a({ href: alog.referrer, target: '_blank', style: { height: '16px', overflow: 'hidden', 'text-overflow': 'ellipsis', display: (alog.referrer ? 'block' : 'none') } },
        'referrer:' + alog.referrer)
    ))

    if (alog.description) {
      detailsdiv.appendChild(dg.div({ style: { 'margin-bottom': '3px', color: 'darkgray' } },
        alog.description
      ))
    }
    if (alog.vulog_mark_tags && alog.vulog_mark_tags.length > 0) {
      detailsdiv.appendChild(
        dg.div({ style: { color: MCSS.DARK_GREY } },
          'Tags: ',
          dg.span({ style: { color: MCSS.red, 'font-weight': 'bold' } }, (alog.vulog_mark_tags.join(', '))),
          '.'
        )
      )
    }
    if (alog.vulog_mark_notes) {
      detailsdiv.appendChild(dg.div(
        { style: { color: MCSS.DARK_GREY, 'margin-bottom': '3px' } },
        'Notes: ',
        dg.span(
          { style: { color: MCSS.red, 'font-weight': 'bold' } },
          alog.vulog_mark_notes)
      ))
    }
    if (alog.vulog_highlights && alog.vulog_highlights.length > 0) {
      alog.vulog_highlights.forEach((item, i) => detailsdiv.appendChild(marks.drawHighlight(item, { include_delete: false, show_display_errs: false })))
    }
    itemdiv.appendChild(detailsdiv)
    return itemdiv
  },
  toggleFilterStar: function (theStar) {
    var starDiv = dg.el('click_filterStar_' + theStar + '_0')
    if (!theStar || !starDiv) {
      console.warn('Error - no stars')
      showWarning('internal error - no stars', theStar)
    } else {
      var stati = ['un', '', 'ex']
      var starstatus = starDiv.className.indexOf('unchosen') >= 0 ? 'un' : (starDiv.className.indexOf('exchosen') >= 0 ? 'ex' : '')
      var newstatus = stati[((stati.indexOf(starstatus) + 1) % 3)]
      starDiv.className = 'fa fa-' + theStar + ' stars ' + newstatus + 'chosen-star'
      this.init_state()
      marks.doSearch()
    }
  },

  // draw highlights
  drawHighlight: function (item, options) {
    let deleter = dg.div({})
    let displayErr = dg.div({})
    if (options.include_delete) {
      deleter = dg.div({
        className: 'del_quote',
        onclick: function (e) {
          const hlightDate = this.getAttribute('highlight-date')
          chrome.runtime.sendMessage({ msg: 'deleteHighlight', purl: marks.current.purl, h_date: hlightDate }, function (response) {
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
      deleter.setAttribute('highlight-date', item.h_date)
    }
    if (options.show_display_errs && item.displayErr) {
      displayErr = dg.div({ className: 'quote_display_err' },
        'This quote was not found and so it is not highlighted on the page')
    }
    return dg.div({ className: 'quote_outer' },
      dg.span({ className: 'quote_left' }),
      dg.span({
          className: 'quote_close',
          onclick: function(e) {
             dg.toggleShow(e.target.nextSibling.nextSibling.nextSibling)
          }
      }),
      dg.span({ className: 'quote_inner' },
        dg.span(item.string),
        displayErr),
      dg.span({ className: 'quote_right' }),
      deleter
    )
  },

  // utilities
  removeSpacesEtc: function (aText) {
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
  },
  timeSpentify: function (aTime) {
    //
    return (Math.floor(aTime / 60000) > 0 ? (Math.floor(aTime / 60000) + 'mins') : '') + (Math.round((aTime % 60000) / 1000, 0)) + 's'
  },
  getdomain: function (aUrl) {
    if (!aUrl) return 'Missing aUrl'
    var start = aUrl.indexOf('//') + 2
    var stop = aUrl.slice(start).indexOf('/')
    return aUrl.slice(0, stop + start)
  }
}
