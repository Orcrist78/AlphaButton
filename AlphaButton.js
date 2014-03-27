/**!
 * @license AlphaButton.js v0.1.1
 * (c) 2014 Giuseppe Scotto Lavina <mailto:gscotto78@gmail.com>
 * Available under MIT license 
 */


;(function(WIN, DOC, SLICE) {

  "use strict"

  var
    ISMOBILE = "ontouchstart" in WIN,
    IMGSDATA = {},
    IMGS     = {},

  crc32 = (function(crcTable) {
    return function(str) {
      var crc = 0 ^ (-1)
      for(var i = 0; i < str.length; i++ )
        crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xFF]
      return (crc ^ (-1)) >>> 0
    }
  })((function() {
    var c = 0, n = 0, k = 0, crcTable = []
    for(;n < 256; n++) {
        c = n
        for(k = 0; k < 8; k++) c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1))
        crcTable[n] = c
    }
    return crcTable
  })()),

  getAlpha = (function(can) {
    var ctx = can.getContext("2d")

    return function(img) {
      var
        height = img.height,
        width  = img.width,
        data   = [],
        alpha  = data,
        len    = 0,
        i      = 0

      can.width  = width
      can.height = height
      ctx.drawImage(img, 0, 0, width, height)
      data = ctx.getImageData(0, 0, width, height).data
      can.width = can.height = 0

      len = data.length
      for(;i < len; i += 4) alpha.push(data[i + 3])

      return alpha
    }
  })(DOC.createElement("canvas")),

  getAbsoluteUrl = (function(A) {
    return function(url) {
      A.href = url
      return A.href
    }
  })(DOC.createElement("a")),

  getX = function(e) {
    return "changedTouches" in e ? e.changedTouches[0].clientX + e.layerX : e.offsetX
  },

  getY = function(e) {
    return "changedTouches" in e ? e.changedTouches[0].clientY + e.layerY : e.offsetY
  }


  function AlphaButton(config) {
    return this.init(config)
  }

  AlphaButton.prototype = {
    defaults: {
      container: DOC.body,
      threshold: 255,
      glow: !ISMOBILE,
      glowRadius: 9,
      glowColorHover: "yellow",
      glowColorPress: "red"
    },
    cssText: "-webkit-transition:-webkit-filter 120ms ease-in-out;",
    states: {
      NOTREADY: "NOTREADY",
      DISABLED: "DISABLED",
      ENABLED: "ENABLED",
      ACTIVE: "ACTIVE",
      PRESSED: "PRESSED"
    },
    events: [
      ISMOBILE ? "touchmove"  : "mousemove",
      ISMOBILE ? "touchleave" : "mouseout",
      ISMOBILE ? "touchstart" : "mousedown",
      ISMOBILE ? "touchend"   : "mouseup"
    ],
    currentState: "",
    isReady: 0,

    init: function(config) {
      var option = ""

      this.options = {}
      for(option in this.defaults) this.options[option] = this.defaults[option]
      for(option in config) this.options[option] = config[option]

      if(!(this.options.container instanceof HTMLElement))
        throw new Error("container is not a valid HTMLElement!")

      if("selector" in this.options) {
        this.img = this.options.container.querySelector(this.options.selector)
        if(!(this.img instanceof HTMLImageElement))
          throw new Error("selector is not a valid HTMLImageElement!")
        if(!this.options.imgEnabled && this.img.src)
          this.options.imgEnabled = this.img.src
      }

      if(!("imgEnabled" in this.options) ||
         !this.options.imgEnabled ||
         typeof this.options.imgEnabled !== "string")
        throw new Error("imgEnabled is mandatory!")      

      this._events = []
      this._preloadImgs()
      this.setState("NOTREADY")
      return this
    },
    on: function(type, fn) {
      this._events[type] || (this._events[type] = [])
      this._events[type].push(fn)
    },
    off: function(type, fn) {
      var index = 0

      if(!this._events[type]) return
      if((index = this._events[type].indexOf(fn)) > -1)
        this._events[type].splice(index, 1)
    },
    _triggerEvent: function(type) {
      var i = 0, len = 0

      if(!this._events[type] || !(len = this._events[type].length)) return
      for(;i < len; i++) this._events[type][i].apply(this, SLICE.call(arguments, 1))
    },
    setState: function(state) {
      var imgcache, imghash = ""
      if(state in this.states && this.currentState !== this.states[state]) {
        if(this.img && state in this.hashedUrls && (imghash = this.hashedUrls[state])) {
          imgcache = IMGS[imghash]
          this.imgdata = IMGSDATA[imghash]
          this.img.src = imgcache.src
          this.height = this.img.height = imgcache.height
          this.width = this.img.width = imgcache.width
        }
        this._triggerEvent("changestate", (this.currentState = this.states[state]))
      }
    },
    handleEvent: function(e) {
      e.stopPropagation()
      e.preventDefault()
      switch(e.type) {
        case "touchmove":
        case "mousemove":
          this._checkPointer(e)
          this.allowPointer && this._triggerEvent("mousemove", e)
          break
        case "mouseout":
          this._checkPointer()
          break
        case "touchstart":
        case "mousedown":
          this._checkPointer(e)
          if(this.allowPointer) {
            if(this.options.glow)
              this.style.cssText += this._getShadowFilter(this.options.glowColorPress)
            this._triggerEvent(e.type, e)
          }
          break
        case "touchend":
        case "mouseup":
          this._checkPointer(e)
          if(this.allowPointer) {
            if(this.options.glow)
              this.style.cssText += this._getShadowFilter()
            this._triggerEvent(e.type, e)
            this._triggerEvent("click", e)
          }
          break
      }
    },
    _bindEvents: function() {
      var len = this.events.length

      while(len--) this.events[len] && this.img.addEventListener(this.events[len], this, 0)
    },
    _getShadowFilter: function(color, radius) {
      return "-webkit-filter:drop-shadow(" + (
        color || this.options.glowColorHover
      ) + " 0px 0px " + (
        radius !== 0 && !radius ? this.options.glowRadius : radius
      ) + "px) !important;"
    },
    _checkPointer: function(e) {
      if(e && this._getAlphaPixel(getX(e), getY(e)) >= this.options.threshold) {
        if(!this.allowPointer) {
          this.allowPointer = 1
          this.style.cssText += "cursor:pointer;" + (this.options.glow ? this._getShadowFilter() : "")
          this._triggerEvent("mouseover", e)
        }
      } else if(this.allowPointer) {
        this.allowPointer = 0
        this.style.cssText += "cursor:default;" + (this.options.glow ? "-webkit-filter:none!important;" : "")
        this._triggerEvent("mouseout", e)
      }
    },
    _getImage: function(src) {
      var img = {}, hash = ""

      if(src) {
        hash = crc32(getAbsoluteUrl(src))
        if(hash in IMGS && IMGS[hash]) return hash
        this.loadCounter++
        IMGS[hash] = img = new Image()
        img.onload = this.imgOnload
        img.onerror = img.onabort = this.imgOnerror
        img.src = src

        return hash
      }
    },
    _preloadImgs: function() {
      var self = this

      this.loadCounter = 0

      this.imgOnload = function() {
        var hash = ""

        if(this.src) {
          hash = crc32(this.src)
          hash in IMGSDATA || (IMGSDATA[hash] = getAlpha(this))
        }
        if(!self.loadCounter || !--self.loadCounter) {
          self.imgOnload = self.imgOnerror = null
          self._ready()
        }
      }

      this.imgOnerror = function() {
        self.imgOnload = self.imgOnerror = IMGS[this.src] = null
        throw new Error(this.src + " is not a valid img url!")
      }

      this.hashedUrls = {
        DISABLED: this._getImage(this.options.imgDisabled),
        ENABLED:  this._getImage(this.options.imgEnabled),
        ACTIVE:   this._getImage(this.options.imgPressed),
        PRESSED:  this._getImage(this.options.imgActive)
      }

      this.loadCounter || this.imgOnload()
    },
    _createElements: function() {
      this.img || (this.img = DOC.createElement("img"))
      this.style = this.img.style
      this.options.container.appendChild(this.img)
    },
    _setStyle: function() {
      var
        style   = this.options.style,
        cssText = "",
        key     = ""

      for(key in style) cssText += key + ":" + style[key] + ";"

      this.style.cssText += this.cssText + cssText
    },
    _getAlphaPixel: function(x, y) {
      return this.imgdata ? this.imgdata[((y * this.width) + x)] : -1
    },
    _ready: function() {
      this._createElements()
      this._setStyle()
      this._bindEvents()
      this.setState("ENABLED")
      this.isReady = 1
      this._triggerEvent("ready")
    }
  }

  WIN.AlphaButton = AlphaButton

})(
  this,
  document,
  Array.prototype.slice
)
