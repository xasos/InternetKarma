 // console.log("POSTS: " + JSON.stringify(posts));

        // async.waterfall([
        //   function(){
        //     posts.data.forEach(function(post){
        //       graph.get(post.id + '/likes?summary=true', function(err, likes){
        //         console.log(JSON.stringify(likes));
        //         console.log(likes.summary.total_count);
        //         count += likes.summary.total_count;
        //       });
        //     });
        //   },
        //   function(){
        //     console.log("COUNT: " + count);
        //     done(err, count);
        //   }
        // ], done);

        // posts.data.forEach(function(post){
        //   graph.get(post.id + '/likes?summary=true', function(err, likes){
        //     console.log(JSON.stringify(likes));
        //     console.log(likes.summary.total_count);
        //     count += likes.summary.total_count;
        //   });
        // });

        // console.log("COUNT: " + count);
        // done(err, count);