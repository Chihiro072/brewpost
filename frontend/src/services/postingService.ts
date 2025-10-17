// src/services/postingService.ts
import apiClient from './apiService';

export async function postToX(content: string, mediaUrls?: string[]): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const response = await apiClient.post('/api/posts/x', {
      content,
      mediaUrls
    });
    
    return {
      success: true,
      postId: response.data.postId
    };
  } catch (error: any) {
    console.error('Error posting to X:', error);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to post to X'
    };
  }
}

export async function postToLinkedIn(content: string, mediaUrls?: string[]): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const response = await apiClient.post('/api/posts/linkedin', {
      content,
      mediaUrls
    });
    
    return {
      success: true,
      postId: response.data.postId
    };
  } catch (error: any) {
    console.error('Error posting to LinkedIn:', error);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to post to LinkedIn'
    };
  }
}