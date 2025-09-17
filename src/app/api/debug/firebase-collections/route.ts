// src/app/api/debug/firebase-collections/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
    console.log('=== DEBUG FIREBASE COLLECTIONS ===');

    try {
        const adminDb = getAdminDb();

        console.log('🔍 Checking Firebase connection...');

        // Try to list collections (this might not work depending on permissions)
        try {
            const collections = await adminDb.listCollections();
            console.log('📁 Available collections:', collections.map(c => c.id));
        } catch (error) {
            console.log('⚠️ Could not list collections:', error);
        }

        // Try to access the users collection directly
        console.log('👥 Checking users collection...');
        const usersCollection = adminDb.collection('users');

        // Get all documents without any ordering
        const allSnapshot = await usersCollection.get();
        console.log('📊 Found', allSnapshot.docs.length, 'documents in users collection');

        const sampleData = allSnapshot.docs.slice(0, 3).map(doc => ({
            id: doc.id,
            data: doc.data(),
            exists: doc.exists
        }));

        console.log('📋 Sample documents:', sampleData);

        // Also try with ordering to see if that's the issue
        try {
            console.log('🔄 Trying with email ordering...');
            const orderedSnapshot = await usersCollection.orderBy('email').get();
            console.log('📊 Ordered query found', orderedSnapshot.docs.length, 'documents');
        } catch (orderError) {
            console.log('❌ Ordering failed:', orderError);
        }

        return NextResponse.json({
            success: true,
            totalDocuments: allSnapshot.docs.length,
            sampleDocuments: sampleData,
            message: 'Firebase connection successful'
        });

    } catch (error) {
        console.error('❌ Firebase connection error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false
        }, { status: 500 });
    }
}