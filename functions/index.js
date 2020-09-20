const functions = require('firebase-functions');

/*
    Serverless computing is a cloud computing execution model in which the cloud provider runs the server 
    and dynamically manages the allocation of machine resources. Pricing is based on the actual amount of 
    resources consumed by an application, rather than on pre-purchased units of capacity.

    We will write all the backend in Cloud Functions instead of using the Firebase Client Library implementation 
    because the latter would inflate the bundle size of our app by a lot (some services like AWS S3 charge by 
    bandwitdth so we would be charged more because of users requesting big chunks of data; also if we were shipping 
    our single-page application to slower mobile devices they would have to unpack a massive JavaScript bundle) 
*/

// const express = require('express'); // npm install express (inside /functions directory)
// const app = express();
const app = require('express')(); // import express and get app in one line

const cors = require('cors'); // npm install cors (adds 'Access-Control-Allow-Origin' header to comply with CORS policy)
app.use(cors());

const { db, storage, noImg } = require('./util/admin'); // db importation requires curly brackets (object destructuring)

// ROUTE HANDLERS

const { 
    getAllScreams, 
    postScream,
    getScream,
    deleteScream,
    likeScream,
    unlikeScream,
    commentOnScream
} = require('./handlers/screams');

const { 
    signup, 
    login, 
    uploadImage, 
    addUserDetails, 
    getAuthenticatedUser,
    getUserDetails,
    markNotificationsRead
} = require('./handlers/users');

const fbAuth = require('./middleware/fbAuth'); // fbAuth importation cannot have curly brackets because we are not destructuring but importing the whole object

// SCREAM ROUTES (this app is a Twitter clone, so an ape scream would be the equivalent of a bird tweet, basically a post)

app.get('/screams', getAllScreams); // we have to add /screams at the end of the route path (likewise with the rest using their own paths)
app.post('/scream', fbAuth, postScream);
app.get('/scream/:screamId', getScream); // colon (:) tells the application that screamId is a route parameter and we can access its value with req.params
app.delete('/scream/:screamId', fbAuth, deleteScream);
app.post('/scream/:screamId/like', fbAuth, likeScream);
app.post('/scream/:screamId/unlike', fbAuth, unlikeScream);
app.post('/scream/:screamId/comment', fbAuth, commentOnScream);


// USER ROUTES

app.post('/signup', signup);
app.post('/login', login);
app.post('/user/image', fbAuth, uploadImage);
app.post('/user', fbAuth, addUserDetails);
app.get('/user', fbAuth, getAuthenticatedUser);
app.get('/user/:handle', getUserDetails);
app.post('/notifications', fbAuth, markNotificationsRead)

/*
    One of the best practices (strong convention) for having an API 
    is to add the /api/ prefix before any route or path
    (https://baseurl.com/api/screams instead of https://baseurl.com/screams).
    
    This is handled in the next line:

        exports.api = functions.https.onRequest(app);

    Instead of passing one route we pass our app and it will automatically turn into multiple routes
    (that we have to add manually at the end).
*/

exports.api = functions.region('europe-west1').https.onRequest(app); // functions are deployed to us-central region by default which add from 300 to 400 ms of latency on each request (not a problem in testing but noticiable slow down app in production) so we have to manually set up an european region

// DATABASE TRIGGERS (need to be deployed for them to work without firestore emulation) (https://firebase.google.com/docs/functions/firestore-events) 

// It is not necessary to send a request in order to test a trigger (can be done directly on Firestore Database Console)

exports.createNotificationOnLike =  functions.region('europe-west1').firestore // notification trigger when user likes a scream
    .document('likes/{id}') // document to listen to for event changes ( a path component can be specified as a wildcard by surrounding it with curly brackets: ref('foo/{bar}') matches any child of /foo )
    .onCreate(snapshot => { // snapshot here is a like document
        return (
            db
                .doc(`/screams/${snapshot.data().screamId}`)
                .get()
                .then(doc => {
                    if (doc.exists && doc.data().userHandle != snapshot.data().userHandle) { // doc should exists but we check it just in case and we also check that user liking scream is not the same user who posted it (it would be useless to send a notification in that case)
                        return (
                            db
                                .doc(`/notifications/${snapshot.id}`) // the id of the like is the same as the id of the notification that pertains to that like
                                .set({
                                    createdAt: new Date().toISOString(),
                                    recipient: doc.data().userHandle, // owner of the scream
                                    sender: snapshot.data().userHandle, // user who liked scream
                                    type: 'like',
                                    read: false,
                                    screamId: doc.id
                                })
                        );
                    }
                })
                .catch(err => {
                    console.error(err);
                })
        );
    });

exports.deleteNotificationOnUnlike = functions.region('europe-west1').firestore // notification trigger when user unlikes a scream (actually deletes notification)
    .document('likes/{id}')
    .onDelete(snapshot => {
        return (
            db
                .doc(`/notifications/${snapshot.id}`)
                .delete()
                .catch(err => {
                    console.error(err);
                })
        );
    });

exports.createNotificationOnComment =  functions.region('europe-west1').firestore // notification trigger when user comments on a scream
    .document('comments/{id}')
    .onCreate(snapshot => { // snapshot here is a comment document
        return (
            db
                .doc(`/screams/${snapshot.data().screamId}`)
                .get()
                .then(doc => {
                    if (doc.exists && doc.data().userHandle != snapshot.data().userHandle) {
                        return (
                            db
                                .doc(`/notifications/${snapshot.id}`)
                                .set({
                                    createdAt: new Date().toISOString(),
                                    recipient: doc.data().userHandle,
                                    sender: snapshot.data().userHandle,
                                    type: 'comment',
                                    read: false,
                                    screamId: doc.id
                                })
                        );
                    }
                })
                .catch(err => {
                    console.error(err);
                })
        );
    });

exports.onUserImageChange = functions.region('europe-west1').firestore // trigger that updates the userImage property of all the screams submitted by a user when they change their profile pic
    .document('/users/{userId}')
    .onUpdate(change => { // change object (snapshot of user document) has two values before and after a property was edited

        // Console logs can be checked at the Logs section of the Function dashboard on Firebase console
        
        // console.log(change.before.data());
        // console.log(change.after.data());

        if (change.before.data().imageUrl != change.after.data().imageUrl) { // we execute the code only if imageUrl property has been updated

            // const noImg = 'no-img.png';
            const prevImageUrl = change.before.data().imageUrl;

            if ( !prevImageUrl.includes(noImg) ) { // if replaced user image was not the one assigned by default then we delete it from Storage
                const fileName = prevImageUrl.substring( prevImageUrl.lastIndexOf('/') + 1, prevImageUrl.lastIndexOf('?') );
                const file = storage.bucket().file(fileName);
                file.delete();
            }

            let batch = db.batch(); // batch is used in Firebase to write or update multipe documents
            return (
                db
                    .collection('screams')
                    .where('userHandle', '==', change.before.data().handle) // we can use before or after here because handle does not change
                    .get()
                    .then(data => { // data is a snapshot of screams
                        data.forEach(doc => {
                            // const scream = db.doc(`/screams/${doc.id}`);
                            const scream = doc.ref;
                            batch.update(scream, { userImage: change.after.data().imageUrl }); // we have to use after here because imageUrl is the property that has changed
                        });
                        return (
                            db
                                .collection('comments')
                                .where('userHandle', '==', change.before.data().handle)
                                .get()
                        );
                    })
                    .then(data => {
                        data.forEach(doc => {
                        const comment = doc.ref;
                        batch.update(comment, { userImage: change.after.data().imageUrl });
                    });
                    return batch.commit();
                })
            );
        } else {
            return true;
        }
    });

exports.onScreamDelete = functions.region('europe-west1').firestore // trigger that deletes all comments, likes and notifications pertaining a deleted scream
    .document('/screams/{screamId}')
    .onDelete( (snapshot, context) => { // context has the parameters presented in the url (we do not need snapshot here but has to be present to be able to access context because if there are only one argument it is assumed to be snapshot)
        const screamId = context.params.screamId;
        const batch = db.batch();
        return (
            db
                .collection('comments')
                .where('screamId', '==', screamId)
                .get()
                .then(data => {
                    data.forEach(doc => {
                        // batch.delete(db.doc(`/comments/${doc.id}`));
                        batch.delete(doc.ref);
                    });
                    return (
                        db
                            .collection('likes')
                            .where('screamId', '==', screamId)
                            .get()
                    );
                })
                .then(data => {
                    data.forEach(doc => {
                        // batch.delete(db.doc(`/likes/${doc.id}`));
                        batch.delete(doc.ref);
                    });
                    return (
                        db
                            .collection('notifications')
                            .where('screamId', '==', screamId)
                            .get()
                    );
                })
                .then(data => {
                    data.forEach(doc => {
                        // batch.delete(db.doc(`/notifications/${doc.id}`));
                        batch.delete(doc.ref);
                    });
                    return batch.commit();
                })
                .catch(err => {
                    console.log(err);
                })
        );
    })