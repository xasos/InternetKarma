$(document).ready(function(){
	$("#calculate").click(function(){
		// window.location.href = "/calc";
		$.ajax({ 
			url: '/calc',
			type: 'GET'
		}).done(function(data){
			// alert(data);
			$("#fbText").html(data.fbText);
			$("#twText").html(data.twText);
			$("#ghText").html(data.ghText);
			$("#instText").html(data.instText);
			$("#redditText").html(data.redditText);
			$("#totalText").html(data.totalText);
		});
	});
});