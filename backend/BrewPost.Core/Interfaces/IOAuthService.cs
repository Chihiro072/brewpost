using BrewPost.Core.Entities;

namespace BrewPost.Core.Interfaces;

public interface IOAuthService
{
    Task<string> GetAuthorizationUrlAsync(string provider, string redirectUri, string state);
    Task<OAuthTokenResponse> ExchangeCodeForTokenAsync(string provider, string code, string redirectUri);
    Task<SocialUserProfile> GetUserProfileAsync(string provider, string accessToken);
    Task<bool> RefreshTokenAsync(SocialAccount socialAccount);
}

public class OAuthTokenResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public string? RefreshToken { get; set; }
    public DateTime ExpiresAt { get; set; }
    public string TokenType { get; set; } = "Bearer";
}

public class SocialUserProfile
{
    public string ProviderId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public Dictionary<string, object> AdditionalData { get; set; } = new();
}