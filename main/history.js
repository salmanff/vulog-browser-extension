// version 0.0.2 - march 2020

/* global chrome */ // from system
/* global toggleCollapse */ // from utils
/* global dg */ // from dgelements.js
/* global showWarning */ // from popup.js

const history = {
  CSS: {
    LIGHT_GREY: 'rgb(151, 156, 160)'
  },
  drawDetailHeader: function (alog) {
    alog.vulog_visit_details = alog.vulog_visit_details || []
    const reducerArray = [0, ...alog.vulog_visit_details]
    const timeSpent = reducerArray.reduce(function (total, obj) {
      const end = obj.end || obj.mid
      const newdiff = (end && !isNaN(end) && obj.start && !isNaN(obj.start)) ? (end - obj.start) : 0
      return total + newdiff
    })

    // const [ttlCookies, trackerNum] = countTrackers(alog) // from trackers.js
    const thediv = dg.div({
      style: {
        'margin-top': '5px',
        'margin-left': '3px',
        cursor: 'pointer',
        color: history.CSS.LIGHT_GREY
      },
      onclick: function (evt) {
        const blocktotoggle = this.nextSibling
        var isExpanded = toggleCollapse(blocktotoggle)
        const arrow = evt.target.className.includes('fa-chevron') ? evt.target : evt.target.firstChild
        arrow.className = isExpanded ? ('fa-chevron-down hist_details_expanded') : ('fa-chevron-right  hist_details_collapse')
      }
    },
    dg.span({
      className: 'fa-chevron-right hist_details_collapse',
      style: { color: (alog._id ? 'green' : 'cornflowerblue') }
    }),

    ((timeSpent ? ('Est. time: ' + this.timeSpentify(timeSpent) + (alog.vulog_max_scroll ? ' - ':' ')) : '') +
       (alog.vulog_max_scroll ? 'Scroll: ' + Math.round(100 * alog.vulog_max_scroll / alog.vuLog_height) + '% ' : '') +
       ((timeSpent || alog.vulog_max_scroll)? '' : 'Page details')
    )
    )
    return thediv
  },
  drawDetailsDiv: function (alog) {
    const detailsdiv = dg.div({
      style: {
        color: history.CSS.LIGHT_GREY,
        'font-size': '12px',
        'padding-left': '15px',
        height: '0px',
        overflow: 'hidden',
        transition: 'height 0.3s ease-out'
      }
    }, dg.div(dg.b('Full url: '), alog.url))
    if (alog.author) detailsdiv.appendChild(dg.div(dg.b('By: '), alog.author))
    if (alog.description) detailsdiv.appendChild(dg.div(dg.b('Summary: '), alog.description))
    if (alog.keywords && alog.keywords.length > 0) detailsdiv.appendChild(dg.div(dg.b('Key words: '), alog.description))
    const vtime = function (time) { return time ? new Date(time).toLocaleTimeString().split(' ')[0] : '...'}
    const wtime = function (time) {
      const mins = Math.round(time / 60000)
      return ((mins ? (mins + 'm ') : '') + Math.round((time % 60000) / 1000) + 's')
    }
    alog.vulog_visit_details.forEach(visit => detailsdiv.appendChild(dg.div(dg.b('Visited '), 'from ', vtime(visit.start), ' to ', vtime(visit.end || visit.mid), (visit.vid_start ? (' - Watched Video for ' + wtime((visit.end || visit.mid) - visit.vid_start)) : ''))))

    detailsdiv.appendChild(dg.div(
      dg.span({
        style: { color: 'cornflowerblue', 'margin-right': '10px', cursor: 'pointer' },
        onclick: function (e) {
          chrome.runtime.sendMessage({ msg: 'removeLocalItem', list: 'logs', item: alog }, function (response) {
            if (!response || !response.success) {
              showWarning('Error removing item - ' + (response ? response.error : ''))
            } else {
              toggleCollapse(e.target.parentElement.parentElement)
              setTimeout(function () { e.target.parentElement.parentElement.parentElement.style.display = 'none' }, 280)
              if (response.otherSimilar && response.otherSimilar.length > 0) {
                showWarning('Item was deleted. But note that there are ' + response.otherSimilar.length + ' other items with the same url still remaining', 5000)
              }
            }
          })
        }
      },
      (alog.vulog_visit_details.length > 0 ? 'Remove from history logs ' : ''))
    ))
    return detailsdiv
  },
  timeSpentify: function (aTime) {
    //
    return (Math.floor(aTime / 60000) > 0 ? (Math.floor(aTime / 60000) + 'mins ') : '') + (Math.round((aTime % 60000) / 1000, 0)) + 's'
  }
}
