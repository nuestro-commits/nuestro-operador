/* ordem.js — codec do link da ordem (compartilhado app + gerador)
   Formato do fragmento:  #<marca><base64url>
   marca "1" = deflate-raw  |  marca "0" = JSON puro
   Compatível com Python: zlib.compressobj(wbits=-15) */
(function (root) {
  'use strict';

  function b64urlEnc(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDec(str) {
    var s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function utf8Enc(str) { return new TextEncoder().encode(str); }
  function utf8Dec(bytes) { return new TextDecoder().decode(bytes); }

  function hasCS() { return typeof CompressionStream === 'function'; }
  function hasDS() { return typeof DecompressionStream === 'function'; }

  function through(bytes, stream) {
    var blob = new Blob([bytes]);
    return new Response(blob.stream().pipeThrough(stream)).arrayBuffer()
      .then(function (buf) { return new Uint8Array(buf); });
  }

  function encode(obj) {
    var raw = utf8Enc(JSON.stringify(obj));
    if (!hasCS()) return Promise.resolve('0' + b64urlEnc(raw));
    return through(raw, new CompressionStream('deflate-raw'))
      .then(function (z) { return '1' + b64urlEnc(z); })
      .catch(function () { return '0' + b64urlEnc(raw); });
  }

  function decode(frag) {
    var f = String(frag || '').replace(/^#/, '');
    if (!f) return Promise.reject(new Error('sem dados'));
    var marca = f.charAt(0), corpo = f.slice(1), bytes;
    try { bytes = b64urlDec(corpo); } catch (e) { return Promise.reject(new Error('link corrompido')); }
    if (marca === '0') {
      try { return Promise.resolve(JSON.parse(utf8Dec(bytes))); }
      catch (e) { return Promise.reject(new Error('link corrompido')); }
    }
    if (marca !== '1') return Promise.reject(new Error('formato desconhecido'));
    if (!hasDS()) return Promise.reject(new Error('navegador sem suporte a descompressão'));
    return through(bytes, new DecompressionStream('deflate-raw'))
      .then(function (out) { return JSON.parse(utf8Dec(out)); })
      .catch(function () { throw new Error('link corrompido'); });
  }

  root.OrdemCodec = { encode: encode, decode: decode, b64urlEnc: b64urlEnc, b64urlDec: b64urlDec };
})(window);
