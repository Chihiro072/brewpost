using BrewPost.Core.Entities;
using BrewPost.Infrastructure.Data;
using BrewPost.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace BrewPost.API.Controllers;

[ApiController]
[Route("api/scheduler")]
public class SchedulerController : ControllerBase
{
    private readonly BrewPostDbContext _context;
    private readonly IPublisherService _publisherService;
    private readonly ILogger<SchedulerController> _logger;

    public SchedulerController(BrewPostDbContext context, IPublisherService publisherService, ILogger<SchedulerController> logger)
    {
        _context = context;
        _publisherService = publisherService;
        _logger = logger;
    }

    [HttpPost("run-pending")]
    public async Task<IActionResult> RunPendingPosts()
    {
        // System token validation
        var systemToken = Request.Headers["x-system-token"].FirstOrDefault();
        var envToken = Environment.GetEnvironmentVariable("SCHEDULER_SECRET");
        if (systemToken != envToken) return Unauthorized(new { error = "Invalid system token" });

        var now = DateTime.UtcNow;
        var pendingSchedules = await _context.Schedules
            .Include(s => s.Post)
            .Where(s => s.Status == "pending" && s.ScheduledTime <= now)
            .ToListAsync();

        foreach (var schedule in pendingSchedules)
        {
            try
            {
                // Call your existing post-linkedin endpoint for each schedule
                using var client = new HttpClient();
                var requestBody = new
                {
                    text = schedule.Post.Caption,
                    imageUrl = schedule.Post.GeneratedImages.FirstOrDefault()?.ImageUrl
                };
                var content = new StringContent(
                    JsonSerializer.Serialize(requestBody),
                    System.Text.Encoding.UTF8,
                    "application/json"
                );

                var apiBase = Environment.GetEnvironmentVariable("API_BASE_URL");
                var response = await client.PostAsync($"{apiBase}/api/post-linkedin", content);

                if (response.IsSuccessStatusCode)
                {
                    schedule.Status = "completed";
                    schedule.Post.Status = "published";
                    schedule.LastAttemptAt = now;
                    schedule.AttemptCount++;
                }
                else
                {
                    schedule.AttemptCount++;
                    schedule.LastAttemptAt = now;
                    schedule.Status = schedule.AttemptCount >= 3 ? "failed" : "pending";
                }
            }
            catch
            {
                schedule.AttemptCount++;
                schedule.LastAttemptAt = now;
                schedule.Status = schedule.AttemptCount >= 3 ? "failed" : "pending";
            }
        }

        await _context.SaveChangesAsync();
        return Ok(new { ok = true, processed = pendingSchedules.Count });
    }

    [HttpPost("run-now")]
    [Authorize]
    public async Task<IActionResult> RunSchedulerNow()
    {
        var userId = User.FindFirst("user_id")?.Value;
        if (string.IsNullOrEmpty(userId)) return Unauthorized(new { error = "Invalid token" });

        var now = DateTime.UtcNow;
        _logger.LogInformation("Manual scheduler run triggered by user {UserId} at {Time}", userId, now);

        // Find all due schedules (not just user's, but we'll filter for audit if needed)
        var dueSchedules = await _context.Schedules
            .Include(s => s.Post)
            .ThenInclude(p => p.GeneratedImages)
            .Where(s => s.ScheduledTime <= now && (s.Status == "pending" || s.Status == "scheduled"))
            .OrderBy(s => s.ScheduledTime)
            .ToListAsync();

        if (!dueSchedules.Any())
        {
            return Ok(new { ok = true, processed = 0, message = "No due schedules found" });
        }

        var results = new List<object>();

        foreach (var schedule in dueSchedules)
        {
            try
            {
                // Mark as processing
                schedule.Status = "processing";
                schedule.LastAttemptAt = now;
                await _context.SaveChangesAsync();

                // Publish using the service
                var result = await _publisherService.PublishScheduleAsync(schedule);

                schedule.AttemptCount += 1;
                schedule.LastAttemptAt = now;

                if (result.Ok)
                {
                    schedule.Status = "completed";
                    var post = schedule.Post;
                    if (post != null)
                    {
                        post.Status = "published";
                        post.PublishedAt = now;
                    }

                    results.Add(new
                    {
                        scheduleId = schedule.Id,
                        postId = schedule.PostId,
                        platform = schedule.Platform,
                        status = "success",
                        message = "Published successfully"
                    });

                    _logger.LogInformation("Manual run: Schedule {ScheduleId} published successfully", schedule.Id);
                }
                else
                {
                    schedule.Status = schedule.AttemptCount >= 3 ? "failed" : "pending";
                    schedule.ErrorMessage = result.Error;

                    results.Add(new
                    {
                        scheduleId = schedule.Id,
                        postId = schedule.PostId,
                        platform = schedule.Platform,
                        status = "failed",
                        error = result.Error,
                        statusCode = result.StatusCode,
                        bodyLength = (result.Body ?? string.Empty).Length
                    });

                    _logger.LogWarning("Manual run: Schedule {ScheduleId} publish failed: {Error} (statusCode={StatusCode})", schedule.Id, result.Error, result.StatusCode);
                }

                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                schedule.Status = schedule.AttemptCount >= 3 ? "failed" : "pending";
                schedule.ErrorMessage = ex.Message;
                schedule.LastAttemptAt = now;
                schedule.AttemptCount += 1;
                await _context.SaveChangesAsync();

                results.Add(new
                {
                    scheduleId = schedule.Id,
                    postId = schedule.PostId,
                    platform = schedule.Platform,
                    status = "error",
                    error = ex.Message
                });

                _logger.LogError(ex, "Manual run: Exception processing schedule {ScheduleId}", schedule.Id);
            }
        }

        return Ok(new
        {
            ok = true,
            processed = results.Count,
            timestamp = now,
            results
        });
    }
}
