
/* global chrome */
/* global toggleCollapse */ // from utils
/* global dg */ // from dgelements.js
/* global marks, currentLog */ // from popup.js
/* global freezrMeta, freezr  */ // from freezr_app_init
/* global showWarning, offlineCredentialsExpired, setofflineCredentialsto, addSharingOnCurrent, drawCurrentTabForPopUp  */ // from popup.js

const sharing = {
  firstClickMadeNoDouble: null,
  title: function (alog) {
    const isLoggedIn = Boolean(freezrMeta.appToken)
    return (isLoggedIn ? 'Social' : 'Personal Data Server')
  },
  header: function (alog, options) {
    // options: isCurrent
    const handleExpand = function (blocktotoggle, arrow) {
      var isExpanded = toggleCollapse(blocktotoggle)
      arrow.className = isExpanded ? ('fa-chevron-down hist_details_expanded') : ('fa-chevron-right  hist_details_collapse')
    }
    const isLoggedIn = Boolean(freezrMeta.appToken)
    const recentSharingActivity = function () {
      var theSpan = dg.div({
        onclick: (e) => e.preventDefault(),
        style: { display: 'inline', cursor: 'default' }
      }, dg.span('Sharing Options'))
      let count = 0
      const sharedWith = dg.span('Shared with: ')
      if (marks.current && marks.current._accessible && marks.current._accessible._public) {
        sharedWith.appendChild(dg.span({
          style: { color: 'yellowgreen' },
          title: 'Every one has access',
          id: 'sharedWithPublicInTitle'
        },
        'the Public'))
        sharedWith.appendChild(dg.span(', '))
        count++
      }
      if (marks.contacts && marks.contacts.length > 0) {
        // console.log('sort contacts here for ', marks.current._accessible)

        marks.contacts.forEach((contact) => {
          if (marks.current && marks.current._accessible && marks.current._accessible[contact.searchname]) {
            sharedWith.appendChild(dg.span({
              style: { color: 'yellowgreen' },
              title: contact.username + '@' + contact.serverurl
            },
            contact.nickname))
            sharedWith.appendChild(dg.span(', '))
            count++
          }
        })
        // add public
        if (count > 0) {
          sharedWith.lastChild.innerText = '.'
          theSpan.firstChild.style.display = 'none'
          theSpan.appendChild(sharedWith)
        }
      }
      return theSpan
    }
    const thediv = dg.div(
      { style: { 'margin-top': '10px' } },
      dg.span({
        style: {
          cursor: 'pointer',
          color: 'lightgrey'
        }
      },
      dg.span({
        className: 'fa-chevron-right hist_details_collapse',
        style: { color: (alog._id ? 'green' : 'cornflowerblue'), 'margin-left': '5px' },
        onclick: function (evt) {
          const blocktotoggle = this.parentElement.parentElement.nextSibling
          const arrow = evt.target
          handleExpand(blocktotoggle, arrow)
          if (dg.el('cepsloginAuthUrl_main')) dg.el('cepsloginAuthUrl_main').focus()
        }
      }),
      dg.span({
        style: { color: offlineCredentialsExpired ? 'indianred' : 'lightgrey' },
        id: 'sharingArea',
        onclick: function (evt) {
          const blocktotoggle = this.parentElement.parentElement.nextSibling
          var arrow = evt.target
          for (let i = 0; i < 10; i++) {
            if (arrow && arrow.id !== 'sharingArea') arrow = arrow.parentElement
          }
          arrow = arrow.parentElement.firstChild

          handleExpand(blocktotoggle, arrow)
          if (dg.el('cepsloginAuthUrl_main')) dg.el('cepsloginAuthUrl_main').focus()
        }
      },
      isLoggedIn
        ? (offlineCredentialsExpired
          ? dg.span('Your credentials have expired)! Enter new credentials', dg.div({ style: { 'margin-left': '25px' } }, 'User:' + freezrMeta.userId + ' @ ' + freezrMeta.serverAddress))
          : recentSharingActivity())
        : 'Log on to your Personal Data Server to store and share links'
      )))
    return thediv
  },
  details: function (alog, options) {
    if (!alog) alog = {}

    const isLoggedIn = Boolean(freezrMeta.appToken)
    const detailsdiv = dg.div({
      style: {
        color: 'lightgrey',
        'font-size': '12px',
        'padding-left': '25px',
        'padding-top': '15px',
        height: '0px',
        overflow: 'hidden',
        transition: 'height 0.3s ease-out'
      }
    })
    if (isLoggedIn && !offlineCredentialsExpired) {
      sharing.drawSharingOptions(detailsdiv, true)
    } else {
      detailsdiv.appendChild(sharing.drawCepsLoginForm('main'))
    }
    return detailsdiv
  },
  fullname: function(grantee){
    return (grantee.nickname === '_public' ? grantee.nickname : (grantee.username + (grantee.serverurl ? ('@' + grantee.serverurl.replace(/\./g, '_')) : '') ))
  },
  permIsGrantedFor: function (grantee) {
    return (marks.current && marks.current._accessible && marks.current._accessible[sharing.fullname(grantee)] && marks.current._accessible[sharing.fullname(grantee)].granted)
  },
  textForPublic: function (granted) {
    return ('Double click below to toggle sharing your mark (link / highlights / Notes) with the public')
  },
  makeShareButton: function (grantee) {
    const textforgrant = (grantee.nickname !== '_public') ? grantee.nickname.replace(/\./g, '_') : 'Public post'
    const isGranted = sharing.permIsGrantedFor(grantee)
    const theDiv = dg.div({
      className: ('shareButt' + (isGranted ? (grantee.nickname === '_public' ? ' sharedItem' : ' sharedItem messagedItem') : '')),
      title: (grantee.nickname !== '_public' ? sharing.fullname(grantee) : 'Share with the world'),
      style: { 'user-select': 'none' },
      onclick: function (e) {
        sharing.firstClickMadeNoDouble = true
        setTimeout(function () {
          // e.target.
          const buttonDiv = e.target.className.includes('shareButt') ? e.target : e.target.parentElement
          if (sharing.firstClickMadeNoDouble && !buttonDiv.className.includes('inProgress')) {
            const shareOptions = dg.el('shareOptions', { clear: true })
            const wasGranted = (e.target.className.includes('sharedItem'))
            shareOptions.style.top = ((e.target.offsetTop + 5) + 'px')
            shareOptions.style.left = ((10 + e.target.offsetLeft) + 'px')
            let doGrant = true
            if (wasGranted) {
              if (grantee.nickname === '_public') {
                shareOptions.innerHTML = 'Click to stop sharing!!'
                doGrant = false
              } else {
                shareOptions.innerHTML = 'This has already been shared. Click again to re-send a message to ' + grantee.nickname + ' with your bookmark.'
              }
            } else {
              if (grantee.nickname === '_public') {
                shareOptions.innerHTML = 'Click again to make your bookmark (with highlights & notes) publicly accessible'
              } else {
                shareOptions.innerHTML = 'Click again to share your bookmark in a message to ' + grantee.nickname
              }
            }
            shareOptions.onclick = function () {
              shareOptions.style.display = 'none'
              sharing.shareFromButton(buttonDiv, grantee, doGrant)
            }
            shareOptions.style.display = 'block'
          }
        }, 400)
      },
      ondblclick: function (e) {
        e.preventDefault()
        const buttonDiv = e.target.className.includes('shareButt') ? e.target : e.target.parentElement
        const wasGranted = buttonDiv.className.includes('sharedItem')
        if (wasGranted && grantee.nickname !== '_public') {
          // Do nothing
          // showWarning('Currently, you cannot unshare an item as it gets automatically sent to the recipient.')
        } else {
          sharing.firstClickMadeNoDouble = false
          sharing.shareFromButton(buttonDiv, grantee, true)
        }
      }
    }, textforgrant)
    theDiv.grantee = grantee.nickname
    return theDiv
  },
  drawCepsLoginForm: function (section = 'main') {
    // uses global : offlineCredentialsExpired
    var cepsLoginForm = dg.div(
      { id: 'cepsloginform_' + section },
      'Please enter the authorization url of your CEPS-compatible Personal Server')
    const loginOuter = dg.div()
    loginOuter.appendChild(cepsLoginForm)
    loginOuter.appendChild(dg.img({
      id: 'loginLoader_' + section,
      src: '/freezr/static/ajaxloaderBig.gif',
      style: { display: 'none' }
    }))

    const loadLoader = function (show) {
      dg.el('cepsloginform_' + section).style.display = (show ? 'none' : 'block')
      dg.el('loginLoader_' + section).style.display = (show ? 'block' : 'none')
    }

    const tryLoggingIn = function () {
      const loginUrl = dg.el('cepsloginAuthUrl_' + section).textContent
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
              if (response && response.success) {
                showWarning() // clears
                showWarning(offlineCredentialsExpired ? 'Successfully re-authorised! ' : 'Successful login ')
                // freezrMeta.appToken = jsonResp.appToken
                freezrMeta.set(newFreezrMeta)
                if (dg.el('click_gototab_messages')) dg.el('click_gototab_messages').style.display = ''
                if (offlineCredentialsExpired) {
                  setofflineCredentialsto(false)
                  loadLoader(false)
                  addSharingOnCurrent()
                } else {
                  setTimeout(function () {
                    dg.el('vulog_inbox_records', { clear: true })
                    dg.el('thisPage_details', { clear: true })
                    drawCurrentTabForPopUp()
                    /*
                    freezr.ceps.getquery({ collection: 'marks' }, function (err, returndata) {
                      if (err) showWarning('There was a problem getting your marks. ')
                      chrome.runtime.sendMessage({ msg: 'newOnlineMarks', marks: returndata }, function (response) {
                        // onsole.log('newOnlineMarks', response)
                        loadLoader(false)
                      })
                    })
                    */
                  }, 3000)
                }
              } else {
                loadLoader(false)
                showWarning('Note : Logged in but failed to register credentials')
              }
            })
          }
        })
      } else if (!loginUrl) {
        showWarning('Please enter a url')
      } else if (parts.length < 2) {
        showWarning('Please obtain a valid authentication url from your CEPS server and paste it in the text box.')
      } else {
        showWarning('The URL you enterred does not match your current login info. If you want to change users or servers, please log off in the Setting tab.')
      }
    }
    cepsLoginForm.appendChild(dg.div({
      className: 'inputBox',
      style: { width: '400px', 'overflow-x': 'hidden' },
      id: 'cepsloginAuthUrl_' + section,
      onkeydown: function (evt) {
        if (evt.keyCode === 13 || evt.keyCode === 9) {
          evt.preventDefault()
          tryLoggingIn()
        }
      }
    }))

    cepsLoginForm.appendChild(dg.div({
      className: 'cepsbutton',
      style: { margin: '10px 190px 10px 150px' },
      onclick: tryLoggingIn
    }, (offlineCredentialsExpired ? 'Refresh credentials' : 'Login')))
    cepsLoginForm.appendChild(dg.div({}, dg.span('For more info on ceps, see'), dg.a({ href: 'https://www.salmanff.com/ppage/2020-3-15-Why-CEPS-Matters' }, ' this post.')))
    return loginOuter
  },
  drawSharingOptions: function (sharingDiv, firstTime) {
    // assumes logged in
    const logInInfo = dg.div('You are logged in as ' + freezrMeta.userId + ' on your server at: ' + freezrMeta.serverAddress)
    const haveSharingPerm = freezrMeta.perms && freezrMeta.perms.link_share && freezrMeta.perms.link_share.granted
    const haveContactsPerm = freezrMeta.perms && freezrMeta.perms.friends && freezrMeta.perms.friends.granted
    if (!freezrMeta.perms) freezrMeta.perms = { link_share: { granted: false }, friends: { granted: false } }
    if (firstTime && (!haveSharingPerm || !haveContactsPerm)) {
      freezr.perms.getAppPermissions((err, returns) => {
        if (err) {
          console.warn(err)
          sharingDiv.appendChild(dg.div('Error connecting to your server. You may not be able to share now as your server is not reachable.'))
        } else {
          const newLinkSharePerm = (returns && returns.length > 0 && returns[0].name === 'link_share' ? returns[0].granted : returns[1].granted)
          const newContactsPerm = (returns && returns.length > 0 && returns[0].name === 'friends' ? returns[0].granted : returns[1].granted)
          // groups etc added here

          freezrMeta.perms = { link_share: { granted: newLinkSharePerm }, friends: { granted: newContactsPerm } }
          if (newLinkSharePerm !== haveSharingPerm || newContactsPerm !== haveContactsPerm) {
            chrome.runtime.sendMessage({ msg: 'newSharingPerms', link_share: newLinkSharePerm, friends: newContactsPerm }, function (resp) {
              if (!resp || !resp.success) {
                console.warn({ err, resp })
                sharingDiv.appendChild(dg.div('Error connecting to your server. You may not be able to share now as your server is not reachable.'))
              } else {
                sharing.drawSharingOptions(sharingDiv, false)
              }
            })
          } else {
            sharing.drawSharingOptions(sharingDiv, false)
          }
        }
      })
    } else if (!haveSharingPerm || !haveContactsPerm) {
      const permChangeLink = dg.span(
        {
          onclick: () => { window.open(freezrMeta.serverAddress + '/ceps/perms/view/com.salmanff.vulog') },
          style: { cursor: 'pointer', color: 'cornflowerblue' }
        },
        'here')
      var divContent = dg.div()
      if (!haveSharingPerm) {
        divContent = dg.div('You need to grant the app permission to share links with others. Click ', permChangeLink, ' to grant permissions')
      } else {
        divContent.appendChild(sharing.makeShareButton({ nickname: '_public' }))
        divContent.appendChild(dg.div({ className: 'smalltext' }, sharing.textForPublic(sharing.permIsGrantedFor('_public'))))
        divContent.appendChild(dg.div('You need to grant the app permission to view your contacts if you want to share with your friends. Click ', permChangeLink, ' to grant permissions.'))
      }
      sharingDiv.appendChild(divContent)
      sharingDiv.appendChild(logInInfo)
    } else {
      var fullSharingContent = dg.div()
      fullSharingContent.appendChild(dg.div({ className: 'smalltext' }, sharing.textForPublic(sharing.permIsGrantedFor('_public'))))
      fullSharingContent.appendChild(sharing.makeShareButton({ nickname: '_public' }))

      fullSharingContent.appendChild(dg.div({ id: 'vulogFriendsList', style: { 'margin-top': '10px', 'margin-bottom': '10px' } }))
      sharingDiv.appendChild(fullSharingContent)
      sharingDiv.appendChild(logInInfo)
      setTimeout(sharing.reDrawFriendsList, 20)
    }
  },
  reDrawFriendsList: function () {
    const friendsDiv = dg.el('vulogFriendsList')
    if (!marks.contacts || marks.contacts.length === 0) {
      friendsDiv.appendChild(dg.div('Your friends list is empty.'))
      friendsDiv.appendChild(dg.div({ className: 'smalltext' }, 'Add contacts by visitng your CEPS server.'))
    } else {
      // const accessibles = { contacts:[], groups: []}
      friendsDiv.appendChild(dg.div('Double click to send this link and your notes / highlights to your friend:'))
      const list = dg.div()
      marks.contacts.forEach((contact, i) => {
        if (contact.username && contact.serverurl) list.appendChild(sharing.makeShareButton(contact))
      })
      friendsDiv.appendChild(list)
    }
    // dg.img({ src: '/freezr/static/ajaxloaderBig.gif' })
  },
  shareFromButton: function (buttonDiv, grantee, doGrant) {
    const nickName = grantee.nickname // buttonDiv.innerText
    buttonDiv.innerHTML = ''
    buttonDiv.appendChild(dg.img({
      src: '/freezr/static/ajaxloaderBig.gif',
      style: { width: '15px', 'margin-top': '-4px', 'margin-bottom': '-4px' }
    }))
    buttonDiv.className = buttonDiv.className + ' inProgress'
    sharing.shareCurrentLink(grantee, doGrant, function (err, resp) {
      // onsole.log('shareCurrentLink ', { err, resp })
      if (err) console.warn('shareCurrentLink err.message =' + err.message + '=')
      if (!err && resp && resp.recordsChanged === 1) {
        buttonDiv.className = 'shareButt' + (doGrant ? (grantee === '_public' ? ' sharedItem' : ' sharedItem messagedItem') : '')
        // if (currentName === 'Public post') buttonDiv.previousSibling.innerText = sharing.textForPublic(!wasGranted)
        if (!doGrant && dg.el('sharedWithPublicInTitle')) dg.el('sharedWithPublicInTitle').style.display = 'none'
      } else if (err && err.message === 'incomplete transmission') {
        // onsole.log('incomplete transmission - marks as shareError ')
        buttonDiv.className = 'shareButt' + (doGrant ? ' sharedItem messagedItem shareError' : '')
      } else {
        showWarning('Error sharing mark ' + ((err && err.message) ? err.message : ''))
        buttonDiv.className = 'shareButt' + (doGrant ? ' sharedItem messagedItem shareError' : '')
      }
      buttonDiv.innerText = nickName
      chrome.runtime.sendMessage({ msg: 'shared', grantee }, function (response) {
        // console.log(response)
      })
    })
  },
  shareCurrentLink: function (grantee, doGrant, callback) {
    let theMark = marks.current
    // onsole.log('have current mark ', JSON.stringify(theMark))
    freezr.promise.perms.getAppPermissions()
      .then(returns => {
        const haveSharePerm = (returns[0].name === 'link_share' ? returns[0].granted : returns[1].granted)
        if (!haveSharePerm) {
          return new Error('permission no logner exists')
        } else if (!theMark || !theMark.fj_local_temp_unique_id) {
          return new Promise((resolve, reject) => {
            const thePurl = (theMark && theMark.purl) ? theMark.purl : currentLog.purl
            sharing.getOrCreateMarkId(thePurl, function (err, item) {
              // console.log(' getOrCreateMarkId  theMark.purl : ', theMark.purl , ' currentLog.purl : ', currentLog.purl)
              if (err) { reject(err) } else { resolve(item) }
            })
          })
        } else if (theMark.fj_modified_locally) {
          chrome.runtime.sendMessage({ msg: 'trySyncing' }, function (response) {
            if (response && response.err) { showWarning(response.error) }
          })
          return new Error('Marks are unsynced. Please sync before sharing.')
        } else {
          return theMark
        }
      })
      .then((response) => {
        theMark = response
        return freezr.promise.perms.shareRecords(theMark._id, { grantees: [sharing.fullname(grantee)], name: 'link_share', action: (doGrant ? 'grant' : 'deny'), table_id: 'com.salmanff.vulog.marks' })
      })
      .then((response) => {
        if (!response) {
          callback(new Error('unknown error sharing item'))
        } else {
          if (doGrant && grantee.nickname !== '_public') {
            const msgToSend = {
              recipient_host: grantee.serverurl,
              recipient_id: grantee.username,
              sharing_permission: 'link_share',
              contact_permission: 'friends',
              table_id: 'com.salmanff.vulog.marks',
              record_id: theMark._id
            }
            freezr.ceps.sendMessage(msgToSend, function (err, ret) {
              if (err || ret.error) {
                // onsole.log('sendMessage return ', { err, ret })
                if (!err) err = new Error(ret.error + ' - ' + (ret.code || ''))
                showWarning('Link was shared but recipient was not sent a message: ' + err.message)
                callback(new Error('incomplete transmission'), response)
              } else {
                callback(null, response)
              }
            })
          } else {
            callback(null, response)
          }
        }
      })
      .catch((e) => {
        console.warn('err in promises ', e)
        callback(e)
      })
  },
  getOrCreateMarkId: function (purl, callback) {
    freezr.ceps.getquery({ app_table: 'com.salmanff.vulog.marks', q: { purl } }, (err, response) => {
      if (err) {
        callback(err)
      } else if (response.error) {
        callback(response.error)
      } else if (response.length > 0) {
        callback(null, response[0])
      } else {
        const convertLogToMark = function (logtomark) {
          const newmark = { vulog_mark_tags: [], vHighlights: [], vNote: '', vStars: [] }
          const toTransfer = ['url', 'purl', 'description', 'domainApp', 'title', 'author', 'image', 'keywords', 'type', 'vulog_favIconUrl', 'vSearchWords', 'vCreated']
          toTransfer.forEach((item) => {
            if (logtomark[item]) {
              newmark[item] = JSON.parse(JSON.stringify(logtomark[item]))
            }
          })
          if (!newmark.purl) throw Error('trying to convert log to mark with no purl ', logtomark)
          return newmark
        }
        const newmark = convertLogToMark(currentLog)
        freezr.ceps.create(newmark, { app_table: 'com.salmanff.vulog.marks' }, (err, response) => {
          if (err) {
            callback(err)
          } else if (response && response._id) {
            callback(null, response)
            chrome.runtime.sendMessage({ msg: 'newOnlineMarks', marks: response }, function (createResp) {
              // console.log('updated online mark ', createResp)
            })
          } else {
            callback(new Error('no id'))
          }
        })
      }
    })
  }
}
