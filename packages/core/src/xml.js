/**
 * XML Tag Parser — Lightweight XML-like tree parser for uploop core.
 *
 * Parses strings like `<planet name="Earth"><moon/></planet>` into
 * a tree of { tag, attrs, children } nodes. Framework-agnostic:
 * works for scene descriptions, UI templates, config files, etc.
 *
 * Usage:
 *   import { xml } from '@uploop/core'
 *   var tree = xml`<scene><planet name="Sun"/></scene>`
 *   // tree = { tag: 'scene', attrs: {}, children: [{ tag: 'planet', attrs: {name:'Sun'}, children: [] }] }
 */
export function xml(strings, ...values) {
  var raw = ''
  for (var i = 0; i < strings.length; i++) {
    raw += strings[i]
    if (i < values.length) {
      var v = values[i]
      raw += typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)
    }
  }
  return parseXML(raw.trim())
}

export function parseXML(xmlStr) {
  var pos = 0, len = xmlStr.length

  function skipWS() { while (pos < len && (xmlStr[pos] === ' ' || xmlStr[pos] === '\t' || xmlStr[pos] === '\n' || xmlStr[pos] === '\r')) pos++ }

  function readUntil(chars) {
    var start = pos
    while (pos < len && chars.indexOf(xmlStr[pos]) === -1) pos++
    return xmlStr.slice(start, pos)
  }

  function readAttrValue() {
    var q = xmlStr[pos]; pos++
    var v = readUntil(q); pos++
    return v
  }

  function parseAttrs() {
    var attrs = {}
    while (pos < len && xmlStr[pos] !== '/' && xmlStr[pos] !== '>') {
      skipWS()
      if (pos >= len || xmlStr[pos] === '/' || xmlStr[pos] === '>') break
      var name = readUntil('=/> \t\n\r')
      skipWS()
      if (xmlStr[pos] === '=') { pos++; skipWS(); attrs[name] = readAttrValue() }
      else attrs[name] = true
    }
    return attrs
  }

  function parseNode() {
    skipWS()
    if (pos >= len) return null
    if (xmlStr[pos] !== '<') { pos++; return parseNode() }

    if (xmlStr[pos+1] === '/') { pos += 2; readUntil('>'); pos++; return null }

    pos++
    var tag = readUntil('>/\t\n\r ')
    skipWS()
    var attrs = parseAttrs()
    skipWS()

    var node = { tag: tag, attrs: attrs, children: [] }

    if (xmlStr[pos] === '/') { pos += 2; return node }
    if (xmlStr[pos] === '>') pos++

    var closeTag = '</' + tag + '>'
    while (pos < len) {
      if (xmlStr.slice(pos, pos + closeTag.length) === closeTag) {
        pos += closeTag.length
        return node
      }
      var child = parseNode()
      if (child) node.children.push(child)
    }
    return node
  }

  return parseNode()
}

export default { xml, parseXML }
