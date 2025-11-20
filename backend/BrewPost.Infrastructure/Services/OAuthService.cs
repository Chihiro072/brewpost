using BrewPost.Core.Entities;
using BrewPost.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Web;
using BrewPost.Infrastructure.Data;

namespace BrewPost.Infrastructure.Services;

public class OAuthService : IOAuthService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly Dictionary<string, OAuthProvider> _providers;
    private readonly BrewPostDbContext _dbContext;

    public OAuthService(HttpClient httpClient, IConfiguration configuration, BrewPostDbContext dbContext)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _dbContext = dbContext;
        _providers = InitializeProviders();
    }

    /// <summary>
    /// Links a social account (Instagram, Facebook, LinkedIn) to an existing app user.
    /// Does NOT handle login or JWT generation.
    /// </summary>
    public async Task<User> LinkSocialAccountAsync(User user, string socialProvider, SocialUserProfile profile, OAuthTokenResponse token)
    {
        // Check if the social account already exists for this provider and provider ID
        var socialAccount = await _dbContext.SocialAccounts
            .FirstOrDefaultAsync(sa => sa.Provider == socialProvider && sa.ProviderId == profile.ProviderId);

        if (socialAccount == null)
        {
            // Create new social account
            socialAccount = new SocialAccount
            {
                UserId = user.Id,
                Provider = socialProvider,
                ProviderId = profile.ProviderId,
                AccessToken = token.AccessToken,
                RefreshToken = token.RefreshToken,
                ExpiresAt = token.ExpiresAt,
                ProfileData = JsonDocument.Parse(JsonSerializer.Serialize(profile)),
            };

            _dbContext.SocialAccounts.Add(socialAccount);
        }
        else
        {
            // Update existing tokens
            socialAccount.AccessToken = token.AccessToken;
            socialAccount.RefreshToken = token.RefreshToken;
            socialAccount.ExpiresAt = token.ExpiresAt;
            socialAccount.ProfileData = JsonDocument.Parse(JsonSerializer.Serialize(profile));
        }

        await _dbContext.SaveChangesAsync();
        return user;
    }

    /// <summary>
    /// Gets the authorization URL to redirect the user for social account connection.
    /// </summary>
    public Task<string> GetAuthorizationUrlAsync(string socialProvider, string redirectUri, string state)
    {
        if (!_providers.TryGetValue(socialProvider.ToLower(), out var providerConfig))
            throw new ArgumentException($"Unsupported OAuth provider: {socialProvider}");

        var queryParams = new Dictionary<string, string>
        {
            ["client_id"] = providerConfig.ClientId,
            ["redirect_uri"] = redirectUri,
            ["state"] = state,
            ["response_type"] = "code"
        };

        if (!string.IsNullOrEmpty(providerConfig.Scope))
            queryParams["scope"] = providerConfig.Scope;

        var queryString = string.Join("&", queryParams.Select(kvp => $"{kvp.Key}={HttpUtility.UrlEncode(kvp.Value)}"));
        return Task.FromResult($"{providerConfig.AuthorizationEndpoint}?{queryString}");
    }

    /// <summary>
    /// Exchanges the OAuth code for an access token.
    /// </summary>
    public async Task<OAuthTokenResponse> ExchangeCodeForTokenAsync(string socialProvider, string code, string redirectUri)
    {
        if (!_providers.TryGetValue(socialProvider.ToLower(), out var providerConfig))
            throw new ArgumentException($"Unsupported OAuth provider: {socialProvider}");

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

    /// <summary>
    /// Fetches the user's profile from the social provider using the access token.
    /// </summary>
    public async Task<SocialUserProfile> GetUserProfileAsync(string socialProvider, string accessToken)
    {
        if (!_providers.TryGetValue(socialProvider.ToLower(), out var providerConfig))
            throw new ArgumentException($"Unsupported OAuth provider: {socialProvider}");

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

        return socialProvider.ToLower() switch
        {
            "instagram" => ParseInstagramProfile(userData),
            "facebook" => ParseFacebookProfile(userData),
            "linkedin" => ParseLinkedInProfile(userData),
            _ => throw new ArgumentException($"Unsupported provider: {socialProvider}")
        };
    }

    /// <summary>
    /// Refreshes the access token for a linked social account.
    /// </summary>
    public async Task<bool> RefreshTokenAsync(SocialAccount socialAccount)
    {
        if (string.IsNullOrEmpty(socialAccount.RefreshToken)) return false;
        if (!_providers.TryGetValue(socialAccount.Provider.ToLower(), out var providerConfig)) return false;

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

            if (!response.IsSuccessStatusCode) return false;

            var responseContent = await response.Content.ReadAsStringAsync();
            var tokenData = JsonSerializer.Deserialize<JsonElement>(responseContent);

            if (tokenData.TryGetProperty("access_token", out var accessTokenProp))
                socialAccount.AccessToken = accessTokenProp.GetString() ?? socialAccount.AccessToken;

            if (tokenData.TryGetProperty("refresh_token", out var refreshTokenProp))
                socialAccount.RefreshToken = refreshTokenProp.GetString() ?? socialAccount.RefreshToken;

            if (tokenData.TryGetProperty("expires_in", out var expiresInProp))
                socialAccount.ExpiresAt = DateTime.UtcNow.AddSeconds(expiresInProp.GetInt32());

            await _dbContext.SaveChangesAsync();
            return true;
        }
        catch
        {
            return false;
        }
    }

    #region Provider Initialization & Parsing

    private Dictionary<string, OAuthProvider> InitializeProviders()
    {
        string GetValue(params string[] keys)
        {
            foreach (var k in keys)
            {
                var v = _configuration[k];
                if (!string.IsNullOrWhiteSpace(v)) return v;
            }
            return string.Empty;
        }

        var providers = new Dictionary<string, OAuthProvider>();

        var igClientId = GetValue("OAuth:Instagram:ClientId", "INSTAGRAM_CLIENT_ID");
        var igClientSecret = GetValue("OAuth:Instagram:ClientSecret", "INSTAGRAM_CLIENT_SECRET");
        if (!string.IsNullOrWhiteSpace(igClientId) && !string.IsNullOrWhiteSpace(igClientSecret))
        {
            providers["instagram"] = new OAuthProvider
            {
                ClientId = igClientId,
                ClientSecret = igClientSecret,
                AuthorizationEndpoint = "https://api.instagram.com/oauth/authorize",
                TokenEndpoint = "https://api.instagram.com/oauth/access_token",
                UserInfoEndpoint = "https://graph.instagram.com/me?fields=id,username,account_type",
                Scope = "user_profile,user_media"
            };
        }

        var fbClientId = GetValue("OAuth:Facebook:ClientId", "FACEBOOK_CLIENT_ID");
        var fbClientSecret = GetValue("OAuth:Facebook:ClientSecret", "FACEBOOK_CLIENT_SECRET");
        if (!string.IsNullOrWhiteSpace(fbClientId) && !string.IsNullOrWhiteSpace(fbClientSecret))
        {
            providers["facebook"] = new OAuthProvider
            {
                ClientId = fbClientId,
                ClientSecret = fbClientSecret,
                AuthorizationEndpoint = "https://www.facebook.com/v18.0/dialog/oauth",
                TokenEndpoint = "https://graph.facebook.com/v18.0/oauth/access_token",
                UserInfoEndpoint = "https://graph.facebook.com/me?fields=id,name,email,picture",
                Scope = "email,public_profile,pages_manage_posts,pages_read_engagement"
            };
        }

        var liClientId = GetValue("OAuth:LinkedIn:ClientId", "LINKEDIN_CLIENT_ID");
        var liClientSecret = GetValue("OAuth:LinkedIn:ClientSecret", "LINKEDIN_CLIENT_SECRET");
        if (!string.IsNullOrWhiteSpace(liClientId) && !string.IsNullOrWhiteSpace(liClientSecret))
        {
            providers["linkedin"] = new OAuthProvider
            {
                ClientId = liClientId,
                ClientSecret = liClientSecret,
                AuthorizationEndpoint = "https://www.linkedin.com/oauth/v2/authorization",
                TokenEndpoint = "https://www.linkedin.com/oauth/v2/accessToken",
                UserInfoEndpoint = "https://api.linkedin.com/v2/people/~?projection=(id,firstName,lastName,emailAddress,profilePicture(displayImage~:playableStreams))",
                Scope = "r_liteprofile r_emailaddress w_member_social"
            };
        }

        return providers;
    }

    private static SocialUserProfile ParseInstagramProfile(JsonElement userData) => new SocialUserProfile
    {
        ProviderId = userData.GetProperty("id").GetString() ?? string.Empty,
        Name = userData.TryGetProperty("username", out var usernameProp) ? usernameProp.GetString() ?? string.Empty : string.Empty,
        Email = string.Empty, // Instagram does not provide email
        AdditionalData = new Dictionary<string, object>
        {
            ["username"] = userData.TryGetProperty("username", out var u) ? u.GetString() ?? string.Empty : string.Empty,
            ["account_type"] = userData.TryGetProperty("account_type", out var at) ? at.GetString() ?? string.Empty : string.Empty
        }
    };

    private static SocialUserProfile ParseFacebookProfile(JsonElement userData) => new SocialUserProfile
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

    #endregion

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
