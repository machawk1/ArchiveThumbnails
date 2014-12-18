var fs = require("fs");

function SimhashCacheFile(forUri){
		//operation = "replace","append","read"
		
		//TODO, check if it already exists
		this.path = "./simhashes_"+forUri.replace(/[^a-z0-9]/gi, '').toLowerCase();
		
		this.replaceContentWith = function(str){
			console.log("in replaceContentWith()");
			console.log("> deleting old cache file");
			this.deleteCacheFile();
			console.log("> done deleting cache file, writing new contents");
			this.writeFileContents(str);
			console.log("> done writing new contents to cache");
		};
		
		this.writeFileContents = function(str){
			fs.appendFileSync(this.path,str);
			console.log("Wrote simhash to "+this.path);
		};
		
		this.deleteCacheFile = function(){
			//fs.unlinkSync(this.path)
			fs.unlink(this.path,function(){})
		};
		
		this.readFileContents = function(callbackSuccess,callbackFail){
			fs.readFile(this.path,"utf-8",function(err,data){
				if(err){
					//The cache file hasn't been created
					callbackFail();
					return;
				}

				callbackSuccess(data);				
			});
		};
		
		this.exists = function(){
			console.log("This is not the right thing to do. exists() is async and requires a callback. Change flow of caller");
			//fs.exists(this.path,function(){console.log("The cache file at });
		}
}

module.exports = {
	SimhashCacheFile : SimhashCacheFile
}