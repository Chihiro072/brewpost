interface XAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface PostTweetParams {
  text: string;
}

interface PostTweetWithImageParams {
  text: string;
  imageUrl: string;
}

interface XServiceResponse {
  ok: boolean;
  error?: string;
  tweetId?: string;
}

interface AuthUrlResponse {
  url?: string;
  error?: string;
}

interface RefreshTokensResponse {
  success: boolean;
  error?: string;
}

export class XService {
  private static readonly BASE_URL = import.meta.env.VITE_BACKEND_URL || '/api';

  /**
   * Post a text-only tweet
   */
  static async postTweet(text: string): Promise<XServiceResponse> {
    try {
      const response = await fetch(`${this.BASE_URL}/post-tweet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          ok: false,
          error: errorData.error || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      return {
        ok: true,
        tweetId: data.tweetId || data.id
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Post a tweet with an image (with or without text)
   */
  static async postTweetWithImage({ text, imageUrl }: PostTweetWithImageParams): Promise<XServiceResponse> {
    try {
      const response = await fetch(`${this.BASE_URL}/post-tweet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: text || '', // Allow empty text for image-only posts
          imageUrl 
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          ok: false,
          error: errorData.error || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      return {
        ok: true,
        tweetId: data.tweetId || data.id
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Get X OAuth authorization URL
   */
  static async getAuthUrl(): Promise<AuthUrlResponse> {
    try {
      const response = await fetch(`${this.BASE_URL}/x-auth-url`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          error: errorData.error || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      return {
        url: data.url || data.authUrl
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Refresh X OAuth tokens
   */
  static async refreshTokens(): Promise<RefreshTokensResponse> {
    try {
      const response = await fetch(`${this.BASE_URL}/x-refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      return {
        success: data.success || true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Check if user has valid X tokens
   */
  static async checkTokens(): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.BASE_URL}/x-refresh-token`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        return { valid: false, error: 'No valid tokens found' };
      }

      const data = await response.json();
      return { valid: data.valid || false };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }

  /**
   * Helper method to handle image upload for posting
   */
  static async uploadImage(imageFile: File): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await fetch(`${this.BASE_URL}/save-image`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      return {
        success: true,
        imageUrl: data.imageUrl || data.url
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload error'
      };
    }
  }
}

// Export types for use in other components
export type {
  XAuthTokens,
  PostTweetParams,
  PostTweetWithImageParams,
  XServiceResponse,
  AuthUrlResponse,
  RefreshTokensResponse
};