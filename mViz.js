/* *******************************
*  ArchiveThumbnails
*  An implementation for Ahmed AlSum's ECIR 2014 paper:
*   "Thumbnail Summarization Techniques for Web Archives"
*  Mat Kelly <mkelly@cs.odu.edu> 
* 
******************************* */
/* Run this with:
*  > node mViz.js
*  Then send a request for a URI and Accept-Datetime, e.g.,
*  > curl -H "Accept-Datetime: Thu, 31 May 2007 20:35:00 GMT" localhost:15421/?URI-R=http://matkelly.com
*  The expected return value is the resolved Accept-Datetime
*/
var http = require("http");
//var http = require('http').http;
var url = require("url");
var util = require("util");
//var request = require("request");
var Step = require("step");
var async = require("async");
var Futures = require("futures");
var Promise = require('es6-promise').Promise;
var Async = require("async");
var simhash = require('simhash')('md5');

var ProgressBar = require("progress");
var memwatch = require('memwatch');
//var util = require("util"); //for util.inspect for debugging

// And now for something completely different: phantomjs dependencies!
var phantom = require('node-phantom');
//https://github.com/alexscheelmeyer/node-phantom

var fs = require("fs");
var path = require('path');
var validator = require('validator');
var underscore = require('underscore');

var webshot = require("webshot"); //phantomjs wrapper

var timegate_host = "mementoproxy.lanl.gov";
var timegate_path = "/aggr/timegate/";


var PORT = 15421;
var imageServer = "http://localhost:1338/";
//var timemap;

//curl -H "Accept-Datetime: Thu, 31 May 2007 20:35:00 GMT" localhost:15421/?URI-R=http://matkelly.com
//curl -I -H "Accept-Datetime: Thu, 01 Apr 2010 00:00:00 GMT" http://mementoproxy.lanl.gov/aggr/timegate/http://matkelly.com






/**
* Initially called to invoke the server instance
*/
function main(){
	memwatch.on('leak', function(info) { console.error(info); });
	console.log("Thumbnails service started.");
	console.log("> Try localhost:15421/?URI-R=http://matkelly.com in your web browser for sample execution.");

	
	/**
	* Handle an HTTP request and respond appropriately
	* @param request  The request object from the client representing query information
	* @param response Currently active HTTP response to the client used to return information to the client based on the request
	*/
	function respond(request, response) {
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
	  
	  if(query['img']){
	 	//return image data here
	 	var fileExtension = query['img'].substr("-3");
	 	console.log("fetching "+query['img']+" content");

	 	var img = fs.readFileSync(__dirname+"/"+query['img']);
	 	response.writeHead(200, {'Content-Type': 'image/'+fileExtension });
	 	response.end(img, 'binary');
	 	
	 	return;
	 }	 
	  
	  if(!query['URI-R']) {//e.g., favicon fetched post initial fetch
	    console.log("No URI-R sent with request. Try http://localhost:15421/?URI-R=http://matkelly.com");
	  	response.writeHead(400, headers);
	  	response.write(getHTMLSubmissionForm());
		response.end();
		return;  
	  }
	  
	  var uri_r = query['URI-R'];
	  
	  if(!uri_r.match(/^[a-zA-Z]+:\/\//)){uri_r = 'http://' + uri_r;}//prepend scheme if necessary
	  
	 
	  headers["Content-Type"] = "text/html"; //application/json
	  response.writeHead(200, headers);
	 
	  
	  if(!validator.isURL(uri_r)){ //return "invalid URL"
	  	returnJSONError("Invalid URI");
	  	return;
	  }else {
	  	console.log("Validation, checking if URI is valid: "+validator.isURL(uri_r));
	  } 

	  function echoMementoDatetimeToResponse(mementoDatetime){
		response.write("{\"Memento-Datetime\": \""+mementoDatetime.toString("utf8", 0, mementoDatetime.length)+"\",");
	  }
	  function closeConnection(){
		response.end();
	  }
	  
	  function getTimemapCallback(uri,callback){
	  	getTimemap(response,uri,callback);
	  }
	  
	  function returnJSONError(str){
		 response.write("{\"Error\": \""+str+"\"}");
		 response.end();
	  }
	  
	  
	  var callbacks = [getTimemapCallback];
	  
	  										  //uri, date,                              host,         path,         appendURItoFetch,callbacks
	  var mementoDatetime = getMementoDateTime(uri_r,request.headers['accept-datetime'],timegate_host,timegate_path,true,callbacks);
	  return;
	  
	}

	function getHTMLSubmissionForm(){
		var form = "<html><head></head><body><form method=\"get\" action=\"/\">";
		form +=    " <label for=\"uri_r\" style=\"float: left;\">URI-R:</label><input type=\"text\" name=\"URI-R\" />";
		form +=	   " <input type=\"submit\" />";
		return form;
	}
	
	// Initialize the server based and perform the "respond" call back when a client attempts to interact with the script
	http.createServer(respond).listen(PORT);


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

/**
* Used to objectify a returned TimeMap text
* @param str The raw string of the fetched TimeMap
*/
function TimeMap(str){
	this.str = str;
	this.mementos = [];
	this.timemaps = [];
	this.timegates = [];
	this.createMementos = function(){
		var mementoEntries = this.str.split(/\s*,\s</g);
		for(mementoEntry in mementoEntries){
			var str = mementoEntries[mementoEntry];
			var uri = str.substr(0,str.indexOf(">"));
			uri = uri.replace("<",""); //remove first character of first line and any remaining
			var relRegex = /rel=\".*?\"/gm;
			var dtRegex = /datetime=\".*?\"/gm;
			var rels = str.match(relRegex);
			var dts = str.match(dtRegex);
			var dt, rel;
			if(rels){rel = rels[0].substring(5,rels[0].length - 1);}
			if(dts){dt = dts[0].substring(10,dts[0].length - 1);}
			
			var foundMementoObject = new Memento(uri,dt,rel); //could be a timegate or timemap as well
			
			if(rel.indexOf("memento") > -1){//isA memento
				this.mementos.push(foundMementoObject);
			}else if(rel.indexOf("timegate") > -1){
				this.timegates.push(foundMementoObject);
			}else if(rel.indexOf("timemap") > -1){
				this.timemaps.push(foundMementoObject);
			}
			
			delete foundMemento;
		}	
	}
}
TimeMap.prototype.toString = function(){
	return "{"+
		"\"timemaps\":["+this.timemaps.join(",")+"],"+
		"\"timegates\":["+this.timegates.join(",")+"],"+
		"\"mementos\":["+this.mementos.join(",")+"]"
	"}";
}

/**
* An objective representation of an archived resource
* @param uri The location of the resource
* @param datetime The time at which the resource was archives
* @param rel The representation of the resource in the parent timemap (this likely doesn't belong here)
*/
function Memento(uri,datetime,rel){
	this.uri = uri;
	this.datetime = datetime;
	this.rel = rel;
	this.simhash = null;
	this.captureTimeDelta = -1;
}

Memento.prototype.toString = function(){
	return JSON.stringify(this);
}

Memento.prototype.setSimhash = function(){
	var thaturi = this.uri;
	var thatmemento = this;
	return (new Promise(function(resolve,reject){
		var buffer2 = "";
		var memento = this;
		var mOptions = url.parse(thaturi);
		//console.log("Simhashing "+thaturi);
		console.log("");
		var req = http.request({host: mOptions.host, path: mOptions.path}, function(res) {
		
			res.setEncoding('utf8');
			res.on('data', function (data) {
				buffer2 += data.toString();
			});
			if(res.statusCode != 200){
				//throw "Error with "+thaturi+":\n\tThis has to be handled (esp 302s), else the simhash is 000";
				resolve("3");
			}
			res.on('end',function(d){
				console.log("test is "+buffer2.indexOf("Got an HTTP 302 response at crawl time"));
				if(buffer2.indexOf("Got an HTTP 302 response at crawl time") == -1){
					var sh = simhash((buffer2).split('')).join('');
					retStr = getHexString(sh);
					//+"  SrcLen: "+buffer2.length+"  Src: "+memento.uri+"  statusCode: "+res.statusCode;
					buffer2 = "";
					resolve(retStr);
				}else{
					//we need to delete this memento, it's a duplicate and a "soft 302" from archive.org
					console.log("BALETED!");
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
		//buffer2 = "";	
	})).then(function(str){
		console.log("Simhash length: "+retStr.length+" "+retStr+" "+thaturi);
		
		thatmemento.simhash = retStr;
		//console.log("Then done "+thatmemento.uri+" "+retStr);
		return retStr;
	}); 
}

/**
* Based on a URI and an accept-datetime, return the closest Memento-Datetime
* @param uri  The URI-R to use as the basis of the request to the archive
* @param date The Accept-Datetime HTTP header value sent to the server in the memento request
* @param host The Memento Aggregator/proxy hostname
* @param path The Memento Aggregator/proxy path preceding the URI being requested
* @param appendURItoFetch A boolean value to allow the method to be called recursively in case of a forward to prevent multiply appending the URI-R on subsequent recursive calls
* @param callbacks An ordered set of functions to be called to ensure synchronicity of response
*/
function getMementoDateTime(uri,date,host,path,appendURItoFetch,callbacks){
	
	var pathToFetch = path;
	if(appendURItoFetch){
		pathToFetch += uri;
	}
		
 	var options_gmdt = {
	  		host: host,
	  		path: pathToFetch,
	  		port: 80,
	  		method: 'HEAD',
	  	 	headers: {"Accept-Datetime": date}
	  };
	var locationHeader = "";  
	
	var req_gmdt = http.request(options_gmdt, function(res_gmdt) {	
		if(res_gmdt.headers['location'] && res_gmdt.statusCode != 200){
			console.log("Received a "+res_gmdt.statusCode+" code, going to "+res_gmdt.headers['location']);
			var locationUrl = url.parse(res_gmdt.headers['location']);
			return getMementoDateTime(uri,date,locationUrl.host,locationUrl.pathname,false,callbacks);
		/*}else if(!(res_gmdt.headers['memento-datetime'])){ //bad URI, e.g., example.comx
			console.log(res_gmdt);
			jsonErrorCallback("The URI-R you requested has no mementos.");
			return;*/
		}else {
			
			console.log("Memento-Datetime is "+res_gmdt.headers['memento-datetime']);
			for(var cb=0; cb<callbacks.length; cb++){	//execute the callbacks in-order
				var callback = callbacks[cb];
				if(callback.name == "getTimemapCallback"){
					var uri = options_gmdt.path.substr(options_gmdt.path.indexOf("http://"));
					callback(uri,callbacks[2]); //to overcome a race condition, pass the closeConnection callback to the last operation that is to write back to the client					
				}else {
					console.log("Unknown callback: "+callback.name);
				}
			}
			
			return res_gmdt.headers['memento-datetime'];
		}
	});

	req_gmdt.on('error', function(e) { // Houston, do we have an Internet connection?
	  console.log('problem with request: ' + e.message); 
	});
	req_gmdt.on('socket', function (socket) { // slow connection is slow
		/*socket.setTimeout(7000);  
		socket.on('timeout', function() {
			console.log("The server took too long to respond and we're only getting older so we aborted.");
			req_gmdt.abort();
		});*/
	});

	req_gmdt.end();
}

/**
* Given a URI and a datetime, return a timemap
* @param uri The URI-R in-question
*/

function getTimemap(response,uri,callback){
	console.time('timer');
  	var options = {
	  		//host: 'mementoproxy.lanl.gov',
	  		host: 'web.archive.org',
	  		//path: '/aggr/timemap/link/1/' + uri,
	  		path: '/web/timemap/link/' + uri,
	  		port: 80,
	  		method: 'GET'
	  };
	  
	var buffer = ""; // An out-of-scope string to save the Timemap string, TODO: better documentation
	var sequence = Futures.sequence();
	var t, retStr = "";
	//var promise = new Promise(function(resolve, reject){
	async.series([
		function(callback){
			var req = http.request(options, function(res) {
				res.setEncoding('utf8');
				res.on('data', function (data) {
					buffer += data.toString();
				});
				res.on('end',function(d){

					if(buffer.length > 100){  //magic number = arbitrary
						console.log("Timemap acquired for "+uri);
						t = new TimeMap(buffer);
						t.createMementos();
						//response.write("\"TimeMap\": "+t.toString("utf8", 0, t.mementos.length)+"}");
				
						console.log("Fetching HTML for "+t.mementos.length+" mementos.");
				
						//fetchHTML(t.mementos,0);
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
	 //}).then(function(){
	 function(callback){
	 	var arrayOfSetSimhashFunctions = [];
	 	var bar = new ProgressBar("  Simhashing [:bar] :percent :etas", {
	 		complete: '=',
			incomplete: ' ',
			width: 20,
			total: t.mementos.length
		})
	 	t.mementos.forEach(function(memento,m){
	 		arrayOfSetSimhashFunctions.push(memento.setSimhash());
	 		bar.tick(1);
	 	});

	 	return Promise.all(
	 		arrayOfSetSimhashFunctions
	 	).catch(function(err){
	 		console.log("OMFG, an error!");
	 		console.log(err);
	 	}).then(function(){
	 		//remove all mementos whose payload body was a Wayback soft 302
	 		for (var i = t.mementos.length-1; i >= 0; i--) {
				if (t.mementos[i].simhash === "isA302DeleteMe") {
					t.mementos.splice(i, 1);
				}
			}
			
	 		callback("");
	 	});
	 },
	 //}};
	 //})
	 //.catch(function(err){
	 //	console.log("Error!");
	 //	console.log(err);
	 //})
	 function(callback){sortMementosByMementoDatetime(callback);},//.then(sortMementosByMementoDatetime)
	 function(callback){calculateHammingDistances(callback);},//.then(calculateHammingDistances)
	 function(callback){calculateCaptureTimeDeltas(callback);},//.then(calculateCaptureTimeDeltas) //this can be combine with previous call to turn 2n-->1n
	 function(callback){applyKMedoids(callback);},//.then(applyKMedoids)
	 function(callback){createScreenshotsForAllMementos(callback);}],
	 function(callback){printMementoInformation(callback);},//.then(printMementoInformation)
	 function(err, result){
	 	console.log("ERROR!");
	 	console.log(err);
	 }); 



	 function sortMementosByMementoDatetime(callback){
	 	//response.write(JSON.stringify(hashes));
		//response.end();

	 	//return resolve(hashes)
	 	//resolve(100);
	 	//t.sortByDatetime();
	 	callback("");
	 }
	 
	 function createScreenshotsForAllMementos(callback){
	 	var arrayOfCreateScreenshotFunctions = [];
	 	
	 	t.mementos.forEach(function(memento,m){
	 		arrayOfCreateScreenshotFunctions.push(function(callback){createScreenshotForMemento(memento.uri,callback);});
	 	});
	 	//async.parallel(arrayOfCreateScreenshotFunctions,
		//	function(err,result){
		//		console.log("Done!");
		//	}
	 	//);

		async.each(t.mementos,createScreenshotForMemento,function(err){callback("");});
		//return Promise.all(arrayOfCreateScreenshotFunctions,function(){console.log("Something failed.");});
	 }
	 
	 function createScreenshotForMemento(memento,callback){
	 	var uri = memento.uri;
	 	console.log("Setting up create screenshot function for "+uri);
	 	//return (new Promise(function(resolve,reject){
	 	console.log(uri);
		console.log("Creating a screenshot for "+uri);
		
		
		
		var filename = uri.replace(/[^a-z0-9]/gi, '').toLowerCase()+".png"; //sanitize
		memento.screenshotURI = filename;

		try{
			fs.openSync(path.join(__dirname+filename),'r',function(e,r){console.log(e);console.log(r);});
			console.log(filename+" already exists");
			callback();
			return;
		}catch(e){
			console.log(filename+" does not exist, generating SS.");
		}
		
		webshot(uri, filename, function(err) {
			if(err){
				console.log("Error creating a screenshot for "+uri);
				console.log(err);
				//return resolve("yay!");
				callback("Screenshot failed!");
			}else {
				fs.chmodSync("./"+filename, '755');
				console.log("Screenshot created for "+uri);
				//resolve("Screenshot created for "+uri);
				//return reject("error!");
				callback();
			}
		});

	 }
	 
	 function calculateHammingDistances(callback){
	 		
	 	var hammingbar = new ProgressBar("  Hamming [:bar] :percent :etas", {
	 		complete: '=',
			incomplete: ' ',
			width: 20,
			total: t.mementos.length-1
		});
	 	
	 	console.log("Calculating hamming distances");
	 	t.mementos.forEach(function(memento,m,ary){
	 		console.log(m);
	 		if(m > 0){
	 			//console.log("Comparing "+t.mementos[m].simhash+" and "+t.mementos[m-1].simhash);
	 			console.log("Hamming "+t.mementos[m].uri+" "+t.mementos[m-1].uri+" "+t.mementos[m].simhash+" and "+t.mementos[m-1].simhash);
	 			t.mementos[m].hammingDistance = getHamming(t.mementos[m].simhash,t.mementos[m-1].simhash);
	 			hammingbar.tick(1);
	 			console.log(t.mementos[m].uri+" hammed!");
	 		}else if(m == 0){return;}
	 	});
	 	console.log("\n");
	 	callback("");
	 }
	 
	 function calculateCaptureTimeDeltas(callback){
	 	console.log("Calculating capture time deltas");
	 	t.mementos.forEach(function(memento,m,ary){	 		
	 		if(m > 0){
	 			t.mementos[m].captureTimeDelta = getTimeDiffBetweenTwoMementoURIs(t.mementos[m].uri,t.mementos[m-1].uri);
	 			
	 		}else if(m == 0){return;}
	 	});	 
	 	callback("");
	 }
	 
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
		console.log("Applying K Medoids");
		callback("");
	 }
	 
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
	 
	 function printMementoInformation(callback){	
	 	var CRLF = "\r\n"; var TAB = "\t"; 
	 	var respString = 
	 		"<html><head>" + CRLF +
	 		"<script src=\"//code.jquery.com/jquery-1.11.0.min.js\"></script>" + CRLF +
			"<script src=\"//code.jquery.com/jquery-migrate-1.2.1.min.js\"></script>" + CRLF +
	 		"<script>var returnedJSON =" + CRLF +
	 		JSON.stringify(t.mementos) + CRLF +
	 		";</script>" + CRLF +
	 		"<script src=\'"+imageServer+"util.js\'></script>" + CRLF +
	 		"</head><body></body></html>";
	 	response.write(respString);
		response.end();
	 	console.log("Done echoing to client");
	 	console.timeEnd('timer');
	 	//callback("");
	 }
	 
	 function getHamming(str1,str2){
	 	console.log("About to ham");
	 	if(str1.length != str2.length){
	 		console.log("Oh noes! Hamming went awry!");
	 		console.log(str1+" "+str2+" "+str1.length+" "+str2.length);
	 		throw "Unequal lengths when both strings must be equal to calculate hamming distance.";
	 	}
		console.log("Commence the hamming!");
	 	var d = 0;
	 	for(var ii=0; ii<str1.length; ii++){
	 		//console.log(ii+"/"+str1.length+": "+str1[ii]+" "+str2[ii]);
	 		if(str1[ii] != str2[ii]){console.log("incremening d!");d++;}
	 		//console.log("d = "+d);
	 	}
	 	console.log("done hamming");
	 	return d;
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

}

/* *********************************
        UTILITY FUNCTIONS
   *********************************
TODO: break these out into a separate file
*/
	 
//Usefull Functions
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
	for(var i=0; i<onesAndZeros.length; i=i+16){
		str += Bin2Hex(onesAndZeros.substr(i,16));
	}
	return str;
}

/* *********************************
    end UTILITY FUNCTIONS
********************************* */

exports.main = main;
main();