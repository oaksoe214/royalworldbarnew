<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Edit Room Booking</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
 </head>

  <body>
  <script>
      (function(d, s, id){
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) {return;}
      js = d.createElement(s); js.id = id;
      js.src = "//connect.facebook.net/en_US/messenger.Extensions.js";
      fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'Messenger'));

    const APP_ID = 544769076153407;    
    var senderID = "";
    
    window.extAsyncInit = function() {
        MessengerExtensions.getContext(APP_ID, 
          function success(thread_context){
           senderID = thread_context.psid;
          },
          function error(err){
            console.log(err);
          }
        );        
    };
  </script>
  
  <h1><%= title %></h1>

  <form id="form" enctype="multipart/form-data" method="post" action="">
  <div class="form-group">
    <label for="name">Name</label>
    <input type="text" class="form-control" id="name" name="name" placeholder="Enter name">    
  </div>
  <div class="form-group">
    <label for="email">Email</label>
    <input type="email" class="form-control" id="email" name="email" placeholder="Email">
  </div> 
  <div class="form-group">
    <label for="email">Image</label>
    <input type="file" name="file" />
  </div>
  <input type="hidden"  id="sender" name="sender" value="<%= sender_id %>">
  <input type="submit" value="Submit"> 
  </form>


  
  <script>
      
   
      const windowShut = () => {
   
          MessengerExtensions.requestCloseBrowser(function success() {
          console.log("success");          
        }, function error(err) {
          console.log(err);
        });
        }
      
      document.getElementById("form").addEventListener("submit", windowShut);       

      /*
      const postFormData = (data) => {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "https://fbstarterbot.herokuapp.com/webview/", true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(data)); 
      } */

     

  </script>

  </body>

</html>