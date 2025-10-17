using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BrewPost.Core.Entities;
using BrewPost.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Text.Json;
using BrewPost.API.DTOs;

namespace BrewPost.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PostsController : ControllerBase
{
    private readonly BrewPostDbContext _context;
    private readonly ILogger<PostsController> _logger;

    public PostsController(BrewPostDbContext context, ILogger<PostsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetPosts([FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? status = null)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var query = _context.Posts
                .Where(p => p.UserId == userId)
                .Include(p => p.ContentPlan)
                .Include(p => p.GeneratedImages)
                .Include(p => p.Analytics)
                .Include(p => p.Schedules)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(p => p.Status == status);
            }

            query = query.OrderByDescending(p => p.CreatedAt);

            var totalCount = await query.CountAsync();
            var posts = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new PostDto
                {
                    Id = p.Id,
                    PlanId = p.PlanId,
                    PlanTitle = p.ContentPlan != null ? p.ContentPlan.Title : null,
                    Title = p.Title,
                    Caption = p.Caption,
                    ImagePrompt = p.ImagePrompt,
                    Platforms = p.Platforms,
                    Status = p.Status,
                    ScheduledAt = p.ScheduledAt,
                    PublishedAt = p.PublishedAt,
                    CreatedAt = p.CreatedAt,
                    ImageCount = p.GeneratedImages.Count,
                    HasAnalytics = p.Analytics.Any(),
                    ScheduleCount = p.Schedules.Count
                })
                .ToListAsync();

            return Ok(new
            {
                posts,
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting posts");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetPost(Guid id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var post = await _context.Posts
                .Include(p => p.ContentPlan)
                .Include(p => p.GeneratedImages)
                .Include(p => p.Analytics)
                .Include(p => p.Schedules)
                .Include(p => p.PostAssets)
                .ThenInclude(pa => pa.Asset)
                .FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);

            if (post == null)
            {
                return NotFound(new { message = "Post not found" });
            }

            return Ok(new PostDetailDto
            {
                Id = post.Id,
                PlanId = post.PlanId,
                PlanTitle = post.ContentPlan?.Title,
                Title = post.Title,
                Caption = post.Caption,
                ImagePrompt = post.ImagePrompt,
                Platforms = post.Platforms,
                Status = post.Status,
                ScheduledAt = post.ScheduledAt,
                PublishedAt = post.PublishedAt,
                CreatedAt = post.CreatedAt,
                GeneratedImages = post.GeneratedImages.Select(gi => new GeneratedImageDto
                {
                    Id = gi.Id,
                    ImageUrl = gi.ImageUrl,
                    GenerationPrompt = gi.GenerationPrompt,
                    GenerationParams = gi.GenerationParams,
                    CreatedAt = gi.CreatedAt
                }).ToList(),
                Analytics = post.Analytics.Select(a => new AnalyticsDto
                {
                    Id = a.Id,
                    PredictedViews = a.PredictedViews,
                    PredictedLikes = a.PredictedLikes,
                    PredictedComments = a.PredictedComments,
                    SentimentScore = a.SentimentScore,
                    DetailedMetrics = a.DetailedMetrics,
                    CreatedAt = a.CreatedAt
                }).FirstOrDefault(),
                Schedules = post.Schedules.Select(s => new ScheduleDto
                {
                    Id = s.Id,
                    Platform = s.Platform,
                    ScheduledTime = s.ScheduledTime,
                    Status = s.Status,
                    AttemptCount = s.AttemptCount,
                    LastAttemptAt = s.LastAttemptAt,
                    ErrorMessage = s.ErrorMessage,
                    CreatedAt = s.CreatedAt
                }).ToList(),
                Assets = post.PostAssets.Select(pa => new AssetDto
                {
                    Id = pa.Asset.Id,
                    Filename = pa.Asset.Filename,
                    FileUrl = pa.Asset.FileUrl,
                    FileType = pa.Asset.FileType,
                    FileSize = pa.Asset.FileSize,
                    UsageType = pa.UsageType
                }).ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting post");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreatePost([FromBody] CreatePostRequest request)
    {
        try
        {
            if (request == null || string.IsNullOrEmpty(request.Title) || string.IsNullOrEmpty(request.Caption))
            {
                return BadRequest(new { message = "Title and caption are required" });
            }

            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            // Validate content plan if provided
            if (request.PlanId.HasValue)
            {
                var planExists = await _context.ContentPlans
                    .AnyAsync(cp => cp.Id == request.PlanId && cp.UserId == userId);
                
                if (!planExists)
                {
                    return BadRequest(new { message = "Content plan not found" });
                }
            }

            var post = new Post
            {
                UserId = userId.Value,
                PlanId = request.PlanId,
                Title = request.Title,
                Caption = request.Caption,
                ImagePrompt = request.ImagePrompt ?? string.Empty,
                Platforms = request.Platforms ?? JsonDocument.Parse("[]"),
                Status = "draft",
                CreatedAt = DateTime.UtcNow
            };

            _context.Posts.Add(post);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetPost), new { id = post.Id }, new PostDto
            {
                Id = post.Id,
                PlanId = post.PlanId,
                Title = post.Title,
                Caption = post.Caption,
                ImagePrompt = post.ImagePrompt,
                Platforms = post.Platforms,
                Status = post.Status,
                CreatedAt = post.CreatedAt,
                ImageCount = 0,
                HasAnalytics = false,
                ScheduleCount = 0
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating post");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdatePost(Guid id, [FromBody] UpdatePostRequest request)
    {
        try
        {
            if (request == null)
            {
                return BadRequest(new { message = "Request body is required" });
            }

            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var post = await _context.Posts.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
            if (post == null)
            {
                return NotFound(new { message = "Post not found" });
            }

            // Update properties
            if (!string.IsNullOrEmpty(request.Title))
                post.Title = request.Title;
            
            if (!string.IsNullOrEmpty(request.Caption))
                post.Caption = request.Caption;
            
            if (!string.IsNullOrEmpty(request.ImagePrompt))
                post.ImagePrompt = request.ImagePrompt;
            
            if (request.Platforms != null)
                post.Platforms = request.Platforms;
            
            if (!string.IsNullOrEmpty(request.Status))
                post.Status = request.Status;
            
            if (request.ScheduledAt.HasValue)
                post.ScheduledAt = request.ScheduledAt;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Post updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating post");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeletePost(Guid id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var post = await _context.Posts.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
            if (post == null)
            {
                return NotFound(new { message = "Post not found" });
            }

            // Check if post is published
            if (post.Status == "published")
            {
                return BadRequest(new { message = "Cannot delete published post" });
            }

            _context.Posts.Remove(post);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Post deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting post");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("{id}/schedule")]
    public async Task<IActionResult> SchedulePost(Guid id, [FromBody] SchedulePostRequest request)
    {
        try
        {
            if (request == null || string.IsNullOrEmpty(request.Platform) || !request.ScheduledAt.HasValue)
            {
                return BadRequest(new { message = "Platform and scheduled time are required" });
            }

            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var post = await _context.Posts.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
            if (post == null)
            {
                return NotFound(new { message = "Post not found" });
            }

            // Create schedule entry
            var schedule = new Schedule
            {
                PostId = post.Id,
                Platform = request.Platform,
                ScheduledTime = request.ScheduledAt.Value,
                Status = "pending",
                CreatedAt = DateTime.UtcNow
            };

            _context.Schedules.Add(schedule);
            
            // Update post status if not already scheduled
            if (post.Status == "draft")
            {
                post.Status = "scheduled";
                post.ScheduledAt = request.ScheduledAt;
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Post scheduled successfully", scheduleId = schedule.Id });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error scheduling post");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    private Guid? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst("user_id")?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return null;
        }
        return userId;
    }
}