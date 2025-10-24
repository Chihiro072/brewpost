using BrewPost.Core.Interfaces;
using BrewPost.Core.DTOs;
using HtmlAgilityPack;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using System.Text.RegularExpressions;

namespace BrewPost.Infrastructure.Services
{
    public class TrendingService : ITrendingService
    {
        private readonly HttpClient _httpClient;
        private readonly IMemoryCache _cache;
        private readonly ILogger<TrendingService> _logger;
        private readonly TimeSpan _cacheExpiration = TimeSpan.FromMinutes(30); // Cache for 30 minutes
        private readonly TimeSpan _rateLimitDelay = TimeSpan.FromSeconds(2); // 2 second delay between requests
        private static DateTime _lastRequestTime = DateTime.MinValue;
        private static readonly object _rateLimitLock = new object();

        // Wine and beverage related keywords for filtering
        private readonly string[] _beverageKeywords = {
            "wine", "beer", "cocktail", "drink", "beverage", "alcohol", "bar", "pub", "brewery", 
            "winery", "vineyard", "sommelier", "tasting", "vintage", "craft", "spirits", "whiskey",
            "vodka", "gin", "rum", "champagne", "prosecco", "sangria", "margarita", "mojito",
            "restaurant", "dining", "food", "chef", "culinary", "gastronomy", "happy hour"
        };

        public TrendingService(HttpClient httpClient, IMemoryCache cache, ILogger<TrendingService> logger)
        {
            _httpClient = httpClient;
            _cache = cache;
            _logger = logger;
            
            // Configure HttpClient
            _httpClient.DefaultRequestHeaders.Add("User-Agent", 
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
        }

        public async Task<List<TrendingHashtag>> GetTrendingHashtagsAsync(string? country = null)
        {
            country ??= "worldwide";
            var cacheKey = $"trending_hashtags_{country}";

            // Check cache first
            if (_cache.TryGetValue(cacheKey, out List<TrendingHashtag>? cachedHashtags) && cachedHashtags != null)
            {
                _logger.LogInformation("Retrieved {Count} trending hashtags from cache for {Country}", cachedHashtags.Count, country);
                return cachedHashtags;
            }

            try
            {
                // Rate limiting
                await ApplyRateLimit();

                var hashtags = await ScrapeHashtagsFromTrendinalia(country);
                
                // Filter for beverage/wine related hashtags and add relevance scores
                var filteredHashtags = FilterAndScoreHashtags(hashtags, country);

                // Cache the results
                _cache.Set(cacheKey, filteredHashtags, _cacheExpiration);
                
                _logger.LogInformation("Retrieved and cached {Count} trending hashtags for {Country}", filteredHashtags.Count, country);
                return filteredHashtags;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving trending hashtags for {Country}", country);
                
                // Return fallback hashtags
                return GetFallbackHashtags(country);
            }
        }

        public async Task<List<BrewPost.Core.DTOs.GeneratedComponentDto>> GetTrendingComponentsAsync(string? country = null)
        {
            var hashtags = await GetTrendingHashtagsAsync(country);
            var components = new List<BrewPost.Core.DTOs.GeneratedComponentDto>();

            // Convert top hashtags to components
            var topHashtags = hashtags.Take(6).ToList();
            
            for (int i = 0; i < topHashtags.Count; i++)
            {
                var hashtag = topHashtags[i];
                components.Add(new BrewPost.Core.DTOs.GeneratedComponentDto
                {
                    Id = Guid.NewGuid().ToString(),
                    Type = "online_trend",
                    Title = $"#{hashtag.Hashtag}",
                    Name = $"Trending: {hashtag.Hashtag}",
                    Description = $"Currently trending hashtag #{hashtag.Hashtag} from {hashtag.Country} - perfect for increasing post visibility and engagement",
                    Category = "Online trend data",
                    Keywords = new[] { hashtag.Hashtag.ToLower(), "trending", "hashtag", "viral", country?.ToLower() ?? "global" },
                    RelevanceScore = hashtag.RelevanceScore,
                    Impact = hashtag.Position <= 3 ? "high" : hashtag.Position <= 6 ? "medium" : "low",
                    Color = GetTrendingColor(i)
                });
            }

            // Add general trending insights
            if (hashtags.Any())
            {
                components.Add(new BrewPost.Core.DTOs.GeneratedComponentDto
                {
                    Id = Guid.NewGuid().ToString(),
                    Type = "online_trend",
                    Title = "Trending Patterns",
                    Name = "Current Social Media Trends",
                    Description = $"Analysis of current trending patterns in {country ?? "worldwide"} - leverage these insights for optimal posting times and content themes",
                    Category = "Online trend data",
                    Keywords = new[] { "trends", "patterns", "social-media", "timing", "engagement" },
                    RelevanceScore = 0.75,
                    Impact = "medium",
                    Color = "#8B5CF6"
                });
            }

            return components;
        }

        private async Task<List<string>> ScrapeHashtagsFromTrendinalia(string country)
        {
            var hashtags = new List<string>();
            var url = country.ToLower() == "worldwide" 
                ? "https://trendinalia.com/" 
                : $"https://trendinalia.com/{country.ToLower()}/";

            try
            {
                var response = await _httpClient.GetStringAsync(url);
                var doc = new HtmlDocument();
                doc.LoadHtml(response);

                // Try multiple selectors as Trendinalia structure might vary
                var hashtagSelectors = new[]
                {
                    "//a[contains(@href, '/hashtag/')]",
                    "//span[contains(@class, 'trend')]",
                    "//div[contains(@class, 'hashtag')]//a",
                    "//li[contains(@class, 'trend')]//a"
                };

                foreach (var selector in hashtagSelectors)
                {
                    var nodes = doc.DocumentNode.SelectNodes(selector);
                    if (nodes != null)
                    {
                        foreach (var node in nodes.Take(20)) // Limit to top 20
                        {
                            var text = node.InnerText?.Trim();
                            if (!string.IsNullOrEmpty(text))
                            {
                                // Clean hashtag text
                                var cleanHashtag = CleanHashtag(text);
                                if (!string.IsNullOrEmpty(cleanHashtag) && !hashtags.Contains(cleanHashtag))
                                {
                                    hashtags.Add(cleanHashtag);
                                }
                            }
                        }
                        
                        if (hashtags.Count >= 15) break; // We have enough hashtags
                    }
                }

                _logger.LogInformation("Scraped {Count} hashtags from Trendinalia for {Country}", hashtags.Count, country);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error scraping hashtags from Trendinalia for {Country}", country);
                throw;
            }

            return hashtags;
        }

        private List<TrendingHashtag> FilterAndScoreHashtags(List<string> hashtags, string country)
        {
            var result = new List<TrendingHashtag>();
            var now = DateTime.UtcNow;

            for (int i = 0; i < hashtags.Count; i++)
            {
                var hashtag = hashtags[i];
                var relevanceScore = CalculateRelevanceScore(hashtag);
                
                // Include hashtags with decent relevance or top trending ones
                if (relevanceScore >= 0.3 || i < 5)
                {
                    result.Add(new TrendingHashtag
                    {
                        Hashtag = hashtag,
                        Country = country,
                        Position = i + 1,
                        RetrievedAt = now,
                        RelevanceScore = Math.Max(relevanceScore, 0.5) // Minimum 50% for trending items
                    });
                }
            }

            return result.OrderByDescending(h => h.RelevanceScore).Take(10).ToList();
        }

        private double CalculateRelevanceScore(string hashtag)
        {
            var lowerHashtag = hashtag.ToLower();
            double score = 0.5; // Base score for any trending hashtag

            // Check for beverage/wine related keywords
            foreach (var keyword in _beverageKeywords)
            {
                if (lowerHashtag.Contains(keyword))
                {
                    score += 0.3; // Boost for relevant keywords
                    break;
                }
            }

            // Boost for general business/marketing terms
            var businessKeywords = new[] { "business", "marketing", "social", "brand", "promo", "sale", "deal", "offer" };
            foreach (var keyword in businessKeywords)
            {
                if (lowerHashtag.Contains(keyword))
                {
                    score += 0.2;
                    break;
                }
            }

            return Math.Min(score, 1.0); // Cap at 100%
        }

        private string CleanHashtag(string text)
        {
            // Remove # symbol and clean the text
            var cleaned = text.Replace("#", "").Trim();
            
            // Remove numbers and special characters, keep only letters and spaces
            cleaned = Regex.Replace(cleaned, @"[^\w\s]", "");
            cleaned = Regex.Replace(cleaned, @"\s+", " ").Trim();
            
            // Skip if too short or contains only numbers
            if (cleaned.Length < 3 || Regex.IsMatch(cleaned, @"^\d+$"))
                return string.Empty;

            return cleaned;
        }

        private List<TrendingHashtag> GetFallbackHashtags(string country)
        {
            var fallbackHashtags = new[]
            {
                "wine", "cocktails", "happyhour", "winery", "craftbeer", "sommelier",
                "foodie", "restaurant", "dining", "cheers", "weekend", "friday"
            };

            return fallbackHashtags.Select((hashtag, index) => new TrendingHashtag
            {
                Hashtag = hashtag,
                Country = country,
                Position = index + 1,
                RetrievedAt = DateTime.UtcNow,
                RelevanceScore = 0.7 - (index * 0.05) // Decreasing relevance
            }).ToList();
        }

        private string GetTrendingColor(int index)
        {
            var colors = new[]
            {
                "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"
            };
            return colors[index % colors.Length];
        }

        private async Task ApplyRateLimit()
        {
            lock (_rateLimitLock)
            {
                var timeSinceLastRequest = DateTime.UtcNow - _lastRequestTime;
                if (timeSinceLastRequest < _rateLimitDelay)
                {
                    var delayTime = _rateLimitDelay - timeSinceLastRequest;
                    Thread.Sleep(delayTime);
                }
                _lastRequestTime = DateTime.UtcNow;
            }
        }
    }
}