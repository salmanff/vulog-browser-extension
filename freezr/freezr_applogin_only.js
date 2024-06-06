// freezr_applogin_only => parts offreezrneeded for app login

// updated 2022
/*
  This file is used for stand alone apps that do not run on the freezr server.
*/

const freezr = {
  app: {
    isWebBased: false
  },
  utils: {
    applogin: function (authUrl, appName, cb) {
      const [hasHttp, hasLoginParams, server, userName, authPassword] = freezerRestricted.menu.parse_pds_name(authUrl)
      if (!hasLoginParams || !hasHttp || !userName || userName.length === 0 || !authPassword || authPassword.length === 0 || !server || server.length === 0) {
        cb(new Error('You have enterred an invalid url.'))
      } else {
        if (server.slice(server.length - 1) === '/') server = server.slice(0, server.length - 1)
        const freezrMeta = {
          userId: userName,
          serverAddress: server
        }
        freezr.utils.ping({ freezrMeta }, function (error, resp) {
          if (!resp || error) {
            cb(new Error('Your PDS is unavailable, or the URL is badly configured. Please try later, or correct the url.'))
            console.warn(error)
          } else {
            var theInfo = { username: userName, password: authPassword, client_id: appName, grant_type: 'password' }
            freezerRestricted.connect.ask('/oauth/token', theInfo, function (error, resp) {
              resp = freezr.utils.parse(resp)
              if (error || (resp && resp.error)) {
                console.warn(error || resp.error)
                cb(error || resp.error)
              } else if (!resp.access_token) {
                cb(new Error ( 'Error logging you in. The server gave an invalid response.' ) )
              } else if (resp.app_name !== appName) {
                cb(new Error ( 'Error - loggedin_app_name ' + resp.login_for_app_name + ' is not correct.' ) )
              } else {
                freezrMeta.appToken = resp.access_token
                freezr.serverVersion = resp.freezr_server_version
                freezr.app.offlineCredentialsExpired = false
                cb(null, freezrMeta)
              }
            }, null, { freezrMeta })
          }
        }, freezrMeta.appName)
      }
    },
    ping: function (options, callback) {
      // pings freezr to get back logged in data
      // options can be password and appName (Not functional)
      var url = '/ceps/ping'
      freezerRestricted.connect.read(url, options, function (error, resp) {
        if (error || !resp || resp.error) {
          callback(error || new Error((resp && resp.error) ? resp.error : 'unkown error'))
        } else if (!resp.server_type) {
          callback(new Error('No server type'))
        } else {
          callback(null, resp)
        }
      }, options)
    },
    parse: function (dataString) {
      if (typeof dataString === 'string') {
        try {
          dataString = JSON.parse(dataString)
        } catch (err) {
          dataString = { data: dataString }
        }
      }
      return dataString
    },
    startsWith: function (longertext, checktext) {
      if (!checktext || !longertext) { return false } else
      if (checktext.length > longertext.length) { return false } else {
        return (checktext === longertext.slice(0, checktext.length))
      }
    }
  }
}

const freezerRestricted = {
  menu: {
    parse_pds_name: function (fullText) {
      let hasLoginParams = false
      let server = ''
      let userName = ''
      let authPassword = ''
      fullText = fullText || ''
      const hasHttp = fullText.indexOf('http') === 0 && (fullText.indexOf('.') > 8 || fullText.indexOf('localhost:') > 6)
      const serverparts = fullText.split('?')
      server = serverparts[0]
      // let haspath = server.slice(8).indexOf('/')>0
      // let path = haspath? server.slice((9+server.slice(8).indexOf('/'))):''
      // server = haspath? server.slice(0,(8+server.slice(8).indexOf('/'))):server
      const queries = (serverparts.length > 1) ? serverparts[1].split('&') : null
      if (queries && queries.length > 0) {
        queries.forEach(query => {
          if (query.split('=')[0] === 'user') userName = query.split('=')[1]
          if (query.split('=')[0] === 'password') authPassword = query.split('=')[1]
        })
      }
      hasLoginParams = (hasHttp && server && userName && authPassword) || false
      // onsole.log({hasHttp, hasLoginParams, server, userName, authPassword})
      return [hasHttp, hasLoginParams, server, userName, authPassword]
    }
  },
  connect: {
    ask: function (url, data, callback, type, options) {
      var postData = null
      let contentType = ''
    
      if (!type || type === 'jsonString') {
        postData = data ? JSON.stringify(data) : '{}'
        contentType = 'application/json' // 'application/x-www-form-urlencoded' //
      } else {
        postData = data
      }
      // todo - add posting pictures (???)
    
      freezerRestricted.connect.send(url, postData, callback, 'POST', contentType, options)
    },
    read: function (url, data, callback, options) {
      // options - textResponse (response is text)
      if (data) {
        var query = []
        for (var key in data) {
          query.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]))
        }
        url = url + '?' + query.join('&')
      }
      freezerRestricted.connect.send(url, null, callback, 'GET', null, options)
    },
    send: function (url, postData, callback, method, contentType, options = {}) {
      const { freezrMeta } = options
      let req = null
      let badBrowser = false
      if (!callback) callback = freezr.utils.testCallBack
      try {
        req = new XMLHttpRequest()
      } catch (e) {
        badBrowser = true
      }
    
      const coreUrl = url ? url.split('?')[0] : ''
      const PATHS_WO_TOKEN = ['/oauth/token', '/ceps/ping', '/v1/account/login', '/v1/admin/self_register', '/v1/admin/oauth/public/get_new_state', '/v1/admin/oauth/public/validate_state']
      if (badBrowser) {
        callback(new Error('You are using a non-standard browser. Please upgrade.'))
      } else if (PATHS_WO_TOKEN.indexOf(coreUrl) < 0) {
        callback(new Error('Need to obtain an app token before sending data to ' + url))
      } else {
        if (!freezr.utils.startsWith(url, 'http') && !freezr.app.isWebBased && freezrMeta.serverAddress) { url = freezrMeta.serverAddress + url }
        req.open(method, url, true)
        if (!freezr.app.isWebBased && freezrMeta.serverAddress) {
          req.withCredentials = true
          req.crossDomain = true
        }
        req.onreadystatechange = function () {
          if (req && req.readyState === 4) {
            var jsonResponse = req.responseText
            if ((!options || !options.textResponse) && jsonResponse) jsonResponse = freezr.utils.parse(jsonResponse)
            if (this.status === 200 && jsonResponse && !jsonResponse.error) {
              callback(null, jsonResponse)
            } else if (jsonResponse && jsonResponse.error) {
              console.warn(jsonResponse)
              const error = new Error(jsonResponse.error)
              if (jsonResponse.message) error.message = jsonResponse.message
              callback(error)
            } else {
              const error = new Error('Connection error ')
              error.status = this.status
              if (this.status === 0) error.code = 'noComms'
              if (this.status === 400) error.code = 'noServer'
              if (!error.code) error.code = 'unknownErr'
              if (this.status === 401 && !freezr.app.isWebBased) { freezr.app.offlineCredentialsExpired = true }
              callback(error)
            }
          }
        }
        if (contentType) req.setRequestHeader('Content-type', contentType)
        const accessToken = options.appToken || (freezr.app.isWebBased ? freezr.utils.getCookie('app_token_' + freezrMeta.userId) : freezrMeta.appToken)
        req.setRequestHeader('Authorization', 'Bearer ' + accessToken)
        req.send(postData)
      }
    }
  }
}

