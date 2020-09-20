/*
  This file has no implications whatsoever on our code; it's just a reference point for us 
  to check how our data is going to look like without having to open Firebase any time.
*/

const db = {
  users: [
    {
      userId: 'dh23ggj5h32g543j5gf43',
      email: 'user@email.com',
      handle: 'user',
      createdAt: '2019-03-15T10:59:52.798Z',
      imageUrl: 'image/something.png',
      bio: 'Hello, my name is user, nice to meet you',
      website: 'https://user.com',
      location: 'London, UK'
    }
  ],
  screams: [
    {
      userHandle: 'user',
      body: 'This is a sample scream',
      createdAt: '2019-03-15T10:59:52.798Z',
      /*
        It's a good practice to add the next two properties because any time we fetch a scream 
        it would not be a good idea to check all the comments that have the id of the scream, 
        count themand return that number because Firebase charges on the amount of reads so we
        want to minimise the number of reads executed each time any user sends a request
      */
      likeCount: 5,
      commentCount: 3
    }
  ],
  /*
    The reason why we store scream comments and like counts as documents in separate collections instead 
    of the scream document itself is because of the way databases (and Firebase in particular) work: 
    you are supposed to keep each document as small in size as possible by spreading all the properties 
    to gain efficiency in query searches (also Firebase has a maximum limit of 4MB per document)
  */
  comments: [
    {
      userHandle: 'user',
      screamId: 'kdjsfgdksuufhgkdsufky',
      body: 'nice one, mate!',
      createdAt: '2019-03-15T10:59:52.798Z'
    }
  ],
  likes: [
    {
      userHandle: 'user',
      screamId: 'hh7O5oWfWucVzGbHH2pa',
      createdAt: '2019-03-15T10:59:52.798Z' // this field is only useful for statistics and data analytics because we are only going to show the amount of likes 
    }
  ],
  notifications: [
    {
      createdAt: '2019-03-15T10:59:52.798Z',
      recipient: 'user',
      sender: 'john',
      type: 'like | comment',
      read: 'true | false',
      screamId: 'kdjsfgdksuufhgkdsufky'
    }
  ]
};

const userDetails = {

  // REDUX data (user information hold in our redux state in the frontend application which we use to populate the profile with)

  credentials: {
    userId: 'N43KJ5H43KJHREW4J5H3JWMERHB',
    email: 'user@email.com',
    handle: 'user',
    createdAt: '2019-03-15T10:59:52.798Z',
    imageUrl: 'image/something.png',
    bio: 'Hello, my name is user, nice to meet you',
    website: 'https://user.com',
    location: 'London, UK'
  },
  likes: [
    { }
   ],
  notifications: [
    { }
  ]
};
