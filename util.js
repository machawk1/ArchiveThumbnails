$(document).ready(function(){
  console.log(returnedJSON);
  //var str = "<table>";
  var cfstr = "<div id=\"coverflow\">";
  for(var i=0; i<returnedJSON.length; i++){
  	if(i != 0  && returnedJSON[i].hammingDistance < 4){continue;} //don't show the low hamming distance images in coverflow
  	
  	console.log(i);
  	
  	//str += "<tr><td><img width=50 height=50 src='http://localhost:1338/spinner.gif' title='http://localhost:1338/"+returnedJSON[i].screenshotURI+"' /></td><td>"+returnedJSON[i].datetime+"</td><td>"+returnedJSON[i].uri+"</td></tr>";
    cfstr += "<div class=\"image-block\" data-hammingDistance=\""+returnedJSON[i].hammingDistance+"\">";
    cfstr += "<img onError=\"this.onerror=null;checkAgainIfImageExists(this);this.src='http://localhost:1338/_images/spinner2.gif';\" width=200 height=200 src='http://localhost:1338/_images/spinner.gif' id='"+returnedJSON[i].screenshotURI.slice(0,-4)+"_200"+"' title='http://localhost:1338/screenshots/"+returnedJSON[i].screenshotURI.replace(".png","_200.png")+"' />\r\n";
	cfstr += "<div class=\"caption\">";
	cfstr += "<h2>"+returnedJSON[i].datetime+"</h2>";
	cfstr += "<h2><a target=\"_blank\" href=\""+returnedJSON[i].uri+"\">"+returnedJSON[i].uri+"</a></h2>";
	cfstr += "<h2>SimHash: "+returnedJSON[i].simhash+"</h2>";
	cfstr += "<h2>Hamming Distance: "+(returnedJSON[i].hammingDistance ? returnedJSON[i].hammingDistance: "N/A")+"</h2>";
	cfstr += "</div>"; /* End caption, ideally this should use figure and figcaption tags */
	cfstr += "<div class=\"reflection\">";
  	cfstr += "<img width=200 height=200 src='http://localhost:1338/_images/spinner.gif' id='"+returnedJSON[i].screenshotURI.slice(0,-4)+"_reflection' title='http://localhost:1338/screenshots/"+returnedJSON[i].screenshotURI.replace(".png","_200.png")+"' />\r\n";
    cfstr += "<div class=\"overlay\"></div>";
    cfstr += "</div>";
    cfstr += "</div>";
  }

  //str += "</table>";
  cfstr += "</div>";
  //$('body').append(str);
  $('body').append(cfstr);
  $('#showJSON').click(function(){
  	if($('#json').length){$("#json").remove(); $(this).html("Show JSON"); return;}
  	$('body').append("<textarea id=\"json\">"+JSON.stringify(returnedJSON,undefined, 2)+"</textarea>");
	$(this).html("Hide JSON"); 
  });
  
  var beforeCount = $("div.image-block").length;
  
  //dim those with low hamming distance, UPDATE: this is now done server-side
  //$("div.image-block").filter(function() {
  //	return $(this).attr("data-hammingDistance") < "4";
  //}).remove();
  
  var afterCount = $("div.image-block").length;
  
  
  $('#coverflow').coverflow({'active':Math.floor($("#coverflow").children().length/2),//{'overlap': 0.7, 'duration': 300}
  	'beforeSelect':function(e,i){
  		alert(e);
  	}
  });
  
  // Get the subset of images that are ready, delay loading the rest while the server reprocesses
  $('img').each(function(){
  	var title = $(this).attr("title");
    //var displayImage = (title.substr(-4) != "null");
    $(this).fadeOut(400,function(){;

     // if(displayImage){ //don't do a title/src swap for images w/ hamming distance that didn't make the threshold cut
	  	$(this).attr('src',$(this).attr('title'));
	  //}else {
	  //	$(this).parent().addClass("insufficientHamming").css("display","none");
	 // }
	}).fadeIn(400);
  });
  
  //$("body").append("<p id=\"count\">"+afterCount+" of "+beforeCount+" mementos displayed due to thumbnail summarization.</p>");
  $("body").append("<p id=\"count\">"+metadata+"</p>");
  
  $("body").append("<ul id=\"viewSwitcher\"><li class=\"active\"><a id=\"switcher_coverFlow\">CoverFlow</a></li><li><a id=\"switcher_gridView\">Grid View</a></li><li><a id=\"switcher_timeline\">Timeline</a></li><!--<li><a id=\"switcher_anotherView\">Another View</a></li>--></ul>");
  $("#viewSwitcher li a").click(function(){ //activate view
  	if($(this).parent().hasClass("active")){return;} //do nothing if the current view button is clicked
  	
  	$(".active").removeClass("active");
  	$(this).parent().addClass("active");
  	if($(this).attr("id") == "switcher_gridView" && $("#gv").length == 0){
  		var cf = $("#coverflow");
  		var gv = cf.clone();
  		gv.attr("id","gv");
  		gv.removeClass();
  		gv.css("width","100%").fadeOut();
  		gv.children().removeAttr("class").removeAttr("style").css("float","left").css("display","block");

  		$("#coverflow").after(gv);
  		$("#gv .reflection").remove(); //can't use the selector until it's attached to the DOM
  		$("#gv div").css("border","1px solid black");
  		$("#gv div img").css("background-color","white");
  		$("#gv div").addClass("f1_container");
  		
  		$("#gv > div").each(function(){
  			$(this).append("<figure class=\"shadow f1_card\" style=\"width: 25px;\"><div class=\"font face\">"+$(this).html()+"</div><figcaption class=\"back face center\">"+$($(this).find(".caption")[0]).html()+"</figcaption></figure>");
  			//$(this).append("<figure>"+$(this).html()+"</figure>");
  			
  			$(this).find(".caption").remove();
  			$(this).children("img").remove();
  		});
  		$("#gv").append("<br style=\"clear: both;\" />");
  		
  		$('.f1_container').click(function() {
			$(this).toggleClass('active');
		});
  		
  		
  		/*$("#gv div img").mouseover(function(){
  			var txt = "<div class=\"hoverText\">"+$(this).next().html()+"</div>";
  			$(txt).insertBefore($(this));
  		}).mouseout(function(){
  			$(".hoverText").remove();
  		});*/
  		$("#coverflow").fadeOut();
  		$("#timeline").fadeOut();
  		$("#gv").fadeIn();
  	}else if($(this).attr("id") == "switcher_coverFlow"){
  		$("#gv").fadeOut();
  		$("#timeline").fadeOut();
  		$("#coverflow").fadeIn();
  	}else if($(this).attr("id") == "switcher_gridView"){
  		$("#coverflow").fadeOut();
  		$("#timeline").fadeOut();
  		$("#gv").fadeIn();
  	}else if($(this).attr("id") == "switcher_timeline"){
  		$("#coverflow").fadeOut();
  		$("#gv").fadeOut();
  		$("#timeline").fadeIn();
  	}
  	
  });
  
  var data = [];
  
  for(var i=0; i<returnedJSON.length; i++){
  	var memento = {
  		id: i, 
  		type: "point", 
  		start: new Date(returnedJSON[i].datetime),
  		stack: false,
  		zoomMax: 94670778000,
  		zoomMin: 10000
  	};
  	
  	var inSummarization = []; var notInSummarization = [];
  	if(returnedJSON[i].hammingDistance < 4 && i!=0){
  		console.log("Draw white dot, not included, for "+returnedJSON[i].datetime);
  		memento.className = "notInSummarization";
  		memento.content = "";//returnedJSON[i].datetime;
  		//memento.content = returnedJSON[i].datetime;
  		notInSummarization.push(memento);
	}else  {
		console.log("Draw black dot, included, for "+returnedJSON[i].datetime);
		memento.className = "inSummarization";
		memento.content = "<img src=\"screenshots/"+returnedJSON[i].screenshotURI.replace(".png","_200.png")+"\" width=\"25\" height=\"25\" />&nbsp;"+returnedJSON[i].datetime;
		inSummarization.push(memento);
	}
	data.push(memento);
	memento = null;
  }

  var options = {height: '300px'};//{stack: false,};
  $("body").append("<div id=\"timeline\"></div>");
  var container = document.getElementById('timeline');
  var timeline = new vis.Timeline(container, new vis.DataSet(data), options);

  
});


function checkAgainIfImageExists(imgIn){
	console.log("running checkAgainIfImageExists()");
	console.log(imgIn);
	console.log($(imgIn).attr("id")+"A");
	setTimeout(replaceImageIfAvailable,3000,$(imgIn));
}

function replaceImageIfAvailable(img){
	var src = $(img).attr("title");

	$.ajax({
		url: src
	}).success(function(){
		$("#"+$(img).attr("id")).attr("src",src);
		$("#"+$(img).attr("id")+"_reflection").attr("src",src);
	}).fail(function(){ //if the image has not been generated yet, this 404 will cause a CORS problem, disregard it.
		console.log("Failed. The image might not be generated yet. Trying again in 3.");
		setTimeout(replaceImageIfAvailable,3000,$(img));
	});
}