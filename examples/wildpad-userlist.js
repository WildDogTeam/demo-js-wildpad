var WildpadUserList = (function() {
  function WildpadUserList(ref, place, userId, displayName) {
    if (!(this instanceof WildpadUserList)) {
      return new WildpadUserList(ref, place, userId, displayName);
    }

    this.ref_ = ref;
    this.userId_ = userId;
    this.place_ = place;
    this.wilddogCallbacks_ = [];

    var self = this;
    this.hasName_ = !!displayName;
    this.displayName_ = displayName || 'Guest ' + Math.floor(Math.random() * 1000);
    this.wilddogOn_(ref.root().child('.info/connected'), 'value', function(s) {
      if (s.val() === true && self.displayName_) {
        var nameRef = ref.child(self.userId_).child('name');
        nameRef.onDisconnect().remove();
        nameRef.set(self.displayName_);
      }
    });

    this.userList_ = this.makeUserList_()
    place.appendChild(this.userList_);
  }

  // This is the primary "constructor" for symmetry with Wildpad.
  WildpadUserList.fromDiv = WildpadUserList;

  WildpadUserList.prototype.dispose = function() {
    this.removeFirebaseCallbacks_();
    this.ref_.child(this.userId_).child('name').remove();

    this.place_.removeChild(this.userList_);
  };

  WildpadUserList.prototype.makeUserList_ = function() {
    return elt('div', [
      this.makeHeading_(),
      elt('div', [
        this.makeUserEntryForSelf_(),
        this.makeUserEntriesForOthers_()
      ], {'class': 'wildpad-userlist-users' })
    ], {'class': 'wildpad-userlist' });
  };

  WildpadUserList.prototype.makeHeading_ = function() {
    var counterSpan = elt('span', '0');
    this.wilddogOn_(this.ref_, 'value', function(usersSnapshot) {
      setTextContent(counterSpan, "" + usersSnapshot.numChildren());
    });

    return elt('div', [
      elt('span', 'ONLINE ('),
      counterSpan,
      elt('span', ')')
    ], { 'class': 'wildpad-userlist-heading' });
  };

  WildpadUserList.prototype.makeUserEntryForSelf_ = function() {
    var myUserRef = this.ref_.child(this.userId_);

    var colorDiv = elt('div', null, { 'class': 'wildpad-userlist-color-indicator' });
    this.wilddogOn_(myUserRef.child('color'), 'value', function(colorSnapshot) {
      var color = colorSnapshot.val();
      if (isValidColor(color)) {
        colorDiv.style.backgroundColor = color;
      }
    });

    var nameInput = elt('input', null, { type: 'text', 'class': 'wildpad-userlist-name-input'} );
    nameInput.value = this.displayName_;

    var nameHint = elt('div', 'ENTER YOUR NAME', { 'class': 'wildpad-userlist-name-hint'} );
    if (this.hasName_) nameHint.style.display = 'none';

    // Update Firebase when name changes.
    var self = this;
    on(nameInput, 'change', function(e) {
      var name = nameInput.value || "Guest " + Math.floor(Math.random() * 1000);
      myUserRef.child('name').onDisconnect().remove();
      myUserRef.child('name').set(name);
      nameHint.style.display = 'none';
      nameInput.blur();
      self.displayName_ = name;
      stopEvent(e);
    });

    var nameDiv = elt('div', [nameInput, nameHint]);

    return elt('div', [ colorDiv, nameDiv ], {
      'class': 'wildpad-userlist-user ' + 'wildpad-user-' + this.userId_
    });
  };

  WildpadUserList.prototype.makeUserEntriesForOthers_ = function() {
    var self = this;
    var userList = elt('div');
    var userId2Element = { };

    function updateChild(userSnapshot, prevChildName) {
      var userId = userSnapshot.key();
      var div = userId2Element[userId];
      if (div) {
        userList.removeChild(div);
        delete userId2Element[userId];
      }
      var name = userSnapshot.child('name').val();
      if (typeof name !== 'string') { name = 'Guest'; }
      name = name.substring(0, 20);

      var color = userSnapshot.child('color').val();
      if (!isValidColor(color)) {
        color = "#ffb"
      }

      var colorDiv = elt('div', null, { 'class': 'wildpad-userlist-color-indicator' });
      colorDiv.style.backgroundColor = color;

      var nameDiv = elt('div', name || 'Guest', { 'class': 'wildpad-userlist-name' });

      var userDiv = elt('div', [ colorDiv, nameDiv ], {
        'class': 'wildpad-userlist-user ' + 'wildpad-user-' + userId
      });
      userId2Element[userId] = userDiv;

      if (userId === self.userId_) {
        // HACK: We go ahead and insert ourself in the DOM, so we can easily order other users against it.
        // But don't show it.
        userDiv.style.display = 'none';
      }

      var nextElement =  prevChildName ? userId2Element[prevChildName].nextSibling : userList.firstChild;
      userList.insertBefore(userDiv, nextElement);
    }

    this.wilddogOn_(this.ref_, 'child_added', updateChild);
    this.wilddogOn_(this.ref_, 'child_changed', updateChild);
    this.wilddogOn_(this.ref_, 'child_moved', updateChild);
    this.wilddogOn_(this.ref_, 'child_removed', function(removedSnapshot) {
      var userId = removedSnapshot.key();
      var div = userId2Element[userId];
      if (div) {
        userList.removeChild(div);
        delete userId2Element[userId];
      }
    });

    return userList;
  };

  WildpadUserList.prototype.wilddogOn_ = function(ref, eventType, callback, context) {
    this.wilddogCallbacks_.push({ref: ref, eventType: eventType, callback: callback, context: context });
    ref.on(eventType, callback, context);
    return callback;
  };

  WildpadUserList.prototype.wilddogOff_ = function(ref, eventType, callback, context) {
    ref.off(eventType, callback, context);
    for(var i = 0; i < this.wilddogCallbacks_.length; i++) {
      var l = this.wilddogCallbacks_[i];
      if (l.ref === ref && l.eventType === eventType && l.callback === callback && l.context === context) {
        this.wilddogCallbacks_.splice(i, 1);
        break;
      }
    }
  };

  WildpadUserList.prototype.removeFirebaseCallbacks_ = function() {
    for(var i = 0; i < this.wilddogCallbacks_.length; i++) {
      var l = this.wilddogCallbacks_[i];
      l.ref.off(l.eventType, l.callback, l.context);
    }
    this.wilddogCallbacks_ = [];
  };

  /** Assorted helpers */

  function isValidColor(color) {
    return typeof color === 'string' &&
      (color.match(/^#[a-fA-F0-9]{3,6}$/) || color == 'transparent');
  }


  /** DOM helpers */
  function elt(tag, content, attrs) {
    var e = document.createElement(tag);
    if (typeof content === "string") {
      setTextContent(e, content);
    } else if (content) {
      for (var i = 0; i < content.length; ++i) { e.appendChild(content[i]); }
    }
    for(var attr in (attrs || { })) {
      e.setAttribute(attr, attrs[attr]);
    }
    return e;
  }

  function setTextContent(e, str) {
    e.innerHTML = "";
    e.appendChild(document.createTextNode(str));
  }

  function on(emitter, type, f) {
    if (emitter.addEventListener) {
      emitter.addEventListener(type, f, false);
    } else if (emitter.attachEvent) {
      emitter.attachEvent("on" + type, f);
    }
  }

  function off(emitter, type, f) {
    if (emitter.removeEventListener) {
      emitter.removeEventListener(type, f, false);
    } else if (emitter.detachEvent) {
      emitter.detachEvent("on" + type, f);
    }
  }

  function preventDefault(e) {
    if (e.preventDefault) {
      e.preventDefault();
    } else {
      e.returnValue = false;
    }
  }

  function stopPropagation(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    } else {
      e.cancelBubble = true;
    }
  }

  function stopEvent(e) {
    preventDefault(e);
    stopPropagation(e);
  }

  return WildpadUserList;
})();
