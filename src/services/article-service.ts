// src/services/article-service.ts
'use server';

import { getAdminDb } from '@/lib/firebase-admin';
import type { Article } from '@/models/types';
import { Timestamp } from 'firebase-admin/firestore';

const articlesCollection = getAdminDb().collection('articles');

/**
 * Creates a new article in Firestore.
 */
export async function createArticle(data: Omit<Article, 'id' | 'createdAt'>): Promise<string> {
  const articleData = {
    ...data,
    createdAt: Timestamp.now(),
  };
  const docRef = await articlesCollection.add(articleData);
  return docRef.id;
}

/**
 * Fetches an article by its ID.
 */
export async function getArticle(articleId: string): Promise<Article | null> {
    const docRef = articlesCollection.doc(articleId);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
        const data = docSnap.data();
        if (data) {
             return { 
                id: docSnap.id, 
                ...data,
                createdAt: (data.createdAt as Timestamp).toDate(),
            } as Article;
        }
    }
    return null;
}

/**
 * Searches for articles based on a query string.
 * This is a simple search that checks for matches in the title and tags.
 */
export async function searchArticles(query: string): Promise<Article[]> {
  if (!query) {
    // If query is empty, return the 12 most recent articles
    const snapshot = await articlesCollection.orderBy('createdAt', 'desc').limit(12).get();
    return snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        createdAt: (doc.data().createdAt as Timestamp).toDate(),
    } as Article));
  }

  const lowerCaseQuery = query.toLowerCase();
  
  // As Firestore doesn't support full-text search natively without extensions,
  // we'll fetch all articles and filter them on the server.
  // This is not scalable for a huge number of articles, but works well for hundreds/thousands.
  // For larger scale, an external search service like Algolia or Elasticsearch would be needed.
  const snapshot = await articlesCollection.orderBy('createdAt', 'desc').get();
  
  const articles: Article[] = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    const article = { 
        id: doc.id, 
        ...data,
        createdAt: (data.createdAt as Timestamp).toDate(),
    } as Article;
    
    const titleMatch = article.title.toLowerCase().includes(lowerCaseQuery);
    const tagMatch = article.tags.some(tag => tag.toLowerCase().includes(lowerCaseQuery));
    
    if (titleMatch || tagMatch) {
      articles.push(article);
    }
  });

  return articles;
}
