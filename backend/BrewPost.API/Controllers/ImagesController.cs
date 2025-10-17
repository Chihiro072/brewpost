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
public class ImagesController : ControllerBase
{
    private readonly BrewPostDbContext _context;
    private readonly ILogger<ImagesController> _logger;

    public ImagesController(BrewPostDbContext context, ILogger<ImagesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetImages([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] Guid? postId = null)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var query = _context.GeneratedImages
                .Include(gi => gi.Post)
                .Where(gi => gi.Post.UserId == userId)
                .AsQueryable();

            if (postId.HasValue)
            {
                query = query.Where(gi => gi.PostId == postId.Value);
            }

            query = query.OrderByDescending(gi => gi.CreatedAt);

            var totalCount = await query.CountAsync();
            var images = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(gi => new GeneratedImageDto
                {
                    Id = gi.Id,
                    PostId = gi.PostId,
                    PostTitle = gi.Post.Title,
                    ImageUrl = gi.ImageUrl,
                    GenerationPrompt = gi.GenerationPrompt,
                    GenerationParams = gi.GenerationParams,
                    CreatedAt = gi.CreatedAt
                })
                .ToListAsync();

            return Ok(new
            {
                images,
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting images");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetImage(Guid id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var image = await _context.GeneratedImages
                .Include(gi => gi.Post)
                .FirstOrDefaultAsync(gi => gi.Id == id && gi.Post.UserId == userId);

            if (image == null)
            {
                return NotFound(new { message = "Image not found" });
            }

            return Ok(new GeneratedImageDetailDto
            {
                Id = image.Id,
                PostId = image.PostId,
                PostTitle = image.Post.Title,
                ImageUrl = image.ImageUrl,
                GenerationPrompt = image.GenerationPrompt,
                GenerationParams = image.GenerationParams,
                CreatedAt = image.CreatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting image");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("generate")]
    public async Task<IActionResult> GenerateImage([FromBody] GenerateImageRequest request)
    {
        try
        {
            if (request == null || string.IsNullOrEmpty(request.Prompt) || !request.PostId.HasValue)
            {
                return BadRequest(new { message = "Prompt and PostId are required" });
            }

            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            // Validate post exists and belongs to user
            var post = await _context.Posts.FirstOrDefaultAsync(p => p.Id == request.PostId.Value && p.UserId == userId);
            if (post == null)
            {
                return BadRequest(new { message = "Post not found" });
            }

            // TODO: Integrate with actual AI image generation service (DALL-E, Midjourney, etc.)
            // For now, we'll create a placeholder entry
            var generatedImage = new GeneratedImage
            {
                PostId = request.PostId.Value,
                ImageUrl = $"https://placeholder-image-service.com/generated/{Guid.NewGuid()}.jpg", // Placeholder URL
                GenerationPrompt = request.Prompt,
                GenerationParams = request.Parameters ?? JsonDocument.Parse("{}"),
                CreatedAt = DateTime.UtcNow
            };

            _context.GeneratedImages.Add(generatedImage);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetImage), new { id = generatedImage.Id }, new GeneratedImageDto
            {
                Id = generatedImage.Id,
                PostId = generatedImage.PostId,
                PostTitle = post.Title,
                ImageUrl = generatedImage.ImageUrl,
                GenerationPrompt = generatedImage.GenerationPrompt,
                GenerationParams = generatedImage.GenerationParams,
                CreatedAt = generatedImage.CreatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating image");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("{id}/regenerate")]
    public async Task<IActionResult> RegenerateImage(Guid id, [FromBody] RegenerateImageRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var existingImage = await _context.GeneratedImages
                .Include(gi => gi.Post)
                .FirstOrDefaultAsync(gi => gi.Id == id && gi.Post.UserId == userId);

            if (existingImage == null)
            {
                return NotFound(new { message = "Image not found" });
            }

            var prompt = !string.IsNullOrEmpty(request?.Prompt) ? request.Prompt : existingImage.GenerationPrompt;
            var parameters = request?.Parameters ?? existingImage.GenerationParams;

            // TODO: Integrate with actual AI image generation service
            // For now, we'll create a new placeholder entry
            var newImage = new GeneratedImage
            {
                PostId = existingImage.PostId,
                ImageUrl = $"https://placeholder-image-service.com/generated/{Guid.NewGuid()}.jpg", // Placeholder URL
                GenerationPrompt = prompt,
                GenerationParams = parameters ?? JsonDocument.Parse("{}"),
                CreatedAt = DateTime.UtcNow
            };

            _context.GeneratedImages.Add(newImage);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetImage), new { id = newImage.Id }, new GeneratedImageDto
            {
                Id = newImage.Id,
                PostId = newImage.PostId,
                PostTitle = existingImage.Post.Title,
                ImageUrl = newImage.ImageUrl,
                GenerationPrompt = newImage.GenerationPrompt,
                GenerationParams = newImage.GenerationParams,
                CreatedAt = newImage.CreatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error regenerating image");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteImage(Guid id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var image = await _context.GeneratedImages
                .Include(gi => gi.Post)
                .FirstOrDefaultAsync(gi => gi.Id == id && gi.Post.UserId == userId);

            if (image == null)
            {
                return NotFound(new { message = "Image not found" });
            }

            _context.GeneratedImages.Remove(image);
            await _context.SaveChangesAsync();

            // TODO: Also delete the actual image file from storage service

            return Ok(new { message = "Image deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting image");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("batch-generate")]
    public async Task<IActionResult> BatchGenerateImages([FromBody] BatchGenerateImagesRequest request)
    {
        try
        {
            if (request == null || string.IsNullOrEmpty(request.Prompt) || request.Count <= 0 || request.Count > 10)
            {
                return BadRequest(new { message = "Valid prompt and count (1-10) are required" });
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

            var generatedImages = new List<GeneratedImage>();

            // Generate multiple images
            for (int i = 0; i < request.Count; i++)
            {
                // TODO: Integrate with actual AI image generation service
                var generatedImage = new GeneratedImage
                {
                    PostId = request.PostId,
                    ImageUrl = $"https://placeholder-image-service.com/generated/{Guid.NewGuid()}.jpg", // Placeholder URL
                    GenerationPrompt = request.Prompt,
                    GenerationParams = request.Parameters ?? JsonDocument.Parse("{}"),
                    CreatedAt = DateTime.UtcNow
                };

                generatedImages.Add(generatedImage);
            }

            _context.GeneratedImages.AddRange(generatedImages);
            await _context.SaveChangesAsync();

            var result = generatedImages.Select(gi => new GeneratedImageDto
            {
                Id = gi.Id,
                PostId = gi.PostId,
                PostTitle = post.Title,
                ImageUrl = gi.ImageUrl,
                GenerationPrompt = gi.GenerationPrompt,
                GenerationParams = gi.GenerationParams,
                CreatedAt = gi.CreatedAt
            }).ToList();

            return Ok(new { images = result, count = result.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error batch generating images");
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