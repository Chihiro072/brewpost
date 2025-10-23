using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BrewPost.Core.Interfaces;
using BrewPost.API.DTOs;

namespace BrewPost.API.Controllers;

[ApiController]
[Route("api")]
public class CanvasController : ControllerBase
{
    private readonly IBedrockService _bedrockService;
    private readonly ILogger<CanvasController> _logger;

    public CanvasController(IBedrockService bedrockService, ILogger<CanvasController> logger)
    {
        _bedrockService = bedrockService;
        _logger = logger;
    }

    [HttpPost("canvas-generate-from-node")]
    [AllowAnonymous] // Allow anonymous for development, add authorization as needed
    public async Task<IActionResult> CanvasGenerateFromNode([FromBody] CanvasGenerateRequest request)
    {
        try
        {
            _logger.LogInformation("Canvas generate from node request received for nodeId: {NodeId}", request.NodeId);

            // Build final prompt from node data
            string finalPrompt = request.ImagePrompt ?? "";
            
            if (string.IsNullOrEmpty(finalPrompt) && !string.IsNullOrEmpty(request.Title))
            {
                finalPrompt = $"Create a professional social media image for: {request.Title}";
                if (!string.IsNullOrEmpty(request.Content))
                {
                    finalPrompt += $". Content context: {request.Content.Substring(0, Math.Min(200, request.Content.Length))}";
                }
            }

            // Only add basic enhancement if no detailed prompt exists
            if (string.IsNullOrEmpty(request.ImagePrompt) && finalPrompt.Length < 100)
            {
                finalPrompt += ". Professional, high-quality, social media ready, modern design, vibrant colors";
            }

            // Get components from either field (selectedComponents or components)
            var components = request.SelectedComponents ?? request.Components ?? new List<ComponentDto>();

            // Add component-based enhancements
            if (components.Any())
            {
                var promotions = components.Where(c => 
                    (c.Category?.ToLower().Contains("promotion") ?? false) || 
                    (c.Name != null && System.Text.RegularExpressions.Regex.IsMatch(c.Name, @"%|off|discount", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                ).ToList();

                if (promotions.Any())
                {
                    var p = promotions.First();
                    finalPrompt += $" Add a circular promotional badge that shows: \"{p.Name ?? p.Id ?? "Offer"}\". Render the badge with a high-contrast ring and place it top-right.";
                }

                var trends = components.Where(c => c.Category?.ToLower().Contains("trend") ?? false).ToList();
                if (trends.Any())
                {
                    finalPrompt += " Add visual-only trend cues (sparklines, subtle data waveforms, small chart motifs, or glows) to convey trending performance — do NOT include textual labels for trend names.";
                }

                var campaigns = components.Where(c => c.Category?.ToLower().Contains("campaign") ?? false).ToList();
                if (campaigns.Any())
                {
                    finalPrompt += " Infuse campaign-specific visual styling (color accents, background motifs, badges, iconography, or composition changes) that reflect the campaign theme — DO NOT render the campaign name as visible text.";
                }
            }

            // Add template-based styling
            if (request.Template != null)
            {
                if (!string.IsNullOrEmpty(request.Template.CompanyName))
                {
                    finalPrompt += " Apply brand-consistent styling informed by the company (do NOT render the company name as text); prefer logo, color palette, and brand motifs.";
                }
                if (!string.IsNullOrEmpty(request.Template.ColorPalette))
                {
                    finalPrompt += " Use the brand color palette for accents and composition (use colors, gradients, and accents — no textual color labels).";
                }
                if (!string.IsNullOrEmpty(request.Template.LogoUrl))
                {
                    finalPrompt += " Reserve space for the logo (bottom-left corner preferred) and incorporate it visually; do not generate the logo as plain text.";
                }
            }

            _logger.LogInformation("Final prompt: {Prompt}", finalPrompt);

            // Generate image using Bedrock
            var imageUrl = await _bedrockService.GenerateImageAsync(finalPrompt, request.NodeId);

            _logger.LogInformation("Image generated successfully: {Url}", imageUrl);

            return Ok(new 
            { 
                ok = true, 
                imageUrl, 
                nodeId = request.NodeId, 
                prompt = finalPrompt 
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating image from node");
            return StatusCode(500, new 
            { 
                error = "node_image_generate_failed",
                detail = ex.Message,
                fullError = new 
                {
                    message = ex.Message,
                    name = ex.GetType().Name
                }
            });
        }
    }
}
