using BrewPost.Core.Entities;
using BrewPost.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using System.Text;
using System.Text.Json;
using System.Web;

namespace BrewPost.Infrastructure.Services;

public class OAuthService : IOAuthService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly Dictionary<string, OAuthProvider> _providers;

    public OAuthService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _providers = InitializeProviders();
    }

    public async Task<string> GetAuthorizationUrlAsync(string provider, string redirectUri, string state)
    {
        if (!_providers.TryGetValue(provider.ToLower(), out var providerConfig))
        {
            throw new ArgumentException($"Unsupported OAuth provider: {provider}");
        }

        var queryParams = new Dictionary<string, string>
        {
            ["client_id"] = providerConfig.ClientId,
            ["redirect_uri"] = redirectUri,
            ["state"] = state,
            ["response_type"] = "code"
        };

        // Add provider-specific scopes
        if (!string.IsNullOrEmpty(providerConfig.Scope))
        {
            queryParams["scope"] = providerConfig.Scope;
        }

        var queryString = string.Join("&", queryParams.Select(kvp => $"{kvp.Key}={HttpUtility.UrlEncode(kvp.Value)}"));
        return $"{providerConfig.AuthorizationEndpoint}?{queryString}";
    }

    public async Task<OAuthTokenResponse> ExchangeCodeForTokenAsync(string provider, string code, string redirectUri)
    {
        if (!_providers.TryGetValue(provider.ToLower(), out var providerConfig))
        {
            throw new ArgumentException($"Unsupported OAuth provider: {provider}");
        }

        var requestData = new Dictionary<string, string>
        {
            ["client_id"] = providerConfig.ClientId,
            ["client_secret"] = providerConfig.ClientSecret,
            ["code"] = code,
            ["redirect_uri"] = redirectUri,
            ["grant_type"] = "authorization_code"
        };

        var content = new FormUrlEncodedContent(requestData);
        var response = await _httpClient.PostAsync(providerConfig.TokenEndpoint, content);
        
        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException($"Failed to exchange code for token: {errorContent}");
        }

        var responseContent = await response.Content.ReadAsStringAsync();
        var tokenData = JsonSerializer.Deserialize<JsonElement>(responseContent);

        var accessToken = tokenData.GetProperty("access_token").GetString() ?? throw new InvalidOperationException("No access token received");
        var refreshToken = tokenData.TryGetProperty("refresh_token", out var refreshProp) ? refreshProp.GetString() : null;
        var expiresIn = tokenData.TryGetProperty("expires_in", out var expiresProp) ? expiresProp.GetInt32() : 3600;

        return new OAuthTokenResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresAt = DateTime.UtcNow.AddSeconds(expiresIn),
            TokenType = tokenData.TryGetProperty("token_type", out var typeProp) ? typeProp.GetString() ?? "Bearer" : "Bearer"
        };
    }

    public async Task<SocialUserProfile> GetUserProfileAsync(string provider, string accessToken)
    {
        if (!_providers.TryGetValue(provider.ToLower(), out var providerConfig))
        {
            throw new ArgumentException($"Unsupported OAuth provider: {provider}");
        }

        _httpClient.DefaultRequestHeaders.Clear();
        _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {accessToken}");

        var response = await _httpClient.GetAsync(providerConfig.UserInfoEndpoint);
        
        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException($"Failed to get user profile: {errorContent}");
        }

        var responseContent = await response.Content.ReadAsStringAsync();
        var userData = JsonSerializer.Deserialize<JsonElement>(responseContent);

        return provider.ToLower() switch
        {
            "instagram" => ParseInstagramProfile(userData),
            "facebook" => ParseFacebookProfile(userData),
            "linkedin" => ParseLinkedInProfile(userData),
            _ => throw new ArgumentException($"Unsupported provider: {provider}")
        };
    }

    public async Task<bool> RefreshTokenAsync(SocialAccount socialAccount)
    {
        if (string.IsNullOrEmpty(socialAccount.RefreshToken))
        {
            return false;
        }

        if (!_providers.TryGetValue(socialAccount.Provider.ToLower(), out var providerConfig))
        {
            return false;
        }

        try
        {
            var requestData = new Dictionary<string, string>
            {
                ["client_id"] = providerConfig.ClientId,
                ["client_secret"] = providerConfig.ClientSecret,
                ["refresh_token"] = socialAccount.RefreshToken,
                ["grant_type"] = "refresh_token"
            };

            var content = new FormUrlEncodedContent(requestData);
            var response = await _httpClient.PostAsync(providerConfig.TokenEndpoint, content);
            
            if (!response.IsSuccessStatusCode)
            {
                return false;
            }

            var responseContent = await response.Content.ReadAsStringAsync();
            var tokenData = JsonSerializer.Deserialize<JsonElement>(responseContent);

            if (tokenData.TryGetProperty("access_token", out var accessTokenProp))
            {
                socialAccount.AccessToken = accessTokenProp.GetString() ?? socialAccount.AccessToken;
            }

            if (tokenData.TryGetProperty("refresh_token", out var refreshTokenProp))
            {
                socialAccount.RefreshToken = refreshTokenProp.GetString() ?? socialAccount.RefreshToken;
            }

            if (tokenData.TryGetProperty("expires_in", out var expiresInProp))
            {
                socialAccount.ExpiresAt = DateTime.UtcNow.AddSeconds(expiresInProp.GetInt32());
            }

            return true;
        }
        catch
        {
            return false;
        }
    }

    private Dictionary<string, OAuthProvider> InitializeProviders()
    {
        return new Dictionary<string, OAuthProvider>
        {
            ["instagram"] = new OAuthProvider
            {
                ClientId = _configuration["OAuth:Instagram:ClientId"] ?? throw new InvalidOperationException("Instagram ClientId not configured"),
                ClientSecret = _configuration["OAuth:Instagram:ClientSecret"] ?? throw new InvalidOperationException("Instagram ClientSecret not configured"),
                AuthorizationEndpoint = "https://api.instagram.com/oauth/authorize",
                TokenEndpoint = "https://api.instagram.com/oauth/access_token",
                UserInfoEndpoint = "https://graph.instagram.com/me?fields=id,username,account_type",
                Scope = "user_profile,user_media"
            },
            ["facebook"] = new OAuthProvider
            {
                ClientId = _configuration["OAuth:Facebook:ClientId"] ?? throw new InvalidOperationException("Facebook ClientId not configured"),
                ClientSecret = _configuration["OAuth:Facebook:ClientSecret"] ?? throw new InvalidOperationException("Facebook ClientSecret not configured"),
                AuthorizationEndpoint = "https://www.facebook.com/v18.0/dialog/oauth",
                TokenEndpoint = "https://graph.facebook.com/v18.0/oauth/access_token",
                UserInfoEndpoint = "https://graph.facebook.com/me?fields=id,name,email,picture",
                Scope = "email,public_profile,pages_manage_posts,pages_read_engagement"
            },
            ["linkedin"] = new OAuthProvider
            {
                ClientId = _configuration["OAuth:LinkedIn:ClientId"] ?? throw new InvalidOperationException("LinkedIn ClientId not configured"),
                ClientSecret = _configuration["OAuth:LinkedIn:ClientSecret"] ?? throw new InvalidOperationException("LinkedIn ClientSecret not configured"),
                AuthorizationEndpoint = "https://www.linkedin.com/oauth/v2/authorization",
                TokenEndpoint = "https://www.linkedin.com/oauth/v2/accessToken",
                UserInfoEndpoint = "https://api.linkedin.com/v2/people/~?projection=(id,firstName,lastName,emailAddress,profilePicture(displayImage~:playableStreams))",
                Scope = "r_liteprofile r_emailaddress w_member_social"
            }
        };
    }

    private static SocialUserProfile ParseInstagramProfile(JsonElement userData)
    {
        return new SocialUserProfile
        {
            ProviderId = userData.GetProperty("id").GetString() ?? string.Empty,
            Name = userData.TryGetProperty("username", out var usernameProp) ? usernameProp.GetString() ?? string.Empty : string.Empty,
            Email = string.Empty, // Instagram doesn't provide email
            AdditionalData = new Dictionary<string, object>
            {
                ["username"] = userData.TryGetProperty("username", out var u) ? u.GetString() ?? string.Empty : string.Empty,
                ["account_type"] = userData.TryGetProperty("account_type", out var at) ? at.GetString() ?? string.Empty : string.Empty
            }
        };
    }

    private static SocialUserProfile ParseFacebookProfile(JsonElement userData)
    {
        return new SocialUserProfile
        {
            ProviderId = userData.GetProperty("id").GetString() ?? string.Empty,
            Name = userData.TryGetProperty("name", out var nameProp) ? nameProp.GetString() ?? string.Empty : string.Empty,
            Email = userData.TryGetProperty("email", out var emailProp) ? emailProp.GetString() ?? string.Empty : string.Empty,
            AvatarUrl = userData.TryGetProperty("picture", out var pictureProp) && 
                       pictureProp.TryGetProperty("data", out var dataProp) && 
                       dataProp.TryGetProperty("url", out var urlProp) ? urlProp.GetString() : null,
            AdditionalData = new Dictionary<string, object>
            {
                ["facebook_id"] = userData.GetProperty("id").GetString() ?? string.Empty
            }
        };
    }

    private static SocialUserProfile ParseLinkedInProfile(JsonElement userData)
    {
        var firstName = userData.TryGetProperty("firstName", out var firstNameProp) && 
                       firstNameProp.TryGetProperty("localized", out var firstLocalizedProp) && 
                       firstLocalizedProp.TryGetProperty("en_US", out var firstEnProp) ? firstEnProp.GetString() ?? string.Empty : string.Empty;
        
        var lastName = userData.TryGetProperty("lastName", out var lastNameProp) && 
                      lastNameProp.TryGetProperty("localized", out var lastLocalizedProp) && 
                      lastLocalizedProp.TryGetProperty("en_US", out var lastEnProp) ? lastEnProp.GetString() ?? string.Empty : string.Empty;

        return new SocialUserProfile
        {
            ProviderId = userData.GetProperty("id").GetString() ?? string.Empty,
            Name = $"{firstName} {lastName}".Trim(),
            Email = userData.TryGetProperty("emailAddress", out var emailProp) ? emailProp.GetString() ?? string.Empty : string.Empty,
            AdditionalData = new Dictionary<string, object>
            {
                ["linkedin_id"] = userData.GetProperty("id").GetString() ?? string.Empty,
                ["first_name"] = firstName,
                ["last_name"] = lastName
            }
        };
    }

    private class OAuthProvider
    {
        public string ClientId { get; set; } = string.Empty;
        public string ClientSecret { get; set; } = string.Empty;
        public string AuthorizationEndpoint { get; set; } = string.Empty;
        public string TokenEndpoint { get; set; } = string.Empty;
        public string UserInfoEndpoint { get; set; } = string.Empty;
        public string Scope { get; set; } = string.Empty;
    }
}