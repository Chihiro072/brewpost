using System.Text.Json;

namespace BrewPost.API.DTOs;

// User DTOs
public class UserDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? ProfilePicture { get; set; }
    public string? AvatarUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<SocialAccountDto> SocialAccounts { get; set; } = new();
}

public class UserProfileDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string AvatarUrl { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime LastLoginAt { get; set; }
    public List<SocialAccountDto> SocialAccounts { get; set; } = new();
    public object Preferences { get; set; } = new();
}

public class SocialAccountDto
{
    public Guid Id { get; set; }
    public string Platform { get; set; } = string.Empty;
    public string PlatformUserId { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public bool IsConnected { get; set; }
    public DateTime ConnectedAt { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string ProviderId { get; set; } = string.Empty;
}

// Content Plan DTOs
public class ContentPlanDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Prompt { get; set; } = string.Empty;
    public JsonDocument BrandInfo { get; set; } = JsonDocument.Parse("{}");
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public int PostCount { get; set; }
}

public class ContentPlanDetailDto : ContentPlanDto
{
    public List<PostSummaryDto> Posts { get; set; } = new();
}

// Post DTOs
public class PostSummaryDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Caption { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime? ScheduledAt { get; set; }
    public DateTime? PublishedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public int ImageCount { get; set; }
    public bool HasAnalytics { get; set; }
}

public class PostDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Caption { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public Guid? ContentPlanId { get; set; }
    public Guid? PlanId { get; set; }
    public string? ContentPlanTitle { get; set; }
    public string? PlanTitle { get; set; }
    public string? ImagePrompt { get; set; }
    public JsonDocument? Platforms { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public DateTime? PublishedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<GeneratedImageDto> GeneratedImages { get; set; } = new();
    public List<AssetDto> Assets { get; set; } = new();
    public List<ScheduleDto> Schedules { get; set; } = new();
    public AnalyticsDto? Analytics { get; set; }
    public int ImageCount { get; set; }
    public bool HasAnalytics { get; set; }
    public int ScheduleCount { get; set; }
}

public class PostDetailDto : PostDto
{
    public string UserEmail { get; set; } = string.Empty;
}

// Image DTOs
public class GeneratedImageDto
{
    public Guid Id { get; set; }
    public Guid PostId { get; set; }
    public string PostTitle { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public string GenerationPrompt { get; set; } = string.Empty;
    public JsonDocument GenerationParams { get; set; } = JsonDocument.Parse("{}");
    public DateTime CreatedAt { get; set; }
}

public class GeneratedImageDetailDto : GeneratedImageDto
{
    public string UserEmail { get; set; } = string.Empty;
    public string PostCaption { get; set; } = string.Empty;
}

public class ImageDto
{
    public Guid Id { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public string Prompt { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

// Asset DTOs
public class AssetDto
{
    public Guid Id { get; set; }
    public string Filename { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string FileType { get; set; } = string.Empty;
    public int FileSize { get; set; }
    public string? S3Key { get; set; }
    public string? UsageType { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AssetDetailDto : AssetDto
{
    public string UserEmail { get; set; } = string.Empty;
    public List<PostUsageDto> PostUsages { get; set; } = new();
    public List<PostUsageDto> UsedInPosts { get; set; } = new();
}

public class PostUsageDto
{
    public Guid PostId { get; set; }
    public string PostTitle { get; set; } = string.Empty;
    public DateTime UsedAt { get; set; }
    public string UsageType { get; set; } = string.Empty;
}

// Analytics DTOs
public class AnalyticsDto
{
    public Guid Id { get; set; }
    public Guid PostId { get; set; }
    public string PostTitle { get; set; } = string.Empty;
    public int PredictedViews { get; set; }
    public int PredictedLikes { get; set; }
    public int PredictedComments { get; set; }
    public decimal SentimentScore { get; set; }
    public JsonDocument? DetailedMetrics { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AnalyticsDetailDto : AnalyticsDto
{
    public string PostCaption { get; set; } = string.Empty;
}

// Schedule DTOs
public class ScheduleDto
{
    public Guid Id { get; set; }
    public Guid PostId { get; set; }
    public string PostTitle { get; set; } = string.Empty;
    public string PostCaption { get; set; } = string.Empty;
    public string Platform { get; set; } = string.Empty;
    public DateTime ScheduledTime { get; set; }
    public string Status { get; set; } = string.Empty;
    public int AttemptCount { get; set; }
    public DateTime? LastAttemptAt { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ScheduleDetailDto : ScheduleDto
{
    public List<ImageDto> PostImages { get; set; } = new();
}

// Dashboard DTOs
public class DashboardDto
{
    public DashboardSummaryDto Summary { get; set; } = new();
    public List<PerformanceTrendDto> PerformanceTrends { get; set; } = new();
    public List<TopPostDto> TopPosts { get; set; } = new();
    public DateRangeDto DateRange { get; set; } = new();
}

// Helper classes
public class AnalyticsPrediction
{
    public int PredictedViews { get; set; }
    public int PredictedLikes { get; set; }
    public int PredictedComments { get; set; }
    public decimal SentimentScore { get; set; }
    public JsonDocument DetailedMetrics { get; set; } = JsonDocument.Parse("{}");
}

public class DashboardSummaryDto
{
    public int TotalPosts { get; set; }
    public int PublishedPosts { get; set; }
    public int ScheduledPosts { get; set; }
    public int DraftPosts { get; set; }
    public int TotalPredictedViews { get; set; }
    public int TotalPredictedLikes { get; set; }
    public int TotalPredictedComments { get; set; }
    public decimal AverageSentiment { get; set; }
}

public class PerformanceTrendDto
{
    public DateTime Date { get; set; }
    public int PostCount { get; set; }
    public int TotalViews { get; set; }
    public int TotalLikes { get; set; }
    public int TotalComments { get; set; }
    public double AverageSentiment { get; set; }
}

public class TopPostDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public int PredictedViews { get; set; }
    public int PredictedLikes { get; set; }
    public decimal SentimentScore { get; set; }
}

public class DateRangeDto
{
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
}