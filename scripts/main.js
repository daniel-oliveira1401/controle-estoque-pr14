/**
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
"use strict";

// Shortcuts to DOM Elements.
var messageForm = document.getElementById("message-form");
var messageInput = document.getElementById("new-post-message");
var titleInput = document.getElementById("new-post-title");
var signInButton = document.getElementById("sign-in-button");
var signOutButton = document.getElementById("sign-out-button");
var splashPage = document.getElementById("page-splash");
var addPost = document.getElementById("add-post");
var addButton = document.getElementById("add");

var userPostsSection = document.getElementById("user-posts-list");

var myPostsMenuButton = document.getElementById("menu-my-posts");

var listeningFirebaseRefs = [];

/**
 * Saves a new post to the Firebase DB.
 */
function writeNewPost(uid, username, picture, title, body) {
  // A post entry.
  var postData = {
    author: username,
    uid: uid,
    body: body,
    title: title,

    authorPic: picture,
  };

  // Get a key for a new Post.
  var newPostKey = firebase.database().ref().child("posts").push().key;

  // Write the new post's data simultaneously in the posts list and the user's post list.
  var updates = {};
  updates["/posts/" + newPostKey] = postData;
  updates["/user-posts/" + uid + "/" + newPostKey] = postData;

  return firebase.database().ref().update(updates);
}

/**
 * Creates a post element.
 */
function createPostElement(postId, title, text, author, authorId, authorPic) {
  var uid = firebase.auth().currentUser.uid;

  var html =
    '<div class="post post-' +
    postId +
    " mdl-cell mdl-cell--12-col " +
    'mdl-cell--6-col-tablet mdl-cell--4-col-desktop mdl-grid mdl-grid--no-spacing">' +
    '<div class="mdl-card mdl-shadow--2dp">' +
    '<div class="mdl-card__title mdl-color--light-blue-600 mdl-color-text--white">' +
    '<h4 class="mdl-card__title-text"></h4>' +
    `<span post-id=${postId} class="btn-remove-post" style="margin-left:auto">X</span>` +
    "</div>" +
    '<div class="header">' +
    "<div>" +
    "<div>Adicionado por:</div>" +
    '<div class="avatar"></div>' +
    '<div class="username mdl-color-text--black"></div>' +
    "</div>" +
    "</div>" +
    '<div class="text"></div>' +
    "</div>" +
    "</div>";

  // Create the DOM element from the HTML.
  var div = document.createElement("div");
  div.innerHTML = html;
  var postElement = div.firstChild;

  // Set values.
  postElement.getElementsByClassName("text")[0].innerText = text;
  postElement.getElementsByClassName("mdl-card__title-text")[0].innerText =
    title;
  postElement.getElementsByClassName("username")[0].innerText =
    author || "Anonymous";
  postElement.getElementsByClassName("avatar")[0].style.backgroundImage =
    'url("' + (authorPic || "./silhouette.jpg") + '")';

  return postElement;
}

/**
 * Starts listening for new posts and populates posts lists.
 */
function startDatabaseQueries() {
  var myUserId = firebase.auth().currentUser.uid;
  var userPostsRef = firebase.database().ref("user-posts/" + myUserId);

  var fetchPosts = function (postsRef, sectionElement) {
    postsRef.on("child_added", function (data) {
      var author = data.val().author || "Anonymous";
      var containerElement =
        sectionElement.getElementsByClassName("posts-container")[0];

      let postElement = createPostElement(
        data.key,
        data.val().title,
        data.val().body,
        author,
        data.val().uid,
        data.val().authorPic
      );

      postElement
        .querySelector(`span[post-id="${data.key}"]`)
        .addEventListener("click", (e) => {
          console.log("clicked post " + data.key);
          let postRef = firebase.database().ref("/posts/" + data.key);
          let userPostRef = firebase
            .database()
            .ref("/user-posts/" + currentUID + "/" + data.key);

          userPostRef
            .remove()
            .then(() => {
              console.log("removed post " + data.key);
            })
            .catch(() => {
              console.log("error removing");
            });

          postRef
            .remove()
            .then(() => {
              console.log("removed post " + data.key);
            })
            .catch(() => {
              console.log("error removing");
            });
        });

      containerElement.insertBefore(postElement, containerElement.firstChild);
    });
    postsRef.on("child_changed", function (data) {
      var containerElement =
        sectionElement.getElementsByClassName("posts-container")[0];
      var postElement = containerElement.getElementsByClassName(
        "post-" + data.key
      )[0];
      postElement.getElementsByClassName("mdl-card__title-text")[0].innerText =
        data.val().title;
      postElement.getElementsByClassName("username")[0].innerText =
        data.val().author;
      postElement.getElementsByClassName("text")[0].innerText = data.val().body;
      postElement.getElementsByClassName("star-count")[0].innerText =
        data.val().starCount;
    });
    postsRef.on("child_removed", function (data) {
      var containerElement =
        sectionElement.getElementsByClassName("posts-container")[0];
      var post = containerElement.getElementsByClassName("post-" + data.key)[0];
      post.parentElement.removeChild(post);
    });
  };

  // Fetching and displaying all posts of each sections.
  fetchPosts(userPostsRef, userPostsSection);

  listeningFirebaseRefs.push(userPostsRef);
}

/**
 * Writes the user's data to the database.
 */
function writeUserData(userId, name, email, imageUrl) {
  firebase
    .database()
    .ref("users/" + userId)
    .set({
      username: name,
      email: email,
      profile_picture: imageUrl,
    });
}

/**
 * Cleanups the UI and removes all Firebase listeners.
 */
function cleanupUi() {
  // Remove all previously displayed posts.
  userPostsSection.getElementsByClassName("posts-container")[0].innerHTML = "";

  // Stop all currently listening Firebase listeners.
  listeningFirebaseRefs.forEach(function (ref) {
    ref.off();
  });
  listeningFirebaseRefs = [];
}

/**
 * The ID of the currently signed-in User. We keep track of this to detect Auth state change events that are just
 * programmatic token refresh but not a User status change.
 */
var currentUID;

/**
 * Triggers every time there is a change in the Firebase auth state (i.e. user signed-in or user signed out).
 */
function onAuthStateChanged(user) {
  // We ignore token refresh events.
  if (user && currentUID === user.uid) {
    return;
  }

  cleanupUi();
  if (user) {
    console.log("Usuário logou");
    currentUID = user.uid;
    splashPage.style.display = "none";
    writeUserData(user.uid, user.displayName, user.email, user.photoURL);
    startDatabaseQueries();
  } else {
    console.log("Usuário deslogou");
    // Set currentUID to null.
    currentUID = null;
    // Display the splash page where you can sign-in.
    splashPage.style.display = "";
  }
}

/**
 * Creates a new post for the current user.
 */
// acessar o banco
function newPostForCurrentUser(title, text) {
  var userId = firebase.auth().currentUser.uid;

  let currentUser = firebase.database().ref("/users/" + userId);

  return currentUser.once("value").then(function (snapshot) {
    var username = (snapshot.val() && snapshot.val().username) || "Anonymous";
    return writeNewPost(
      firebase.auth().currentUser.uid,
      username,
      firebase.auth().currentUser.photoURL,
      title,
      text
    );
  });
}

/**
 * Displays the given section element and changes styling of the given button.
 */
function showSection(sectionElement, buttonElement) {
  userPostsSection.style.display = "none";

  addPost.style.display = "none";

  myPostsMenuButton.classList.remove("is-active");

  if (sectionElement) {
    sectionElement.style.display = "block";
  }
  if (buttonElement) {
    buttonElement.classList.add("is-active");
  }
}

// Bindings on load.
window.addEventListener(
  "load",
  function () {
    // Bind Sign in button.
    signInButton.addEventListener("click", function () {
      var provider = new firebase.auth.GoogleAuthProvider();
      firebase.auth().signInWithPopup(provider);
    });

    // Bind Sign out button.
    signOutButton.addEventListener("click", function () {
      firebase.auth().signOut();
    });

    // Listen for auth state changes
    firebase.auth().onAuthStateChanged(onAuthStateChanged);

    // Saves message on form submit.
    messageForm.onsubmit = function (e) {
      e.preventDefault();
      var text = messageInput.value;
      var title = titleInput.value;
      if (text && title) {
        newPostForCurrentUser(title, text).then(function () {
          myPostsMenuButton.click();
        });
        messageInput.value = "";
        titleInput.value = "";
      }
    };

    myPostsMenuButton.onclick = function () {
      showSection(userPostsSection, myPostsMenuButton);
    };

    addButton.onclick = function () {
      showSection(addPost);
      messageInput.value = "";
      titleInput.value = "";
    };
    myPostsMenuButton.onclick();
  },
  false
);
