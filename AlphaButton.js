
/**!
 * @license AlphaButton.js v0.4.1
 * (c) 2014 Giuseppe Scotto Lavina <mailto:gscotto78@gmail.com>
 * Available under MIT license 
 */


;(function(WIN, DOC, SLICE) {

  "use strict"

  var
    ISMOBILE = "ontouchend" in WIN,
    IMGSDATA = {},
    IMGS     = {},
    STATES   = {
      DISABLED: 0,
      ENABLED:  1,
      PRESSED:  2
    },
    EVENTS = [
      "click",
      ISMOBILE ? "touchmove"  : "mousemove",
      ISMOBILE ? "touchleave" : "mouseout",
      ISMOBILE ? "touchstart" : "mousedown",
      ISMOBILE ? "touchend"   : "mouseup"
    ],
    NOFILTER = "-webkit-filter:none;",
    BASECSS  = "-webkit-transition:-webkit-filter 100ms ease-in-out;" + NOFILTER,

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
        data   = null,
        alpha  = new Uint8Array(width * height),
        len    = width * height * 4,
        i      = 0

      can.width  = width
      can.height = height
      ctx.drawImage(img, 0, 0, width, height)
      data = ctx.getImageData(0, 0, width, height).data
      can.width = can.height = 0

      for(;i < len; i += 4) alpha[(i / 4) | 0] = data[i + 3]

      return alpha
    }
  })(DOC.createElement("canvas")),

  getAbsoluteUrl = (function(A) {
    return function(url) {
      A.href = url
      return A.href
    }
  })(DOC.createElement("a"))



  function AlphaButton(config) {
    return this.init(config)
  }

  AlphaButton.prototype = {
    defaults: {
      container:      DOC.body,
      threshold:      125,
      glow:           !ISMOBILE,
      glowRadius:     9,
      glowColorHover: "yellow",
      glowColorPress: "red"
    },

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

      this.events = {}
      this._preloadImgs()
      return this
    },
    destroy: function() {
      var prop = ""

      if(this.img) {
        this._unbindEvents()
        this.style.cssText = ""
        if(!("selector" in this.options))
          this.options.container.removeChild(this.img)
      }
      for(prop in this)
        if(this.hasOwnProperty(prop))
          this[prop] = null

      return this
    },
    setState: function(state) {
      var imgcache, imghash = ""

      if(state in STATES && this.currentState !== STATES[state]) {
        if(this.img && state in this.hashedUrls && (imghash = this.hashedUrls[state])) {
          imgcache = IMGS[imghash]
          this.imgdata = IMGSDATA[imghash]
          this.img.src = imgcache.src
          this.height = this.img.height = imgcache.height
          this.width = this.img.width = imgcache.width
          this.rect = this.img.getBoundingClientRect()
          this.top = this.rect.top | 0
          this.left = this.rect.left | 0
        }
        if(state === "DISABLED") {
          this._unbindEvents()
          this._checkPointer()
          if(!imghash && this.style)
            this.style.cssText += "-webkit-filter:grayscale(80%);"
        } else if(!this.domBinded) {
          this._bindEvents()
          this.style && (this.style.cssText += NOFILTER)
        }

        this.currentState = STATES[state]
        this._triggerEvent("changestate", state)
      }
      return this
    },
    on: function(type, fn) {
      this.events[type] || (this.events[type] = [])
      this.events[type].push(fn)
      return this
    },
    off: function(type, fn) {
      var index = 0

      if(!this.events[type]) return
      if((index = this.events[type].indexOf(fn)) > -1)
        this.events[type].splice(index, 1)
      return this
    },
    _triggerEvent: function(type) {
      var i = 0, len = 0

      if(!this.events[type] || !(len = this.events[type].length)) return
      for(;i < len; i++) this.events[type][i].apply(this, SLICE.call(arguments, 1))
    },
    _getX: function(e) {
      return "changedTouches" in e ? e.changedTouches[0].pageX - this.left : e.offsetX
    },
    _getY: function(e) {
      return "changedTouches" in e ? e.changedTouches[0].pageY - this.top : e.offsetY
    },
    handleEvent: function(e) {
      e.preventDefault()
      e.stopPropagation()

      switch(e.type) {
        case "touchmove":
        case "mousemove":
          this._checkPointer(e)
          this.allowPointer && this._triggerEvent("mousemove", e)
          break
        case "touchleave":
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
            this.setState("PRESSED")
            this.allowClick = 1
          }
          break
        case "touchend":
        case "mouseup":
          this._checkPointer(e)
          if(this.allowPointer && this.allowClick) {
            if(this.options.glow)
              this.style.cssText += this._getShadowFilter()
            this._triggerEvent(e.type, e)
            this._triggerEvent("click", e)
            this.setState("ENABLED")
            this.allowClick = 0
          }
      }
    },
    _getAlphaPixel: function(x, y) {
      return this.imgdata[((y * this.width) + x)]
    },
    _getShadowFilter: function(color, radius) {
      return "-webkit-filter:drop-shadow(" + (
        color || this.options.glowColorHover
      ) + " 0px 0px " + (
        radius !== 0 && !radius ? this.options.glowRadius : radius
      ) + "px);"
    },
    _checkPointer: function(e) {
      if(e && this._getAlphaPixel(this._getX(e), this._getY(e)) >= this.options.threshold) {
        if(!this.allowPointer) {
          this.allowPointer = 1
          this.style.cssText += (ISMOBILE ? "" : "cursor:pointer;") + (this.options.glow ? this._getShadowFilter() : "")
          this._triggerEvent("mouseover", e)
        }
      } else if(this.allowPointer || !e) {
        this.allowClick = this.allowPointer = 0
        this.style.cssText += (ISMOBILE ? "" : "cursor:default;") + (this.options.glow ? NOFILTER : "")
        this._triggerEvent("mouseout", e)
        this.setState("ENABLED")
      }
    },
    _getImage: function(src) {
      var img = {}, hash = ""

      if(src) {
        hash = crc32(getAbsoluteUrl(src))
        if(hash in IMGS && IMGS[hash]) {
          if(!IMGS[hash].complete) {
            this.loadCounter++
            IMGS[hash].addEventListener("load",
              function() {
                this.imgOnload.call(IMGS[hash])
              }.bind(this)
            )
          }
          return hash
        }
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
        self.destroy()
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
      if(!this.img) {
        this.img = DOC.createElement("img")
        this.options.container.appendChild(this.img)
      }
      this.style = this.img.style
    },
    _setStyle: function() {
      var
        style   = this.options.style,
        cssText = "",
        key     = ""

      for(key in style) cssText += key + ":" + style[key] + ";"

      this.style.cssText += cssText + BASECSS
    },
    _bindEvents: function() {
      var len = EVENTS.length

      while(len--) this.img.addEventListener(EVENTS[len], this, 0)
      this.domBinded = 1
    },
    _unbindEvents: function() {
      var len = EVENTS.length

      while(len--) this.img.removeEventListener(EVENTS[len], this, 0)
      this.domBinded = 0
    },
    _ready: function() {
      this._createElements()
      this._setStyle()
      this.setState("ENABLED")
      this._triggerEvent("ready")
    }
  }

  WIN.AlphaButton = AlphaButton

})(
  this,
  document,
  Array.prototype.slice
)
