---
layout: docs
---

<a name="getting_started"> </a>

# 1. 入门

Wildpad旨在被嵌入到更大的应用程序中。得力于[野狗](https://www.wilddog.com/)的无后端服务,n无需编写服务端的代码,你只需要引入javascript文件就能将wildpad嵌入到任何应用程序中,
下面解释该怎么做。

Wildpad是基于CodeMirror编辑器开发的,当然如果你更喜欢ACE,可以直接跳过本段到[Getting Started with Ace](#getting_started_with_ace)。

<a name="getting_started_with_codemirror"> </a>
## CodeMirror入门

### 注册野狗

为了将wildpad嵌入到你的应用中,你必须首先<a href="https://www.wilddog.com/my-account/signup" target="_blank">注册野狗账号</a>,然后创建一个应用，下面的步骤将会用到这个唯一的wilddog url。


### 添加依赖

将Wilddog,CodeMirror,WildPad引入到&lt;head&gt中。

{% highlight html %}
<!-- Wilddog -->
<script src='https://cdn.wilddog.com/js/client/current/wilddog.js'></script>

<!-- CodeMirror -->
<script src="https://dl.wdstatic.cn/cloudflare/ajax/libs/codemirror/5.2.0/codemirror.js"></script>
<link rel="stylesheet" href="https://dl.wdstatic.cn/cloudflare/ajax/libs/codemirror/5.2.0/codemirror.css" />

<!-- Wildpad -->
<link rel="stylesheet" href="https://cdn.wilddog.com/app/wildpad/0.1/wildpad.css" />
<script src="https://cdn.wilddog.com/app/wildpad/0.1/wildpad.js"></script>
{% endhighlight %}


### 初始化wildpad

为了能创建一个Wildpad，你首先得初始化Wilddog,CodeMirror和Wildpad，下面是一个典型的初始化过程:

{% highlight html %}
<div id="wildpad"></div>
<script>
  var wildpadRef = new Wilddog('<WILDDOG URL>');
  var codeMirror = CodeMirror(document.getElementById('wildpad'), { lineWrapping: true });
  var wildpad = Wildpad.fromCodeMirror(wildpadRef, codeMirror,
      { richTextShortcuts: true, richTextToolbar: true, defaultText: 'Hello, World!' });
</script>
{% endhighlight %}

确保将`<WILDDOG_URL>`替换成你自己的wilddog url地址。你也可以很容易的根据不同的url创建不同wildpad。

### 自定义编辑器

了解详细的`Wildpad.fromCodeMirror()`的方法和事件，可以参考下面的API章节，你可以参考[codemirror.net](http://codemirror.net/)
文档API来定制化编辑器(显示行号，语法高亮)

如果想设置wildpad的大小和显示位置,你可以写一些自定义样式或覆盖wildpad的样式，例如:

{% highlight css %}
.wildpad {
  width: 700px;
  height: 450px;
  background-color: #f62; /* dark orange background */
}
.CodeMirror {
  background-color: #f62;
}
{% endhighlight %}

工具栏和其它的方面的特性也可以定制，可以参考wildpad.css。

<div class="emphasis-box">Wildpad同样适合编写markdown，代码，和其它任何文件，你可以参考
<a href="../examples/">examples page</a> 获得更多的例子</div>



<a name="getting_started_with_ace"> </a>

## Ace入门

利用Ace作为底层编辑器，请参考以下步骤，但是它不支持富文本编辑，如果你想要使用富文本编辑器，可以转到[Getting Started with CodeMirror](#getting_started_with_codemirror)。

### 注册野狗

为了将wildpad嵌入到你的应用中,你必须首先<a href="https://www.wilddog.com/my-account/signup" target="_blank">注册野狗账号</a>,然后创建一个应用，下面的步骤将会用到这个唯一的wilddog url。


### 添加依赖

将Wilddog,Ace,WildPad引入到&lt;head&gt中。

{% highlight html %}
<!-- Wilddog -->
<script src="https://cdn.wilddog.com/js/client/current/wilddog.js"></script>

<!-- ACE -->
<script src="https://dl.wdstatic.cn/cloudflare/ajax/libs/ace/1.1.3/ace.js"></script>

<!-- Wildpad -->
<link rel="stylesheet" href="https://cdn.wilddog.com/app/wildpad/0.1/wildpad.css" />
<script src="https://cdn.wilddog.com/app/wildpad/0.1/wildpad.js"></script>
{% endhighlight %}


### 初始化Wildpad

为了能创建一个Wildpad，你首先得初始化Wilddog,CodeMirror和Wildpad，下面是一个Ace典型的初始化过程:

{% highlight html %}
<div id="wildpad"></div>
<script>
  var wilddogRef = new Wilddog('<WILDDOG URL>');
  var editor = ace.edit('wildpad');
  var wildpad = Wildpad.fromACE(wilddogRef, editor);
</script>
{% endhighlight %}

确保将`<WILDDOG_URL>`替换成你自己的wilddog url地址。你也可以很容易的根据不同的url创建不同wildpad。


### 自定义编辑器

了解详细的`Wilddog.fromACE()`的方法和事件，可以参考下面的API章节，你可以参考[Ace] (http://ace.c9.io/)
文档API来定制化编辑器(主题设置，行高亮等)

如果想设置wildpad的大小和显示位置,你可以写一些自定义样式或覆盖wildpad的样式，例如:

{% highlight css %}
.wildpad {
  width: 700px;
  height: 450px;
  background-color: #f62; /* dark orange background */
}
{% endhighlight %}

<div class="emphasis-box">Wildpad同样适合编写markdown，代码，和其它任何文件，你可以参考
<a href="../examples/">examples page</a> 获得更多的例子</div>



<a name="api"> </a>

# 2. Wilddog API

## 构造Wildpad

###基于codeMirror:
`Wildpad.fromCodeMirror(wilddogRef, codeMirror, options)`

>创建wildpad时需要指定唯一的wilddogRef实例和CodeMirror实例，还有指定以下可选参数：
>
> * `richTextToolbar` (default: false) - 添加粗体，斜体等工具按钮.
> * `richTextShortcuts` (default: false) - 快捷键 Ctrl-B > 粗体, 等.
> * `userId` (default: random) - 正在编辑的用户id,默认是随机数.
> * `userColor` (default: generated from userId) - A css color (如. "#ccc") 用户编辑位置光标颜色，默认由用户id生成.
> * `defaultText` (default: null) - 首次编辑时的默认文本.


###基于Ace:
`Wildpad.fromACE(wilddogRef, ace, options)`
创建wildpad时可以指定唯一的wilddogRef实例和CodeMirror实例，还有以下指定参数。

> * `userId` (default: random) - 正在编辑的用户id,默认是随机数.
> * `userColor` (default: generated from userId) - A css color (如. "#ccc") 用户编辑位置光标颜色，默认由用户id生成.
> * `defaultText` (default: null) - 首次编辑时的默认文本.


## Wildpad Methods

`wildpad.on(eventType, callback);`
Wildpad可以根据给定的事件类型指定回调函数，有两个事件可用于监听。

> 'ready' 当wildpad检索到编辑器的初始内容时触发，必须在调用其它事件之前触发。
{% highlight html %}
wildpad.on('ready', function() {
  // Wildpad is ready.
});
{% endhighlight %}

> 'synced' 当本地客户端编辑的文档在成功写入Wilddog后触发。
{% highlight html %}
wildpad.on('synced', function(isSynced) {
  // isSynced will be false immediately after the user edits the pad,
  // and true when their edit has been saved to Wilddog.
});
{% endhighlight %}

`wildpad.off(eventType, callback)`

> 移除指定类型的事件回调.

`wildpad.getText()`
> 获取Wildpad的内容，string .

`wildpad.setText(text)`
> 设置Wildpad的内容，string.

`wildpad.getHtml()`
> 获取Wildpad的内容，html.

`wildpad.setHtml(text)`
> 设置Wildpad的内容，html.

`wildpad.isHistoryEmpty()`
> 如果Wildpad历史记录一直为空则返回为空.

`wildpad.setUserId(userId)`
> 设置用户id.

`wildpad.setUserColor(color)`
> 设置用户的光标颜色，例如"#333".

`wildpad.dispose()`
> 重置编辑器到初始状态,清除所有数据包括(持久化数据，DOM元素，Wilddog监听事件).

`wildpad.insertEntity(type, attributes, origin)`
> 插入一个指定类型和指定属性的dom节点，插入图片时必须包含type='img'，attributes包含src
> 其它的属性包含('alt','width','height','style','class').


<a name="headless"> </a>

# 3. Headless模式
Headless模式支持一些普通的wildpad方法并增加了回调函数参数。

`headless.getText(callback)` 和 `headless.getHtml(callback)`
{% highlight javascript %}
headless.getText(function(text) {
  console.log("Contents of wildpad retrieved: " + text);
});
{% endhighlight %}

`headless.setText(text, callback)` 和 `headless.setHtml(html, callback)`
{% highlight javascript %}
headless.setHtml('<b>Welcome to Wildpad!</b>', function(err, committed) {
  // *err*       will be set if there was a catastrophic failure
  // *committed* will be true on success, or false if there was a history
  //               conflict writing to the pad's history.
});
{% endhighlight %}

当你不需要这些绑定的方法是，你应该明确的清除它。
{% highlight javascript %}
headless.dispose();
{% endhighlight %}

如果你只是清除了`Headless`对象的引用，但是没有调用`dispose()`方法，它依然会监听wilddog底层数据的变化，然后存在内存中，因此除了内存泄露，还可能导致带宽过载和CPU泄露。

<a name="wilddog"> </a>

# 4. Wilddog数据
Wildpad使用[Wilddog](https://www.wilddog.com/)做数据存储和同步，意味着你不需要运行任何服务端的代码，但是依然可以从Wilddog的各种特性(第一级数据安全，数据访问，自动扩展
等)中获益。也意味着你可以以多种方式和应用数据进行交互。

## 数据结构
Wildpad按照以下的数据结构在指定的Wilddog位置存储你的数据:

* `users/`
    * `<user id>/` - Wildpad初始化的时候，你可以指定用户Id，否则的化它是随机数.
        * `cursor` - 用户光标或选取位置.
        * `color` -  cursor的颜色.
* `history/` - 修订文档的序列.
    * `<revision id>/`
        * `a` - 文档版本修订的用户Id.
        * `o/` - 文档版本修订的一系列操作.可以参考 
          [text-operation.js](https://github.com/WildDogTeam/demo-js-wildpad/blob/master/lib/text-operation.js) 了解更多的细节.
* `checkpoint/`
    * `a` - 　创建检查点的用户Id.
    * `rev` - 修订时检查点.
    * `op/` - 文档修订的一系列操作.

## 安全
为了保护Wilddog数据，你可以参考野狗关于[安全](https://z.wilddog.com/)的相关特性.

