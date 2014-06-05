$(document).ready(function(){
  console.log(returnedJSON);
  //var str = "<table>";
  var cfstr = "<div id=\"coverflow\">";
  for(var i=0; i<returnedJSON.length; i++){
  	//str += "<tr><td><img width=50 height=50 src='http://localhost:1338/spinner.gif' title='http://localhost:1338/"+returnedJSON[i].screenshotURI+"' /></td><td>"+returnedJSON[i].datetime+"</td><td>"+returnedJSON[i].uri+"</td></tr>";
    cfstr += "<div class=\"image-block\" data-hammingDistance=\""+returnedJSON[i].hammingDistance+"\">";
    cfstr += "<img width=200 height=200 src='http://localhost:1338/spinner.gif' title='http://localhost:1338/"+returnedJSON[i].screenshotURI+"' />\r\n";
	cfstr += "<div class=\"caption\">";
	cfstr += "<h2>"+returnedJSON[i].datetime+"</h2>";
	cfstr += "<h2><a target=\"_blank\" href=\""+returnedJSON[i].uri+"\">"+returnedJSON[i].uri+"</a></h2>";
	cfstr += "<h2>SimHash: "+returnedJSON[i].simhash+"</h2>";
	cfstr += "<h2>Hamming Distance: "+(returnedJSON[i].hammingDistance?returnedJSON[i].hammingDistance:"N/A")+"</h2>";
	cfstr += "</div>"; /* End caption, ideally this should use figure and figcaption tags */
	cfstr += "<div class=\"reflection\">";
  	cfstr += "<img width=200 height=200 src='http://localhost:1338/spinner.gif' title='http://localhost:1338/"+returnedJSON[i].screenshotURI+"' />\r\n";
    cfstr += "<div class=\"overlay\"></div>";
    cfstr += "</div>";
    cfstr += "</div>";
  }
  //str += "</table>";
  cfstr += "</div>";
  //$('body').append(str);
  $('body').append(cfstr);
  
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
    $(this).fadeOut(400,function(){;
	  $(this).attr('src',$(this).attr('title'));
	}).fadeIn(400);
  });
  
  //$("body").append("<p id=\"count\">"+afterCount+" of "+beforeCount+" mementos displayed due to thumbnail summarization.</p>");
  $("body").append("<p id=\"count\">"+metadata+"</p>");
  
  $("body").append("<ul id=\"viewSwitcher\"><li class=\"active\"><a id=\"switcher_coverFlow\">CoverFlow</a></li><li><a id=\"switcher_gridView\">Grid View</a></li><li><a id=\"switcher_anotherView\">Another View</a></li></ul>");
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
  		$("#coverflow").fadeOut();
  		$("#gv").fadeIn();
  	}else if($(this).attr("id") == "switcher_coverFlow"){
  		$("#gv").fadeOut();
  		$("#coverflow").fadeIn();
  	}else if($(this).attr("id") == "switcher_gridView"){
  		$("#coverflow").fadeOut();
  		$("#gv").fadeIn();
  	}
  	
  });
    

  
});
