NetFilter
=========

filter internet by proxy 

All rights reserved


NetFilter
=========


## אופן השימוש

בשביל להפעיל את השרת צריך node מותקן על המחשב

http://nodejs.org/

```sh
node core/proxy.js
```

## הסבר על פעולת הפרוקסי

פילטר לאינטרנט דרך פרוקסי

הפילטר מבוסס על חוקים. שצריך להגדיר כדי לקבוע את פעולת הסינון.

החוקים נמצאים בקובץ core/proxy.js במשתנה בשם rules בצורת array 

החוקים קובעים איזה פעולה הפרוקסי יפעיל לכל חוק.

חוק בנוי בפורמט הזה

```sh

  'domain' : [
		 { url : /.*/  , action:  'action name' }
	]

```

הפעולת זה קבצי js 

שבכל קובץ צריך להיות 

שם הפעולה
ופונקציה שמטפלת בבקשה של הפרוקסי


```sh

exports.name = "action name" ;

exports.requestHandle = function( createRequest , request , response , urlParse,  isSsl )
{

    //TODO ;  

};

```


הפונקציה מקבלת כמה פרמטרים

createRequest - מכיל פונקציה שמיצרת בקשה לשרת 

הפונקציה מקבלת פונקציה שתרוץ אחרי יצירת הבקשה.
הוא מעביר פרמטר אחד של http://nodejs.org/api/stream.html

request - בקשה מהשרת פרוקסי מסוג http://nodejs.org/api/stream.html

response - תשובה מהשרת פרוקסי מסוג http://nodejs.org/api/stream.html

urlParse - url מפורט של הבקשה

isSsl - ערך בוליאני האם זה ssl 


דוגמא לפעולה שמעבירה את התקשורת ללא סינון

```sh

exports.name = "generic_allow" ;

exports.requestHandle = function( createRequest , request , response , urlParse,  isSsl )
{


  var proxy_request = createRequest( function(proxy_response) {
		console.log( "proxy to %s" , urlParse.host + urlParse.path );

		proxy_response.on('data', function(d) {
			response.write(d);
		});

		response.writeHead(proxy_response.statusCode, proxy_response.headers);
	});

	request.on('data', function(d) {
		proxy_request.write(d);
	});

};

```


