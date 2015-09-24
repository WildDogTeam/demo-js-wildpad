# Wildpad
[Wildpad](http://wildpad.wilddogapp.com/)是一个开源的协同文本编辑器，它可以嵌入到较大的应用中

## 实例

可以参考[wilddog demo](http://wildpad.wilddogapp.com/demo) 

[![一个demo页面的快照](screenshot.png)](http://wildpad.wilddogapp.com/demo/)

## 步骤
Wildpad 使用 [Wilddog](https://www.wilddog.com)提供后端服务，因此它不需要后端的支持，只需要引入少量的
js文件，就可以把它嵌入到你的应用中。

```HTML
<!-- Wilddog -->
<script src='https://cdn.wilddog.com/js/client/current/wilddog.js'></script>

<!-- CodeMirror -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.2.0/codemirror.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.2.0/codemirror.css"/>

<!-- Wildpad -->
<link rel="stylesheet" href="https://cdn.wilddog.com/app/wildpad/0.1/wildpad.css" />
<script src="https://cdn.wilddog.com/app/wildpad/0.1/wildpad.js"></script>
```

```HTML
<div id="wildpad"></div>
<script>
  var wildpadRef = new Wilddog('<WILDDOG URL>');
  var codeMirror = CodeMirror(document.getElementById('wildpad'), { lineWrapping: true });
  var wildpad = Wildpad.fromCodeMirror(wildpadRef, codeMirror,
      { richTextShortcuts: true, richTextToolbar: true, defaultText: 'Hello, World!' });
</script>
```
野狗支持使用 [CodeMirror](http://codemirror.net/)和[ACE](http://ace.c9.io/)作为基础编辑器，可以参考
[wildpad文档](http://wildpad.wilddogapp.com/docs)。

### 内容

* `dist/` - grunt文件合并路径 (`wildpad.js`, `wildpad.min.js`, `wildpad.css`, `wildpad.eot`).
* `examples/` - 一些嵌入Wildpad的例子.
* `font/` - 工具栏的图标和字体.
* `lib/`
    * `wildpad.js` 
    * `text-operation.js`, `client.js`
    * `annotation-list.js`
    * `rich-text-codemirror.js`
    * `wilddog-adapter.js` 

## 入门

Wildpad使用野狗数据库，你可以从这里
[注册](https://www.wilddog.com/my-account/signup)一个免费体验账号。

