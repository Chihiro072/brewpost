using Microsoft.AspNetCore.Mvc;
using BrewPost.Core.Interfaces;
using BrewPost.Core.DTOs;
using Microsoft.AspNetCore.Authorization;

namespace BrewPost.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TrendingController : ControllerBase
    {
        private readonly ITrendingService _trendingService;
        private readonly ILogger<TrendingController> _logger;

        public TrendingController(ITrendingService trendingService, ILogger<TrendingController> logger)
        {
            _trendingService = trendingService;
            _logger = logger;
        }

        /// <summary>
        /// Get trending hashtags for a specific country or worldwide
        /// </summary>
        /// <param name="country">Country code (e.g., 'spain', 'usa') or leave empty for worldwide</param>
        /// <returns>List of trending hashtags with relevance scores</returns>
        [HttpGet("hashtags")]
        public async Task<ActionResult<List<TrendingHashtag>>> GetTrendingHashtags([FromQuery] string? country = null)
        {
            try
            {
                _logger.LogInformation("Getting trending hashtags for country: {Country}", country ?? "worldwide");
                
                var hashtags = await _trendingService.GetTrendingHashtagsAsync(country);
                
                _logger.LogInformation("Retrieved {Count} trending hashtags", hashtags.Count);
                
                return Ok(hashtags);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving trending hashtags for country: {Country}", country);
                return StatusCode(500, new { message = "Error retrieving trending hashtags", error = ex.Message });
            }
        }

        /// <summary>
        /// Get trending components for AI generation
        /// </summary>
        /// <param name="country">Country code (e.g., 'spain', 'usa') or leave empty for worldwide</param>
        /// <returns>List of trending components formatted for AI generation</returns>
        [HttpGet("components")]
        public async Task<ActionResult<List<BrewPost.Core.DTOs.GeneratedComponentDto>>> GetTrendingComponents([FromQuery] string? country = null)
        {
            try
            {
                _logger.LogInformation("Getting trending components for country: {Country}", country ?? "worldwide");
                
                var components = await _trendingService.GetTrendingComponentsAsync(country);
                
                _logger.LogInformation("Retrieved {Count} trending components", components.Count);
                
                return Ok(components);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving trending components for country: {Country}", country);
                return StatusCode(500, new { message = "Error retrieving trending components", error = ex.Message });
            }
        }

        /// <summary>
        /// Get trending hashtags for multiple countries
        /// </summary>
        /// <param name="countries">Comma-separated list of country codes</param>
        /// <returns>Dictionary of country to trending hashtags</returns>
        [HttpGet("hashtags/multi")]
        public async Task<ActionResult<Dictionary<string, List<TrendingHashtag>>>> GetMultiCountryHashtags([FromQuery] string countries)
        {
            try
            {
                if (string.IsNullOrEmpty(countries))
                {
                    return BadRequest(new { message = "Countries parameter is required" });
                }

                var countryList = countries.Split(',', StringSplitOptions.RemoveEmptyEntries)
                                          .Select(c => c.Trim())
                                          .ToList();

                if (countryList.Count == 0)
                {
                    return BadRequest(new { message = "At least one country must be specified" });
                }

                _logger.LogInformation("Getting trending hashtags for countries: {Countries}", string.Join(", ", countryList));

                var result = new Dictionary<string, List<TrendingHashtag>>();

                foreach (var country in countryList)
                {
                    try
                    {
                        var hashtags = await _trendingService.GetTrendingHashtagsAsync(country);
                        result[country] = hashtags;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to get hashtags for country: {Country}", country);
                        result[country] = new List<TrendingHashtag>();
                    }
                }

                _logger.LogInformation("Retrieved trending hashtags for {Count} countries", result.Count);
                
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving multi-country trending hashtags");
                return StatusCode(500, new { message = "Error retrieving multi-country trending hashtags", error = ex.Message });
            }
        }

        /// <summary>
        /// Get cache status and statistics
        /// </summary>
        /// <returns>Cache information and statistics</returns>
        [HttpGet("cache/status")]
        public ActionResult GetCacheStatus()
        {
            try
            {
                // This is a simple status endpoint - in a real implementation,
                // you might want to expose cache hit rates, expiration times, etc.
                return Ok(new
                {
                    message = "Trending service is operational",
                    cacheExpiration = "30 minutes",
                    rateLimitDelay = "2 seconds",
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting cache status");
                return StatusCode(500, new { message = "Error getting cache status", error = ex.Message });
            }
        }
    }
}