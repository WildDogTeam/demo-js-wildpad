var wildpad = null, userList = null, codeMirror = null;

function joinWildpadForHash() {
  if (wildpad) {
    // Clean up.
    wildpad.dispose();
    userList.dispose();
    $('.CodeMirror').remove();
  }

  var id = window.location.hash.replace(/#(.*)#(.*)/g,'$1').replace(/#/g, '') || randomString(10);
  var url = window.location.toString().replace(/#.*/, '') + '#' + id;
  var wildpadRef = new Wilddog('https://wildpad.wilddogio.com/').child(id);
  window.location = url
  var userId = wildpadRef.push().key(); // Just a random ID.
  codeMirror = CodeMirror(document.getElementById('wildpad'), { lineWrapping: true });
  wildpad = Wildpad.fromCodeMirror(wildpadRef, codeMirror,
      { richTextToolbar: true, richTextShortcuts: true, userId: userId});
  userList = WildpadUserList.fromDiv(wildpadRef.child('users'),
      document.getElementById('wildpad-userlist'), userId);

  wildpad.on('ready', function() {
    if (wildpad.isHistoryEmpty()) {
      wildpad.setText('Welcome to your own private pad!\n\nShare the URL below and collaborate with your friends.');
    }
    ensurePadInList(id);
    buildPadList();
   });

  codeMirror.focus();

   $('#url').val(url);
   $("#url").on('click', function(e) {
    $(this).focus().select();
    e.preventDefault();
    return false;
  });
}

function padListEnabled() {
  return (typeof localStorage !== 'undefined' && typeof JSON !== 'undefined' && localStorage.setItem &&
      localStorage.getItem && JSON.parse && JSON.stringify);
}

function ensurePadInList(id) {
  if (!padListEnabled()) { return; }
  var list = JSON.parse(localStorage.getItem('demo-pad-list') || "{ }");
  if (!(id in list)) {
    var now = new Date();
    var year = now.getFullYear(), month = now.getMonth() + 1, day = now.getDate();
    var hours = now.getHours(), minutes = now.getMinutes();
    if (hours < 10) { hours = '0' + hours; }
    if (minutes < 10) { minutes = '0' + minutes; }

    list[id] = [year, month, day].join('/') + ' ' + hours + ':' + minutes;

    localStorage.setItem('demo-pad-list', JSON.stringify(list));
    buildPadList();
  }
}

function buildPadList() {
  if (!padListEnabled()) { return; }
  $('#my-pads-list').empty();

  var list = JSON.parse(localStorage.getItem('demo-pad-list') || '{ }');
  for(var id in list) {
    $('#my-pads-list').append(
        $('<div></div>').addClass('my-pads-item').append(
            makePadLink(id, list[id])
    ));
  }
}

function makePadLink(id, name) {
  return $('<a></a>')
      .text(name)
      .on('click', function() {
        window.location = window.location.toString().replace(/#.*/, '') + '#' + id;
        $('#my-pads-list').hide();
        return false;
  });
}

function randomString(length) {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for(var i=0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

$(window).on('ready', function() {
  joinWildpadForHash();
  setTimeout(function() {
    $(window).on('hashchange', joinWildpadForHash);
  }, 0);
});