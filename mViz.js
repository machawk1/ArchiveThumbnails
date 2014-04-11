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
var request = require("request");
var Step = require("step");
var async = require("async");
var Futures = require("futures");
var Promise = require('es6-promise').Promise;
var simhash = require('simhash')('md5');

//var util = require("util"); //for util.inspect for debugging

// And now for something completely different: phantomjs dependencies!
var phantom = require('node-phantom');
//https://github.com/alexscheelmeyer/node-phantom

var fs = require("fs");
var validator = require('validator');
var underscore = require('underscore');

var timegate_host = "mementoproxy.lanl.gov";
var timegate_path = "/aggr/timegate/";

var PORT = 15421;
//var timemap;

var trace = []; //An array for us to follow the negotiation after-the-fact

//curl -H "Accept-Datetime: Thu, 31 May 2007 20:35:00 GMT" localhost:15421/?URI-R=http://matkelly.com
//curl -I -H "Accept-Datetime: Thu, 01 Apr 2010 00:00:00 GMT" http://mementoproxy.lanl.gov/aggr/timegate/http://matkelly.com

/**
* Initially called to invoke the server instance
*/
function main(){
	/**
	* Handle an HTTP request and respond appropriately
	* @param request  The request object from the client representing query information
	* @param response Currently active HTTP response to the client used to return information to the client based on the request
	*/
	function respond(request, response) {
	 //from https://gist.github.com/nilcolor/816580
	 var headers = {};
	 // IE8 does not allow domains to be specified, just the *
	 // headers["Access-Control-Allow-Origin"] = req.headers.origin;
	 headers["Access-Control-Allow-Origin"] = "*";
	 headers["Access-Control-Allow-Methods"] = "POST, GET, PUT, DELETE, OPTIONS";
	 headers["Access-Control-Allow-Credentials"] = false;
	 headers["Access-Control-Max-Age"] = '86400'; // 24 hours
	 headers["Access-Control-Allow-Headers"] = "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Accept-Datetime";
	 response.writeHead(200, headers);
	 
	 if (request.method === 'OPTIONS') {
		  response.end();
		  return;  
	 }
	 
	 
	 
	  var pathname = url.parse(request.url).pathname;
		console.log(request.headers);
	  var query = url.parse(request.url, true).query;
	  var uri_r = query['URI-R'];
	  if(!uri_r.match(/^[a-zA-Z]+:\/\//)){uri_r = 'http://' + uri_r;}//prepend scheme if necessary
	  
	  if(!validator.isURL(uri_r)){ //return "invalid URL"
	  	returnJSONError("Invalid URI");
	  	return;
	  }else {
	  	console.log("isaurl? "+validator.isURL(uri_r));
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
	  
	  
	  var callbacks = [echoMementoDatetimeToResponse,getTimemapCallback,closeConnection,returnJSONError];
	  //console.log(request.headers);
	  										  //uri, date,                              host,         path,         appendURItoFetch,callbacks
	  var mementoDatetime = getMementoDateTime(uri_r,request.headers['accept-datetime'],timegate_host,timegate_path,true,callbacks);
	  return;
	  /*
	  console.log("mementoDatetime is "+mementoDatetime);
	  
	  if(!mementoDatetime){
	  	return;
	  	response.writeHead(200, {"Content-Type": "text/html"});
	  	console.log("Serving an HTML form");
	  	
	  	var buffer = fs.readFileSync('./index.html');
		response.write(buffer.toString("utf8", 0, buffer.length));
	
	  	//response.end();
	  }else {
	  	  console.log("Memento-Datetime was served. Done.");
		  response.end();
		}*/
	}
	
	// Initialize the server based and perform the "respond" call back when a client attempts to interact with the script
	http.createServer(respond).listen(PORT);
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
}

Memento.prototype.toString = function(){
	return JSON.stringify(this);
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
	console.log("Getting Memento-Datetime for:\r\n\tURI-R: "+host+pathToFetch+"\r\n\tAccept-Datetime: "+date);
	
 	var options_gmdt = {
	  		host: host,
	  		path: pathToFetch,
	  		port: 80,
	  		method: 'HEAD',
	  	 	headers: {"Accept-Datetime": date}
	  };
	var locationHeader = "";  
	
	trace.push(new HTTPRequest(options_gmdt.method,options_gmdt.host+options_gmdt.path,options_gmdt.headers));
	var req_gmdt = http.request(options_gmdt, function(res_gmdt) {
		trace.push(new HTTPResponse(
			res_gmdt.statusCode,
			{
			 	"Memento-Datetime": res_gmdt.headers['memento-datetime']
			}
		));
		if(res_gmdt.headers['location'] && res_gmdt.statusCode != 200){
			console.log("Received a "+res_gmdt.statusCode+" code, going to "+res_gmdt.headers['location']);
			var locationUrl = url.parse(res_gmdt.headers['location']);
			return getMementoDateTime(uri,date,locationUrl.host,locationUrl.pathname,false,callbacks);
		}else if(!(res_gmdt.headers['memento-datetime'])){ //bad URI, e.g., example.comx
			var jsonErrorCallback = callbacks[callbacks.length - 1];
			if(jsonErrorCallback.name == "returnJSONError"){
				jsonErrorCallback("The URI-R you requested has no mementos.");
			}else {
				console.log("We should have access to the error callback here but did not. Something's not right");
			}
			return;
		}else {
			
			console.log("Memento-Datetime is "+res_gmdt.headers['memento-datetime']);
			for(var cb=0; cb<callbacks.length; cb++){	//execute the callbacks in-order
				var callback = callbacks[cb];
				if(callback.name.indexOf("echoMementoDatetimeToResponse") > -1){
					callback(res_gmdt.headers['memento-datetime']);
				}else if(callback.name.indexOf("closeConnection") > -1){
					//console.log("Closing connection");
					//callback();
					//console.log("Echoing trace");
					//console.log(trace);
				}else if(callback.name == "returnJSONError"){
					//returnJSONError() available but not needed in this context though critical to be on the tail-end of the callback list.
				}else if(callback.name == "getTimemapCallback"){
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
	var t;
	var promise = new Promise(function(resolve, reject){
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
						response.write("\"TimeMap\": "+t.toString("utf8", 0, t.mementos.length)+"}");
				
						console.log("Fetching HTML for "+t.mementos.length+" mementos.");
				
						//fetchHTML(t.mementos,0);
						var m1 = url.parse(t.mementos[0].uri);
						var m2 = url.parse(t.mementos[1].uri);
						var endpoints = [
							{host: m1.host, path: m1.path},
							{host: m2.host, path: m2.path}
						];

						//next(res, d, 0);
						resolve(0);
						callback(); //call connection close
					}
				});
			  });
	  
			req.on('error', function(e) { // Houston...
			  console.log('problem with request: ' + e.message);
			  console.log(e);
			});
			req.on('socket', function (socket) { // slow connection is slow
				socket.setTimeout(3000);  
				socket.on('timeout', function() {
					console.log("The server took too long to respond and we're only getting older so we aborted.");
					req.abort();
				});
			});
	
			req.end();
	 });
	 promise
	 .then(printSimhash)
	 .then(printSimhash)
	 .then(printSimhash)
	 .then(printSimhash)
	 .then(printSimhash)
	 .then(printSimhash)
	 .then(printSimhash)
	 .then(printSimhash)
	 .then(printSimhash)
	 .then(printSimhash)
	 .then(printSimhash)
	 .then(printSimhash)
	 .then(printSimhash)
	 .then(printSimhash)
	 .then(printSimhash)
	 .then(gameOverMan);
	 
	 var srcs = [];
	 var simhashes = [];
	 function printSimhash(i){
	 	res = null;
	 	var mOptions = url.parse(t.mementos[i].uri);
	 	//console.log(i+": "+mOptions.host+" "+mOptions.path);
	 	var buffer2 = "";
	 	var req = http.request({host: mOptions.host, path: mOptions.path}, function(res) {
			res.setEncoding('utf8');
			res.on('data', function (data) {
				buffer2 += data.toString();
			});
			res.on('end',function(d){
				srcs.push(buffer2);
				var sh = simhash((buffer2).split('')).join('');
				console.log("Hash: "+getHexString(sh)+"  SrcLen: "+buffer2.length+"  Src: "+t.mementos[i].uri+"  statusCode: "+res.statusCode);
				buffer2 = "";
				simhashes.push(sh);;
				//console.log(simhashes);
			});
	 	});
	 	req.end();
	 	buffer2 = "";
	 	return i+1;
	 	//next(res, d, i+1);
	 }
	 
	 
	 function gameOverMan(){
	 	//console.log(srcs[srcs.length-1] == srcs[srcs.length-4]);
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
