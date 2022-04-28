// https://www.mongodb.com/languages/mern-stack-tutorial
// https://www.loginradius.com/blog/async/using-pgp-encryption-with-nodejs/
// https://www.pcworld.com/article/394182/what-is-signal-encrypted-messaging-app.html
// https://www.freecodecamp.org/news/simple-chat-application-in-node-js-using-express-mongoose-and-socket-io-ee62d94f5804/
// https://codepen.io/ThomasDaubenton/pen/QMqaBN
// https://www.section.io/engineering-education/creating-a-real-time-chat-app-with-react-socket-io-with-e2e-encryption/
const express = require("express")
const session = require('express-session');
const mongoose = require("mongoose")
const path = require('path')
const fs = require("fs");
const bodyParser = require('body-parser');
const socketio = require('socket.io')
const http = require('http');

const User = require('../model/user');
const Conversation = require('../model/conversation')
const PORT = process.env.PORT || 5000;
const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/messaging'
const secret_key = process.env.AES256_SECRET_KEY || 'secret key';

var jwt = require('jsonwebtoken');
var bip39 = require('bip39')
var aes256 = require('aes256');

// get env from parent directory
require("dotenv").config({path: path.join(process.cwd(), "..", "cfg.env")})

// Connect to MongoDB
mongoose.connect(URI)

// get the AES256 secret key


// Express server
const app = express()
var server = http.createServer(app);
var io = socketio(server);

app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 365 * 1000
  }
}))

app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static(path.join(__dirname, '../static'), {index: false}))
app.use('/favicon.ico', express.static('images/favicon.ico'));

server.listen(PORT, () => {
  console.log('server is running on port', server.address().port);
  setInterval(deleteOldDocument, 5000)
});


io.on('connection', (socket) =>{
  socket.on('join-room', (data)=> {
    socket.join(data.room)
  })
});

// functions

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function check_authed(req){
  token = req.session.token
  if (token) {
    const user = jwt.decode(token)
    if (!user) {
      req.session.destroy((err) => {
            if(err) {
                console.log(err);
                return false
            }
      });
    } else {
      return true
    }
  }
}

async function find_convo(sender, recepient){
  var c = await Conversation.findOne({sender: sender, recepient: recepient})
  var c2 = await Conversation.findOne({sender: recepient, recepient: sender})
  if (c == null){
    if (c2 == null){
      return null
    } else {
      return c2
    }
  }
  else {
    return c
  }
}

async function get_user_chats(user){
  var users = []
  var convos = await Conversation.find({
    $or:[
      {"sender": user},
      {"recepient": user}
    ]
  })
  for (const c of convos) {
    if (c.sender == user){
      users.push(c.recepient)
    } else {
      users.push(c.sender)
    }
  }

  return users
}

async function deleteOldDocument(sender, recepient) {
  // get all chats expiration time
  //console.log('deleting')
  let convos = await Conversation.find({}).exec()
  for (var convo of convos){
    var msgs = await convo.populate('messages')
    for (let i = 0; i < msgs['messages'].length; i++){
      msg = msgs['messages'][i]
      id = msgs['messages'][i]['_id']
      let time = (msg['timestamp']/1000 + msg['burn_timer'])
      const now = new Date().getTime() / 1000
      if (time < now){
        await convo.messages.pull({_id: id})
        await convo.save()
        /*console.log(`${now} vs ${time}`)
        console.log(`Deleting ${msg['msg']} from ${convo}`)*/
      }
      await sleep(2000);
    }
  }
}


// SERVER ENDPOINTS

app.get('/', async(req,res) => {
  var authed = await check_authed(req)
  if (authed == true){
    token = req.session.token
    username = jwt.decode(token)['username']
    var current_chats = []
    var user_chats = await get_user_chats(username)
    for (const user of user_chats){
      var u = await User.findOne({username: user}).exec()
      await current_chats.push(u)
    }

    res.render('../../views/home.ejs', {username: username, chat_usernames: current_chats})
  } else {
    res.render('../../static/index.ejs')

  }

})


app.post('/login', async(req,res) => {
  const found_user = await User.findOne({username: req.body.username}).exec()
  if (found_user == null){
    return res.render('../../views/error.ejs', {error: 'User does not exist!'})
  } else {
    if (found_user.valid_phrase(req.body.wordphrase)){
      const auth_token = jwt.sign({username: req.body.username}, 'WSP_Project_Spring22')
      req.session.token = auth_token
      return res.redirect('/')

    } else {
      return res.render('../../views/error.ejs', {error: 'Wrong passphrase!'})
    }
  }
})


app.post('/register', async (req,res)=> {
  const found_user = await User.findOne({username: req.body.register_username}).exec()
  if (!found_user){
    let new_user = new User();

    new_user.username = req.body.register_username;
    const mnemonic = `${bip39.generateMnemonic()} ${bip39.generateMnemonic()}`
    new_user.set_word_phrase(mnemonic)

    const auth_token = jwt.sign({username: new_user.username}, 'schoolproject2022')
    req.session.token = auth_token

    new_user.save((err, User) => {
        if (err) {
            res.render('../../views/error.ejs', {error: err})
        }
        else {
            res.render('../../views/registered.ejs', {username: req.body.register_username, mnemonic: mnemonic})
        }
    });
  } else {
    let err = 'User already exists with that name.'
    res.render('../../views/error.ejs', {error: err})
  }

})


app.get('/logout', async (req,res) => {
  var authed = await check_authed(req)
  if (authed == true){
    req.session.destroy((err) => {
          if(err) {
              return console.log(err);
          }
          res.redirect('/');
    })
  } else {
    res.render('../../views/error.ejs', {error: 'Can not log out when you are not logged in!'})
  }
})


app.post('/start_chat', async (req,res) => {
  msg_recepient = req.body.msg_recepient
  var authed = await check_authed(req)
  if (authed == true){
    const found_user = await User.findOne({username: msg_recepient}).exec()
    if (found_user != null){
      res.redirect(`/chat/${msg_recepient}`)
    } else {
      res.render('../../views/error.ejs', {error: 'Can not chat with a user that does not exist!'})
    }
  } else {
    res.render('../../views/error.ejs', {error: 'Please sign in to use the app!'})
  }

})


app.get('/chat/:chat_username', async(req,res) => {
  msg_recepient = req.params.chat_username
  var authed = await check_authed(req)
  if (authed == true){
    token = req.session.token
    sender_name = jwt.decode(token)['username']
    if (msg_recepient){
      const found_user = await User.findOne({username: msg_recepient}).exec()
      if (found_user == null){
        res.render('../../views/error.ejs', {error: 'Can not chat with a user that does not exist!'})
      } else if (sender_name == msg_recepient) {
        res.render('../../views/error.ejs', {error: 'Can not chat with yourself!'})
      } else {
        var convo = await find_convo(sender_name, msg_recepient)
        if (convo == null){
            let new_convo = new Conversation()
            new_convo.sender = sender_name
            new_convo.recepient = msg_recepient
            new_convo.messages = []
            new_convo.save()
        }

        res.render('../../views/chat.ejs')
      }
    } else {
      res.render('../../views/error.ejs', {error: 'Please start a chat with a user!'})
    }
  } else {
    res.render('../../views/error.ejs', {error: 'Please sign in to use the app!'})
  }
})


app.get('/room-id/:chat_username', async(req,res) => {
  msg_recepient = req.params.chat_username
  var authed = await check_authed(req)
  if (authed == true){
    token = req.session.token
    sender_name = jwt.decode(token)['username']
    var convo = await find_convo(sender_name, msg_recepient)
    room_id = convo._id.toString()

    res.send({username: sender_name, room: room_id})
  }
})


app.get('/messages/:msg_recepient', async (req, res) => {
  msg_recepient = req.params.msg_recepient
  var authed = await check_authed(req)
  if (authed == true) {
    token = req.session.token
    sender_name = jwt.decode(token)['username']
    var convo = await find_convo(sender_name, msg_recepient)
    var msgs = await convo.populate('messages')
    let msg_text = []
    for (var msg of msgs['messages']){
      if (msg['msg'].length > 0){
        var decrypted_msg = aes256.decrypt(secret_key, msg['msg'])
        msg_text.push({message: decrypted_msg, timer: msg['burn_timer'], sender: msg['sender'], sent: msg['createdAt']})
      }
    }

    await res.send(msg_text)

  } else {
    res.render("../../views/error.ejs", {error: "Please sign in to use the app!"})
  }
})


app.post('/messages/:msg_recepient', async (req, res) => {
  var authed = await check_authed(req)
  if (authed == true){
    // console.log(timer)
    msg_recepient = req.params.msg_recepient
    token = req.session.token
    sender_name = jwt.decode(token)['username']
    var c = await find_convo(sender_name, msg_recepient)
    if (req.body.message.length > 0){
      let date_ob = new Date();
      let hm = `${date_ob.getHours()}h${date_ob.getMinutes()}`
      let timer = req.body.timer
      let msg_str = req.body.message
      var encrypted_msg = aes256.encrypt(secret_key, msg_str)
      let creation_date = new Date()
      const creation_str = creation_date.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })
      await c.messages.push({burn_timer: timer, sender: sender_name, msg: encrypted_msg, createdAt: creation_str})
      await c.save()
      room_id = c._id.toString()

      io.sockets.in(room_id).emit('message', {message: msg_str, timer: timer, sender: sender_name, sent: creation_str})
    }
  }
})


app.get('/search', async (req,res) => {
  var authed = await check_authed(req)
  if (authed == true){
    res.render("../../views/search.ejs")
  } else {
    res.render("../../views/error.ejs", {error: "Please sign in to use the app!"})
  }
})


app.get('/settings', async (req,res) => {
  var authed = await check_authed(req)
  if (authed == true){
    token = req.session.token
    username = jwt.decode(token)['username']

    res.render('../../views/settings.ejs', {username: username})
  } else {
    res.render("../../views/error.ejs", {error: "Please sign in to use the app!"})
  }
})


app.post('/save_settings', async (req,res) => {
  var authed = await check_authed(req)
  if (authed == true){
    token = req.session.token
    username = jwt.decode(token)['username']
    desired_username = req.body.change_username
    pfp_url = req.body.change_pfp
    var current_user = await User.findOne({username: username}).exec()

    /*
    if (desired_username){
      var desired_user = await User.findOne({username: desired_username}).exec()
      if (!desired_user){
        await current_user.set_username(desired_username)
        await current_user.save()
        const auth_token = jwt.sign({username: desired_username}, 'WSP_Project_Spring22')
        req.session.token = auth_token
      }
    }
    */

    if (pfp_url){
      await current_user.set_profile_picture(pfp_url)
      await current_user.save()
    }

    res.redirect('/')

  } else {
    res.render("../../views/error.ejs", {error: "Please sign in to use the app!"})
  }
})


app.get('*', function(req, res) {
  return res.redirect('/')
});
