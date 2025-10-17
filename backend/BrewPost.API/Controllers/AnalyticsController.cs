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
public class AnalyticsController : ControllerBase
{
    private readonly BrewPostDbContext _context;
    private readonly ILogger<AnalyticsController> _logger;

    public AnalyticsController(BrewPostDbContext context, ILogger<AnalyticsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAnalytics([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] Guid? postId = null)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var query = _context.Analytics
                .Include(a => a.Post)
                .Where(a => a.Post.UserId == userId)
                .AsQueryable();

            if (postId.HasValue)
            {
                query = query.Where(a => a.PostId == postId);
            }

            query = query.OrderByDescending(a => a.CreatedAt);

            var totalCount = await query.CountAsync();
            var analytics = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new AnalyticsDto
                {
                    Id = a.Id,
                    PostId = a.PostId,
                    PostTitle = a.Post.Title,
                    PredictedViews = a.PredictedViews,
                    PredictedLikes = a.PredictedLikes,
                    PredictedComments = a.PredictedComments,
                    SentimentScore = a.SentimentScore,
                    DetailedMetrics = a.DetailedMetrics,
                    CreatedAt = a.CreatedAt
                })
                .ToListAsync();

            return Ok(new
            {
                analytics,
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting analytics");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetAnalytic(Guid id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var analytic = await _context.Analytics
                .Include(a => a.Post)
                .FirstOrDefaultAsync(a => a.Id == id && a.Post.UserId == userId);

            if (analytic == null)
            {
                return NotFound(new { message = "Analytics not found" });
            }

            return Ok(new AnalyticsDetailDto
            {
                Id = analytic.Id,
                PostId = analytic.PostId,
                PostTitle = analytic.Post.Title,
                PostCaption = analytic.Post.Caption,
                PredictedViews = analytic.PredictedViews,
                PredictedLikes = analytic.PredictedLikes,
                PredictedComments = analytic.PredictedComments,
                SentimentScore = analytic.SentimentScore,
                DetailedMetrics = analytic.DetailedMetrics,
                CreatedAt = analytic.CreatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting analytic");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("predict")]
    public async Task<IActionResult> PredictAnalytics([FromBody] PredictAnalyticsRequest request)
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

            // Validate post exists and belongs to user
            var post = await _context.Posts.FirstOrDefaultAsync(p => p.Id == request.PostId && p.UserId == userId);
            if (post == null)
            {
                return BadRequest(new { message = "Post not found" });
            }

            // TODO: Integrate with actual ML/AI analytics prediction service
            // For now, we'll generate mock predictions based on content analysis
            var predictions = GenerateMockPredictions(post.Caption, post.Title);

            // Check if analytics already exist for this post
            var existingAnalytics = await _context.Analytics.FirstOrDefaultAsync(a => a.PostId == request.PostId);
            
            if (existingAnalytics != null)
            {
                // Update existing analytics
                existingAnalytics.PredictedViews = predictions.PredictedViews;
                existingAnalytics.PredictedLikes = predictions.PredictedLikes;
                existingAnalytics.PredictedComments = predictions.PredictedComments;
                existingAnalytics.SentimentScore = predictions.SentimentScore;
                existingAnalytics.DetailedMetrics = predictions.DetailedMetrics;
                existingAnalytics.CreatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return Ok(new AnalyticsDto
                {
                    Id = existingAnalytics.Id,
                    PostId = existingAnalytics.PostId,
                    PostTitle = post.Title,
                    PredictedViews = existingAnalytics.PredictedViews,
                    PredictedLikes = existingAnalytics.PredictedLikes,
                    PredictedComments = existingAnalytics.PredictedComments,
                    SentimentScore = existingAnalytics.SentimentScore,
                    DetailedMetrics = existingAnalytics.DetailedMetrics,
                    CreatedAt = existingAnalytics.CreatedAt
                });
            }
            else
            {
                // Create new analytics
                var analytics = new Analytics
                {
                    PostId = request.PostId,
                    PredictedViews = predictions.PredictedViews,
                    PredictedLikes = predictions.PredictedLikes,
                    PredictedComments = predictions.PredictedComments,
                    SentimentScore = predictions.SentimentScore,
                    DetailedMetrics = predictions.DetailedMetrics,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Analytics.Add(analytics);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetAnalytic), new { id = analytics.Id }, new AnalyticsDto
                {
                    Id = analytics.Id,
                    PostId = analytics.PostId,
                    PostTitle = post.Title,
                    PredictedViews = analytics.PredictedViews,
                    PredictedLikes = analytics.PredictedLikes,
                    PredictedComments = analytics.PredictedComments,
                    SentimentScore = analytics.SentimentScore,
                    DetailedMetrics = analytics.DetailedMetrics,
                    CreatedAt = analytics.CreatedAt
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error predicting analytics");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard([FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            // Default to last 30 days if no date range provided
            startDate ??= DateTime.UtcNow.AddDays(-30);
            endDate ??= DateTime.UtcNow;

            var posts = await _context.Posts
                .Include(p => p.Analytics)
                .Where(p => p.UserId == userId && p.CreatedAt >= startDate && p.CreatedAt <= endDate)
                .ToListAsync();

            var totalPosts = posts.Count;
            var publishedPosts = posts.Count(p => p.Status == "published");
            var scheduledPosts = posts.Count(p => p.Status == "scheduled");
            var draftPosts = posts.Count(p => p.Status == "draft");

            var analyticsData = posts
                .Where(p => p.Analytics.Any())
                .SelectMany(p => p.Analytics)
                .ToList();

            var totalPredictedViews = analyticsData.Sum(a => a.PredictedViews);
            var totalPredictedLikes = analyticsData.Sum(a => a.PredictedLikes);
            var totalPredictedComments = analyticsData.Sum(a => a.PredictedComments);
            var averageSentiment = analyticsData.Any() ? analyticsData.Average(a => (double)a.SentimentScore) : 0;

            // Performance trends (group by day)
            var performanceTrends = posts
                .Where(p => p.Analytics.Any())
                .GroupBy(p => p.CreatedAt.Date)
                .Select(g => new PerformanceTrendDto
                {
                    Date = g.Key,
                    PostCount = g.Count(),
                    TotalViews = g.SelectMany(p => p.Analytics).Sum(a => a.PredictedViews),
                    TotalLikes = g.SelectMany(p => p.Analytics).Sum(a => a.PredictedLikes),
                    TotalComments = g.SelectMany(p => p.Analytics).Sum(a => a.PredictedComments),
                    AverageSentiment = g.SelectMany(p => p.Analytics).Average(a => (double)a.SentimentScore)
                })
                .OrderBy(t => t.Date)
                .ToList();

            // Top performing posts
            var topPosts = posts
                .Where(p => p.Analytics.Any())
                .Select(p => new TopPostDto
                {
                    Id = p.Id,
                    Title = p.Title,
                    Status = p.Status,
                    CreatedAt = p.CreatedAt,
                    PredictedViews = p.Analytics.FirstOrDefault()?.PredictedViews ?? 0,
                    PredictedLikes = p.Analytics.FirstOrDefault()?.PredictedLikes ?? 0,
                    SentimentScore = p.Analytics.FirstOrDefault()?.SentimentScore ?? 0
                })
                .OrderByDescending(p => p.PredictedViews)
                .Take(5)
                .ToList();

            return Ok(new DashboardDto
            {
                Summary = new DashboardSummaryDto
                {
                    TotalPosts = totalPosts,
                    PublishedPosts = publishedPosts,
                    ScheduledPosts = scheduledPosts,
                    DraftPosts = draftPosts,
                    TotalPredictedViews = totalPredictedViews,
                    TotalPredictedLikes = totalPredictedLikes,
                    TotalPredictedComments = totalPredictedComments,
                    AverageSentiment = (decimal)averageSentiment
                },
                PerformanceTrends = performanceTrends,
                TopPosts = topPosts,
                DateRange = new DateRangeDto
                {
                    StartDate = startDate.Value,
                    EndDate = endDate.Value
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting dashboard");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteAnalytics(Guid id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var analytics = await _context.Analytics
                .Include(a => a.Post)
                .FirstOrDefaultAsync(a => a.Id == id && a.Post.UserId == userId);

            if (analytics == null)
            {
                return NotFound(new { message = "Analytics not found" });
            }

            _context.Analytics.Remove(analytics);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Analytics deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting analytics");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    private AnalyticsPrediction GenerateMockPredictions(string caption, string title)
    {
        // Simple mock prediction logic based on content analysis
        var random = new Random();
        var contentLength = caption.Length + title.Length;
        var wordCount = caption.Split(' ').Length + title.Split(' ').Length;
        
        // Base predictions on content characteristics
        var baseViews = Math.Max(100, contentLength * 2 + random.Next(50, 200));
        var baseLikes = Math.Max(10, baseViews / 10 + random.Next(5, 25));
        var baseComments = Math.Max(1, baseLikes / 5 + random.Next(1, 10));
        
        // Simple sentiment analysis (mock)
        var positiveWords = new[] { "great", "awesome", "amazing", "love", "best", "perfect", "excellent", "wonderful" };
        var negativeWords = new[] { "bad", "terrible", "awful", "hate", "worst", "horrible", "disappointing" };
        
        var positiveCount = positiveWords.Count(word => caption.ToLower().Contains(word) || title.ToLower().Contains(word));
        var negativeCount = negativeWords.Count(word => caption.ToLower().Contains(word) || title.ToLower().Contains(word));
        
        var sentimentScore = 0.5m + (positiveCount - negativeCount) * 0.1m;
        sentimentScore = Math.Max(0, Math.Min(1, sentimentScore)); // Clamp between 0 and 1
        
        // Detailed metrics
        var detailedMetrics = JsonDocument.Parse($@"{{
            ""engagement_rate"": {(decimal)baseLikes / baseViews:F4},
            ""comment_rate"": {(decimal)baseComments / baseViews:F4},
            ""word_count"": {wordCount},
            ""character_count"": {contentLength},
            ""hashtag_count"": {caption.Count(c => c == '#')},
            ""mention_count"": {caption.Count(c => c == '@')},
            ""positive_words"": {positiveCount},
            ""negative_words"": {negativeCount},
            ""readability_score"": {random.NextDouble() * 100:F2},
            ""optimal_posting_time"": ""{DateTime.UtcNow.AddHours(random.Next(1, 24)):HH:mm}"",
            ""platform_recommendations"": [
                {{
                    ""platform"": ""instagram"",
                    ""score"": {random.NextDouble() * 100:F2},
                    ""reason"": ""High visual content engagement""
                }},
                {{
                    ""platform"": ""facebook"",
                    ""score"": {random.NextDouble() * 100:F2},
                    ""reason"": ""Good for longer captions""
                }}
            ]
        }}");
        
        return new AnalyticsPrediction
        {
            PredictedViews = baseViews,
            PredictedLikes = baseLikes,
            PredictedComments = baseComments,
            SentimentScore = sentimentScore,
            DetailedMetrics = detailedMetrics
        };
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