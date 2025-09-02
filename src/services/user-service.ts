import { collection, doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User } from '@/models/types';

const usersCollection = collection(db, 'users');

export async function getUser(userId: string): Promise<User | null> {
    const docRef = doc(usersCollection, userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        // Convert Firestore Timestamp to JS Date
        const user: User = {
            id: docSnap.id,
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            experience: data.experience,
            frequency: data.frequency,
            goal: data.goal,
            programId: data.programId,
            startDate: data.startDate instanceof Timestamp ? data.startDate.toDate() : undefined,
            personalRecords: data.personalRecords || {},
        };
        return user;
    }
    return null;
}

export async function createUser(userId: string, data: Omit<User, 'id' | 'startDate' | 'programId' | 'personalRecords'>): Promise<User> {
    const userRef = doc(usersCollection, userId);
    const userData = {
        ...data,
        programId: null,
        startDate: null,
        personalRecords: {}, // Initialize with an empty object
    };
    await setDoc(userRef, userData);
    const createdUser: User = { 
        id: userId, 
        ...data, 
        personalRecords: {}
    };
    return createdUser;
}


export async function updateUser(userId: string, data: Partial<Omit<User, 'id'>>): Promise<void> {
    const userRef = doc(usersCollection, userId);
    const dataToUpdate: { [key: string]: any } = { ...data };

    // Convert JS Date back to Firestore Timestamp if it exists
    if (data.startDate) {
        dataToUpdate.startDate = Timestamp.fromDate(data.startDate);
    }
    
    await updateDoc(userRef, dataToUpdate);
}
