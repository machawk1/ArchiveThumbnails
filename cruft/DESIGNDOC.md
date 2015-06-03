# Design Document: Memento Spread Visualization

This document describes the Memento Spread Visualization endpoint API. It covers:

* Various URI formats
* Supported HTTP methods on each URI
* Mandatory and optional request parameters and request headers
* Response codes, response headers, and response payload format(s)

NOTE: Discussion on this document should go [here](https://github.com/machawk1/MementoSpreadViz/issues/14).

## API Summary

Method  | Route            | Headers           | Response      | Description
------- | ---------------- | ----------------- | ------------- | -------------------------------------------------------
OPTIONS | /*               |                   | Allow Header  | Describes server capabilities
GET     | /timemap/:URIR   | [Accept-Datetime] | JSON Body     | TimeMap of a resource
GET     | /stats/:URIR     | [Accept-Datetime] | JSON Body     | Statistical analysis of assets and out-links
GET     | /assets/:URIM    |                   | JSON Body     | List of assets like JS, CSS, and images for the memento
GET     | /outlinks/:URIM  |                   | JSON Body     | List of out-links from the memento
GET     | /thumbnail/:URIM |                   | Binary Image  | Thumbnail of the memento
GET     | /content/:URIM   |                   | Relay Content | Return memento content (rewrite links if necessary)

Note: :URIR refers to a Resource URI and :URIM refers to a Memento URI.

## Options

This request is being used to determine the API server capabilities like supported methods on a given URI.

### Request

```http
OPTIONS / HTTP/1.1
```

### Response

```http
HTTP/1.1 200 OK
Allow: GET, HEAD, OPTIONS
```

## TimeMap

This endpint combines functionalities of TimeMap and TimeGate as described in [RFC 7089](http://tools.ietf.org/html/rfc7089). Accept-Datetime header is optional and defaults to the current time.

### Request

```http
GET /timemap/https://ws-dl.cs.odu.edu/ HTTP/1.1
Accept-Datetime: Mon, 20 Jan 2014 17:11:27 GMT
```

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "timegate": {
    "original": "https://ws-dl.cs.odu.edu/",
    "first": "http://web.archive.org/web/20130825163818/http://ws-dl.cs.odu.edu/",
    "last": "http://web.archive.org/web/20140126004945/https://ws-dl.cs.odu.edu/",
    "closest": "http://web.archive.org/web/20140125101941/http://ws-dl.cs.odu.edu/",
    "datetime": "Thu, 16 Jan 2014 13:32:34 GMT"
  },
  "mementoes": [
    {
      "memento": "http://web.archive.org/web/20130825163818/http://ws-dl.cs.odu.edu/",
      "datetime": "Sun, 25 Aug 2013 16:38:18 GMT"
    }, {
      "memento": "http://web.archive.org/web/20130825163826/https://ws-dl.cs.odu.edu/",
      "datetime": "Sun, 25 Aug 2013 16:38:26 GMT"
    }, {
      "memento": "http://web.archive.org/web/20140125101941/http://ws-dl.cs.odu.edu/",
      "datetime": "Sat, 25 Jan 2014 10:19:41 GMT"
    }, {
      "memento": "http://web.archive.org/web/20140126004945/https://ws-dl.cs.odu.edu/",
      "datetime": "Sun, 26 Jan 2014 00:49:45 GMT"
    }
  ]
}
```

## Stats

This endpoint provides statistical analysis about the given resource. Accept-Datetime header is optional and defaults to the current time. Response structure will evolve as the data need changes on the client side for visualization.

### Request

```http
GET /stats/https://ws-dl.cs.odu.edu/ HTTP/1.1
Accept-Datetime: Mon, 20 Jan 2014 17:11:27 GMT
```

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "origin": {
    "original": "https://ws-dl.cs.odu.edu/",
    "memento": "https://ws-dl.cs.odu.edu/",
    "datetime": "Thu, 16 Jan 2014 13:32:34 GMT",
    "title": "Home"
  },
  "stats": {
    "mementoes": 321,
    "assets": 5,
    "outlinks": 9,
    "size": 9546,
    "first": "Wed, 23 Jan 2013 12:11:15 GMT",
    "last": "Fri, 17 Jan 2014 20:13:22 GMT"
  }
}
```

## Assets

This endpoint provides an annotated list of embedded resources in a memento like JavaScript, style-sheet, images, and other assets.

### Request

```http
GET /assets/https://ws-dl.cs.odu.edu/ HTTP/1.1
```

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "origin": {
    "original": "https://ws-dl.cs.odu.edu/",
    "memento": "https://ws-dl.cs.odu.edu/",
    "datetime": "Thu, 16 Jan 2014 13:32:34 GMT",
    "title": "Home"
  },
  "assets": [
    {
      "original": "https://ws-dl.cs.odu.edu/pub/skins/public/public.css",
      "memento": "https://ws-dl.cs.odu.edu/pub/skins/public/public.css",
      "datetime": "Thu, 16 Jan 2014 13:32:34 GMT",
      "type": "css",
      "size": 5234,
      "occurrence": 1,
      "weight": 0.9
    }, {
      "original": "http://www.cs.odu.edu/~mweigle/icons/odu2l.png",
      "memento": "http://www.cs.odu.edu/~mweigle/icons/odu2l.png",
      "datetime": "Thu, 16 Jan 2014 13:32:34 GMT",
      "type": "image",
      "size": 7845,
      "occurrence": 1,
      "weight": 0.8
    }
  ]
}
```

## Out-links

This endpoint provides an annotated list of out-links in a memento.

### Request

```http
GET /outlinks/https://ws-dl.cs.odu.edu/ HTTP/1.1
```

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "origin": {
    "original": "https://ws-dl.cs.odu.edu/",
    "memento": "https://ws-dl.cs.odu.edu/",
    "datetime": "Thu, 16 Jan 2014 13:32:34 GMT",
    "title": "Home"
  },
  "outlinks": [
    {
      "original": "http://www.cs.odu.edu/",
      "memento": "http://www.cs.odu.edu/",
      "datetime": "Thu, 16 Jan 2014 13:32:34 GMT",
      "title": "Department Of Computer Science",
      "anchorText": "CS Department",
      "position": "Navbar",
      "occurrence": 3,
      "weight": 0.9
    }, {
      "original": "http://example.com/",
      "memento": "http://example.com/",
      "datetime": "Thu, 16 Jan 2014 13:32:34 GMT",
      "title": "Example Domain",
      "anchorText": "Click here",
      "position": "Sidebar",
      "occurrence": 1,
      "weight": 0.5
    }
  ]
}
```

## Thumbnail

This endpoint will return a screenshot thumbnail of the memento. Other options like dimensions, view-port, and cropping etc. will be added later.

### Request

```http
GET /thumbnail/https://ws-dl.cs.odu.edu/ HTTP/1.1
```

### Response

```http
HTTP/1.1 200 OK
Content-Type: image/png

[BINARY DATA]
```

## Content

This endpoint will return the content of a memento with appropriate MIME-type. In case of HTML, it may re-write the links (href and src attributes) to direct further request through a proxy (or self).

### Request

```http
GET /content/https://ws-dl.cs.odu.edu/ HTTP/1.1
```

### Response

```http
HTTP/1.1 200 OK
Content-Type: AS_ORIGINAL_RESOURCE

[ORIGINAL RESOURCE WITH REWRITTEN LINKS]
```
