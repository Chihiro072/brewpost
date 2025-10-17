import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface XTokens {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

export class XTokenManager {
  private static readonly TOKEN_FILE_PATH = join(process.cwd(), 'x_tokens.json');

  /**
   * Get stored tokens from the file system
   */
  static getStoredTokens(): XTokens | null {
    try {
      const tokenData = readFileSync(this.TOKEN_FILE_PATH, 'utf8');
      const tokens = JSON.parse(tokenData);
      
      // Calculate expires_at if not present but expires_in is available
      if (!tokens.expires_at && tokens.expires_in) {
        // Assume the token was issued recently if no timestamp is available
        const now = Math.floor(Date.now() / 1000);
        tokens.expires_at = now + tokens.expires_in;
      }
      
      return tokens;
    } catch (error) {
      console.log('No stored X tokens found or invalid format');
      return null;
    }
  }

  /**
   * Save tokens to the file system
   */
  static saveTokens(tokens: XTokens): void {
    try {
      // Add expires_at timestamp if not present
      if (!tokens.expires_at && tokens.expires_in) {
        const now = Math.floor(Date.now() / 1000);
        tokens.expires_at = now + tokens.expires_in;
      }
      
      writeFileSync(this.TOKEN_FILE_PATH, JSON.stringify(tokens, null, 2));
      console.log('✅ X tokens saved successfully');
    } catch (error) {
      console.error('❌ Failed to save X tokens:', error);
      throw error;
    }
  }

  /**
   * Check if the current access token is still valid
   */
  static isTokenValid(tokens: XTokens): boolean {
    if (!tokens || !tokens.access_token) {
      return false;
    }

    // If no expiration info, assume it might be valid (let API decide)
    if (!tokens.expires_at) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    const bufferTime = 300; // 5 minutes buffer

    return tokens.expires_at > (now + bufferTime);
  }

  /**
   * Refresh the access token using the refresh token
   */
  static async refreshAccessToken(): Promise<XTokens> {
    const currentTokens = this.getStoredTokens();
    
    if (!currentTokens || !currentTokens.refresh_token) {
      throw new Error('No refresh token available. Please re-authorize the application.');
    }

    console.log('🔄 Refreshing X access token...');

    const clientId = process.env.VITE_X_CLIENT_ID;
    const clientSecret = process.env.VITE_X_CLIENT_SECRET;

    if (!clientId) {
      throw new Error('VITE_X_CLIENT_ID not configured in environment variables');
    }

    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: currentTokens.refresh_token,
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      // Add authentication based on client type
      if (clientSecret) {
        // Confidential client - use Basic Auth
        const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        headers['Authorization'] = `Basic ${basic}`;
      } else {
        // Public client - include client_id in body
        body.append('client_id', clientId);
      }

      const response = await fetch('https://api.x.com/2/oauth2/token', {
        method: 'POST',
        headers,
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Token refresh failed:', response.status, errorData);
        throw new Error(`Token refresh failed: ${errorData.error_description || errorData.error || 'Unknown error'}`);
      }

      const newTokens = await response.json() as XTokens;
      
      // Merge with existing tokens (preserve refresh_token if not returned)
      const mergedTokens: XTokens = {
        ...currentTokens,
        ...newTokens,
        refresh_token: newTokens.refresh_token || currentTokens.refresh_token,
      };

      // Save the new tokens
      this.saveTokens(mergedTokens);

      console.log('✅ X tokens refreshed successfully');
      return mergedTokens;
      
    } catch (error) {
      console.error('❌ Error refreshing X tokens:', error);
      throw error;
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  static async getValidAccessToken(): Promise<string> {
    let tokens = this.getStoredTokens();

    // If no tokens, try to use environment variables as fallback
    if (!tokens) {
      const envAccessToken = process.env.VITE_X_ACCESS_TOKEN;
      if (envAccessToken) {
        console.log('🔄 Using access token from environment variables');
        return envAccessToken;
      }
      throw new Error('No X tokens found. Please authorize the application first.');
    }

    // Check if token is still valid
    if (this.isTokenValid(tokens)) {
      console.log('✅ Using existing valid access token');
      return tokens.access_token;
    }

    // Token expired, try to refresh
    console.log('🔄 Access token expired, refreshing...');
    try {
      tokens = await this.refreshAccessToken();
      return tokens.access_token;
    } catch (error) {
      // If refresh fails, try environment token as last resort
      const envAccessToken = process.env.VITE_X_ACCESS_TOKEN;
      if (envAccessToken) {
        console.log('🔄 Refresh failed, falling back to environment token');
        return envAccessToken;
      }
      throw error;
    }
  }

  /**
   * Clear stored tokens (for logout)
   */
  static clearTokens(): void {
    try {
      writeFileSync(this.TOKEN_FILE_PATH, JSON.stringify({}));
      console.log('✅ X tokens cleared');
    } catch (error) {
      console.error('❌ Failed to clear X tokens:', error);
    }
  }

  /**
   * Get token status for debugging
   */
  static getTokenStatus(): { hasTokens: boolean; isValid: boolean; expiresAt?: number } {
    const tokens = this.getStoredTokens();
    
    if (!tokens || !tokens.access_token) {
      return { hasTokens: false, isValid: false };
    }

    const isValid = this.isTokenValid(tokens);
    
    return {
      hasTokens: true,
      isValid,
      expiresAt: tokens.expires_at,
    };
  }
}