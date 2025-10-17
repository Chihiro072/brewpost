using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BrewPost.Core.Entities;
using BrewPost.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using BrewPost.API.DTOs;
using BrewPost.Core.Interfaces;

namespace BrewPost.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AssetsController : ControllerBase
{
    private readonly BrewPostDbContext _context;
    private readonly IS3Service _s3Service;
    private readonly ILogger<AssetsController> _logger;

    public AssetsController(
        BrewPostDbContext context, 
        IS3Service s3Service, 
        ILogger<AssetsController> logger)
    {
        _context = context;
        _s3Service = s3Service;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAssets([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? fileType = null)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var query = _context.Assets
                .Where(a => a.UserId == userId)
                .AsQueryable();

            if (!string.IsNullOrEmpty(fileType))
            {
                query = query.Where(a => a.FileType.StartsWith(fileType));
            }

            query = query.OrderByDescending(a => a.CreatedAt);

            var totalCount = await query.CountAsync();
            var assets = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new AssetDto
                {
                    Id = a.Id,
                    Filename = a.Filename,
                    FileUrl = a.FileUrl,
                    FileType = a.FileType,
                    FileSize = a.FileSize,
                    CreatedAt = a.CreatedAt
                })
                .ToListAsync();

            return Ok(new
            {
                assets,
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting assets");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetAsset(Guid id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var asset = await _context.Assets
                .Include(a => a.PostAssets)
                .ThenInclude(pa => pa.Post)
                .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId);

            if (asset == null)
            {
                return NotFound(new { message = "Asset not found" });
            }

            return Ok(new AssetDetailDto
            {
                Id = asset.Id,
                Filename = asset.Filename,
                FileUrl = asset.FileUrl,
                FileType = asset.FileType,
                FileSize = asset.FileSize,
                CreatedAt = asset.CreatedAt,
                UsedInPosts = asset.PostAssets.Select(pa => new PostUsageDto
                {
                    PostId = pa.PostId,
                    PostTitle = pa.Post.Title,
                    UsageType = pa.UsageType
                }).ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting asset");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("upload")]
    public async Task<IActionResult> UploadAsset([FromForm] UploadAssetRequest request)
    {
        try
        {
            if (request?.File == null || request.File.Length == 0)
            {
                return BadRequest(new { message = "File is required" });
            }

            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            // Validate file size and type using S3Service
            if (!_s3Service.IsValidFileSize(request.File.Length, 10 * 1024 * 1024)) // 10MB
            {
                return BadRequest(new { message = "File size exceeds 10MB limit" });
            }

            if (!_s3Service.IsValidFileType(request.File.FileName, new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" }))
            {
                return BadRequest(new { message = "Invalid file type. Only images are allowed." });
            }

            try
            {
                // Upload to S3 using S3Service
                using var stream = request.File.OpenReadStream();
                var s3Key = await _s3Service.UploadFileAsync(stream, request.File.FileName, request.File.ContentType);
                var fileUrl = _s3Service.GetFileUrl(s3Key);

                // Save asset record to database
                var asset = new Asset
                {
                    UserId = userId.Value,
                    Filename = request.File.FileName,
                    FileUrl = fileUrl,
                    FileType = request.File.ContentType,
                    FileSize = (int)request.File.Length,
                    S3Key = s3Key,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Assets.Add(asset);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetAsset), new { id = asset.Id }, new AssetDto
                {
                    Id = asset.Id,
                    Filename = asset.Filename,
                    FileUrl = asset.FileUrl,
                    FileType = asset.FileType,
                    FileSize = asset.FileSize,
                    CreatedAt = asset.CreatedAt
                });
            }
            catch (InvalidOperationException s3Ex)
            {
                _logger.LogError(s3Ex, "Error uploading file to S3");
                return StatusCode(500, new { message = "Error uploading file to storage" });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading asset");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("upload-multiple")]
    public async Task<IActionResult> UploadMultipleAssets([FromForm] UploadMultipleAssetsRequest request)
    {
        try
        {
            if (request?.Files == null || !request.Files.Any())
            {
                return BadRequest(new { message = "At least one file is required" });
            }

            if (request.Files.Count() > 10)
            {
                return BadRequest(new { message = "Maximum 10 files allowed per upload" });
            }

            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var uploadedAssets = new List<AssetDto>();
            var errors = new List<string>();

            // Validate each file
            foreach (var file in request.Files)
            {
                if (!_s3Service.IsValidFileSize(file.Length, 10 * 1024 * 1024)) // 10MB
                {
                    return BadRequest(new { message = $"File {file.FileName} exceeds 10MB limit" });
                }

                if (!_s3Service.IsValidFileType(file.FileName, new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" }))
                {
                    return BadRequest(new { message = $"File {file.FileName} has invalid type. Only images are allowed." });
                }
            }

            // Prepare files for upload
             var filesList = request.Files.ToList();
             var fileStreams = filesList.Select(f => (f.OpenReadStream(), f.FileName, f.ContentType)).ToList();
            
            try
            {
                // Upload files to S3
                var s3Keys = await _s3Service.UploadMultipleFilesAsync(fileStreams);
                
                // Save asset metadata to database
                 for (int i = 0; i < filesList.Count && i < s3Keys.Count; i++)
                 {
                     var file = filesList[i];
                     var s3Key = s3Keys[i];
                    var fileUrl = _s3Service.GetFileUrl(s3Key);

                    var asset = new Asset
                    {
                        UserId = userId.Value,
                        Filename = file.FileName,
                        FileUrl = fileUrl,
                        FileType = file.ContentType,
                        FileSize = (int)file.Length,
                        S3Key = s3Key,
                        CreatedAt = DateTime.UtcNow
                    };

                    _context.Assets.Add(asset);
                    await _context.SaveChangesAsync();

                    uploadedAssets.Add(new AssetDto
                    {
                        Id = asset.Id,
                        Filename = asset.Filename,
                        FileUrl = asset.FileUrl,
                        FileType = asset.FileType,
                        FileSize = asset.FileSize,
                        CreatedAt = asset.CreatedAt
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading files");
                return StatusCode(500, new { message = "Error uploading files", error = ex.Message });
            }
            finally
            {
                // Dispose streams
                foreach (var (stream, _, _) in fileStreams)
                {
                    stream.Dispose();
                }
            }

            return Ok(new
            {
                uploadedAssets,
                uploadedCount = uploadedAssets.Count,
                errors,
                errorCount = errors.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading multiple assets");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteAsset(Guid id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            var asset = await _context.Assets
                .Include(a => a.PostAssets)
                .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId);

            if (asset == null)
            {
                return NotFound(new { message = "Asset not found" });
            }

            // Check if asset is being used in any posts
            if (asset.PostAssets.Any())
            {
                return BadRequest(new { message = "Cannot delete asset that is being used in posts" });
            }

            try
            {
                // Delete from S3
                bool s3DeleteSuccess = true;
                if (!string.IsNullOrEmpty(asset.S3Key))
                {
                    s3DeleteSuccess = await _s3Service.DeleteFileAsync(asset.S3Key);
                }

                // Delete from database
                _context.Assets.Remove(asset);
                await _context.SaveChangesAsync();

                if (s3DeleteSuccess)
                {
                    return Ok(new { message = "Asset deleted successfully" });
                }
                else
                {
                    return Ok(new { message = "Asset deleted from database, but file may still exist in storage" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting asset");
                // Still delete from database even if S3 deletion fails
                _context.Assets.Remove(asset);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Asset deleted from database, but file may still exist in storage" });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting asset");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("{id}/attach-to-post")]
    public async Task<IActionResult> AttachAssetToPost(Guid id, [FromBody] AttachAssetRequest request)
    {
        try
        {
            if (request == null || string.IsNullOrEmpty(request.UsageType))
            {
                return BadRequest(new { message = "Usage type is required" });
            }

            var userId = GetCurrentUserId();
            if (userId == null)
            {
                return Unauthorized(new { message = "Invalid token" });
            }

            // Validate asset exists and belongs to user
            var asset = await _context.Assets.FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId);
            if (asset == null)
            {
                return NotFound(new { message = "Asset not found" });
            }

            // Validate post exists and belongs to user
            var post = await _context.Posts.FirstOrDefaultAsync(p => p.Id == request.PostId && p.UserId == userId);
            if (post == null)
            {
                return BadRequest(new { message = "Post not found" });
            }

            // Check if asset is already attached to this post
            var existingAttachment = await _context.PostAssets
                .FirstOrDefaultAsync(pa => pa.PostId == request.PostId && pa.AssetId == id);

            if (existingAttachment != null)
            {
                // Update usage type if different
                if (existingAttachment.UsageType != request.UsageType)
                {
                    existingAttachment.UsageType = request.UsageType;
                    await _context.SaveChangesAsync();
                }
                return Ok(new { message = "Asset attachment updated" });
            }

            // Create new attachment
            var postAsset = new PostAsset
            {
                PostId = request.PostId,
                AssetId = id,
                UsageType = request.UsageType
            };

            _context.PostAssets.Add(postAsset);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Asset attached to post successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error attaching asset to post");
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