
/* items to replace in freezr: freezr_app_name, freezr_app_display_name, freezr_app_version
  freezr_app_token, freezr_user_id, freezr_server_address

/*
  In all freezr apps, freezrMeta needs to be defined before freezr_core.
  This is done in the html page script for server apps.
  For offline apps, a file like this must be used.
*/
/* global manifest */
/* exported freezrMeta */

// For offline apps:
function FREEZR_META (appName, appVersion, appDisplayName) {
  this.initialize(appName, appVersion, appDisplayName)
}

const META_INIT_KEYS = ['appName', 'appVersion', 'appDisplayName']
// Keys that need to be set by app: userId. appToken, serverAddress, serverVersion, adminsuer
FREEZR_META.prototype.initialize = function (appName, appVersion, appDisplayName) {
  this.appName = appName
  this.appVersion = appVersion
  this.appDisplayName = appDisplayName
}

FREEZR_META.prototype.reset = function () {
  for (const prop in this) {
    if (Object.prototype.hasOwnProperty.call(this, prop) && META_INIT_KEYS.indexOf(prop) < 0) {
      delete this[prop]
    }
  }
}
FREEZR_META.prototype.set = function (props) {
  this.reset()
  for (const prop in props) {
    if (META_INIT_KEYS.indexOf(prop) < 0) {
      this[prop] = props[prop]
    }
  }
}

var freezrMeta
if (manifest) { // for offline apps, where manifest is defined
  // Below used for electron
  var appName = (manifest.structure && manifest.structure.identifier) ? manifest.structure.identifier : ''
  var appVersion = (manifest.structure && manifest.structure.version) ? manifest.structure.version : ''
  var appDisplayName = (manifest.structure && manifest.structure.display_name) ? manifest.structure.display_name : ''

  freezrMeta = new FREEZR_META(appName, appVersion, appDisplayName)

  // Electron specific (ie if manifest exists, )
  // window.nodeRequire = require;
  delete window.require
  delete window.manifest // or window.appConfig?
  delete window.module
} else {
  freezrMeta = new FREEZR_META()
  freezrMeta.initialize() // eslint hack
}
