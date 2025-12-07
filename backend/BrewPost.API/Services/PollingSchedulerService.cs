using BrewPost.Core.Entities;
using BrewPost.Core.Interfaces;
using BrewPost.Infrastructure.Data;
using BrewPost.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace BrewPost.API.Services;

public class PollingSchedulerService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PollingSchedulerService> _logger;
    private readonly TimeSpan _pollInterval;

    public PollingSchedulerService(IServiceScopeFactory scopeFactory, ILogger<PollingSchedulerService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _pollInterval = TimeSpan.FromMinutes(5);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("PollingSchedulerService started, interval: {Interval}", _pollInterval);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessDueSchedules(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during polling run");
            }

            await Task.Delay(_pollInterval, stoppingToken);
        }
    }

    private async Task ProcessDueSchedules(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BrewPostDbContext>();
        var publisher = scope.ServiceProvider.GetRequiredService<IPublisherService>();

        var now = DateTime.UtcNow;

        // Find nodes that are due and still scheduled (not posted)
        var dueNodes = await db.Nodes
            .Where(n => n.ScheduledDate <= now && n.Status == "scheduled")
            .OrderBy(n => n.ScheduledDate)
            .ToListAsync(cancellationToken);

        if (!dueNodes.Any())
        {
            _logger.LogDebug("No due nodes found at {Time}", now);
            return;
        }

        _logger.LogInformation("Found {Count} due nodes to process", dueNodes.Count);

        // Diagnostic: log node times/kinds to help detect timezone or kind issues
        foreach (var node in dueNodes)
        {
            if (node.ScheduledDate.HasValue)
            {
                var kind = node.ScheduledDate.Value.Kind;
                _logger.LogDebug("Node {Id} scheduledDate={ScheduledDate:o} (Kind={Kind}) Status={Status}", node.Id, node.ScheduledDate, kind, node.Status);
            }
        }

        foreach (var node in dueNodes)
        {
            if (cancellationToken.IsCancellationRequested) break;

            try
            {
                // Attempt to mark node as processing to avoid duplicate runs
                var reloaded = await db.Nodes.FirstOrDefaultAsync(n => n.Id == node.Id, cancellationToken);
                if (reloaded == null) continue;
                if (reloaded.Status == "published") continue;

                reloaded.Status = "published";
                reloaded.PostedAt = now;
                await db.SaveChangesAsync(cancellationToken);

                // Publish to LinkedIn (or other platforms)
                var result = await PublishNodeAsync(reloaded, db, cancellationToken);

                if (result.Ok)
                {
                    _logger.LogInformation("Node {NodeId} published successfully to LinkedIn", reloaded.Id);
                }
                else
                {
                    // Revert status on failure
                    reloaded.Status = "scheduled";
                    reloaded.PostedAt = null;
                    await db.SaveChangesAsync(cancellationToken);

                    _logger.LogWarning("Node {NodeId} publish failed: {Error}. StatusCode={StatusCode}", reloaded.Id, result.Error, result.StatusCode);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process node {NodeId}", node.Id);
            }
        }
    }

    private async Task<(bool Ok, string? Error, int StatusCode)> PublishNodeAsync(Node node, BrewPostDbContext db, CancellationToken cancellationToken)
    {
        // Get user's LinkedIn account
        var account = await db.SocialAccounts
            .FirstOrDefaultAsync(sa => sa.UserId == node.UserId && sa.Provider.ToLower() == "linkedin", cancellationToken);

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
                    return (false, "LinkedIn not linked and no env token configured", 0);
                }

                using var idClient = new HttpClient();
                var idReq = new HttpRequestMessage(HttpMethod.Get, "https://api.linkedin.com/v2/me");
                idReq.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", envToken);
                idReq.Headers.TryAddWithoutValidation("X-Restli-Protocol-Version", "2.0.0");
                var idResp = await idClient.SendAsync(idReq, cancellationToken);
                if (!idResp.IsSuccessStatusCode)
                {
                    return (false, "Failed to validate env token", (int)idResp.StatusCode);
                }

                var idBody = await idResp.Content.ReadAsStringAsync(cancellationToken);
                var idDoc = JsonDocument.Parse(idBody);
                var pid = idDoc.RootElement.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;
                if (string.IsNullOrWhiteSpace(pid))
                {
                    return (false, "Could not resolve LinkedIn user id from env token", 0);
                }

                authorUrn = $"urn:li:person:{pid}";
                accessToken = envToken!;
            }

            using var client = new HttpClient();
            client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            client.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");

            string text = node.Content ?? string.Empty;
            string? imageUrl = node.SelectedImageUrl ?? node.ImageUrl;

            // POST to LinkedIn
            if (!string.IsNullOrWhiteSpace(imageUrl))
            {
                // With image
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
                var regResp = await client.PostAsync("https://api.linkedin.com/v2/assets?action=registerUpload", regContent, cancellationToken);
                if (!regResp.IsSuccessStatusCode)
                {
                    var regBody = await regResp.Content.ReadAsStringAsync(cancellationToken);
                    return (false, regBody, (int)regResp.StatusCode);
                }

                var regBody2 = await regResp.Content.ReadAsStringAsync(cancellationToken);
                var regDoc = JsonDocument.Parse(regBody2);
                var valueElem = regDoc.RootElement.GetProperty("value");
                string uploadUrl = valueElem.GetProperty("uploadMechanism").GetProperty("com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest").GetProperty("uploadUrl").GetString() ?? string.Empty;
                string assetUrn = valueElem.GetProperty("asset").GetString() ?? string.Empty;

                if (string.IsNullOrEmpty(uploadUrl) || string.IsNullOrEmpty(assetUrn))
                {
                    return (false, "Invalid upload registration response", 0);
                }

                using var downClient = new HttpClient();
                var imgResp = await downClient.GetAsync(imageUrl, cancellationToken);
                if (!imgResp.IsSuccessStatusCode)
                {
                    return (false, "Failed to download image", (int)imgResp.StatusCode);
                }

                var imgBytes = await imgResp.Content.ReadAsByteArrayAsync(cancellationToken);
                var ct = imgResp.Content.Headers.ContentType?.ToString() ?? "image/jpeg";

                var putContent = new ByteArrayContent(imgBytes);
                putContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(ct);
                var putResp = await client.PutAsync(uploadUrl, putContent, cancellationToken);
                if (!putResp.IsSuccessStatusCode)
                {
                    var putBody = await putResp.Content.ReadAsStringAsync(cancellationToken);
                    return (false, putBody, (int)putResp.StatusCode);
                }

                var imagePayload = new
                {
                    author = authorUrn,
                    lifecycleState = "PUBLISHED",
                    specificContent = new Dictionary<string, object>
                    {
                        ["com.linkedin.ugc.ShareContent"] = new Dictionary<string, object>
                        {
                            ["shareCommentary"] = new Dictionary<string, object> { ["text"] = text },
                            ["shareMediaCategory"] = "IMAGE",
                            ["media"] = new object[]
                            {
                                new Dictionary<string, object>
                                {
                                    ["status"] = "READY",
                                    ["description"] = new Dictionary<string, object> { ["text"] = text },
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
                var postResp = await client.PostAsync("https://api.linkedin.com/v2/ugcPosts", postContent, cancellationToken);
                var postBody = await postResp.Content.ReadAsStringAsync(cancellationToken);
                if (!postResp.IsSuccessStatusCode)
                {
                    return (false, postBody, (int)postResp.StatusCode);
                }

                return (true, null, 200);
            }
            else
            {
                // Text only
                var payload = new
                {
                    author = authorUrn,
                    lifecycleState = "PUBLISHED",
                    specificContent = new Dictionary<string, object>
                    {
                        ["com.linkedin.ugc.ShareContent"] = new Dictionary<string, object>
                        {
                            ["shareCommentary"] = new Dictionary<string, object> { ["text"] = text },
                            ["shareMediaCategory"] = "NONE"
                        }
                    },
                    visibility = new Dictionary<string, object>
                    {
                        ["com.linkedin.ugc.MemberNetworkVisibility"] = "PUBLIC"
                    }
                };

                var content = new StringContent(JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");
                var resp = await client.PostAsync("https://api.linkedin.com/v2/ugcPosts", content, cancellationToken);
                var body = await resp.Content.ReadAsStringAsync(cancellationToken);
                if (!resp.IsSuccessStatusCode)
                {
                    return (false, body, (int)resp.StatusCode);
                }

                return (true, null, 200);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception publishing node to LinkedIn");
            return (false, ex.Message, 0);
        }
    }
}
