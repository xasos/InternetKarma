var Data = require('../models/Data');

exports.index = function(req, res) {

  Data.find({}, function(err, docs) {
  	console.log(JSON.stringify(docs));
  	res.render('ranking', {
  	  docs: docs
  	});
  });

};