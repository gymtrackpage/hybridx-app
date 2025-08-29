import { collection, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User } from '@/models/types';

const usersCollection = collection(db, 'users');

export async function getUser(userId: string): Promise<User | null> {
    const docRef = doc(usersCollection, userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as User;
    }
    return null;
}

export async function createUser(userId: string, data: Omit<User, 'id'>): Promise<User> {
    const userRef = doc(usersCollection, userId);
    await setDoc(userRef, data);
    return { id: userId, ...data };
}

export async function updateUser(userId: string, data: Partial<User>): Promise<void> {
    const userRef = doc(usersCollection, userId);
    await updateDoc(userRef, data);
}
