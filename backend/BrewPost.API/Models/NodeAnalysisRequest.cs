namespace BrewPost.API.Models
{
    public class NodeAnalysisRequest
    {
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string? ImageUrl { get; set; }
        public List<string>? ImageUrls { get; set; }
        public string? ImagePrompt { get; set; }
        public string Type { get; set; } = "post";
        public string Status { get; set; } = "draft";
        public double X { get; set; }
        public double Y { get; set; }
    }

    public class NodeAnalysisResult
    {
        public double ImageScore { get; set; }
        public double CaptionScore { get; set; }
        public double TopicScore { get; set; }
        public double AverageScore { get; set; }
        public double OverallScore { get; set; }
        public string TopPerformingCategory { get; set; } = string.Empty;
        public string[] MostUsedHashtags { get; set; } = Array.Empty<string>();
        public object Projections { get; set; } = new();
        public object Insights { get; set; } = new();
    }
}