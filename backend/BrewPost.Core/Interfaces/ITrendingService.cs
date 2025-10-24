using BrewPost.Core.DTOs;

namespace BrewPost.Core.Interfaces
{
    public interface ITrendingService
    {
        Task<List<TrendingHashtag>> GetTrendingHashtagsAsync(string? country = null);
        Task<List<GeneratedComponentDto>> GetTrendingComponentsAsync(string? country = null);
    }
}