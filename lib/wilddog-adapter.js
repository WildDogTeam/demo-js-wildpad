var wildpad = wildpad || { };

wildpad.WilddogAdapter = (function (global) {

  if (typeof require === 'function' && typeof Wilddog !== 'function') {
    Wilddog = require('wilddog');
  }

  var TextOperation = wildpad.TextOperation;
  var utils = wildpad.utils;

  // Save a checkpoint every 100 edits.
  var CHECKPOINT_FREQUENCY = 100;

  function WilddogAdapter (ref, userId, userColor) {
    this.ref_ = ref;
    this.ready_ = false;
    this.wilddogCallbacks_ = [];
    this.zombie_ = false;

    // We store the current document state as a TextOperation so we can write checkpoints to Wilddog occasionally.
    // TODO: Consider more efficient ways to do this. (composing text operations is ~linear in the length of the document).
    this.document_ = new TextOperation();

    // The next expected revision.
    this.revision_ = 0;

    // This is used for two purposes:
    // 1) On initialization, we fill this with the latest checkpoint and any subsequent operations and then
    //      process them all together.
    // 2) If we ever receive revisions out-of-order (e.g. rev 5 before rev 4), we queue them here until it's time
    //    for them to be handled. [this should never happen with well-behaved clients; but if it /does/ happen we want
    //    to handle it gracefully.]
    this.pendingReceivedRevisions_ = { };

    var self = this;

    if (userId) {
      this.setUserId(userId);
      this.setColor(userColor);

      this.wilddogOn_(ref.root().child('.info/connected'), 'value', function(snapshot) {
        if (snapshot.val() === true) {
          self.initializeUserData_();
        }
      }, this);

      // Once we're initialized, start tracking users' cursors.
      this.on('ready', function() {
        self.monitorCursors_();
      });
    } else {
      this.userId_ = ref.push().key();
    }

    // Avoid triggering any events until our callers have had a chance to attach their listeners.
    setTimeout(function() {
      self.monitorHistory_();
    }, 0);

  }
  utils.makeEventEmitter(WilddogAdapter, ['ready', 'cursor', 'operation', 'ack', 'retry']);

  WilddogAdapter.prototype.dispose = function() {
    var self = this;

    if (!this.ready_) {
      // TODO: this completes loading the text even though we're no longer interested in it.
      this.on('ready', function() {
  self.dispose();
      });
      return;
    }

    this.removeWilddogCallbacks_();

    if (this.userRef_) {
      this.userRef_.child('cursor').remove();
      this.userRef_.child('color').remove();
    }

    this.ref_ = null;
    this.document_ = null;
    this.zombie_ = true;
  };

  WilddogAdapter.prototype.setUserId = function(userId) {
    if (this.userRef_) {
      // Clean up existing data.  Avoid nuking another user's data
      // (if a future user takes our old name).
      this.userRef_.child('cursor').remove();
      this.userRef_.child('cursor').onDisconnect().cancel();
      this.userRef_.child('color').remove();
      this.userRef_.child('color').onDisconnect().cancel();
    }

    this.userId_ = userId;
    this.userRef_ = this.ref_.child('users').child(userId);

    this.initializeUserData_();
  };

  WilddogAdapter.prototype.isHistoryEmpty = function() {
    assert(this.ready_, "Not ready yet.");
    return this.revision_ === 0;
  };

  /*
   * Send operation, retrying on connection failure. Takes an optional callback with signature:
   * function(error, committed).
   * An exception will be thrown on transaction failure, which should only happen on
   * catastrophic failure like a security rule violation.
   */
  WilddogAdapter.prototype.sendOperation = function (operation, callback) {
    var self = this;

    // If we're not ready yet, do nothing right now, and trigger a retry when we're ready.
    if (!this.ready_) {
      this.on('ready', function() {
        self.trigger('retry');
      });
      return;
    }

    // Sanity check that this operation is valid.
    assert(this.document_.targetLength === operation.baseLength, "sendOperation() called with invalid operation.");

    // Convert revision into an id that will sort properly lexicographically.
    var revisionId = revisionToId(this.revision_);

    function doTransaction(revisionId, revisionData) {

      self.ref_.child('history').child(revisionId).transaction(function(current) {
        if (current === null) {
          return revisionData;
        }
      }, function(error, committed, snapshot) {
        if (error) {
          if (error.message === 'disconnect') {
            if (self.sent_ && self.sent_.id === revisionId) {
              // We haven't seen our transaction succeed or fail.  Send it again.
              setTimeout(function() {
                doTransaction(revisionId, revisionData);
              }, 0);
            } else if (callback) {
              callback(error, false);
            }
          } else {
            utils.log('Transaction failure!', error);
            throw error;
          }
        } else {
          if (callback) callback(null, committed);
        }
      }, /*applyLocally=*/false);
    }

    this.sent_ = { id: revisionId, op: operation };
    doTransaction(revisionId, { a: self.userId_, o: operation.toJSON(), t: Wilddog.ServerValue.TIMESTAMP });
  };

  WilddogAdapter.prototype.sendCursor = function (obj) {
    this.userRef_.child('cursor').set(obj);
    this.cursor_ = obj;
  };

  WilddogAdapter.prototype.setColor = function(color) {
    this.userRef_.child('color').set(color);
    this.color_ = color;
  };

  WilddogAdapter.prototype.getDocument = function() {
    return this.document_;
  };

  WilddogAdapter.prototype.registerCallbacks = function(callbacks) {
    for (var eventType in callbacks) {
      this.on(eventType, callbacks[eventType]);
    }
  };

  WilddogAdapter.prototype.initializeUserData_ = function() {
    this.userRef_.child('cursor').onDisconnect().remove();
    this.userRef_.child('color').onDisconnect().remove();

    this.sendCursor(this.cursor_ || null);
    this.setColor(this.color_ || null);
  };

  WilddogAdapter.prototype.monitorCursors_ = function() {
    var usersRef = this.ref_.child('users'), self = this;

    function childChanged(childSnap) {
      var userId = childSnap.key();
      var userData = childSnap.val();
      self.trigger('cursor', userId, userData.cursor, userData.color);
    }

    this.wilddogOn_(usersRef, 'child_added', childChanged);
    this.wilddogOn_(usersRef, 'child_changed', childChanged);

    this.wilddogOn_(usersRef, 'child_removed', function(childSnap) {
      var userId = childSnap.key();
      self.trigger('cursor', userId, null);
    });
  };

  WilddogAdapter.prototype.monitorHistory_ = function() {
    var self = this;
    // Get the latest checkpoint as a starting point so we don't have to re-play entire history.
    this.ref_.child('checkpoint').once('value', function(s) {
      if (self.zombie_) { return; } // just in case we were cleaned up before we got the checkpoint data.
      var revisionId = s.child('id').val(),  op = s.child('o').val(), author = s.child('a').val();
      if (op != null && revisionId != null && author !== null) {
        self.pendingReceivedRevisions_[revisionId] = { o: op, a: author };
        self.checkpointRevision_ = revisionFromId(revisionId);
        self.monitorHistoryStartingAt_(self.checkpointRevision_ + 1);
      } else {
        self.checkpointRevision_ = 0;
        self.monitorHistoryStartingAt_(self.checkpointRevision_);
      }
    });
  };

  WilddogAdapter.prototype.monitorHistoryStartingAt_ = function(revision) {
    var historyRef = this.ref_.child('history').startAt(null, revisionToId(revision));
    var self = this;

    setTimeout(function() {
      self.wilddogOn_(historyRef, 'child_added', function(revisionSnapshot) {
        var revisionId = revisionSnapshot.key();
        self.pendingReceivedRevisions_[revisionId] = revisionSnapshot.val();
        if (self.ready_) {
          self.handlePendingReceivedRevisions_();
        }
      });

      historyRef.once('value', function() {
        self.handleInitialRevisions_();
      });
    }, 0);
  };

  WilddogAdapter.prototype.handleInitialRevisions_ = function() {
    assert(!this.ready_, "Should not be called multiple times.");

    // Compose the checkpoint and all subsequent revisions into a single operation to apply at once.
    this.revision_ = this.checkpointRevision_;
    var revisionId = revisionToId(this.revision_), pending = this.pendingReceivedRevisions_;
    while (pending[revisionId] != null) {
      var revision = this.parseRevision_(pending[revisionId]);
      if (!revision) {
        // If a misbehaved client adds a bad operation, just ignore it.
        utils.log('Invalid operation.', this.ref_.toString(), revisionId, pending[revisionId]);
      } else {
        this.document_ = this.document_.compose(revision.operation);
      }

      delete pending[revisionId];
      this.revision_++;
      revisionId = revisionToId(this.revision_);
    }

    this.trigger('operation', this.document_);

    this.ready_ = true;
    var self = this;
    setTimeout(function() {
      self.trigger('ready');
    }, 0);
  };

  WilddogAdapter.prototype.handlePendingReceivedRevisions_ = function() {
    var pending = this.pendingReceivedRevisions_;
    var revisionId = revisionToId(this.revision_);
    var triggerRetry = false;
    while (pending[revisionId] != null) {
      this.revision_++;

      var revision = this.parseRevision_(pending[revisionId]);
      if (!revision) {
        // If a misbehaved client adds a bad operation, just ignore it.
        utils.log('Invalid operation.', this.ref_.toString(), revisionId, pending[revisionId]);
      } else {
        this.document_ = this.document_.compose(revision.operation);
        if (this.sent_ && revisionId === this.sent_.id) {
          // We have an outstanding change at this revision id.
          if (this.sent_.op.equals(revision.operation) && revision.author === this.userId_) {
            // This is our change; it succeeded.
            if (this.revision_ % CHECKPOINT_FREQUENCY === 0) {
              this.saveCheckpoint_();
            }
            this.sent_ = null;
            this.trigger('ack');
          } else {
            // our op failed.  Trigger a retry after we're done catching up on any incoming ops.
            triggerRetry = true;
            this.trigger('operation', revision.operation);
          }
        } else {
          this.trigger('operation', revision.operation);
        }
      }
      delete pending[revisionId];

      revisionId = revisionToId(this.revision_);
    }

    if (triggerRetry) {
      this.sent_ = null;
      this.trigger('retry');
    }
  };

  WilddogAdapter.prototype.parseRevision_ = function(data) {
    // We could do some of this validation via security rules.  But it's nice to be robust, just in case.
    if (typeof data !== 'object') { return null; }
    if (typeof data.a !== 'string' || typeof data.o !== 'object') { return null; }
    var op = null;
    try {
      op = TextOperation.fromJSON(data.o);
    }
    catch (e) {
      return null;
    }

    if (op.baseLength !== this.document_.targetLength) {
      return null;
    }
    return { author: data.a, operation: op }
  };

  WilddogAdapter.prototype.saveCheckpoint_ = function() {
    this.ref_.child('checkpoint').set({
      a: this.userId_,
      o: this.document_.toJSON(),
      id: revisionToId(this.revision_ - 1) // use the id for the revision we just wrote.
    });
  };

  WilddogAdapter.prototype.wilddogOn_ = function(ref, eventType, callback, context) {
    this.wilddogCallbacks_.push({ref: ref, eventType: eventType, callback: callback, context: context });
    ref.on(eventType, callback, context);
    return callback;
  };

  WilddogAdapter.prototype.wilddogOff_ = function(ref, eventType, callback, context) {
    ref.off(eventType, callback, context);
    for(var i = 0; i < this.wilddogCallbacks_.length; i++) {
      var l = this.wilddogCallbacks_[i];
      if (l.ref === ref && l.eventType === eventType && l.callback === callback && l.context === context) {
        this.wilddogCallbacks_.splice(i, 1);
        break;
      }
    }
  };

  WilddogAdapter.prototype.removeWilddogCallbacks_ = function() {
    for(var i = 0; i < this.wilddogCallbacks_.length; i++) {
      var l = this.wilddogCallbacks_[i];
      l.ref.off(l.eventType, l.callback, l.context);
    }
    this.wilddogCallbacks_ = [];
  };

  // Throws an error if the first argument is falsy. Useful for debugging.
  function assert (b, msg) {
    if (!b) {
      throw new Error(msg || "assertion error");
    }
  }

  // Based off ideas from http://www.zanopha.com/docs/elen.pdf
  var characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  function revisionToId(revision) {
    if (revision === 0) {
      return 'A0';
    }

    var str = '';
    while (revision > 0) {
      var digit = (revision % characters.length);
      str = characters[digit] + str;
      revision -= digit;
      revision /= characters.length;
    }

    // Prefix with length (starting at 'A' for length 1) to ensure the id's sort lexicographically.
    var prefix = characters[str.length + 9];
    return prefix + str;
  }

  function revisionFromId(revisionId) {
    assert (revisionId.length > 0 && revisionId[0] === characters[revisionId.length + 8]);
    var revision = 0;
    for(var i = 1; i < revisionId.length; i++) {
      revision *= characters.length;
      revision += characters.indexOf(revisionId[i]);
    }
    return revision;
  }

  return WilddogAdapter;
}());
