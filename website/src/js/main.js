(function() {
  var ROOMS = 1;
  var OFFSET = 1; // Must be at least 1.
  var wildpad = null, codeMirror = null, userList = null;

  function joinWildpadForHash() {
    if (wildpad) {
      // Clean up.
      wildpad.dispose();
      userList.dispose();
      $('.CodeMirror').remove();
    }

    var room = Number(window.location.hash.replace(/#/g, ''));
    if (room < 1 || room >= OFFSET + ROOMS) {
      room = OFFSET + Math.floor(Math.random() * ROOMS);
    }

    var firebaseUrl = 'https://myoffice1.wilddogio.com/home/' + room;
    var wildpadRef = new Wilddog(firebaseUrl);

    codeMirror = CodeMirror(document.getElementById('wildpad'), { lineWrapping: true });
    var userId = wildpadRef.push().key(); // Just a random ID.
    wildpad = Wildpad.fromCodeMirror(wildpadRef, codeMirror,
                                     { richTextToolbar: true, richTextShortcuts: true, userId: userId, imageInsertionUI:false });

    var func = function() { wildpad.insertEntity('img', { 'src':'http://farm9.staticflickr.com/8076/8359513601_92c6653a5c_z.jpg' }) };

    var span = document.createElement('span');
    span.className = 'wildpad-tb-insert-image';
    var a = document.createElement('a');
    a.className = 'wildpad-btn';
    a.onclick = func;
    a.appendChild(span);
    var div = document.createElement('div');
    div.className = 'wildpad-btn-group';
    div.appendChild(a);

    document.getElementsByClassName('wildpad-toolbar-wrapper')[0].appendChild(div);

    userList = WildpadUserList.fromDiv(wildpadRef.child('users'),
        document.getElementById('wildpad-userlist'), userId);

    window.location = window.location.toString().replace(/#.*/, '') + '#' + room;

    codeMirror.focus();
  }

  $(document).on('ready', function() {
    joinWildpadForHash();
    setTimeout(function() {
      $(window).on('hashchange', joinWildpadForHash);
    },0);
  });
})();
