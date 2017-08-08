#!/usr/bin/env node
var request = require('request')
var fs = require('fs')

var zones = ["book", "picture", "article", "music", "map", "collection", "newspaper", "list"]
var key = '&key=' + process.argv[2]
var since = process.argv[3] || 0
var oneZone = process.argv[4] || false
var root = 'http://api.trove.nla.gov.au'
if (oneZone) zones = [oneZone]

var urls = zones.map(function (z) {
  return {zone: z, url: `${root}/result?q=lastupdated:[*%20TO%20*]&zone=${z}&encoding=json${key}&s=${since}&n=100&sortby=dateasc`}
})

function getNext() {
  var next = urls.shift()
  if (!next) return
  get(next, getNext)
}

get(urls[0], function () {
  console.log('done')
})

function get (item, cb) {
  var out = fs.createWriteStream('./' + item.zone + '-zone.json')
  req(item.url)
  var retries = 3
  function req (url) {
    var start = Date.now()
    request(url, {json: true}, function (err, resp, data) {
      if (err || resp.statusCode > 299) {
        if (retries > 0) {
          retries--
          console.error('retry', retries, url, resp.statusCode, data)
          setTimeout(function () {
            req(url)
          }, 60 * 1000 * 5)
          return
        }
        throw err
      }
      var records = data.response.zone[0].records
      var next = records.next
      if (!next || !records.work.length) {
        out.end()
        return cb()
      }
      console.log(start, records.work.length, url)
      records.work.forEach(function (r) {
        out.write(JSON.stringify(r) + '\n')
      })
      var since = Date.now() - start
      if (since < 3600) setTimeout(doNext, 3600 - since) // keep under 1000/hr rate limit
      else doNext()
      function doNext () {
        req(root + next + key)
      }
    })
  }
}