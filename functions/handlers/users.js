const firebase = require('firebase'); // npm install firebase (inside /functions directory)

const { db, storage, noImg } = require('../util/admin'); // db importation requires curly brackets (object destructuring)
const config = require('../util/config'); // config importation cannot have curly brackets because we are not destructuring but importing the whole object

firebase.initializeApp(config);

const { validateSignupData, validateLoginData, reduceUserDetails } = require('../util/validators');

/*
    The token issued by Firebase last for just one hour and then expires. If we want to avoid session expirity we can 
    create our own custom token, which will still expire after 3600 seconds, but will allow user to remain signed in into 
    their device until session is invalidated or they sign out (because they signed in using signInWithCustomToken() method). 
    This is possible because with Firebase issued tokens, user is authenticated first and token generated through their 
    user-id, so user cannot remain logged-in after token expires; however with custom issued tokens, we first generate the 
    token (if email and password are correct), send it to the frontend and then we only use it to authenticate user with it 
    (aforementioned signInWithCustomToken() method), so token expirity does not affect user credentials (as long as user was 
    signed in before token expired, of course).

        https://firebase.google.com/docs/auth/admin/create-custom-tokens
*/

exports.signup = (req, res) => {

    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle
    };

    const { valid, errors } = validateSignupData(newUser);

    if (!valid) {
        return res.status(400).json(errors);
    }

    // const noImg = 'no-img.png';

    // firebase
    //     .auth()
    //     .createUserWithEmailAndPassword(newUser.email, newUser.password)
    //     .then(data => {
    //         return res.status(201).json({ message: `user: ${data.user.uid} signed up successfully` }); // 201 is status code for resource created successfully
    //     })
    //     .catch(err => {
    //         console.error(err);
    //         return res.status(500).json({ error: err.code });
    //     });

    let token, userId;

    db
        .doc(`/users/${newUser.handle}`) // we use user handle as document path (id) so we can check if it is unique
        .get()
        .then(doc => { // firebase returns a snapshot event if the document does not really exist
            if (doc.exists) { // if document exists then handle is already taken
                return res.status(400).json({ handle: 'Handle is already taken' });
            }
            return (
                firebase
                    .auth()
                    .createUserWithEmailAndPassword(newUser.email, newUser.password) // with this line we create a new registered user (Authentication section), but it is still not added to the users database collection (Cloud Firestore section)
            )
        })
        .then(data => {
            userId = data.user.uid;
            return data.user.getIdToken(); // authentication token
        })
        .then(idToken => {
            // return res.status(201).json({ token: idToken });

            token = idToken;

            const userCredentials = {
                handle: newUser.handle,
                email: newUser.email,
                createdAt: new Date().toISOString(),
                imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
                // userId: userId
                userId // object property value shorthand (ES6) allows to only specify just the key in object definition when key and variable passed-in as value share the same name
            };

            /*
                Whenever a user signs up we assign them a through the imageUrl property a default profile pic url
                which they can later update. We have to manually update this default pic (no-img.png) to our Firebase 
                Storage bucket (Firebase Console). We cannot access the url image because the Storage Database access 
                rules do not allow to read or write to unauthenticated users. Since we are not using the client library 
                but checking the authentication through Cloud Functions then we have to change the Storage rules to 
                allow read (swap < allow read, write: if request.auth != null; > line for < allow read; >) which is not 
                a security problem for us because all the files that we are storing there are just user profile images 
                which are public anyway.
            */

            return db.doc(`/users/${newUser.handle}`).set(userCredentials); // persists new registered user credentials into a document (created with set) for the users database collection with handle as document path (unique id)
        })
        .then(() => {
            // return res.status(201).json( { token: token })
            return res.status(201).json({ token }); // object property value shorthand (ES6)
        })
        .catch(err => {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') { // error code sent by Firebase
                return res.status(400).json({ email: 'Email is already in use' });
            } else if (err.code === 'auth/weak-password') { // error code sent by Firebase
                return res.status(400).json({ password: 'Password is too weak' });
            }
            return res.status(500).json({ general: 'Something went wrong, please try again' });
        });

}

exports.login = (req, res) => {

    const user = {
        email: req.body.email,
        password: req.body.password
    };

    const { valid, errors } = validateLoginData(user);

    if (!valid) {
        return res.status(400).json(errors);
    }

    firebase
        .auth()
        .signInWithEmailAndPassword(user.email, user.password)
        .then(data => {
            return data.user.getIdToken(); // authentication token
        })
        .then(token => {
            // return res.json( {token: token })
            console.log("token", token)
            return res.json({ token }) // object property value shorthand (ES6)
        })
        .catch(err => {
            console.error(err);

            if (err.code == 'auth/user-not-found' || err.code === 'auth/invalid-email') { // error codes sent by Firebase
                return res.status(400).json({ email: 'There is no user registered with that email address' });
            } else if (err.code === 'auth/wrong-password') { // error code sent by Firebase
                return res.status(401).json({ password: 'Wrong password' });
            }
            return res.status(500).json({ general: 'Something went wrong, please try again' });
        });

}

/*
    There's a problem with 401 Unauthorized, the HTTP status code for authentication errors. And that’s just it: 
    it’s for authentication, not authorization. Receiving a 401 response is the server telling you, “you aren’t 
    authenticated–either not authenticated at all or authenticated incorrectly–but please reauthenticate and try 
    again.” To help you out, it will always include a WWW-Authenticate header that describes how to authenticate.

    This is a response generally returned by your web server, not your web application.

    It’s also something very temporary; the server is asking you to try again.

    So, for authorization I use the 403 Forbidden response. It’s permanent, it’s tied to my application logic, and 
    it’s a more concrete response than a 401.

    Receiving a 403 response is the server telling you, “I’m sorry. I know who you are–I believe who you say you are 
    but you just don’t have permission to access this resource. Maybe if you ask the system administrator nicely, you’ll 
    get permission. But please don’t bother me again until your predicament changes.”

    In summary, a 401 Unauthorized response should be used for missing or bad authentication, and a 403 Forbidden response 
    should be used afterwards, when the user is authenticated but isn’t authorized to perform the requested operation on 
    the given resource.

    https://www.loggly.com/blog/http-status-code-diagram/
*/

exports.addUserDetails = (req, res) => {
    let userDetails = reduceUserDetails(req.body);
    db
        .doc(`/users/${req.user.handle}`)
        .update(userDetails)
        .then( () => {
            return res.status(201).json({ message: 'Details added successfully' });
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
}

exports.getUserDetails = (req, res) => {
    let userData = {};
    db
        .doc(`/users/${req.params.handle}`)
        .get()
        .then(doc => {
            if (!doc.exists) {
                return res.status(404).json({ error: 'User not found' });
            }
            userData.credentials = doc.data();
            return (
                db
                    .collection('screams')
                    .where('userHandle', '==', req.params.handle)
                    .orderBy('createdAt', 'desc') // a complex firebase query requires an index; to create it we can follow the link showed in the console log (terminal) --> 'Error: 9 FAILED_PRECONDITION: The query requires an index. You can create it here: < url > --> copy and paste url, click on 'Create Index' button and wait a couple of minutes until status is enabled
                    .get()
            );
        })
        .then(data => {
            userData.screams = [],
            data.forEach(doc => {
                userData.screams.push({
                    screamId: doc.id,
                    ...doc.data(),
                    // body: doc.data(),
                    // userHandle: doc.data().userHandle,
                    // userImage: doc.data().userImage,
                    // likeCount: doc.data().likeCount,
                    // commentCount: doc.data().commentCount,
                    // createdAt: doc.data().createdAt
                })
            });
            return res.json(userData);
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
}

/*
  The way our application is going to work is keeping the login route to a minimun 
  to reduce response time, so that when a user logs in, he will only gets a token 
  that we can use later (when redirected to homepage) to get all the user details 
  (getAuthenticatedUser) sending a request to a different route (/user).
*/

exports.getAuthenticatedUser = (req, res) => { // get logged-in user details
    let userData = {};
    db
        .doc(`/users/${req.user.handle}`)
        .get()
        .then(doc => {
            if (!doc.exists) {
                return res.status(404).json({ error: 'User not found' });
            }
            userData.credentials = doc.data();
            return (
                db
                    .collection('likes')
                    .where('userHandle', '==', req.user.handle)
                    .get()
            );
        })
        .then(data => { // firebase returns data here (query snapshot) even if there are no results from our query (no document) or the collection doesn't exist, in which case userData.likes is just the empty array declared at the beginning.
            userData.likes = [];
            data.forEach(doc => {
                userData.likes.push(doc.data());
            });

            // return res.json(userData);

            return (
                db
                    .collection('notifications') // we need to return user notifications because we need to access them and show them on the frontend
                    .where('recipient', '==', req.user.handle)
                    .orderBy('createdAt', 'desc') // a complex firebase query requires an index; to create it we can follow the link showed in the console log (terminal) --> 'Error: 9 FAILED_PRECONDITION: The query requires an index. You can create it here: < url > --> copy and paste url, click on 'Create Index' button and wait a couple of minutes until status is enabled
                    .limit(10) // we just fetch the last 10 notifications
                    .get()
            );
        })
        .then(data => {
            userData.notifications = [];
            data.forEach(doc => {
                userData.notifications.push({
                    notificationId: doc.id,
                    ...doc.data(),
                    // recipient: doc.data().recipient,
                    // sender: doc.data().sender,
                    // createtAt: doc.data().createtAt,
                    // screamId: doc.data().screamId,
                    // type: doc.data().type,
                    // read: doc.data().read,
                });
            });
            return res.json(userData);
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
}

exports.uploadImage = (req, res) => {

    /*
        We test this function in Postman as a Body form-data POST request
        writing a generic key (image) and selecting file as type (hovering over key field)
    */

    const Busboy = require('busboy');   // npm install busboy (inside /functions directory)
    const path = require('path');       // Node default package
    const os = require('os');           // Node default package
    const fs = require('fs');           // Node default package

    const busboy = new Busboy({ headers: req.headers });

    let imageFileName;
    let imageToBeUploaded = {};
    let imageUrl;

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        console.log(fieldname, filename, mimetype);
        const imageExtention = filename.split('.')[filename.split('.').length - 1];
        imageFileName = `${parseInt(Math.random() * 1000000000000)}.${imageExtention}`;
        const filepath = path.join(os.tmpdir(), imageFileName);
        imageToBeUploaded = { filepath, mimetype }; // object property value shorthand (ES6)
        file.pipe(fs.createWriteStream(filepath));
    });

    busboy.on('finish', () => {
        storage
            .bucket()
            .upload(imageToBeUploaded.filepath, { // upload the image to Firebase Storage
                resumable: false,
                metadata: {
                    // contentDisposition: `inline; filename*=utf-8''${imageFileName}`,
                    metadata: {
                        contentType: imageToBeUploaded.mimetype
                    }
                }
            })
            .then( () => {
                imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`; // adding '?alt=media' query string at the end prevents image to be downloaded when accessing url and it is showed on the browser instead
                // return db.doc(`/users/${req.user.handle}`).update({ imageUrl: imageUrl });
                return db.doc(`/users/${req.user.handle}`).update({ imageUrl }); // add imageUrl to our users database collections as a document field (update and not set because document already exists and we are only adding a non-existent or modifying an existent property) of the user who uploaded it, identified by their handler (we can access user request data delivered by the middleware because it only lets us reach this point if authentication has been successful)
            })
            .then( () => {
                // return res.status(201).json({ message: 'Image uploaded successfully' });
                return res.json(imageUrl);
            })
            .catch(err => {
                console.error(err);
                return res.status(500).json({ error: err.code });
            });

        /*
            NOTE: When uploading a image to Firebase Storage usign bucket, it is possible
            its preview be permanently loading on the right side, but that does not mean 
            it has not been successfully uploaded. It appears as an item on 
            https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/
            and can be previewed in the url defined by the imageUrl property of the user who uploaded it 
            https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media
            and also on Google Cloud Platform - Storage (Project Settings - 
            Service Accounts - ? service accounts from Google Cloud Platform).
            Apparently this is a known issue where the required metadata doesn’t exist,
            and there is a script to solve it: 
            https://gist.github.com/torresalmonte/7bd888ff0b27fd741faf29d473ecb079

            https://stackoverflow.com/questions/60480323/firebase-storage-image-preview-is-permenantly-loading

            Sometimes this is randomly solved with no explanation whatsoever.
        */

    });

    busboy.end(req.rawBody); // rawBody property is presented in every request object
}

exports.markNotificationsRead = (req, res) => { // send to server an array of ids of those notifications user has just seen so can be marked them as read so they do not appear unread on the client side anymore

    /*
        We test this function in Postman as a Body raw POST request
        selecting JSON as type (rightmost property) and writing a json array of notification ids
    */

    let batch = db.batch(); // batch is used in Firebase to write or update multipe documents

    req.body.forEach(notificationId => { // req.body is an array of notification ids
        const notification = db.doc(`/notifications/${notificationId}`);
        batch.update(notification, { read: true });
    });

    batch.commit()
        .then( () => {
            return res.json({ message: 'Notifications marked as read' })
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });

}