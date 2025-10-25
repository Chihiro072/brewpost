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
public class NodesController : ControllerBase
{
    private readonly BrewPostDbContext _context;
    private readonly ILogger<NodesController> _logger;

    public NodesController(BrewPostDbContext context, ILogger<NodesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private Guid? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (Guid.TryParse(userIdClaim, out var userId))
        {
            return userId;
        }
        return null;
    }

    [HttpGet]
    public async Task<IActionResult> GetNodes([FromQuery] string? projectId = null)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { error = "User not authenticated" });
            }

            var query = _context.Nodes.Where(n => n.UserId == userId);
            
            // If projectId is provided, filter by it (for compatibility with frontend)
            // For now, we'll treat projectId as a filter but store all nodes under the user
            
            var nodes = await query.OrderBy(n => n.CreatedAt).ToListAsync();
            
            var nodeList = nodes.Select(n => new
            {
                id = n.Id.ToString(),
                projectId = projectId ?? "default", // Return the requested projectId or default
                nodeId = n.Id.ToString(), // Use the same ID for nodeId for compatibility
                title = n.Title,
                description = n.Content,
                x = n.X,
                y = n.Y,
                status = n.Status,
                contentId = n.Id.ToString(),
                type = n.Type,
                day = n.Day,
                imageUrl = n.ImageUrl,
                imageUrls = n.ImageUrls != null ? JsonSerializer.Deserialize<string[]>(n.ImageUrls) : null,
                imagePrompt = n.ImagePrompt,
                scheduledDate = n.ScheduledDate?.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                createdAt = n.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                updatedAt = n.UpdatedAt.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                connections = n.Connections != null ? JsonSerializer.Deserialize<string[]>(n.Connections) : new string[0],
                position = new { x = n.X, y = n.Y },
                postType = n.PostType,
                focus = n.Focus,
                postedAt = n.PostedAt,
                postedTo = n.PostedTo != null ? JsonSerializer.Deserialize<string[]>(n.PostedTo) : null,
                tweetId = n.TweetId,
                selectedImageUrl = n.SelectedImageUrl
            }).ToList();

            return Ok(nodeList);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving nodes");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreateNode([FromBody] CreateNodeRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { error = "User not authenticated" });
            }

            var node = new Node
            {
                UserId = userId.Value,
                Title = request.Title ?? "Untitled Node",
                Type = request.Type ?? "post",
                Status = request.Status ?? "draft",
                Content = request.Description ?? request.Content ?? "",
                X = request.X ?? 0,
                Y = request.Y ?? 0,
                ImageUrl = request.ImageUrl,
                ImageUrls = request.ImageUrls != null ? JsonDocument.Parse(JsonSerializer.Serialize(request.ImageUrls)) : null,
                ImagePrompt = request.ImagePrompt,
                Day = request.Day,
                PostType = request.PostType,
                Focus = request.Focus,
                ScheduledDate = request.ScheduledDate,
                Connections = JsonDocument.Parse("[]"),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Nodes.Add(node);
            await _context.SaveChangesAsync();

            var response = new
            {
                id = node.Id.ToString(),
                projectId = request.ProjectId ?? "default",
                nodeId = node.Id.ToString(),
                title = node.Title,
                description = node.Content,
                x = node.X,
                y = node.Y,
                status = node.Status,
                contentId = node.Id.ToString(),
                type = node.Type,
                day = node.Day,
                imageUrl = node.ImageUrl,
                imageUrls = node.ImageUrls != null ? JsonSerializer.Deserialize<string[]>(node.ImageUrls) : null,
                imagePrompt = node.ImagePrompt,
                scheduledDate = node.ScheduledDate?.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                createdAt = node.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                updatedAt = node.UpdatedAt.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            };

            return CreatedAtAction(nameof(GetNode), new { id = node.Id }, response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating node");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetNode(Guid id)
    {
        try
        {
            _logger.LogInformation("GetNode called with ID: {Id}", id);
            
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { error = "User not authenticated" });
            }

            var node = await _context.Nodes
                .Where(n => n.Id == id && n.UserId == userId)
                .FirstOrDefaultAsync();

            if (node == null)
            {
                return NotFound(new { error = "Node not found" });
            }

            var response = new
            {
                id = node.Id.ToString(),
                projectId = "default",
                nodeId = node.Id.ToString(),
                title = node.Title,
                description = node.Content,
                x = node.X,
                y = node.Y,
                status = node.Status,
                contentId = node.Id.ToString(),
                type = node.Type,
                day = node.Day,
                imageUrl = node.ImageUrl,
                imageUrls = node.ImageUrls != null ? JsonSerializer.Deserialize<string[]>(node.ImageUrls) : null,
                imagePrompt = node.ImagePrompt,
                scheduledDate = node.ScheduledDate?.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                createdAt = node.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                updatedAt = node.UpdatedAt.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                connections = node.Connections != null ? JsonSerializer.Deserialize<string[]>(node.Connections) : new string[0],
                position = new { x = node.X, y = node.Y },
                postType = node.PostType,
                focus = node.Focus,
                postedAt = node.PostedAt,
                postedTo = node.PostedTo != null ? JsonSerializer.Deserialize<string[]>(node.PostedTo) : null,
                tweetId = node.TweetId,
                selectedImageUrl = node.SelectedImageUrl
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving node");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateNode(string id, [FromBody] UpdateNodeRequest request)
    {
        try
        {
            _logger.LogInformation("UpdateNode called with ID: {Id}, Request: {@Request}", id, request);
            
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { error = "User not authenticated" });
            }

            // Try to parse the ID as Guid
            if (!Guid.TryParse(id, out Guid nodeId))
            {
                _logger.LogWarning("Invalid node ID format: {Id}", id);
                return BadRequest(new { error = "Invalid node ID format" });
            }

            var node = await _context.Nodes
                .Where(n => n.Id == nodeId && n.UserId == userId)
                .FirstOrDefaultAsync();

            if (node == null)
            {
                return NotFound(new { error = "Node not found" });
            }

            // Update fields if provided
            if (request.Title != null) node.Title = request.Title;
            if (request.Description != null) node.Content = request.Description;
            if (request.Content != null) node.Content = request.Content;
            if (request.Type != null) node.Type = request.Type;
            if (request.Status != null) node.Status = request.Status;
            if (request.X.HasValue) node.X = request.X.Value;
            if (request.Y.HasValue) node.Y = request.Y.Value;
            if (request.ImageUrl != null) node.ImageUrl = request.ImageUrl;
            if (request.ImageUrls != null) 
                node.ImageUrls = JsonDocument.Parse(JsonSerializer.Serialize(request.ImageUrls));
            if (request.ImagePrompt != null) node.ImagePrompt = request.ImagePrompt;
            if (request.Day != null) node.Day = request.Day;
            if (request.PostType != null) node.PostType = request.PostType;
            if (request.Focus != null) node.Focus = request.Focus;
            if (request.ScheduledDate.HasValue) node.ScheduledDate = request.ScheduledDate;
            if (request.SelectedImageUrl != null) node.SelectedImageUrl = request.SelectedImageUrl;
            
            node.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            var response = new
            {
                id = node.Id.ToString(),
                projectId = request.ProjectId ?? "default",
                nodeId = node.Id.ToString(),
                title = node.Title,
                description = node.Content,
                x = node.X,
                y = node.Y,
                status = node.Status,
                contentId = node.Id.ToString(),
                type = node.Type,
                day = node.Day,
                imageUrl = node.ImageUrl,
                imageUrls = node.ImageUrls != null ? JsonSerializer.Deserialize<string[]>(node.ImageUrls) : null,
                imagePrompt = node.ImagePrompt,
                scheduledDate = node.ScheduledDate?.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                createdAt = node.CreatedAt.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                updatedAt = node.UpdatedAt.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                connections = node.Connections != null ? JsonSerializer.Deserialize<string[]>(node.Connections) : new string[0],
                position = new { x = node.X, y = node.Y },
                postType = node.PostType,
                focus = node.Focus,
                postedAt = node.PostedAt,
                postedTo = node.PostedTo != null ? JsonSerializer.Deserialize<string[]>(node.PostedTo) : null,
                tweetId = node.TweetId,
                selectedImageUrl = node.SelectedImageUrl
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating node");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteNode(Guid id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { error = "User not authenticated" });
            }

            var node = await _context.Nodes
                .Where(n => n.Id == id && n.UserId == userId)
                .FirstOrDefaultAsync();

            if (node == null)
            {
                return NotFound(new { error = "Node not found" });
            }

            _context.Nodes.Remove(node);
            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting node");
            return StatusCode(500, new { error = "Internal server error" });
        }
    }
}

public class CreateNodeRequest
{
    public string? ProjectId { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? Content { get; set; }
    public string? Type { get; set; }
    public string? Status { get; set; }
    public double? X { get; set; }
    public double? Y { get; set; }
    public string? ImageUrl { get; set; }
    public string[]? ImageUrls { get; set; }
    public string? ImagePrompt { get; set; }
    public string? Day { get; set; }
    public string? PostType { get; set; }
    public string? Focus { get; set; }
    public DateTime? ScheduledDate { get; set; }
}

public class UpdateNodeRequest
{
    public string? ProjectId { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? Content { get; set; }
    public string? Type { get; set; }
    public string? Status { get; set; }
    public double? X { get; set; }
    public double? Y { get; set; }
    public string? ImageUrl { get; set; }
    public string[]? ImageUrls { get; set; }
    public string? ImagePrompt { get; set; }
    public string? Day { get; set; }
    public string? PostType { get; set; }
    public string? Focus { get; set; }
    public DateTime? ScheduledDate { get; set; }
    public string? SelectedImageUrl { get; set; }
}