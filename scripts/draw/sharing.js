
/* global toggleCollapse */ // from utils
/* global dg */ // from dgelements.js
/* global freezrMeta  */ // from freezr_app_init
/* global showWarning, gotBullHornPublicWarning  */ // from popup.js

const sharing = {
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
    const loggedInChoices = function () {
      if (isLoggedIn && gotBullHornPublicWarning && false) { // temporary
        return dg.span({
          className: 'cepsbutton',
          onclick: function (evt) {
            sharing.publishCurrentLink()
          }
        }, 'Publish this!')
      } else {
        return ''
      }
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
        }
      }),
      dg.span({
        onclick: function (evt) {
          const blocktotoggle = this.parentElement.parentElement.nextSibling
          const arrow = evt.target.parentElement.firstChild
          handleExpand(blocktotoggle, arrow)
        }
      },
      isLoggedIn ? ('Logged in as ' + freezrMeta.userId + ' on your server at: ' + freezrMeta.serverAddress) : 'Log on to your Personal Data Server to store and share links'),
      loggedInChoices()

      ))

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
        'padding-top': '5px',
        height: '0px',
        overflow: 'hidden',
        transition: 'height 0.3s ease-out'
      }
    })
    if (isLoggedIn) {
      console.log('Sharing options to be added ', alog)
      // const isPublished = (alog._sharedwith === 'public')

      const loggedInDetails = dg.div('Sharing options will be provided in the future.')
      detailsdiv.appendChild(loggedInDetails)
      detailsdiv.appendChild(dg.div({
        style: { color: 'indianred' },
        id: 'sharingWarnings'
      }))
      // making something public
      // check freeezr permissions first - if not granted, grant
    } else {
      var cepsLoginForm = dg.div('Please enter the authorization url of your CEPS-compatible Personal Server')
      const tryLoggingIn = function () {
        freezr.utils.applogin (dg.el('cepsloginAuthUrl').textContent, function (err, jsonResp) {
          if (err || jsonResp.error) {
            showWarning('Could not log you in - ' + (err || jsonResp.error),3000);
          } else if (!jsonResp.appToken) {
            showWarning("Please install vulog on your personal server and log in again.")
          } else {
              freezrData = {
                  userId : jsonResp.userId,
                  appToken :  jsonResp.appToken,
                  serverAddress : jsonResp.serverAddress,
                  serverVersion : freezr.serverVersion
              }
              freezrMeta.appToken = jsonResp.appToken
              chrome.runtime.sendMessage({msg: "loggedin", freezrMeta:freezrData}, function(response) {
                if (response && response.success) {
                  showWarning("Successful login ")
                  dg.el('vulog_inbox_records', {clear: true})
                  addSharingOnCurrent()
                  freezr.ceps.getquery({'collection':'marks'}, function (err, returndata) {
                    if (err) showWarning('There was a problem getting your marks. ')
                    chrome.runtime.sendMessage({msg: "newOnlineMarks", marks:returndata}, function(response) {
                      // onsole.log('newOnlineMarks', response)
                    })
                  })
                } else {
                  showWarning("Note : Logged in but failed to register credentials")
                }
              });
          }
        })
      }
      cepsLoginForm.appendChild(dg.div({
        className:'inputBox',
        style: {width:'400px', 'overflow':'scroll'},
        id: 'cepsloginAuthUrl',
        onkeydown: function(evt) {
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
      },'Login'))
      cepsLoginForm.appendChild(dg.div({},dg.span('For more info on ceps, see'),dg.a({href:'https://www.salmanff.com/ppage/2020-3-15-Why-CEPS-Matters'}, ' this post.')))
      detailsdiv.appendChild(cepsLoginForm)

    }
    return detailsdiv
  },


  publishCurrentLink: function() {
    const theMark = marks.current;
    if (!gotBullHornPublicWarning) {
      dg.el('sharingWarnings').innerText = ('This will make this link and all your notes and highlights related to this link publicly accessible. Press the Publish button again to publish now. (You will not be shown this again.)')
      gotBullHornPublicWarning = true
    } else {
      let status='getAllAppPermissions'
      freezr.promise.perms.getAllAppPermissions()
      .then(response => {
        if (!theMark || !theMark.fj_local_temp_unique_id) {
          console.warn('Background needs to be updateed to include this')
          chrome.sendMessage({msg:'createMark', pulr:theMark.purl}, function(err, resp)  {
            if (err) throw err
            return {mark: resp.mark}
          })
        } else {
          return {mark:theMark}
        }
      })
      .then((response)=> {
          theMark = response.mark
          if (theMark.fj_modified_locally) {
              console.log (' sync / update the item here ****')
              throw new Error(' sync / update the item here ****')
          } else return {mark:theMark}
      })
      .then( (response) => {
        theMark = response.mark
        freezr.promise.perms.setObjectAccess("publish_favorites", theMark._id, {grant:true,shared_with_group:'public'})
      })
      .then( (response) => {
        gotBullHornPublicWarning = true
        // to complete
      })
      .catch(() => {
        // to complete
      })
    }
  }

}
