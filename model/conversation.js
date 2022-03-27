const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema({
    sender: {
      type: String,
      required: true
    },
    recepient:{
      type: String,
      required: true
    },
    messages: [{
      type: String,
      required: true
    }],
    timer:{
      type: Number,
      required: false
    }
  },
    { collection: "Conversations" }
);

module.exports = mongoose.model('Conversation', ConversationSchema);
