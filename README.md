# End-to-End Encrypted Chat App
This is an end-to-end encrypted chat app. Messages are encrypted and stored in MongoDB using the AES256 algorithm. They are decrypted and passed to the users when necessary. There is a message burn timer that operates on 1 minute, 1 hour, or 1 day. Messages are deleted by the server and the message content is not accessed in any way when deleted. 

How to run:
1. Have NodeJS and MongoDB installed
2. Extract files to a location
3. Open Terminal and cd to the location
4. Type "npm i --save"
5. Create a file "config.env" in your root directory, and set a secret phrase for the AES256 encryption


AES256_SECRET_KEY = *SECRET KEY HERE*  
PORT = *PORT HERE*  
MONGODB_URI = *MONGODB URI HERE*

Port will default to 5000, and the URI will default to mongodb://localhost:27017/messaging, and the secret key is necessary to input if you want the service to be secure.

6. Cd to the /src/ folder, type "npm server.js"
7. Server is now running defaulted on localhost:5000.
