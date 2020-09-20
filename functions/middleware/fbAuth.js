const { admin, db } = require('../util/admin');

/*
    Express allows to pass a second argument to any routing request (HTTP method) 
    as a function (middleware) that intercepts the request, does someting depending 
    on what the request has and then decides whether to proceed towards the handler 
    or to stop right there and send the response.
    In this case we want to make sure that the agent making the request and the user
    currently logged-in are the same person by checking currently valid issued token 
    (passing the middleware means that user has been authenticated)
*/

module.exports = (req, res, next) => { // Firebase Authentication Middleware (invocation of next as function allows to pass control to the next matching route)

    /*
        In order to test in Postman any request method protected by this middleware we have to add information
        in the Headers tab: new Key "Authorization" and Value "Bearer " followed by a valid issued token (which 
        we can get by logging-in as a authenticated user or signing-up as a new one through the pertinent routes)
    */

    let idToken;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) { // token starting with 'Bearer ' is a strong convention or standard
        idToken = req.headers.authorization.split('Bearer ')[1];
    } else {
        console.error('No token found');
        return res.status(403).json({ error: 'Unauthorised' }); // 403 is status code for unauthorised error
    }

    admin
        .auth()
        .verifyIdToken(idToken) // verify that the token was issued by our app and not a third party
        .then(decodedToken => {

            /*
                decodedToken holds the data inside the bearer token (firebase authenticated user data) 
                that we need to add to the request object so that when the request proceeds forward to 
                the next route it will have extra data from the middleware in the req param.
            */

            req.user = decodedToken;
            
            // console.log('decoded user', decodedToken);
            
            /*
                Now we need to get the handle and the image url, which are not stored 
                in the firebase authentication system but inside our collection users.
            */

            return (
                db
                    .collection('users') 
                    .where('userId', '==', req.user.uid)
                    // .limit(1) // query should only return one snapshot so there's no need to limit
                    .get()
            );
        })
        .then(data => { // data is a query snapshot
            // data.docs array has only one element
            req.user.handle = data.docs[0].data().handle; // we attach the handle property of the user stored in our database collection users (right statement) to the user request (left statement)
            req.user.imageUrl = data.docs[0].data().imageUrl;
            return next(); // allow the request to proceed 
        })
        .catch(err => {
            console.error('Error while verifying token ', err);
            return res.status(403).json(err); // 403 is status code for unauthorised error
        });

}