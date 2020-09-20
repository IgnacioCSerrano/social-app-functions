const isEmpty = string => string.trim() === '';

const isEmail = email => email.match(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/); // regular expression that matches for an email pattern

exports.validateSignupData = data => {

    let errors = {};

    if ( isEmpty(data.email) ) {
        errors.email = 'Field must not be empty';
    } else if ( !isEmail(data.email) ) {
        errors.email = 'Field must be a valid email address';
    }

    if ( isEmpty(data.password) ) {
        errors.password = 'Field must not be empty';
    }

    if (data.password !== data.confirmPassword) {
        errors.confirmPassword = 'Both passwords must match';
    }

    if ( isEmpty(data.handle) ) {
        errors.handle = 'Field must not be empty';
    }

    // if (Object.keys(errors).length > 0) {
    //     return res.status(400).json(errors);
    // }

    return {
        valid: Object.keys(errors).length === 0,
        // errors: errors
        errors // object property value shorthand (ES6)
    }

}

exports.validateLoginData = data => {

    let errors = {};

    if ( isEmpty(data.email) ) {
        errors.email = 'Field must not be empty';
    }

    if ( isEmpty(data.password) ) {
        errors.password = 'Field must not be empty';
    }

    // if (Object.keys(errors).length > 0) {
    //     return res.status(400).json(errors);
    // }

    return {
        valid: Object.keys(errors).length === 0,
        // errors: errors
        errors // object property value shorthand (ES6)
    }

}

exports.reduceUserDetails = data => {

    let userDetails = {};

    if ( !isEmpty(data.bio) ) { // we don't want to submit an empty value for a key to our database
        userDetails.bio = data.bio.trim();
    }

    if ( !isEmpty(data.website) ) {
        // http and not https because a website without SSL will crash with https but a website with SSL allows http
        userDetails.website = data.website.trim().substring(0, 4) === 'http' ? data.website : `http://${data.website.trim()}`
        
    }

    if ( !isEmpty(data.location) ) {
        userDetails.location = data.location.trim();
    }

    return userDetails;

}
