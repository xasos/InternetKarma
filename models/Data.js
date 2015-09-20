var mongoose = require('mongoose');

var dataSchema = new mongoose.Schema
({
	id: Number,
	email: String,
	fbText: Number,
	fbHistory: Array,
	twText: Number,
	twHistory: Array,
	ghText: Number,
	instText: Number,
	redditText: Number,
	totalText: Number
});

module.exports = mongoose.model('Data', dataSchema);