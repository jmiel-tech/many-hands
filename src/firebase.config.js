// ===========================================================================
//  The Firebase web app config for this project.
//  Firebase console > Project settings > Your apps > Web app > SDK setup > Config.
//
//  These values are public by design: security comes from firestore.rules.
//  Never put a service-account key or any other secret in this repo.
// ===========================================================================
// TEST DATABASE: this branch points at the "community-dd944" test project, not the live
// "tasks-f16b8" one. Don't merge this file into main, or the live site will use the test data.
export const firebaseConfig = {
  apiKey: 'AIzaSyAPz91sihhQVXQ0eMqdqUXehkTrHs16CNg',
  authDomain: 'community-dd944.firebaseapp.com',
  projectId: 'community-dd944',
  storageBucket: 'community-dd944.firebasestorage.app',
  messagingSenderId: '1098637905489',
  appId: '1:1098637905489:web:88770b312ba258017bb270',
};

// Shown as a small label at the top of screens in the design. Change it to your group's name.
export const COMMUNITY_NAME = 'Eastside Community Food Bank';
