// order.js
// =======
// Defines an order made by a user throught a payment method

// Dependencies
// ------------
var mongoose = require("mongoose");
var Schema = mongoose.Schema;
var shared = require('habitrpg-shared');

// Order Schema
//-------------

var OrderSchema = new Schema({
	// Use the id generated by mongodb
	buyer : {type : String, ref : 'User'},
	paymentMethod : {type : String}, //enum: ['Paypal','Stripe','BitPay', '']}
	// true when the user payment is received and is due is transfered to his account
	processed : { type : Boolean, 'default' : false},
	// field to save some data from the payment method
	paymentMethodData : {type : String}
});

// Order exports
//--------------

module.exports.schema = OrderSchema;
module.exports.model = mongoose.model("Order", OrderSchema);