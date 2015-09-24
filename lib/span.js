var wildpad = wildpad || { };
wildpad.Span = (function () {
  function Span(pos, length) {
    this.pos = pos;
    this.length = length;
  }

  Span.prototype.end = function() {
    return this.pos + this.length;
  };

  return Span;
}());
