namespace BrewPost.Core.DTOs;

public class TrendingHashtag
{
    public string Hashtag { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public int Position { get; set; }
    public DateTime RetrievedAt { get; set; }
    public double RelevanceScore { get; set; }
}