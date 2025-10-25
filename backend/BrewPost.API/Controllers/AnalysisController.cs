using Microsoft.AspNetCore.Mvc;
using BrewPost.API.Models;
using Microsoft.Extensions.Logging;
using BrewPost.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace BrewPost.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AnalysisController : ControllerBase
    {
        private readonly IAnalysisService _analysisService;
        private readonly ILogger<AnalysisController> _logger;
        private readonly BrewPostDbContext _context;

        public AnalysisController(IAnalysisService analysisService, ILogger<AnalysisController> logger, BrewPostDbContext context)
        {
            _analysisService = analysisService;
            _logger = logger;
            _context = context;
        }

        /// <summary>
        /// Analyze content and return comprehensive analysis including scores, projections, and insights
        /// </summary>
        [HttpPost("analyze")]
        public async Task<ActionResult<ContentAnalysisResult>> AnalyzeContent([FromBody] ContentAnalysisRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.ContentId))
                {
                    return BadRequest("ContentId is required");
                }

                _logger.LogInformation("Analyzing content: {ContentId}", request.ContentId);

                var result = await _analysisService.AnalyzeContentAsync(request);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error analyzing content: {ContentId}", request.ContentId);
                return StatusCode(500, "An error occurred while analyzing the content");
            }
        }

        /// <summary>
        /// Get trending hashtags analysis for wine/brewery content
        /// </summary>
        [HttpGet("trending-hashtags")]
        public async Task<ActionResult<List<TrendingHashtagAnalysis>>> GetTrendingHashtags()
        {
            try
            {
                _logger.LogInformation("Fetching trending hashtags analysis");

                var hashtags = await _analysisService.GetTrendingHashtagsAnalysisAsync();
                return Ok(hashtags);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching trending hashtags analysis");
                return StatusCode(500, "An error occurred while fetching trending hashtags");
            }
        }

        /// <summary>
        /// Get trending hashtags based on specific node content
        /// </summary>
        [HttpGet("trending-hashtags/{nodeId}")]
        public async Task<ActionResult<List<TrendingHashtagAnalysis>>> GetTrendingHashtagsForNode(string nodeId)
        {
            try
            {
                _logger.LogInformation("Fetching trending hashtags for node: {NodeId}", nodeId);

                // Get the specific node
                var node = await _context.Nodes.FirstOrDefaultAsync(n => n.Id.ToString() == nodeId);
                if (node == null)
                {
                    return NotFound($"Node with ID {nodeId} not found");
                }

                // Generate hashtags based on node content
                var hashtags = GenerateDynamicHashtagsForNode(node);
                return Ok(hashtags);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching trending hashtags for node: {NodeId}", nodeId);
                return StatusCode(500, "An error occurred while fetching trending hashtags for node");
            }
        }

        /// <summary>
        /// Analyze node data directly without database lookup
        /// </summary>
        [HttpPost("analyze-node")]
        public async Task<ActionResult<NodeAnalysisResult>> AnalyzeNodeData([FromBody] NodeAnalysisRequest request)
        {
            try
            {
                _logger.LogInformation("Analyzing node data directly");

                if (request == null)
                {
                    return BadRequest("Node data is required");
                }

                // Create a temporary node object for analysis
                var tempNode = new BrewPost.Core.Entities.Node
                {
                    Id = Guid.NewGuid(),
                    UserId = Guid.NewGuid(), // Temporary user ID for analysis
                    Title = request.Title,
                    Content = request.Content,
                    ImageUrl = request.ImageUrl,
                    ImageUrls = request.ImageUrls != null ? System.Text.Json.JsonDocument.Parse(System.Text.Json.JsonSerializer.Serialize(request.ImageUrls)) : null,
                    ImagePrompt = request.ImagePrompt,
                    Type = request.Type,
                    Status = request.Status,
                    X = request.X,
                    Y = request.Y,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                // Calculate individual scores for this node data
                var imageScore = CalculateImageScore(tempNode);
                var captionScore = CalculateCaptionScore(tempNode);
                var topicScore = CalculateTopicScore(tempNode);
                var overallScore = (imageScore + captionScore + topicScore) / 3.0;

                // Extract hashtags from this node's content
                var nodeHashtags = ExtractHashtagsFromNodes(new List<BrewPost.Core.Entities.Node> { tempNode });
                
                // Determine top performing category for this node
                var categoryScores = new Dictionary<string, double>
                {
                    ["Image Quality"] = imageScore,
                    ["Caption Quality"] = captionScore,
                    ["Topic Relevance"] = topicScore
                };
                var topPerformingCategory = categoryScores
                    .OrderByDescending(kvp => kvp.Value)
                    .First().Key;

                // Generate insights based on this node's scores
                var strengths = GenerateInsightStrengths(imageScore, captionScore, topicScore);
                var improvements = GenerateInsightImprovements(imageScore, captionScore, topicScore);
                var recommendations = GenerateInsightRecommendations(imageScore, captionScore, topicScore);

                var result = new NodeAnalysisResult
                {
                    ImageScore = Math.Round(imageScore, 1),
                    CaptionScore = Math.Round(captionScore, 1),
                    TopicScore = Math.Round(topicScore, 1),
                    AverageScore = Math.Round(overallScore, 1),
                    OverallScore = Math.Round(overallScore, 1),
                    TopPerformingCategory = topPerformingCategory,
                    MostUsedHashtags = nodeHashtags.Take(3).ToArray(),
                    Projections = new
                    {
                        engagement = new
                        {
                            data = new[]
                            {
                                new { day = "Day 1", likes = (int)(overallScore * 5), comments = (int)(overallScore * 1.5), shares = (int)(overallScore) },
                                new { day = "Day 2", likes = (int)(overallScore * 9), comments = (int)(overallScore * 2.8), shares = (int)(overallScore * 1.8) },
                                new { day = "Day 3", likes = (int)(overallScore * 14), comments = (int)(overallScore * 4.2), shares = (int)(overallScore * 2.6) },
                                new { day = "Day 7", likes = (int)(overallScore * 21), comments = (int)(overallScore * 5.8), shares = (int)(overallScore * 3.7) },
                                new { day = "Day 14", likes = (int)(overallScore * 26), comments = (int)(overallScore * 7.0), shares = (int)(overallScore * 4.6) },
                                new { day = "Day 30", likes = (int)(overallScore * 34), comments = (int)(overallScore * 8.7), shares = (int)(overallScore * 5.4) }
                            }
                        },
                        reach = new
                        {
                            data = new[]
                            {
                                new { week = "Week 1", organic = (int)(overallScore * 144), hashtag = (int)(overallScore * 96), total = (int)(overallScore * 240) },
                                new { week = "Week 2", organic = (int)(overallScore * 180), hashtag = (int)(overallScore * 144), total = (int)(overallScore * 324) },
                                new { week = "Week 3", organic = (int)(overallScore * 216), hashtag = (int)(overallScore * 180), total = (int)(overallScore * 396) },
                                new { week = "Week 4", organic = (int)(overallScore * 264), hashtag = (int)(overallScore * 216), total = (int)(overallScore * 480) }
                            }
                        }
                    },
                    Insights = new
                    {
                        strengths = strengths,
                        improvements = improvements,
                        recommendations = recommendations
                    }
                };

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error analyzing node data");
                return StatusCode(500, "An error occurred while analyzing the node data");
            }
        }

        /// <summary>
        /// Get analysis for a specific node - returns individual scores for that node only
        /// </summary>
        [HttpGet("node/{nodeId}")]
        public async Task<ActionResult<object>> GetNodeAnalysis(string nodeId)
        {
            try
            {
                _logger.LogInformation("Analyzing specific node: {NodeId}", nodeId);

                // Get the specific node
                var node = await _context.Nodes.FirstOrDefaultAsync(n => n.Id.ToString() == nodeId);
                if (node == null)
                {
                    return NotFound($"Node with ID {nodeId} not found");
                }

                // Calculate individual scores for THIS specific node
                var imageScore = CalculateImageScore(node);
                var captionScore = CalculateCaptionScore(node);
                var topicScore = CalculateTopicScore(node);
                var overallScore = (imageScore + captionScore + topicScore) / 3.0;

                // Extract hashtags from this node's content
                var nodeHashtags = ExtractHashtagsFromNodes(new List<BrewPost.Core.Entities.Node> { node });
                
                // Determine top performing category for this node
                var categoryScores = new Dictionary<string, double>
                {
                    ["Image Quality"] = imageScore,
                    ["Caption Quality"] = captionScore,
                    ["Topic Relevance"] = topicScore
                };
                var topPerformingCategory = categoryScores
                    .OrderByDescending(kvp => kvp.Value)
                    .First().Key;

                // Generate insights based on this node's scores
                var strengths = GenerateInsightStrengths(imageScore, captionScore, topicScore);
                var improvements = GenerateInsightImprovements(imageScore, captionScore, topicScore);
                var recommendations = GenerateInsightRecommendations(imageScore, captionScore, topicScore);

                return Ok(new
                {
                    nodeId = nodeId,
                    imageScore = Math.Round(imageScore, 1),
                    captionScore = Math.Round(captionScore, 1),
                    topicScore = Math.Round(topicScore, 1),
                    averageScore = Math.Round(overallScore, 1),
                    overallScore = Math.Round(overallScore, 1),
                    topPerformingCategory = topPerformingCategory,
                    mostUsedHashtags = nodeHashtags.Take(3).ToArray(),
                    projections = new
                    {
                        engagement = new
                        {
                            data = new[]
                            {
                                new { day = "Day 1", likes = (int)(overallScore * 5), comments = (int)(overallScore * 1.5), shares = (int)(overallScore) },
                                new { day = "Day 2", likes = (int)(overallScore * 9), comments = (int)(overallScore * 2.8), shares = (int)(overallScore * 1.8) },
                                new { day = "Day 3", likes = (int)(overallScore * 14), comments = (int)(overallScore * 4.2), shares = (int)(overallScore * 2.6) },
                                new { day = "Day 7", likes = (int)(overallScore * 21), comments = (int)(overallScore * 5.8), shares = (int)(overallScore * 3.7) },
                                new { day = "Day 14", likes = (int)(overallScore * 26), comments = (int)(overallScore * 7.0), shares = (int)(overallScore * 4.6) },
                                new { day = "Day 30", likes = (int)(overallScore * 34), comments = (int)(overallScore * 8.7), shares = (int)(overallScore * 5.4) }
                            }
                        },
                        reach = new
                        {
                            data = new[]
                            {
                                new { week = "Week 1", organic = (int)(overallScore * 144), hashtag = (int)(overallScore * 96), total = (int)(overallScore * 240) },
                                new { week = "Week 2", organic = (int)(overallScore * 180), hashtag = (int)(overallScore * 144), total = (int)(overallScore * 324) },
                                new { week = "Week 3", organic = (int)(overallScore * 216), hashtag = (int)(overallScore * 180), total = (int)(overallScore * 396) },
                                new { week = "Week 4", organic = (int)(overallScore * 264), hashtag = (int)(overallScore * 216), total = (int)(overallScore * 480) }
                            }
                        }
                    },
                    insights = new
                    {
                        strengths = strengths,
                        improvements = improvements,
                        recommendations = recommendations
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error analyzing node: {NodeId}", nodeId);
                return StatusCode(500, "An error occurred while analyzing the node");
            }
        }

        /// <summary>
        /// Get engagement projection for specific content
        /// </summary>
        [HttpGet("engagement-projection/{contentId}")]
        public async Task<ActionResult<EngagementProjection>> GetEngagementProjection(string contentId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(contentId))
                {
                    return BadRequest("ContentId is required");
                }

                _logger.LogInformation("Fetching engagement projection for: {ContentId}", contentId);

                var projection = await _analysisService.GetEngagementProjectionAsync(contentId);
                return Ok(projection);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching engagement projection for: {ContentId}", contentId);
                return StatusCode(500, "An error occurred while fetching engagement projection");
            }
        }

        /// <summary>
        /// Get reach forecast for specific content
        /// </summary>
        [HttpGet("reach-forecast/{contentId}")]
        public async Task<ActionResult<ReachForecast>> GetReachForecast(string contentId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(contentId))
                {
                    return BadRequest("ContentId is required");
                }

                _logger.LogInformation("Fetching reach forecast for: {ContentId}", contentId);

                var forecast = await _analysisService.GetReachForecastAsync(contentId);
                return Ok(forecast);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching reach forecast for: {ContentId}", contentId);
                return StatusCode(500, "An error occurred while fetching reach forecast");
            }
        }

        /// <summary>
        /// Get analysis summary for multiple content items
        /// </summary>
        [HttpPost("batch-analyze")]
        public async Task<ActionResult<List<ContentAnalysisResult>>> BatchAnalyzeContent([FromBody] List<ContentAnalysisRequest> requests)
        {
            try
            {
                if (requests == null || !requests.Any())
                {
                    return BadRequest("At least one content analysis request is required");
                }

                if (requests.Count > 10)
                {
                    return BadRequest("Maximum 10 content items can be analyzed in a single batch");
                }

                _logger.LogInformation("Batch analyzing {Count} content items", requests.Count);

                var results = new List<ContentAnalysisResult>();
                
                foreach (var request in requests)
                {
                    try
                    {
                        var result = await _analysisService.AnalyzeContentAsync(request);
                        results.Add(result);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to analyze content: {ContentId}", request.ContentId);
                        // Continue with other items, don't fail the entire batch
                    }
                }

                return Ok(results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in batch content analysis");
                return StatusCode(500, "An error occurred while batch analyzing content");
            }
        }

        /// <summary>
        /// Get analysis health check and service status
        /// </summary>
        [HttpGet("health")]
        public ActionResult<object> GetHealthStatus()
        {
            try
            {
                return Ok(new
                {
                    Status = "Healthy",
                    Timestamp = DateTime.UtcNow,
                    Version = "1.0.0",
                    Services = new
                    {
                        AnalysisService = "Active",
                        TrendingService = "Active"
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Health check failed");
                return StatusCode(500, "Service health check failed");
            }
        }

        /// <summary>
        /// Get analysis statistics and metrics based on actual node data
        /// </summary>
        [HttpGet("statistics")]
        public async Task<ActionResult<object>> GetAnalysisStatistics()
        {
            try
            {
                _logger.LogInformation("Calculating analysis statistics from actual node data");

                // Try to get all nodes from database
                List<BrewPost.Core.Entities.Node> nodes;
                try
                {
                    nodes = await _context.Nodes.ToListAsync();
                }
                catch (Exception dbEx)
                {
                    _logger.LogError(dbEx, "Database error occurred while fetching nodes");
                    return StatusCode(500, "Database connection error");
                }
                
                if (!nodes.Any())
                {
                    // Return default values if no nodes exist
                    return Ok(new
                    {
                        imageScore = 0.0,
                        captionScore = 0.0,
                        topicScore = 0.0,
                        averageScore = 0.0,
                        overallScore = 0.0,
                        TotalAnalyses = 0,
                        TopPerformingCategory = "No Data",
                        MostUsedHashtags = new string[] { },
                        AnalysisFrequency = new
                        {
                            Daily = 0,
                            Weekly = 0,
                            Monthly = 0
                        },
                        ScoreDistribution = new
                        {
                            Excellent = 0,
                            Good = 0,
                            Fair = 0,
                            Poor = 0
                        }
                    });
                }

                // Calculate actual statistics
                var totalAnalyses = nodes.Count;
                
                // Calculate scores for each node using the analysis service logic
                var nodeScores = new List<double>();
                var categoryScores = new Dictionary<string, List<double>>
                {
                    ["Image Quality"] = new List<double>(),
                    ["Caption Quality"] = new List<double>(),
                    ["Topic Relevance"] = new List<double>()
                };

                foreach (var node in nodes)
                {
                    // Calculate image score
                    var imageScore = CalculateImageScore(node);
                    categoryScores["Image Quality"].Add(imageScore);

                    // Calculate caption score
                    var captionScore = CalculateCaptionScore(node);
                    categoryScores["Caption Quality"].Add(captionScore);

                    // Calculate topic score
                    var topicScore = CalculateTopicScore(node);
                    categoryScores["Topic Relevance"].Add(topicScore);

                    // Overall score
                    var overallScore = (imageScore + captionScore + topicScore) / 3.0;
                    nodeScores.Add(overallScore);
                }

                var averageImageScore = categoryScores["Image Quality"].Average();
                var averageCaptionScore = categoryScores["Caption Quality"].Average();
                var averageTopicScore = categoryScores["Topic Relevance"].Average();
                var averageScore = nodeScores.Average();

                // Find top performing category
                var topPerformingCategory = categoryScores
                    .OrderByDescending(kvp => kvp.Value.Any() ? kvp.Value.Average() : 0)
                    .First().Key;

                // Extract hashtags from content
                var allHashtags = ExtractHashtagsFromNodes(nodes);
                var mostUsedHashtags = allHashtags
                    .GroupBy(h => h)
                    .OrderByDescending(g => g.Count())
                    .Take(3)
                    .Select(g => g.Key)
                    .ToArray();

                // Calculate frequency based on creation dates (using current time as proxy)
                var now = DateTime.UtcNow;
                var dailyCount = nodes.Count(n => (now - (n.PostedAt ?? now)).TotalDays <= 1);
                var weeklyCount = nodes.Count(n => (now - (n.PostedAt ?? now)).TotalDays <= 7);
                var monthlyCount = nodes.Count(n => (now - (n.PostedAt ?? now)).TotalDays <= 30);

                // Calculate score distribution
                var excellent = nodeScores.Count(s => s >= 8.0);
                var good = nodeScores.Count(s => s >= 6.0 && s < 8.0);
                var fair = nodeScores.Count(s => s >= 4.0 && s < 6.0);
                var poor = nodeScores.Count(s => s < 4.0);

                return Ok(new
                {
                    imageScore = Math.Round(averageImageScore, 1),
                    captionScore = Math.Round(averageCaptionScore, 1),
                    topicScore = Math.Round(averageTopicScore, 1),
                    averageScore = Math.Round(averageScore, 1),
                    overallScore = Math.Round(averageScore, 1),
                    TotalAnalyses = totalAnalyses,
                    TopPerformingCategory = topPerformingCategory,
                    MostUsedHashtags = mostUsedHashtags.Any() ? mostUsedHashtags : new[] { "#NoHashtags" },
                    AnalysisFrequency = new
                    {
                        Daily = dailyCount,
                        Weekly = weeklyCount,
                        Monthly = monthlyCount
                    },
                    ScoreDistribution = new
                    {
                        Excellent = excellent,
                        Good = good,
                        Fair = fair,
                        Poor = poor
                    },
                    projections = new
                    {
                        engagement = new
                        {
                            data = new[]
                            {
                                new { day = "Day 1", likes = (int)(averageScore * 5), comments = (int)(averageScore * 1.5), shares = (int)(averageScore) },
                                new { day = "Day 2", likes = (int)(averageScore * 9), comments = (int)(averageScore * 2.8), shares = (int)(averageScore * 1.8) },
                                new { day = "Day 3", likes = (int)(averageScore * 14), comments = (int)(averageScore * 4.2), shares = (int)(averageScore * 2.6) },
                                new { day = "Day 7", likes = (int)(averageScore * 21), comments = (int)(averageScore * 5.8), shares = (int)(averageScore * 3.7) },
                                new { day = "Day 14", likes = (int)(averageScore * 26), comments = (int)(averageScore * 7.0), shares = (int)(averageScore * 4.6) },
                                new { day = "Day 30", likes = (int)(averageScore * 34), comments = (int)(averageScore * 8.7), shares = (int)(averageScore * 5.4) }
                            }
                        },
                        reach = new
                        {
                            data = new[]
                            {
                                new { week = "Week 1", organic = (int)(averageScore * 144), hashtag = (int)(averageScore * 96), total = (int)(averageScore * 240) },
                                new { week = "Week 2", organic = (int)(averageScore * 180), hashtag = (int)(averageScore * 144), total = (int)(averageScore * 324) },
                                new { week = "Week 3", organic = (int)(averageScore * 216), hashtag = (int)(averageScore * 180), total = (int)(averageScore * 396) },
                                new { week = "Week 4", organic = (int)(averageScore * 264), hashtag = (int)(averageScore * 216), total = (int)(averageScore * 480) }
                            }
                        }
                    },
                    insights = new
                    {
                        strengths = GenerateInsightStrengths(averageImageScore, averageCaptionScore, averageTopicScore),
                        improvements = GenerateInsightImprovements(averageImageScore, averageCaptionScore, averageTopicScore),
                        recommendations = GenerateInsightRecommendations(averageImageScore, averageCaptionScore, averageTopicScore)
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching analysis statistics");
                return StatusCode(500, "An error occurred while fetching statistics");
            }
        }

        private double CalculateImageScore(BrewPost.Core.Entities.Node node)
        {
            // No image = very low score based on other factors
            if (string.IsNullOrEmpty(node.ImageUrl))
            {
                var baseScore = 1.0; // Start with minimal score
                
                // Check if there's at least an image prompt (shows intent)
                if (!string.IsNullOrEmpty(node.ImagePrompt))
                {
                    baseScore += 0.5; // Small bonus for having a prompt
                    
                    // Analyze prompt quality even without image
                    var promptLength = node.ImagePrompt.Length;
                    if (promptLength > 20) baseScore += 0.3;
                    if (promptLength > 50) baseScore += 0.2;
                }
                
                return Math.Min(baseScore, 3.0); // Cap low scores at 3.0 for no image
            }

            var score = 5.0; // Base score for having an image

            // Check for multiple images
            if (node.ImageUrls != null)
            {
                try
                {
                    var imageUrls = System.Text.Json.JsonSerializer.Deserialize<string[]>(node.ImageUrls.RootElement.GetRawText());
                    if (imageUrls?.Length > 1)
                    {
                        score += 1.5; // Bonus for multiple images
                    }
                    if (imageUrls?.Length > 3)
                    {
                        score += 0.5; // Extra bonus for many images
                    }
                }
                catch
                {
                    // Ignore JSON parsing errors
                }
            }

            // Analyze image URL for quality indicators
            var imageUrl = node.ImageUrl.ToLower();
            if (imageUrl.Contains("hd") || imageUrl.Contains("high") || imageUrl.Contains("quality") || imageUrl.Contains("4k"))
            {
                score += 1.0; // Quality indicator bonus
            }

            // Check image format (higher quality formats get bonus)
            if (imageUrl.Contains(".jpg") || imageUrl.Contains(".jpeg") || imageUrl.Contains(".png") || imageUrl.Contains(".webp"))
            {
                score += 0.5; // Standard format bonus
            }

            // Image prompt quality analysis
            if (!string.IsNullOrEmpty(node.ImagePrompt))
            {
                var promptLength = node.ImagePrompt.Length;
                var promptWords = node.ImagePrompt.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
                
                if (promptLength > 50) score += 0.5; // Detailed prompt bonus
                if (promptLength > 100) score += 0.5; // Very detailed prompt bonus
                if (promptWords > 10) score += 0.3; // Rich vocabulary bonus
                
                // Check for descriptive keywords in prompt
                var descriptiveKeywords = new[] { "detailed", "professional", "high-quality", "vibrant", "clear", "sharp", "beautiful", "stunning" };
                var descriptiveCount = descriptiveKeywords.Count(keyword => node.ImagePrompt.ToLower().Contains(keyword));
                score += descriptiveCount * 0.2;
            }

            return Math.Min(score, 10.0); // Cap at 10
        }

        private double CalculateCaptionScore(BrewPost.Core.Entities.Node node)
        {
            if (string.IsNullOrEmpty(node.Content))
            {
                // Check if there's at least a title to work with
                if (!string.IsNullOrEmpty(node.Title))
                {
                    var titleLength = node.Title.Length;
                    if (titleLength > 10) return 1.5; // Decent title
                    if (titleLength > 5) return 1.0; // Short title
                }
                return 0.5; // Very low score for no content at all
            }

            var score = 3.0; // Base score
            var content = node.Content.ToLower();
            var originalContent = node.Content;

            // Length scoring - optimal length analysis
            var length = originalContent.Length;
            if (length < 20)
            {
                score += 0.5; // Too short penalty
            }
            else if (length >= 20 && length <= 100)
            {
                score += 2.0; // Optimal short length
            }
            else if (length > 100 && length <= 280)
            {
                score += 2.5; // Optimal medium length
            }
            else if (length > 280 && length <= 500)
            {
                score += 1.5; // Good long length
            }
            else
            {
                score += 0.5; // Too long penalty
            }

            // Engagement and emotional keywords
            var engagementKeywords = new[] { "amazing", "love", "best", "perfect", "incredible", "awesome", "fantastic", "delicious", "beautiful", "stunning", "wonderful", "excited", "thrilled", "grateful", "blessed" };
            var engagementCount = engagementKeywords.Count(keyword => content.Contains(keyword));
            score += Math.Min(engagementCount * 0.4, 2.0); // Cap engagement bonus

            // Call-to-action indicators
            var ctaKeywords = new[] { "try", "visit", "check", "follow", "like", "share", "comment", "tag", "book", "order", "buy", "get", "join", "subscribe" };
            var ctaCount = ctaKeywords.Count(keyword => content.Contains(keyword));
            score += Math.Min(ctaCount * 0.3, 1.0); // Cap CTA bonus

            // Interactive elements
            var questionCount = originalContent.Count(c => c == '?');
            var exclamationCount = originalContent.Count(c => c == '!');
            score += Math.Min(questionCount * 0.3, 0.9); // Questions encourage engagement
            score += Math.Min(exclamationCount * 0.2, 0.6); // Exclamations show enthusiasm

            // Hashtag analysis
            var hashtagCount = originalContent.Count(c => c == '#');
            if (hashtagCount >= 1 && hashtagCount <= 5)
            {
                score += 0.8; // Good hashtag usage
            }
            else if (hashtagCount > 5 && hashtagCount <= 10)
            {
                score += 0.4; // Moderate hashtag usage
            }
            else if (hashtagCount > 10)
            {
                score -= 0.5; // Too many hashtags penalty
            }

            // Mention analysis (@username)
            var mentionCount = originalContent.Count(c => c == '@');
            score += Math.Min(mentionCount * 0.2, 0.6); // Mentions increase reach

            // Readability - sentence structure
            var sentences = originalContent.Split(new[] { '.', '!', '?' }, StringSplitOptions.RemoveEmptyEntries);
            if (sentences.Length > 1)
            {
                score += 0.5; // Multiple sentences improve readability
            }

            // Emoji usage (basic detection)
            var emojiPattern = @"[\u263a-\u263f]|[\u2600-\u26ff]|[\u2700-\u27bf]";
            var emojiMatches = Regex.Matches(originalContent, emojiPattern);
            if (emojiMatches.Count > 0 && emojiMatches.Count <= 5)
            {
                score += 0.6; // Good emoji usage
            }
            else if (emojiMatches.Count > 5)
            {
                score += 0.2; // Too many emojis
            }

            return Math.Min(score, 10.0); // Cap at 10
        }

        private double CalculateTopicScore(BrewPost.Core.Entities.Node node)
        {
            // Start with minimal base score - content must earn its score
            var score = 1.0;
            // Check if we have any content to analyze
            if (string.IsNullOrEmpty(node.Title) && string.IsNullOrEmpty(node.Content))
            {
                return 0.5; // Very low score for no content
            }

            var content = (node.Title + " " + node.Content).ToLower();
            var originalContent = node.Title + " " + node.Content;

            // Content coherence analysis
            var words = content.Split(new[] { ' ', '\n', '\r', '\t' }, StringSplitOptions.RemoveEmptyEntries);
            var uniqueWords = words.Distinct().Count();
            var totalWords = words.Length;

            // Basic content presence bonus
            if (!string.IsNullOrEmpty(node.Title)) score += 1.0;
            if (!string.IsNullOrEmpty(node.Content)) score += 1.5;

            // Topic focus scoring based on content analysis
            if (totalWords > 0)
            {
                // Calculate word diversity ratio
                var diversityRatio = (double)uniqueWords / totalWords;
                
                if (diversityRatio > 0.7 && diversityRatio <= 0.9)
                {
                    score += 2.0; // Good vocabulary diversity
                }
                else if (diversityRatio > 0.5 && diversityRatio <= 0.7)
                {
                    score += 1.5; // Moderate diversity
                }
                else if (diversityRatio <= 0.5)
                {
                    score += 0.5; // Low diversity (repetitive)
                }
                else
                {
                    score += 1.0; // Very high diversity (might be unfocused)
                }
            }

            // Detect main topic categories and score relevance
            var topicCategories = new Dictionary<string, string[]>
            {
                ["Food & Dining"] = new[] { "restaurant", "food", "meal", "dining", "cuisine", "chef", "recipe", "delicious", "taste", "flavor", "menu", "dish", "cooking", "kitchen", "eat", "lunch", "dinner", "breakfast" },
                ["Wine & Beverages"] = new[] { "wine", "brewery", "beer", "craft", "vintage", "tasting", "cellar", "vineyard", "grape", "bottle", "glass", "pour", "aged", "fermented", "cocktail", "drink", "beverage" },
                ["Travel & Places"] = new[] { "travel", "visit", "location", "place", "destination", "trip", "journey", "explore", "adventure", "city", "country", "hotel", "vacation", "tourism" },
                ["Lifestyle & Social"] = new[] { "lifestyle", "friends", "family", "social", "party", "celebration", "event", "gathering", "community", "experience", "moment", "memory", "life", "living" },
                ["Business & Professional"] = new[] { "business", "work", "professional", "company", "service", "quality", "team", "customer", "client", "project", "success", "growth", "innovation" },
                ["Art & Culture"] = new[] { "art", "culture", "music", "design", "creative", "artist", "gallery", "museum", "exhibition", "performance", "tradition", "heritage" }
            };

            var topicScores = new Dictionary<string, int>();
            foreach (var category in topicCategories)
            {
                var matchCount = category.Value.Count(keyword => content.Contains(keyword));
                topicScores[category.Key] = matchCount;
            }

            // Find dominant topic and calculate relevance
            var dominantTopic = topicScores.OrderByDescending(kvp => kvp.Value).First();
            if (dominantTopic.Value > 0)
            {
                // Strong topic focus bonus
                score += Math.Min(dominantTopic.Value * 0.8, 3.0);
                
                // Check if content is consistently focused on the dominant topic
                var totalTopicWords = topicScores.Values.Sum();
                var focusRatio = (double)dominantTopic.Value / Math.Max(totalTopicWords, 1);
                
                if (focusRatio > 0.6)
                {
                    score += 1.0; // Very focused content
                }
                else if (focusRatio > 0.4)
                {
                    score += 0.5; // Moderately focused
                }
            }

            // Title-content alignment
            if (!string.IsNullOrEmpty(node.Title) && !string.IsNullOrEmpty(node.Content))
            {
                var titleWords = node.Title.ToLower().Split(' ', StringSplitOptions.RemoveEmptyEntries);
                var contentWords = node.Content.ToLower().Split(' ', StringSplitOptions.RemoveEmptyEntries);
                
                var commonWords = titleWords.Intersect(contentWords).Count();
                var alignmentRatio = (double)commonWords / Math.Max(titleWords.Length, 1);
                
                if (alignmentRatio > 0.3)
                {
                    score += 1.0; // Good title-content alignment
                }
                else if (alignmentRatio > 0.1)
                {
                    score += 0.5; // Some alignment
                }
            }

            // Content depth analysis
            if (totalWords >= 20)
            {
                score += 0.5; // Sufficient content depth
            }
            if (totalWords >= 50)
            {
                score += 0.5; // Good content depth
            }

            // Specificity bonus (proper nouns, specific terms)
            var specificityIndicators = new[] { "restaurant", "cafe", "bar", "hotel", "brand", "company", "street", "avenue", "city" };
            var specificityCount = specificityIndicators.Count(indicator => content.Contains(indicator));
            score += Math.Min(specificityCount * 0.3, 1.0);

            return Math.Min(score, 10.0); // Cap at 10
        }

        private List<string> ExtractHashtagsFromNodes(List<BrewPost.Core.Entities.Node> nodes)
        {
            var hashtags = new List<string>();
            var hashtagPattern = @"#\w+";

            foreach (var node in nodes)
            {
                var content = node.Title + " " + node.Content;
                var matches = Regex.Matches(content, hashtagPattern, RegexOptions.IgnoreCase);
                
                foreach (Match match in matches)
                {
                    hashtags.Add(match.Value);
                }
            }

            return hashtags;
        }

        private List<TrendingHashtagAnalysis> GenerateDynamicHashtagsForNode(BrewPost.Core.Entities.Node node)
        {
            var hashtags = new List<TrendingHashtagAnalysis>();
            var content = (node.Title + " " + node.Content).ToLower();
            
            // Extract existing hashtags from content
            var existingHashtags = ExtractHashtagsFromNodes(new List<BrewPost.Core.Entities.Node> { node });
            
            // Dynamic keyword categories with contextual scoring
            var keywordCategories = new Dictionary<string, Dictionary<string, double>>
            {
                ["Food & Dining"] = new Dictionary<string, double>
                {
                    { "restaurant", 9.0 }, { "food", 8.5 }, { "dining", 8.2 }, { "cuisine", 8.0 },
                    { "chef", 7.8 }, { "menu", 7.5 }, { "delicious", 8.3 }, { "taste", 7.9 },
                    { "flavor", 7.7 }, { "meal", 8.1 }, { "dish", 7.6 }, { "cooking", 7.4 },
                    { "italian", 8.4 }, { "pizza", 8.0 }, { "pasta", 7.8 }, { "seafood", 7.9 },
                    { "breakfast", 7.3 }, { "lunch", 7.2 }, { "dinner", 7.5 }, { "brunch", 7.4 }
                },
                ["Wine & Beverages"] = new Dictionary<string, double>
                {
                    { "wine", 9.5 }, { "winery", 9.0 }, { "vineyard", 8.8 }, { "tasting", 8.5 },
                    { "cellar", 8.2 }, { "vintage", 8.7 }, { "grape", 8.0 }, { "bottle", 7.5 },
                    { "beer", 8.2 }, { "brewery", 8.4 }, { "craft", 8.3 }, { "cocktail", 7.9 },
                    { "drink", 7.6 }, { "beverage", 7.4 }, { "bar", 8.0 }, { "pub", 7.7 }
                },
                ["Travel & Places"] = new Dictionary<string, double>
                {
                    { "travel", 8.7 }, { "visit", 8.2 }, { "location", 7.8 }, { "place", 7.5 },
                    { "destination", 8.4 }, { "trip", 8.0 }, { "explore", 8.1 }, { "adventure", 7.9 },
                    { "city", 7.6 }, { "vacation", 8.3 }, { "tourism", 7.4 }, { "hotel", 7.7 }
                },
                ["Lifestyle & Social"] = new Dictionary<string, double>
                {
                    { "lifestyle", 8.0 }, { "friends", 7.8 }, { "family", 7.9 }, { "social", 7.6 },
                    { "party", 8.1 }, { "celebration", 8.2 }, { "event", 7.7 }, { "gathering", 7.5 },
                    { "experience", 8.3 }, { "moment", 7.4 }, { "memory", 7.6 }, { "life", 7.2 }
                },
                ["Business & Professional"] = new Dictionary<string, double>
                {
                    { "business", 7.8 }, { "professional", 7.6 }, { "service", 7.4 }, { "quality", 8.0 },
                    { "team", 7.3 }, { "customer", 7.5 }, { "company", 7.2 }, { "brand", 7.9 }
                }
            };

            // Analyze content to determine dominant categories
            var categoryScores = new Dictionary<string, double>();
            foreach (var category in keywordCategories)
            {
                var totalScore = 0.0;
                var matchCount = 0;
                
                foreach (var keyword in category.Value)
                {
                    if (content.Contains(keyword.Key))
                    {
                        totalScore += keyword.Value;
                        matchCount++;
                    }
                }
                
                categoryScores[category.Key] = matchCount > 0 ? totalScore / matchCount : 0;
            }

            // Generate hashtags based on detected content categories
            var dominantCategories = categoryScores
                .Where(kvp => kvp.Value > 0)
                .OrderByDescending(kvp => kvp.Value)
                .Take(2) // Focus on top 2 categories
                .ToList();

            foreach (var category in dominantCategories)
            {
                var categoryKeywords = keywordCategories[category.Key];
                
                foreach (var keyword in categoryKeywords)
                {
                    if (content.Contains(keyword.Key))
                    {
                        var hashtagName = $"#{char.ToUpper(keyword.Key[0])}{keyword.Key.Substring(1)}";
                        if (!existingHashtags.Contains(hashtagName, StringComparer.OrdinalIgnoreCase) && 
                            !hashtags.Any(h => h.Tag.Equals(hashtagName, StringComparison.OrdinalIgnoreCase)))
                        {
                            hashtags.Add(new TrendingHashtagAnalysis
                            {
                                Tag = hashtagName,
                                Score = keyword.Value + Random.Shared.NextDouble() * 0.5 - 0.25,
                                Trend = keyword.Value > 8.0 ? "up" : keyword.Value > 6.0 ? "stable" : "down",
                                UsageCount = Random.Shared.Next(500, 5000),
                                EngagementRate = Math.Min(0.9, keyword.Value / 10.0 + Random.Shared.NextDouble() * 0.2)
                            });
                        }
                    }
                }
            }

            // Add existing hashtags from content with calculated scores
            foreach (var existingHashtag in existingHashtags.Take(3))
            {
                if (!hashtags.Any(h => h.Tag.Equals(existingHashtag, StringComparison.OrdinalIgnoreCase)))
                {
                    var score = 6.0 + Random.Shared.NextDouble() * 3.0; // 6.0 to 9.0
                    hashtags.Add(new TrendingHashtagAnalysis
                    {
                        Tag = existingHashtag,
                        Score = score,
                        Trend = score > 7.5 ? "up" : score > 6.5 ? "stable" : "down",
                        UsageCount = Random.Shared.Next(1000, 8000),
                        EngagementRate = Math.Min(0.85, score / 10.0 + Random.Shared.NextDouble() * 0.15)
                    });
                }
            }

            // Generate generic hashtags based on content type if no specific matches
            if (!hashtags.Any())
            {
                // Determine content type and add appropriate generic hashtags
                if (content.Contains("food") || content.Contains("restaurant") || content.Contains("dining"))
                {
                    hashtags.AddRange(new[]
                    {
                        new TrendingHashtagAnalysis { Tag = "#Food", Score = 8.5, Trend = "up", UsageCount = 4500, EngagementRate = 0.75 },
                        new TrendingHashtagAnalysis { Tag = "#Foodie", Score = 8.2, Trend = "up", UsageCount = 3200, EngagementRate = 0.72 },
                        new TrendingHashtagAnalysis { Tag = "#Dining", Score = 7.8, Trend = "stable", UsageCount = 2800, EngagementRate = 0.68 }
                    });
                }
                else if (content.Contains("travel") || content.Contains("visit") || content.Contains("location"))
                {
                    hashtags.AddRange(new[]
                    {
                        new TrendingHashtagAnalysis { Tag = "#Travel", Score = 8.5, Trend = "up", UsageCount = 4500, EngagementRate = 0.75 },
                        new TrendingHashtagAnalysis { Tag = "#Explore", Score = 8.2, Trend = "up", UsageCount = 3200, EngagementRate = 0.72 },
                        new TrendingHashtagAnalysis { Tag = "#Adventure", Score = 7.8, Trend = "stable", UsageCount = 2800, EngagementRate = 0.68 }
                    });
                }
                else
                {
                    // Default generic hashtags
                    hashtags.AddRange(new[]
                    {
                        new TrendingHashtagAnalysis { Tag = "#Lifestyle", Score = 7.5, Trend = "stable", UsageCount = 3500, EngagementRate = 0.65 },
                        new TrendingHashtagAnalysis { Tag = "#Experience", Score = 7.2, Trend = "stable", UsageCount = 2900, EngagementRate = 0.62 },
                        new TrendingHashtagAnalysis { Tag = "#Quality", Score = 6.8, Trend = "stable", UsageCount = 2400, EngagementRate = 0.58 }
                    });
                }
            }

            // Sort by score and return top 5
            return hashtags.OrderByDescending(h => h.Score).Take(5).ToList();
        }

        private string[] GenerateInsightStrengths(double imageScore, double captionScore, double topicScore)
        {
            var strengths = new List<string>();

            if (imageScore >= 7.0)
                strengths.Add("Excellent visual content with high-quality images");
            else if (imageScore >= 5.0)
                strengths.Add("Good visual presentation");
            else if (imageScore >= 3.0)
                strengths.Add("Basic visual content present");

            if (captionScore >= 7.0)
                strengths.Add("Engaging and well-crafted captions");
            else if (captionScore >= 5.0)
                strengths.Add("Decent caption quality with room for improvement");
            else if (captionScore >= 3.0)
                strengths.Add("Basic caption structure in place");

            if (topicScore >= 7.0)
                strengths.Add("Strong topic relevance and keyword usage");
            else if (topicScore >= 5.0)
                strengths.Add("Good topic alignment");
            else if (topicScore >= 3.0)
                strengths.Add("Some topic relevance detected");

            return strengths.Any() ? strengths.ToArray() : new[] { "Content structure is present" };
        }

        private string[] GenerateInsightImprovements(double imageScore, double captionScore, double topicScore)
        {
            var improvements = new List<string>();

            if (imageScore < 5.0)
                improvements.Add("Add high-quality images to improve visual appeal");
            if (captionScore < 5.0)
                improvements.Add("Enhance captions with more engaging and descriptive content");
            if (topicScore < 5.0)
                improvements.Add("Include more relevant keywords and topic-specific content");

            if (imageScore < 3.0)
                improvements.Add("Consider adding multiple images for better engagement");
            if (captionScore < 3.0)
                improvements.Add("Write longer, more detailed captions");
            if (topicScore < 3.0)
                improvements.Add("Focus on specific topics and use relevant hashtags");

            return improvements.Any() ? improvements.ToArray() : new[] { "Continue maintaining current content quality" };
        }

        private string[] GenerateInsightRecommendations(double imageScore, double captionScore, double topicScore)
        {
            var recommendations = new List<string>();

            if (imageScore < 6.0)
                recommendations.Add("Upload professional, high-resolution images");
            if (captionScore < 6.0)
                recommendations.Add("Include call-to-action phrases and engaging questions");
            if (topicScore < 6.0)
                recommendations.Add("Research and use trending keywords in your niche");

            // General recommendations based on overall performance
            var averageScore = (imageScore + captionScore + topicScore) / 3.0;
            if (averageScore < 5.0)
            {
                recommendations.Add("Consider posting during peak engagement hours");
                recommendations.Add("Engage with your audience through comments and responses");
            }
            else if (averageScore >= 7.0)
            {
                recommendations.Add("Maintain current quality and experiment with new content formats");
                recommendations.Add("Consider creating content series for better engagement");
            }

            return recommendations.Any() ? recommendations.ToArray() : new[] { "Keep creating quality content consistently" };
        }
    }
}