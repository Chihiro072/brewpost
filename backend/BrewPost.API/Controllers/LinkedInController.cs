using BrewPost.Core.Entities;
using BrewPost.Core.Interfaces;
using BrewPost.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace BrewPost.API.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class LinkedInController : ControllerBase
{
    private readonly IOAuthService _oAuthService;
    private readonly BrewPostDbContext _dbContext;

    public LinkedInController(IOAuthService oAuthService, BrewPostDbContext dbContext)
    {
        _oAuthService = oAuthService;
        _dbContext = dbContext;
    }

    [HttpGet("linkedin-auth-url")]
    public async Task<IActionResult> GetLinkedInAuthUrl([FromQuery] string? redirectUri)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var frontendBase = Environment.GetEnvironmentVariable("FRONTEND_BASE_URL") ?? "http://localhost:5173";
        var callback = string.IsNullOrWhiteSpace(redirectUri) ? $"{frontendBase}/callback" : redirectUri;
        var state = Guid.NewGuid().ToString();
        var url = await _oAuthService.GetAuthorizationUrlAsync("linkedin", callback, state);
        return Ok(new { url, state });
    }

    [HttpGet("linkedin-token-status")]
    public async Task<IActionResult> GetLinkedInTokenStatus()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var uid = Guid.Parse(userId);
        var account = await _dbContext.SocialAccounts
            .FirstOrDefaultAsync(sa => sa.UserId == uid && sa.Provider.ToLower() == "linkedin");
        var valid = account != null && !string.IsNullOrEmpty(account.AccessToken) && (!account.ExpiresAt.HasValue || account.ExpiresAt > DateTime.UtcNow);
        if (!valid)
        {
            var envToken = Environment.GetEnvironmentVariable("LINKEDIN_ACCESS_TOKEN");
            if (!string.IsNullOrWhiteSpace(envToken))
            {
                using var client = new HttpClient();
                var req = new HttpRequestMessage(HttpMethod.Get, "https://api.linkedin.com/v2/me");
                req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", envToken);
                req.Headers.TryAddWithoutValidation("X-Restli-Protocol-Version", "2.0.0");
                var resp = await client.SendAsync(req);
                valid = resp.IsSuccessStatusCode;
            }
        }
        return Ok(new { valid });
    }

    [HttpPost("linkedin-refresh-token")]
    public async Task<IActionResult> RefreshLinkedInToken()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var uid = Guid.Parse(userId);
        var account = await _dbContext.SocialAccounts
            .FirstOrDefaultAsync(sa => sa.UserId == uid && sa.Provider.ToLower() == "linkedin");

        if (account == null) return NotFound(new { error = "No linked LinkedIn account" });
        if (string.IsNullOrEmpty(account.RefreshToken)) return BadRequest(new { error = "No refresh token available" });

        var success = await _oAuthService.RefreshTokenAsync(account);
        return Ok(new { success });
    }

    [HttpGet("linkedin-callback")]
    public async Task<IActionResult> LinkedInCallback([FromQuery] string code, [FromQuery] string? state, [FromQuery] string? redirectUri)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();
        if (string.IsNullOrWhiteSpace(code)) return BadRequest(new { error = "Missing code" });

        var frontendBase = Environment.GetEnvironmentVariable("FRONTEND_BASE_URL") ?? "http://localhost:5173";
        var callback = string.IsNullOrWhiteSpace(redirectUri) ? $"{frontendBase}/callback" : redirectUri;

        var token = await _oAuthService.ExchangeCodeForTokenAsync("linkedin", code, callback);
        var profile = await _oAuthService.GetUserProfileAsync("linkedin", token.AccessToken);

        var uid = Guid.Parse(userId);
        var user = await _dbContext.Users.FindAsync(uid);
        if (user == null) return Unauthorized();

        await _oAuthService.LinkSocialAccountAsync(user, "linkedin", profile, token);

        return Ok(new { success = true });
    }

    public class PostLinkedInRequest
    {
        public string? text { get; set; }
        public string? imageUrl { get; set; }
    }

    [HttpPost("post-linkedin")]
    public async Task<IActionResult> PostToLinkedIn([FromBody] PostLinkedInRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();
        if (request == null)
            return BadRequest(new { error = "Invalid request" });
        if (string.IsNullOrWhiteSpace(request.text) && string.IsNullOrWhiteSpace(request.imageUrl))
            return BadRequest(new { error = "Text or imageUrl is required" });

        var uid = Guid.Parse(userId);
        var account = await _dbContext.SocialAccounts
            .FirstOrDefaultAsync(sa => sa.UserId == uid && sa.Provider.ToLower() == "linkedin");
        string accessToken = account?.AccessToken ?? string.Empty;
        string authorUrn = string.Empty;
        if (!string.IsNullOrEmpty(accessToken))
        {
            authorUrn = $"urn:li:person:{account!.ProviderId}";
        }
        else
        {
            var envToken = Environment.GetEnvironmentVariable("LINKEDIN_ACCESS_TOKEN");
            if (string.IsNullOrWhiteSpace(envToken))
                return BadRequest(new { error = "LinkedIn account not linked and no env token configured" });

            using var idClient = new HttpClient();
            var idReq = new HttpRequestMessage(HttpMethod.Get, "https://api.linkedin.com/v2/me");
            idReq.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", envToken);
            idReq.Headers.TryAddWithoutValidation("X-Restli-Protocol-Version", "2.0.0");
            var idResp = await idClient.SendAsync(idReq);
            if (!idResp.IsSuccessStatusCode)
                return StatusCode((int)idResp.StatusCode, new { error = "Failed to validate env token" });
            var idBody = await idResp.Content.ReadAsStringAsync();
            var idDoc = JsonDocument.Parse(idBody);
            var pid = idDoc.RootElement.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;
            if (string.IsNullOrWhiteSpace(pid))
                return BadRequest(new { error = "Could not resolve LinkedIn user id from env token" });
            authorUrn = $"urn:li:person:{pid}";
            accessToken = envToken!;
        }

        using var client = new HttpClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        client.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");
        if (!string.IsNullOrWhiteSpace(request.imageUrl))
        {
            var registerPayload = new
            {
                registerUploadRequest = new Dictionary<string, object>
                {
                    ["owner"] = authorUrn,
                    ["recipes"] = new[] { "urn:li:digitalmediaRecipe:feedshare-image" },
                    ["serviceRelationships"] = new[] {
                        new Dictionary<string, object>
                        {
                            ["relationshipType"] = "OWNER",
                            ["identifier"] = "urn:li:userGeneratedContent"
                        }
                    }
                }
            };

            var regContent = new StringContent(JsonSerializer.Serialize(registerPayload), System.Text.Encoding.UTF8, "application/json");
            var regResp = await client.PostAsync("https://api.linkedin.com/v2/assets?action=registerUpload", regContent);
            var regBody = await regResp.Content.ReadAsStringAsync();
            if (!regResp.IsSuccessStatusCode)
            {
                return StatusCode((int)regResp.StatusCode, new { error = regBody });
            }

            var regDoc = JsonDocument.Parse(regBody);
            var valueElem = regDoc.RootElement.GetProperty("value");
            string uploadUrl = valueElem.GetProperty("uploadMechanism").GetProperty("com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest").GetProperty("uploadUrl").GetString() ?? string.Empty;
            string assetUrn = valueElem.GetProperty("asset").GetString() ?? string.Empty;
            if (string.IsNullOrEmpty(uploadUrl) || string.IsNullOrEmpty(assetUrn))
            {
                return BadRequest(new { error = "Invalid upload registration response" });
            }

            using var downClient = new HttpClient();
            var imgResp = await downClient.GetAsync(request.imageUrl);
            if (!imgResp.IsSuccessStatusCode)
            {
                return StatusCode((int)imgResp.StatusCode, new { error = "Failed to download image" });
            }
            var imgBytes = await imgResp.Content.ReadAsByteArrayAsync();
            var ct = imgResp.Content.Headers.ContentType?.ToString() ?? "image/jpeg";

            var putContent = new ByteArrayContent(imgBytes);
            putContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(ct);
            var putResp = await client.PutAsync(uploadUrl, putContent);
            var putBody = await putResp.Content.ReadAsStringAsync();
            if (!putResp.IsSuccessStatusCode)
            {
                return StatusCode((int)putResp.StatusCode, new { error = putBody });
            }

            var imagePayload = new
            {
                author = authorUrn,
                lifecycleState = "PUBLISHED",
                specificContent = new Dictionary<string, object>
                {
                    ["com.linkedin.ugc.ShareContent"] = new Dictionary<string, object>
                    {
                        ["shareCommentary"] = new Dictionary<string, object> { ["text"] = request.text ?? string.Empty },
                        ["shareMediaCategory"] = "IMAGE",
                        ["media"] = new object[]
                        {
                            new Dictionary<string, object>
                            {
                                ["status"] = "READY",
                                ["description"] = new Dictionary<string, object> { ["text"] = request.text ?? string.Empty },
                                ["media"] = assetUrn,
                                ["title"] = new Dictionary<string, object> { ["text"] = "Image" }
                            }
                        }
                    }
                },
                visibility = new Dictionary<string, object>
                {
                    ["com.linkedin.ugc.MemberNetworkVisibility"] = "PUBLIC"
                }
            };

            var postContent = new StringContent(JsonSerializer.Serialize(imagePayload), System.Text.Encoding.UTF8, "application/json");
            var postResp = await client.PostAsync("https://api.linkedin.com/v2/ugcPosts", postContent);
            var postBody = await postResp.Content.ReadAsStringAsync();
            if (!postResp.IsSuccessStatusCode)
            {
                return StatusCode((int)postResp.StatusCode, new { error = postBody });
            }

            try
            {
                var doc = JsonDocument.Parse(postBody);
                var urn = doc.RootElement.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;
                return Ok(new { ok = true, postId = urn, urn });
            }
            catch
            {
                return Ok(new { ok = true });
            }
        }
        else
        {
            var payload = new
            {
                author = authorUrn,
                lifecycleState = "PUBLISHED",
                specificContent = new Dictionary<string, object>
                {
                    ["com.linkedin.ugc.ShareContent"] = new Dictionary<string, object>
                    {
                        ["shareCommentary"] = new Dictionary<string, object> { ["text"] = request.text },
                        ["shareMediaCategory"] = "NONE"
                    }
                },
                visibility = new Dictionary<string, object>
                {
                    ["com.linkedin.ugc.MemberNetworkVisibility"] = "PUBLIC"
                }
            };

            var content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");
            var resp = await client.PostAsync("https://api.linkedin.com/v2/ugcPosts", content);
            var body = await resp.Content.ReadAsStringAsync();
            if (!resp.IsSuccessStatusCode)
            {
                return StatusCode((int)resp.StatusCode, new { error = body });
            }

            try
            {
                var doc = JsonDocument.Parse(body);
                var urn = doc.RootElement.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;
                return Ok(new { ok = true, postId = urn, urn });
            }
            catch
            {
                return Ok(new { ok = true });
            }
        }
    }
}
