$(document).ready(function(){
  console.log(returnedJSON);
  //var str = "<table>";
  var cfstr = "<div id=\"coverflow\">";
  for(var i=0; i<returnedJSON.length; i++){
  	//str += "<tr><td><img width=50 height=50 src='http://localhost:1338/spinner.gif' title='http://localhost:1338/"+returnedJSON[i].screenshotURI+"' /></td><td>"+returnedJSON[i].datetime+"</td><td>"+returnedJSON[i].uri+"</td></tr>";
    cfstr += "<div class=\"image-block\">";
    cfstr += "<img width=200 height=200 src='http://localhost:1338/spinner.gif' title='http://localhost:1338/"+returnedJSON[i].screenshotURI+"' />\r\n";
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
  $('#coverflow').coverflow({'active':Math.floor($("#coverflow").children().length/2)});//{'overlap': 0.7, 'duration': 300}
  
  
  // Get the subset of images that are ready, delay loading the rest while the server reprocesses
  $('img').each(function(){
    $(this).fadeOut(400,function(){;
	  $(this).attr('src',$(this).attr('title'));
	}).fadeIn(400);
  });

    

  
});
