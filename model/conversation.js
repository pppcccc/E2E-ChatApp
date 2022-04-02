const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    burn_timer:{
      type: Number,
      required: true
    },
    sender: {
      type: String,
      required: true
    },
    msg: {
      type: String,
      required: true,
      default: ''
    },
    createdAt: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }
);

const ConversationSchema = new mongoose.Schema({
    sender: {
      type: String,
      required: true
    },
    recepient:{
      type: String,
      required: true
    },
    messages: [MessageSchema]
  },
    { collection: "Conversations" }
);

module.exports = mongoose.model('Conversation', ConversationSchema);
