import { getAuth, onAuthStateChanged, updatePassword } from 'firebase/auth'
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
        state.posts = payload
    },
    [mutationType.addPostSuccess] (state) {
        state.isLoading = false
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
}

const actions = {
    [actionTypes.getPostsByUserId] (context, { uid }) {
        return new Promise((resolve) => {
            context.commit(mutationType.addPostStart)
            let q = query(collection(db, 'posts'), orderBy('created', 'desc'))
            if (uid) {
                q = query(
                    collection(db, 'posts'),
                    where('uid', '==', uid),
                    orderBy('created', 'desc')
                )
            }

            getDocs(q).then((result) => {
                const posts = result.docs.map((doc) => {
                    doc.data()
                    return {
                        id: doc.id,
                        data: doc.data()
                    }
                })
                context.commit(mutationType.setPosts, posts)
                resolve()
            })
        })
    },
    [actionTypes.addPost] (context, data) {
        return new Promise((resolve) => {
            const auth = getAuth()
            onAuthStateChanged(auth, (user) => {
                addDoc(collection(db, 'posts'), {
                    data,
                    uid: user.uid,
                    created: serverTimestamp()
                })
                context.commit(mutationType.addPostSuccess)
                resolve()
            })
        })
    },

    [actionTypes.updatePassword] (context, { newPassword }) {
        return new Promise((resolve, reject) => {
            const auth = getAuth()
            const user = auth.currentUser
            if (user) {
                updatePassword(user, newPassword)
                    .then(() => {
                        resolve('Password updated successfully')
                    })
                    .catch((error) => {
                        reject(error)
                    })
            } else {
                // eslint-disable-next-line prefer-promise-reject-errors
                reject('No authenticated user')
            }
        })
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
}
export default {
    actions,
    mutations,
    state
}
