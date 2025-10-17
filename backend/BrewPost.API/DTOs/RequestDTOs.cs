using System.Text.Json;

namespace BrewPost.API.DTOs;

// Auth Request DTOs
public class RegisterRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
}

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class OAuthCallbackRequest
{
    public string Code { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Platform { get; set; } = string.Empty;
    public string? RedirectUri { get; set; }
}

public class AuthResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public string Token { get; set; } = string.Empty;
    public UserDto User { get; set; } = new();
}

// User Request DTOs
public class UpdateUserRequest
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? ProfilePicture { get; set; }
}

public class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

// Content Plan Request DTOs
public class CreateContentPlanRequest
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Prompt { get; set; } = string.Empty;
    public JsonDocument? BrandInfo { get; set; }
}

public class UpdateContentPlanRequest
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? Status { get; set; }
    public string? Prompt { get; set; }
    public JsonDocument? BrandInfo { get; set; }
}

// Post Request DTOs
public class CreatePostRequest
{
    public string Title { get; set; } = string.Empty;
    public string Caption { get; set; } = string.Empty;
    public Guid? ContentPlanId { get; set; }
    public Guid? PlanId { get; set; }
    public string? ImagePrompt { get; set; }
    public JsonDocument? Platforms { get; set; }
}

public class UpdatePostRequest
{
    public string? Title { get; set; }
    public string? Caption { get; set; }
    public string? Status { get; set; }
    public Guid? ContentPlanId { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public JsonDocument? Platforms { get; set; }
    public string? ImagePrompt { get; set; }
}

// Image Request DTOs
public class GenerateImageRequest
{
    public string Prompt { get; set; } = string.Empty;
    public Guid? PostId { get; set; }
    public JsonDocument? Parameters { get; set; }
}

public class RegenerateImageRequest
{
    public string? Prompt { get; set; }
    public JsonDocument? Parameters { get; set; }
}

public class BatchGenerateImagesRequest
{
    public Guid PostId { get; set; }
    public string Prompt { get; set; } = string.Empty;
    public int Count { get; set; }
    public JsonDocument? Parameters { get; set; }
}

// Asset Request DTOs
public class AttachAssetRequest
{
    public Guid PostId { get; set; }
    public string UsageType { get; set; } = string.Empty;
}

// Analytics Request DTOs
public class PredictAnalyticsRequest
{
    public Guid PostId { get; set; }
}

// Schedule Request DTOs
public class CreateScheduleRequest
{
    public Guid PostId { get; set; }
    public string Platform { get; set; } = string.Empty;
    public DateTime ScheduledTime { get; set; }
}

public class UpdateScheduleRequest
{
    public string? Platform { get; set; }
    public DateTime? ScheduledTime { get; set; }
}

public class SchedulePostRequest
{
    public string Platform { get; set; } = string.Empty;
    public DateTime? ScheduledAt { get; set; }
}

// Additional User Request DTOs
public class UpdateProfileRequest
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? AvatarUrl { get; set; }
    public JsonDocument? Preferences { get; set; }
}

public class DeleteAccountRequest
{
    public string Password { get; set; } = string.Empty;
}

// Additional Asset Request DTOs
public class UploadAssetRequest
{
    public IFormFile? File { get; set; }
}

public class UploadMultipleAssetsRequest
{
    public IEnumerable<IFormFile>? Files { get; set; }
}