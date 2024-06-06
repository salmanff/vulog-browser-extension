// redirect.js - for vuLog_popup

/* global fetch, chrome */

const vulogRedirect = {
  query: window.location.search,
  host: window.location.protocol + '//' + window.location.host
}
 
if (vulogRedirect.query) {
  vulogRedirect.query = vulogRedirect.query.slice(1).split('&')
  var queries = {}
  vulogRedirect.query.forEach(aquery => { queries[aquery.split('=')[0]] = aquery.split('=')[1] })
  if (queries.vulogredirect) {
    if (!queries.vulogid) {
      //  HOST + /ppage/ USER /com.salmanff.vulog.marks/ ID
      const parts = window.location.pathname.split('/')
      if (parts[1] === 'ppage') {
        queries.userId = parts[2]
        // const idParts = parts
        queries.vulogid = parts.slice(3).join('/')
      } else {
        queries.userId = parts[1]
        // const idParts = parts
        queries.vulogid = parts.slice(2).join('/')
      }
    } 
    const redirectUrl = vulogRedirect.host + '/v1/pobject/' + queries.userId + '/' + queries.vulogid
    fetch(redirectUrl)
      .then((response) => { 
        return response.json() 
      })
      .then((data) => {
        if (data && data.results && data.results['info.freezr.public'] === 'No records found.') {
          console.warn('No records found.', { data })
        } else {
          const redirectmark = data.results
          if (redirectmark) {
            redirectmark.original_id = redirectmark._id
            delete redirectmark._id
            redirectmark.host = vulogRedirect.host

            chrome.runtime.sendMessage({
              msg: 'showThisFromOverlay',
              showThis: 'redirectmark',
              purl: redirectmark.purl,
              redirectmark
            }, function (response) {
              if (!response || response.error) {
                console.warn('err ' + (response ? response.error : null))
              } else {
                window.location.href = redirectmark.url
              }
            })
          } else {
            console.warn('No redirectmark ?', data.results)
          }
        }
      })
  }
}
