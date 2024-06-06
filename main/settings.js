
/* global chrome */
/* global toggleCollapse */ // from utils
/* global dg */ // from dgelements.js
/* global marks, currentLog */ // from popup.js
/* global freezrMeta, freezr  */ // from freezr_app_init
/* global showWarning, addSharingOnCurrent, drawCurrentTabForPopUp  */ // from popup.js
/* global randomText */ // from utils.js

const vState = {}  

const drawHashtagSection = function (vulogDetails) {
  const hashTagInput = dg.div(
    { className: 'vulog_overlay_input vulog_notes', style: { 'max-width': '330px' }},
    (vulogDetails.defaultHashTag || ''))
  hashTagInput.setAttribute('placeholder', 'Enter hastag (without the #)')
  hashTagInput.setAttribute('contenteditable', true)
  hashTagInput.onkeyup = async function (e) {
    const response = await chrome.runtime.sendMessage({ msg: 'setDefaultHashtag', defaultHashTag: hashTagInput.innerText.trim() })
    if (!response || !response.success) {
      let noteErr = e.target.nextSibling
      if (!noteErr) e.target.parentElement.appendChild(dg.div({ className: 'noteErrBox', style: { 'margin-right': '25px'}}, dg.div('Error trying to save hashtag.')))
    }
  }
  return dg.div(
    dg.div(dg.span({ style: { 'font-weight': 'bold' } },'Default Hashtag '), 'A word you enter here will by default be added as a note to any new bookmark you make. Use this to tag (with a #) topics you are digging into so you can search for them all using the hashtag.'),
    dg.br(),
    hashTagInput,
    dg.br()
  )
}
const drawVulogLogOutSection = function (vulogDetails) {
  if (!vulogDetails.freezrMeta?.userId) {
    return dg.span()
  } else { return dg.div(
      // dg.div('You ae logged in as ' + vulogDetails.freezrMeta.userId + ' on your personal server at ' + vulogDetails.freezrMeta.serverAddress),
      dg.div({
        className: 'cepsbutton',
        style: { margin: '5px 120px 5px 80px', color: 'Indianred' },
        onclick: async function (e) {
          const section = e.target.parentElement.parentElement
          freezr.utils.logout(async function (resp) {
            if (resp && resp.error) {
              section.appendChild(dg.div({ className: 'noteErrBox', style: { 'margin-right': '25px'}}, dg.div('Error logging you out.')))
            } else {
              vulogDetails.current_mark = null
              freezrMeta.reset()
              const response = await chrome.runtime.sendMessage({ msg: 'logged_out' })
              if (!response || !response.success) {
                section.appendChild(dg.div({ className: 'noteErrBox', style: { 'margin-right': '25px'}}, dg.div('Error trying to save logout information.')))
              } else {
                section.innerHTML = 'You have been logged out, but your unsynced history has been kept locally. Refresh this page to delete all your data.'
              }
            }
          })
          const response = await chrome.runtime.sendMessage({ msg: 'logged_out' })
          if (response.success) {
            section.innerHTML = ''
            section.appendChild(dg.div({ className: 'noteErrBox', style: { 'margin-right': '25px'}}, dg.div('You have been logged out.')))
          } else {
            const respDiv = dg.div({ className: 'noteErrBox', style: { 'margin-right': '25px'}}, dg.div('Error logging you out Close this and trya again.'))
            section.appendChild(respDiv)            }
        }
      }, 'Log Out')
    )
  }
}
const drawVulogPauseSection = function (vulogDetails) {
  return dg.div(
    dg.div((!vulogDetails.recordHistory ?
      'hiper.cards can save all your browsing history for easier search.' :
      'Your browser history is being saved.')),
    dg.br(),
    dg.div({
      className: 'cepsbutton',
      style: { margin: '5px 120px 5px 80px', color: 'Indianred' },
      onclick: async function (e) {
        const msg = !vulogDetails.recordHistory ? 'unpause' : 'pause'
        const response = await chrome.runtime.sendMessage({ msg })
        if (response.success) {
          vulogDetails.recordHistory = !vulogDetails.recordHistory
          const section = e.target.parentElement
          section.innerHTML = ''
          section.appendChild(drawVulogPauseSection(vulogDetails))
        } else {
          const respDiv = dg.div({ className: 'noteErrBox', style: { 'margin-right': '25px'}}, dg.div('Error puasing or unpausing.'))
          section.appendChild(respDiv)
        }
      }
    }, (!vulogDetails.recordHistory ?
      'Start logging your browsing history.' :
      'STOP logging your browsing history'))
  )
}
const drawVulogRemoveDataSection = function (vulogDetails) {
  return dg.div(
    dg.div('Worried about the data that hiper.cards has access to on this browser? Delete it all!! ... or just delete your browsing history (and keep your bookmarks)'),
    dg.div({
      className: 'cepsbutton',
      style: { margin: '5px 5px 5px 40px', padding: '2px 10px 2px 10px', color: 'Indianred', display: 'inline-block' },
      onclick: async function (e) {
        const response = await chrome.runtime.sendMessage({ msg: 'removeLocalData' })
        const section = e.target.parentElement
        if (response.success) {
          section.innerHTML = ''
          section.appendChild(drawVulogRemoveDataSection(vulogDetails))
          const respDiv = dg.div({ className: 'noteErrBox', style: { 'margin-right': '25px'}}, dg.div('Local Data removed'))
          section.appendChild(respDiv)
          setTimeout(() => { respDiv.style.display = 'none' }, 3000)
        } else {
          const respDiv = dg.div({ className: 'noteErrBox', style: { 'margin-right': '25px'}}, dg.div('Error removing local data. Close and try later.'))
          section.appendChild(respDiv)
        }
      }
    }, 'Delete all local data'),
    dg.div({
      className: 'cepsbutton',
      style: { margin: '5px 40px 5px 5px', padding: '2px 10px 2px 10px', color: 'Indianred', display: 'inline-block' },
      onclick: async function (e) {
        const response = await chrome.runtime.sendMessage({ msg: 'removeHistoryOnly' })
        const section = e.target.parentElement
        if (response.success) {
          section.innerHTML = ''
          section.appendChild(drawVulogRemoveDataSection(vulogDetails))
          const respDiv = dg.div({ className: 'noteErrBox', style: { 'margin-right': '20px'}}, dg.div('Local History removed'))
          section.appendChild(respDiv)
          setTimeout(() => { respDiv.style.display = 'none' }, 5000)
        } else {
          const respDiv = dg.div({ className: 'noteErrBox', style: { 'margin-right': '25px'}}, dg.div('Error removing local data. Close and try later.'))
          section.appendChild(respDiv)
        }
      }
    }, 'Delete saved history')
  )
}
const drawCepsLoginForm = function ( offlineCredentialsExpired = false) {
  const cepsLoginForm = dg.div(
    { id: 'cepsloginform' },
    'Please enter the authorization url of your CEPS-compatible Personal Server')
  const loginOuter = dg.div()
  loginOuter.appendChild(cepsLoginForm)
  loginOuter.appendChild(dg.img({
    id: 'loginLoader',
    src: '/freezr/static/ajaxloaderBig.gif',
    style: { display: 'none' }
  }))

  const loadLoader = function (show) {
    dg.el('cepsloginform').style.display = (show ? 'none' : 'block')
    dg.el('loginLoader').style.display = (show ? 'block' : 'none')
  }

  const showWarning = function (text) {
    loginOuter.style.color = 'red'
    loginOuter.innerText = text
  }

  const tryLoggingIn = function () {
    const loginUrl = dg.el('cepsloginAuthUrl').textContent
    if (!freezrMeta.appName) freezrMeta.appName = 'com.salmanff.vulog'
    const parts = loginUrl.split('?')
    const params = parts.length > 1 ? new URLSearchParams(loginUrl.split('?')[1]) : null
    if (parts.length > 1 &&
      (!offlineCredentialsExpired ||
        (params.get('user') === freezrMeta.userId &&
        loginUrl.indexOf(freezrMeta.serverAddress) === 0)
      )) {
      loadLoader(true)
      freezr.utils.applogin(loginUrl, function (err, jsonResp) {
        if (err || jsonResp.error) {
          loadLoader(false)
          showWarning('Could not log you in - ' + (err || jsonResp.error), 3000)
        } else if (!jsonResp.appToken) {
          loadLoader(false)
          showWarning('Please install vulog on your personal server and log in again.')
        } else {
          const newFreezrMeta = {
            userId: jsonResp.userId,
            appToken: jsonResp.appToken,
            serverAddress: jsonResp.serverAddress,
            serverVersion: freezr.serverVersion
          }
          chrome.runtime.sendMessage({ msg: 'loggedin', freezrMeta: newFreezrMeta }, function (response) {
            loadLoader(false)
            if (response && response.success) {
              freezrMeta.set(newFreezrMeta)
              showWarning(offlineCredentialsExpired ? 'Successfully re-authorised! ' : 'Login Successful!! Your browser history and bookmarks can now be saved on your server.')
            } else {
              showWarning('Note : Logged in but failed to register credentials')
            }
          })
        }
      })
    } else if (!loginUrl) {
      dg.el('loginWarning').innerText = 'Please enter a url'
    } else if (parts.length < 2) {
      dg.el('loginWarning').innerText = 'Please obtain a valid authentication url from your CEPS server and paste it in the text box.'
    } else {
      dg.el('loginWarning').innerText = 'The URL you enterred does not match your current login info. If you want to change users or servers, please log off in the Setting tab.'
    }
  }

  cepsLoginForm.appendChild(dg.div({
    className: 'inputBox',
    style: { width: '95%' },
    id: 'cepsloginAuthUrl',
    onkeydown: function (evt) {
      evt.target.style.overflow = 'scroll'
      if (evt.keyCode === 13 || evt.keyCode === 9) {
        evt.preventDefault()
        tryLoggingIn()
      }
    }
  }))

  cepsLoginForm.appendChild(dg.div({
    style: { color: 'red' },
    id: 'loginWarning'
  }))

  cepsLoginForm.appendChild(dg.div({
    className: 'cepsbutton',
    style: { margin: '10px 130px 10px 130px' },
    onclick: tryLoggingIn
  }, (offlineCredentialsExpired ? 'Refresh credentials' : 'Login')))
  cepsLoginForm.appendChild(dg.div({}, dg.span(' If you are connected to a CEPS-compatible server, you will be able to share your bookmarks and highlight, either publicly, or by messaging them privately to your friends. For more info on CEPS, see '), dg.a({ href: 'https://www.salmanff.com/2020-3-15-Why-CEPS-Matters' }, 'this post.'), dg.span(' And to find out more about freezr servers, go to '), dg.a({ href: 'https://freeezr.info' }, ' freezr.info.')))
  
  return loginOuter


}

chrome.runtime.sendMessage({ msg: 'getVulogState' }, async function (vulogInfo) {
  if (vulogInfo && !vulogInfo.error) {
    // purl, currentLog, currentMark, contacts, edit_mode, cookieRemovalHasBeenCalled
    
    vState.friends = vulogInfo?.vState?.contacts //  vState.freezrMeta?.perms?.friends?.granted ? await freepr.feps.postquery({ app_table: 'dev.ceps.contacts', permission_name: 'friends' }) : []

    vState.feedcodes = vulogInfo?.vState?.feedcodes?.map(obj => ({ ...obj, type: 'privateFeed' }))
    vState.groups = vulogInfo?.vState?.groups?.map(obj => ({ ...obj, type: 'group' }))
  
    freezrMeta.set(vulogInfo?.vState?.freezrMeta)
    vState.freezrMeta = freezrMeta
    vState.offlineCredentialsExpired = !Boolean(freezrMeta.appToken) || vulogInfo?.vState?.offlineCredentialsExpired
    vState.isLoggedIn = Boolean(freezrMeta.appToken)
    
    vState.recordHistory = vulogInfo?.vState?.recordHistory
    vState.defaultHashTag = vulogInfo?.vState?.defaultHashTag

    const main = dg.el('vulogSettings')

    main.appendChild(dg.div({ style: { 'font-size': 'large', color: 'white' }}, 'Settings'))
  
  const settingsBox = (...els) => {
    return dg.div({ style: { 
      'align-items': 'center',
      display: 'flex',
      'justify-content': 'center' 
    }},
      dg.div({ style: {
      'max-width': '500px',
      'width': '500px',
      'background-color': 'white',
      'border-radius': '5px',
      padding: '10px',
      'min-height': '10px',
      margin: '20px'
    }}, ... els))
  }


  if (vState.isLoggedIn) {
    const box = settingsBox(
      dg.div(('You are logged in as ' + vState.freezrMeta.userId) + ' on the server: ' + vState.freezrMeta.serverAddress )
    )
    box.firstChild.append(dg.br())
    if (vState.offlineCredentialsExpired) {
      box.firstChild.appendChild(dg.div('Your login credentials are expired.'))
      box.firstChild.appendChild(drawCepsLoginForm(vState?.offlineCredentialsExpired))
      box.firstChild.append(dg.br())
    }
    box.firstChild.append(drawVulogLogOutSection({ freezrMeta }))
    box.firstChild.append(dg.br())
    main.append(box)
  }
  
  
  main.appendChild(settingsBox(
    drawVulogPauseSection(vState),
    dg.br(),
    (vState.isLoggedIn ? dg.div() : drawVulogRemoveDataSection(vulogInfo))))
  main.appendChild(settingsBox(drawHashtagSection(vState)))

  if (!vState.isLoggedIn) {
    main.appendChild(settingsBox(
      dg.div('You can store and sync your data on your personal server.'),
      dg.br(),
      drawCepsLoginForm()
    ))
  }
    // const permsList = await freepr.perms.getAppPermissions()
    // permsList.forEach(perm => {
    //   vState.freezrMeta.perms[perm.name] = perm
    // })
  
    
  
  } else  {
    showWarning('Internal communication error. You may need to restart your browser.')
  }
})
const clickers = async function(evt) {
  const parts = evt.target.id.split('_')
  if (parts[1] === 'gototab') {
    if (parts[2] !== 'settings') {
      window.open('/main/view.html?view=' + parts[2], '_self')
    }
  }
}
const lists = ['messages', 'history', 'marks', 'tabs']
lists.forEach(list => { dg.el('click_gototab_' + list).onclick = clickers })
