$(document).ready(function(){
  console.log(returnedJSON);
  var str = "<table>";
  for(var i=0; i<returnedJSON.length; i++){
  	str += "<tr><td><img width=50 height=50 src='http://localhost:1338/spinner.gif' title='http://localhost:1338/"+returnedJSON[i].screenshotURI+"' /></td><td>"+returnedJSON[i].datetime+"</td><td>"+returnedJSON[i].uri+"</td></tr>";
  }
  str += "</table>";
  $('body').append(str);

  // Get the subset of images that are ready, delay loading the rest while the server reprocesses
  $('img').each(function(){
    $(this).fadeOut(400,function(){;
	  $(this).attr('src',$(this).attr('title'));
	}).fadeIn(400);
  });
});
