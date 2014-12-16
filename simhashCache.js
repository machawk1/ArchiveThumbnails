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
		
		this.exists = function(){
			console.log("This is not the right thing to do. exists() is async and requires a callback. Change flow of caller");
			fs.exists(this.path,function(){});
		}
}

module.exports = {
	SimhashCacheFile : SimhashCacheFile
}