// https://www.mongodb.com/languages/mern-stack-tutorial
// https://www.loginradius.com/blog/async/using-pgp-encryption-with-nodejs/
// https://www.pcworld.com/article/394182/what-is-signal-encrypted-messaging-app.html
// https://www.freecodecamp.org/news/simple-chat-application-in-node-js-using-express-mongoose-and-socket-io-ee62d94f5804/
// https://codepen.io/ThomasDaubenton/pen/QMqaBN

require("dotenv").config()
const express = require("express")
const session = require('express-session');
const mongoose = require("mongoose")
const path = require('path')
const fs = require("fs");
const bodyParser = require('body-parser');
const User = require('../model/user');
const Conversation = require('../model/conversation')
const port = process.env.PORT || 5000;
var socketIOClient = require('socket.io-client')
var jwt = require('jsonwebtoken');
var openpgp = require("openpgp")
var bip39 = require('bip39')

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/messaging')


// Express server

const app = express()
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

var http = require('http').createServer(app);
var io = require('socket.io')(http);
// web socket server
io.on('connection', socket =>{
  // console.log(`${socket.id} connected`);
  //console.log(`${username} has connected!`)
  //console.log(socket.handshake.headers)
  socket.on('disconnect', () => {
    console.log(`${socket.id} disconnected`)
  })
});
var server = http.listen(5000, () => {
  console.log('server is running on port', server.address().port);
});

// functions
var genKeyPair = async(username) => {
  var { publicKey, privateKey } = await openpgp.generateKey({
    userIDs: [
      {
        name: `${username}`,
        email: `${username}@m${makeid(25)}.com`
      }
    ],
    curve: 'ed25519',
    passphrase: '',
  });
  return [ publicKey, privateKey ];
}

function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() *
      charactersLength));
   }
   return result;
}

async function pgp_encrypt(msg, _publicKey) {
  //console.log(`Raw Message: ${msg}`)
  const publicKey = await openpgp.readKey({ armoredKey: _publicKey });
  const encrypted = await openpgp.encrypt({
    message: await openpgp.createMessage({ text: msg }),
    encryptionKeys: publicKey
  });

  //console.log(`Encrypted Message: ${encrypted}`)
  return encrypted
}

async function pgp_decrypt(encrypted, _privateKey, passphrase){
  //console.log(`Encrypted Message: ${encrypted}`)

  const privateKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({ armoredKey: _privateKey }),
        passphrase
  });

  const message = await openpgp.readMessage({
        armoredMessage: encrypted // parse armored message
  });

  const { data: decrypted, signatures } = await openpgp.decrypt({
        message,
        decryptionKeys: privateKey
  });

  //console.log(`Decrypted Message: ${decrypted}`)
  return decrypted
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

// SERVER ENDPOINTS
app.get('/chat/:chat_username', async(req,res) => {
  msg_recepient = req.params.chat_username
  var authed = await check_authed(req)
  if (authed == true){
    token = req.session.token
    sender_name = jwt.decode(token)['username']
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

      return res.render('../../views/chat.ejs')
    }
  } else {
    res.render('../../views/error.ejs', {error: 'Please sign in to use the app!'})
  }
})


app.get('/messages/:msg_recepient', async (req, res) => {
  msg_recepient = req.params.msg_recepient
  var authed = await check_authed(req)
  if (authed == true) {
    token = req.session.token
    sender_name = jwt.decode(token)['username']
    var convo = await find_convo(sender_name, msg_recepient)
    res.send(convo.messages)

  } else {
    res.render("../../views/error.ejs", {error: "Please sign in to use the app!"})
  }
})


app.post('/messages/:msg_recepient', async (req, res) => {
  var authed = await check_authed(req)
  if (authed == true){
    let date_ob = new Date();
    let hm = `${date_ob.getHours()}h${date_ob.getMinutes()}`
    msg_recepient = req.params.msg_recepient
    token = req.session.token
    sender_name = jwt.decode(token)['username']
    var c = await find_convo(sender_name, msg_recepient)
    if (req.body.message.length > 0){
      let msg_str = `${sender_name};^; ${req.body.message};^; ${hm}`
      await c.messages.push(msg_str)
      await c.save()
      io.emit('message', msg_str);
    }
  }
})


app.get('/', async(req,res) => {
  var authed = await check_authed(req)
  if (authed == true){
    token = req.session.token
    username = jwt.decode(token)['username']
    // console.log(username)
    var current_chats = await get_user_chats(username)
    res.render('../../views/home.ejs', {username: username, chat_usernames: current_chats})
  } else {
    res.render('../../static/index.ejs')

  }

})


app.get('/logout', async (req,res) => {
  req.session.destroy((err) => {
        if(err) {
            return console.log(err);
        }
        res.redirect('/');
  });
})


app.get('/search', async (req,res) => {
  var authed = await check_authed(req)
  if (authed == true){
    res.render("../../views/search.ejs")
  } else {
    res.render("../../views/error.ejs", {error: "Please sign in to use the app!"})
  }
})


app.post('/login', async(req,res) => {
  const found_user = await User.findOne({username: req.body.username}).exec()
  if (found_user == null){
    return res.json({status: 'does not exist', user: false})
  } else {
    if (found_user.valid_phrase(req.body.wordphrase)){
      var keys = await genKeyPair(req.body.username);
      // console.log(keys)
      const auth_token = jwt.sign({username: req.body.username}, 'WSP_Project_Spring22')
      found_user.set_public_key(keys[0])
      req.session.token = auth_token

      return res.redirect('/')

    } else {
      res.render('../../views/error.ejs', {error: 'Wrong passphrase!'})
    }
  }
  res.redirect('/')
})


app.post('/register', async (req,res)=> {
  const found_user = await User.findOne({username: req.body.username}).exec()
  if (!found_user){
    let new_user = new User();
    var keys = await genKeyPair(req.body.username);

    new_user.username = req.body.username;
    const mnemonic = `${bip39.generateMnemonic()} ${bip39.generateMnemonic()}`
    new_user.set_word_phrase(mnemonic)
    new_user.set_public_key(keys[0]);

    const auth_token = jwt.sign({username: new_user.username}, 'schoolproject2022')
    req.session.token = auth_token

    new_user.save((err, User) => {
        if (err) {
            res.render('../../views/error.ejs', {error: err})
        }
        else {
            res.render('../../views/registered.ejs', {username: req.body.username, mnemonic: mnemonic})
        }
    });
  } else {
    let err = 'User already exists with that name.'
    res.render('../../views/error.ejs', {error: err})
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


app.post('/encrypt_msg', async (req,res)=>{
  const message = req.body.msg;
  const pgp_key = publicKeyArmored;
  const encrypted_msg = await pgp_encrypt(message, pgp_key);
  res.render("../../views/encrypted", {msg:encrypted_msg});
})


app.post('/decrypt_msg', async (req,res)=>{
  const message = req.body.msg;
  const pgp_key = privateKeyArmored;
  message.replace(/\s/g, '\n')
  const decrypted_msg = await pgp_decrypt(message, pgp_key, passphrase);
  res.render("../../views/decrypted", {msg:decrypted_msg });
})
