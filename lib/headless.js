var wildpad = wildpad || { };

/**
 * Instance of headless Wildpad for use in NodeJS. Supports get/set on text/html.
 */
wildpad.Headless = (function() {

  var TextOperation   = wildpad.TextOperation;
  var WilddogAdapter = wildpad.WilddogAdapter;
  var EntityManager   = wildpad.EntityManager;
  var ParseHtml       = wildpad.ParseHtml;

  function Headless(refOrPath) {
    // Allow calling without new.
    if (!(this instanceof Headless)) { return new Headless(refOrPath); }

    if (typeof refOrPath === 'string') {
      if (typeof Wilddog !== 'function') {
        var wilddog = require('wilddog');
      } else {
        var wilddog = Wilddog;
      }
      var ref = new wilddog(refOrPath);
    } else {
      var ref = refOrPath;
    }

    this.entityManager_  = new EntityManager();

    this.wilddogAdapter_ = new WilddogAdapter(ref);
    this.ready_ = false;
    this.zombie_ = false;
  }

  Headless.prototype.getDocument = function(callback) {
    var self = this;

    if (self.ready_) {
      return callback(self.wilddogAdapter_.getDocument());
    }

    self.wilddogAdapter_.on('ready', function() {
      self.ready_ = true;
      callback(self.wilddogAdapter_.getDocument());
    });
  }

  Headless.prototype.getText = function(callback) {
    if (this.zombie_) {
      throw new Error('You can\'t use a wildpad.Headless after calling dispose()!');
    }

    this.getDocument(function(doc) {
      var text = doc.apply('');

      // Strip out any special characters from Rich Text formatting
      for (key in wildpad.sentinelConstants) {
        text = text.replace(new RegExp(wildpad.sentinelConstants[key], 'g'), '');
      }
      callback(text);
    });
  }

  Headless.prototype.setText = function(text, callback) {
    if (this.zombie_) {
      throw new Error('You can\'t use a wildpad.Headless after calling dispose()!');
    }

    var op = TextOperation().insert(text);
    this.sendOperationWithRetry(op, callback);
  }

  Headless.prototype.initializeFakeDom = function(callback) {
    if (typeof document === 'object' || typeof wildpad.document === 'object') {
      callback();
    } else {
      require('jsdom').env('<head></head><body></body>', function(err, window) {
        if (wildpad.document) {
          // Return if we've already made a jsdom to avoid making more than one
          // This would be easier with promises but we want to avoid introducing
          // another dependency for just headless mode.
          window.close();
          return callback();
        }
        wildpad.document = window.document;
        callback();
      });
    }
  }

  Headless.prototype.getHtml = function(callback) {
    var self = this;

    if (this.zombie_) {
      throw new Error('You can\'t use a wildpad.Headless after calling dispose()!');
    }

    self.initializeFakeDom(function() {
      self.getDocument(function(doc) {
        callback(wildpad.SerializeHtml(doc, self.entityManager_));
      });
    });
  }

  Headless.prototype.setHtml = function(html, callback) {
    var self = this;

    if (this.zombie_) {
      throw new Error('You can\'t use a wildpad.Headless after calling dispose()!');
    }

    self.initializeFakeDom(function() {
      var textPieces = ParseHtml(html, self.entityManager_);
      var inserts    = wildpad.textPiecesToInserts(true, textPieces);
      var op         = new TextOperation();

      for (var i = 0; i < inserts.length; i++) {
        op.insert(inserts[i].string, inserts[i].attributes);
      }

      self.sendOperationWithRetry(op, callback);
    });
  }

  Headless.prototype.sendOperationWithRetry = function(operation, callback) {
    var self = this;

    self.getDocument(function(doc) {
      var op = operation.clone()['delete'](doc.targetLength);
      self.wilddogAdapter_.sendOperation(op, function(err, committed) {
        if (committed) {
          if (typeof callback !== "undefined") {
            callback(null, committed);
          }
        } else {
          self.sendOperationWithRetry(operation, callback);
        }
      });
    });
  }

  Headless.prototype.dispose = function() {
    this.zombie_ = true; // We've been disposed.  No longer valid to do anything.

    this.wilddogAdapter_.dispose();
  };

  return Headless;
})();
