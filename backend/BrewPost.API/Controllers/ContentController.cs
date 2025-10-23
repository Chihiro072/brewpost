using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BrewPost.Core.Entities;
using BrewPost.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Text.Json;
using BrewPost.API.DTOs;
using BrewPost.Core.Interfaces;

namespace BrewPost.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ContentController : ControllerBase
{
    private readonly BrewPostDbContext _context;
    private readonly ILogger<ContentController> _logger;
    private readonly IBedrockService _bedrockService;

    public ContentController(BrewPostDbContext context, ILogger<ContentController> logger, IBedrockService bedrockService)
    {
        _context = context;
        _logger = logger;
        _bedrockService = bedrockService;
    }

    [HttpGet("plans")]
    public async Task<IActionResult> GetContentPlans([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var query = _context.ContentPlans
                .Where(cp => cp.UserId == userId)
                .Include(cp => cp.Posts)
                .OrderByDescending(cp => cp.CreatedAt);

            var totalCount = await query.CountAsync();
            var plans = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(cp => new ContentPlanDto
                {
                    Id = cp.Id,
                    Title = cp.Title,
                    Prompt = cp.Prompt,
                    BrandInfo = cp.BrandInfo,
                    Status = cp.Status,
                    CreatedAt = cp.CreatedAt,
                    PostCount = cp.Posts.Count
                })
                .ToListAsync();

            return Ok(new
            {
                plans,
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting content plans");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpGet("plans/{id}")]
    public async Task<IActionResult> GetContentPlan(Guid id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var plan = await _context.ContentPlans
                .Include(cp => cp.Posts)
                .ThenInclude(p => p.GeneratedImages)
                .Include(cp => cp.Posts)
                .ThenInclude(p => p.Analytics)
                .FirstOrDefaultAsync(cp => cp.Id == id && cp.UserId == userId);

            if (plan == null)
            {
                return NotFound(new { message = "Content plan not found" });
            }

            return Ok(new ContentPlanDetailDto
            {
                Id = plan.Id,
                Title = plan.Title,
                Prompt = plan.Prompt,
                BrandInfo = plan.BrandInfo,
                Status = plan.Status,
                CreatedAt = plan.CreatedAt,
                Posts = plan.Posts.Select(p => new PostSummaryDto
                {
                    Id = p.Id,
                    Title = p.Title,
                    Caption = p.Caption,
                    Status = p.Status,
                    ScheduledAt = p.ScheduledAt,
                    PublishedAt = p.PublishedAt,
                    CreatedAt = p.CreatedAt,
                    ImageCount = p.GeneratedImages.Count,
                    HasAnalytics = p.Analytics.Any()
                }).ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting content plan");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("plans")]
    public async Task<IActionResult> CreateContentPlan([FromBody] CreateContentPlanRequest request)
    {
        try
        {
            if (request == null || string.IsNullOrEmpty(request.Title) || string.IsNullOrEmpty(request.Prompt))
            {
                return BadRequest(new { message = "Title and prompt are required" });
            }

            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var plan = new ContentPlan
            {
                UserId = userId.Value,
                Title = request.Title,
                Prompt = request.Prompt,
                BrandInfo = request.BrandInfo ?? JsonDocument.Parse("{}"),
                Status = "draft",
                CreatedAt = DateTime.UtcNow
            };

            _context.ContentPlans.Add(plan);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetContentPlan), new { id = plan.Id }, new ContentPlanDto
            {
                Id = plan.Id,
                Title = plan.Title,
                Prompt = plan.Prompt,
                BrandInfo = plan.BrandInfo,
                Status = plan.Status,
                CreatedAt = plan.CreatedAt,
                PostCount = 0
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating content plan");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPut("plans/{id}")]
    public async Task<IActionResult> UpdateContentPlan(Guid id, [FromBody] UpdateContentPlanRequest request)
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

            var plan = await _context.ContentPlans.FirstOrDefaultAsync(cp => cp.Id == id && cp.UserId == userId);
            if (plan == null)
            {
                return NotFound(new { message = "Content plan not found" });
            }

            // Update properties
            if (!string.IsNullOrEmpty(request.Title))
                plan.Title = request.Title;
            
            if (!string.IsNullOrEmpty(request.Prompt))
                plan.Prompt = request.Prompt;
            
            if (request.BrandInfo != null)
                plan.BrandInfo = request.BrandInfo;
            
            if (!string.IsNullOrEmpty(request.Status))
                plan.Status = request.Status;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Content plan updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating content plan");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("generate")]
    [AllowAnonymous]
    public async Task<IActionResult> GenerateContent([FromBody] GenerateContentRequest request)
    {
        try
        {
            if (request == null || string.IsNullOrEmpty(request.Prompt))
            {
                return BadRequest(new { message = "Prompt is required" });
            }

            _logger.LogInformation("Generating content with prompt: {Prompt}", request.Prompt);

            // Generate content using Bedrock
            var generatedContent = await _bedrockService.GenerateContentAsync(request.Prompt);

            if (string.IsNullOrEmpty(generatedContent))
            {
                return StatusCode(500, new { message = "Failed to generate content" });
            }

            return Ok(new { content = generatedContent });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating content");
            return StatusCode(500, new { message = "Internal server error", detail = ex.Message });
        }
    }

    [HttpDelete("plans/{id}")]
    public async Task<IActionResult> DeleteContentPlan(Guid id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var plan = await _context.ContentPlans
                .Include(cp => cp.Posts)
                .FirstOrDefaultAsync(cp => cp.Id == id && cp.UserId == userId);
            
            if (plan == null)
            {
                return NotFound(new { message = "Content plan not found" });
            }

            // Check if plan has published posts
            if (plan.Posts.Any(p => p.Status == "published"))
            {
                return BadRequest(new { message = "Cannot delete content plan with published posts" });
            }

            _context.ContentPlans.Remove(plan);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Content plan deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting content plan");
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