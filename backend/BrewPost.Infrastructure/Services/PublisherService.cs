using BrewPost.Core.Entities;
using BrewPost.Core.Interfaces;
using BrewPost.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace BrewPost.Infrastructure.Services;

public class PublisherService : IPublisherService
{
    private readonly BrewPostDbContext _dbContext;
    private readonly ILogger<PublisherService> _logger;

    public PublisherService(BrewPostDbContext dbContext, ILogger<PublisherService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<PublishResult> PublishScheduleAsync(Schedule schedule)
    {
        if (schedule == null) throw new ArgumentNullException(nameof(schedule));

        var post = await _dbContext.Posts
            .Include(p => p.GeneratedImages)
            .FirstOrDefaultAsync(p => p.Id == schedule.PostId);

        if (post == null)
        {
            return new PublishResult { Ok = false, Error = "Post not found" };
        }

        // Only support LinkedIn for now
        if (!string.Equals(schedule.Platform, "linkedin", StringComparison.OrdinalIgnoreCase))
        {
            return new PublishResult { Ok = false, Error = "Unsupported platform" };
        }

        var account = await _dbContext.SocialAccounts
            .FirstOrDefaultAsync(sa => sa.UserId == post.UserId && sa.Provider.ToLower() == "linkedin");

        string accessToken = account?.AccessToken ?? string.Empty;
        string authorUrn = string.Empty;

        try
        {
            if (!string.IsNullOrEmpty(accessToken))
            {
                authorUrn = $"urn:li:person:{account!.ProviderId}";
            }
            else
            {
                var envToken = Environment.GetEnvironmentVariable("LINKEDIN_ACCESS_TOKEN");
                if (string.IsNullOrWhiteSpace(envToken))
                {
                    return new PublishResult { Ok = false, Error = "LinkedIn not linked and no env token configured" };
                }

                using var idClient = new HttpClient();
                var idReq = new HttpRequestMessage(HttpMethod.Get, "https://api.linkedin.com/v2/me");
                idReq.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", envToken);
                idReq.Headers.TryAddWithoutValidation("X-Restli-Protocol-Version", "2.0.0");
                var idResp = await idClient.SendAsync(idReq);
                if (!idResp.IsSuccessStatusCode)
                {
                    return new PublishResult { Ok = false, Error = "Failed to validate env token" };
                }

                var idBody = await idResp.Content.ReadAsStringAsync();
                var idDoc = JsonDocument.Parse(idBody);
                var pid = idDoc.RootElement.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;
                if (string.IsNullOrWhiteSpace(pid))
                {
                    return new PublishResult { Ok = false, Error = "Could not resolve LinkedIn user id from env token" };
                }

                authorUrn = $"urn:li:person:{pid}";
                accessToken = envToken!;
            }

            using var client = new HttpClient();
            client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            client.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");

            string text = !string.IsNullOrWhiteSpace(post.Caption) ? post.Caption : post.Title;
            var imageUrl = post.GeneratedImages?.FirstOrDefault()?.ImageUrl;

            string resultBody = string.Empty;
            int resultStatus = 200;

            if (!string.IsNullOrWhiteSpace(imageUrl))
            {
                // register upload
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
                    return new PublishResult { Ok = false, Error = regBody, StatusCode = (int)regResp.StatusCode };
                }

                var regDoc = JsonDocument.Parse(regBody);
                var valueElem = regDoc.RootElement.GetProperty("value");
                string uploadUrl = valueElem.GetProperty("uploadMechanism").GetProperty("com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest").GetProperty("uploadUrl").GetString() ?? string.Empty;
                string assetUrn = valueElem.GetProperty("asset").GetString() ?? string.Empty;
                if (string.IsNullOrEmpty(uploadUrl) || string.IsNullOrEmpty(assetUrn))
                {
                    return new PublishResult { Ok = false, Error = "Invalid upload registration response" };
                }

                using var downClient = new HttpClient();
                var imgResp = await downClient.GetAsync(imageUrl);
                if (!imgResp.IsSuccessStatusCode)
                {
                    return new PublishResult { Ok = false, Error = "Failed to download image", StatusCode = (int)imgResp.StatusCode };
                }

                var imgBytes = await imgResp.Content.ReadAsByteArrayAsync();
                var ct = imgResp.Content.Headers.ContentType?.ToString() ?? "image/jpeg";

                var putContent = new ByteArrayContent(imgBytes);
                putContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(ct);
                var putResp = await client.PutAsync(uploadUrl, putContent);
                var putBody = await putResp.Content.ReadAsStringAsync();
                if (!putResp.IsSuccessStatusCode)
                {
                    return new PublishResult { Ok = false, Error = putBody, StatusCode = (int)putResp.StatusCode };
                }

                var imagePayload = new
                {
                    author = authorUrn,
                    lifecycleState = "PUBLISHED",
                    specificContent = new Dictionary<string, object>
                    {
                        ["com.linkedin.ugc.ShareContent"] = new Dictionary<string, object>
                        {
                            ["shareCommentary"] = new Dictionary<string, object> { ["text"] = text ?? string.Empty },
                            ["shareMediaCategory"] = "IMAGE",
                            ["media"] = new object[]
                            {
                                new Dictionary<string, object>
                                {
                                    ["status"] = "READY",
                                    ["description"] = new Dictionary<string, object> { ["text"] = text ?? string.Empty },
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
                resultBody = await postResp.Content.ReadAsStringAsync();
                resultStatus = (int)postResp.StatusCode;
                if (!postResp.IsSuccessStatusCode)
                {
                    return new PublishResult { Ok = false, Error = resultBody, StatusCode = resultStatus };
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
                            ["shareCommentary"] = new Dictionary<string, object> { ["text"] = text ?? string.Empty },
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
                resultBody = await resp.Content.ReadAsStringAsync();
                resultStatus = (int)resp.StatusCode;
                if (!resp.IsSuccessStatusCode)
                {
                    return new PublishResult { Ok = false, Error = resultBody, StatusCode = resultStatus };
                }
            }

            return new PublishResult { Ok = true, StatusCode = resultStatus, Body = resultBody };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Publish failed for schedule {ScheduleId}", schedule.Id);
            return new PublishResult { Ok = false, Error = ex.Message };
        }
    }
}

public interface IPublisherService
{
    Task<PublishResult> PublishScheduleAsync(Schedule schedule);
}

public class PublishResult
{
    public bool Ok { get; set; }
    public string? Error { get; set; }
    public int StatusCode { get; set; }
    public string? Body { get; set; }
}
