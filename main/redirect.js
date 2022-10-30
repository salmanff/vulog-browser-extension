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
      let parts = window.location.pathname.split('/')
      parts = parts.slice(2)
      queries.vulogid = parts.join('/')
    }
    fetch(vulogRedirect.host + '/v1/pobject/' + queries.vulogid)
      .then((response) => { return response.json() })
      .then((data) => {
        if (data && data.results && data.results['info.freezr.public'] === 'No records found.') {
          // console.log('No records found.')
        } else {
          var item = data.results
          item.original_id = item._id
          delete item._id
          item.host = vulogRedirect.host

          chrome.runtime.sendMessage({
            msg: 'redirect',
            item: item
          }, function (response) {
            if (!response || response.error) {
              console.warn('err ' + (response ? response.error : null))
            } else {
              window.location.href = item.url
            }
          })
        }
      })
  }
}
