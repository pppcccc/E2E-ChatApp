const mongoose = require("mongoose");
var crypto = require('crypto');


const UserSchema = new mongoose.Schema({
    username: {
      type: String,
      required: true
    },
    profile_pic_url: {
      type: String,
      default: 'https://t4.ftcdn.net/jpg/00/64/67/63/360_F_64676383_LdbmhiNM6Ypzb3FM4PPuFP9rHe7ri8Ju.jpg'
    },
    hash: String,
    salt: String
  },
    { collection: "Users" }
);


UserSchema.methods.set_word_phrase = function(word_phrase) {
    this.salt = crypto.randomBytes(16).toString('hex');
    this.hash = crypto.pbkdf2Sync(word_phrase, this.salt,
    1000, 64, `sha512`).toString(`hex`);

    // console.log(`Made Salt And Hash\n${this.salt}, ${this.hash}`)
};

UserSchema.methods.set_profile_picture = function(profile_picture_url){
  function checkURL(url) {
    return(url.match(/\.(jpeg|jpg|gif|png)$/) != null);
  }

  if (checkURL(profile_picture_url) == true){
    this.profile_pic_url = profile_picture_url
  }
}

UserSchema.methods.set_username = function(username){
  this.username = username
}

UserSchema.methods.set_public_key = function(public_key) {
    this.publickey = public_key;
}

UserSchema.methods.valid_phrase = function(word_phrase) {
    var _hash = crypto.pbkdf2Sync(word_phrase,
    this.salt, 1000, 64, `sha512`).toString(`hex`);
    return this.hash === _hash;
};


module.exports = mongoose.model('User', UserSchema);
