'use strict';
/*********************************
*  AlSummarization (batch version)
*  An implementation for Ahmed AlSum's ECIR 2014 paper:
*   "Thumbnail Summarization Techniques for Web Archives"
*  Mat Kelly <mkelly@cs.odu.edu>
*
******************************* */
/* Run this with:
*  > node AlSummarization.js
*  Then visit a URI in your browser or curl it, e.g.,
*  > curl localhost:15421/?URI-R=http://matkelly.com
*  A user interface will be returned. If curling, useful info about the
*   summarization returned.
*/

var http = require('http');
var express = require('express');
var url = require('url');
var connect = require('connect');
var serveStatic = require('serve-static');
var Step = require('step');
var async = require('async');
var Futures = require('futures');
var Promise = require('es6-promise').Promise;
var Async = require('async');
var simhash = require('simhash')('md5');
var moment = require('moment');

var ProgressBar = require('progress');
var memwatch = require('memwatch');

var phantom = require('node-phantom');

var fs = require('fs');
var path = require('path');
var validator = require('validator');
var underscore = require('underscore');

var webshot = require('webshot'); // PhantomJS wrapper

var argv = require('minimist')(process.argv.slice(2));
var prompt = require('sync-prompt').prompt;
var request = require('sync-request');

var mementoFramework = require('./_js/mementoFramework.js');
var Memento = mementoFramework.Memento;
var TimeMap = mementoFramework.TimeMap;
var SimhashCacheFile = require('./_js/simhashCache.js').SimhashCacheFile;

var colors = require('colors');
var im = require('imagemagick');
var rimraf = require('rimraf');

var md5 = require('blueimp-md5').md5;

var app = express();

var host = 'http://' + (process.env.SERVER_HOST || 'localhost'); // Format: scheme://hostname

/* Custom ports if specified on command-line */
var thumbnailServicePort = argv.p ? argv.p : 15421;
var localAssetServerPort = argv.ap ? argv.a : 1338;
var notificationServerPort = argv.ap ? argv.n : 15422;

/* Derived host access points */
var localAssetServer = host + ':' + localAssetServerPort + '/';
var thumbnailServer = host + ':' + thumbnailServicePort + '/';
var notificationServer = host + ':' + notificationServerPort + '/';

// Fresh system for testing (NOT IMPLEMENTED)
var nukeSystemData = argv.clean ? argv.clean : false;
var uriR = '';

var lineReader = require('line-reader');

var HAMMING_DISTANCE_THRESHOLD = 4;

/********************************
   TODO: reorder functions (main first) to be more maintainable 20141205
****************************** */

function batchAlsumTest(uriRs) {
  var cacheFile = new SimhashCacheFile(uriRs[0]);
  cacheFile.path += '.json';

  var fileContents = cacheFile.readFileContentsSync();

  if (fileContents) {
    console.log('Found cache file at ' + cacheFile.path);
    processWithFileContents(data);
  } else {
    console.log('No cache file found at ' + cacheFile.path + '. Generating one now...');
    getTimemapX(uriRs);
  }

}

/**
* Start the application by initializing server instances
*/
function main() {
  console.log(('*******************************\r\n' +
               'THUMBNAIL SUMMARIZATION SERVICE\r\n' +
               '*******************************').blue);

//var lines = fs.readFileSync('uris_lulwah_refined.txt').toString().split("\n");
var lines = fs.readFileSync('uris_lulwah_refined.txt').toString().split("\n");
batchAlsumTest(lines);


  var endpoint = new PublicEndpoint();

  // Initialize the server based and perform the "respond" call back when a client attempts to interact with the script
  // http.createServer(respond).listen(thumbnailServicePort);
  app.get('/*', endpoint.respondToClient);
  app.listen(thumbnailServicePort);
return;


  // TODO: react accordingly if port listening failed, don't simply assume the service was started.
  console.log('* ' + ('Thumbnails service started on Port ' + thumbnailServicePort).red);
  console.log('> Try ' + thumbnailServer + '?URI-R=http://matkelly.com in your web browser for sample execution.');
}

/**
* Setup the public-facing attributes of the service
*/
function PublicEndpoint() {
  var theEndPoint = this;
  /**
  * Default form to enter URI-R if one is not supplied in the query string
  */
  this.getHTMLSubmissionForm = function() {
    var baseInterfaceHTML = fs.readFileSync(__dirname + '/base.html');
    return baseInterfaceHTML;
  };

  // Parameters supplied for means of access:
  this.validAccessParameters = ['interface', 'wayback', 'embed'];

  // Parameter supplied for summarization strategy:
  this.validStrategyParameters = ['alSummarization', 'random', 'temporalInterval', 'interval'];

  this.isAValidAccessParameter = function(accessParameter) {
    return theEndPoint.validAccessParameters.indexOf(accessParameter) > -1;
  };

  this.isAValidStrategyParameter = function(strategyParameter) {
    return theEndPoint.validStrategyParameters.indexOf(strategyParameter) > -1;
  };


  /**
  * Handle an HTTP request and respond appropriately
  * @param request  The request object from the client representing query information
  * @param response Currently active HTTP response to the client used to return information to the client based on the request
  */
  this.respondToClient = function(request, response) {
    response.clientId = Math.random() * 101 | 0; // associate a simple random integer to the user for logging (this is not scalable with the implemented method)

    var headers = {};

    // IE8 does not allow domains to be specified, just the *
    // headers['Access-Control-Allow-Origin'] = req.headers.origin;
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Allow-Methods'] = 'GET';
    headers['Access-Control-Allow-Credentials'] = false;
    headers['Access-Control-Max-Age'] = '86400'; // 24 hours
    headers['Access-Control-Allow-Headers'] = 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Accept-Datetime';

    if (request.method !== 'GET') {
      console.log('Bad method ' + request.method + ' sent from client. Try HTTP GET');
      response.writeHead(405, headers);
      response.end();
      return;
    }

    var query = url.parse(request.url, true).query;
    /******************************
       IMAGE PARAMETER - allows binary image data to be returned from service
    **************************** */
    if (query.img) {
      // Return image data here
      var fileExtension = query.img.substr('-3'); // Is this correct to use a string and not an int!?
      console.log('fetching ' + query.img + ' content');

      var img = fs.readFileSync(__dirname + '/' + query.img);
      response.writeHead(200, {'Content-Type': 'image/' + fileExtension });
      response.end(img, 'binary');

      return;
    }

    /******************************
       URI-R PARAMETER - required if not img, supplies basis for archive query
    **************************** */

    function isARESTStyleURI(uri) {
      return (uri.substr(0, 5) === '/http');
    }

    if (!query['URI-R'] && // a URI-R was not passed via the query string...
        request._parsedUrl && !isARESTStyleURI(request._parsedUrl.pathname.substr(0, 5))) { // ...or the REST-style specification
      console.log('No URI-R sent with request. ' + request.url + ' was sent. Try ' + thumbnailServer + '/?URI-R=http://matkelly.com');
      response.writeHead(400, headers);
      response.write(theEndPoint.getHTMLSubmissionForm());
      response.end();
      return;
    }else if (request._parsedUrl && !query['URI-R']) {
      // Populate query['URI-R'] with REST-style URI and proceed like nothing happened
      query['URI-R'] = request._parsedUrl.pathname.substr(1);
    }else if (query['URI-R']) { // URI-R is specied as a query parameter
      console.log('URI-R valid, using query parameter.');
    }

    uriR = query['URI-R'];

    var access = theEndPoint.validAccessParameters[0]; // Not specified? access=interface
    // Override the default access parameter if the user has supplied a value
    //  via query parameters
    if (query.access) {
      access = query.access;
    }

    if (!theEndPoint.isAValidAccessParameter(access)) { // A bad access parameter was passed in
      console.log('Bad access query parameter: ' + access);
      response.writeHead(501, headers);
      response.write('The access parameter was incorrect. Try one of ' + theEndPoint.validAccessParameters.join(',') + ' or omit it entirely from the query string\r\n');
      response.end();
      return;
    }

    headers['X-Means-Of-Access'] = access;

    var strategy = theEndPoint.validStrategyParameters[0]; // Not specified? access=interface
    var strategyHeuristic = true; // If no strategy is expicitly specified, test-and-guess

    if (query.strategy) {
      strategy = query.strategy;
      strategyHeuristic = false;
    }

    if (!theEndPoint.isAValidStrategyParameter(strategy)) { // A bad strategy parameter was passed in
      console.log('Bad strategy query parameter: ' + strategy);
      response.writeHead(501, headers);
      response.write('The strategy parameter was incorrect. Try one of ' + theEndPoint.validStrategyParameters.join(',') + ' or omit it entirely from the query string\r\n');
      response.end();
      return;
    }

    headers['X-Summarization-Strategy'] = strategy;

    if (!uriR.match(/^[a-zA-Z]+:\/\//)) {uriR = 'http://' + uriR; }// Prepend scheme if missing


    headers['Content-Type'] = 'text/html'; // application/json

    response.writeHead(200, headers);
    console.log(query);
    console.log('New client request (' + response.clientId + ')\r\n> URI-R: ' + query['URI-R'] + '\r\n> Access: ' + access + '\r\n> Strategy: ' + strategy);

    if (!validator.isURL(uriR)) { // Return "invalid URL"
      returnJSONError('Invalid URI');
      return;
    }

    function returnJSONError(str) {
      response.write('{"Error": "' + str + '"}');
      response.end();
    }

    response.thumbnails = []; // Carry the original query parameters over to the eventual response
    response.thumbnails['access'] = access;
    response.thumbnails['strategy'] = strategy;

    /*TODO: include consideration for strategy parameter supplied here
            If we consider the strategy, we can simply use the TimeMap instead of the cache file
            Either way, the 'response' should be passed to the function representing the chosen strategy
            so the function still can return HTML to the client
    */
    var t = new TimeMap();

    t.originalURI = query['URI-R'];

    // TODO: optimize this out of the conditional so the functions needed for each strategy are self-contained (and possibly OOP-ified)
    if (strategy === 'alSummarization') {
      console.log('***************');
      var cacheFile = new SimhashCacheFile(uriR);
      cacheFile.path += '.json';
      console.log('Checking if a cache file exists for ' + query['URI-R'] + '...');
      cacheFile.readFileContentSync(
        function success(data) { // A cache file has been previously generated using the alSummarization strategy
          processWithFileContents(data);
        },
        function failed() {
          getTimemapGodFunctionForAlSummarization(query['URI-R'], response);
        }

      );
    }else if (strategy === 'random') {
      t.setupWithURIR(response, query['URI-R'], function selectRandomMementosFromTheTimeMap() {
        var numberOfMementosToSelect = 16; // TODO: remove magic number
        t.supplyChosenMementosBasedOnUniformRandomness(generateThumbnailsWithSelectedMementos, numberOfMementosToSelect);
      });

    }else if (strategy === 'temporalInterval') {
      t.setupWithURIR(response, query['URI-R'], function selectOneMementoForEachMonthPresent() { // TODO: refactor to have fewer verbose callback but not succumb to callback hell
        t.supplyChosenMementosBasedOnTemporalInterval(generateThumbnailsWithSelectedMementos, 16); // TODO: remove magic number, current scope issues with associating with callback

      });
    }else if (strategy === 'interval') {
      t.setupWithURIR(response, query['URI-R'], function selectMementosBasedOnInterval() { // TODO: refactor to have fewer verbose callback but not succumb to callback hell
        t.supplyChosenMementosBasedOnInterval(generateThumbnailsWithSelectedMementos, Math.floor(t.mementos.length / 16)); // TODO: remove magic number, current scope issues with associating with callback
      });
    }

    // TODO: break apart callback hell
    function generateThumbnailsWithSelectedMementos() {
      // suboptimal route but reference to t must be preserved
      // TODO: move this to TimeMap prototype
      t.supplySelectedMementosAScreenshotURI(strategy, function(callback) {
          t.createScreenshotsForMementos(
            function() {console.log('Done creating screenshots');}
          );

      });
    }
  }
}

/**
* Delete all derived data including caching and screenshot - namely for testing
* @param cb Callback to execute upon completion
*/
function cleanSystemData(cb) {
  // Delete all files in ./screenshots/ and ./cache/
  var dirs = ['screenshots', 'cache'];
  dirs.forEach(function(e, i) {
    rimraf(__dirname + '/' + e + '/*', function(err) {
      if (err) {throw err; }
      console.log('Deleted contents of ./' + e + '/');
    });

    console.log(e);
  });

  if (cb) {cb();}
}

/**
* Display thumbnail interface based on passed in JSON
* @param fileContents JSON string consistenting of an array of mementos
* @param response handler to client's browser interface
*/
function processWithFileContents(fileContents) {
  var t = createMementosFromJSONFile(fileContents);
  console.log('There were ' + t.mementos.length + ' mementos');
  t.calculateHammingDistancesWithOnlineFiltering();
  t.supplyChosenMementosBasedOnHammingDistanceAScreenshotURI();
  t.createScreenshotsForMementos(function() {console.log('Done creating screenshots'); });
}

/**
* Convert a string from the JSON cache file to Memento objects
* @param fileContents JSON string consistenting of an array of mementos
*/
function createMementosFromJSONFile(fileContents) {
  var t = new TimeMap();
  t.mementos = JSON.parse(fileContents);
  return t;
}

TimeMap.prototype.toString = function() {
  return '{' +
    '"timemaps":[' + this.timemaps.join(',') + '],' +
    '"timegates":[' + this.timegates.join(',') + '],' +
    '"mementos":[' + this.mementos.join(',') + ']' +
  '}';
};


/**
* Extend Memento object to be more command-line friendly without soiling core
*/
Memento.prototype.toString = function() {
  return JSON.stringify(this);
};

// Add Thumbnail Summarization attributes to Memento Class without soiling core
Memento.prototype.simhash = null;
Memento.prototype.captureTimeDelta = -1;
Memento.prototype.hammingDistance = -1;
Memento.prototype.simhashIndicatorForHTTP302 = '00000000';
var simhashesCreated = 0;

/**
* Fetch URI-M HTML contents and generate a Simhash
*/
Memento.prototype.setSimhash = function() {
  // Retain the URI-R for reference in the promise (this context lost with async)
  var thaturi = this.uri;
  var thatmemento = this;
  return (new Promise(function(resolve, reject) {
    var buffer2 = '';
    var memento = this; // Potentially unused? The 'this' reference will be relative to the promise here
    var mOptions = url.parse(thaturi);
    // console.log("Starting a simhash: "+ mOptions.host+ mOptions.path);

    var req = http.request({'host': mOptions.host, 'path': mOptions.path}, function(res) {
      // var hd = new memwatch.HeapDiff();
      res.setEncoding('utf8');
      res.on('data', function(data) {
        buffer2 += data.toString();
      });

      if (res.statusCode !== 200) {
        thatmemento.simhash = Memento.prototype.simhashIndicatorForHTTP302;
      }

      res.on('end', function(d) {
        var md5hash = md5(thatmemento.originalURI); // URI-R cannot be passed in the raw


        if (buffer2.indexOf('Got an HTTP 302 response at crawl time') === -1 && thatmemento.simhash != '00000000') {

          var sh = simhash((buffer2).split('')).join('');
          //console.log(sh);
          //var retStr = getHexString(sh);
          var retStr = sh; // Changing the Simhash to a bin string from hex for more refined calculation

          if (!retStr || retStr === Memento.prototype.simhashIndicatorForHTTP302) {
            // Normalize so not undefined
            retStr = Memento.prototype.simhashIndicatorForHTTP302;

            // Gateway timeout from the archives, remove from consideration
            resolve('isA302DeleteMe');
          }

          buffer2 = '';
          buffer2 = null;

          //console.log(retStr + ' - ' + mOptions.host + mOptions.path);
          simhashesCreated++;
          
          thatmemento.simhash = retStr;

          resolve(retStr);
        }else {
          // We need to delete this memento, it's a duplicate and a "soft 302" from archive.org
          resolve('isA302DeleteMe');
        }
      });

      res.on('error', function(err) {
        console.log('REJECT!');
        reject(Error('Network Error'));
        console.log('Simhash rejected');
      });
    });

    req.end();
  }));
}


function fetchTimemap(uri) {
  console.log('Fetching TimeMap for ' + uri);
  var res = request('GET', uri);
  var tmData = res.body.toString('utf-8');

  var t = new TimeMap(tmData);
  t.originalURI = uri; // Need this for a filename for caching
  t.createMementos();

  if (t.mementos.length === 0) {
    console.log('There were no mementos for ' + uri + ' :(');
    return;
  }
  
  return t;
}

function nextURI(uris) {
  uris.shift();
  if(uris.length > 0) {
	getTimemapX(uris);
  }
}

/**
* Given a URI, return a TimeMap from the Memento Aggregator
* TODO: God function that does WAY more than simply getting a timemap
* @param uri The URI-R in-question
*/
function getTimemapX(uris) {
  var uri = uris[0];
  var timemapHost = 'web.archive.org';
  var timemapPath = '/web/timemap/link/' + uri;

  console.log('Starting many asynchronous operations...');
  var tm = fetchTimemap('http://' + timemapHost + timemapPath);
  if (!tm) {nextURI(uris); return;}
  
  async.series([
  	  function(callback){callback('');},
	  function(callback) {tm.calculateSimhashes(callback);},
	  function(callback) {tm.saveSimhashesToCache(callback);},
	  function(callback) {tm.calculateHammingDistancesWithOnlineFiltering(callback);},
	  function(callback) {tm.supplyChosenMementosBasedOnHammingDistanceAScreenshotURI(callback);},
	  function(callback) {tm.writeJSONToCache(callback);},
	  function(callback) {tm.createScreenshotsForMementos(callback);}],
	  function(err, result) {
		if (err) {
		  console.log('ERROR!');
		  console.log(err);
		}else {
		  console.log('There were no errors executing the callback chain');
		  nextURI(uris);
		}
	  }
  );


  // Fisher-Yates shuffle per http://stackoverflow.com/questions/11935175/sampling-a-random-subset-from-an-array
  function getRandomSubsetOfMementosArray(arr,siz) {
    var shuffled = arr.slice(0);
    var i = arr.length;
    var temp;
    var index;
    while (i--) {
      index = Math.floor((i + 1) * Math.random());
      temp = shuffled[index];
      shuffled[index] = shuffled[i];
      shuffled[i] = temp;
    }

    return shuffled.slice(0, size);
  }

  function getTimeDiffBetweenTwoMementoURIs(newerMementoURI, olderMementoURI) {
    var newerDate = newerMementoURI.match(/[0-9]{14}/g)[0];  // Newer
    var olderDate = olderMementoURI.match(/[0-9]{14}/g)[0];  // Older

    if (newerDate && olderDate) {
      try {
        var diff = (parseInt(newerDate) - parseInt(olderDate));
        return diff;
      }catch (e) {
        console.log(e.message);
      }
    }else {
      throw new Exception('Both mementos in comparison do not have encoded datetimes in the URIs:\r\n\t' + newerMemento.uri + '\r\n\t' + olderMemento.uri);
    }
  }
} /* End God Function */









/*****************************************
   // SUPPLEMENTAL TIMEMAP FUNCTIONALITY
***************************************** */


TimeMap.prototype.calculateSimhashes = function(callback) {
  
  var theTimeMap = this;
  console.log('Calculating Simhashes for ' + theTimeMap.originalURI);
  var arrayOfSetSimhashFunctions = [];

  for (var m = 0; m < this.mementos.length; m++) {
    this.mementos[m].originalURI = this.originalURI; 
    arrayOfSetSimhashFunctions.push(this.mementos[m].setSimhash());
  }

  function echoNumberOfMementosComplete(uri,totalNumberOfMementos) {
    console.log(simhashesCreated + '/' + totalNumberOfMementos + ' generated for ' + uri);
  }
  simhashesCreated = 0;
  var reportSimhashStatus = setInterval(echoNumberOfMementosComplete,2000,this.originalURI,this.mementos.length);

  // console.time('simhashing');
  var theTimemap = this;
  return Promise.all(
    arrayOfSetSimhashFunctions
  ).catch(function(err) {
    console.log('OMFG, an error!');
    console.log(err);
  }).then(function() {
    clearInterval(reportSimhashStatus);
    console.log('Checking if there are mementos to remove');
    var mementosRemoved = 0;
    console.log('About to go into loop of ## mementos: ' + (theTimemap.mementos.length - 1));

    // Remove all mementos whose payload body was a Wayback soft 302
    for (var i = theTimemap.mementos.length - 1; i >= 0; i--) {
      if (theTimemap.mementos[i].simhash === 'isA302DeleteMe') {
        theTimemap.mementos.splice(i, 1);
        mementosRemoved++;
      }
    }

    // console.timeEnd('simhashing');
    console.log(mementosRemoved + ' mementos removed due to Wayback "soft 3xxs"');
    if (callback) {callback('');}
  });
}

TimeMap.prototype.saveSimhashesToCache = function(callback,format) {
  // TODO: remove dependency on global timemap t
  console.log('Saving Simhashes to Cache');
  var strToWrite = '';
  for (var m = 0; m < this.mementos.length; m++) {
    if (this.mementos[m].simhash != Memento.prototype.simhashIndicatorForHTTP302) {
      strToWrite += this.mementos[m].simhash + ' ' + this.mementos[m].uri + ' ' + this.mementos[m].datetime + '\r\n';
    }
  }

  console.log('Done getting simhashes from array');
  var cacheFile = new SimhashCacheFile(this.originalURI);
  cacheFile.replaceContentWith(strToWrite);


  if (callback) {callback('');}
}

TimeMap.prototype.writeJSONToCache = function(callback) {
  var cacheFile = new SimhashCacheFile(this.originalURI);
  cacheFile.writeFileContentsAsJSON(JSON.stringify(this.mementos));
  if (callback) {callback('');}
}

/**
* Converts the target URI to a safe semantic filename and attaches to relevant memento.
* Selection based on passing a hamming distance threshold
* @param callback The next procedure to execution when this process concludes
*/
TimeMap.prototype.supplyChosenMementosBasedOnHammingDistanceAScreenshotURI = function(callback) {
  // Assuming foreach is faster than for-i, this can be executed out-of-order
  this.mementos.forEach(function(memento,m) {
    var uri = memento.uri;
    // console.log("Hamming distance = "+memento.hammingDistance);
    if (memento.hammingDistance < HAMMING_DISTANCE_THRESHOLD  && memento.hammingDistance >= 0) {
      // console.log(memento.uri+" is below the hamming distance threshold of "+HAMMING_DISTANCE_THRESHOLD);
      memento.screenshotURI = null;
    }else {
      var filename = 'alSum_' + uri.replace(/[^a-z0-9]/gi, '').toLowerCase() + '.png'; // Sanitize URI->filename
      memento.screenshotURI = filename;
    }
  });

  console.log('done with supplyChosenMementosBasedOnHammingDistanceAScreenshotURI, calling back');
  if (callback) {callback('');}
}



/**
* Converts the filename of each previously selected memento a a valid image filename and associate
* @param callback The next procedure to execution when this process concludes
*/
TimeMap.prototype.supplySelectedMementosAScreenshotURI = function(strategy,callback) {
  var ii = 0;
  for (var m in this.mementos) {
    if (this.mementos[m].selected) {
      var filename = strategy + '_' + this.mementos[m].uri.replace(/[^a-z0-9]/gi, '').toLowerCase() + '.png';
      this.mementos[m].screenshotURI = filename;
      ii++;
    }
  }

  console.log('Done creating filenames for ' + ii + ' mementos');

  if (callback) {callback('');}
}

/**
* Select random mementos from the TimeMap up to a specified quantity
* @param callback The next procedure to execution when this process concludes
* @param numberOfMementosToChoose The count threshold before the selection strategy has been satisfied
*/
TimeMap.prototype.supplyChosenMementosBasedOnUniformRandomness = function(callback, numberOfMementosToChoose) {
  var _this = this;
  if (numberOfMementosToChoose > this.mementos.length) {
    console.log('Number to choose is greater than number existing.');
    return;
  }

  var numberOfMementosLeftToChoose = numberOfMementosToChoose;
  while (numberOfMementosLeftToChoose > 0) {
    var randomI = Math.floor(Math.random() * this.mementos.length);
    if (!this.mementos[randomI].selected) {
      this.mementos[randomI].selected = true;
      numberOfMementosLeftToChoose--;
    } // Duplicately selected would take an else, so it's unnecessary

  }

  callback();
}

/**
* TODO: document
* @param callback The next procedure to execution when this process concludes
* @param numberOfMementosToChoose The count threshold before the selection strategy has been satisfied
*/
TimeMap.prototype.supplyChosenMementosBasedOnTemporalInterval = function(callback, numberOfMementosToChoose) {
  var _this = this;
  console.log('OriginalURI is ' + _this.originalURI);
  if (numberOfMementosToChoose > this.mementos.length) {
    console.log('Number to choose is greater than number existing.');
    return;
  }

  var lastMonthRecorded = -1;

  var selectedIndexes = []; // Maintaining memento indexes to prune
  for (var i = 0; i < this.mementos.length; i++) {
    var datetimeAsDate = new Date(this.mementos[i].datetime);
    var thisYYYYMM = datetimeAsDate.getFullYear() + '' + datetimeAsDate.getMonth();

    if (thisYYYYMM !== lastMonthRecorded) {
      this.mementos[i].selected = true;
      lastMonthRecorded = thisYYYYMM;
      console.log(this.mementos[i].datetime + ' accepted');
      selectedIndexes.push(i);
    }else {
      console.log(this.mementos[i].datetime + ' rejected (same month as previous selected)');
    }
  }

  var beforeOK = this.mementos.filter(function(el) {
    return el.selected !== null;
  });

  console.log('We are going to choose ' + numberOfMementosToChoose + ' --- ' + selectedIndexes);
  // Prune based on numberOfMementosToChoose
  while (selectedIndexes.length > numberOfMementosToChoose) {
    var mementoIToRemove = Math.floor(Math.random() * selectedIndexes.length);
    console.log(selectedIndexes.length + ' is too many mementos, removing index ' + mementoIToRemove);
    console.log(this.mementos[mementoIToRemove].datetime + ' was ' + this.mementos[mementoIToRemove].selected);
    delete this.mementos[selectedIndexes[mementoIToRemove]].selected;
    console.log('Now it is ' + this.mementos[mementoIToRemove].selected);
    selectedIndexes.splice(mementoIToRemove, 1);
  }

  var monthlyOK = this.mementos.filter(function(el) {
    return el.selected;
  });

  console.log(beforeOK.length + ' --> ' + monthlyOK.length + ' passed the monthly test');


  callback();
};

/**
* // Select mementos based on interval
* @param callback The next procedure to execution when this process concludes
* @param skipFactor Number of Mementos to skip, n=1 ==> 1,3,5,7
* @param initialIndex The basis for the count. 0 if not supplied
* @param numberOfMementosToChoose Artificial restriction on the count
*/
TimeMap.prototype.supplyChosenMementosBasedOnInterval = function(callback, skipFactor, initialIndex, numberOfMementosToChoose) {
  var _this = this;
  if (numberOfMementosToChoose > this.mementos.length) {
    console.log('Number to choose is greater than number existing.');
    return;
  }

  var numberOfMementosLeftToChoose = numberOfMementosToChoose;

  // TODO: add further checks for parameter integrity (e.g. in case strings are passed)
  if (!initialIndex) {initialIndex = 0; }

  if (skipFactor < 0) {skipFactor = 0; }

  for (var i = initialIndex; i < this.mementos.length; i = i + skipFactor + 1) {
    this.mementos[i].selected = true;
  }

  callback('');
};



/**
* Generate a screenshot with all mementos that pass the passed-in criteria test
* @param callback The next procedure to execution when this process concludes
* @param withCriteria Function to inclusively filter mementos, i.e. returned from criteria
*                     function means a screenshot should be generated for it.
*/
TimeMap.prototype.createScreenshotsForMementos = function(callback, withCriteria) {
  console.log('Creating screenshots...');

  function hasScreenshot(e) {
    return e.screenshotURI !== null;
  }

  var self = this;

  var criteria = hasScreenshot;
  if (withCriteria) {criteria = withCriteria; }

  async.eachLimit(
    shuffleArray(self.mementos.filter(criteria)), // Array of mementos to randomly // shuffleArray(self.mementos.filter(hasScreenshot))
    10,
    self.createScreenshotForMemento,            // Create a screenshot
    function doneCreatingScreenshots(err) {      // When finished, check for errors
      if (err) {
        console.log('Error creating screenshot');
        console.log(err);
      }

      callback('');
    }
  );
};

TimeMap.prototype.createScreenshotForMemento = function(memento, callback) {
  var uri = memento.uri;

  var filename = memento.screenshotURI;

  try {
    fs.openSync(
      path.join(__dirname + '/screenshots/' + memento.screenshotURI),
      'r', function(e, r) {
        console.log(e);
        console.log(r);
      });

    console.log(memento.screenshotURI + ' already exists...continuing');
    callback();
    return;
  }catch (e) {
    console.log((new Date()).getTime() + ' ' + memento.screenshotURI + ' does not exist...generating');
  }

  var options = {
    'phantomConfig': {
      'ignore-ssl-errors': true,
      'local-to-remote-url-access': true // ,
      // 'default-white-background': true,
    },
    // Remove the Wayback UI
    'onLoadFinished': function() {
      document.getElementById('wm-ipp').style.display = 'none';
    }

  };

  console.log('About to start screenshot generation process for ' + uri);
  webshot(uri, 'screenshots/' + filename, options, function(err) {
    if (err) {
      console.log('Error creating a screenshot for ' + uri);
      console.log(err);
      callback('Screenshot failed!');
    }else {
      fs.chmodSync('./screenshots/' + filename, '755');
      im.convert(['./screenshots/' + filename, '-thumbnail', '200',
            './screenshots/' + (filename.replace('.png', '_200.png'))],
        function(err, stdout) {
          if (err) {
            console.log('We could not downscale ./screenshots/' + filename + ' :(');
          }

          console.log('Successfully scaled ' + filename + ' to 200 pixels', stdout);
        });

      console.log('t=' + (new Date()).getTime() + ' ' + 'Screenshot created for ' + uri);
      callback();
    }
  });

};

TimeMap.prototype.calculateHammingDistancesWithOnlineFiltering = function(callback) {
  console.time('Hamming And Filtering, a synchronous operation');

  var lastSignificantMementoIndexBasedOnHamming = 0;
  var copyOfMementos = [this.mementos[0]];

  console.log('Calculate hamming distance of ' + this.mementos.length + ' mementos');
  for (var m = 0; m < this.mementos.length; m++) {
    // console.log("Analyzing memento "+m+"/"+this.mementos.length+": "+this.mementos[m].uri);
    // console.log("...with SimHash: "+this.mementos[m].simhash);
    if (m > 0) { // Hamming distance is only applicable once we have a basis
      /*console.log(this.mementos[0]);
      console.log(this.mementos[0]['simhash']);
      console.log("Simhash: "+this.mementos[m].simhash);
      console.log(this.mementos[m].simhash);
      console.log(this.mementos[m]['simhash']);
      console.log(typeof (this.mementos[m].simhash));
      console.log(typeof (this.mementos[m]['simhash']));*/
      if (typeof this.mementos[m]['simhash'] == 'object') { // Odd behavior of the simhash attr being reported as an obj, correct it here
        this.mementos[m]['simhash'] = this.mementos[m]['simhash'] + '';
      }
      
      if ((this.mementos[m]['simhash'].match(/0/g) || []).length === 32) {console.log('0s, returning'); continue;}
      console.log("Calculating hamming distance");
      this.mementos[m].hammingDistance = getHamming(this.mementos[m].simhash, this.mementos[lastSignificantMementoIndexBasedOnHamming].simhash);
      // console.log("Getting hamming basis");
      this.mementos[m].hammingBasis = this.mementos[lastSignificantMementoIndexBasedOnHamming].datetime;
                 
      /*
      var formattedSimhashStrings = formatStringsToHighlightDifferences([this.mementos[m].simhash, this.mementos[lastSignificantMementoIndexBasedOnHamming].simhash]);
      var testingString = formattedSimhashStrings[0];
      var pivotString = formattedSimhashStrings[1];
      

      console.log('Comparing hamming distances (simhash,uri) = ' + this.mementos[m].hammingDistance + '\n' +
        ' > testing: ' + testingString + ' ' + this.mementos[m].uri + '\n' +
        ' > pivot:   ' + pivotString + ' ' + this.mementos[lastSignificantMementoIndexBasedOnHamming].uri);
      */
      if (this.mementos[m].hammingDistance >= HAMMING_DISTANCE_THRESHOLD) { // Filter the mementos if hamming distance is too small
        lastSignificantMementoIndexBasedOnHamming = m;

        // copyOfMementos.push(t.mementos[m]); // Only push mementos that pass threshold requirements
      }
    }
  }

  console.log((this.mementos.length - copyOfMementos.length) + ' mementos trimmed due to insufficient hamming, ' + this.mementos.length + ' remain.');
  copyOfMementos = null;

  if (callback) {callback(''); }
};


function formatStringsToHighlightDifferences(strs) { // This does not do what we expect due to the concatenation subsequently overwriting the color formatting
  return strs;

  for(var i = 0; i < strs.length; i++){
    if (strs[0].substr(i,1) != strs[1].substr(i,1)) {
	  strs[0] = strs[0].substr(0,i) + strs[0].substr(i,1).red + (i + 1 < strs[0].length ? strs[0].substr(i+1) : '');
	  strs[1] = strs[1].substr(0,i) + strs[1].substr(i,1).red + (i + 1 < strs[1].length ? strs[1].substr(i+1) : '');
    }
  }
  return strs;
}

/**
* Goes to URI-T(?), grabs contents, parses, and associates mementos
* @param callback The next procedure to execution when this process concludes
*/
TimeMap.prototype.setupWithURIR = function(response, uriR, callback) {
  var timemapHost = 'web.archive.org';
  var timemapPath = '/web/timemap/link/' + uriR;
  var options = {
    'host': timemapHost,
    'path': timemapPath,
    'port': 80,
    'method': 'GET'
  };

  var buffer = '';
  var retStr = '';
  console.log('Starting many asynchronous operations...');
  console.log('Timemap output here');
  var tmInstance = this;

  var req = http.request(options, function(res) {
    res.setEncoding('utf8');

    res.on('data', function(data) {
      buffer += data.toString();
    });

    res.on('end', function() {
      if (buffer.length > 100) {
        console.log('X Timemap acquired for ' + uriR + ' from ' + timemapHost + timemapPath);
        tmInstance.str = buffer;
        tmInstance.originalURI = uriR; // Need this for a filename for caching
        tmInstance.createMementos();

        if (tmInstance.mementos.length === 0) {
          console.log('There were no mementos for ' + uriR);
          //return;
          callback();
        }

        callback();
      }
    });
  });

  req.on('error', function(e) { // Houston...
    console.log('problem with request: ' + e.message);
    console.log(e);
    if (e.message === 'connect ETIMEDOUT') { // Error experienced when IA went down on 20141211
      response.write('Hmm, the connection timed out. Internet Archive might be down.');
      response.end();
    }

  });

  req.end();
};


/**********************************
        RELEVANT yet ABSTRACTED generic functions
   ********************************* */

function getHamming(str1_bin, str2_bin) {
  if (!str1_bin || !str2_bin) { // Catch nulls
    return 0;
  }

  if (str1_bin.length !== str2_bin.length) {
    // Resilience instead of crashing
    console.log('Unequal lengths when both strings must be equal to calculate hamming distance:');
    console.log(str1_bin + ' ' + str2_bin + ' ' + str1_bin.length + ' ' + str2_bin.length);
    return 0;
  }else if (str1_bin === str2_bin) {
    return 0;
  }

  var calculatedHammingDistance = 0;  
  //var str1_bin = Hex2BinWithPadding(str1_hex);
  //var str2_bin = Hex2BinWithPadding(str2_hex);
  
  console.log('foo');
  for (var ii = 0; ii < str1_bin.length; ii++) {
    if (str1_bin[ii] !== str2_bin[ii]) {
      calculatedHammingDistance++;
    }
  }
  
  //console.log('H('+str1_bin+','+str2_bin+') = ' + calculatedHammingDistance);
  
  return calculatedHammingDistance;
}

// Fischer-Yates shuffle so we don't fetch the memento in-order but preserve
// them as objects and associated attributes
function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }

  return array;
}

/**********************************
        UTILITY FUNCTIONS
   *********************************
TODO: break these out into a separate file
*/

// Graceful exit
process.on('SIGINT', function() {
  console.log('\nGracefully shutting down from SIGINT (Ctrl-C)');
  process.exit();
});

// Useful Functions
function checkBin(n) {
  return /^[01]{1,64}$/.test(n);
}

function checkDec(n) {
  return /^[0-9]{1,64}$/.test(n);
}

function checkHex(n) {
  return /^[0-9A-Fa-f]{1,64}$/.test(n);
}

function pad(s,z) {
  s = '' + s;
  return s.length < z ? pad('0' + s,z):s;
}

function unpad(s) {
  s = '' + s;
  return s.replace(/^0+/, '');
}

// Decimal operations
function Dec2Bin(n) {
  if (!checkDec(n) || n < 0) {
    return 0;
  }

  return n.toString(2);
}

function Dec2Hex(n) {
  if (!checkDec(n) || n < 0) {
    return 0;
  }

  return n.toString(16);
}

// Binary Operations
function Bin2Dec(n) {
  if (!checkBin(n)) {
    return 0;
  }

  return parseInt(n,2).toString(10);
}

function Bin2Hex(n) {
  if (!checkBin(n)) {
    return 0;
  }

  return parseInt(n,2).toString(16);
}

// Hexadecimal Operations
function Hex2Bin(n) {
  if (!checkHex(n)) {
    return 0;
  }

  return parseInt(n,16).toString(2);
}

function Hex2BinWithPadding(n) { // Turns (e.g.) 4e to 01001110 instead of 1001110
  if (!checkHex(n)) {
    return 0;
  }
  
  var binStr = '';
  for(var i = 0; i < n.length; i++) {
    var targetChar = n.charAt(i);
    var targetCharAsNaiveHex = parseInt(targetChar,16).toString(2);
    pad = '0000'
    binStr += (pad + targetCharAsNaiveHex).slice(-pad.length)
  }
  
  return binStr;
}

function Hex2Dec(n) {
  if (!checkHex(n)) {
    return 0;
  }

  return parseInt(n,16).toString(10);
}

function getHexString(onesAndZeros) {
  var str = '';
  for (var i = 0; i < onesAndZeros.length; i = i + 4) {
    str += Bin2Hex(onesAndZeros.substr(i,4));
  }

  return str;
}

/* *********************************
    end UTILITY FUNCTIONS
********************************* */

exports.main = main;
main();