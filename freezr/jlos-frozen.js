/*
jlos-frozen.js -  v2022-08 ADD ASYNC - Json Local Storage -
- CHANGED 2022-10 VCTRACKR
JLOS is a simple object for storing data in local storage, without using the filesystem for archiving data.
JLOS-frozen has additional syncing functionality for freezr

fj_modified_locally has to be updated by your script to the current time so that syncing can take place

Dependency: freezr_core.js

// options -
  saver:
    nosave, dosave, auto (default)
    set to dosave if working on development - other wise, it is unsafe to do so outside of an non-web-based app
    handleConflictedItem:
      function that allows you to transform the copy of the item and send it back for JLOS to store it
      if return null, the returned coitempy is not kept (ie the local copy prevails)
      easiest function would be function(copyOfItem) {return copyOfItem}
*/

/* global localStorage */ // from system
/* global freezr, freepr */ // from freezr_core.js
/* exported jlosMarkChanged */

function JLOS (name, options) {
  // options:
  //  saver:
  // lists
  this.name = name
  this.initialize(options)
}

JLOS.prototype.initialize = function (options) {
  this.options = options || {}
  this.writeError = false
  this.syncWarnings = { uploadWarnings: [], uploadErrors: [] }
  this.options.saver = options.saver ? options.saver : 'auto'
  this.syncing = false

  if (this.saveLS() && localStorage['jlos-data-' + this.name] && localStorage['jlos-data-' + this.name].length > 0) {
    const inside = localStorage['jlos-data-' + this.name]
    try {
      this.data = JSON.parse(inside)
    } catch (e) {
      console.warn(e)
      this.writeError = true
      this.data.error = 'Error parsing jlos file - now stored under "inside"'
      this.data.inside = inside
    }
  } else if (options && options.valueAtInit) {
    this.data = options.valueAtInit
  } else {
    this.data = {}
  }
  this.data.fj_local_id_counter = 1
  if (!this.data.last_server_sync_time || !isNaN(this.data.last_server_sync_time)) this.data.last_server_sync_time = {}
  if (options.lists && options.lists.length > 0) {
    options.lists.forEach((listName) => {
      if (!this.data[listName]) this.data[listName] = []
      if (!this.data.last_server_sync_time[listName]) this.data.last_server_sync_time[listName] = 0
    })
  }
  // Fix from previous version - can be eventually removed and self.data.last_server_sync_time={} defined above
  this.save()
}

JLOS.prototype.reInitializeData = function () {
  this.data = (this.options && this.options.valueAtInit) ? this.options.valueAtInit : {}
  this.save()
}
JLOS.prototype.save = function (override) {
  // onsole.log('prototype save '+this.name )
  if (override || (this.saveLS() && !this.writeError)) {
    localStorage['jlos-data-' + this.name] = JSON.stringify(this.data)
  }
}

JLOS.prototype.reload = function () {
  if (this.saveLS() && localStorage['jlos-data-' + this.name] && localStorage['jlos-data-' + this.name].length > 0) {
    this.data = JSON.parse(localStorage['jlos-data-' + this.name])
    if (!this.data) this.data = {}
  } else {
    // onsole.log('resetting reload with no saver!!!!!!')
    this.data = {}
  }
}

JLOS.prototype.remove = function () {
  this.data = {}
  if (this.saveLS()) {
    localStorage.removeItem('jlos-data-' + this.name)
    this.save()
  }
}

JLOS.prototype.saveLS = function () {
  return ((this.options.saver === 'dosave') || ((!this.options.saver || this.options.saver === 'auto') && freezr && freezr.app && !freezr.app.isWebBased))
}

JLOS.prototype.getSpaceUsed = function () {
  if (this.saveLS()) {
    var x
    let total = 0
    for (x in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, x)) total += localStorage[x].length * 2
    }
    // log.push('Total = ' + (total/1024/1024).toFixed(2)+ ' MB')
    return { total: (total / 1024), this: (localStorage['jlos-data-' + this.name].length * 2 / 1024) }
  } else {
    return null
  }
}

JLOS.prototype.removeFreezrInfo = function (theList) {
  var self = this
  if (self.data[theList] && self.data[theList].length > 0) {
    self.data[theList].forEach(function (anItem) {
      if (anItem) {
        anItem.fj_modified_locally = anItem._date_modified + 0
        delete anItem._id
        delete anItem._date_modified
        delete anItem._date_created
      }
    })
  }
  self.save()
}
JLOS.prototype.removeSyncedFreezrInfo = function (theList) {
  var self = this
  if (self.data[theList] && self.data[theList].length > 0) {
    for (var i = self.data[theList].length - 1; i > -1; i--) {
      if (!self.data[theList][i] || self.data[theList][i]._id) { self.data[theList].splice(i, 1) }
    }
  }
  self.save()
}

// Syncing
JLOS.prototype.sync = function (theList, options) {
  /*
  theList is any list which is in the JLos data object - it corresponds to the collection name in freezr
  options are:
    app_table: Used instead of collection when the app_table is from another app, like dev.ceps.contacts
    gotNewItemsCallBack: function sending two lists - one of all new items added to theList, one with updated items.
    warningCallBack: function sending warning messages in case of errors - warnings are objects with an 'error' describing error and a 'msg', plus 'item' if relevant showing item that had error
    uploadedItemTransform: function that transforms the data in the list before sending it to the server (typically used for encryption) - can also send back null if item should not be synced (eg when waiting for another operation to complete before syncing)
    downloadedItemTransform: function that transforms the data in the list when it is downloaded from the server (typically used for encryption)
    uploadedItemCallback: function that confirms when an item has been uploaded. Uploaded item ListItemNumber  is sent as an argument
    endCallBack: function called when the process is finished.
    doNotCallUploadItems: Boolean. Default is that uploadNewItems is automatically called
    numItemsToFetchOnStart: Number of items to fetch when jlos is started
    permissionName: name of permission under which items are shred
    xtraQueryParams: additonal params to add to each query - eg for dev.ceps.messages
  */

  var self = this
  var changedItems = []
  var newItems = []
  if (!options) options = {}
  if (!options.warningCallBack) options.warningCallBack = function (msgJson) { console.warn('WARNING: ' + msgJson) }
  // onsole.log('syncing ', theList)
  // onsole.log('startSyncItems - this.data.last_server_sync_time '+freezr.utils.longDateFormat( this.data.last_server_sync_time) )
  if (this.syncing) {
    console.warn('Already Syncing...')
  } else {
    this.syncing = true

    var queryOptions = options.app_table ? { app_table: options.app_table, q: {} } : { collection: theList, q: {} }
    // if (options.permissionName) queryOptions.permission_name = options.permissionName
    if (this.data.last_server_sync_time && this.data.last_server_sync_time[theList]) {
      queryOptions.q = { _date_modified: { $gt: this.data.last_server_sync_time[theList] } }
    } else {
      queryOptions.count = options.count || 200
    }
    if (options && options.xtraQueryParams) {
      for (const key in options.xtraQueryParams) {
        queryOptions.q[key] = options.xtraQueryParams[key]
      }
    }
    if (options.userId && (!this.data.appTokens || !this.data.appTokens[theList + '@' + options.userId])) {
      // validate
      const data = {
        data_owner_user: options.userId,
        table_id: options.app_table,
        permission: options.permission,
        app_id: 'com.salmanff.vulog' // requestor app
      }
      if (options.host) data.data_owner_host = options.host
      freezr.perms.validateDataOwner(data, function (returnJson) {
        // onsole.log({ returnJson })
        if (!returnJson || returnJson.error || !returnJson['access-token']) {
          self.syncing = false
          if (options.endCallBack) {
            options.endCallBack(returnJson.error)
          } else options.warningCallBack(returnJson.error)
        } else {
          // onsole.log('got validation ret ', ret)
          if (!self.data.appTokens) self.data.appTokens = {}
          self.data.appTokens[theList + '@' + options.userId] = returnJson['access-token']
          self.syncing = false
          self.sync(theList, options)
        }
      })
    } else {
      if (options.userId) {
        queryOptions.host = options.host
        queryOptions.appToken = this.data.appTokens[theList + '@' + options.userId]
      }
      freezr.feps.postquery(queryOptions, function (error, returnJson) {
        // onsole.log('did jlos frozen post query !! ', { error, queryOptions, returnJson })
        if (error || returnJson?.error) {
          console.error('postquery err', { error, apptable: options.app_table }, JSON.stringify(returnJson))
          if (!error) error = { message: returnJson?.message, code: returnJson?.code }
          if (!error.errorCode || returnJson.errorCode !== 'noServer') console.warn('error syncing ', returnJson)
          self.syncing = false
          if (!self.data.appTokens) self.data.appTokens = {}
          if (error && error.message === 'Token has expired.')  self.data.appTokens[theList + '@' + options.userId] = null
          if (error && error.message === 'Token has expired.')  {
            if (self.data.appTokens[theList + '@' + options.userId]) {
              self.data.appTokens[theList + '@' + options.userId] = null
            } else {
              freezr.app.offlineCredentialsExpired = true
            }
          }
          const message = (error.errorCode && error.errorCode === 'noServer') ? { error: 'no connection', message: 'Could not connect to server' } : error
          if (options.endCallBack) {
            options.endCallBack(message)
          } else options.warningCallBack(message)
        } else {
          var resultIndex = -1
          if (returnJson && returnJson.length > 0) {
            const fjReverseSort = function (obj1, obj2) {
              return obj1._date_modified - obj2._date_modified
            }
            returnJson.sort(fjReverseSort)
            for (var i = 0; i < returnJson.length; i++) {
              const returnItem = options.downloadedItemTransform ? options.downloadedItemTransform(returnJson[i]) : JSON.parse(JSON.stringify(returnJson[i]))
              resultIndex = self.idIndex(theList, returnItem, false)
              if (resultIndex > -1) {
                var existingItem = self.data[theList][resultIndex]
                if (existingItem._date_modified >= returnItem._date_modified) {
                  if (existingItem._date_modified > returnItem._date_modified) {
                    console.warn('SNBH - modified date greater on server?? ' + returnItem._id)
                  }
                } else if (!existingItem.fj_modified_locally || (existingItem.fj_deleted && returnItem.fj_deleted)) { // NO Conflicts - changed on another instance of the app
                  // onsole.log('NO conflicts - update'+returnItem._id)
                  self.data[theList][resultIndex] = returnItem
                  self.data[theList][resultIndex].fj_modified_locally = null
                  changedItems.push(returnItem)
                } else { // conflict exi sts
                  console.warn('CONFLICT dates - existing is ', existingItem, returnItem, new Date(existingItem._date_modified).toLocaleTimeString() + 'returned is' + new Date(returnItem._date_modified).toLocaleTimeString())

                  self.data[theList][resultIndex]._date_modified = returnItem._date_modified
                  if (!self.data[theList][resultIndex]._date_created) self.data[theList][resultIndex]._date_created = returnItem._date_created // nb otherwise dates should be the same

                  if (!returnItem.fj_conflictedIds) returnItem.fj_conflictedIds = []
                  returnItem.fj_conflictedIds.push(returnItem._id)
                  delete returnItem._id
                  delete returnItem.fj_local_temp_unique_id
                  delete returnItem._date_created
                  delete returnItem._date_modified
                  returnItem.fj_modified_locally = null
                  returnItem.fj_local_temp_unique_id = self.data.fj_local_id_counter++

                  if (options.handleConflictedItem) {
                    options.handleConflictedItem(returnItem, self.data[theList][resultIndex])
                  } else {
                    console.warn('conflicted entries - got from server item:', returnItem, 'kept local item:', self.data[theList][resultIndex])
                  }
                }
              } else if (returnItem && !returnItem.fj_deleted) {
                returnItem.fj_modified_locally = null
                if (!self.data[theList]) self.data[theList] = []
                self.data[theList].push(returnItem)
                newItems.push(returnItem)
              } else {
                // onsole.log('NOT ADDDING DELETED NEW ITEM  ')
              }
              if (!self.data.last_server_sync_time) self.data.last_server_sync_time = {}
              if (!self.data.last_server_sync_time[theList]) self.data.last_server_sync_time[theList] = 0
              if (!self.data.last_server_sync_time[theList] || returnItem._date_modified > self.data.last_server_sync_time[theList]) {
                self.data.last_server_sync_time[theList] = returnItem._date_modified
              }
            }
          }

          if (options.gotNewItemsCallBack) options.gotNewItemsCallBack(newItems, changedItems)

          if (!options.doNotCallUploadItems) {
            self.uploadNewItems(theList, options)
          } else {
            self.syncing = false
            self.save()
          }
        }
      })
    }
  }
}
JLOS.prototype.getOlderItemsAsync = async function (theList, options) {
  const self = this

  const newItems = []

  // this.syncing = true // no need to be not syncing

  // get oldest modified (Probably better if this was recorded automatically

  let oldestModified = null
  if (self.data[theList] && self.data[theList].length > 0) {
    oldestModified = self.data[theList].reduce((acc, mark) => Math.min(mark._date_modified || mark.fj_modified_locally || new Date().getTime(), acc), (oldestModified || new Date().getTime()))
  }

  const queryOptions = options.app_table ? { app_table: options.app_table } : { collection: theList }
  queryOptions.count = options?.count || 100
  queryOptions.q = { _date_modified: { $lt: oldestModified } }

  const returnJson = await freepr.feps.postquery(queryOptions)

    if (!returnJson || returnJson.error) {
      throw new Error('couldnot fetch')
    } else {
      var resultIndex = -1
      let addedNew = false
      if (returnJson && returnJson.length > 0) {
        const fjReverseSort = function (obj1, obj2) {
          return obj1._date_modified - obj2._date_modified
        }
        returnJson.sort(fjReverseSort)

        for (var i = 0; i < returnJson.length; i++) {
          const returnItem = options.downloadedItemTransform ? options.downloadedItemTransform(returnJson[i]) : JSON.parse(JSON.stringify(returnJson[i]))
          if (returnItem && !returnItem.fj_deleted) {
            returnItem.fj_modified_locally = null
            self.data[theList].push(returnItem)
            newItems.push(returnItem)
          } 
        }
      }
      self.save()

      return newItems
    }
}

JLOS.prototype.getNewitemsAsync = async function (theList, options) {
  var self = this

  var changedItems = []
  var newItems = []
  if (!options) options = {}
  if (!options.warningCallBack) options.warningCallBack = function (msgJson) { console.warn('WARNING: ' + msgJson) }

  // onsole.log('startSyncItems - this.data.last_server_sync_time '+freezr.utils.longDateFormat( this.data.last_server_sync_time) )
  if (this.syncing) {
    console.warn('Already Syncing...')
    return 'Could not sync - Already Syncing...'
  } else {
    this.syncing = true

    const queryOptions = options.app_table ? { app_table: options.app_table } : { collection: theList }
    // if (options.permissionName) queryOptions.permission_name = options.permissionName

    if (options.onlyDownloadLatestItems) {
      queryOptions.q = {}
    } else if (!self.data.last_server_sync_time || !self.data.last_server_sync_time[theList]) { // nothing has been downloaded nb could also check for data[thelist] being empty
      queryOptions.q = {}
    } else {
      queryOptions.q = { _date_modified: { $gt: (self.data.last_server_sync_time[theList]) || 0 } }
      queryOptions.sort = { _date_modified: 1 }
    }
    if (options && options.xtraQueryParams) {
      for (const key in options.xtraQueryParams) {
        queryOptions.q[key] = options.xtraQueryParams[key]
      }
    }

    const returnJson = await freepr.feps.postquery(queryOptions)

    if (returnJson.error) {
      if (returnJson.errorCode !== 'noServer') console.warn('error syncing ', returnJson)
      self.syncing = false
      if (options.endCallBack) {
        options.endCallBack(returnJson.error)
      } else options.warningCallBack(returnJson.error)
      return returnJson.error
    } else {
      var resultIndex = -1
      let addedNew = false
      if (returnJson && returnJson.length > 0) {
        const fjReverseSort = function (obj1, obj2) {
          return obj1._date_modified - obj2._date_modified
        }
        returnJson.sort(fjReverseSort)

        for (var i = 0; i < returnJson.length; i++) {
          const returnItem = options.downloadedItemTransform ? options.downloadedItemTransform(returnJson[i]) : JSON.parse(JSON.stringify(returnJson[i]))
          resultIndex = self.idIndex(theList, returnItem, false)
          if (resultIndex > -1) {
            var existingItem = self.data[theList][resultIndex]
            if (existingItem._date_modified >= returnItem._date_modified) {
              if (existingItem._date_modified > returnItem._date_modified) {
                addedNew = true
                console.warn('SNBH - modified date greater on server?? ' + returnItem._id)
              }
            } else if (!existingItem.fj_modified_locally) { // NO Conflicts - changed on another instance of the app
              // onsole.log('NO conflicts - update'+returnItem._id)
              addedNew = true
              self.data[theList][resultIndex] = returnItem
              self.data[theList][resultIndex].fj_modified_locally = null
              changedItems.push(returnItem)
            } else { // conflict exi sts
              addedNew = true
              console.warn('CONFLICT dates - existing is ', existingItem, returnItem, new Date(existingItem._date_modified).toLocaleTimeString() + 'returned is' + new Date(returnItem._date_modified).toLocaleTimeString())

              self.data[theList][resultIndex]._date_modified = returnItem._date_modified

              if (!returnItem.fj_conflictedIds) returnItem.fj_conflictedIds = []
              returnItem.fj_conflictedIds.push(returnItem._id)
              delete returnItem._id
              delete returnItem.fj_local_temp_unique_id
              delete returnItem._date_created
              delete returnItem._date_modified
              returnItem.fj_modified_locally = null
              returnItem.fj_local_temp_unique_id = self.data.fj_local_id_counter++

              if (options.handleConflictedItem) {
                options.handleConflictedItem(returnItem, self.data[theList][resultIndex])
              } else {
                console.warn('conflicted entries - got from server item:', returnItem, 'kept local item:', self.data[theList][resultIndex])
              }
            }
          } else if (returnItem && !returnItem.fj_deleted) {
            addedNew = true
            returnItem.fj_modified_locally = null
            if (!self.data[theList]) self.data[theList] = []
            self.data[theList].push(returnItem)
            newItems.push(returnItem)
          } else {
            addedNew = true
            // onsole.log('NOT ADDDING DELETED NEW ITEM  ')
          }
          if (!self.data.last_server_sync_time) self.data.last_server_sync_time = {}
          if (!self.data.last_server_sync_time[theList]) self.data.last_server_sync_time[theList] = 0
          if (!self.data.last_server_sync_time[theList] || returnItem._date_modified > self.data.last_server_sync_time[theList]) {
            self.data.last_server_sync_time[theList] = returnItem._date_modified
          }
        }
      }

      if (options.gotNewItemsCallBack) options.gotNewItemsCallBack(newItems, changedItems)

      self.syncing = false
      self.save()

      if (addedNew) {
        // onsole.log('REDOWNLOADING MORE IN LIST ', theList)
        await self.getNewitemsAsync(theList, options)
      }

      return null
    }
  }
}

JLOS.prototype.uploadNewItems = function (theList, options) {
  // for options list, see startSyncItems. (gotNewItemsCallBack and doNotCallUploadItems are not called.)
  // Unless items cannot be updated, it is unsafe to call this without calling startSyncItems because only startSyncItems checks for conflicts. this function just over-writes the previous version.
  var self = this
  if (!options) options = {}
  if (!options.warningCallBack) options.warningCallBack = function (msgJson) { console.warn('WARNING: ' + JSON.stringify(msgJson)) }

  // let listItemNumber = -1
  let anItem = null
  let transformedItem = null
  if (this.data[theList] && this.data[theList].length > 0) {
    for (let i = 0; i < this.data[theList].length; i++) {
      if (this.data[theList][i] && this.data[theList][i].fj_modified_locally && !this.data[theList][i].fj_upload_error) {
        anItem = this.data[theList][i]
        transformedItem = JSON.parse(JSON.stringify(anItem))
        try {
          transformedItem = options.uploadedItemTransform ? options.uploadedItemTransform(transformedItem) : transformedItem
          if (!transformedItem) throw new Error('error transforming item')
          // if (!transformedItem) this.syncWarnings.uploadWarnings.push({ list: theList, item: anItem })
          // listItemNumber = i
          break
        } catch (e) {
          this.syncWarnings.uploadErrors.push({ list: theList, item: anItem, error: e })
          this.data[theList][i].fj_upload_error = true
          anItem = null
        }
      }
    }
  }
  if (anItem && transformedItem) {
    if (!anItem._id && !anItem.fj_local_temp_unique_id) {
      anItem.fj_local_temp_unique_id = this.data.fj_local_id_counter++
      transformedItem.fj_local_temp_unique_id = anItem.fj_local_temp_unique_id
    }
    if (!anItem.fj_deleted) anItem.fj_deleted = false // to add device
    // this.data[theList][listItemNumber].fj_device_modified_on =
    this.save()
    var uploadOptions = options.app_table ? { app_table: options.app_table } : { collection: theList }

    if (anItem._id) {
      uploadOptions.updateRecord = true
    }

    // onsole.log('going to upload item :'+JSON.stringify(anItem))
    // onsole.log('with uploadOptions.updateRecord '+uploadOptions.updateRecord)
    // onsole.log('with options '+JSON.stringify(uploadOptions))

    freezr.ceps.create(transformedItem, uploadOptions, function (error, returnData) {
      // check that the item id is correct - update the item and set modified to null
      if (error) {
        options.warningCallBack({ error: error, code: error.code, msg: 'error uploading note to database ' + (error.message ? error.message : ''), item: anItem, status: returnData.status })
        anItem.fj_upload_error = true
        if (!this.syncWarnings) this.syncWarnings = { uploadWarnings: [], uploadErrors: [] }
        this.syncWarnings.uploadWarnings.push({ list: theList, item: anItem })
        // if decide to delete... re-removed 2020
        // let idx = self.idIndex(theList,anItem)
        // self.data[theList].splice(idx,1)
        self.uploadNewItems(theList, options)
      } else if (!transformedItem._id) { // new item
        // if (anItem.fj_local_temp_unique_id !== self.data[theList][listItemNumber].fj_local_temp_unique_id) {
        //   console.warn('WARNING - POTENITAL SYNC ERROR 23', 'transformedItem', transformedItem, 'inlist', self.data[theList][listItemNumber])
        //   options.warningCallBack({ error: 'id mismatch on upload', msg: 'There was an internal error (23) uploading and syncing one of the items.' })
        // }
        anItem._id = returnData._id
        anItem.fj_modified_locally = null
        anItem._date_modified = returnData._date_modified
        anItem._date_created = anItem._date_created || returnData._date_created
        if (options.uploadedItemCallback) options.uploadedItemCallback(null, anItem) // (listItemNumber, self.data[theList][listItemNumber])
        self.save()
        self.uploadNewItems(theList, options)
      } else if (anItem?._id && anItem._id === returnData._id) {
        // if (self.data[theList][listItemNumber]._id !== returnData._id) {
        //   console.warn('WARNING - POTENITAL SYNC ERROR 24')
        //   options.warningCallBack({ error: 'id mismatch on upload', msg: 'There was an internal error (24) uploading and syncing one of the items.', item: anItem })
        // }
        anItem.fj_modified_locally = null
        anItem._date_modified = returnData._date_modified
        self.save()
        if (options.uploadedItemCallback) options.uploadedItemCallback(null, anItem) // (listItemNumber, self.data[theList][listItemNumber])
        self.uploadNewItems(theList, options)
      } else {
        console.warn('mismatch', returnData, anItem)
        options.warningCallBack({ error: 'id mismatch on upload', msg: 'There was an internal error (25) uploading and syncing one of the items.', item: returnData })
        self.syncing = false
        if (options.endCallBack) options.endCallBack()
      }
    })
  } else { // no new items
    this.syncing = false
    if (this.data[theList] && this.data[theList].length > 0) this.data[theList].map(function (anitem) { if (anitem) delete anitem.fj_upload_error })
    if (options.endCallBack) options.endCallBack()
  }
}
JLOS.prototype.uploadNewItemsAsync = async function (theList, options) {
  // for options list, see startSyncItems. (gotNewItemsCallBack and doNotCallUploadItems are not called.)
  // Unless items cannot be updated, it is unsafe to call this without calling startSyncItems because only startSyncItems checks for conflicts. this function just over-writes the previous version.
  var self = this
  if (!options) options = {}
  if (!options.warningCallBack) options.warningCallBack = function (msgJson) { console.warn('WARNING: ' + JSON.stringify(msgJson)) }

  // let listItemNumber = -1
  let anItem = null
  let transformedItem = null
  if (this.data[theList] && this.data[theList].length > 0) {
    for (let i = 0; i < this.data[theList].length; i++) {
      if (this.data[theList][i] && this.data[theList][i].fj_modified_locally && !this.data[theList][i].fj_upload_error) {
        anItem = this.data[theList][i]
        transformedItem = JSON.parse(JSON.stringify(anItem))
        try {
          transformedItem = options.uploadedItemTransform ? options.uploadedItemTransform(transformedItem) : transformedItem
          if (!transformedItem) throw new Error('error transforming item')
          // if (!transformedItem) this.syncWarnings.uploadWarnings.push({ list: theList, item: anItem })
          // listItemNumber = i
          break
        } catch (e) {
          this.syncWarnings.uploadErrors.push({ list: theList, item: anItem })
          this.data[theList][i].fj_upload_error = true
          anItem = null
        }
      }
    }
  }
  if (anItem && transformedItem) {
    if (!anItem._id && !anItem.fj_local_temp_unique_id) {
      anItem.fj_local_temp_unique_id = this.data.fj_local_id_counter++
      transformedItem.fj_local_temp_unique_id = anItem.fj_local_temp_unique_id
    }
    if (!anItem.fj_deleted) anItem.fj_deleted = false // to add device
    // this.data[theList][listItemNumber].fj_device_modified_on =
    this.save()
    var uploadOptions = options.app_table ? { app_table: options.app_table } : { collection: theList }

    if (anItem._id) {
      uploadOptions.updateRecord = true
    }

    // onsole.log('going to upload item :'+JSON.stringify(anItem))
    // onsole.log('with uploadOptions.updateRecord '+uploadOptions.updateRecord)
    // onsole.log('with options '+JSON.stringify(uploadOptions))
    const returnData = await freepr.ceps.create(transformedItem, uploadOptions)
    // check that the item id is correct - update the item and set modified to null
    if (!transformedItem._id) { // new item
      // if (anItem.fj_local_temp_unique_id !== self.data[theList][listItemNumber].fj_local_temp_unique_id) {
      //   console.warn('WARNING - POTENITAL SYNC ERROR 23', 'transformedItem', transformedItem, 'inlist', self.data[theList][listItemNumber])
      //   options.warningCallBack({ error: 'id mismatch on upload', msg: 'There was an internal error (23) uploading and syncing one of the items.' })
      // }
      anItem._id = returnData._id
      anItem.fj_modified_locally = null
      anItem._date_modified = returnData._date_modified
      anItem._date_created = anItem._date_created || returnData._date_created
      if (options.uploadedItemCallback) options.uploadedItemCallback(null, anItem) // (listItemNumber, self.data[theList][listItemNumber])
      self.save()
      self.uploadNewItems(theList, options)
    } else if (anItem._id === returnData._id) {
      // if (self.data[theList][listItemNumber]._id !== returnData._id) {
      //   console.warn('WARNING - POTENITAL SYNC ERROR 24')
      //   options.warningCallBack({ error: 'id mismatch on upload', msg: 'There was an internal error (24) uploading and syncing one of the items.', item: anItem })
      // }
      anItem.fj_modified_locally = null
      anItem._date_modified = returnData._date_modified
      self.save()
      if (options.uploadedItemCallback) options.uploadedItemCallback(null, anItem)//(listItemNumber, self.data[theList][listItemNumber])
      self.uploadNewItems(theList, options)
    } else {
      console.warn('mismatch', returnData, anItem)
      options.warningCallBack({ error: 'id mismatch on upload', msg: 'There was an internal error (25) uploading and syncing one of the items.', item: returnData })
      self.syncing = false
      if (options.endCallBack) options.endCallBack()
    }
    return null
  } else { // no new items
    this.syncing = false
    if (this.data[theList] && this.data[theList].length > 0) this.data[theList].map(function (anitem) { if (anitem) delete anitem.fj_upload_error })
    if (options.endCallBack) options.endCallBack()
    return null
  }
}

// accessing changing lists
JLOS.prototype.list = function (theList, options = {}) {
  let retList = this.data[theList]
  if (!retList || retList.length === 0) {
    retList = []
  } else if (options.sort) {
    const asc = options.sort.asc || false
    const fjCustomSort = function (obj1, obj2) {
      if ((!obj1 && !obj2) || (!obj1[options.sort.field] && !obj2[options.sort.field])) return 0
      if (!obj1 || !obj1[options.sort.field]) return asc ? 1 : -1
      if (!obj2 || !obj2[options.sort.field]) return asc ? -1 : 1
      return asc ? (obj2[options.sort.field] - obj1[options.sort.field]) : (obj1[options.sort.field] - obj2[options.sort.field])
    }
    const defaultSort = function (obj1, obj2) {
      const value1 = obj1 ? (obj1.fj_modified_locally || obj1._date_modified || 1) : 0
      const value2 = obj2 ? (obj2.fj_modified_locally || obj2._date_modified || 1) : 0
      return (asc ? 1 : -1) * (value2 - value1)
    }
    if (!options.sort.field) { retList.sort(defaultSort) } else { retList.sort(fjCustomSort) }
  }
  return retList
}
JLOS.prototype.get = function (theList, id, options = { idType: 'both' }) {
  const refList = this.data[theList]
  if (refList && refList.length > 0) {
    if (options.idType === 'localtemp') {
      for (let i = 0; i < refList.length; i++) {
        if (!refList[i]._id && refList[i].fj_local_temp_unique_id && refList[i].fj_local_temp_unique_id === id) {
          return this.data[theList][i]
        }
      }
    } else {
      for (let i = 0; i < refList.length; i++) {
        if (refList[i]._id && refList[i]._id === id) {
          return this.data[theList][i]
        } else if (options.idType === 'both' && !refList[i]._id && refList[i].fj_local_temp_unique_id && ('' + refList[i].fj_local_temp_unique_id) === id) {
          return this.data[theList][i]
        }
      }
    }
  }
  return null
}

JLOS.prototype.add = function (theList, anItem) {
  if (!anItem._id && !anItem.fj_local_temp_unique_id) {
    anItem = JSON.parse(JSON.stringify(anItem))
    anItem.fj_modified_locally = new Date().getTime()
    anItem.fj_local_temp_unique_id = this.data.fj_local_id_counter++
    if (!this.data[theList]) this.data[theList] = []
    this.data[theList].push(anItem)
    return anItem
  } else {
    console.error('Could not add a new item with existing id in the list ' + theList, { anItem })
    throw Error('cant add item with existing id')
  }
}

JLOS.prototype.updateFullRecord = function (theList, anItem) {
  // finds the full item by its id and replaces the full record
  const idIndex = this.idIndex(theList, anItem, true)
  if (idIndex >= 0) {
    anItem = JSON.parse(JSON.stringify(anItem))
    anItem.fj_modified_locally = new Date().getTime()
    this.data[theList][idIndex] = anItem
    // onsole.log('updated '+idIndex)
    return anItem
  } else {
    console.error('Could not find item', anItem, 'in list ' + theList)
    throw Error('could not find item to update')
  }
}

JLOS.prototype.markDeleted = function (theList, anItem, options = {}) {
  // finds the record using criteria, and updated
  const idIndex = this.idIndex(theList, anItem, (options.idType === 'both'))
  if (idIndex >= 0) {
    if ((options && options.removeAllFields) || !this.data[theList][idIndex]._id) {
      this.data[theList].splice(idIndex, 1)
    } else {
      const item = this.data[theList][idIndex]
      const KEYSTOSTAY = ['_date_modified', '_date_created', '_id', '_owner', '_accessible_By', 'fj_modified_locally', 'fj_local_temp_unique_id']
      Object.keys(item).forEach(function (aParam) {
        if (!KEYSTOSTAY.includes(aParam)) { delete item[aParam] }
      })
      this.data[theList][idIndex].fj_deleted = true
      this.data[theList][idIndex].fj_modified_locally = new Date().getTime()
    }
    this.save()
    return this.data[theList][idIndex]
  } else {
    console.error('Could not find item', anItem, 'in list ' + theList)
    throw Error('could not find item to update')
  }
}

JLOS.prototype.idIndex = function (theList, anItem, searchLocalTempIds) {
  const refList = this.data[theList]
  let theIndex = -1
  if (refList && refList.length > 0) {
    for (let i = 0; i < refList.length; i++) {
      if (refList[i] && refList[i]._id && anItem && refList[i]._id === anItem._id) {
        theIndex = i
        break
      }
    }
  }
  if (searchLocalTempIds && theIndex === -1) { // generally a locally created conflicted copy that has no id but has a temporary local id
    for (var i = 0; i < refList.length; i++) {
      if (refList[i] && !refList[i]._id && refList[i].fj_local_temp_unique_id && refList[i].fj_local_temp_unique_id === anItem.fj_local_temp_unique_id) {
        theIndex = i
        break
      }
    }
  }
  return theIndex
}

JLOS.prototype.removeLocalCopy = function (theList, criteria) {
  var refList = this.data[theList]
  if (refList && refList.length > 0) {
    for (var i = refList.length - 1; i > -1; i--) {
      let meetsCriteria = true
      Object.keys(criteria).forEach(aParam => {
        if (criteria[aParam] !== refList[i][aParam]) meetsCriteria = false
      })
      if (meetsCriteria) refList.splice(i, 1)
    }
  }
}

JLOS.prototype.isEmpty = function (theList) {
  return (!this.data[theList] || this.data[theList].length === 0)
  // also check if is Array
}

JLOS.prototype.queryNum = function (theList, params, options) {
  // options to add: startAtBeg
  // search params
  var refList = this.data[theList]
  let theItemNum = -1
  let isCandidate = true
  // onsole.log(params)
  if (refList && params) {
    for (let i = refList.length - 1; i > -1; i--) {
      isCandidate = true
      Object.keys(params).forEach(function (aParam) {
        if (isCandidate && refList[i][aParam] === params[aParam]) {
          isCandidate = true
        } else {
          isCandidate = false
        }
      })
      if (isCandidate) {
        theItemNum = i
        break
      }
    }
  }
  return theItemNum
}

JLOS.prototype.idFromNum = function (theList, listNum) {
  const refList = this.data[theList]
  if (listNum > -1 && refList[listNum]) {
    return refList._id || refList.fj_local_temp_unique_id
  } else {
    return null
  }
}

JLOS.prototype.queryLatest = function (theList, params, options) {
  // same options as below, but getIndex doesnt work
  options = options || {}
  options.getOne = true
  return this.queryObjs(theList, params, options)
}
JLOS.prototype.queryObjs = function (theList, params, options = {}) {
  // options: makeCopy, getOne, includeDeleted, getIndex (only works with getOne and not queryLatest)
  // options to add: startAtBeg
  // search params
  // onsole.log(queryObjs)
  // onsole.log('quaeryObjs ', params)

  const hasParam = function (object, param, value) {
    if (!['string', 'number'].includes(typeof value)) {
      console.error('bad query for ', { object, param, value })
      // throw new Error('cannot parse non string num vales')
      return false
    }
    if (!object) return false
    if (typeof param !== 'string') return false
    // note complex queries not accepted yet
    if (!object[param] && !value) return true
    if (typeof object[param] === 'string' || typeof object[param] === 'number') return object[param] === value
    // note - this could lead to false positive if both key.key exists and 'key.key' exists as a key
    if (Array.isArray(object[param])) { return object[param].includes(value) } /* for arrays of strings/nums */
    // note only looks up values in arrays - not values within objects within arrays
    if (param.includes('.')) {
      const keyChain = param.split('.')
      const key0 = keyChain.shift()
      if (key0 === '[]' && Array.isArray(object)) {
        let found1 = false
        const key1 = keyChain.shift()
        object.forEach(objInArray => {
          if (hasParam(objInArray, key1, value)) found1 = true
          if (hasParam(objInArray, key1, value)) return true
        })
        return found1
      } else {
        return hasParam(object[key0], keyChain.join('.'), value)
      }
    }
    return false
  }

  var refList = this.data[theList]
  var objectList = []
  let isCandidate = true
  let i
  options = options || {}
  if (refList && params) {
    for (i = refList.length - 1; i > -1; i--) {
      isCandidate = true
      Object.keys(params).forEach(function (aParam) {
        if (isCandidate && hasParam(refList[i], aParam, params[aParam])) {
          isCandidate = true
        } else {
          isCandidate = false
        }
      })
      if (isCandidate) objectList.push((options && options.makeCopy) ? JSON.parse(JSON.stringify(refList[i])) : refList[i])
      if (isCandidate && !options.includeDeleted && refList[i].fj_deleted) isCandidate = false
      if (isCandidate && options.getOne) { break }
    }
  }
  if (options.getOne && options.getIndex) return [objectList[0], (isCandidate ? i : -1)]
  if (options.getOne) return objectList.length > 0 ? objectList[0] : null
  return objectList
}

const jlosMarkChanged = function (anItem) {
  if (anItem) anItem.fj_modified_locally = new Date().getTime()
}
jlosMarkChanged() // eslint export hack
