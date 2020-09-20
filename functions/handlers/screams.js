const { db } = require('../util/admin');  // db importation requires curly brackets (object destructuring)

// exports.getAllScreams = functions.https.onRequest( (req, res) => { ... } );

exports.getAllScreams = (req, res) => { // we have to add /screams at the end of the route path

    db
        .collection('screams')
        .orderBy('createdAt', 'desc') // sort screams by date (default takes ascending order)
        .get()
        .then(data => {
            let screams = [];
            data.forEach(doc => {
                screams.push({
                    screamId: doc.id,
                    ...doc.data() // we can use spread operator (ES2015, not supported by old Node versions) to pass the entire object instead of having to manually specify all properties individually; if screamIf was a doc.dada() property that we wanted to override then we had to place it below ...doc.data() (load array first and update property later) but since it is a new property we can put it above or below (only affects screamId being first or last property of screams array)
                    // body: doc.data().body,
                    // userHandle: doc.data().userHandle,
                    // createdAt: doc.data().createdAt,
                    // commentCount: doc.data().commentCount,
                    // likeCount: doc.data().likeCount
                    // userImage: doc.data().userImage
                });
            });
            return res.json(screams);
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code }); // 500 is status code for server error
        });

}

// exports.postScream = functions.https.onRequest( (req, res) => {
//     if (req.method !== 'POST') { // prevent GET request to a route meant for POST request (using Express allows to specify http method)
//         return res.status(400).json({ error: 'method not allowed' });
//     }
//     ...
// });


exports.postScream = (req, res) => {

    /*
        We test this function in Postman as a Body raw POST request 
        selecting JSON as type (rightmost property) and writing a json object
    */

    if (req.body.body.trim() === '') {
        return res.status(400).json({ body: 'Field must not be empty' }); // 400 is status code for client error
    }

    const newScream = {
        body: req.body.body, // first .body is the body of the request and second .body is a property of the body of the request
        // userHandle: req.body.userHandle,
        userHandle: req.user.handle, // now userHandle property is not passed-in by the body but instead collected as data passed by middleware fbAuth (userHandle value will be the same as the logged-in user handle)
        // createdAt: admin.firestore.Timestamp.fromDate(new Date())
        userImage: req.user.imageUrl, // it is better to directly store here the user profile pic url (got through the middleware request) instead of sending another query to fetch it later using the user handle property of the comment
        likeCount: 0,
        commentCount: 0,
        createdAt: new Date().toISOString()
    };

    db
        .collection('screams')
        .add(newScream)
        .then(doc => {
            // return res.status(201).json({ message: `Document ${doc.id} created successfully` });

            newScream.screamId = doc.id;
            return res.json(newScream);
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: 'Something went wrong' });
        });

}

exports.getScream = (req, res) => { // Fetch one scream identified by id

    let screamData = {};

    db
        .doc(`/screams/${req.params.screamId}`)
        .get()
        .then(doc => {
            if (!doc.exists) {
                return res.status(404).json({ error: 'Scream not found' }); // 400 is status code for not found
            }
            screamData = doc.data();
            screamData.screamId = doc.id;
            return (
                db
                    .collection('comments')
                    .orderBy('createdAt', 'desc') // a complex firebase query requires an index; to create it we can follow the link showed in the console log (terminal) --> 'Error: 9 FAILED_PRECONDITION: The query requires an index. You can create it here: < url > --> copy and paste url, click on 'Create Index' button and wait a couple of minutes until status is enabled
                    .where('screamId', '==', req.params.screamId)
                    .get()
            )
        })
        .then(data => {
            screamData.comments = [];
            data.forEach(doc => {
                screamData.comments.push(doc.data());
            });
            return res.json(screamData);
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: 'Something went wrong' });
        });

}

exports.commentOnScream = (req, res) => {
    
    if (req.body.body.trim() === '') {
        return res.status(400).json({ comment: 'Field must not be empty' });
    }

    const newComent = {
        body: req.body.body,
        createdAt: new Date().toISOString(),
        screamId: req.params.screamId,
        userHandle: req.user.handle,
        userImage: req.user.imageUrl // it is better to directly store here the user profile pic url (got through the middleware request) instead of sending another query to fetch it later using the user handle property of the comment
    }

    db
        .doc(`/screams/${req.params.screamId}`)
        .get()
        .then(doc => {
            if (!doc.exists) { // we do not want users submitting comments to ids that do not exist anymore
                return res.status(404).json({ error: 'Scream not found' });
            }

            // return (
            //     db
            //         .collection('comments')
            //         .add(newComent)
            // )

            return doc.ref.update({ commentCount: doc.data().commentCount + 1 }) // increments comment count of the scream document
        })
        .then( () => {
            return (
                db
                    .collection('comments')
                    .add(newComent)
            )
        })
        .then( () => {
            res.json(newComent);
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: 'Something went wrong' });
        });

}

exports.likeScream = (req, res) => {

    const likeSnapshot = db
        .collection('likes')
        .where('userHandle', '==', req.user.handle)
        .where('screamId', '==', req.params.screamId);
        // .limit(1)

    const commentSnapshot = db // it is not necessary to order comments in this query because we are not going to display them anywhere (only need raw data)
        .collection('comments')
        .where('screamId', '==', req.params.screamId);

    const screamDocument = db.doc(`/screams/${req.params.screamId}`);
    
    let screamData;

    screamDocument
        .get()
        .then(doc => {
            if (!doc.exists) {
                return res.status(404).json({ error: 'Scream not found' });
            }
            screamData = doc.data();
            screamData.screamId = doc.id;
            return commentSnapshot.get(); // we have to get all scream comments when we like or unliked a scream because reasons
        })
        .then(data => {
            screamData.comments = [];
            data.forEach(doc => {
                screamData.comments.push(doc.data());
            });
            return likeSnapshot.get();
        })
        .then(data => { // data is a query snapshot
            if (!data.empty) { // if comment has already been liked by user
                return res.status(400).json({ error: 'Scream is already liked' });
            }
            return (
                db
                    .collection('likes')
                    .add({
                        userHandle: req.user.handle,
                        screamId: req.params.screamId,
                        createdAt: new Date().toISOString()
                    })
                    .then( () => {
                        screamData.likeCount++;
                        return screamDocument.update({ likeCount: screamData.likeCount }); // we update the like count property of the scream document in the database
                    })
                    .then( () => {
                        return res.json(screamData);
                    })
            );
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });

}

exports.unlikeScream = (req, res) => {

    const likeSnapshot = db // this is a query snapshot and not a single document snapshot (we get data instead of doc --> we iterate through data.doc array to get documents)
        .collection('likes')
        .where('userHandle', '==', req.user.handle)
        .where('screamId', '==', req.params.screamId);
        // .limit(1) // query should only return one snapshot so there's no need to limit

    const commentSnapshot = db // it is not necessary to order comments in this query because we are not going to display them anywhere (only need raw data)
        .collection('comments')
        .where('screamId', '==', req.params.screamId);

    const screamDocument = db.doc(`/screams/${req.params.screamId}`);
    
    let screamData;

    screamDocument
        .get()
        .then(doc => {
            if (!doc.exists) {
                return res.status(404).json({ error: 'Scream not found' });
            }
            screamData = doc.data();
            screamData.screamId = doc.id;
            return commentSnapshot.get();
        })
        .then(data => {
            screamData.comments = [];
            data.forEach(doc => {
                screamData.comments.push(doc.data());
            });
            return likeSnapshot.get();
        })
        .then(data => { // data is a query snapshot
            if (data.empty) { // if comment has not been liked by user
                return res.status(400).json({ error: 'Scream not liked' });
            }
            return (
                db
                    // data.docs array has only one element
                    .doc(`/likes/${data.docs[0].id}`) // id is stored in the DocumentReference ( data.docs[0] ) and not in the data itself ( data.docs[0].data() )
                    .delete()
                    .then( () => {
                        screamData.likeCount--;
                        return screamDocument.update({ likeCount: screamData.likeCount });
                    })
                    .then( () => {
                        return res.json(screamData);
                    })
            );
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        })

}

exports.deleteScream = (req, res) => {

    const screamDocument = db.doc(`/screams/${req.params.screamId}`);

    // const likeSnapshot = db
    //     .collection('likes')
    //     .where('screamId', '==', req.params.screamId);

    // const commentSnapshot = db
    //     .collection('comments')
    //     .where('screamId', '==', req.params.screamId);

    // const notificationSnapshot = db
    //     .collection('notifications')
    //     .where('screamId', '==', req.params.screamId);

    screamDocument
        .get()
        .then(doc => {
            if (!doc.exists) {
                return res.status(404).json({ error: 'Scream not found' });
            }
            if (doc.data().userHandle !== req.user.handle) { // check wheter userId of the scream is the same as userId decoded from token in middleware (user making request has to be owner of the scream)
                return res.status(403).json({ error: 'Unauthorised' });
            }

            /*
                We are not interested in keeping information about likes, comments and notifications
                pertaining a scream that'g going to cease to exist, so we delete that info too.

                You can only delete a document once you have a DocumentReference to it. 
                To get that you must first execute the query, then loop over the QuerySnapshot 
                and finally delete each DocumentSnapshot based on its ref.

                    https://stackoverflow.com/a/47180442

                However it is better to handle this logic in a trigger so this functionality is
                only reserved to delete a scream (also the trigger will work even if scream is 
                deleted manually on the Firebase console).
            */

            // return (
            //     screamDocument
            //         .delete()
            //         .then( () => {
            //             [likeSnapshot, commentSnapshot, notificationSnapshot].forEach(snapshot => {
            //                 snapshot
            //                     .get()
            //                     .then(data => {
            //                         data.forEach( doc => doc.ref.delete() );
            //                     })
            //             });
            //             return res.status(201).json({ message: 'Scream deleted successfully' });
            //         })
            // );

            return screamDocument.delete(); 
        })
        .then(() => {
            return res.status(201).json({ message: 'Scream deleted successfully' });
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        })
}
