interface LinkedInAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

interface PostLinkedInParams {
  text: string;
}

interface PostLinkedInWithImageParams {
  text: string;
  imageUrl: string;
}

interface LinkedInServiceResponse {
  ok: boolean;
  error?: string;
  postId?: string;
  urn?: string;
}

interface AuthUrlResponse {
  url?: string;
  error?: string;
}

interface RefreshTokensResponse {
  success: boolean;
  error?: string;
}

export class LinkedInService {
  private static readonly BASE_URL = 'https://brewpost.duckdns.org/api';

  /**
   * Post a text-only LinkedIn post
   */
  static async postToLinkedIn(text: string): Promise<LinkedInServiceResponse> {
    try {
      const response = await fetch(`${this.BASE_URL}/post-linkedin`, {
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
        postId: data.postId || data.id,
        urn: data.urn
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }



  /**
   * Post a LinkedIn post with an image (with or without text)
   */
  static async postToLinkedInWithImage({ text, imageUrl }: PostLinkedInWithImageParams): Promise<LinkedInServiceResponse> {
    try {
      const response = await fetch(`${this.BASE_URL}/post-linkedin`, {
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
        postId: data.postId || data.id,
        urn: data.urn
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Get LinkedIn OAuth authorization URL
   */
  static async getAuthUrl(): Promise<AuthUrlResponse> {
    try {
      const response = await fetch(`${this.BASE_URL}/linkedin-auth-url`, {
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
   * Refresh LinkedIn OAuth tokens (if refresh token is available)
   */
  static async refreshTokens(): Promise<RefreshTokensResponse> {
    try {
      const response = await fetch(`${this.BASE_URL}/linkedin-refresh-token`, {
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
   * Check if user has valid LinkedIn tokens
   */
  static async checkTokens(): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.BASE_URL}/linkedin-token-status`, {
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

}

// Export types for use in other components
export type {
  LinkedInAuthTokens,
  PostLinkedInParams,
  PostLinkedInWithImageParams,
  LinkedInServiceResponse,
  AuthUrlResponse,
  RefreshTokensResponse
};