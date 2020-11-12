'use strict';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const APP_URL = process.env.APP_URL;

//new text

// Imports dependencies and set up http server
const 
  { uuid } = require('uuidv4'),
  {format} = require('util'),
  request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  firebase = require("firebase-admin"),
  ejs = require("ejs"),  
  fs = require('fs'),
  multer  = require('multer'),  
  app = express(); 

const uuidv4 = uuid();


app.use(body_parser.json());
app.use(body_parser.urlencoded());

const bot_questions ={
"q1": "Please enter date (yyyy-mm-dd)",
"q2": "Please enter time (hh:mm)",
"q3": "Please enter full name",
"q4": "Please enter phone",
"q5": "Please enter email",
"q6": "Please leave a message"
}

let current_question = '';

let user_id = '';

let userInputs = [];

/*
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
})*/

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits :{
    fileSize: 50 * 1024 * 1024  //no larger than 5mb
  }

});

// parse application/x-www-form-urlencoded


app.set('view engine', 'ejs');
app.set('views', __dirname+'/views');


var firebaseConfig = {
     credential: firebase.credential.cert({
    "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    "client_email": process.env.FIREBASE_CLIENT_EMAIL,
    "project_id": process.env.FIREBASE_PROJECT_ID,    
    }),
    databaseURL: process.env.FIREBASE_DB_URL,   
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  };



firebase.initializeApp(firebaseConfig);

let db = firebase.firestore(); 
let bucket = firebase.storage().bucket();

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

// Accepts POST requests at /webhook endpoint
app.post('/webhook', (req, res) => {  

  // Parse the request body from the POST
  let body = req.body;

  

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {
    body.entry.forEach(function(entry) {

      let webhook_event = entry.messaging[0];
      let sender_psid = webhook_event.sender.id; 

      user_id = sender_psid;
      
      if(!userInputs[user_id]){
        userInputs[user_id]={}; 
      }
      
     

      if (webhook_event.message) {
        if(webhook_event.message.quick_reply){
            handleQuickReply(sender_psid, webhook_event.message.quick_reply.payload);
          }else{
            handleMessage(sender_psid, webhook_event.message);                       
          }                
      } else if (webhook_event.postback) {        
        handlePostback(sender_psid, webhook_event.postback);
      }
      
    });
    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});


app.use('/uploads', express.static('uploads'));


app.get('/',function(req,res){    
    res.send('your app is up and running');
});

app.get('/test',function(req,res){    
    res.render('test.ejs');
});

app.post('/test',function(req,res){
    const sender_psid = req.body.sender_id;     
    let response = {"text": "You  click delete button"};
    callSend(sender_psid, response);
});

// app.get('/appointment', async function(req,res){
//   res.render('appointment.ejs');
// });
app.get('/appointment/:sender_id',function(req,res){
    const sender_id = req.params.sender_id;
    res.render('appointment.ejs',{title:"Hello!! from WebViewappointment", sender_id:sender_id});
});
app.post('/appointment', async function(req,res){
  userInputs[user_id].type = req.body.type,
  userInputs[user_id].name = req.body.name,
  userInputs[user_id].guest = parseInt(req.body.guest),
  userInputs[user_id].phone = req.body.phone,
  userInputs[user_id].date = req.body.date,
  userInputs[user_id].time = req.body.time,
  userInputs[user_id].message = req.body.message,
  saveRoomBooking(userInputs[user_id], sender_psid);
  //confirmAppointment(user_id);

  // db.collection('roombookings').doc(req.body.doc_id)
  // .update(data).then(()=>{
  //   res.redirect('/admin/roombookings');
  // }).catch((err)=>console.log('ERROR:',error));


});

app.get('/admin/roombookings', async function(req,res){
  const roombookingsRef = db.collection('roombookings');
  const snapshot = await roombookingsRef.get();
  if(snapshot.empty){
    res.send('no data');
  }

  let data = [];

  snapshot.forEach(doc => {
    let roombooking ={};
    roombooking = doc.data();
    roombooking.doc_id = doc.id;

    data.push(roombooking);
    
  });

  console.log('DATA:', data);

  res.render('roombookings.ejs', {data:data});
});

app.get('/admin/updateroombooking/:doc_id', async function(req,res){
  let doc_id = req.params.doc_id;
    
  const roombookingRef = db.collection('roombookings').doc(doc_id);
  const doc = await roombookingRef.get();
  if (!doc.exists){
    console.log('No such document!');
  }else{
    console.log('Document data:', doc.data());
    let data = doc.data();
    data.doc_id = doc_id;

    console.log('Document data:', data);
    res.render('editroombooking.ejs', {data:data});
  }
});

app.post('/admin/updateroombooking', async function(req,res){
  console.log('REQ:', req.body);
  
  let data = {
    name:req.body.name,
    phone:req.body.phone,
    email:req.body.email,
    room:req.body.room,
    visit:req.body.visit,
    date:req.body.date,
    time:req.body.time,
    message:req.body.message,
    status:req.body.status,
    doc_id:req.body.doc_id,
    ref:req.body.ref
    // comment:req.body.comment
  }
  
  db.collection('roombookings').doc(req.body.doc_id)
  .update(data).then(()=>{
    res.redirect('/admin/roombookings');
  }).catch((err)=>console.log('ERROR:',error));

});

/*********************************************
Gallery page
**********************************************/
app.get('/showimages/:sender_id/',function(req,res){
    const sender_id = req.params.sender_id;

    let data = [];

    db.collection("images").limit(20).get()
    .then(  function(querySnapshot) {
        querySnapshot.forEach(function(doc) {
            let img = {};
            img.id = doc.id;
            img.url = doc.data().url;         

            data.push(img);                      

        });
        console.log("DATA", data);
        res.render('gallery.ejs',{data:data, sender_id:sender_id, 'page-title':'welcome to my page'}); 

    }
    
    )
    .catch(function(error) {
        console.log("Error getting documents: ", error);
    });    
});


app.post('/imagepick',function(req,res){
      
  const sender_id = req.body.sender_id;
  const doc_id = req.body.doc_id;

  console.log('DOC ID:', doc_id); 

  db.collection('images').doc(doc_id).get()
  .then(doc => {
    if (!doc.exists) {
      console.log('No such document!');
    } else {
      const image_url = doc.data().url;

      console.log('IMG URL:', image_url);

      let response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Is this the image you like?",
            "image_url":image_url,                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Yes!",
                  "payload": "yes",
                },
                {
                  "type": "postback",
                  "title": "No!",
                  "payload": "no",
                }
              ],
          }]
        }
      }
    }

  
    callSend(sender_id, response); 
    }
  })
  .catch(err => {
    console.log('Error getting document', err);
  });
      
});



/*********************************************
END Gallery Page
**********************************************/

//webview test
app.get('/webview/:sender_id',function(req,res){
    const sender_id = req.params.sender_id;
    res.render('webview.ejs',{title:"Hello!! from WebView", sender_id:sender_id});
});

app.post('/webview',upload.single('file'),function(req,res){
       
      let name  = req.body.name;
      let email = req.body.email;
      let img_url = "";
      let sender = req.body.sender;  

      console.log("REQ FILE:",req.file);



      let file = req.file;
      if (file) {
        uploadImageToStorage(file).then((img_url ) => {
         db.collection('webview').add({
            name: name,
            email: email,
            image: img_url
            }).then(success => {   
               console.log("DATA SAVED")
               thankyouReply(sender, name, img_url);    
            }).catch(error => {
              console.log(error);
            });
        }).catch((error) => {
          console.error(error);
        });
      }
 
              
});

//Set up Get Started Button. To run one time
//eg https://fbstarter.herokuapp.com/setgsbutton
app.get('/setgsbutton',function(req,res){
    setupGetStartedButton(res);    
});

//Set up Persistent Menu. To run one time
//eg https://fbstarter.herokuapp.com/setpersistentmenu
app.get('/setpersistentmenu',function(req,res){
    setupPersistentMenu(res);    
});

//Remove Get Started and Persistent Menu. To run one time
//eg https://fbstarter.herokuapp.com/clear
app.get('/clear',function(req,res){    
    removePersistentMenu(res);
});

//whitelist domains
//eg https://fbstarter.herokuapp.com/whitelists
app.get('/whitelists',function(req,res){    
    whitelistDomains(res);
});


// Accepts GET requests at the /webhook endpoint
app.get('/webhook', (req, res) => {
  

  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;  

  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];  
    
  // Check token and mode
  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      res.status(200).send(challenge);    
    } else {      
      res.sendStatus(403);      
    }
  }
});

/**********************************************
Function to Handle when user send quick reply message
***********************************************/

function handleQuickReply(sender_psid, received_message) {
  
  console.log('QUICK REPLY', received_message);

  received_message=received_message.toLowerCase();

  // if(received_message.startsWith("visit:")){
  //   let visit=received_message.slice(6);
  //   userInputs[user_id].visit=visit;
  //   current_question='q1';
  //   botQuestions(current_question, sender_psid);
  // }else 
  if(received_message.startsWith("appoint:")){
    let appoint=received_message.slice(8);
    userInputs[user_id].appointment=appoint;
    showRoom(sender_psid);
  }else if(received_message.startsWith("promotion:")){
    let pro=received_message.slice(10);
    userInputs[user_id].appointment=pro;
    showPromotion(sender_psid);

  }else{
    switch(received_message) {     
        case "on":
            showQuickReplyOn(sender_psid);
          break;
        case "off":
            showQuickReplyOff(sender_psid);
          break;   
        case "confirm-roombooking":
            saveRoomBooking(userInputs[user_id], sender_psid);
          break;             
        default:
            defaultReply(sender_psid);
  } 
}
  
 
}

/**********************************************
Function to Handle when user send text message
***********************************************/

const handleMessage = (sender_psid, received_message) => {

  console.log('TEXT REPLY', received_message);
  //let message;
  let response;

  if(received_message.attachments){
     handleAttachments(sender_psid, received_message.attachments);
  }else if(current_question == 'q1'){
    console.log('DATE ENTERED',received_message.text);
    userInputs[user_id].date=received_message.text;
    current_question='q2';
    botQuestions(current_question,sender_psid);
  }else if(current_question == 'q2'){
    console.log('TIME ENTERED',received_message.text);
    userInputs[user_id].time=received_message.text;
    current_question='q3';
    botQuestions(current_question,sender_psid);
  }else if(current_question == 'q3'){
    console.log('FULL NAME ENTERED',received_message.text);
    userInputs[user_id].name=received_message.text;
    current_question='q4';
    botQuestions(current_question,sender_psid);
  }else if(current_question == 'q4'){
    console.log('PHONE ENTERED',received_message.text);
    userInputs[user_id].phone=received_message.text;
    current_question='q5';
    botQuestions(current_question,sender_psid);
  }else if(current_question == 'q5'){
    console.log('EMAIL ENTERED',received_message.text);
    userInputs[user_id].email=received_message.text;
    current_question='q6';
    botQuestions(current_question,sender_psid);
  }else if(current_question == 'q6'){
    console.log('MESSAGE ENTERED',received_message.text);
    userInputs[user_id].message=received_message.text;
    current_question='';

    confirmAppointment(sender_psid);
  }

  else {
      
      let user_message = received_message.text;

      user_message = user_message.toLowerCase(); 

      switch(user_message) { 
      case "hi":
          hiReply(sender_psid);
        break;
      case "mingalarbar":
          greetInMyanmar(sender_psid);
        break;
      case "appointment":
          appointment(sender_psid);
        break;
      case "text":
        textReply(sender_psid);
        break;
      case "quick":
        quickReply(sender_psid);
        break;
      case "button":
        buttonReply(sender_psid);
        break;
      case "webview":
        webviewTest(sender_psid);
        break;       
      case "show images":
        showImages(sender_psid)
        break;               
      default:
          defaultReply(sender_psid);
      }       
          
      
    }

}

/*********************************************
Function to handle when user send attachment
**********************************************/
const handleAttachments = (sender_psid, attachments) => {
  console.log('ATTACHMENT REPLY', attachments);
  let response; 
  let attachment_url = attachments[0].payload.url;
    response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Is this the right picture?",
            "subtitle": "Tap a button to answer.",
            "image_url": attachment_url,
            "buttons": [
              {
                "type": "postback",
                "title": "Yes!",
                "payload": "yes-attachment",
              },
              {
                "type": "postback",
                "title": "No!",
                "payload": "no-attachment",
              }
            ],
          }]
        }
      }
    }
    callSend(sender_psid, response);
}


/*********************************************
Function to handle when user click button
**********************************************/
const handlePostback = (sender_psid, received_postback) => {
  
  let payload = received_postback.payload;
  console.log('BUTTON PAYLOAD', payload);
  
  if(payload.startsWith("Appointment:")){
    let room_type=payload.slice(12);
    console.log("SELECTED ROOM IS: ", room_type);
    userInputs[user_id].room=room_type;
    console.log('TEST',userInputs);
    //firstOrFollowup(sender_psid);
    webviewappointment(sender_psid);
    callSend(sender_psid, response);
  }
  else if(payload.startsWith("Promotion:")){
    let promo=payload.slice(10);
    console.log("SELECTED Promotion IS: ", promo);
    userInputs[user_id].promethod=promo;
    console.log('TEST',userInputs);
    //firstOrFollowup(sender_psid);
    callSend(sender_psid, response);
  }
  else{
      switch(payload) {        
      case "yes":
          showButtonReplyYes(sender_psid);
        break;
      case "no":
          showButtonReplyNo(sender_psid);
        break;                      
      default:
          defaultReply(sender_psid);
    }     
  }
}


const generateRandom = (length) => {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

/*********************************************
GALLERY SAMPLE
**********************************************/

const showImages = (sender_psid) => {
  let response;
  response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "show images",                       
            "buttons": [              
              {
                "type": "web_url",
                "title": "enter",
                "url":"https://fbstarter.herokuapp.com/showimages/"+sender_psid,
                 "webview_height_ratio": "full",
                "messenger_extensions": true,          
              },
              
            ],
          }]
        }
      }
    }
  callSendAPI(sender_psid, response);
}


/*********************************************
END GALLERY SAMPLE
**********************************************/


function webviewTest(sender_psid){
  let response;
  response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Click to open webview?",                       
            "buttons": [              
              {
                "type": "web_url",
                "title": "webview",
                "url":APP_URL+"webview/"+sender_psid,
                 "webview_height_ratio": "full",
                "messenger_extensions": true,          
              },
              
            ],
          }]
        }
      }
    }
  callSendAPI(sender_psid, response);
}

function webviewappointment(sender_psid){
  let response;
  response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Do you want to make appointment?",                       
            "buttons": [              
              {
                "type": "web_url",
                "title": "appointment",
                "url":APP_URL+"appointment/"+sender_psid,
                 "webview_height_ratio": "full",
                "messenger_extensions": true,          
              },
              
            ],
          }]
        }
      }
    }

  // let response = {
  //   "text": "Do you want to make appointment?",
  //   "quick_replies":[
  //           {
  //             "content_type":"button",
  //             "title":"Yes",
  //             "url":APP_URL+"appointment/"+sender_psid,              
  //           },{
  //             "content_type":"button",
  //             "title":"No",
  //             "payload":"promotion:Promotion",             
  //           }
  //   ]
  // }

  callSendAPI(sender_psid, response);
}


/****************
start room 
****************/
const appointment =(sender_psid) => {
  let response1 = {"text": "Welcome to Royal World Bar"};
  let response2 = {
    "text": "How May I Help You?",
    "quick_replies":[
            {
              "content_type":"text",
              "title":"Appointment",
              "payload":"appoint:Appointment",              
            },{
              "content_type":"text",
              "title":"Promotion",
              "payload":"promotion:Promotion",             
            }
    ]
  };
  callSend(sender_psid, response1).then(()=>{
    return callSend(sender_psid, response2);
  });

}

const showRoom =(sender_psid) => {
  let response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Normal Room",
            "subtitle": "Suitable (2-4 people)",
            "image_url":"https://i1.sndcdn.com/avatars-JtzQf3QtJMEKuyWY-lr0XdA-t500x500.jpg",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Normal Room",
                  "payload": "Appointment:Normal",
                }
              ],
          },
          {
            "title": "Medium Room",
            "subtitle": "Suitable (3-6 people)",
            "image_url":"https://imaginahome.com/wp-content/uploads/2017/06/wet-bar-design-ideas-1920x1280.jpg",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Medium Room",
                  "payload": "Appointment:Medium",
                }
              ],
          },
          {
            "title": "Family Room",
            "subtitle": "Suitable (4-10 people)",
            "image_url":"https://i02.appmifile.com/564_bbs_en/30/04/2020/bad9864ed3.png",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Family Room",
                  "payload": "Appointment:Family",
                }
              ],
          }

          ]
        }
      }
    }
  callSend(sender_psid, response);

}

const showPromotion =(sender_psid) => {
  let response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Chicken Wing",
            "subtitle": "4 pieces",
            "image_url":"https://cravinghomecooked.com/wp-content/uploads/2019/08/crispy-fried-chicken-1-650x813.jpg.webp",
            "buttons": [
                {
                  "type": "postback",
                  "title": "Chicken Wing",
                  "payload": "Promotion:Chicken Wing",
                }
              ],
          },
          {
            "title": "Pork-chops",
            "subtitle": "Hot and Spicy",
            "image_url":"https://cravinghomecooked.com/wp-content/uploads/2019/03/oven-baked-pork-chops-1-5-650x975.jpg.webp",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Pork-chops",
                  "payload": "Promotion:Pork-chops",
                }
              ],
          },
          {
            "title": "Marinated Top Round Steak",
            "subtitle": "with Fresh Vegetable",
            "image_url":"https://www.thespruceeats.com/thmb/hl4lkmdLO7tj1eDCsGbakfk97Co=/3088x2055/filters:fill(auto,1)/marinated-top-round-steak-3060302-hero-02-ed071d5d7e584bea82857112aa734a94.jpg",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Marinated Steak",
                  "payload": "Promotion:Marinated Steak",
                }
              ],
          }

          ]
        }
      }
    }
  callSend(sender_psid, response);

}

// const firstOrFollowup =(sender_psid) => {  
//   let response = {
//     "text": "First Time Visit or Follow Up?",
//     "quick_replies":[
//             {
//               "content_type":"text",
//               "title":"First Time",
//               "payload":"visit:first time",              
//             },{
//               "content_type":"text",
//               "title":"Follow Up",
//               "payload":"visit:follow up",             
//             }
//     ]
//   };
//   callSend(sender_psid, response);
// }

const botQuestions = (current_question,sender_psid) => {
  if(current_question =='q1'){
    let response = {"text": bot_questions.q1};
  callSend(sender_psid, response);
  }else 
  if(current_question =='q2'){
    let response = {"text": bot_questions.q2};
  callSend(sender_psid, response);
  }else if(current_question =='q3'){
    let response = {"text": bot_questions.q3};
  callSend(sender_psid, response);
  }else if(current_question =='q4'){
    let response = {"text": bot_questions.q4};
  callSend(sender_psid, response);
  }else if(current_question =='q5'){
    let response = {"text": bot_questions.q5};
  callSend(sender_psid, response);
  }else if(current_question =='q6'){
    let response = {"text": bot_questions.q6};
  callSend(sender_psid, response);
  }

}

const confirmAppointment = (sender_psid) => {
  console.log('BOOKING INFO',userInputs);
   // let Summary = "appointment:" + userInputs[user_id].appointment + "\u000A";
   // Summary += "room:" + userInputs[user_id].room + "\u000A";
   // Summary += "visit:" + userInputs[user_id].visit + "\u000A";
   // Summary += "date:" + userInputs[user_id].date + "\u000A";
   // Summary += "time:" + userInputs[user_id].time + "\u000A";
   // Summary += "name:" + userInputs[user_id].name + "\u000A";
   // Summary += "phone:" + userInputs[user_id].phone + "\u000A";
   // Summary += "email:" + userInputs[user_id].email + "\u000A";
   // Summary += "message:" + userInputs[user_id].message + "\u000A";

   let Summary = "name:" + userInputs[user_id].name + "\u000A";
   Summary += "type:" + userInputs[user_id].type + "\u000A";
   Summary += "guest:" + userInputs[user_id].guest + "\u000A";
   Summary += "date:" + userInputs[user_id].date + "\u000A";
   Summary += "time:" + userInputs[user_id].time + "\u000A";
   Summary += "type:" + userInputs[user_id].name + "\u000A";
   Summary += "message:" + userInputs[user_id].message + "\u000A";
   
  let response1 = {"text": Summary};


  let response2 = {
    "text": "Select your reply",
    "quick_replies":[
            {
              "content_type":"text",
              "title":"Confirm",
              "payload":"confirm-roombooking",              
            },{
              "content_type":"text",
              "title":"Cancel",
              "payload":"off",             
            }
    ]
  };
  callSend(sender_psid, response1).then(() => {
    return callSend(sender_psid, response2);
  });

  }
  
const saveRoomBooking = async (arg, sender_psid) =>{
  let data=arg;
  data.ref= generateRandom(6);
  data.status = "pending";
  db.collection('roombookings').add(data).then((success)=>{
      console.log("SAVED", success);
      let text = "Thank you. We have received your appointment."+ "\u000A";
      text += "We will call you very soon to confirm"+ "\u000A";
      text +="Your Booking reference number is:" + data.ref;
      let response = {"text": text};
      callSend(sender_psid, response);
    }).catch((err)=>{
        console.log('Error', err);
    });
  }
/****************
end room 
****************/


const hiReply =(sender_psid) => {
  let response = {"text": "Hello user, you can make room booking"};
  callSend(sender_psid, response);
}

const greetInMyanmar =(sender_psid) => {
  let response = {"text": "Mingalarbar. How May I Help you?"};
  callSend(sender_psid, response);
}

const textReply =(sender_psid) => {
  let response = {"text": "You sent text message"};
  callSend(sender_psid, response);
}


const quickReply =(sender_psid) => {
  let response = {
    "text": "Select your reply",
    "quick_replies":[
            {
              "content_type":"text",
              "title":"On",
              "payload":"on",              
            },{
              "content_type":"text",
              "title":"Off",
              "payload":"off",             
            }
    ]
  };
  callSend(sender_psid, response);
}

const showQuickReplyOn =(sender_psid) => {
  let response = { "text": "You sent quick reply ON" };
  callSend(sender_psid, response);
}

const showQuickReplyOff =(sender_psid) => {
  let response = { "text": "You sent quick reply OFF" };
  callSend(sender_psid, response);
}

const buttonReply =(sender_psid) => {

  let response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Are you OK?",
            "image_url":"https://www.mindrops.com/images/nodejs-image.png",                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Yes!",
                  "payload": "yes",
                },
                {
                  "type": "postback",
                  "title": "No!",
                  "payload": "no",
                }
              ],
          }]
        }
      }
    }

  
  callSend(sender_psid, response);
}

const showButtonReplyYes =(sender_psid) => {
  let response = { "text": "You clicked YES" };
  callSend(sender_psid, response);
}

const showButtonReplyNo =(sender_psid) => {
  let response = { "text": "You clicked NO" };
  callSend(sender_psid, response);
}

const thankyouReply =(sender_psid, name, img_url) => {
  let response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Thank you! " + name,
            "image_url":img_url,                       
            "buttons": [
                {
                  "type": "postback",
                  "title": "Yes!",
                  "payload": "yes",
                },
                {
                  "type": "postback",
                  "title": "No!",
                  "payload": "no",
                }
              ],
          }]
        }
      }
    }
  callSend(sender_psid, response);
}

function testDelete(sender_psid){
  let response;
  response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Delete Button Test",                       
            "buttons": [              
              {
                "type": "web_url",
                "title": "enter",
                "url":"https://fbstarter.herokuapp.com/test/",
                 "webview_height_ratio": "full",
                "messenger_extensions": true,          
              },
              
            ],
          }]
        }
      }
    }
  callSendAPI(sender_psid, response);
}

const defaultReply = (sender_psid) => {
  let response1 = {"text": "To test text reply, type 'text'"};
  let response2 = {"text": "To test quick reply, type 'quick'"};
  let response3 = {"text": "To test button reply, type 'button'"};   
  let response4 = {"text": "To test webview, type 'webview'"};
    callSend(sender_psid, response1).then(()=>{
      return callSend(sender_psid, response2).then(()=>{
        return callSend(sender_psid, response3).then(()=>{
          return callSend(sender_psid, response4);
        });
      });
  });  
}

const callSendAPI = (sender_psid, response) => {   
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }
  
  return new Promise(resolve => {
    request({
      "uri": "https://graph.facebook.com/v6.0/me/messages",
      "qs": { "access_token": PAGE_ACCESS_TOKEN },
      "method": "POST",
      "json": request_body
    }, (err, res, body) => {
      if (!err) {
        //console.log('RES', res);
        console.log('BODY', body);
        resolve('message sent!')
      } else {
        console.error("Unable to send message:" + err);
      }
    }); 
  });
}

async function callSend(sender_psid, response){
  let send = await callSendAPI(sender_psid, response);
  return 1;
}


const uploadImageToStorage = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject('No image file');
    }
    let newFileName = `${Date.now()}_${file.originalname}`;

    let fileUpload = bucket.file(newFileName);

    const blobStream = fileUpload.createWriteStream({
      metadata: {
        contentType: file.mimetype,
         metadata: {
            firebaseStorageDownloadTokens: uuidv4
          }
      }
    });

    blobStream.on('error', (error) => {
      console.log('BLOB:', error);
      reject('Something is wrong! Unable to upload at the moment.');
    });

    blobStream.on('finish', () => {
      // The public URL can be used to directly access the file via HTTP.
      //const url = format(`https://storage.googleapis.com/${bucket.name}/${fileUpload.name}`);
      const url = format(`https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${fileUpload.name}?alt=media&token=${uuidv4}`);
      console.log("image url:", url);
      resolve(url);
    });

    blobStream.end(file.buffer);
  });
}




/*************************************
FUNCTION TO SET UP GET STARTED BUTTON
**************************************/

const setupGetStartedButton = (res) => {
  let messageData = {"get_started":{"payload":"get_started"}};

  request({
      url: 'https://graph.facebook.com/v2.6/me/messenger_profile?access_token='+ PAGE_ACCESS_TOKEN,
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      form: messageData
    },
    function (error, response, body) {
      if (!error && response.statusCode == 200) {        
        res.send(body);
      } else { 
        // TODO: Handle errors
        res.send(body);
      }
  });
} 

/**********************************
FUNCTION TO SET UP PERSISTENT MENU
***********************************/



const setupPersistentMenu = (res) => {
  var messageData = { 
      "persistent_menu":[
          {
            "locale":"default",
            "composer_input_disabled":false,
            "call_to_actions":[
                {
                  "type":"postback",
                  "title":"View My Tasks",
                  "payload":"view-tasks"
                },
                {
                  "type":"postback",
                  "title":"Add New Task",
                  "payload":"add-task"
                },
                {
                  "type":"postback",
                  "title":"Cancel",
                  "payload":"cancel"
                }
          ]
      },
      {
        "locale":"default",
        "composer_input_disabled":false
      }
    ]          
  };
        
  request({
      url: 'https://graph.facebook.com/v2.6/me/messenger_profile?access_token='+ PAGE_ACCESS_TOKEN,
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      form: messageData
  },
  function (error, response, body) {
      if (!error && response.statusCode == 200) {
          res.send(body);
      } else { 
          res.send(body);
      }
  });
} 

/***********************
FUNCTION TO REMOVE MENU
************************/

const removePersistentMenu = (res) => {
  var messageData = {
          "fields": [
             "persistent_menu" ,
             "get_started"                 
          ]               
  };  
  request({
      url: 'https://graph.facebook.com/v2.6/me/messenger_profile?access_token='+ PAGE_ACCESS_TOKEN,
      method: 'DELETE',
      headers: {'Content-Type': 'application/json'},
      form: messageData
  },
  function (error, response, body) {
      if (!error && response.statusCode == 200) {          
          res.send(body);
      } else {           
          res.send(body);
      }
  });
} 


/***********************************
FUNCTION TO ADD WHITELIST DOMAIN
************************************/

const whitelistDomains = (res) => {
  var messageData = {
          "whitelisted_domains": [
             APP_URL , 
             "https://herokuapp.com" ,                                   
          ]               
  };  
  request({
      url: 'https://graph.facebook.com/v2.6/me/messenger_profile?access_token='+ PAGE_ACCESS_TOKEN,
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      form: messageData
  },
  function (error, response, body) {
      if (!error && response.statusCode == 200) {          
          res.send(body);
      } else {           
          res.send(body);
      }
  });
} 