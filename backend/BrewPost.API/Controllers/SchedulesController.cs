using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BrewPost.Core.Entities;
using BrewPost.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using BrewPost.API.DTOs;

namespace BrewPost.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SchedulesController : ControllerBase
{
    private readonly BrewPostDbContext _context;
    private readonly ILogger<SchedulesController> _logger;

    public SchedulesController(BrewPostDbContext context, ILogger<SchedulesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetSchedules([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? status = null, [FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var query = _context.Schedules
                .Include(s => s.Post)
                .Where(s => s.Post.UserId == userId)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(s => s.Status == status);
            }

            if (startDate.HasValue)
            {
                query = query.Where(s => s.ScheduledTime >= startDate);
            }

            if (endDate.HasValue)
            {
                query = query.Where(s => s.ScheduledTime <= endDate);
            }

            query = query.OrderBy(s => s.ScheduledTime);

            var totalCount = await query.CountAsync();
            var schedules = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(s => new ScheduleDto
                {
                    Id = s.Id,
                    PostId = s.PostId,
                    PostTitle = s.Post.Title,
                    PostCaption = s.Post.Caption,
                    Platform = s.Platform,
                    ScheduledTime = s.ScheduledTime,
                    Status = s.Status,
                    AttemptCount = s.AttemptCount,
                    LastAttemptAt = s.LastAttemptAt,
                    ErrorMessage = s.ErrorMessage,
                    CreatedAt = s.CreatedAt
                })
                .ToListAsync();

            return Ok(new
            {
                schedules,
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting schedules");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetSchedule(Guid id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var schedule = await _context.Schedules
                .Include(s => s.Post)
                .ThenInclude(p => p.GeneratedImages)
                .FirstOrDefaultAsync(s => s.Id == id && s.Post.UserId == userId);

            if (schedule == null)
            {
                return NotFound(new { message = "Schedule not found" });
            }

            return Ok(new ScheduleDetailDto
            {
                Id = schedule.Id,
                PostId = schedule.PostId,
                PostTitle = schedule.Post.Title,
                PostCaption = schedule.Post.Caption,
                PostImages = schedule.Post.GeneratedImages.Select(img => new ImageDto
                {
                    Id = img.Id,
                    ImageUrl = img.ImageUrl,
                    Prompt = img.GenerationPrompt,
                    CreatedAt = img.CreatedAt
                }).ToList(),
                Platform = schedule.Platform,
                ScheduledTime = schedule.ScheduledTime,
                Status = schedule.Status,
                AttemptCount = schedule.AttemptCount,
                LastAttemptAt = schedule.LastAttemptAt,
                ErrorMessage = schedule.ErrorMessage,
                CreatedAt = schedule.CreatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting schedule");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreateSchedule([FromBody] CreateScheduleRequest request)
    {
        try
        {
            if (request == null)
            {
                return BadRequest(new { message = "Request body is required" });
            }

            if (string.IsNullOrEmpty(request.Platform))
            {
                return BadRequest(new { message = "Platform is required" });
            }

            if (request.ScheduledTime <= DateTime.UtcNow)
            {
                return BadRequest(new { message = "Scheduled time must be in the future" });
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

            // Check if schedule already exists for this post and platform
            var existingSchedule = await _context.Schedules
                .FirstOrDefaultAsync(s => s.PostId == request.PostId && s.Platform == request.Platform && s.Status == "pending");

            if (existingSchedule != null)
            {
                return BadRequest(new { message = "Schedule already exists for this post and platform" });
            }

            var schedule = new Schedule
            {
                PostId = request.PostId,
                Platform = request.Platform,
                ScheduledTime = request.ScheduledTime,
                Status = "pending",
                AttemptCount = 0,
                CreatedAt = DateTime.UtcNow
            };

            _context.Schedules.Add(schedule);
            
            // Update post status to scheduled if it's currently draft
            if (post.Status == "draft")
            {
                post.Status = "scheduled";
            }
            
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetSchedule), new { id = schedule.Id }, new ScheduleDto
            {
                Id = schedule.Id,
                PostId = schedule.PostId,
                PostTitle = post.Title,
                PostCaption = post.Caption,
                Platform = schedule.Platform,
                ScheduledTime = schedule.ScheduledTime,
                Status = schedule.Status,
                AttemptCount = schedule.AttemptCount,
                LastAttemptAt = schedule.LastAttemptAt,
                ErrorMessage = schedule.ErrorMessage,
                CreatedAt = schedule.CreatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating schedule");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateSchedule(Guid id, [FromBody] UpdateScheduleRequest request)
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

            var schedule = await _context.Schedules
                .Include(s => s.Post)
                .FirstOrDefaultAsync(s => s.Id == id && s.Post.UserId == userId);

            if (schedule == null)
            {
                return NotFound(new { message = "Schedule not found" });
            }

            // Only allow updates to pending schedules
            if (schedule.Status != "pending")
            {
                return BadRequest(new { message = "Can only update pending schedules" });
            }

            if (request.ScheduledTime.HasValue)
            {
                if (request.ScheduledTime <= DateTime.UtcNow)
                {
                    return BadRequest(new { message = "Scheduled time must be in the future" });
                }
                schedule.ScheduledTime = request.ScheduledTime.Value;
            }

            if (!string.IsNullOrEmpty(request.Platform))
            {
                schedule.Platform = request.Platform;
            }

            await _context.SaveChangesAsync();

            return Ok(new ScheduleDto
            {
                Id = schedule.Id,
                PostId = schedule.PostId,
                PostTitle = schedule.Post.Title,
                PostCaption = schedule.Post.Caption,
                Platform = schedule.Platform,
                ScheduledTime = schedule.ScheduledTime,
                Status = schedule.Status,
                AttemptCount = schedule.AttemptCount,
                LastAttemptAt = schedule.LastAttemptAt,
                ErrorMessage = schedule.ErrorMessage,
                CreatedAt = schedule.CreatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating schedule");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("{id}/execute")]
    public async Task<IActionResult> ExecuteSchedule(Guid id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var schedule = await _context.Schedules
                .Include(s => s.Post)
                .ThenInclude(p => p.GeneratedImages)
                .FirstOrDefaultAsync(s => s.Id == id && s.Post.UserId == userId);

            if (schedule == null)
            {
                return NotFound(new { message = "Schedule not found" });
            }

            if (schedule.Status != "pending")
            {
                return BadRequest(new { message = "Schedule is not pending" });
            }

            // TODO: Integrate with actual social media APIs for posting
            // For now, we'll simulate the posting process
            var success = await SimulatePostExecution(schedule);

            schedule.AttemptCount++;
            schedule.LastAttemptAt = DateTime.UtcNow;

            if (success)
            {
                schedule.Status = "completed";
                schedule.Post.Status = "published";
                schedule.ErrorMessage = null;
            }
            else
            {
                schedule.Status = schedule.AttemptCount >= 3 ? "failed" : "pending";
                schedule.ErrorMessage = "Failed to post to social media platform";
            }

            await _context.SaveChangesAsync();

            return Ok(new ScheduleDto
            {
                Id = schedule.Id,
                PostId = schedule.PostId,
                PostTitle = schedule.Post.Title,
                PostCaption = schedule.Post.Caption,
                Platform = schedule.Platform,
                ScheduledTime = schedule.ScheduledTime,
                Status = schedule.Status,
                AttemptCount = schedule.AttemptCount,
                LastAttemptAt = schedule.LastAttemptAt,
                ErrorMessage = schedule.ErrorMessage,
                CreatedAt = schedule.CreatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing schedule");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteSchedule(Guid id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var schedule = await _context.Schedules
                .Include(s => s.Post)
                .FirstOrDefaultAsync(s => s.Id == id && s.Post.UserId == userId);

            if (schedule == null)
            {
                return NotFound(new { message = "Schedule not found" });
            }

            // Only allow deletion of pending or failed schedules
            if (schedule.Status == "completed")
            {
                return BadRequest(new { message = "Cannot delete completed schedules" });
            }

            _context.Schedules.Remove(schedule);
            
            // Check if this was the only schedule for the post
            var remainingSchedules = await _context.Schedules
                .CountAsync(s => s.PostId == schedule.PostId && s.Id != id);
            
            if (remainingSchedules == 0 && schedule.Post.Status == "scheduled")
            {
                schedule.Post.Status = "draft";
            }
            
            await _context.SaveChangesAsync();

            return Ok(new { message = "Schedule deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting schedule");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpGet("upcoming")]
    public async Task<IActionResult> GetUpcomingSchedules([FromQuery] int hours = 24)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var cutoffTime = DateTime.UtcNow.AddHours(hours);

            var upcomingSchedules = await _context.Schedules
                .Include(s => s.Post)
                .Where(s => s.Post.UserId == userId && 
                           s.Status == "pending" && 
                           s.ScheduledTime <= cutoffTime && 
                           s.ScheduledTime > DateTime.UtcNow)
                .OrderBy(s => s.ScheduledTime)
                .Select(s => new ScheduleDto
                {
                    Id = s.Id,
                    PostId = s.PostId,
                    PostTitle = s.Post.Title,
                    PostCaption = s.Post.Caption,
                    Platform = s.Platform,
                    ScheduledTime = s.ScheduledTime,
                    Status = s.Status,
                    AttemptCount = s.AttemptCount,
                    LastAttemptAt = s.LastAttemptAt,
                    ErrorMessage = s.ErrorMessage,
                    CreatedAt = s.CreatedAt
                })
                .ToListAsync();

            return Ok(upcomingSchedules);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting upcoming schedules");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    private async Task<bool> SimulatePostExecution(Schedule schedule)
    {
        // TODO: Replace with actual social media API integration
        // This is a mock implementation that simulates posting
        
        await Task.Delay(1000); // Simulate API call delay
        
        // Simulate 90% success rate
        var random = new Random();
        return random.NextDouble() > 0.1;
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