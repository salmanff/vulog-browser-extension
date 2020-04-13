
// originated from David Gilbertson (dg)
// hackernoon.com/how-i-converted-my-react-app-to-vanillajs-and-whether-or-not-it-was-a-terrible-idea-4b14b1b2faff
// v 0.0.01

var dg = {
  attributeExceptions: [
    'role', 'colspan', 'data-placeholder', 'href', 'target', 'dgdata'
  ],

  addAttributeException: function(attr) {
    if (!this.attributeExceptions.includes(attr)) this.attributeExceptions.push(attr)
  },

  appendText:function(el, text) {
    const textNode = document.createTextNode(text);
    el.appendChild(textNode);
  },

  appendArray: function(el, children) {
    children.forEach((child) => {
      if (Array.isArray(child)) {
        this.appendArray(el, child);
      } else if (child instanceof window.Element) {
        el.appendChild(child);
      } else if (typeof child === 'string') {
        this.appendText(el, child);
      }
    });
  },

  setStyles: function (el, styles) {
    if (!styles) {
      el.removeAttribute('styles');
      return;
    }

    Object.keys(styles).forEach((styleName) => {
      if (styleName in el.style) {
        el.style[styleName] = styles[styleName]; // eslint-disable-line no-param-reassign
      } else {
        console.warn('${styleName} is not a valid style for a <${el.tagName.toLowerCase()}>');
      }
    });
  },

  makeElement: function (type, textOrPropsOrChild, ...otherChildren) {
    var el = document.createElement(type);

    if (Array.isArray(textOrPropsOrChild)) {
      this.appendArray(el, textOrPropsOrChild);
    } else if (textOrPropsOrChild instanceof window.Element) {
      el.appendChild(textOrPropsOrChild);
    } else if (typeof textOrPropsOrChild === 'string') {
      this.appendText(el, textOrPropsOrChild);
    } else if (!textOrPropsOrChild) {
      // do nothing
    } else if (typeof textOrPropsOrChild === 'object') {
      Object.keys(textOrPropsOrChild).forEach((propName) => {
        if (propName in el || this.attributeExceptions.includes(propName)) {
          const value = textOrPropsOrChild[propName];

          if (propName === 'style') {
            this.setStyles(el, value);
          } else if (this.attributeExceptions.includes(propName) && value) {
            el.setAttribute(propName,value)
          } else if (value) {
            el[propName] = value;
          }
        } else {
          console.warn(propName +' is not a valid property of a '+type);
        }
      });
    }

    if (otherChildren) this.appendArray(el, otherChildren);

    return el;
  },

  a : function(...args) {return this.makeElement('a', ...args)},
  button: function(...args) {return this.makeElement('button', ...args)},
  div: function(...args) {return this.makeElement('div', ...args)},
  h1: function(...args) {return this.makeElement('h1', ...args)},
  h2: function(...args) {return this.makeElement('h2', ...args)},
  h3: function(...args) {return this.makeElement('h3', ...args)},
  header: function(...args) {return this.makeElement('header', ...args)},
  p: function(...args) {return this.makeElement('p', ...args)},
  span: function(...args) {return this.makeElement('span', ...args)},
  img: function(...args) {return this.makeElement('img', ...args)},
  b: function(...args) {return this.makeElement('b', ...args)},
  input: function(...args) {return this.makeElement('input', ...args)},

  hr: function() {return document.createElement('hr')},
  br: function() {return document.createElement('br')},
  select: function(...args) {return this.makeElement('select', ...args)},
  option: function(...args) {return this.makeElement('option', ...args)},

  createSelect: function(list=[],props={},options={}) {
    // options.value is the item the lsit is set to
    let theSel = dg.select(props);
    list.forEach(anItem => theSel.appendChild(dg.option(anItem)));
    if (options.value) theSel.value = options.value;
    return theSel;
  },
  row: function(record, options, rowCounter) {
    //onsole.log("making row", record)
    let isHeader = rowCounter === -1;
    let row = this.makeElement('tr',options.props.tr);
    if (options.keys.showThese && options.keys.showThese.length>0){
    options.keys.showThese.forEach((key) => {
        let props = isHeader? options.props.th : options.props.td;
        if (!isHeader && options.props && options.props.keyspecific && options.props.keyspecific[key]) props = Object.assign({},props,options.props.keyspecific[key])
        if (options.props && options.props.id) {
          let theId = options.props.id(key, record, rowCounter);
          if (theId) props.id=theId;
        }
        if (isHeader && options.headerTitles && options.headerTitles[key]) props.title = options.headerTitles[key];
        // for header, can have a record with the display_names
        //let content = (!isHeader && options.transform && options.transform[key])? options.transform[key](record, rowCounter): ((isHeader && (!record || !record[key]))? key : record[key])
        let content = ((isHeader && (!record || !record[key]))? key : record[key]);
        row.appendChild((!isHeader && options.transform && options.transform[key] && options.transform[key](null,props,record,rowCounter))?
            options.transform[key]('td',props, record, rowCounter):
            this.makeElement((isHeader? 'th':'td'), props, content)
            )
        //row.appendChild(this.makeElement((isHeader? 'th':'td'), props, content) )
      });

    }
    return row
  },
  table: function(data, options) {
    //onsole.log("table ",data,options)
    options = options || {};
    options.props = options.props || {};
    options.keys = options.keys || {};
    let rowCounter = -1;
    // get keys from header
    if (!options.keys.showThese) options.keys.showThese = this.utils.getKeysFromdata(data, options.keys.dontShow)
    let theTable = this.makeElement('table',options.props.table)
    let theThead = this.makeElement('thead',options.props.thead)
    theTable.appendChild( theThead  )
    theThead.appendChild( this.row(options.headers, options, rowCounter++)  )
    let theBody = this.makeElement('tbody',options.props.tbody)
    theTable.appendChild(theBody)
    if (data && data.length>0 ) data.forEach((record) =>  {theBody.appendChild(this.row(record, options, rowCounter++));} )
    return theTable
  },

  list: function(data,options) {
      return this.makeElement('ul')
  },

  el: function(id, options) {
    theEl = document.getElementById(id);
    if (theEl) {
      if (options && options.clear) theEl.innerHTML="";
      if (options && options.top) theEl.scrollTop=0;
      if (options && options.show) theEl.style.display="block";
      if (options && options.showil) theEl.style.display="inline-block";
      if (options && options.hide) theEl.style.display="none";
    }
    return theEl;
  },
  showEl: function(elorid, options) {
    const el = (typeof elorid=="string")? this.el(elorid) : elorid;
    if (el) el.style.display = (options && options.inline)? "inline-block":"block";
  },
  hideEl: function(elorid, options) {
    const el = (typeof elorid=="string")? this.el(elorid) : elorid;
    if (el) el.style.display = "none";
  },
  toggleShow: function(elorid, options) {
    const el = (typeof elorid=="string")? this.el(elorid) : elorid;
    if (el && el.style.display == "none")
      el.style.display = "block";
    else if (el)
      el.style.display = "none";
  },

  hide_els: function(ids, options) {
    if (!Array.isArray(ids)) ids = [ids]
    ids.forEach(id => {if(this.el(id)) this.el(id).style.display = "none";})
  },
  populate: function (id, ...children) {
    theEl = document.getElementById(id);
    if (theEl) {
      theEl.innerHTML="";
      this.appendArray(theEl, children)
    }
  },
  utils: {
    getKeysFromdata: function(data, dontShow) {
      //ignore options.keys.dontShow
      dontShow = dontShow || [];
      keysToShow = [];
      if (!data || data.length==0 ) {
        //onsole.log("No data "+data);
        return null;
      } else {
        data.forEach((record) =>  {
          Object.keys(record).forEach ( (propName) => {
              if (keysToShow.indexOf(propName)<0 && dontShow.indexOf(propName)<0) keysToShow.push(propName)
            })
        })
        return keysToShow;
      }
    }
  }
}
