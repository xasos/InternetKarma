/**
 * Module dependencies.
 */
var express = require('express');
var cookieParser = require('cookie-parser');
var compress = require('compression');
var favicon = require('serve-favicon');
var session = require('express-session');
var bodyParser = require('body-parser');
var logger = require('morgan');
var errorHandler = require('errorhandler');
var lusca = require('lusca');
var methodOverride = require('method-override');

var _ = require('lodash');
var MongoStore = require('connect-mongo')(session);
var flash = require('express-flash');
var path = require('path');
var mongoose = require('mongoose');
var passport = require('passport');
var expressValidator = require('express-validator');
var assets = require('connect-assets');


var secrets = require('./config/secrets');
var querystring = require('querystring');
var validator = require('validator');
var async = require('async');
var cheerio = require('cheerio');
var request = require('request');
var graph = require('fbgraph');
var LastFmNode = require('lastfm').LastFmNode;
var tumblr = require('tumblr.js');
var foursquare = require('node-foursquare')({ secrets: secrets.foursquare });
var Github = require('github-api');
var Twit = require('twit');
var stripe = require('stripe')(secrets.stripe.secretKey);
var twilio = require('twilio')(secrets.twilio.sid, secrets.twilio.token);
var Linkedin = require('node-linkedin')(secrets.linkedin.clientID, secrets.linkedin.clientSecret, secrets.linkedin.callbackURL);
var BitGo = require('bitgo');
var clockwork = require('clockwork')({ key: secrets.clockwork.apiKey });
var paypal = require('paypal-rest-sdk');
var lob = require('lob')(secrets.lob.apiKey);
var ig = require('instagram-node').instagram();
var Y = require('yui/yql');
var _ = require('lodash');
var Bitcore = require('bitcore');
var BitcoreInsight = require('bitcore-explorers').Insight;
var Promise = require('bluebird');
var await = require('asyncawait/await');
var async2 = require('asyncawait/async');
Bitcore.Networks.defaultNetwork = secrets.bitcore.bitcoinNetwork == 'testnet' ? Bitcore.Networks.testnet : Bitcore.Networks.mainnet;


var User = require('./models/User');
var Data = require('./models/Data');



/**
 * Controllers (route handlers).
 */
var homeController = require('./controllers/home');
var userController = require('./controllers/user');
var apiController = require('./controllers/api');
var contactController = require('./controllers/contact');

/**
 * API keys and Passport configuration.
 */
var secrets = require('./config/secrets');
var passportConf = require('./config/passport');

/**
 * Create Express server.
 */
var app = express();
// var server = require('http').Server(app);

// var io = require('socket.io')(server);



/**
 * Connect to MongoDB.
 */
mongoose.connect(secrets.db);
mongoose.connection.on('error', function() {
  console.error('MongoDB Connection Error. Please make sure that MongoDB is running.');
});

/**
 * Express configuration.
 */
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(compress());
app.use(assets({
  paths: ['public/css', 'public/js']
}));
app.use(logger('dev'));
app.use(favicon(path.join(__dirname, 'public/favicon.png')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressValidator());
app.use(methodOverride());
app.use(cookieParser());
app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: secrets.sessionSecret,
  store: new MongoStore({ url: secrets.db, autoReconnect: true })
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use(lusca({
  csrf: true,
  xframe: 'SAMEORIGIN',
  xssProtection: true
}));
app.use(function(req, res, next) {
  res.locals.user = req.user;
  next();
});
app.use(function(req, res, next) {
  if (/api/i.test(req.path)) req.session.returnTo = req.path;
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 31557600000 }));


countLikes = function(posts, callback)
{
  // console.log('actually called countLikes');
  if (!posts)
  {
    // console.log('no posts');
    return 0;
  }
  // console.log('\n\ncalled count likes');
  // console.log('\n'+JSON.stringify(posts)+'\n');
  var count = 0;
  async.parallel(
    posts.data.map(function(post){
      return function(done2){
        graph.get(post.id + '/likes?summary=true', function(err, likes){
          // console.log(JSON.stringify(likes));
          if (likes)
          {
            if (likes.summary)
            {
              // console.log(likes.summary.total_count);
              count += likes.summary.total_count;
            }
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

function getLikeCount(url, callback, req) {
  // console.log("initial getLikeCount");
  getLikeCountImpl(url, callback, 0, req);
}

function getLikeCountImpl(url, userCallback, currentLikeCount, req) {
  console.log('fb: ' + currentLikeCount);
  // app.io.in(req.user.facebook).emit(currentLikeCount);
  // app.sendMessage(req, currentLikeCount);
  graph.get(url, function(err, posts) 
  {
    // console.log('called graph.get');
    // console.log(JSON.stringify(posts));
    countLikes(posts, function(likeCount) {
      // console.log('called count likes');
      if (posts.paging == null) 
      {
        // console.log('no more pages');
        userCallback(null, currentLikeCount + likeCount);
      } 
      else 
      {
        // console.log('more pages');
        getLikeCountImpl(posts.paging.next, userCallback, currentLikeCount + likeCount);
      }
    });
  });
}

function getStarCount(req, callback)
{
  var token = _.find(req.user.tokens, { kind: 'twitter'});
  var T = new Twit({
    consumer_key: secrets.twitter.consumerKey,
    consumer_secret: secrets.twitter.consumerSecret,
    access_token: token.accessToken,
    access_token_secret: token.tokenSecret
  });

  T.get('statuses/user_timeline', { user_id: req.user.twitter, trim_user: true, count: 200, include_rts: false }, function(err, reply) {
    if (err) throw err;
    var count = 0;
    var max_uid = '';
    for (var i = 0; i < reply.length; i++) {
      count += (reply[i].favorite_count);
      max_uid = reply[i].id;
    }
    getStarCount_help(req, callback, count, reply[reply.length-1].id, reply, T);
  });
}

function getStarCount_help(req, callback, currCount, max_uid, reply, twit)
{
  if (reply.length != 0)
  {
    twit.get('statuses/user_timeline', {user_id: req.user.twitter, trim_user: true, max_id: max_uid, count: 200, include_rts: false},
      function(err, reply_fn){
        if (err) throw err;
        var max_uid = '';
        var count = 0;
        for (var i = 0; i < reply.length; i++) {
          count += (reply[i].favorite_count);
          max_uid = reply[i].id;
        }
        console.log("twt: " + (count + currCount));
        if (reply.length != 0)
        {
          getStarCount_help(req, callback, count+currCount, max_uid, reply_fn, twit);
        }
        else
        {
          console.log('done2!!! ' + (count+currCount));
          callback(null, (count+currCount));
        }
      });
  }
  else
  {
    console.log('done!' + currCount);
    callback(null, currCount);
    // twit.get('statuses/user_timeline', {user_id: req.user.twitter, trim_user: true, max_id: max_uid, count: 200, include_rts: false},
    //   function(err, reply){
    //     if (err) throw err;
    //     var count = 0;
    //     for (var i = 0; i < reply.length; i++) {
    //       count += (reply[i].favorite_count);
    //     }
    //     console.log("current: " + (count + currCount));
    //     callback(null, (count+currCount));

    //   }); 
  }
}


app.get('/main', function(req, res, next){
  // apiController.getFacebook();
  res.render('main', {
    title: 'find your place',
    posts: 0
  });
});

app.get('/getByEmail/:email', function(req, res, next){
  console.log('getting: ' + req.params.email);
  Data.findOne({email:req.params.email}, function(err, doc){
    if (err) throw err;
    if (doc)
    {
      res.json({
        fbText: doc.fbText,
        twText: doc.twText,
        ghText: doc.ghText,
        instText: doc.instText,
        redditText: doc.redditText,
        totalText: doc.totalText
      });
      res.end();
    }
  });
});

app.get('/calc', function(req, res, next){
  var likes = 0;
  var twts = 0;
  var gh = 0;
  async.parallel({
    getLikes: function(done){
      getLikesMASTER(req, res, next, done);
      // done(null, 1000);
    },
    getGHStars: function(done){
      var token = _.find(req.user.tokens, { kind: 'github' });
      var github = new Github({ token: token.accessToken });
      var user = github.getUser();
      var userRepos = [];
      var stars = 0;
      user.repos(function(err, repos) {
        if (err) return;
        repos.forEach(function(entry) {
          stars += entry.stargazers_count;
        });
        console.log("Github done: " + stars);
        done(null, stars);
      });
    },
    getTWStars: function(done){
      getStarCount(req, done);
      // done(null, 2000);
    },
    getInstLikes: function(done){
      var token = _.find(req.user.tokens, { kind: 'instagram' });
      var count = 0;
      ig.use({ client_id: secrets.instagram.clientID, client_secret: secrets.instagram.clientSecret });
      ig.use({ access_token: token.accessToken });
      async.parallel({
        myRecentMedia: function(done) {
          ig.user_self_media_recent(function(err, medias, content, limit) {
            for (var i = 0; i < medias.length; i++) {
              count += medias[i].likes.count;
            }
            done(err, count);
          });
        }
      }, function(err, results) {
        if (err) return next(err);
        console.log("Inst: " + results.myRecentMedia);
        done(err, results.myRecentMedia);
      });
    },
    getRedditKarma: function(done){
      console.log('reddit user: ' + req.user.reddit);
      var redditUsername = req.user.reddit;
      var redditURL = "https://www.reddit.com/user/" + redditUsername + "/about.json";
      var score = 0;

      request(redditURL, function (error, response, body) {
       if (!error && response.statusCode == 200) {
         userData = JSON.parse(body);
         score = parseFloat(userData.data.comment_karma) + parseFloat(userData.data.link_karma);
         console.log('reddit done: ' + score);
         done(null, score);
       }
      });
    }
    }, function(err, results){
    total = results.getLikes + results.getTWStars + results.getGHStars + results.getInstLikes + results.getRedditKarma;
    Data.findOne({id:req.user.facebook}, function(err, doc){
      if (err) throw err;
      graph.get(req.user.facebook + '?fields=id,name,email', function(err, me) {
        console.log("ME: " + JSON.stringify(me));
        if (doc)
        {
          doc.email = me.email;
          doc.fbText = results.getLikes;
          doc.twText = results.getTWStars; 
          doc.ghText = results.getGHStars; 
          doc.instText = results.getInstLikes;
          doc.redditText = results.getRedditKarma;
          doc.totalText = total;
          doc.save();
          

          // Data.update({id:req.user.facebook},{
          //   fbText: results.getLikes, 
          //   twText: results.getTWStars, 
          //   ghText: results.getGHStars, 
          //   totalText: total
          //   }, function(err){console.log(err);}
          // );
        }
        else
        {
          Data.create({
            id: req.user.facebook,
            email: me.email,
            fbText: results.getLikes,
            twText: results.getTWStars,
            ghText: results.getGHStars,
            instText: results.getInstLikes,
            redditText: results.getRedditKarma,
            totalText: total
          });
        }
      });
    });
    

    // User.findById(req.user.id, function(err, doc){
    //   if (err) throw err;
    //   if (doc)
    //   {
    //     doc.update({$set: {fbText: results.getLikes, twText: results.getTWStars, ghText: results.getGHStars}});
    //   }
    // });
    res.json({
      fbText: results.getLikes,
      twText: results.getTWStars,
      ghText: results.getGHStars,
      instText: results.getInstLikes,
      redditText: results.getRedditKarma,
      totalText: total
    });
    res.end();
  });
  // var likes = getLikesMASTER(req, res, next);
});

getLikesMASTER = function(req, res, next, callback) {
  var token = _.find(req.user.tokens, { kind: 'facebook' });
  graph.setAccessToken(token.accessToken);
  getLikeCount('me/posts', callback, req);
};



/**
 * Primary app routes.
 */
app.get('/', homeController.index);
app.get('/login', userController.getLogin);
app.post('/login', userController.postLogin);
app.get('/logout', userController.logout);
app.get('/forgot', userController.getForgot);
app.post('/forgot', userController.postForgot);
app.get('/reset/:token', userController.getReset);
app.post('/reset/:token', userController.postReset);
app.get('/signup', userController.getSignup);
app.post('/signup', userController.postSignup);
app.get('/contact', contactController.getContact);
app.post('/contact', contactController.postContact);
app.get('/account', passportConf.isAuthenticated, userController.getAccount);
app.post('/account/profile', passportConf.isAuthenticated, userController.postUpdateProfile);
app.post('/account/password', passportConf.isAuthenticated, userController.postUpdatePassword);
app.post('/account/delete', passportConf.isAuthenticated, userController.postDeleteAccount);
app.get('/account/unlink/:provider', passportConf.isAuthenticated, userController.getOauthUnlink);

app.get('/fbid/:username', apiController.getFBID);

/**
 * API examples routes.
 */
app.get('/api', apiController.getApi);
app.get('/user/:uid', apiController.getUserInfo)
app.get('/fakefollowers', apiController.fakeFollowers);
app.get('/api/lastfm', apiController.getLastfm);
app.get('/api/nyt', apiController.getNewYorkTimes);
app.get('/api/aviary', apiController.getAviary);
app.get('/api/steam', apiController.getSteam);
app.get('/api/stripe', apiController.getStripe);
app.post('/api/stripe', apiController.postStripe);
app.get('/api/scraping', apiController.getScraping);
app.get('/api/twilio', apiController.getTwilio);
app.post('/api/twilio', apiController.postTwilio);
app.get('/api/clockwork', apiController.getClockwork);
app.post('/api/clockwork', apiController.postClockwork);
app.get('/api/foursquare', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.getFoursquare);
app.get('/api/tumblr', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.getTumblr);
app.get('/api/facebook', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.getFacebook);
// app.get('/main', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.getFacebook);
app.get('/api/github', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.getGithub);
app.get('/api/twitter', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.getTwitter);
app.post('/api/twitter', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.postTwitter);
app.get('/api/venmo', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.getVenmo);
app.post('/api/venmo', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.postVenmo);
app.get('/api/linkedin', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.getLinkedin);
app.get('/api/instagram', passportConf.isAuthenticated, passportConf.isAuthorized, apiController.getInstagram);
app.get('/api/yahoo', apiController.getYahoo);
app.get('/api/paypal', apiController.getPayPal);
app.get('/api/paypal/success', apiController.getPayPalSuccess);
app.get('/api/paypal/cancel', apiController.getPayPalCancel);
app.get('/api/lob', apiController.getLob);
app.get('/api/bitgo', apiController.getBitGo);
app.post('/api/bitgo', apiController.postBitGo);
app.get('/api/bitcore', apiController.getBitcore);
app.post('/api/bitcore', apiController.postBitcore);

/**
 * OAuth authentication routes. (Sign in)
 */
app.get('/auth/instagram', passport.authenticate('instagram'));
app.get('/auth/instagram/callback', passport.authenticate('instagram', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email', 'user_posts'] }));
app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/github', passport.authenticate('github'));
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/google', passport.authenticate('google', { scope: 'profile email' }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/twitter', passport.authenticate('twitter'));
app.get('/auth/twitter/callback', passport.authenticate('twitter', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/linkedin', passport.authenticate('linkedin', { state: 'SOME STATE' }));
app.get('/auth/linkedin/callback', passport.authenticate('linkedin', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});

/**
 * OAuth authorization routes. (API examples)
 */
app.get('/auth/foursquare', passport.authorize('foursquare'));
app.get('/auth/foursquare/callback', passport.authorize('foursquare', { failureRedirect: '/api' }), function(req, res) {
  res.redirect('/api/foursquare');
});
app.get('/auth/tumblr', passport.authorize('tumblr'));
app.get('/auth/tumblr/callback', passport.authorize('tumblr', { failureRedirect: '/api' }), function(req, res) {
  res.redirect('/api/tumblr');
});
app.get('/auth/venmo', passport.authorize('venmo', { scope: 'make_payments access_profile access_balance access_email access_phone' }));
app.get('/auth/venmo/callback', passport.authorize('venmo', { failureRedirect: '/api' }), function(req, res) {
  res.redirect('/api/venmo');
});


/**
 * Error Handler.
 */
app.use(errorHandler());

/**
 * Start Express server.
 */
app.listen(app.get('port'), function() {
  console.log('Express server listening on port %d in %s mode', app.get('port'), app.get('env'));
});

module.exports = app;

// server.listen(80);
// module.exports = {
//   initSocket: function(req) {
//     if (req)
//     {
//       io.in('connection', function(socket){
//         socket.join(req.user.facebook);
//         console.log('a user connected\n' + req.user.facebook);
//       });
//     }
//   },
//   sendSocket: function(req, data){
//     if (req)
//     {
//       io.in(req.user.facebook).emit(data);
//     }
//   },
//   app: app
// };