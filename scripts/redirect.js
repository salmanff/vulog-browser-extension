
let vulog_redirect = {
  query: window.location.search,
  host:  window.location.protocol+"//"+window.location.host,
}

if (vulog_redirect.query) {
  vulog_redirect.query = vulog_redirect.query.slice(1).split('&')
  let queries={}
  vulog_redirect.query.forEach(aquery => queries[aquery.split('=')[0]] = aquery.split('=')[1])
  //onsole.log({vulog_redirect, queries})
  if (queries.vulogredirect) {
    if (!queries.vulogid) {
      //  HOST + /ppage/ USER /com.salmanff.vulog.marks/ ID
      let parts = window.location.pathname.split('/')
      parts = parts.slice(2)
      queries.vulogid = parts.join('/')
      //onsole.log("queries.vulogid ",queries.vulogid)
    }
    //onsole.log("new queries",JSON.stringify(queries))
    fetch(vulog_redirect.host+'/v1/pobject/'+queries.vulogid)
      .then((response) => {return response.json();})
      .then((data) => {
        if (data && data.results && data.results['info.freezr.public'] == 'No records found.') {
          console.log('No records found.')
        } else {
          item = data.results;
          item.original_id = item._id;
          delete item._id;
          item.host = vulog_redirect.host;

          chrome.runtime.sendMessage({
              msg: "redirect",
              item: item
            }, function(response) {
              if (!response || response.error) console.warn("err"+(response? response.error: null))
              else window.location.href = item.url
          })
        }
      });
  }
}
