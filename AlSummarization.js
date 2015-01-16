/* *******************************
*  ArchiveThumbnails
*  An implementation for Ahmed AlSum's ECIR 2014 paper:
*   "Thumbnail Summarization Techniques for Web Archives"
*  Mat Kelly <mkelly@cs.odu.edu>
*
******************************* */
/* Run this with:
*  > node mViz.js
*  Then visit a URI in your browser or curl it, e.g.,
*  > curl localhost:15421/?URI-R=http://matkelly.com
*  A user interface will be returned. If curling, useful info about the summarization returned.
*/
var http = require("http");
var express = require("express");
//var http = require('http').http;
var url = require("url");
var querystring = require("querystring"); // possibly unnecessary, as we no longer need to parse but just read as an object
var util = require("util");
var connect = require('connect');
var serveStatic = require("serve-static");
//var request = require("request");
var Step = require("step");
var async = require("async");
var Futures = require("futures");
var Promise = require('es6-promise').Promise;
var Async = require("async");
var simhash = require('simhash')('md5');
var moment = require("moment");

var ProgressBar = require("progress");
var memwatch = require('memwatch');
//var util = require("util"); //for util.inspect for debugging

// And now for something completely different: phantomjs dependencies!
var phantom = require('node-phantom'); //https://github.com/alexscheelmeyer/node-phantom

var fs = require("fs");
var path = require('path');
var validator = require('validator');
var underscore = require('underscore');

var webshot = require("webshot"); //phantomjs wrapper

var mementoFramework = require('./mementoFramework.js');
var Memento = mementoFramework.Memento;
var TimeMap = mementoFramework.TimeMap;
var SimhashCacheFile = require('./simhashCache.js').SimhashCacheFile;

var colors = require('colors');
var im = require('imagemagick');

/* *********** END REQUIRES ******************* */
var app = express();

var timegate_host = "mementoproxy.lanl.gov";
var timegate_path = "/aggr/timegate/";


var thumbnailServicePort = 15421;
var imageServerPort = 1338;
var imageServer = "http://localhost:"+imageServerPort+"/";

//var timemap;

//curl -H "Accept-Datetime: Thu, 31 May 2007 20:35:00 GMT" localhost:15421/?URI-R=http://matkelly.com
//curl -I -H "Accept-Datetime: Thu, 01 Apr 2010 00:00:00 GMT" http://mementoproxy.lanl.gov/aggr/timegate/http://matkelly.com

var HAMMING_DISTANCE_THRESHOLD = 4;


/* ******************************
   TODO: reorder functions (main first) to be more maintainable 20141205
****************************** */

/**
* Initially called to invoke the server instance
*/
function main(){
	memwatch.on('leak', function(info) { console.log("You're leaking!");console.error(info); });
	//memwatch.on('stats', function(stats) { console.log("Garbage collection!"); console.log(stats); });

	console.log(("*******************************\r\nTHUMBNAIL SUMMARIZATION SERVICE\r\n*******************************").blue);

	startImageServer();
	console.log("* "+("Thumbnails service started on Port "+thumbnailServicePort).red);
	console.log("> Try localhost:"+thumbnailServicePort+"/?URI-R=http://matkelly.com in your web browser for sample execution.");

	var endpoint = new PublicEndpoint();

	// Initialize the server based and perform the "respond" call back when a client attempts to interact with the script
	//http.createServer(respond).listen(thumbnailServicePort);
	app.get("/", endpoint.respondToClient);
	app.listen(thumbnailServicePort);
}


/**
* Create access point for resources local to the interface to be queried. This differs
*  from handling requests from clients.
*/
function startImageServer() {
	connect().use(
		serveStatic(
			__dirname,
			{'setHeaders':function (res,path){res.setHeader("Access-Control-Allow-Origin","*");}}
		)
	).listen(imageServerPort);
	console.log("* "+('Local resource (css, js, etc.) server listening on Port ' + imageServerPort + '...').red);
}


function PublicEndpoint(){
	var theEndPoint = this;
	/**
	* Default form to enter URI-R if one is not supplied in the query string
	*/
	this.getHTMLSubmissionForm = function(){
		var form = "<html><head></head><body><form method=\"get\" action=\"/\">";
		form +=    " <label for=\"uri_r\" style=\"float: left;\">URI-R:</label><input type=\"text\" name=\"URI-R\" />";
		form +=	   " <input type=\"submit\" />";
		return form;
	};

	/**
	* Handle an HTTP request and respond appropriately
	* @param request  The request object from the client representing query information
	* @param response Currently active HTTP response to the client used to return information to the client based on the request
	*/
	this.respondToClient = function(request, response){
		response.clientId = Math.random()*101|0; // associate a simple random integer to the user for logging (this is not scalable with the implemented method)

	 	var headers = {};
	 	// IE8 does not allow domains to be specified, just the *
	 	// headers["Access-Control-Allow-Origin"] = req.headers.origin;
	 	headers["Access-Control-Allow-Origin"] = "*";
	 	headers["Access-Control-Allow-Methods"] = "GET";
	 	headers["Access-Control-Allow-Credentials"] = false;
	 	headers["Access-Control-Max-Age"] = '86400'; // 24 hours
	 	headers["Access-Control-Allow-Headers"] = "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Accept-Datetime";


	 	if (request.method != 'GET') {
	 	  console.log("Bad method "+request.method+" sent from client. Try HTTP GET");
	 	  response.writeHead(405, headers);
		  response.end();
		  return;
	 	}

	  var pathname = url.parse(request.url).pathname;
	  var query = url.parse(request.url, true).query;
	  /* ****************************
	     IMAGE PARAMETER - allows binary image data to be returned from service
	  **************************** */
	  if(query['img']){
		 	//return image data here
		 	var fileExtension = query['img'].substr("-3");
		 	console.log("fetching "+query['img']+" content");

		 	var img = fs.readFileSync(__dirname+"/"+query['img']);
		 	response.writeHead(200, {'Content-Type': 'image/'+fileExtension });
		 	response.end(img, 'binary');

		 	return;
	  }

	  /* ****************************
	     URI-R PARAMETER - required if not img, supplies basis for archive query
	  **************************** */

	  if(!query['URI-R']) {//e.g., favicon fetched post initial fetch
	    console.log("No URI-R sent with request. "+request.url+" was sent. Try http://localhost:15421/?URI-R=http://matkelly.com");
	  	response.writeHead(400, headers);
	  	response.write(this.getHTMLSubmissionForm());
			response.end();
			return;
	  }

	  uri_r = query['URI-R'];


	  /* ****************************
	     ACCESS PARAMETER - optional - specify origin of access to service
	  **************************** */
	  var validAccessParameters = ["interface","wayback","embed"];

	  var access = validAccessParameters[0]; //not specified? access=interface
	  if(query['access']){
	  	access = query['access']; //probably the most inelegant way to do this assignment
	  }

	  if(validAccessParameters.indexOf(access) == -1){ // A bad access parameter was passed in
	  	  console.log("Bad access query parameter: "+access);
	 	  response.writeHead(501, headers);
	 	  response.write("The access parameter was incorrect. Try one of "+validAccessParameters.join(",")+" or omit it entirely from the query string\r\n");
		  response.end();
		  return;
	  }
	  headers["X-Means-Of-Access"] = access;

	  /* ****************************
	     STRATEGY PARAMETER - optional - specify method to use for summarization
	  **************************** */
	  theEndPoint.validStrategyParameters = ["alSummarization","random","monthly","yearly","skipListed"];

	  var strategy = theEndPoint.validStrategyParameters[0]; //not specified? access=interface
	  if(query['strategy']){
	  	strategy = query['strategy'];
	  }

	  if(theEndPoint.validStrategyParameters.indexOf(strategy) == -1){ // A bad strategy parameter was passed in
	  	console.log("Bad strategy query parameter: "+strategy);
	 	  response.writeHead(501, headers);
	 	  response.write("The strategy parameter was incorrect. Try one of "+theEndPoint.validStrategyParameters.join(",")+" or omit it entirely from the query string\r\n");
		  response.end();
		  return;
	  }
	  headers["X-Summarization-Strategy"] = strategy;

	  if(!uri_r.match(/^[a-zA-Z]+:\/\//)){uri_r = 'http://' + uri_r;}//prepend scheme if necessary


	  headers["Content-Type"] = "text/html"; //application/json

	  response.writeHead(200, headers);

	  console.log("New client request ("+response.clientId+")\r\n> URI-R: "+query['URI-R']+"\r\n> Access: "+access+"\r\n> Strategy: "+strategy);


	  if(!validator.isURL(uri_r)){ //return "invalid URL"
	  	returnJSONError("Invalid URI");
	  	return;
	  }

	  function echoMementoDatetimeToResponse(mementoDatetime){
			response.write("{\"Memento-Datetime\": \""+mementoDatetime.toString("utf8", 0, mementoDatetime.length)+"\",");
	  }
	  function closeConnection(){
			response.end();
	  }

	  function returnJSONError(str){
		 response.write("{\"Error\": \""+str+"\"}");
		 response.end();
	  }

	  response.thumbnails = []; //carry the original query parameters over to the eventual response
	  response.thumbnails['access'] = access;
	  response.thumbnails['strategy'] = strategy;

	  //TODO: include consideration for strategy parameter supplied here
		//* If we consider the strategy, we can simply use the TimeMap instead of the cache file
		//* Either way, the 'response' should be passed to the function representing the chosen strategy
		//   so the function still can return HTML to the client


		var t = new TimeMap();

		//TODO: optimize this out of the conditional so the functions needed for each strategy are self-contained (and possibly OOP-ified)
		if(strategy == "alSummarization"){
		  var cacheFile = new SimhashCacheFile(uri_r);
			console.log("Checking if a cache file exists for "+query['URI-R']+"...");
		  cacheFile.readFileContents(
		  	function success(data){ // A cache file has been previously generated using the alSummarization strategy
		  		processWithFileContents(data,response)
		  	},
		  	function failed(){getTimemapGodFunction(query['URI-R'],response);}
		  );
		}
		else if(strategy == "random"){
			t.setupWithURIR(query['URI-R'], function selectRandomMementosFromTheTimeMap(){
				var numberOfMementosToSelect = Math.floor(t.mementos.length/2); //FIX: currently even steven for testing
				t.supplyChosenMementosBasedOnUniformRandomness(generateThumbnailsWithSelectedMementos,numberOfMementosToSelect);
			});

		}
		else if(strategy == "monthly" || strategy == "yearly"){ //TODO: MLN says, 'we only want one temporal strategy'
				t.setupWithURIR(query['URI-R'], function selectOneMementoForEachMonthPresent(){ //TODO: refactor to have fewer verbose callback but not succumb to callback hell
					t.supplyChosenMementosBasedOnOneMonthly(generateThumbnailsWithSelectedMementos,-1);
			});
		}
		else if(strategy == "skipListed"){
			t.setupWithURIR(query['URI-R'], function selectMementosBasedOnSkipLists(){ //TODO: refactor to have fewer verbose callback but not succumb to callback hell
					t.supplyChosenMementosBasedOnSkipLists(generateThumbnailsWithSelectedMementos,-1);
			});
		}

		function generateThumbnailsWithSelectedMementos(){
			//suboptimal route but reference to t must be preserved
			//TODO: move this to TimeMap prototype
			t.supplySelectedMementosAScreenshotURI(
				function(callback){t.printMementoInformation(response,
					function(){
						t.createScreenshotsForMementos(
							function(){console.log("Done creating screenshots");}
						);
					}
				)
			});

		}


 }
}


function processWithFileContents(fileContents,response){
	//we have the string, so we just need to create a timemap with mementos then draw the interface

  //response.thumbnails['strategy']

	var t = createMementosFromCacheFile(fileContents);
	console.log("There were "+t.mementos.length+" mementos");
	t.calculateHammingDistancesWithOnlineFiltering();
	t.supplyChosenMementosBasedOnHammingDistanceAScreenshotURI();
	t.printMementoInformation(response);
	t.createScreenshotsForMementos(function(){console.log("Done creating screenshots");});

}

function createMementosFromCacheFile(fileContents){
	//create mementos from cache file string
	var t = new TimeMap();
	var lines = fileContents.split("\r\n");
	t.mementos = [];
	for(var line = 0; line<lines.length; line++){
		var lineData = lines[line].split(" ");
		if(!lineData || lineData == ""){continue;} //don't add any extra lines from the end of the file
		var m = new Memento(lineData[1]);
		m.simhash = lineData[0];
		m.datetime = lineData.slice(2).join(" ");
		t.mementos.push(m);
	}
	return t;
}


/**
* A data structure that allows a trace of the negotiation to be returned
* @param statusCode HTTP status code of the response
* @param headers HTTP headers for the response, a key-value array
*/
function HTTPResponse(statusCode,headers){
	this.statusCode = statusCode;
	this.headers = headers;
	this.addHeader = function(key,value){
		this.headers[key].push(value);
	};
}
HTTPResponse.prototype.toJSON = function(){
	return "foo";
};

function HTTPRequest(method,uri,headers){
	this.method = method;
	this.uri = uri;
	this.headers = headers;
}


TimeMap.prototype.toString = function(){
	return "{"+
		"\"timemaps\":["+this.timemaps.join(",")+"],"+
		"\"timegates\":["+this.timegates.join(",")+"],"+
		"\"mementos\":["+this.mementos.join(",")+"]"
	"}";
}


/**
* Extend Memento object to be more command-line friendly without soiling core
*/
Memento.prototype.toString = function(){
	return JSON.stringify(this);
}
// Add Thumbnail Summarization attributes to Memento Class without soiling core
Memento.prototype.simhash = null;
Memento.prototype.captureTimeDelta = -1;
Memento.prototype.hammingDistance = -1;
Memento.prototype.simhashIndicatorForHTTP302 = "00000000";

/**
* Fetch URI-M HTML contents and generate a Simhash
*/
Memento.prototype.setSimhash = function(){
	//retain the URI-R for reference in the promise (this context lost with async)
	var thaturi = this.uri;
	var thatmemento = this;
	return (new Promise(function(resolve,reject){
		var buffer2 = "";
		var memento = this;
		var mOptions = url.parse(thaturi);
		console.log("Starting a simhash: "+ mOptions.host+ mOptions.path);

		var req = http.request({host: mOptions.host, path: mOptions.path}, function(res) {
			//var hd = new memwatch.HeapDiff();
			res.setEncoding('utf8');
			res.on('data', function (data) {
				buffer2 += data.toString();
			});
			if(res.statusCode != 200){
				//throw "Error with "+thaturi+":\n\tThis has to be handled (esp 302s), else the simhash is 000";
				//resolve("3");
				thatmemento.simhash = Memento.prototype.simhashIndicatorForHTTP302;
			}
			res.on('end',function(d){
				//console.log("test is "+buffer2.indexOf("Got an HTTP 302 response at crawl time"));
				if(buffer2.indexOf("Got an HTTP 302 response at crawl time") == -1 && thatmemento.simhash != "00000000"){

					var sh = simhash((buffer2).split("")).join("");
					var retStr = getHexString(sh);

					//+"  SrcLen: "+buffer2.length+"  Src: "+memento.uri+"  statusCode: "+res.statusCode;
					//console.log("retstr is "+retStr);
					if(!retStr || retStr == Memento.prototype.simhashIndicatorForHTTP302){
						//normalize so not undefined
						retStr = Memento.prototype.simhashIndicatorForHTTP302;

						resolve("isA302DeleteMe"); //Gateway timeout from the archives, remove from consideration
					}
					buffer2 = "";
					buffer2 = null;
					//delete buffer2;
					console.log(retStr+" - "+ mOptions.host+ mOptions.path);

					thatmemento.simhash = retStr;

					resolve(retStr);
				}else{
					//we need to delete this memento, it's a duplicate and a "soft 302" from archive.org
					resolve("isA302DeleteMe");
				}
			});
			res.on('error',function(err){
				console.log("REJECT!");
				reject(Error("Network Error"));
				console.log("Simhash rejected");
			});
		});
		req.end();
		//req = null;
		//buffer2 = "";
	}))/*.then(function(str){
		//console.log("Simhash length: "+retStr.length+" "+retStr+" "+thaturi);
		if(!retStr){retStr = "00000000";}

		thatmemento.simhash = retStr;
		//console.log("Then done "+thatmemento.uri+" "+retStr);
		return retStr;
	})*/;
}


/**
* Given a URI, return a TimeMap from the Memento Aggregator
* @param uri The URI-R in-question
*/
//TODO: currently a god function that does WAY more than simply getting a timemap
function getTimemapGodFunction(uri,response){
	var timemapHost = "web.archive.org";
	var timemapPath = '/web/timemap/link/' + uri;
  	var options = {
	  		//host: 'mementoproxy.lanl.gov',
	  		host: timemapHost,
	  		//path: '/aggr/timemap/link/1/' + uri,
	  		path: timemapPath,
	  		port: 80,
	  		method: 'GET'
	  };

	console.log("Path: "+options.host+"/"+options.path);
	var buffer = ""; // An out-of-scope string to save the Timemap string, TODO: better documentation
	//var sequence = Futures.sequence();
	var t, retStr = "";
	var metadata = "";
	console.log("Starting many asynchronous operations...");
	async.series([
		//TODO: define how this is different from the getTimemap() parent function (i.e., some name clarification is needed)
		//TODO: abstract this method to its callback form. Currently, this is reaching and populating the timemap out of scope and can't be simply isolated (I tried)
		function fetchTimemap(callback){
			var req = http.request(options, function(res) {
				res.setEncoding('utf8');

				res.on('data', function (data) {
					buffer += data.toString();
				});
				res.on('end',function(d){

					if(buffer.length > 100){  //magic number = arbitrary
						console.log("Timemap acquired for "+uri+" from "+timemapHost+timemapPath);
						t = new TimeMap(buffer);
						t.originalURI = uri; //need this for a filename for caching
						t.createMementos();

						if(t.mementos.length == 0){
							response.write("There were no mementos for "+uri+" :(");
							response.end();
							return;
						}

						console.log("Fetching HTML for "+t.mementos.length+" mementos.");

						var m1 = url.parse(t.mementos[0].uri);
						var m2 = url.parse(t.mementos[1].uri);
						var endpoints = [
							{host: m1.host, path: m1.path},
							{host: m2.host, path: m2.path}
						];

						//next(res, d, 0);
						callback("");
					}
				});
			  });

			req.on('error', function(e) { // Houston...
			  console.log('problem with request: ' + e.message);
			  console.log(e);
			  if(e.message == "connect ETIMEDOUT"){ //error experienced when IA went down on 20141211
			 	 response.write("Hmm, the connection timed out. Internet Archive might be down.");
			  	 response.end();
			  }

			});
			req.on('socket', function (socket) { // slow connection is slow
				//socket.setTimeout(3000);
				//socket.on('timeout', function() {
				//	console.log("The server took too long to respond and we're only getting older so we aborted.");
				//	req.abort();
				//});
			});

			req.end();
		},
	 //TODO: remove this function from callback hell
	 function(callback){t.calculateSimhashes(callback);},
	 function(callback){t.saveSimhashesToCache(callback);},
	 //function(callback){sortMementosByMementoDatetime(callback);}, //likely unnecessary assuming they're guaranteed sorted (is this true?)
	 function(callback){t.calculateHammingDistancesWithOnlineFiltering(callback);},
	 //function(callback){calculateCaptureTimeDeltas(callback);},//CURRENTLY UNUSED, this can be combine with previous call to turn 2n-->1n
	 //function(callback){applyKMedoids(callback);}, //no functionality herein, no reason to call yet
	 function(callback){t.supplyChosenMementosBasedOnHammingDistanceAScreenshotURI(callback);},
	 function(callback){t.printMementoInformation(response,callback);},
	 function(callback){t.createScreenshotsForMementos(callback);}],
	 function(err, result){
	 	if(err){
	 		console.log("ERROR!");
	 		console.log(err);
	 	}else {
	 		console.log("There were no errors executing the callback chain");
	 	}
	 });





	 function sortMementosByMementoDatetime(callback){
	 	//response.write(JSON.stringify(hashes));
		//response.end();

	 	//return resolve(hashes)
	 	//resolve(100);
	 	//t.sortByDatetime();
	 	callback("");
	 }





	 /*
	 //TODO: implement this for the callback chain
	 function calculateCaptureTimeDeltas(callback){
	 	//console.log("Calculating capture time deltas");
	 	t.mementos.forEach(function(memento,m,ary){
	 		if(m > 0){
	 			t.mementos[m].captureTimeDelta = getTimeDiffBetweenTwoMementoURIs(t.mementos[m].uri,t.mementos[m-1].uri);

	 		}else if(m == 0){return;}
	 	});
	 	callback("");
	 }*/

	 /*
	 //TODO: implement this for the callback chain
	 function applyKMedoids(callback){
	 	//1. Initialize: randomly select k of the n data points as the medoids
	 	//var arr = t.mementos.clone();
	 	//var k = 5; //for testing
	 	//var selectedK = getRandomSubsetOfMementosArray(arr,k);
		//2. Associate each data point to the closest medoid. ("closest" here is defined using any valid distance metric, most commonly Euclidean distance, Manhattan distance or Minkowski distance)
		//3. For each medoid m
		//     3a. For each non-medoid data point o
		//     3b. Swap m and o and compute the total cost of the configuration
		//4. Select the configuration with the lowest cost.
		//5. Repeat steps 2 to 4 until there is no change in the medoid.
		throw "applyKMedoids is not implemented";
		console.log("Applying K Medoids");
		callback("");
	 }
	 */

	 // Fisher-Yates shuffle per http://stackoverflow.com/questions/11935175/sampling-a-random-subset-from-an-array
	 function getRandomSubsetOfMementosArray(arr,siz){

			var shuffled = arr.slice(0), i = arr.length, temp, index;
			while (i--) {
				index = Math.floor((i + 1) * Math.random());
				temp = shuffled[index];
				shuffled[index] = shuffled[i];
				shuffled[i] = temp;
			}
			return shuffled.slice(0, size);
	 }






	 function getTimeDiffBetweenTwoMementoURIs(newerMementoURI, olderMementoURI){
	 	var newerDate = newerMementoURI.match(/[0-9]{14}/g)[0];	//newer
	 	var olderDate = olderMementoURI.match(/[0-9]{14}/g)[0];	//older

	 	if(newerDate && olderDate){
	 		try{
	 			var diff = (parseInt(newerDate) - parseInt(olderDate));
	 			return diff;
	 		}catch(e){
	 			console.log(e.message);
	 		}
	 	}else {
	 		throw new Exception("Both mementos in comparison do not have encoded datetimes in the URIs:\r\n\t"+newerMemento.uri+"\r\n\t"+olderMemento.uri);
	 	}
	 }

}









/* ****************************************
   // SUPPLEMENTAL TIMEMAP FUNCTIONALITY
***************************************** */

/**
 * HTML to return back as user interface to client
 * @param callback The function to call once this function has completed executed, invoked by caller
 */
 TimeMap.prototype.printMementoInformation = function(response,callback){
	console.log("About to print memento information");
	var CRLF = "\r\n"; var TAB = "\t";

	//This is a dumb, wrong implementation but will fit the bill until I can either
	//...extract the available faux HTTP header or pass the needed value through the callback chain
	//var access = "interface";
	//if(document.URL.indexOf("access=wayback") > -1){access = "wayback";}
	//else if(document.URL.indexOf("access=embed") > -1){access = "embed";}

	var respString =
		"<html><head>" + CRLF +
		"<base href=\'"+imageServer+"\' />" + CRLF +
		"<script src=\"//code.jquery.com/jquery-1.11.0.min.js\"></script>" + CRLF +
		"<script src=\"//code.jquery.com/jquery-migrate-1.2.1.min.js\"></script>" + CRLF +
		"<script src=\"//code.jquery.com/ui/1.10.4/jquery-ui.min.js\"></script>" + CRLF +
		"<script src=\"moment-with-langs.min.js\"></script>" + CRLF +
		"<link rel=\"stylesheet\" type=\"text/css\" href=\"coverflow/dist/coverflow.css\" />" + CRLF +
		"<link rel=\"stylesheet\" type=\"text/css\" href=\"alSummarization.css\" />" + CRLF +
		"<link rel=\"stylesheet\" type=\"text/css\" href=\"reflection.css\" />" + CRLF +
		"<link rel=\"stylesheet\" type=\"text/css\" href=\"vis/vis.min.css\" />" + CRLF +
		"<link rel=\"stylesheet\" type=\"text/css\" href=\"flip.css\" />" + CRLF +
		"<script src=\"coverflow/dist/coverflow.min.js\"></script>" + CRLF +
		"<script src=\"vis/vis.min.js\"></script>" + CRLF +
		"<script>var returnedJSON =" + CRLF +
			JSON.stringify(this.mementos) + ";" + CRLF +
			//"var metadata = '"+metadata+"';" + CRLF +
		"</script>" + CRLF +
		"<script src=\'"+imageServer+"util.js\'></script>" + CRLF +
		"</head><body data-access=\""+response.thumbnails.access+"\" data-strategy=\""+response.thumbnails.strategy+"\"><h1 class=\"interface\">Thumbnails for "+uri_r+" <button id=\"showJSON\" class=\"interface\">Show JSON</button></h1>" + CRLF +
		"</body></html>";
	response.write(respString);
	response.end();
	console.log("HTML for interface sent to client");
	if(callback){callback("");}
 }

TimeMap.prototype.calculateSimhashes = function(callback){
	//console.time("memFetch");
	var arrayOfSetSimhashFunctions = [];
	var bar = new ProgressBar("  Simhashing [:bar] :percent :etas", {
		complete: '=',
		incomplete: ' ',
		width: 20,
		total: this.mementos.length
	})

	for(var m=0; m<this.mementos.length; m++){
		arrayOfSetSimhashFunctions.push(this.mementos[m].setSimhash());
		bar.tick(1);
	}

	console.time('simhashing');
	var theTimemap = this;
	return Promise.all(
		arrayOfSetSimhashFunctions
	).catch(function(err){
		console.log("OMFG, an error!");
		console.log(err);
	}).then(function(){
		console.log("Checking if there are mementos to remove");
		var mementosRemoved = 0;
		console.log("About to go into loop of ## mementos: "+(theTimemap.mementos.length - 1));
		//remove all mementos whose payload body was a Wayback soft 302
		for (var i = theTimemap.mementos.length-1; i >= 0; i--) {
			console.log("Checking "+i+" of "+theTimemap.mementos.length);
			if (theTimemap.mementos[i].simhash === "isA302DeleteMe") {
				theTimemap.mementos.splice(i, 1);
				mementosRemoved++;
			}
		}

		//console.timeEnd('simhashing');
		console.log(mementosRemoved+" mementos removed due to Wayback 'soft 3xxs'");
		if(callback){callback("");}
	});
}

TimeMap.prototype.saveSimhashesToCache = function(callback){
	//TODO: remove dependency on global timemap t

	var strToWrite = "";
	for(var m=0; m<this.mementos.length; m++){
		if(this.mementos[m].simhash != Memento.prototype.simhashIndicatorForHTTP302){
			strToWrite += this.mementos[m].simhash + " " + this.mementos[m].uri + " " + this.mementos[m].datetime + "\r\n";
		}
	}

	console.log("Done getting simhashes from array");
	var cacheFile = new SimhashCacheFile(this.originalURI);
	cacheFile.replaceContentWith(strToWrite);


	if(callback){callback("");}
}

/**
* Converts the target URI to a safe semantic filename and attaches to relevant memento.
* Selection based on passing a hamming distance threshold
* @param callback The next procedure to execution when this process concludes
*/
TimeMap.prototype.supplyChosenMementosBasedOnHammingDistanceAScreenshotURI = function(callback){
	//Assuming foreach is faster than for-i, this can be executed out-of-order
	this.mementos.forEach(function(memento,m){
		var uri = memento.uri;
		console.log("Hamming distance = "+memento.hammingDistance);
		if(memento.hammingDistance < HAMMING_DISTANCE_THRESHOLD  && memento.hammingDistance >= 0){
			console.log(memento.uri+" is below the hamming distance threshold of "+HAMMING_DISTANCE_THRESHOLD);
			memento.screenshotURI = null;
		}else {
			var filename = uri.replace(/[^a-z0-9]/gi, '').toLowerCase()+".png"; //sanitize URI->filename
			memento.screenshotURI = filename;
		}
	});
	console.log("done with supplyChosenMementosBasedOnHammingDistanceAScreenshotURI, calling back");
	if(callback){callback("");}
}



/**
* Converts the filename of each previously selected memento a a valid image filename and associate
* @param callback The next procedure to execution when this process concludes
*/
TimeMap.prototype.supplySelectedMementosAScreenshotURI = function(callback){
	for(var m in this.mementos){
		var ii=0;
		if(this.mementos[m].selected){
			var filename = this.mementos[m].uri.replace(/[^a-z0-9]/gi, '').toLowerCase()+".png"
			this.mementos[m].screenshotURI = filename;
			ii++;
		}
	}
	console.log("Done creating filenames for "+ii+" mementos");

	if(callback){callback("");}
}

/**
* Select random mementos from the TimeMap up to a specified quantity
* @param callback The next procedure to execution when this process concludes
* @param numberOfMementosToChoose The count threshold before the selection strategy has been satisfied
*/
TimeMap.prototype.supplyChosenMementosBasedOnUniformRandomness = function(callback,numberOfMementosToChoose){
	if(numberOfMementosToChoose > this.mementos.length){console.log("Number to choose is greater than number existing.");return;}

	var numberOfMementosLeftToChoose = numberOfMementosToChoose;
	while(numberOfMementosLeftToChoose > 0){
		var randomI = Math.floor(Math.random() * this.mementos.length);
		if(!this.mementos[randomI].selected){
			this.mementos[randomI].selected = true;
			numberOfMementosLeftToChoose--;
		}//duplicately selected would take an else, so it's unnecessary

	}
	callback();
}

/**
* //TODO: document
* @param callback The next procedure to execution when this process concludes
* @param numberOfMementosToChoose The count threshold before the selection strategy has been satisfied
*/
TimeMap.prototype.supplyChosenMementosBasedOnOneMonthly = function(callback,numberOfMementosToChoose){
	if(numberOfMementosToChoose > this.mementos.length){console.log("Number to choose is greater than number existing.");return;}

	var numberOfMementosLeftToChoose = numberOfMementosToChoose;
	var lastMonthRecorded = -1;

	for(var i=0; i<this.mementos.length; i++){
			var thisYYYYMM = (moment(this.mementos[i].datetime).format("YYYYMM"));
			if(thisYYYYMM != lastMonthRecorded){
				this.mementos[i].selected = true;
				lastMonthRecorded = thisYYYYMM;
				console.log(this.mementos[i].datetime+" accepted");
			}else {
				console.log(this.mementos[i].datetime+" rejected");
			}
	}
	callback();
}

/**
* // Select mementos based on skip lists
* @param callback The next procedure to execution when this process concludes
* @param skipFactor Number of Mementos to skip, n=1 ==> 1,3,5,7
* @param initialIndex The basis for the count. 0 if not supplied
* @param numberOfMementosToChoose Artificial restriction on the count
*/
TimeMap.prototype.supplyChosenMementosBasedOnSkipLists = function(callback,skipFactor,initialIndex,numberOfMementosToChoose){
	if(numberOfMementosToChoose > this.mementos.length){console.log("Number to choose is greater than number existing.");return;}

	var numberOfMementosLeftToChoose = numberOfMementosToChoose;
	var lastMonthRecorded = -1;


	//TODO: add further checks for parameter integrity (e.g. in case strings are passed)
	if(!initialIndex){initialIndex = 0;}
	if(skipFactor < 0){skipFactor = 0;}

	for(var i=initialIndex; i<this.mementos.length; i=i+skipFactor+1){
			this.mementos[i].selected = true;
	}
	console.log("done with skip list logic!");
	callback("");
}



/**
* Generate a screenshot with all mementos that pass the passed-in criteria test
* @param callback The next procedure to execution when this process concludes
* @param withCriteria Function to inclusively filter mementos, i.e. returned from criteria
*                     function means a screenshot should be generated for it.
*/
TimeMap.prototype.createScreenshotsForMementos = function(callback,withCriteria){
	var arrayOfCreateScreenshotFunctions = [];
	console.log("Creating screenshots...");

	function hasScreenshot(e){
		return e.screenshotURI != null;
	}

	var self = this;

	var criteria = hasScreenshot;
	if(withCriteria){criteria = withCriteria;}

	async.eachLimit(
		shuffleArray(self.mementos.filter(criteria)), //array of mementos to randomly // shuffleArray(self.mementos.filter(hasScreenshot))
		10,
		self.createScreenshotForMemento,						//create a screenshot
		function doneCreatingScreenshots(err){			//when finished, check for errors
			if(err){
				console.log("Error creating screenshot");
				console.log(err);
			}
			callback("");
		}
	);
 };

TimeMap.prototype.createScreenshotForMemento = function(memento,callback){
	var uri = memento.uri;


	/*if(memento.hammingDistance < HAMMING_DISTANCE_THRESHOLD && memento.hammingDistance >= 0){
		console.log("before:");
		console.log(memento.screenshotURI);
		memento.screenshotURI = null;
		callback();
		return;
	}*/
	var filename = memento.screenshotURI


	try{
		fs.openSync(path.join(__dirname+"/screenshots/"+memento.screenshotURI),'r',function(e,r){console.log(e);console.log(r);});
		console.log(memento.screenshotURI+" already exists...continuing");
		callback();
		return;
	}catch(e){
		console.log((new Date()).getTime()+" "+memento.screenshotURI+" does not exist...generating");
	}

	var options = {
		'phantomConfig': {
			'ignore-ssl-errors': true,
			'local-to-remote-url-access': true//,
			//'default-white-background': true,
		},
		//remove the Wayback UI
		onLoadFinished: function() {
			document.getElementById('wm-ipp').style.display = "none";
		}

	};

	console.log("About to start screenshot generation process for "+uri);
	webshot(uri, "screenshots/"+filename, options, function(err) {
		if(err){
			console.log("Error creating a screenshot for "+uri);
			console.log(err);
			callback("Screenshot failed!");
		}else {
			fs.chmodSync("./screenshots/"+filename, '755');
			im.convert(["./screenshots/"+filename,'-thumbnail','200',"./screenshots/"+(filename.replace(".png","_200.png"))],
				function(err, stdout){
				  if(err) console.log("We couldn't downscale "+"./screenshots/"+filename+" :(");
				  console.log('Successfully scaled '+filename+" to 200 pixels", stdout);
				});

			console.log("t="+(new Date()).getTime()+" "+"Screenshot created for "+uri);
			callback();
		}
	});

}

 TimeMap.prototype.calculateHammingDistancesWithOnlineFiltering = function(callback){
	console.time('Hamming And Filtering, a synchronous operation');

	var lastSignificantMementoIndexBasedOnHamming = 0;
	var copyOfMementos = [this.mementos[0]];

	console.log("Calculate hamming distance of "+this.mementos.length+" mementos");
	for(var m=0; m<this.mementos.length; m++){
		console.log("Analyzing memento "+m+": "+this.mementos[m].uri);
		console.log("...with SimHash: "+this.mementos[m].simhash);
		if(m > 0){
			if((this.mementos[m].simhash.match(/0/g) || []).length == 32){console.log("0s, returning");continue;}
			console.log("Calculating hamming distance");
			this.mementos[m].hammingDistance = getHamming(this.mementos[m].simhash,this.mementos[lastSignificantMementoIndexBasedOnHamming].simhash);
			console.log("Getting hamming basis");
			this.mementos[m].hammingBasis = this.mementos[lastSignificantMementoIndexBasedOnHamming].datetime;

			console.log("Comparing hamming distances (simhash,uri) = "+this.mementos[m].hammingDistance +"\n" +
				" > testing: "+this.mementos[m].simhash+" "+this.mementos[m].uri + "\n" +
				" > pivot:   "+this.mementos[lastSignificantMementoIndexBasedOnHamming].simhash + " " + this.mementos[lastSignificantMementoIndexBasedOnHamming].uri);


			if(this.mementos[m].hammingDistance >= HAMMING_DISTANCE_THRESHOLD){ //filter the mementos if hamming distance is too small
				lastSignificantMementoIndexBasedOnHamming = m;
				//copyOfMementos.push(t.mementos[m]);	//only push mementos that pass threshold requirements
			}

			//console.log(t.mementos[m].uri+" hammed!");
		}else if(m == 0){console.log("m==0, continuing");}
	}
	console.log((this.mementos.length - copyOfMementos.length) + " mementos trimmed due to insufficient hamming.");
	metadata = "";
	//metadata = copyOfMementos.length+" of "+this.mementos.length + " mementos displayed, trimmed due to insufficient hamming distance.";
	//t.mementos = copyOfMementos.slice(0);
	console.log(this.mementos.length+" mementos remain");
	copyOfMementos = null;


	if(callback){callback("");}
 }


/**
* Goes to URI-T(?), grabs contents, parses, and associates mementos
* @param callback The next procedure to execution when this process concludes
*/
TimeMap.prototype.setupWithURIR = function(uri_r,callback){
	var timemapHost = "web.archive.org";
	var timemapPath = '/web/timemap/link/' + uri_r;
	var options = {
		host: timemapHost,
		path: timemapPath,
		port: 80,
		method: 'GET'
	};

	var buffer = "";
	var t, retStr = "";
	var metadata = "";
	console.log("Starting many asynchronous operations...");
	console.log("Timemap output here");
	var tmInstance = this;

	var req = http.request(options, function(res) {
  	res.setEncoding('utf8');

		res.on('data', function (data) {
			buffer += data.toString();
		});
		res.on('end',function(d){
			if(buffer.length > 100){
				console.log("X Timemap acquired for "+uri_r+" from "+timemapHost+timemapPath);
				tmInstance.str = buffer;
				tmInstance.originalURI = uri_r; //need this for a filename for caching
				tmInstance.createMementos();

				if(tmInstance.mementos.length == 0){
					response.write("There were no mementos for "+uri);
					response.end();
					return;
				}

				callback();
			}
		});
	});

	req.on('error', function(e) { // Houston...
		console.log('problem with request: ' + e.message);
		console.log(e);
		if(e.message == "connect ETIMEDOUT"){ //error experienced when IA went down on 20141211
			response.write("Hmm, the connection timed out. Internet Archive might be down.");
			response.end();
		}

	});
	req.on('socket', function (socket) { // slow connection is slow
		//socket.setTimeout(3000);
		//socket.on('timeout', function() {
		//	console.log("The server took too long to respond and we're only getting older so we aborted.");
		//	req.abort();
		//});
	});

	req.end();
}


/* *********************************
        RELEVANT yet ABSTRACTED generic functions
   *********************************
*/

function getHamming(str1,str2){
	if(str1.length != str2.length){
		console.log("Oh noes! Hamming went awry! The lengths are not equal!");
		console.log(str1+" "+str2+" "+str1.length+" "+str2.length);
		//throw "Unequal lengths when both strings must be equal to calculate hamming distance.";

		//resilience instead of crashing
		console.log("Unequal lengths when both strings must be equal to calculate hamming distance.");
		return 0;
	}else if(str1 === str2) {
		return 0;
	}
	var d = 0;
	for(var ii=0; ii<str1.length; ii++){
		if(str1[ii] != str2[ii]){d++;}
	};
	return d;
 }


//Fischer-Yates shuffle so we don't fetch the memento in-order but preserve
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

/* *********************************
        UTILITY FUNCTIONS
   *********************************
TODO: break these out into a separate file
*/

//Useful Functions
function checkBin(n){return/^[01]{1,64}$/.test(n)}
function checkDec(n){return/^[0-9]{1,64}$/.test(n)}
function checkHex(n){return/^[0-9A-Fa-f]{1,64}$/.test(n)}
function pad(s,z){s=""+s;return s.length<z?pad("0"+s,z):s}
function unpad(s){s=""+s;return s.replace(/^0+/,'')}

//Decimal operations
function Dec2Bin(n){if(!checkDec(n)||n<0)return 0;return n.toString(2)}
function Dec2Hex(n){if(!checkDec(n)||n<0)return 0;return n.toString(16)}

//Binary Operations
function Bin2Dec(n){if(!checkBin(n))return 0;return parseInt(n,2).toString(10)}
function Bin2Hex(n){if(!checkBin(n))return 0;return parseInt(n,2).toString(16)}

//Hexadecimal Operations
function Hex2Bin(n){if(!checkHex(n))return 0;return parseInt(n,16).toString(2)}
function Hex2Dec(n){if(!checkHex(n))return 0;return parseInt(n,16).toString(10)}

function getHexString(onesAndZeros){
	var str = "";
	for(var i=0; i<onesAndZeros.length; i=i+4){
		str += Bin2Hex(onesAndZeros.substr(i,4));
	}
	return str;
}

/* *********************************
    end UTILITY FUNCTIONS
********************************* */

exports.main = main;
var uri_r = "";
main();
