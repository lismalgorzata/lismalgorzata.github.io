import { getAuth, onAuthStateChanged, updatePassword } from 'firebase/auth';
import {
    collection,
    getDocs,
    // getDoc,
    doc,
    addDoc,
    where,
    query,
    deleteDoc,
    updateDoc,
    serverTimestamp,
    orderBy,
    increment
} from 'firebase/firestore'
import { db } from '@/main.js'
import Vue from "core-js/internals/task";

export const actionTypes = {
    getPostsByUserId: '[firedb] getPostsByUserId',
    addPost: '[firedb] addPost',
    addComment: '[firedb] addComment', // New action type for adding comments
    updatePassword: '[auth] Update Password',
    getUserDetails: '[auth] Get User Details',
    getLikesForPosts: '[firedb] getLikesForPosts',
    incrementLikes: '[firedb] Increment Likes',
    decrementLikes: '[firedb] Decrement Likes',
    checkUserLike: '[firedb] Check User Like'
}

export const mutationType = {
    setPosts: '[firedb] setPosts',
    addPostSuccess: '[firedb] addPostSuccess',
    addPostStart: '[firedb] addPostStart',
    setLikes: '[firedb] setLikes',
    incrementLikesSuccess: '[firedb] Increment Likes Success'
}

const state = {
    posts: undefined,
    isLoading: false,
    likes: {}
}
const mutations = {
    [mutationType.setPosts] (state, payload) {
        state.posts = payload;
    },
    [mutationType.addPostSuccess] (state) {
        state.isLoading = false;
    },
    [mutationType.addCommentSuccess] (state) { // Handles the state change on comment addition
        state.isLoading = false; // You can modify this as needed
    },
    [mutationType.addPostStart] (state) {
        state.isLoading = true
    },
    [mutationType.setLikes] (state, payload) {
        state.likes = payload;
    },
    [mutationType.incrementLikesSuccess] (state, { postId, newLikes }) {
        Vue.set(state.likes, postId, newLikes);
        console.log(`Likes for post ${postId} incremented successfully to ${newLikes}`);
    }
};

const actions = {
    [actionTypes.getPostsByUserId] (context, { uid }) {
        context.commit(mutationType.addPostStart);
        const q = uid ? query(collection(db, 'posts'), where('uid', '==', uid), orderBy('created', 'desc')) : query(collection(db, 'posts'), orderBy('created', 'desc'));
        getDocs(q).then((result) => {
            const posts = result.docs.map((doc) => ({
                id: doc.id,
                data: doc.data()
            }));
            context.commit(mutationType.setPosts, posts);
        });
    },
    [actionTypes.addPost] (context, data) {
        const auth = getAuth();
        onAuthStateChanged(auth, (user) => {
            if (user) {
                addDoc(collection(db, 'posts'), {
                    data,
                    uid: user.uid,
                    created: serverTimestamp()
                }).then(() => {
                    context.commit(mutationType.addPostSuccess);
                });
            }
        });
    },
    [actionTypes.addComment] (context, { postId, comment }) { // New action to add a comment
        console.log("addCommentIsFiring");
        const commentRef = collection(db, "comments", postId, "userComments");
        const auth = getAuth();
        if (auth.currentUser) {
            addDoc(commentRef, {
                text: comment,
                created: serverTimestamp(),
                uid: auth.currentUser.uid
            }).then(() => {
                context.commit(mutationType.addCommentSuccess);
            }).catch(error => {
                console.error("Error adding comment:", error);
            });
        }
    },
    [actionTypes.updatePassword] (context, { newPassword }) {
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
            updatePassword(user, newPassword).then(() => {
                context.commit('Password updated successfully');
            }).catch((error) => {
                console.error('Error updating password:', error);
            });
        }
    },
    [actionTypes.getLikesForPosts] (context) {
        return new Promise((resolve) => {
            const q = query(collection(db, 'posts'), orderBy('created', 'desc'));

            getDocs(q).then((result) => {
                const likes = result.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        likes: data.likes || 0
                    };
                });
                context.commit(mutationType.setLikes, likes);
                resolve(likes);
            }).catch(error => {
                console.error("Error getting likes for posts:", error);
                resolve([]);
            });
        });
    },
    [actionTypes.incrementLikes] (context, { postId, userId }) {
        const postRef = doc(db, 'posts', postId);
        const userLikesRef = collection(db, 'userLikes');

        return new Promise((resolve, reject) => {
            updateDoc(postRef, {
                likes: increment(1)
            }).then(() => {
                console.log('Likes incremented successfully.');

                return addDoc(userLikesRef, {
                    postId: postId,
                    userId: userId,
                    date: new Date()
                });
            }).then(() => {
                console.log('User like added successfully.');
                resolve();
            }).catch(error => {
                console.error("Failed to increment likes or add user like:", error);
                reject(error);
            });
        });
    },
    [actionTypes.decrementLikes] (context, { postId, userId }) {
        const postRef = doc(db, 'posts', postId);
        const userLikesRef = collection(db, 'userLikes');
        const q = query(userLikesRef, where("postId", "==", postId), where("userId", "==", userId));

        return new Promise((resolve, reject) => {
            getDocs(q).then(querySnapshot => {
                querySnapshot.forEach(doc => {
                    deleteDoc(doc.ref);
                });

                updateDoc(postRef, {
                    likes: increment(-1)
                }).then(() => {
                    console.log('Likes decremented successfully.');
                    resolve();
                }).catch(error => {
                    console.error("Failed to decrement likes:", error);
                    reject(error);
                });
            }).catch(error => {
                console.error("Failed to find user like document:", error);
                reject(error);
            });
        });
    },
    [actionTypes.checkUserLike] (context, { postId, userId }) {
        const likesRef = collection(db, 'userLikes');
        const q = query(likesRef, where("postId", "==", postId), where("userId", "==", userId));
        return getDocs(q).then(querySnapshot => {
            return querySnapshot.size > 0;
        }).catch(error => {
            console.error("Failed to check user likes:", error);
            return false;
        });
    },
    [actionTypes.getUserDetails] () {
        return new Promise((resolve, reject) => {
            const auth = getAuth()
            const user = auth.currentUser

            if (user) {
                const userDetails = {
                    uid: user.uid,
                    email: user.email,
                    providers: user.providerData.map((provider) => provider.providerId),
                    created: user.metadata.creationTime,
                    lastSignIn: user.metadata.lastSignInTime
                }
                resolve(userDetails)
            } else {
                // eslint-disable-next-line prefer-promise-reject-errors
                reject('No authenticated user')
            }
        })
    }
};

export default {
    actions,
    mutations,
    state
};
