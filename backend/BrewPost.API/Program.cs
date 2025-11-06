using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using BrewPost.Infrastructure.Data;
using BrewPost.Core.Interfaces;
using BrewPost.Infrastructure.Services;
using Amazon.S3;
using Amazon.Extensions.NETCore.Setup;
using DotNetEnv;
using Stripe;

// Load .env file from backend directory (go up 1 level from BrewPost.API)
var envPath = Path.Combine(Directory.GetCurrentDirectory(), "..", ".env");
if (System.IO.File.Exists(envPath))
{
    Env.Load(envPath);
    Console.WriteLine($"✅ Loaded .env file from: {envPath}");
}
else
{
    Console.WriteLine($"⚠️ .env file not found at: {envPath}");
}

var builder = WebApplication.CreateBuilder(args);

// Add environment variables to configuration - this should take precedence
builder.Configuration.AddEnvironmentVariables();

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add session support for OAuth state management
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

// Configure Entity Framework with conditional provider
var useInMemory = (builder.Configuration["USE_INMEMORY_DB"] ?? "").Equals("true", StringComparison.OrdinalIgnoreCase);
if (useInMemory)
{
    Console.WriteLine("🧪 Using InMemory database provider for development");
    builder.Services.AddDbContext<BrewPostDbContext>(options =>
        options.UseInMemoryDatabase("BrewPostDev"));
}
else
{
    Console.WriteLine("🐘 Using PostgreSQL provider");
    builder.Services.AddDbContext<BrewPostDbContext>(options =>
        options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"),
            b => b.MigrationsAssembly("BrewPost.API")));
}

// Configure JWT Authentication
var jwtSettings = builder.Configuration.GetSection("Jwt");
var secretKey = jwtSettings["SecretKey"] ?? throw new InvalidOperationException("JWT SecretKey not configured");
var key = Encoding.ASCII.GetBytes(secretKey);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false; // Set to true in production
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidateAudience = true,
        ValidAudience = jwtSettings["Audience"],
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

// Configure AWS S3
var awsOptions = new AWSOptions
{
    Region = Amazon.RegionEndpoint.GetBySystemName(
        builder.Configuration["REGION"] ?? 
        builder.Configuration["AWS:Region"] ?? 
        "us-east-1")
};

// Add AWS credentials if provided (for local development)
// Try environment variables first (from .env), then fall back to appsettings
var accessKey = builder.Configuration["ACCESS_KEY_ID"] ?? builder.Configuration["AWS:AccessKey"]; 
var awsSecretKey = builder.Configuration["SECRET_ACCESS_KEY"] ?? builder.Configuration["AWS:SecretKey"]; 
if (!string.IsNullOrEmpty(accessKey) && !string.IsNullOrEmpty(awsSecretKey))
{
    Console.WriteLine($"✅ AWS credentials loaded - Access Key: {accessKey.Substring(0, 4)}****");
    awsOptions.Credentials = new Amazon.Runtime.BasicAWSCredentials(accessKey, awsSecretKey);
}
else
{
    Console.WriteLine("⚠️ No AWS credentials found in configuration");
}

builder.Services.AddDefaultAWSOptions(awsOptions);
builder.Services.AddAWSService<IAmazonS3>();

// Configure Bedrock client with extended timeout for AI operations
builder.Services.AddSingleton<Amazon.BedrockRuntime.IAmazonBedrockRuntime>(sp =>
{
    var cfg = new Amazon.BedrockRuntime.AmazonBedrockRuntimeConfig
    {
        RegionEndpoint = awsOptions.Region,
        Timeout = TimeSpan.FromMinutes(2)
    };
    return awsOptions.Credentials != null
        ? new Amazon.BedrockRuntime.AmazonBedrockRuntimeClient(awsOptions.Credentials, cfg)
        : new Amazon.BedrockRuntime.AmazonBedrockRuntimeClient(cfg);
});

// Register application services
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IOAuthService, OAuthService>();
builder.Services.AddScoped<IS3Service, S3Service>();
builder.Services.AddScoped<IBedrockService, BedrockService>();
builder.Services.AddScoped<ITrendingService, TrendingService>();
builder.Services.AddScoped<BrewPost.API.Models.IAnalysisService, BrewPost.API.Models.AnalysisService>();
builder.Services.AddHttpClient<IOAuthService, OAuthService>();
builder.Services.AddHttpClient<ITrendingService, TrendingService>();
builder.Services.AddMemoryCache();

// Configure Stripe from env
var stripeSecret = builder.Configuration["STRIPE_SECRET_KEY"] ?? builder.Configuration["Stripe:SecretKey"];
if (!string.IsNullOrWhiteSpace(stripeSecret))
{
    var isTest = stripeSecret.StartsWith("sk_test_", StringComparison.OrdinalIgnoreCase);
    var isLive = stripeSecret.StartsWith("sk_live_", StringComparison.OrdinalIgnoreCase);
    var looksPlaceholder = stripeSecret.Contains("EXAMPLE", StringComparison.OrdinalIgnoreCase)
                           || stripeSecret.Contains("your_actual_secret_key_here", StringComparison.OrdinalIgnoreCase)
                           || stripeSecret.EndsWith("here", StringComparison.OrdinalIgnoreCase);

    var masked = stripeSecret.Length > 12
        ? stripeSecret.Substring(0, 12) + new string('*', Math.Max(0, stripeSecret.Length - 12))
        : stripeSecret;

    Console.WriteLine($"ℹ️ Stripe key detected: {(isTest ? "test" : isLive ? "live" : "unknown")} mode, value: {masked}");

    if (looksPlaceholder || (!isTest && !isLive))
    {
        Console.WriteLine("❌ Stripe secret key looks invalid or placeholder. Update STRIPE_SECRET_KEY in backend/.env.");
    }

    StripeConfiguration.ApiKey = stripeSecret;

    try
    {
        var client = new StripeClient(stripeSecret);
        var balanceService = new BalanceService(client);
        balanceService.Get(); // lightweight validation call
        Console.WriteLine("✅ Stripe secret key validated via API call.");
    }
    catch (StripeException ex)
    {
        Console.WriteLine($"❌ Stripe API validation failed: {ex.Message}");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ Stripe validation error: {ex.Message}");
    }
}
else
{
    Console.WriteLine("⚠️ Stripe secret key not configured");
}

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "http://localhost:5173",
            "http://localhost:8080",
            "http://localhost:8081"
        ) // React dev servers
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowFrontend");
app.UseSession();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
