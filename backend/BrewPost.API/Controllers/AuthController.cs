using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BrewPost.Core.Entities;
using BrewPost.Core.Interfaces;
using BrewPost.Infrastructure.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using BCrypt.Net;
using BrewPost.API.DTOs;

namespace BrewPost.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly BrewPostDbContext _context;
    private readonly IJwtService _jwtService;
    private readonly IOAuthService _oauthService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        BrewPostDbContext context,
        IJwtService jwtService,
        IOAuthService oauthService,
        ILogger<AuthController> logger)
    {
        _context = context;
        _jwtService = jwtService;
        _oauthService = oauthService;
        _logger = logger;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        try
        {
            if (request == null || string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
            {
                return BadRequest(new { message = "Email and password are required" });
            }

            // Check if user already exists
            var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
            if (existingUser != null)
            {
                return BadRequest(new { message = "User with this email already exists" });
            }

            // Hash password
            var passwordHash = HashPassword(request.Password);

            // Create new user
            var user = new User
            {
                Email = request.Email,
                PasswordHash = passwordHash,
                FirstName = request.FirstName,
                LastName = request.LastName,
                Preferences = JsonDocument.Parse("{}"),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            // Generate JWT token
            var token = _jwtService.GenerateToken(user);

            return Ok(new AuthResponse
            {
                Token = token,
                User = new UserDto
                {
                    Id = user.Id,
                    Email = user.Email,
                    FirstName = user.FirstName,
                    LastName = user.LastName,
                    AvatarUrl = user.AvatarUrl
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during user registration");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        try
        {
            if (request == null || string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
            {
                return BadRequest(new { message = "Email and password are required" });
            }

            // Find user by email
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
            if (user == null)
            {
                return Unauthorized(new { message = "Invalid email or password" });
            }

            // Verify password
            if (!VerifyPassword(request.Password, user.PasswordHash))
            {
                return Unauthorized(new { message = "Invalid email or password" });
            }

            // Generate JWT token
            var token = _jwtService.GenerateToken(user);

            return Ok(new AuthResponse
            {
                Token = token,
                User = new UserDto
                {
                    Id = user.Id,
                    Email = user.Email,
                    FirstName = user.FirstName,
                    LastName = user.LastName,
                    AvatarUrl = user.AvatarUrl
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during user login");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpGet("oauth/{provider}/authorize")]
    public async Task<IActionResult> GetOAuthUrl(string provider, [FromQuery] string redirectUri)
    {
        try
        {
            var state = Guid.NewGuid().ToString();
            var authUrl = await _oauthService.GetAuthorizationUrlAsync(provider, redirectUri, state);
            
            // Store state in session or cache for validation
            HttpContext.Session.SetString($"oauth_state_{provider}", state);
            
            return Ok(new { authUrl, state });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating OAuth URL for provider {Provider}", provider);
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("oauth/{provider}/callback")]
    public async Task<IActionResult> OAuthCallback(string provider, [FromBody] OAuthCallbackRequest request)
    {
        try
        {
            if (request == null || string.IsNullOrEmpty(request.Code) || string.IsNullOrEmpty(request.State))
            {
                return BadRequest(new { message = "Code and state are required" });
            }

            // Validate state parameter
            var storedState = HttpContext.Session.GetString($"oauth_state_{provider}");
            if (storedState != request.State)
            {
                return BadRequest(new { message = "Invalid state parameter" });
            }

            // Exchange code for token
            var tokenResponse = await _oauthService.ExchangeCodeForTokenAsync(provider, request.Code, request.RedirectUri);
            
            // Get user profile
            var userProfile = await _oauthService.GetUserProfileAsync(provider, tokenResponse.AccessToken);

            // Find or create user
            var user = await FindOrCreateUserFromSocialProfile(userProfile, provider);
            
            // Create or update social account
            await CreateOrUpdateSocialAccount(user.Id, provider, userProfile.ProviderId, tokenResponse, userProfile);

            // Generate JWT token
            var token = _jwtService.GenerateToken(user);

            return Ok(new AuthResponse
            {
                Token = token,
                User = new UserDto
                {
                    Id = user.Id,
                    Email = user.Email,
                    FirstName = user.FirstName,
                    LastName = user.LastName,
                    AvatarUrl = user.AvatarUrl
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during OAuth callback for provider {Provider}", provider);
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("refresh")]
    [Authorize]
    public async Task<IActionResult> RefreshToken()
    {
        try
        {
            var userId = User.FindFirst("user_id")?.Value;
            if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var user = await _context.Users.FindAsync(userGuid);
            if (user == null)
            {
                return Unauthorized(new { message = "User not found" });
            }

            var token = _jwtService.GenerateToken(user);

            return Ok(new { token });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during token refresh");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("logout")]
    [Authorize]
    public IActionResult Logout()
    {
        // In a stateless JWT system, logout is handled client-side by removing the token
        // For additional security, you could implement a token blacklist
        return Ok(new { message = "Logged out successfully" });
    }

    [HttpGet("status")]
    [Authorize]
    public async Task<IActionResult> GetAuthStatus()
    {
        try
        {
            var userId = User.FindFirst("user_id")?.Value;
            if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
            {
                return Ok(new { authenticated = false });
            }

            var user = await _context.Users.FindAsync(userGuid);
            if (user == null)
            {
                return Ok(new { authenticated = false });
            }

            return Ok(new { authenticated = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking auth status");
            return Ok(new { authenticated = false });
        }
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetCurrentUser()
    {
        try
        {
            var userId = User.FindFirst("user_id")?.Value;
            if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var user = await _context.Users
                .Include(u => u.SocialAccounts)
                .FirstOrDefaultAsync(u => u.Id == userGuid);
            
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            return Ok(new UserDto
            {
                Id = user.Id,
                Email = user.Email,
                FirstName = user.FirstName,
                LastName = user.LastName,
                AvatarUrl = user.AvatarUrl,
                SocialAccounts = user.SocialAccounts.Select(sa => new SocialAccountDto
                {
                    Id = sa.Id,
                    Provider = sa.Provider,
                    ProviderId = sa.ProviderId,
                    IsConnected = !string.IsNullOrEmpty(sa.AccessToken) && sa.ExpiresAt > DateTime.UtcNow
                }).ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting current user");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    private async Task<User> FindOrCreateUserFromSocialProfile(SocialUserProfile profile, string provider)
    {
        // First, try to find existing social account
        var existingSocialAccount = await _context.SocialAccounts
            .Include(sa => sa.User)
            .FirstOrDefaultAsync(sa => sa.Provider == provider && sa.ProviderId == profile.ProviderId);
        
        if (existingSocialAccount != null)
        {
            return existingSocialAccount.User;
        }

        // If email is available, try to find user by email
        if (!string.IsNullOrEmpty(profile.Email))
        {
            var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == profile.Email);
            if (existingUser != null)
            {
                return existingUser;
            }
        }

        // Create new user
        var nameParts = profile.Name.Split(' ', 2);
        var user = new User
        {
            Email = profile.Email ?? $"{profile.ProviderId}@{provider}.local",
            FirstName = nameParts.Length > 0 ? nameParts[0] : string.Empty,
            LastName = nameParts.Length > 1 ? nameParts[1] : string.Empty,
            AvatarUrl = profile.AvatarUrl,
            PasswordHash = string.Empty, // OAuth users don't have passwords
            Preferences = JsonDocument.Parse("{}"),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();
        
        return user;
    }

    private async Task CreateOrUpdateSocialAccount(Guid userId, string provider, string providerId, OAuthTokenResponse tokenResponse, SocialUserProfile profile)
    {
        var existingAccount = await _context.SocialAccounts
            .FirstOrDefaultAsync(sa => sa.UserId == userId && sa.Provider == provider);

        if (existingAccount != null)
        {
            // Update existing account
            existingAccount.AccessToken = tokenResponse.AccessToken;
            existingAccount.RefreshToken = tokenResponse.RefreshToken;
            existingAccount.ExpiresAt = tokenResponse.ExpiresAt;
            existingAccount.ProfileData = JsonDocument.Parse(JsonSerializer.Serialize(profile.AdditionalData));
        }
        else
        {
            // Create new social account
            var socialAccount = new SocialAccount
            {
                UserId = userId,
                Provider = provider,
                ProviderId = providerId,
                AccessToken = tokenResponse.AccessToken,
                RefreshToken = tokenResponse.RefreshToken,
                ExpiresAt = tokenResponse.ExpiresAt,
                ProfileData = JsonDocument.Parse(JsonSerializer.Serialize(profile.AdditionalData)),
                CreatedAt = DateTime.UtcNow
            };

            _context.SocialAccounts.Add(socialAccount);
        }

        await _context.SaveChangesAsync();
    }

    private static string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password);
    }

    private static bool VerifyPassword(string password, string hash)
    {
        return BCrypt.Net.BCrypt.Verify(password, hash);
    }
}