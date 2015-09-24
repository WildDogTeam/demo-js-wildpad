var wildpad = wildpad || { };

wildpad.Wildpad = (function(global) {
  if (!wildpad.RichTextCodeMirrorAdapter) {
    throw new Error("Oops! It looks like you're trying to include lib/wildpad.js directly.  This is actually one of many source files that make up wildpad.  You want dist/wildpad.js instead.");
  }
  var RichTextCodeMirrorAdapter = wildpad.RichTextCodeMirrorAdapter;
  var RichTextCodeMirror = wildpad.RichTextCodeMirror;
  var RichTextToolbar = wildpad.RichTextToolbar;
  var ACEAdapter = wildpad.ACEAdapter;
  var WilddogAdapter = wildpad.WilddogAdapter;
  var EditorClient = wildpad.EditorClient;
  var EntityManager = wildpad.EntityManager;
  var ATTR = wildpad.AttributeConstants;
  var utils = wildpad.utils;
  var LIST_TYPE = wildpad.LineFormatting.LIST_TYPE;
  var CodeMirror = global.CodeMirror;
  var ace = global.ace;

  function Wildpad(ref, place, options) {
    if (!(this instanceof Wildpad)) { return new Wildpad(ref, place, options); }

    if (!CodeMirror && !ace) {
      throw new Error('Couldn\'t find CodeMirror or ACE.  Did you forget to include codemirror.js or ace.js?');
    }

    this.zombie_ = false;

    if (CodeMirror && place instanceof CodeMirror) {
      this.codeMirror_ = this.editor_ = place;
      var curValue = this.codeMirror_.getValue();
      if (curValue !== '') {
        throw new Error("Can't initialize Wildpad with a CodeMirror instance that already contains text.");
      }
    } else if (ace && place && place.session instanceof ace.EditSession) {
      this.ace_ = this.editor_ = place;
      curValue = this.ace_.getValue();
      if (curValue !== '') {
        throw new Error("Can't initialize Wildpad with an ACE instance that already contains text.");
      }
    } else {
      this.codeMirror_ = this.editor_ = new CodeMirror(place);
    }

    var editorWrapper = this.codeMirror_ ? this.codeMirror_.getWrapperElement() : this.ace_.container;
    this.wildpadWrapper_ = utils.elt("div", null, { 'class': 'wildpad' });
    editorWrapper.parentNode.replaceChild(this.wildpadWrapper_, editorWrapper);
    this.wildpadWrapper_.appendChild(editorWrapper);

    // Don't allow drag/drop because it causes issues.  See https://github.com/wilddog/wildpad/issues/36
    utils.on(editorWrapper, 'dragstart', utils.stopEvent);

    // Provide an easy way to get the wildpad instance associated with this CodeMirror instance.
    this.editor_.wildpad = this;

    this.options_ = options || { };

    if (this.getOption('richTextShortcuts', false)) {
      if (!CodeMirror.keyMap['richtext']) {
        this.initializeKeyMap_();
      }
      this.codeMirror_.setOption('keyMap', 'richtext');
      this.wildpadWrapper_.className += ' wildpad-richtext';
    }

    this.imageInsertionUI = this.getOption('imageInsertionUI', true);

    if (this.getOption('richTextToolbar', false)) {
      this.addToolbar_();
      this.wildpadWrapper_.className += ' wildpad-richtext wildpad-with-toolbar';
    }

    this.addPoweredByLogo_();

    // Now that we've mucked with CodeMirror, refresh it.
    if (this.codeMirror_)
      this.codeMirror_.refresh();

    var userId = this.getOption('userId', ref.push().key());
    var userColor = this.getOption('userColor', colorFromUserId(userId));

    this.entityManager_ = new EntityManager();

    this.wilddogAdapter_ = new WilddogAdapter(ref, userId, userColor);
    if (this.codeMirror_) {
      this.richTextCodeMirror_ = new RichTextCodeMirror(this.codeMirror_, this.entityManager_, { cssPrefix: 'wildpad-' });
      this.editorAdapter_ = new RichTextCodeMirrorAdapter(this.richTextCodeMirror_);
    } else {
      this.editorAdapter_ = new ACEAdapter(this.ace_);
    }
    this.client_ = new EditorClient(this.wilddogAdapter_, this.editorAdapter_);

    var self = this;
    this.wilddogAdapter_.on('cursor', function() {
      self.trigger.apply(self, ['cursor'].concat([].slice.call(arguments)));
    });

    if (this.codeMirror_) {
      this.richTextCodeMirror_.on('newLine', function() {
        self.trigger.apply(self, ['newLine'].concat([].slice.call(arguments)));
      });
    }

    this.wilddogAdapter_.on('ready', function() {
      self.ready_ = true;

      if (this.ace_) {
        this.editorAdapter_.grabDocumentState();
      }

      var defaultText = self.getOption('defaultText', null);
      if (defaultText && self.isHistoryEmpty()) {
        self.setText(defaultText);
      }

      self.trigger('ready');
    });

    this.client_.on('synced', function(isSynced) { self.trigger('synced', isSynced)} );

    // Hack for IE8 to make font icons work more reliably.
    // http://stackoverflow.com/questions/9809351/ie8-css-font-face-fonts-only-working-for-before-content-on-over-and-sometimes
    if (navigator.appName == 'Microsoft Internet Explorer' && navigator.userAgent.match(/MSIE 8\./)) {
      window.onload = function() {
        var head = document.getElementsByTagName('head')[0],
          style = document.createElement('style');
        style.type = 'text/css';
        style.styleSheet.cssText = ':before,:after{content:none !important;}';
        head.appendChild(style);
        setTimeout(function() {
          head.removeChild(style);
        }, 0);
      };
    }
  }
  utils.makeEventEmitter(Wildpad);

  // For readability, these are the primary "constructors", even though right now they're just aliases for Wildpad.
  Wildpad.fromCodeMirror = Wildpad;
  Wildpad.fromACE = Wildpad;

  Wildpad.prototype.dispose = function() {
    this.zombie_ = true; // We've been disposed.  No longer valid to do anything.

    // Unwrap the editor.
    var editorWrapper = this.codeMirror_ ? this.codeMirror_.getWrapperElement() : this.ace_.container;
    this.wildpadWrapper_.removeChild(editorWrapper);
    this.wildpadWrapper_.parentNode.replaceChild(editorWrapper, this.wildpadWrapper_);

    this.editor_.wildpad = null;

    if (this.codeMirror_ && this.codeMirror_.getOption('keyMap') === 'richtext') {
      this.codeMirror_.setOption('keyMap', 'default');
    }

    this.wilddogAdapter_.dispose();
    this.editorAdapter_.detach();
    if (this.richTextCodeMirror_)
      this.richTextCodeMirror_.detach();
  };

  Wildpad.prototype.setUserId = function(userId) {
    this.wilddogAdapter_.setUserId(userId);
  };

  Wildpad.prototype.setUserColor = function(color) {
    this.wilddogAdapter_.setColor(color);
  };

  Wildpad.prototype.getText = function() {
    this.assertReady_('getText');
    if (this.codeMirror_)
      return this.richTextCodeMirror_.getText();
    else
      return this.ace_.getSession().getDocument().getValue();
  };

  Wildpad.prototype.setText = function(textPieces) {
    this.assertReady_('setText');
    if (this.ace_) {
      return this.ace_.getSession().getDocument().setValue(textPieces);
    } else {
      // HACK: Hide CodeMirror during setText to prevent lots of extra renders.
      this.codeMirror_.getWrapperElement().setAttribute('style', 'display: none');
      this.codeMirror_.setValue("");
      this.insertText(0, textPieces);
      this.codeMirror_.getWrapperElement().setAttribute('style', '');
      this.codeMirror_.refresh();
    }
    this.editorAdapter_.setCursor({position: 0, selectionEnd: 0});
  };

  Wildpad.prototype.insertTextAtCursor = function(textPieces) {
    this.insertText(this.codeMirror_.indexFromPos(this.codeMirror_.getCursor()), textPieces);
  };

  Wildpad.prototype.insertText = function(index, textPieces) {
    utils.assert(!this.ace_, "Not supported for ace yet.");
    this.assertReady_('insertText');

    // Wrap it in an array if it's not already.
    if(Object.prototype.toString.call(textPieces) !== '[object Array]') {
      textPieces = [textPieces];
    }

    // TODO: Batch this all into a single operation.
    // HACK: We should check if we're actually at the beginning of a line; but checking for index == 0 is sufficient
    // for the setText() case.
    var atNewLine = index === 0;
    var inserts = wildpad.textPiecesToInserts(atNewLine, textPieces);

    for (var i = 0; i < inserts.length; i++) {
      var string     = inserts[i].string;
      var attributes = inserts[i].attributes;
      this.richTextCodeMirror_.insertText(index, string, attributes);
      index += string.length;
    }
  };

  Wildpad.prototype.getOperationForSpan = function(start, end) {
    var text = this.richTextCodeMirror_.getRange(start, end);
    var spans = this.richTextCodeMirror_.getAttributeSpans(start, end);
    var pos = 0;
    var op = new wildpad.TextOperation();
    for(var i = 0; i < spans.length; i++) {
      op.insert(text.substr(pos, spans[i].length), spans[i].attributes);
      pos += spans[i].length;
    }
    return op;
  };

  Wildpad.prototype.getHtml = function() {
    return this.getHtmlFromRange(null, null);
  };

  Wildpad.prototype.getHtmlFromSelection = function() {
    var startPos = this.codeMirror_.getCursor('start'), endPos = this.codeMirror_.getCursor('end');
    var startIndex = this.codeMirror_.indexFromPos(startPos), endIndex = this.codeMirror_.indexFromPos(endPos);
    return this.getHtmlFromRange(startIndex, endIndex);
  };

  Wildpad.prototype.getHtmlFromRange = function(start, end) {
    this.assertReady_('getHtmlFromRange');
    var doc = (start != null && end != null) ?
      this.getOperationForSpan(start, end) :
      this.getOperationForSpan(0, this.codeMirror_.getValue().length);
    return wildpad.SerializeHtml(doc, this.entityManager_);
  };

  Wildpad.prototype.insertHtml = function (index, html) {
    var lines = wildpad.ParseHtml(html, this.entityManager_);
    this.insertText(index, lines);
  };

  Wildpad.prototype.insertHtmlAtCursor = function (html) {
    this.insertHtml(this.codeMirror_.indexFromPos(this.codeMirror_.getCursor()), html);
  };

  Wildpad.prototype.setHtml = function (html) {
    var lines = wildpad.ParseHtml(html, this.entityManager_);
    this.setText(lines);
  };

  Wildpad.prototype.isHistoryEmpty = function() {
    this.assertReady_('isHistoryEmpty');
    return this.wilddogAdapter_.isHistoryEmpty();
  };

  Wildpad.prototype.bold = function() {
    this.richTextCodeMirror_.toggleAttribute(ATTR.BOLD);
    this.codeMirror_.focus();
  };

  Wildpad.prototype.italic = function() {
    this.richTextCodeMirror_.toggleAttribute(ATTR.ITALIC);
    this.codeMirror_.focus();
  };

  Wildpad.prototype.underline = function() {
    this.richTextCodeMirror_.toggleAttribute(ATTR.UNDERLINE);
    this.codeMirror_.focus();
  };

  Wildpad.prototype.strike = function() {
    this.richTextCodeMirror_.toggleAttribute(ATTR.STRIKE);
    this.codeMirror_.focus();
  };

  Wildpad.prototype.fontSize = function(size) {
    this.richTextCodeMirror_.setAttribute(ATTR.FONT_SIZE, size);
    this.codeMirror_.focus();
  };

  Wildpad.prototype.font = function(font) {
    this.richTextCodeMirror_.setAttribute(ATTR.FONT, font);
    this.codeMirror_.focus();
  };

  Wildpad.prototype.color = function(color) {
    this.richTextCodeMirror_.setAttribute(ATTR.COLOR, color);
    this.codeMirror_.focus();
  };

  Wildpad.prototype.highlight = function() {
    this.richTextCodeMirror_.toggleAttribute(ATTR.BACKGROUND_COLOR, 'rgba(255,255,0,.65)');
    this.codeMirror_.focus();
  };

  Wildpad.prototype.align = function(alignment) {
    if (alignment !== 'left' && alignment !== 'center' && alignment !== 'right') {
      throw new Error('align() must be passed "left", "center", or "right".');
    }
    this.richTextCodeMirror_.setLineAttribute(ATTR.LINE_ALIGN, alignment);
    this.codeMirror_.focus();
  };

  Wildpad.prototype.orderedList = function() {
    this.richTextCodeMirror_.toggleLineAttribute(ATTR.LIST_TYPE, 'o');
    this.codeMirror_.focus();
  };

  Wildpad.prototype.unorderedList = function() {
    this.richTextCodeMirror_.toggleLineAttribute(ATTR.LIST_TYPE, 'u');
    this.codeMirror_.focus();
  };

  Wildpad.prototype.todo = function() {
    this.richTextCodeMirror_.toggleTodo();
    this.codeMirror_.focus();
  };

  Wildpad.prototype.newline = function() {
    this.richTextCodeMirror_.newline();
  };

  Wildpad.prototype.deleteLeft = function() {
    this.richTextCodeMirror_.deleteLeft();
  };

  Wildpad.prototype.deleteRight = function() {
    this.richTextCodeMirror_.deleteRight();
  };

  Wildpad.prototype.indent = function() {
    this.richTextCodeMirror_.indent();
    this.codeMirror_.focus();
  };

  Wildpad.prototype.unindent = function() {
    this.richTextCodeMirror_.unindent();
    this.codeMirror_.focus();
  };

  Wildpad.prototype.undo = function() {
    this.codeMirror_.undo();
  };

  Wildpad.prototype.redo = function() {
    this.codeMirror_.redo();
  };

  Wildpad.prototype.insertEntity = function(type, info, origin) {
    this.richTextCodeMirror_.insertEntityAtCursor(type, info, origin);
  };

  Wildpad.prototype.insertEntityAt = function(index, type, info, origin) {
    this.richTextCodeMirror_.insertEntityAt(index, type, info, origin);
  };

  Wildpad.prototype.registerEntity = function(type, options) {
    this.entityManager_.register(type, options);
  };

  Wildpad.prototype.getOption = function(option, def) {
    return (option in this.options_) ? this.options_[option] : def;
  };

  Wildpad.prototype.assertReady_ = function(funcName) {
    if (!this.ready_) {
      throw new Error('You must wait for the "ready" event before calling ' + funcName + '.');
    }
    if (this.zombie_) {
      throw new Error('You can\'t use a Wildpad after calling dispose()!  [called ' + funcName + ']');
    }
  };

  Wildpad.prototype.makeImageDialog_ = function() {
    this.makeDialog_('img', 'Insert image url');
  };

  Wildpad.prototype.makeDialog_ = function(id, placeholder) {
   var self = this;

   var hideDialog = function() {
     var dialog = document.getElementById('overlay');
     dialog.style.visibility = "hidden";
     self.wildpadWrapper_.removeChild(dialog);
   };

   var cb = function() {
     var dialog = document.getElementById('overlay');
     dialog.style.visibility = "hidden";
     var src = document.getElementById(id).value;
     if (src !== null)
       self.insertEntity(id, { 'src': src });
     self.wildpadWrapper_.removeChild(dialog);
   };

   var input = utils.elt('input', null, { 'class':'wildpad-dialog-input', 'id':id, 'type':'text', 'placeholder':placeholder, 'autofocus':'autofocus' });

   var submit = utils.elt('a', 'Submit', { 'class': 'wildpad-btn', 'id':'submitbtn' });
   utils.on(submit, 'click', utils.stopEventAnd(cb));

   var cancel = utils.elt('a', 'Cancel', { 'class': 'wildpad-btn' });
   utils.on(cancel, 'click', utils.stopEventAnd(hideDialog));

   var buttonsdiv = utils.elt('div', [submit, cancel], { 'class':'wildpad-btn-group' });

   var div = utils.elt('div', [input, buttonsdiv], { 'class':'wildpad-dialog-div' });
   var dialog = utils.elt('div', [div], { 'class': 'wildpad-dialog', id:'overlay' });

   this.wildpadWrapper_.appendChild(dialog);
  };

  Wildpad.prototype.addToolbar_ = function() {
    this.toolbar = new RichTextToolbar(this.imageInsertionUI);

    this.toolbar.on('undo', this.undo, this);
    this.toolbar.on('redo', this.redo, this);
    this.toolbar.on('bold', this.bold, this);
    this.toolbar.on('italic', this.italic, this);
    this.toolbar.on('underline', this.underline, this);
    this.toolbar.on('strike', this.strike, this);
    this.toolbar.on('font-size', this.fontSize, this);
    this.toolbar.on('font', this.font, this);
    this.toolbar.on('color', this.color, this);
    this.toolbar.on('left', function() { this.align('left')}, this);
    this.toolbar.on('center', function() { this.align('center')}, this);
    this.toolbar.on('right', function() { this.align('right')}, this);
    this.toolbar.on('ordered-list', this.orderedList, this);
    this.toolbar.on('unordered-list', this.unorderedList, this);
    this.toolbar.on('todo-list', this.todo, this);
    this.toolbar.on('indent-increase', this.indent, this);
    this.toolbar.on('indent-decrease', this.unindent, this);
    this.toolbar.on('insert-image', this.makeImageDialog_, this);

    this.wildpadWrapper_.insertBefore(this.toolbar.element(), this.wildpadWrapper_.firstChild);
  };

  Wildpad.prototype.addPoweredByLogo_ = function() {
    var poweredBy = utils.elt('a', null, { 'class': 'powered-by-wildpad'} );
    poweredBy.setAttribute('href', 'http://www.wildpad.io/');
    poweredBy.setAttribute('target', '_blank');
    this.wildpadWrapper_.appendChild(poweredBy)
  };

  Wildpad.prototype.initializeKeyMap_ = function() {
    function binder(fn) {
      return function(cm) {
        // HACK: CodeMirror will often call our key handlers within a cm.operation(), and that
        // can mess us up (we rely on events being triggered synchronously when we make CodeMirror
        // edits).  So to escape any cm.operation(), we do a setTimeout.
        setTimeout(function() {
          fn.call(cm.wildpad);
        }, 0);
      }
    }

    CodeMirror.keyMap["richtext"] = {
      "Ctrl-B": binder(this.bold),
      "Cmd-B": binder(this.bold),
      "Ctrl-I": binder(this.italic),
      "Cmd-I": binder(this.italic),
      "Ctrl-U": binder(this.underline),
      "Cmd-U": binder(this.underline),
      "Ctrl-H": binder(this.highlight),
      "Cmd-H": binder(this.highlight),
      "Enter": binder(this.newline),
      "Delete": binder(this.deleteRight),
      "Backspace": binder(this.deleteLeft),
      "Tab": binder(this.indent),
      "Shift-Tab": binder(this.unindent),
      fallthrough: ['default']
    };
  };

  function colorFromUserId (userId) {
    var a = 1;
    for (var i = 0; i < userId.length; i++) {
      a = 17 * (a+userId.charCodeAt(i)) % 360;
    }
    var hue = a/360;

    return hsl2hex(hue, 1, 0.75);
  }

  function rgb2hex (r, g, b) {
    function digits (n) {
      var m = Math.round(255*n).toString(16);
      return m.length === 1 ? '0'+m : m;
    }
    return '#' + digits(r) + digits(g) + digits(b);
  }

  function hsl2hex (h, s, l) {
    if (s === 0) { return rgb2hex(l, l, l); }
    var var2 = l < 0.5 ? l * (1+s) : (l+s) - (s*l);
    var var1 = 2 * l - var2;
    var hue2rgb = function (hue) {
      if (hue < 0) { hue += 1; }
      if (hue > 1) { hue -= 1; }
      if (6*hue < 1) { return var1 + (var2-var1)*6*hue; }
      if (2*hue < 1) { return var2; }
      if (3*hue < 2) { return var1 + (var2-var1)*6*(2/3 - hue); }
      return var1;
    };
    return rgb2hex(hue2rgb(h+1/3), hue2rgb(h), hue2rgb(h-1/3));
  }

  return Wildpad;
})(this);

// Export Text classes
wildpad.Wildpad.Formatting = wildpad.Formatting;
wildpad.Wildpad.Text = wildpad.Text;
wildpad.Wildpad.Entity = wildpad.Entity;
wildpad.Wildpad.LineFormatting = wildpad.LineFormatting;
wildpad.Wildpad.Line = wildpad.Line;
wildpad.Wildpad.TextOperation = wildpad.TextOperation;
wildpad.Wildpad.Headless = wildpad.Headless;

// Export adapters
wildpad.Wildpad.RichTextCodeMirrorAdapter = wildpad.RichTextCodeMirrorAdapter;
wildpad.Wildpad.ACEAdapter = wildpad.ACEAdapter;
