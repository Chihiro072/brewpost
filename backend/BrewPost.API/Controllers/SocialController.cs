using BrewPost.Core.Entities;
using BrewPost.Core.Interfaces;
using BrewPost.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace BrewPost.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize] // Only logged-in users can link/unlink
public class SocialController : ControllerBase
{
    private readonly IOAuthService _oAuthService;
    private readonly BrewPostDbContext _dbContext;

    public SocialController(IOAuthService oAuthService, BrewPostDbContext dbContext)
    {
        _oAuthService = oAuthService;
        _dbContext = dbContext;
    }

    // 1️⃣ Get Authorization URL for frontend redirect
    [HttpGet("authorize/{provider}")]
    public async Task<IActionResult> GetAuthorizationUrl(string provider, [FromQuery] string redirectUri)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var state = Guid.NewGuid().ToString(); // optional CSRF/state
        var url = await _oAuthService.GetAuthorizationUrlAsync(provider, redirectUri, state);
        return Ok(new { url, state });
    }

    // 2️⃣ Connect social account (code comes from provider)
    [HttpPost("connect/{provider}")]
    public async Task<IActionResult> Connect(string provider, [FromQuery] string code, [FromQuery] string redirectUri)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var user = await _dbContext.Users.FindAsync(Guid.Parse(userId));
        if (user == null)
            return NotFound("User not found");

        // Exchange code for token
        var token = await _oAuthService.ExchangeCodeForTokenAsync(provider, code, redirectUri);
        var profile = await _oAuthService.GetUserProfileAsync(provider, token.AccessToken);

        await _oAuthService.LinkSocialAccountAsync(user, provider, profile, token);

        return Ok(new { message = $"Social account '{provider}' linked successfully." });
    }

    // 3️⃣ List linked social accounts for the current user
    [HttpGet("linked")]
    public async Task<IActionResult> GetLinkedAccounts()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var accounts = await _dbContext.SocialAccounts
            .Where(sa => sa.UserId == Guid.Parse(userId))
            .Select(sa => new
            {
                sa.Provider,
                sa.ProviderId,
                sa.CreatedAt,
                sa.ExpiresAt
            })
            .ToListAsync();

        return Ok(accounts);
    }

    // 4️⃣ Unlink a social account
    [HttpDelete("unlink/{provider}")]
    public async Task<IActionResult> Unlink(string provider)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var socialAccount = await _dbContext.SocialAccounts
            .FirstOrDefaultAsync(sa => sa.UserId == Guid.Parse(userId) && sa.Provider.ToLower() == provider.ToLower());

        if (socialAccount == null)
            return NotFound($"No linked {provider} account found for this user.");

        _dbContext.SocialAccounts.Remove(socialAccount);
        await _dbContext.SaveChangesAsync();

        return Ok(new { message = $"Social account '{provider}' unlinked successfully." });
    }
}
