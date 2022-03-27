// Importing modules
const mongoose = require("mongoose");
var crypto = require('crypto');

// Creating user schema
const UserSchema = new mongoose.Schema({
    username: {
      type: String,
      required: true
    },
    publickey:{
      type: String,
      required: true
    },
    hash : String,
    salt : String
  },
    { collection: "Users" }
);


UserSchema.methods.set_word_phrase = function(word_phrase) {
    this.salt = crypto.randomBytes(16).toString('hex');
    this.hash = crypto.pbkdf2Sync(word_phrase, this.salt,
    1000, 64, `sha512`).toString(`hex`);

    // console.log(`Made Salt And Hash\n${this.salt}, ${this.hash}`)
};

UserSchema.methods.set_public_key = function(public_key) {
    this.publickey = public_key;
}

UserSchema.methods.valid_phrase = function(word_phrase) {
    var _hash = crypto.pbkdf2Sync(word_phrase,
    this.salt, 1000, 64, `sha512`).toString(`hex`);
    return this.hash === _hash;
};

// Exporting module to allow it to be imported in other files
module.exports = mongoose.model('User', UserSchema);
