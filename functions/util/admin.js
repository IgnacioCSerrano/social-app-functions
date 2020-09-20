const admin = require('firebase-admin');
// exports.admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore(); // db is just a handy shorthand for admin.firestore()
// exports.db = admin.firestore();

const storage = admin.storage(); // storage is just a handy shorthand for admin.storage()
// exports.storage = admin.storage();

const noImg = 'no-img.png';
// exports.noImg = 'no-img.png';

// module.exports.admin = admin;
// module.exports.db = db;
// module.exports.noImg = noImg;
module.exports = { admin, db, storage, noImg }; // object property value shorthand (ES6) (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer)

/*
    Exports is just module.exports’s little helper. Your module returns module.exports to the caller ultimately, not exports. 
    All exports does is collect properties and attach them to module.exports. If there’s something attached to module.exports 
    already, everything on exports is ignored.

        https://www.sitepoint.com/understanding-module-exports-exports-node-js/
        https://medium.com/@geekguy/javascript-modues-exports-vs-exports-whats-the-difference-9a61cdb99386

    Caveat: whatever you assign module.exports to is what’s exported from your module. This exaple:

        exports.foo = foo;
        module.exports = () => return bar;

    would only result in an anonymous function being exported. The foo variable would be ignored because we have override 
    the content of module.exports with a direct assignment (direct assignment to exports variable won't work).   
*/