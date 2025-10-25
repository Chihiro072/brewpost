namespace BrewPost.API.Models
{
    public interface IAnalysisService
    {
        Task<ContentAnalysisResult> AnalyzeContentAsync(ContentAnalysisRequest request);
        Task<List<TrendingHashtagAnalysis>> GetTrendingHashtagsAnalysisAsync();
        Task<EngagementProjection> GetEngagementProjectionAsync(string contentId);
        Task<ReachForecast> GetReachForecastAsync(string contentId);
    }

    public class ContentAnalysisRequest
    {
        public string ContentId { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string? ImageUrl { get; set; }
        public List<string>? ImageUrls { get; set; }
        public List<string> Hashtags { get; set; } = new();
        public string ContentType { get; set; } = "post";
        public DateTime? ScheduledDate { get; set; }
    }

    public class ContentAnalysisResult
    {
        public AnalysisScores Scores { get; set; } = new();
        public AnalysisProjections Projections { get; set; } = new();
        public AnalysisInsights Insights { get; set; } = new();
        public List<TrendingHashtagAnalysis> TrendingHashtags { get; set; } = new();
        public DateTime AnalyzedAt { get; set; } = DateTime.UtcNow;
    }

    public class AnalysisScores
    {
        public double ImageScore { get; set; }
        public double CaptionScore { get; set; }
        public double TopicScore { get; set; }
        public double OverallScore { get; set; }
    }

    public class AnalysisProjections
    {
        public EngagementProjection Engagement { get; set; } = new();
        public ReachForecast Reach { get; set; } = new();
    }

    public class EngagementProjection
    {
        public List<EngagementDataPoint> Data { get; set; } = new();
    }

    public class EngagementDataPoint
    {
        public string Day { get; set; } = string.Empty;
        public int Likes { get; set; }
        public int Comments { get; set; }
        public int Shares { get; set; }
    }

    public class ReachForecast
    {
        public List<ReachDataPoint> Data { get; set; } = new();
    }

    public class ReachDataPoint
    {
        public string Week { get; set; } = string.Empty;
        public int Organic { get; set; }
        public int Hashtag { get; set; }
        public int Total { get; set; }
    }

    public class AnalysisInsights
    {
        public List<string> Strengths { get; set; } = new();
        public List<string> Improvements { get; set; } = new();
        public List<string> Recommendations { get; set; } = new();
    }

    public class TrendingHashtagAnalysis
    {
        public string Tag { get; set; } = string.Empty;
        public double Score { get; set; }
        public string Trend { get; set; } = "stable"; // "up", "down", "stable"
        public int UsageCount { get; set; }
        public double EngagementRate { get; set; }
    }
}