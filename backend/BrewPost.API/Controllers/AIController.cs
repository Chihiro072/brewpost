using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BrewPost.Core.Interfaces;
using BrewPost.API.DTOs;
using System.Text.Json;

namespace BrewPost.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AIController : ControllerBase
{
    private readonly IBedrockService _bedrockService;
    private readonly ILogger<AIController> _logger;

    public AIController(IBedrockService bedrockService, ILogger<AIController> logger)
    {
        _bedrockService = bedrockService;
        _logger = logger;
    }

    [HttpPost("generate-components")]
    [AllowAnonymous]
    public async Task<IActionResult> GenerateComponents([FromBody] GenerateComponentsRequest request)
    {
        try
        {
            if (request?.Node == null)
            {
                return BadRequest(new { ok = false, message = "Node is required" });
            }

            _logger.LogInformation("Generating components for node: {NodeId}", request.Node.Id);

            // Generate mock components based on the node content
            var components = GenerateMockComponents(request.Node);

            return Ok(new { ok = true, components });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating components");
            return StatusCode(500, new { ok = false, message = "Internal server error", detail = ex.Message });
        }
    }

    private List<GeneratedComponentDto> GenerateMockComponents(ContentNodeDto node)
    {
        var components = new List<GeneratedComponentDto>();

        // Generate campaign type components
        components.AddRange(new[]
        {
            new GeneratedComponentDto
            {
                Id = Guid.NewGuid().ToString(),
                Type = "campaign_type",
                Title = "Brand Awareness",
                Name = "Brand Awareness Campaign",
                Description = "Focus on increasing brand visibility and recognition",
                Category = "Campaign Type",
                Keywords = new[] { "awareness", "brand", "visibility" },
                RelevanceScore = 0.85,
                Impact = "high",
                Color = "#3B82F6"
            },
            new GeneratedComponentDto
            {
                Id = Guid.NewGuid().ToString(),
                Type = "campaign_type",
                Title = "Engagement Drive",
                Name = "Engagement Campaign",
                Description = "Boost audience interaction and community building",
                Category = "Campaign Type",
                Keywords = new[] { "engagement", "interaction", "community" },
                RelevanceScore = 0.78,
                Impact = "medium",
                Color = "#10B981"
            }
        });

        // Generate promotion type components
        components.AddRange(new[]
        {
            new GeneratedComponentDto
            {
                Id = Guid.NewGuid().ToString(),
                Type = "promotion_type",
                Title = "Limited Time Offer",
                Name = "Flash Sale",
                Description = "Create urgency with time-sensitive promotions",
                Category = "Promotion Type",
                Keywords = new[] { "sale", "discount", "limited" },
                RelevanceScore = 0.72,
                Impact = "high",
                Color = "#F59E0B"
            },
            new GeneratedComponentDto
            {
                Id = Guid.NewGuid().ToString(),
                Type = "promotion_type",
                Title = "Bundle Deal",
                Name = "Product Bundle",
                Description = "Combine products for added value",
                Category = "Promotion Type",
                Keywords = new[] { "bundle", "value", "package" },
                RelevanceScore = 0.65,
                Impact = "medium",
                Color = "#EF4444"
            }
        });

        // Generate content style components
        components.AddRange(new[]
        {
            new GeneratedComponentDto
            {
                Id = Guid.NewGuid().ToString(),
                Type = "content_style",
                Title = "Educational",
                Name = "Educational Content",
                Description = "Informative posts that teach and add value",
                Category = "Content Style",
                Keywords = new[] { "education", "tips", "howto" },
                RelevanceScore = 0.88,
                Impact = "high",
                Color = "#8B5CF6"
            },
            new GeneratedComponentDto
            {
                Id = Guid.NewGuid().ToString(),
                Type = "content_style",
                Title = "Behind the Scenes",
                Name = "BTS Content",
                Description = "Show the process and human side of your brand",
                Category = "Content Style",
                Keywords = new[] { "bts", "process", "authentic" },
                RelevanceScore = 0.75,
                Impact = "medium",
                Color = "#06B6D4"
            }
        });

        return components;
    }
}