countLikes = function(posts, callback)
{
  if (posts.data.length == 0)
  {
    return 0;
  }
  else
  {
    console.log('\n\ncalled count likes');
    console.log('\n'+JSON.stringify(posts)+'\n');
    var count = 0;
    async.parallel(
      posts.data.map(function(post){
        return function(done2){
          graph.get(post.id + '/likes?summary=true', function(err, likes){
            // console.log(JSON.stringify(likes));
            if (likes.summary)
            {
              // console.log(likes.summary.total_count);
              count += likes.summary.total_count;
            }
            done2();
          });
        }}),
      function(){
        // console.log(count);
        callback(count);
      }
    );
  }
}

function getLikeCount(url, callback) {
	getLikeCountImpl(url, callback, 0);
}

function getLikeCountImpl(url, userCallback, currentLikeCount) {
	graph.get(url, function(posts) {
		countLikes(posts, function(likeCount) {
			if (posts.paging === null) {
				userCallback(currentLikeCount + likeCount);
			} else {
				getLikeCountImpl(posts.paging.next, userCallback, currentLikeCount + likeCount);
			}
		});
		
	});
}

getLikeCount('me/posts', function(likeCount) {
	console.log(likeCount);
});
